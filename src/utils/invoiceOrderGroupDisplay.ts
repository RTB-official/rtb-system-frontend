/** 출장보고서 `order_group`(발주처) → 인보이스 양식 표시 */

export interface InvoiceRecipientInfo {
    companyName: string;
    addressLines: string[];
}

const EVERLLENCE_DENMARK_LINES = [
    "2-Stroke Business, Operation / Engineering",
    "Teglholmsgade 41",
    "2450 Copenhagen SV, Denmark",
] as const;

/** Work order from / Work Order From */
const WORK_ORDER_FROM_BY_GROUP: Record<string, string> = {
    ELU: "Everllence ELU KOREA",
    PRIME: "Everllence Prime KOREA",
    MITSUI: "Mitsui",
    OTHER: "",
};

/** Invoice to (청구 대상) */
const INVOICE_RECIPIENT_BY_GROUP: Record<string, InvoiceRecipientInfo> = {
    ELU: {
        companyName: "Everllence",
        addressLines: [...EVERLLENCE_DENMARK_LINES],
    },
    PRIME: {
        companyName: "Everllence",
        addressLines: [...EVERLLENCE_DENMARK_LINES],
    },
    MITSUI: {
        companyName: "Mitsui",
        addressLines: [],
    },
    OTHER: {
        companyName: "",
        addressLines: [],
    },
};

const DEFAULT_ORDER_GROUP = "ELU";

function normalizeOrderGroupKey(orderGroup: string | null | undefined): string {
    const key = (orderGroup ?? "").trim().toUpperCase();
    return key || DEFAULT_ORDER_GROUP;
}

/** 선택된 보고서 목록에서 대표 발주처 코드 (첫 보고서 기준, 없으면 ELU) */
export function resolvePrimaryWorkLogOrderGroup(
    workLogs: ReadonlyArray<{ order_group?: string | null }>
): string {
    for (const wl of workLogs) {
        const g = (wl.order_group ?? "").trim();
        if (g) return g;
    }
    return DEFAULT_ORDER_GROUP;
}

export function resolveInvoiceWorkOrderFromDisplay(
    orderGroup: string | null | undefined
): string {
    const key = normalizeOrderGroupKey(orderGroup);
    return WORK_ORDER_FROM_BY_GROUP[key] ?? WORK_ORDER_FROM_BY_GROUP[DEFAULT_ORDER_GROUP];
}

export function resolveInvoiceRecipientInfo(
    orderGroup: string | null | undefined
): InvoiceRecipientInfo {
    const key = normalizeOrderGroupKey(orderGroup);
    return (
        INVOICE_RECIPIENT_BY_GROUP[key] ??
        INVOICE_RECIPIENT_BY_GROUP[DEFAULT_ORDER_GROUP]
    );
}
