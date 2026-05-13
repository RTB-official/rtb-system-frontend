import type { WorkLogFullData } from "./workLogApi";
import { supabase } from "./supabase";

export type InvoiceDraftStatus = "draft" | "final";

export type InvoiceDraftPayloadV1 = {
    version: 1;
    workLogDataList: WorkLogFullData[];
    timesheetRows: unknown[];
    selectedSkilledFitters: string[];
    selectedFitterRepresentatives: Record<string, string>;
    travelChargeOverrides: Record<
        string,
        {
            target: "home" | "lodging";
            updatedAt: number;
        }
    >;
    entryManualBillableHours: Record<number, number>;
    entryManualBillableSplitHours: Record<
        number,
        {
            weekdayNormal: number;
            weekdayAfter: number;
            weekendNormal: number;
            weekendAfter: number;
        }
    >;
    deletedTimesheetEntries: unknown[];
    selectedTimesheetDateGroupKeys: string[];
    /**
     * 타임시트 행 단위 Skilled Fitter 지정(행 키: `YYYY-MM-DD::entryId,entryId,...`).
     * 같은 날 다른 묶음 행에는 적용되지 않음.
     */
    invoiceSkilledFitterByTimesheetRowKey?: Record<string, string>;
    /**
     * 타임시트 묶음 행에서 Skilled를 끈 인원(해당 행에는 수동 지정 삭제 후에도 알고리즘으로 복구하지 않음).
     * 키는 `invoiceSkilledFitterByTimesheetRowKey`와 동일(`YYYY-MM-DD::entryId,...`).
     */
    invoiceSkilledFitterOptOutByTimesheetRowKey?: Record<string, string[]>;
    /** @deprecated 구버전 드래프트 — 로드 시 행 키로 마이그레이션 */
    entryInvoiceSkilledFitterByEntryId?: Record<number, string>;
    /**
     * 인보이스 섹션 Work Item 표시용. 생략·null = 선택 보고서 목적 중 한글 제외 길이가 가장 긴 subject 하나.
     */
    invoiceWorkItemOverride?: string | null;
};

export type InvoiceDraftPayload = InvoiceDraftPayloadV1;

export type InvoiceDraftRow = {
    id: string;
    created_by: string;
    title: string;
    work_log_ids: number[];
    payload: InvoiceDraftPayload;
    status: InvoiceDraftStatus;
    created_at: string;
    updated_at: string;
};

export type InvoiceDraftUpsertInput = {
    title: string;
    workLogIds: number[];
    payload: InvoiceDraftPayload;
    status?: InvoiceDraftStatus;
};

type InvoiceDraftDbRow = Omit<InvoiceDraftRow, "work_log_ids"> & {
    work_log_ids: number[] | null;
};

/** PostgREST 오류 등 `Error`를 상속하지 않는 객체 대응 */
function toThrownError(err: unknown, fallback: string): Error {
    if (err instanceof Error) {
        return err;
    }
    if (err && typeof err === "object" && "message" in err) {
        const msg = (err as { message?: unknown }).message;
        if (typeof msg === "string" && msg.trim()) {
            const details = (err as { details?: unknown }).details;
            const hint = (err as { hint?: unknown }).hint;
            const code = (err as { code?: unknown }).code;
            const extra = [code && `코드: ${String(code)}`, details && String(details), hint && String(hint)]
                .filter(Boolean)
                .join(" · ");
            return extra ? new Error(`${msg}${extra ? ` (${extra})` : ""}`) : new Error(msg);
        }
    }
    return new Error(fallback);
}

const normalizeDraftRow = (row: InvoiceDraftDbRow): InvoiceDraftRow => ({
    ...row,
    work_log_ids: Array.isArray(row.work_log_ids)
        ? row.work_log_ids
              .map((id) => Number(id))
              .filter((id) => Number.isFinite(id))
        : [],
});

const getCurrentUserId = async (): Promise<string> => {
    const {
        data: { user },
        error,
    } = await supabase.auth.getUser();
    if (error) {
        throw error;
    }
    if (!user?.id) {
        throw new Error("로그인이 필요합니다.");
    }
    return user.id;
};

export async function createInvoiceDraft(
    input: InvoiceDraftUpsertInput
): Promise<InvoiceDraftRow> {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
        .from("invoice_drafts")
        .insert({
            created_by: userId,
            title: input.title,
            work_log_ids: input.workLogIds,
            payload: input.payload,
            status: input.status ?? "draft",
        })
        .select("*")
        .single();
    if (error || !data) {
        throw toThrownError(error, "드래프트를 생성하지 못했습니다.");
    }
    return normalizeDraftRow(data as InvoiceDraftDbRow);
}

export async function updateInvoiceDraft(
    draftId: string,
    input: InvoiceDraftUpsertInput
): Promise<InvoiceDraftRow> {
    const { data, error } = await supabase
        .from("invoice_drafts")
        .update({
            title: input.title,
            work_log_ids: input.workLogIds,
            payload: input.payload,
            status: input.status ?? "draft",
            updated_at: new Date().toISOString(),
        })
        .eq("id", draftId)
        .select("*")
        .single();
    if (error || !data) {
        throw toThrownError(error, "드래프트를 저장하지 못했습니다.");
    }
    return normalizeDraftRow(data as InvoiceDraftDbRow);
}

export async function getInvoiceDraftById(
    draftId: string
): Promise<InvoiceDraftRow | null> {
    const { data, error } = await supabase
        .from("invoice_drafts")
        .select("*")
        .eq("id", draftId)
        .maybeSingle();
    if (error) {
        throw error;
    }
    if (!data) {
        return null;
    }
    return normalizeDraftRow(data as InvoiceDraftDbRow);
}

export async function listInvoiceDraftsByUser(): Promise<InvoiceDraftRow[]> {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
        .from("invoice_drafts")
        .select("*")
        .eq("created_by", userId)
        .order("updated_at", { ascending: false });
    if (error) {
        throw error;
    }
    return (data ?? []).map((row) => normalizeDraftRow(row as InvoiceDraftDbRow));
}

export async function deleteInvoiceDraft(draftId: string): Promise<void> {
    const { error } = await supabase
        .from("invoice_drafts")
        .delete()
        .eq("id", draftId);
    if (error) {
        throw error;
    }
}
