import { supabase } from "./supabase";

export type MemberExpenseSummaryItem = {
    id: string;
    name: string;
    email: string | null;
    position: string | null;
    mileage: number;
    distance: number;
    cardExpense: number;
    total: number;
    count: number;
};

type MemberExpenseSummaryRpcRow = {
    user_id: string;
    name: string;
    email: string | null;
    user_position: string | null;
    mileage: number | string;
    distance: number | string;
    card_expense: number | string;
    total: number | string;
    item_count: number | string;
};

function mapRpcRow(row: MemberExpenseSummaryRpcRow): MemberExpenseSummaryItem {
    return {
        id: row.user_id,
        name: row.name,
        email: row.email ?? null,
        position: row.user_position ?? null,
        mileage: Number(row.mileage ?? 0),
        distance: Number(row.distance ?? 0),
        cardExpense: Number(row.card_expense ?? 0),
        total: Number(row.total ?? 0),
        count: Number(row.item_count ?? 0),
    };
}

/** 년·월(1~12) 기준 직원별 지출 집계 전체 */
export async function fetchMemberExpenseSummary(params: {
    year: number;
    month: number;
}): Promise<MemberExpenseSummaryItem[]> {
    const { data, error } = await supabase.rpc("get_member_expense_summary", {
        p_year: params.year,
        p_month: params.month,
    });

    if (error) {
        throw new Error(`구성원 지출 집계 조회 실패: ${error.message}`);
    }

    return ((data ?? []) as MemberExpenseSummaryRpcRow[]).map(mapRpcRow);
}
