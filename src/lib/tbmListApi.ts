import { supabase } from "./supabase";

export type TbmListItem = {
    id: string;
    tbm_date: string | null;
    line_name: string | null;
    work_name: string | null;
    location: string | null;
    created_by: string;
    created_by_name: string | null;
    created_at: string;
    participant_total: number;
    participant_signed: number;
    current_user_signed_at: string | null;
    current_user_is_participant: boolean;
};

export type TbmListQuery = {
    page: number;
    pageSize: number;
    search?: string;
    year?: number | null;
    month?: number | null;
    inProgressOnly?: boolean;
};

export type TbmListResult = {
    items: TbmListItem[];
    totalCount: number;
};

type TbmListRpcRow = {
    id: string;
    tbm_date: string | null;
    line_name: string | null;
    work_name: string | null;
    location: string | null;
    created_by: string;
    created_by_name: string | null;
    created_at: string;
    participant_total: number | string;
    participant_signed: number | string;
    current_user_signed_at: string | null;
    current_user_is_participant: boolean | null;
    total_count: number | string | null;
};

export function parseTbmListYear(value: string): number | null {
    if (!value || value === "년도 전체") return null;
    const parsed = Number.parseInt(value.replace("년", ""), 10);
    return Number.isNaN(parsed) ? null : parsed;
}

export function parseTbmListMonth(value: string): number | null {
    if (!value || value === "월 전체") return null;
    const parsed = Number.parseInt(value.replace("월", ""), 10);
    return Number.isNaN(parsed) ? null : parsed;
}

function mapRpcRowToItem(row: TbmListRpcRow): TbmListItem {
    return {
        id: row.id,
        tbm_date: row.tbm_date ?? null,
        line_name: row.line_name ?? null,
        work_name: row.work_name ?? null,
        location: row.location ?? null,
        created_by: row.created_by,
        created_by_name: row.created_by_name ?? null,
        created_at: row.created_at,
        participant_total: Number(row.participant_total ?? 0),
        participant_signed: Number(row.participant_signed ?? 0),
        current_user_signed_at: row.current_user_signed_at ?? null,
        current_user_is_participant: Boolean(row.current_user_is_participant),
    };
}

export async function fetchTbmList(query: TbmListQuery): Promise<TbmListResult> {
    const { data, error } = await supabase.rpc("get_tbm_list_paging", {
        p_page: query.page,
        p_page_size: query.pageSize,
        p_search: query.search?.trim() || null,
        p_year: query.year ?? null,
        p_month: query.month ?? null,
        p_in_progress_only: query.inProgressOnly ?? false,
    });

    if (error) {
        throw new Error(`TBM 목록 조회 실패: ${error.message}`);
    }

    const rows = (data ?? []) as TbmListRpcRow[];
    const totalCount = rows.length ? Number(rows[0].total_count ?? 0) : 0;

    return {
        items: rows.map(mapRpcRowToItem),
        totalCount: Number.isFinite(totalCount) ? totalCount : 0,
    };
}

export function isUserInvolvedInTbm(
    row: TbmListItem,
    currentUserId: string | null
): boolean {
    if (!currentUserId) return false;
    if (row.created_by === currentUserId) return true;
    return row.current_user_is_participant;
}

export function getTbmListStatusChip(
    row: TbmListItem,
    currentUserId: string | null,
    isAdmin: boolean,
    isStaff: boolean
): { label: string; color: string } | null {
    if (isStaff && !isAdmin && !isUserInvolvedInTbm(row, currentUserId)) {
        return null;
    }

    const allSigned =
        row.participant_total > 0 &&
        row.participant_total === row.participant_signed;

    const useAuthorStyle =
        (currentUserId && row.created_by === currentUserId) || isAdmin;

    if (useAuthorStyle) {
        return allSigned
            ? { label: "완료", color: "blue-500" }
            : { label: "진행중", color: "gray-400" };
    }

    const userSigned = Boolean(row.current_user_signed_at);
    return userSigned
        ? { label: "서명 완료", color: "green-500" }
        : { label: "진행중", color: "gray-400" };
}
