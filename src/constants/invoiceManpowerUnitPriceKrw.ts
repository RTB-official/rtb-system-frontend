/** 인보이스 MANPOWER 구간별 단가 (KRW) */
export const INVOICE_MANPOWER_UNIT_PRICE_KRW = {
    skilled: {
        weekdayNormal: 55_200,
        weekdayAfter: 79_400,
        weekendNormal: 70_200,
        weekendAfter: 90_900,
        travelWeekday: 39_100,
        travelWeekend: 44_965,
    },
    fitter: {
        weekdayNormal: 42_600,
        weekdayAfter: 62_100,
        weekendNormal: 52_900,
        weekendAfter: 71_300,
        travelWeekday: 31_100,
        travelWeekend: 35_765,
    },
} as const;
