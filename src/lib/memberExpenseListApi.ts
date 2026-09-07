import { supabase } from "./supabase";
import { parseExpenseTotalsByCurrency } from "../utils/expenseCurrency";

export type MemberExpenseSummaryItem = {
    id: string;
    name: string;
    email: string | null;
    position: string | null;
    mileage: number;
    distance: number;
    cardExpensesByCurrency: Record<string, number>;
    count: number;
};

type MemberExpenseSummaryRpcRow = {
    user_id: string;
    name: string;
    email: string | null;
    user_position: string | null;
    mileage: number | string;
    distance: number | string;
    card_expenses_by_currency?: unknown;
    card_expense?: number | string;
    item_count: number | string;
};

function buildMonthDateRange(year: number, month: number) {
    const monthString = String(month).padStart(2, "0");
    const lastDay = new Date(year, month, 0).getDate();
    const lastDayString = String(lastDay).padStart(2, "0");
    return {
        startDate: `${year}-${monthString}-01`,
        endDate: `${year}-${monthString}-${lastDayString}`,
    };
}

function mergeCurrencyTotals(
    target: Record<string, number>,
    currency: string,
    amount: number
) {
    if (!Number.isFinite(amount) || amount <= 0) return;
    const normalizedCurrency = currency.trim() || "원";
    target[normalizedCurrency] = (target[normalizedCurrency] || 0) + amount;
}

/** RPC와 무관하게 personal_expenses에서 화폐 단위별 카드 지출 집계 */
async function fetchCardExpensesByUserAndCurrency(
    year: number,
    month: number
): Promise<Map<string, Record<string, number>>> {
    const { startDate, endDate } = buildMonthDateRange(year, month);
    const byUser = new Map<string, Record<string, number>>();

    const { data, error } = await supabase
        .from("personal_expenses")
        .select("user_id, amount, currency")
        .gte("expense_date", startDate)
        .lte("expense_date", endDate);

    if (error) {
        console.warn("카드 지출 화폐별 집계 조회 실패:", error.message);
        return byUser;
    }

    for (const row of data ?? []) {
        const userId = row.user_id as string | undefined;
        if (!userId) continue;

        const current = byUser.get(userId) ?? {};
        mergeCurrencyTotals(
            current,
            (row.currency as string | null) ?? "원",
            Number(row.amount ?? 0)
        );
        byUser.set(userId, current);
    }

    return byUser;
}

function mapRpcRow(
    row: MemberExpenseSummaryRpcRow,
    cardExpensesByUser: Map<string, Record<string, number>>
): MemberExpenseSummaryItem {
    const cardFromDb = cardExpensesByUser.get(row.user_id);
    const cardFromRpc = row.card_expenses_by_currency
        ? parseExpenseTotalsByCurrency(row.card_expenses_by_currency)
        : {};

    const cardExpensesByCurrency =
        cardFromDb && Object.keys(cardFromDb).length > 0
            ? cardFromDb
            : Object.keys(cardFromRpc).length > 0
              ? cardFromRpc
              : row.card_expense !== undefined
                ? { 원: Number(row.card_expense ?? 0) }
                : {};

    return {
        id: row.user_id,
        name: row.name,
        email: row.email ?? null,
        position: row.user_position ?? null,
        mileage: Number(row.mileage ?? 0),
        distance: Number(row.distance ?? 0),
        cardExpensesByCurrency,
        count: Number(row.item_count ?? 0),
    };
}

/** 년·월(1~12) 기준 직원별 지출 집계 전체 */
export async function fetchMemberExpenseSummary(params: {
    year: number;
    month: number;
}): Promise<MemberExpenseSummaryItem[]> {
    const [rpcResult, cardExpensesByUser] = await Promise.all([
        supabase.rpc("get_member_expense_summary", {
            p_year: params.year,
            p_month: params.month,
        }),
        fetchCardExpensesByUserAndCurrency(params.year, params.month),
    ]);

    const { data, error } = rpcResult;

    if (error) {
        throw new Error(`구성원 지출 집계 조회 실패: ${error.message}`);
    }

    return ((data ?? []) as MemberExpenseSummaryRpcRow[]).map((row) =>
        mapRpcRow(row, cardExpensesByUser)
    );
}
