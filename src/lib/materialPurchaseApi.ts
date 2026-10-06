import { supabase } from "./supabase";
import { compressReceiptImage } from "./workLogApi";

const RECEIPT_BUCKET = "material-purchase-receipts";

export const URGENT_AMOUNT_LIMIT_WON = 300_000;
export const URGENT_AMOUNT_LIMIT_MESSAGE = "30만 원 이상이면 긴급으로 등록할 수 없습니다.";

export function isUrgentAmountOverLimit(urgent: boolean, amount: number | null, currency: string) {
    if (!urgent) return false;
    if ((currency || "원") !== "원") return false;
    if (amount == null || !Number.isFinite(amount)) return false;
    return amount >= URGENT_AMOUNT_LIMIT_WON;
}

export type MaterialPurchaseStatus = "planned" | "confirmed";
export type MaterialPurchaseKind = "work" | "personal";

export interface MaterialPurchaseLineInput {
    materialName: string;
    vendor: string;
    amount: number | null;
    currency: string;
    spec: string;
    grade: string;
    note: string;
    urgent: boolean;
    receipts: File[];
}

export interface CreateMaterialPurchaseInput {
    status: MaterialPurchaseStatus;
    kind: MaterialPurchaseKind;
    vesselName: string;
    orderGroup: string;
    orderPersons: string[];
    tripPurpose: string;
    lines: MaterialPurchaseLineInput[];
}

function emptyToNull(value: string) {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
}

function fileExtension(file: File) {
    const ext = file.name.includes(".") ? file.name.split(".").pop() || "" : "";
    const safe = ext.replace(/[^a-zA-Z0-9]/g, "");
    return safe || "bin";
}

export async function createMaterialPurchase(input: CreateMaterialPurchaseInput): Promise<string> {
    const {
        data: { user },
        error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
        throw new Error("로그인 정보를 확인할 수 없습니다.");
    }

    const isWork = input.kind === "work";
    const { data: purchase, error: purchaseError } = await supabase
        .from("material_purchases")
        .insert({
            user_id: user.id,
            status: input.status,
            kind: input.kind,
            vessel_name: isWork ? emptyToNull(input.vesselName) : null,
            order_group: isWork ? emptyToNull(input.orderGroup) : null,
            order_persons: isWork ? input.orderPersons : [],
            trip_purpose: isWork ? emptyToNull(input.tripPurpose) : null,
        })
        .select("id")
        .single();

    if (purchaseError || !purchase) {
        throw new Error(purchaseError?.message || "등록에 실패했습니다.");
    }

    const purchaseId = purchase.id as string;
    const uploadedPaths: string[] = [];

    const rollback = async () => {
        if (uploadedPaths.length > 0) {
            await supabase.storage.from(RECEIPT_BUCKET).remove(uploadedPaths);
        }
        await supabase.from("material_purchases").delete().eq("id", purchaseId);
    };

    try {
        const { data: insertedLines, error: lineError } = await supabase
            .from("material_purchase_lines")
            .insert(
                input.lines.map((line, index) => ({
                    purchase_id: purchaseId,
                    sort_order: index,
                    material_name: line.materialName.trim(),
                    vendor: emptyToNull(line.vendor),
                    amount: line.amount,
                    currency: line.currency || "원",
                    spec: emptyToNull(line.spec),
                    grade: emptyToNull(line.grade),
                    note: emptyToNull(line.note),
                    urgent: line.urgent,
                }))
            )
            .select("id, sort_order");

        if (lineError || !insertedLines) {
            throw new Error(lineError?.message || "품목 저장에 실패했습니다.");
        }

        if (input.status !== "confirmed") return purchaseId;

        const lineIdByOrder = new Map(insertedLines.map((line) => [line.sort_order as number, line.id as string]));
        const receiptRows: {
            line_id: string;
            storage_path: string;
            file_name: string;
            content_type: string;
        }[] = [];

        for (let index = 0; index < input.lines.length; index += 1) {
            const line = input.lines[index];
            const lineId = lineIdByOrder.get(index);
            if (!lineId || line.receipts.length === 0) continue;

            for (const file of line.receipts) {
                const uploadFile = await compressReceiptImage(file);
                const path = `${user.id}/${purchaseId}/${lineId}/${Date.now()}_${Math.random().toString(36).slice(2, 10)}.${fileExtension(uploadFile)}`;
                const { error: uploadError } = await supabase.storage.from(RECEIPT_BUCKET).upload(path, uploadFile, {
                    cacheControl: "3600",
                    upsert: false,
                    contentType: uploadFile.type || undefined,
                });
                if (uploadError) {
                    throw new Error(uploadError.message || "영수증 업로드에 실패했습니다.");
                }
                uploadedPaths.push(path);
                receiptRows.push({
                    line_id: lineId,
                    storage_path: path,
                    file_name: uploadFile.name,
                    content_type: uploadFile.type || "application/octet-stream",
                });
            }
        }

        if (receiptRows.length > 0) {
            const { error: receiptError } = await supabase.from("material_purchase_receipts").insert(receiptRows);
            if (receiptError) {
                throw new Error(receiptError.message || "영수증 저장에 실패했습니다.");
            }
        }

        return purchaseId;
    } catch (error) {
        await rollback();
        throw error instanceof Error ? error : new Error("등록에 실패했습니다.");
    }
}

export type MaterialPurchaseApproval = "pending" | "approved";

export interface MaterialPurchaseListReceipt {
    id: string;
    fileName: string;
    contentType: string;
    url: string;
}

export interface MaterialPurchaseListItem {
    id: string;
    purchaseId: string;
    lineId: string | null;
    author: string;
    authorEmail: string | null;
    authorPosition: string | null;
    kind: MaterialPurchaseKind;
    vessel: string;
    materialName: string;
    vendor: string;
    amountLabel: string;
    createdAtLabel: string;
    purchaseStatus: MaterialPurchaseStatus;
    approvalStatus: MaterialPurchaseApproval;
    purchased: boolean;
    urgent: boolean;
    receipts: MaterialPurchaseListReceipt[];
}

function formatListDate(dateString: string) {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return "";
    const year = String(date.getFullYear()).slice(-2);
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}.${month}.${day}.`;
}

function formatAmountLabel(amount: number | null, currency: string | null) {
    if (amount == null || !Number.isFinite(amount)) return "";
    const formatted = amount.toLocaleString(undefined, { maximumFractionDigits: 2 });
    return `${formatted}${currency || "원"}`;
}

export async function fetchMaterialPurchaseList(): Promise<MaterialPurchaseListItem[]> {
    const { data, error } = await supabase
        .from("material_purchases")
        .select(
            "id, user_id, status, kind, approval_status, purchased, vessel_name, created_at, material_purchase_lines(id, sort_order, material_name, vendor, amount, currency, urgent, material_purchase_receipts(id, storage_path, file_name, content_type))"
        )
        .order("created_at", { ascending: false });

    if (error) {
        throw new Error(error.message || "목록을 불러오지 못했습니다.");
    }

    const purchases = data ?? [];
    const userIds = [...new Set(purchases.map((row) => row.user_id).filter(Boolean))] as string[];
    const profileById = new Map<string, { name: string | null; email: string | null; position: string | null }>();

    if (userIds.length > 0) {
        const { data: profiles } = await supabase
            .from("profiles")
            .select("id, name, email, position")
            .in("id", userIds);
        for (const profile of profiles ?? []) {
            profileById.set(profile.id, {
                name: profile.name ?? null,
                email: profile.email ?? null,
                position: profile.position ?? null,
            });
        }
    }

    const receiptPaths = [
        ...new Set(
            purchases.flatMap((purchase) =>
                (purchase.material_purchase_lines ?? []).flatMap((line) =>
                    (line.material_purchase_receipts ?? []).map((receipt) => receipt.storage_path).filter(Boolean)
                )
            )
        ),
    ];
    const signedByPath = new Map<string, string>();
    if (receiptPaths.length > 0) {
        const { data: signed } = await supabase.storage.from(RECEIPT_BUCKET).createSignedUrls(receiptPaths, 60 * 60);
        for (const row of signed ?? []) {
            if (row.path && row.signedUrl) signedByPath.set(row.path, row.signedUrl);
        }
    }

    const items: MaterialPurchaseListItem[] = [];
    for (const purchase of purchases) {
        const profile = profileById.get(purchase.user_id);
        const lines = [...(purchase.material_purchase_lines ?? [])].sort(
            (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
        );
        const base = {
            author: profile?.name?.trim() || "(작성자 없음)",
            authorEmail: profile?.email ?? null,
            authorPosition: profile?.position ?? null,
            kind: purchase.kind === "personal" ? "personal" : "work",
            vessel: purchase.vessel_name?.trim() || "",
            createdAtLabel: formatListDate(purchase.created_at),
            purchaseStatus: purchase.status as MaterialPurchaseStatus,
            approvalStatus: purchase.approval_status === "approved" ? "approved" : "pending",
            purchased: purchase.purchased === true,
            urgent: false,
        };
        if (lines.length === 0) {
            items.push({
                ...base,
                id: purchase.id,
                purchaseId: purchase.id,
                lineId: null,
                materialName: "",
                vendor: "",
                amountLabel: "",
                receipts: [],
            });
            continue;
        }
        for (const line of lines) {
            const receipts: MaterialPurchaseListReceipt[] = [];
            for (const receipt of line.material_purchase_receipts ?? []) {
                const url = signedByPath.get(receipt.storage_path);
                if (!url) continue;
                receipts.push({
                    id: receipt.id,
                    fileName: receipt.file_name || "영수증",
                    contentType: receipt.content_type || "application/octet-stream",
                    url,
                });
            }
            items.push({
                ...base,
                id: line.id,
                purchaseId: purchase.id,
                lineId: line.id,
                materialName: line.material_name?.trim() || "",
                vendor: line.vendor?.trim() || "",
                amountLabel: formatAmountLabel(line.amount == null ? null : Number(line.amount), line.currency),
                urgent: line.urgent === true,
                receipts,
            });
        }
    }

    return items;
}

export async function deleteMaterialPurchaseLine(item: {
    purchaseId: string;
    lineId: string | null;
}): Promise<void> {
    if (!item.lineId) {
        const { error } = await supabase.from("material_purchases").delete().eq("id", item.purchaseId);
        if (error) throw new Error(error.message || "삭제에 실패했습니다.");
        return;
    }

    const { data: receipts, error: receiptError } = await supabase
        .from("material_purchase_receipts")
        .select("storage_path")
        .eq("line_id", item.lineId);
    if (receiptError) throw new Error(receiptError.message || "영수증 정보를 불러오지 못했습니다.");

    const paths = (receipts ?? []).map((receipt) => receipt.storage_path).filter(Boolean);
    if (paths.length > 0) {
        const { error: storageError } = await supabase.storage.from(RECEIPT_BUCKET).remove(paths);
        if (storageError) throw new Error(storageError.message || "영수증 파일 삭제에 실패했습니다.");
    }

    const { error: lineError } = await supabase.from("material_purchase_lines").delete().eq("id", item.lineId);
    if (lineError) throw new Error(lineError.message || "삭제에 실패했습니다.");

    const { count, error: countError } = await supabase
        .from("material_purchase_lines")
        .select("id", { count: "exact", head: true })
        .eq("purchase_id", item.purchaseId);
    if (countError) return;
    if ((count ?? 0) === 0) {
        await supabase.from("material_purchases").delete().eq("id", item.purchaseId);
    }
}

const ORDER_GROUP_LABELS: Record<string, string> = {
    ELU: "Everllence-ELU",
    PRIME: "Everllence-Prime",
    MITSUI: "Mitsui",
    OTHER: "기타 (직접입력)",
};

export interface MaterialPurchaseReceiptDetail {
    id: string;
    fileName: string;
    contentType: string;
    url: string;
    storagePath: string;
}

export interface MaterialPurchaseLineDetail {
    id: string;
    materialName: string;
    vendor: string;
    amountLabel: string;
    amountText: string;
    currency: string;
    spec: string;
    grade: string;
    note: string;
    urgent: boolean;
    receipts: MaterialPurchaseReceiptDetail[];
}

export interface MaterialPurchaseDetail {
    id: string;
    author: string;
    authorEmail: string | null;
    authorPosition: string | null;
    kind: MaterialPurchaseKind;
    vessel: string;
    orderGroup: string;
    orderGroupLabel: string;
    orderPersons: string[];
    tripPurpose: string;
    createdAtLabel: string;
    purchaseStatus: MaterialPurchaseStatus;
    approvalStatus: MaterialPurchaseApproval;
    purchased: boolean;
    lines: MaterialPurchaseLineDetail[];
}

export async function fetchCurrentUserIsAdmin(): Promise<boolean> {
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;
    const { data, error } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (error) return false;
    return data?.role === "admin";
}

export async function fetchMaterialPurchaseDetail(
    purchaseId: string,
    lineId?: string | null
): Promise<MaterialPurchaseDetail> {
    const { data, error } = await supabase
        .from("material_purchases")
        .select(
            "id, user_id, status, kind, approval_status, purchased, vessel_name, order_group, order_persons, trip_purpose, created_at, material_purchase_lines(id, sort_order, material_name, vendor, amount, currency, spec, grade, note, urgent, material_purchase_receipts(id, storage_path, file_name, content_type))"
        )
        .eq("id", purchaseId)
        .single();

    if (error || !data) {
        throw new Error(error?.message || "상세 정보를 불러오지 못했습니다.");
    }

    const { data: profile } = await supabase
        .from("profiles")
        .select("name, email, position")
        .eq("id", data.user_id)
        .maybeSingle();

    const lines = [...(data.material_purchase_lines ?? [])]
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .filter((line) => !lineId || line.id === lineId);

    if (lineId && lines.length === 0) {
        throw new Error("해당 자재 정보를 찾을 수 없습니다.");
    }

    const detailLines: MaterialPurchaseLineDetail[] = [];
    for (const line of lines) {
        const receipts: MaterialPurchaseReceiptDetail[] = [];
        for (const receipt of line.material_purchase_receipts ?? []) {
            const { data: signed } = await supabase.storage
                .from(RECEIPT_BUCKET)
                .createSignedUrl(receipt.storage_path, 60 * 60);
            if (!signed?.signedUrl) continue;
            receipts.push({
                id: receipt.id,
                fileName: receipt.file_name || "영수증",
                contentType: receipt.content_type || "application/octet-stream",
                url: signed.signedUrl,
                storagePath: receipt.storage_path,
            });
        }
        const amountNumber = line.amount == null ? null : Number(line.amount);
        detailLines.push({
            id: line.id,
            materialName: line.material_name?.trim() || "",
            vendor: line.vendor?.trim() || "",
            amountLabel: formatAmountLabel(amountNumber, line.currency),
            amountText:
                amountNumber == null || !Number.isFinite(amountNumber)
                    ? ""
                    : amountNumber.toLocaleString(undefined, { maximumFractionDigits: 2 }),
            currency: line.currency || "원",
            spec: line.spec?.trim() || "",
            grade: line.grade?.trim() || "",
            note: line.note?.trim() || "",
            urgent: line.urgent === true,
            receipts,
        });
    }

    return {
        id: data.id,
        author: profile?.name?.trim() || "(작성자 없음)",
        authorEmail: profile?.email ?? null,
        authorPosition: profile?.position ?? null,
        kind: data.kind === "personal" ? "personal" : "work",
        vessel: data.vessel_name?.trim() || "",
        orderGroup: data.order_group || "",
        orderGroupLabel: data.order_group ? ORDER_GROUP_LABELS[data.order_group] || data.order_group : "",
        orderPersons: data.order_persons ?? [],
        tripPurpose: data.trip_purpose?.trim() || "",
        createdAtLabel: formatListDate(data.created_at),
        purchaseStatus: data.status as MaterialPurchaseStatus,
        approvalStatus: data.approval_status === "approved" ? "approved" : "pending",
        purchased: data.purchased === true,
        lines: detailLines,
    };
}

export async function approveMaterialPurchase(purchaseId: string): Promise<void> {
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("로그인 정보를 확인할 수 없습니다.");

    const isAdmin = await fetchCurrentUserIsAdmin();
    if (!isAdmin) throw new Error("관리자만 승인할 수 있습니다.");

    const { data, error } = await supabase
        .from("material_purchases")
        .update({
            approval_status: "approved",
            approved_by: user.id,
            approved_at: new Date().toISOString(),
        })
        .eq("id", purchaseId)
        .select("id")
        .maybeSingle();

    if (error || !data) {
        throw new Error(error?.message || "승인에 실패했습니다.");
    }
}

export async function revokeMaterialPurchaseApproval(purchaseId: string): Promise<void> {
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("로그인 정보를 확인할 수 없습니다.");

    const isAdmin = await fetchCurrentUserIsAdmin();
    if (!isAdmin) throw new Error("관리자만 승인을 해제할 수 있습니다.");

    const { data, error } = await supabase
        .from("material_purchases")
        .update({
            approval_status: "pending",
            approved_by: null,
            approved_at: null,
        })
        .eq("id", purchaseId)
        .select("id")
        .maybeSingle();

    if (error || !data) {
        throw new Error(error?.message || "승인 해제에 실패했습니다.");
    }
}

export async function setMaterialPurchasePurchased(purchaseId: string, purchased: boolean): Promise<void> {
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("로그인 정보를 확인할 수 없습니다.");

    const isAdmin = await fetchCurrentUserIsAdmin();
    if (!isAdmin) throw new Error("관리자만 구매 완료를 변경할 수 있습니다.");

    const { data, error } = await supabase
        .from("material_purchases")
        .update({ purchased })
        .eq("id", purchaseId)
        .select("id")
        .maybeSingle();

    if (error || !data) {
        throw new Error(error?.message || (purchased ? "구매 완료 처리에 실패했습니다." : "구매 완료 해제에 실패했습니다."));
    }
}

export interface UpdateMaterialPurchaseInput {
    purchaseId: string;
    lineId: string;
    kind: MaterialPurchaseKind;
    vesselName: string;
    orderGroup: string;
    orderPersons: string[];
    tripPurpose: string;
    materialName: string;
    vendor: string;
    amount: number | null;
    currency: string;
    spec: string;
    grade: string;
    note: string;
    urgent: boolean;
    keptReceiptIds: string[];
    newReceipts: File[];
}

async function uploadReceiptFiles(userId: string, purchaseId: string, lineId: string, files: File[]) {
    if (files.length === 0) return;

    const uploadedPaths: string[] = [];
    const receiptRows: {
        line_id: string;
        storage_path: string;
        file_name: string;
        content_type: string;
    }[] = [];

    try {
        for (const file of files) {
            const uploadFile = await compressReceiptImage(file);
            const path = `${userId}/${purchaseId}/${lineId}/${Date.now()}_${Math.random().toString(36).slice(2, 10)}.${fileExtension(uploadFile)}`;
            const { error: uploadError } = await supabase.storage.from(RECEIPT_BUCKET).upload(path, uploadFile, {
                cacheControl: "3600",
                upsert: false,
                contentType: uploadFile.type || undefined,
            });
            if (uploadError) throw new Error(uploadError.message || "영수증 업로드에 실패했습니다.");
            uploadedPaths.push(path);
            receiptRows.push({
                line_id: lineId,
                storage_path: path,
                file_name: uploadFile.name,
                content_type: uploadFile.type || "application/octet-stream",
            });
        }

        const { error: receiptError } = await supabase.from("material_purchase_receipts").insert(receiptRows);
        if (receiptError) throw new Error(receiptError.message || "영수증 저장에 실패했습니다.");
    } catch (error) {
        if (uploadedPaths.length > 0) {
            await supabase.storage.from(RECEIPT_BUCKET).remove(uploadedPaths);
        }
        throw error instanceof Error ? error : new Error("영수증 저장에 실패했습니다.");
    }
}

export async function deleteMaterialPurchaseReceipt(receipt: {
    id: string;
    storagePath: string;
}): Promise<void> {
    if (receipt.storagePath) {
        const { error: storageError } = await supabase.storage.from(RECEIPT_BUCKET).remove([receipt.storagePath]);
        if (storageError) throw new Error(storageError.message || "영수증 파일 삭제에 실패했습니다.");
    }
    const { error } = await supabase.from("material_purchase_receipts").delete().eq("id", receipt.id);
    if (error) throw new Error(error.message || "영수증 삭제에 실패했습니다.");
}

export async function addMaterialPurchaseReceipts(input: {
    purchaseId: string;
    lineId: string;
    files: File[];
}): Promise<void> {
    const {
        data: { user },
        error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
        throw new Error("로그인 정보를 확인할 수 없습니다.");
    }
    await uploadReceiptFiles(user.id, input.purchaseId, input.lineId, input.files);
}

export async function updateMaterialPurchase(input: UpdateMaterialPurchaseInput): Promise<void> {
    const {
        data: { user },
        error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
        throw new Error("로그인 정보를 확인할 수 없습니다.");
    }

    const isWork = input.kind === "work";
    const { data: purchase, error: purchaseError } = await supabase
        .from("material_purchases")
        .update({
            kind: input.kind,
            vessel_name: isWork ? emptyToNull(input.vesselName) : null,
            order_group: isWork ? emptyToNull(input.orderGroup) : null,
            order_persons: isWork ? input.orderPersons : [],
            trip_purpose: isWork ? emptyToNull(input.tripPurpose) : null,
        })
        .eq("id", input.purchaseId)
        .select("id")
        .maybeSingle();

    if (purchaseError || !purchase) {
        throw new Error(purchaseError?.message || "수정에 실패했습니다.");
    }

    const { data: line, error: lineError } = await supabase
        .from("material_purchase_lines")
        .update({
            material_name: input.materialName.trim(),
            vendor: emptyToNull(input.vendor),
            amount: input.amount,
            currency: input.currency || "원",
            spec: emptyToNull(input.spec),
            grade: emptyToNull(input.grade),
            note: emptyToNull(input.note),
            urgent: input.urgent,
        })
        .eq("id", input.lineId)
        .select("id")
        .maybeSingle();

    if (lineError || !line) {
        throw new Error(lineError?.message || "품목 수정에 실패했습니다.");
    }

    const { data: existingReceipts, error: existingError } = await supabase
        .from("material_purchase_receipts")
        .select("id, storage_path")
        .eq("line_id", input.lineId);
    if (existingError) {
        throw new Error(existingError.message || "영수증 정보를 불러오지 못했습니다.");
    }

    const keep = new Set(input.keptReceiptIds);
    const removed = (existingReceipts ?? []).filter((receipt) => !keep.has(receipt.id));
    if (removed.length > 0) {
        const paths = removed.map((receipt) => receipt.storage_path).filter(Boolean);
        if (paths.length > 0) {
            const { error: storageError } = await supabase.storage.from(RECEIPT_BUCKET).remove(paths);
            if (storageError) throw new Error(storageError.message || "영수증 파일 삭제에 실패했습니다.");
        }
        const { error: deleteError } = await supabase
            .from("material_purchase_receipts")
            .delete()
            .in(
                "id",
                removed.map((receipt) => receipt.id)
            );
        if (deleteError) throw new Error(deleteError.message || "영수증 삭제에 실패했습니다.");
    }

    await uploadReceiptFiles(user.id, input.purchaseId, input.lineId, input.newReceipts);
}
