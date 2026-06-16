import { supabase } from "./supabase";

export type InvoiceExcelFieldMappings = {
    /** cells 주소에 시트를 생략했을 때 사용 */
    defaultSheet?: string;
    /** 셀 주소(Sheet1!B2 또는 B2) → 메타 필드 키 */
    cells?: Record<string, string>;
    table?: {
        sheet?: string;
        /** 1-based */
        startRow: number;
        columns: Record<string, string>;
    };
};

export type InvoiceExcelTemplateRow = {
    id: string;
    name: string;
    slug: string;
    storage_path: string;
    field_mappings: InvoiceExcelFieldMappings;
    is_active: boolean;
    is_default: boolean;
};

const BUCKET = "invoice-excel-templates";

export async function fetchActiveInvoiceExcelTemplate(): Promise<InvoiceExcelTemplateRow | null> {
    const def = await supabase
        .from("invoice_excel_templates")
        .select("*")
        .eq("is_active", true)
        .eq("is_default", true)
        .maybeSingle();

    if (def.error) {
        console.error("invoice_excel_templates (default) 조회 실패:", def.error);
        throw def.error;
    }
    if (def.data) {
        return def.data as InvoiceExcelTemplateRow;
    }

    const anyActive = await supabase
        .from("invoice_excel_templates")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (anyActive.error) {
        console.error("invoice_excel_templates 조회 실패:", anyActive.error);
        throw anyActive.error;
    }
    return (anyActive.data as InvoiceExcelTemplateRow | null) ?? null;
}

export async function fetchActiveInvoiceExcelTemplateBySlug(
    slug: string
): Promise<InvoiceExcelTemplateRow | null> {
    const row = await supabase
        .from("invoice_excel_templates")
        .select("*")
        .eq("is_active", true)
        .eq("slug", slug)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (row.error) {
        console.error("invoice_excel_templates (slug) 조회 실패:", row.error);
        throw row.error;
    }

    return (row.data as InvoiceExcelTemplateRow | null) ?? null;
}

export async function downloadInvoiceExcelTemplateArrayBuffer(
    storagePath: string
): Promise<ArrayBuffer> {
    const { data: blob, error } = await supabase.storage
        .from(BUCKET)
        .download(storagePath);

    if (error) {
        console.error("인보이스 엑셀 템플릿 다운로드 실패:", error);
        throw error;
    }
    return await blob.arrayBuffer();
}
