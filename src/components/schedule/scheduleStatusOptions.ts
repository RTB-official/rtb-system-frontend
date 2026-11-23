import type { ScheduleFieldKey } from "./scheduleTableShared";

export type ScheduleStatusTone = "green" | "orange" | "gray" | "blue" | "red";

export type ScheduleStatusOption = {
    value: string;
    label: string;
    tone: ScheduleStatusTone;
    icon: "check" | "clock" | "minus" | "box" | "alert";
};

/** 출입·자재 모두 불필요할 때 */
export const SCHEDULE_STATUS_NOT_NEEDED = "해당없음";

export const ENTRY_APPLICATION_OPTIONS: ScheduleStatusOption[] = [
    {
        value: "승인완료",
        label: "승인완료",
        tone: "green",
        icon: "check",
    },
    {
        value: "승인대기중",
        label: "승인대기중",
        tone: "orange",
        icon: "clock",
    },
    {
        value: "출입신청 필요",
        label: "출입신청 필요",
        tone: "red",
        icon: "alert",
    },
    {
        value: SCHEDULE_STATUS_NOT_NEEDED,
        label: "해당없음",
        tone: "gray",
        icon: "minus",
    },
];

export const MATERIAL_PREP_OPTIONS: ScheduleStatusOption[] = [
    {
        value: "자재준비 완료",
        label: "자재준비 완료",
        tone: "blue",
        icon: "box",
    },
    {
        value: "자재준비 필요",
        label: "자재준비 필요",
        tone: "red",
        icon: "alert",
    },
    {
        value: SCHEDULE_STATUS_NOT_NEEDED,
        label: "해당없음",
        tone: "gray",
        icon: "minus",
    },
];

export const SCHEDULE_STATUS_FIELDS = [
    "entryApplication",
    "materialPrep",
] as const satisfies readonly ScheduleFieldKey[];

export type ScheduleStatusField = (typeof SCHEDULE_STATUS_FIELDS)[number];

export function isScheduleStatusField(
    field: string
): field is ScheduleStatusField {
    return (SCHEDULE_STATUS_FIELDS as readonly string[]).includes(field);
}

export function getScheduleStatusOptions(
    field: ScheduleStatusField
): ScheduleStatusOption[] {
    return field === "entryApplication"
        ? ENTRY_APPLICATION_OPTIONS
        : MATERIAL_PREP_OPTIONS;
}

export function resolveScheduleStatusOption(
    field: ScheduleStatusField,
    value: string
): ScheduleStatusOption | null {
    const { status } = parseScheduleStatusCellValue(field, value);
    if (!status) return null;
    const options = getScheduleStatusOptions(field);
    return options.find((option) => option.value === status) ?? null;
}

/** 상태값과 상세 메모를 한 컬럼 문자열에 함께 저장할 때 쓰는 구분선 */
export const SCHEDULE_STATUS_DETAIL_SEP = "\n---\n";

export type ScheduleStatusCellValue = {
    /** 빈 문자열이면 미선택 */
    status: string;
    detail: string;
};

/** 저장된 셀 문자열 → 상태 + 상세 */
export function parseScheduleStatusCellValue(
    field: ScheduleStatusField,
    raw: string
): ScheduleStatusCellValue {
    const text = raw ?? "";
    const options = getScheduleStatusOptions(field);
    const sep = SCHEDULE_STATUS_DETAIL_SEP;
    const sepIdx = text.indexOf(sep);

    if (sepIdx >= 0) {
        const statusPart = text.slice(0, sepIdx);
        const detail = text.slice(sepIdx + sep.length);
        const matched = options.find((option) => option.value === statusPart);
        return {
            status: matched ? matched.value : "",
            detail,
        };
    }

    const normalized = text.trim();
    const exact = options.find((option) => option.value === normalized);
    if (exact) {
        return { status: exact.value, detail: "" };
    }
    if (!normalized) {
        return { status: "", detail: "" };
    }
    // 예전 자유 텍스트는 상세로 보존 (상태는 미선택)
    return { status: "", detail: text };
}

/** 상태 + 상세 → 저장 문자열 (둘 다 없으면 빈 문자열) */
export function formatScheduleStatusCellValue(
    status: string,
    detail: string
): string {
    const trimmedDetail = detail.replace(/\s+$/u, "");
    if (!trimmedDetail.trim()) return status;
    return `${status}${SCHEDULE_STATUS_DETAIL_SEP}${trimmedDetail}`;
}

export const SCHEDULE_STATUS_HEADER_BG = "#1B3A5F";
