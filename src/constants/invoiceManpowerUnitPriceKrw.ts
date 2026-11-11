/** 인보이스 MANPOWER 환율 (사진 요율표: 1 EUR = KRW 1,620) */
export const INVOICE_EUR_TO_KRW = 1_620;

/** 인보이스 MANPOWER 구간별 단가 (EUR) — Skilled Fitter / Fitter */
export const INVOICE_MANPOWER_UNIT_PRICE_EUR = {
    skilled: {
        weekdayNormal: 34,
        weekdayAfter: 49,
        weekendNormal: 43,
        weekendAfter: 56,
        travelWeekday: 24,
        travelWeekend: 28,
    },
    fitter: {
        weekdayNormal: 26,
        weekdayAfter: 38,
        weekendNormal: 33,
        weekendAfter: 44,
        travelWeekday: 19,
        travelWeekend: 22,
    },
} as const;

type ManpowerRoleUnitPrices =
    (typeof INVOICE_MANPOWER_UNIT_PRICE_EUR)["skilled"];

const toKrwUnitPrices = (eur: ManpowerRoleUnitPrices) =>
    ({
        weekdayNormal: eur.weekdayNormal * INVOICE_EUR_TO_KRW,
        weekdayAfter: eur.weekdayAfter * INVOICE_EUR_TO_KRW,
        weekendNormal: eur.weekendNormal * INVOICE_EUR_TO_KRW,
        weekendAfter: eur.weekendAfter * INVOICE_EUR_TO_KRW,
        travelWeekday: eur.travelWeekday * INVOICE_EUR_TO_KRW,
        travelWeekend: eur.travelWeekend * INVOICE_EUR_TO_KRW,
    }) as const;

/**
 * 사이드패널 등 KRW 표시용 환산 단가 (EUR × 환율).
 * 인보이스 섹션·엑셀 단가는 `INVOICE_MANPOWER_UNIT_PRICE_EUR` 사용.
 */
export const INVOICE_MANPOWER_UNIT_PRICE_KRW = {
    skilled: toKrwUnitPrices(INVOICE_MANPOWER_UNIT_PRICE_EUR.skilled),
    fitter: toKrwUnitPrices(INVOICE_MANPOWER_UNIT_PRICE_EUR.fitter),
} as const;
