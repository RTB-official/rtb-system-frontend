import { supabase } from "./supabase";
import { formatInvoiceReportTableTitle } from "../utils/invoiceReportDisplayTitle";

export type ReportListTab = "work" | "education";

export type ReportListStatus = "submitted" | "pending" | "not_submitted";

export type ReportListItem = {
    id: number;
    title: string;
    place: string;
    supervisor: string;
    owner: string;
    ownerEmail: string | null;
    ownerPosition: string | null;
    ownerId: string | null;
    date: string;
    createdAt: string;
    periodStart?: string;
    periodEnd?: string;
    status: ReportListStatus;
    memo: string | null;
    memoUpdatedAt: string | null;
    memoReadAt: string | null;
};

export type ReportListQuery = {
    page: number;
    pageSize: number;
    search?: string;
    year?: number | null;
    month?: number | null;
    /** 미지정 시 출장·교육 모두 포함 */
    tab?: ReportListTab;
};

export type ReportListResult = {
    items: ReportListItem[];
    totalCount: number;
};

type ReportListRpcRow = {
    id: number;
    author: string | null;
    vessel: string | null;
    subject: string | null;
    location: string | null;
    order_person: string | null;
    is_draft: boolean | null;
    created_by: string | null;
    created_at: string;
    owner_email: string | null;
    owner_position: string | null;
    period_start: string | null;
    period_end: string | null;
    memo: string | null;
    memo_updated_at: string | null;
    memo_read_at: string | null;
    total_count: number | string | null;
};

function formatListDate(dateString: string) {
    const date = new Date(dateString);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${y}.${m}.${day}.`;
}

function mapRpcRowToItem(row: ReportListRpcRow): ReportListItem {
    const createdAt = row.created_at ?? "";
    const periodStart = row.period_start ?? undefined;
    const periodEnd = row.period_end ?? undefined;

    return {
        id: Number(row.id),
        title: formatInvoiceReportTableTitle({
            periodStart,
            periodEnd,
            vessel: row.vessel,
            subject: row.subject,
            createdAt,
        }),
        place: row.location?.trim() || "",
        supervisor: row.order_person?.trim() || "",
        owner: row.author?.trim() || "(작성자 없음)",
        ownerEmail: row.owner_email ?? null,
        ownerPosition: row.owner_position ?? null,
        ownerId: row.created_by ?? null,
        date: createdAt ? formatListDate(createdAt) : "",
        createdAt,
        periodStart,
        periodEnd,
        status: row.is_draft ? "pending" : "submitted",
        memo: row.memo?.trim() ? row.memo : null,
        memoUpdatedAt: row.memo_updated_at ?? null,
        memoReadAt: row.memo_read_at ?? null,
    };
}

export function parseReportListYear(value: string): number | null {
    if (!value || value === "년도 전체") return null;
    const parsed = Number.parseInt(value.replace("년", ""), 10);
    return Number.isNaN(parsed) ? null : parsed;
}

export function parseReportListMonth(value: string): number | null {
    if (!value || value === "월 전체") return null;
    const parsed = Number.parseInt(value.replace("월", ""), 10);
    return Number.isNaN(parsed) ? null : parsed;
}

export async function fetchReportList(
    query: ReportListQuery
): Promise<ReportListResult> {
    const { data, error } = await supabase.rpc("get_report_list_paging", {
        p_page: query.page,
        p_page_size: query.pageSize,
        p_search: query.search?.trim() || null,
        p_year: query.year ?? null,
        p_month: query.month ?? null,
        p_tab: query.tab ?? null,
    });

    if (error) {
        throw new Error(`보고서 목록 조회 실패: ${error.message}`);
    }

    const rows = (data ?? []) as ReportListRpcRow[];
    const totalCount = rows.length
        ? Number(rows[0].total_count ?? 0)
        : 0;

    return {
        items: rows.map(mapRpcRowToItem),
        totalCount: Number.isFinite(totalCount) ? totalCount : 0,
    };
}

/** 메모 읽음/미읽음 표시 */
export async function setReportMemoReadState(
    reportId: number,
    read: boolean
): Promise<void> {
    const { error } = await supabase
        .from("work_logs")
        .update({
            memo_read_at: read ? new Date().toISOString() : null,
        })
        .eq("id", reportId);

    if (error) {
        throw new Error(`메모 읽음 상태 변경 실패: ${error.message}`);
    }
}
