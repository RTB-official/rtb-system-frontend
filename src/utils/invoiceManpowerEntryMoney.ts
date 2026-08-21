import { INVOICE_MANPOWER_UNIT_PRICE_KRW } from "../constants/invoiceManpowerUnitPriceKrw";
import {
    roundHours,
    type WorkEntryBillableFourBuckets,
} from "./workEntryBillableHours";

const round1 = (value: number) => Math.round(value * 10) / 10;

/** 인보이스 MANPOWER 행과 동일: 시간(0.1h)·단가 적용 후 KRW 정수 반올림 */
export function invoiceManpowerLineTotalKrw(
    hours: number,
    unitKrw: number
): number {
    return Math.round(round1(hours) * unitKrw);
}

export function formatInvoiceManpowerKrw(value: number): string {
    return `${Math.round(value).toLocaleString("ko-KR")}원`;
}

/** `getInvoiceManpowerSummaries` 첫 행과 동일: 1 Skilled 슬롯 + 나머지 Fitter */
export function getManpowerTierCountsForEntry(personCount: number): {
    skilled: number;
    fitter: number;
} {
    if (personCount <= 0) {
        return { skilled: 0, fitter: 0 };
    }
    return { skilled: 1, fitter: Math.max(0, personCount - 1) };
}

export type ManpowerMoneyDetailRow = {
    labelKo: string;
    hours: number;
    unitSkilledKrw: number;
    unitFitterKrw: number;
    skilledKrw: number;
    fitterKrw: number;
};

export function buildManpowerMoneyDetailRows(
    buckets: WorkEntryBillableFourBuckets,
    tier: { skilled: number; fitter: number }
): ManpowerMoneyDetailRow[] {
    const s = INVOICE_MANPOWER_UNIT_PRICE_KRW.skilled;
    const f = INVOICE_MANPOWER_UNIT_PRICE_KRW.fitter;
    const rows: ManpowerMoneyDetailRow[] = [];

    const push = (
        labelKo: string,
        h: number,
        unitSkilled: number,
        unitFitter: number
    ) => {
        if (round1(h) <= 0) {
            return;
        }
        rows.push({
            labelKo,
            hours: round1(h),
            unitSkilledKrw: unitSkilled,
            unitFitterKrw: unitFitter,
            skilledKrw: invoiceManpowerLineTotalKrw(h, unitSkilled) * tier.skilled,
            fitterKrw: invoiceManpowerLineTotalKrw(h, unitFitter) * tier.fitter,
        });
    };

    push("평일 N", buckets.weekdayN, s.weekdayNormal, f.weekdayNormal);
    push("평일 A", buckets.weekdayA, s.weekdayAfter, f.weekdayAfter);
    push(
        "주말·휴일 N",
        buckets.weekendN,
        s.weekendNormal,
        f.weekendNormal
    );
    push(
        "주말·휴일 A",
        buckets.weekendA,
        s.weekendAfter,
        f.weekendAfter
    );

    return rows;
}

export function sumManpowerSkilledFitterFromRows(rows: ManpowerMoneyDetailRow[]): {
    skilled: number;
    fitter: number;
    total: number;
} {
    let skilled = 0;
    let fitter = 0;
    for (const r of rows) {
        skilled += r.skilledKrw;
        fitter += r.fitterKrw;
    }
    return { skilled, fitter, total: skilled + fitter };
}

/**
 * 올림 청구(4h/8h)는 실제 작업일과 관계없이 평일 Normal로 반영한다.
 */
export function buildAfterRoundedBillableFourBuckets(
    roundedHours: number
): WorkEntryBillableFourBuckets {
    return {
        weekdayN: roundHours(roundedHours),
        weekdayA: 0,
        weekendN: 0,
        weekendA: 0,
    };
}
