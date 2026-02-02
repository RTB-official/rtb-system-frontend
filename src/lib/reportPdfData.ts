// src/lib/reportPdfData.ts
import { supabase } from "./supabase";

export type PdfWorkLog = Record<string, any>;

export type PdfEntry = {
    id: number;
    date_from?: string | null;
    time_from?: string | null;
    date_to?: string | null;
    time_to?: string | null;
    desc_type?: string | null;
    details?: string | null;
    note?: string | null;
};

export type PdfMaterial = {
    material_name: string | null;
    qty: string | null;
    unit: string | null;
};

export type PdfExpense = {
    expense_date: string | null;
    expense_type: string | null;
    detail: string | null;
    amount: number | null;
};

export type PdfReceipt = {
    id?: number;
    file_name?: string | null;
    file_url?: string | null;
    mime_type?: string | null;
    path?: string | null;
    storage_path?: string | null;
    category?: string | null;
};

export async function getReportPdfData(workLogId: number) {
    // ✅ work_logs: 컬럼명 불일치 방지 위해 * 로 조회
    const { data: log, error: logError } = await supabase
        .from("work_logs")
        .select("*")
        .eq("id", workLogId)
        .single();

    if (logError || !log) {
        console.error("work_logs 조회 에러:", logError);
        throw new Error(
            `work_logs 조회 실패: ${logError?.message ?? "데이터 없음/권한 문제"}`
        );
    }

    // ✅ 보고서 인원
    const { data: personsRows, error: personsError } = await supabase
        .from("work_log_persons")
        .select("person_name, id")
        .eq("work_log_id", workLogId)
        .order("id", { ascending: true });

    if (personsError) {
        console.error("work_log_persons 조회 에러:", personsError);
    }

    const persons = (personsRows ?? [])
        .map((r: any) => String(r.person_name ?? "").trim())
        .filter(Boolean);

    // ✅ entries
    const { data: entriesRows, error: entriesError } = await supabase
        .from("work_log_entries")
        .select("id, date_from, time_from, date_to, time_to, desc_type, details, note")
        .eq("work_log_id", workLogId)
        .order("id", { ascending: true });

    if (entriesError) {
        console.error("work_log_entries 조회 에러:", entriesError);
    }

    const entries = (entriesRows ?? []) as PdfEntry[];
    const entryIds = entries.map((e) => e.id).filter(Boolean);

    // ✅ entry persons map
    const entryPersonsMap: Record<number, string[]> = {};
    if (entryIds.length) {
        const { data: epRows, error: epError } = await supabase
            .from("work_log_entry_persons")
            .select("entry_id, person_name, id")
            .in("entry_id", entryIds)
            .order("id", { ascending: true });

        if (epError) {
            console.error("work_log_entry_persons 조회 에러:", epError);
        }

        (epRows ?? []).forEach((r: any) => {
            const eid = Number(r.entry_id);
            const name = String(r.person_name ?? "").trim();
            if (!eid || !name) return;
            if (!entryPersonsMap[eid]) entryPersonsMap[eid] = [];
            entryPersonsMap[eid].push(name);
        });
    }

    // ✅ materials
    const { data: materialsRows, error: materialsError } = await supabase
        .from("work_log_materials")
        .select("material_name, qty, unit, id")
        .eq("work_log_id", workLogId)
        .order("id", { ascending: true });

    if (materialsError) {
        console.error("work_log_materials 조회 에러:", materialsError);
    }

    const materials = (materialsRows ?? []).map((r: any) => ({
        material_name: r.material_name ?? null,
        qty: r.qty !== null && r.qty !== undefined ? String(r.qty) : null,
        unit: r.unit ?? null,
    })) as PdfMaterial[];

    // ✅ expenses
    const { data: expensesRows, error: expensesError } = await supabase
        .from("work_log_expenses")
        .select("expense_date, expense_type, detail, amount, id")
        .eq("work_log_id", workLogId)
        .order("id", { ascending: true });

    if (expensesError) {
        console.error("work_log_expenses 조회 에러:", expensesError);
    }

    const expenses = (expensesRows ?? []).map((r: any) => ({
        expense_date: r.expense_date ?? null,
        expense_type: r.expense_type ?? null,
        detail: r.detail ?? null,
        amount: typeof r.amount === "number" ? r.amount : Number(r.amount ?? 0),
    })) as PdfExpense[];

    // ✅ receipts
    // (테이블 컬럼명이 다를 수 있어 "가능한 필드" 위주로 받음)
    const { data: receiptsRows, error: receiptsError } = await supabase
        .from("work_log_receipt")
        .select("*")
        .eq("work_log_id", workLogId)
        .order("id", { ascending: true });

    if (receiptsError) {
        console.error("work_log_receipts 조회 에러:", receiptsError);
    }

    // Storage에서 URL 생성 (signed URL 우선, 실패 시 public URL)
    const receipts = await Promise.all(
        (receiptsRows ?? []).map(async (r: any) => {
            let fileUrl: string | null = null;
            const storagePath = r.storage_path ?? r.path;
            
            // storage_path가 없으면 URL 생성 불가
            if (!storagePath) {
                console.warn("Receipt has no storage_path:", r);
                return {
                    id: r.id ?? undefined,
                    file_name: r.original_name ?? r.file_name ?? r.name ?? null,
                    file_url: null,
                    mime_type: r.mime_type ?? r.type ?? null,
                    path: storagePath,
                    storage_path: storagePath,
                    category: r.category ?? null,
                } as PdfReceipt;
            }

            try {
                const bucketName = r.storage_bucket || "work-log-recipts";
                
                // signed URL 우선 시도 (private bucket의 경우)
                const { data: signedUrlData, error: signedUrlError } = await supabase.storage
                    .from(bucketName)
                    .createSignedUrl(storagePath, 60 * 60 * 24 * 365); // 1년 유효
                
                if (signedUrlError) {
                    console.error("Error creating signed URL:", signedUrlError);
                    // signed URL 실패 시 public URL 시도
                    const { data: urlData } = await supabase.storage
                        .from(bucketName)
                        .getPublicUrl(storagePath);
                    fileUrl = urlData?.publicUrl || null;
                } else {
                    fileUrl = signedUrlData?.signedUrl || null;
                }
            } catch (err) {
                console.error("Error getting receipt URL:", err);
            }

            return {
                id: r.id ?? undefined,
                file_name: r.original_name ?? r.file_name ?? r.name ?? null,
                file_url: fileUrl,
                mime_type: r.mime_type ?? r.type ?? null,
                path: storagePath,
                storage_path: storagePath,
                category: r.category ?? null,
            } as PdfReceipt;
        })
    );

    return {
        log: log as PdfWorkLog,
        persons,
        entries,
        entryPersonsMap,
        materials,
        expenses,
        receipts,
    };
}
