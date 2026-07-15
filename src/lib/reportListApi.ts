import { supabase } from "./supabase";
import { formatInvoiceReportTableTitle } from "../utils/invoiceReportDisplayTitle";
import {
    OTHER_LINE_PREFIX,
    formatMultiLineBadgeFromNotes,
} from "../utils/otherLineWorkNote";

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
    /** 다른호선 작업 시 제목 우측 배지 (예: 복수호선(A호선)) */
    multiLineBadge?: string | null;
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

async function fetchMultiLineBadgesByWorkLogIds(
    workLogIds: number[]
): Promise<Map<number, string>> {
    const badgeById = new Map<number, string>();
    if (workLogIds.length === 0) return badgeById;

    const { data, error } = await supabase
        .from("work_log_entries")
        .select("work_log_id, note")
        .in("work_log_id", workLogIds)
        .ilike("note", `%${OTHER_LINE_PREFIX}%`);

    if (error) {
        console.error("다른호선 배지 조회 실패:", error);
        return badgeById;
    }

    const notesByWorkLogId = new Map<number, string[]>();
    for (const row of data ?? []) {
        const id = Number(row.work_log_id);
        if (!Number.isFinite(id)) continue;
        const list = notesByWorkLogId.get(id) ?? [];
        if (row.note) list.push(String(row.note));
        notesByWorkLogId.set(id, list);
    }

    for (const [id, notes] of notesByWorkLogId) {
        const badge = formatMultiLineBadgeFromNotes(notes);
        if (badge) badgeById.set(id, badge);
    }

    return badgeById;
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

    const items = rows.map(mapRpcRowToItem);
    const badgeById = await fetchMultiLineBadgesByWorkLogIds(
        items.map((item) => item.id)
    );

    return {
        items: items.map((item) => ({
            ...item,
            multiLineBadge: badgeById.get(item.id) ?? null,
        })),
        totalCount: Number.isFinite(totalCount) ? totalCount : 0,
    };
}
