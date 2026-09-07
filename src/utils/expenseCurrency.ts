export const EXPENSE_CURRENCY_ORDER = ["원", "엔", "달러", "유로", "위안"] as const;

export const formatCurrency = (num: number): string => {
  if (!Number.isFinite(num)) return "0";
  return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
};

export function parseExpenseTotalsByCurrency(
  raw: unknown
): Record<string, number> {
  if (!raw || typeof raw !== "object") return {};
  const totals: Record<string, number> = {};
  for (const [currency, amount] of Object.entries(raw as Record<string, unknown>)) {
    const numericAmount = Number(amount);
    if (Number.isFinite(numericAmount) && numericAmount > 0) {
      totals[currency] = numericAmount;
    }
  }
  return totals;
}

export function getOrderedCurrencyEntries(
  totals: Record<string, number>
): Array<[string, number]> {
  const seen = new Set<string>();
  const entries: Array<[string, number]> = [];

  for (const currency of EXPENSE_CURRENCY_ORDER) {
    const amount = totals[currency];
    if (amount > 0) {
      entries.push([currency, amount]);
      seen.add(currency);
    }
  }

  for (const [currency, amount] of Object.entries(totals)) {
    if (!seen.has(currency) && amount > 0) {
      entries.push([currency, amount]);
    }
  }

  return entries;
}

export function formatExpenseTotalsByCurrency(
  totals?: Record<string, number> | null,
  separator = " / "
): string {
  const parts = getOrderedCurrencyEntries(totals ?? {}).map(
    ([currency, amount]) => `${formatCurrency(amount)}${currency}`
  );

  return parts.length > 0 ? parts.join(separator) : "0원";
}

export function formatMemberExpenseSummaryTotal(
  mileage: number,
  cardExpensesByCurrency?: Record<string, number> | null
): string {
  const parts: string[] = [];

  if (mileage > 0) {
    parts.push(`${formatCurrency(mileage)}원`);
  }

  for (const [currency, amount] of getOrderedCurrencyEntries(
    cardExpensesByCurrency ?? {}
  )) {
    parts.push(`${formatCurrency(amount)}${currency}`);
  }

  return parts.length > 0 ? parts.join(" / ") : "0원";
}
