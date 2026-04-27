import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import BaseModal from "../ui/BaseModal";

export type TimesheetEntryEditorEntry = {
    id: number;
    workLogId: number;
    dateFrom: string;
    timeFrom: string;
    dateTo: string;
    timeTo: string;
    descType: string;
    details: string;
    persons: string[];
    note?: string;
    moveFrom?: string;
    moveTo?: string;
    location?: string | null;
    lunchWorked?: boolean;
    clientDuplicated?: boolean;
};

export type TimesheetEntryUpdatePayload = {
    entryId: number;
    descType: string;
    dateFrom: string;
    dateTo: string;
    timeFrom: string;
    timeTo: string;
    persons: string[];
    manualBillableHours: number | null;
    manualBillableSplitHours?: ManualBillableSplitHours | null;
};

export type ManualBillableSplitHours = {
    weekdayNormal: number;
    weekdayAfter: number;
    weekendNormal: number;
    weekendAfter: number;
};

function parseInstantMs(dateStr: string, timeStr: string): number | null {
    if (!dateStr || !timeStr) {
        return null;
    }
    const ms = new Date(`${dateStr}T${timeStr}`).getTime();
    return Number.isFinite(ms) ? ms : null;
}

function getEntryIntervalMs(
    entry: Pick<TimesheetEntryEditorEntry, "dateFrom" | "dateTo" | "timeFrom" | "timeTo">
): { start: number; end: number } | null {
    const start = parseInstantMs(entry.dateFrom, entry.timeFrom);
    if (start === null) {
        return null;
    }
    let end: number;
    if (entry.timeTo === "24:00") {
        end = new Date(
            new Date(`${entry.dateTo}T00:00:00`).getTime() + 24 * 60 * 60 * 1000
        ).getTime();
    } else {
        const e = parseInstantMs(entry.dateTo, entry.timeTo);
        if (e === null) {
            return null;
        }
        end = e;
    }
    if (end <= start) {
        return null;
    }
    return { start, end };
}

function intervalsOverlap(
    a: { start: number; end: number },
    b: { start: number; end: number }
): boolean {
    return a.start < b.end && b.start < a.end;
}

function normalizeHHMM(raw: string): string | null {
    const t = raw.trim();
    if (t === "24:00") {
        return "24:00";
    }
    const m = t.match(/^(\d{1,2}):(\d{2})$/);
    if (!m) {
        return null;
    }
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (h < 0 || h > 23 || min < 0 || min > 59) {
        return null;
    }
    return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

const HOUR_MS = 60 * 60 * 1000;

function ymdLocal(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function startOfLocalDayMs(y: number, monthIndex: number, day: number): number {
    return new Date(y, monthIndex, day, 0, 0, 0, 0).getTime();
}

/** To: 자정이면 전날 24:00 표기로 되돌린다(타임시트 동일 규칙). */
function formatMsAsToDateTime(ms: number): { date: string; time: string } {
    const d = new Date(ms);
    const y = d.getFullYear();
    const m = d.getMonth();
    const day = d.getDate();
    if (
        d.getHours() === 0 &&
        d.getMinutes() === 0 &&
        d.getSeconds() === 0 &&
        d.getMilliseconds() === 0
    ) {
        const prevDay = new Date(y, m, day - 1);
        const endPrev =
            startOfLocalDayMs(
                prevDay.getFullYear(),
                prevDay.getMonth(),
                prevDay.getDate()
            ) + 24 * HOUR_MS;
        if (ms === endPrev) {
            return { date: ymdLocal(prevDay), time: "24:00" };
        }
    }
    return {
        date: ymdLocal(d),
        time: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
    };
}

function formatMsAsFromDateTime(ms: number): { date: string; time: string } {
    const d = new Date(ms);
    return {
        date: ymdLocal(d),
        time: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
    };
}

function parseToEndMs(dateTo: string, timeStr: string): number | null {
    const t = timeStr.trim();
    if (t === "24:00") {
        const dayStart = parseInstantMs(dateTo, "00:00");
        if (dayStart === null) {
            return null;
        }
        return dayStart + 24 * HOUR_MS;
    }
    return parseInstantMs(dateTo, t);
}

const roundBillable = (n: number) => Math.round(n * 10) / 10;

function hourStepperButtonClassName() {
    return "flex h-2.5 w-2.5 items-center justify-center rounded-none bg-transparent p-0 text-gray-500 hover:text-gray-700";
}

function HourStepper({
    ariaLabelUp,
    ariaLabelDown,
    onUp,
    onDown,
}: {
    ariaLabelUp: string;
    ariaLabelDown: string;
    onUp: () => void;
    onDown: () => void;
}) {
    const btn = hourStepperButtonClassName();
    return (
        <div className="flex flex-col items-center gap-0">
            <button type="button" className={btn} onClick={onUp} aria-label={ariaLabelUp}>
                <svg
                    viewBox="0 0 16 16"
                    width="7"
                    height="7"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                >
                    <path d="M4 10l4-4 4 4" />
                </svg>
            </button>
            <button type="button" className={btn} onClick={onDown} aria-label={ariaLabelDown}>
                <svg
                    viewBox="0 0 16 16"
                    width="7"
                    height="7"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                >
                    <path d="M4 6l4 4 4-4" />
                </svg>
            </button>
        </div>
    );
}

function normalizeMultilineCompare(s: string): string {
    return s
        .replace(/\r\n/g, "\n")
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .join("\n");
}

type EditorBaselineSnapshot = {
    descType: string;
    dateFrom: string;
    dateTo: string;
    timeFromNorm: string;
    timeToNorm: string;
    manualInput: string;
    persons: string[];
};

function buildEditorBaseline(
    entry: TimesheetEntryEditorEntry,
    manual: number | undefined,
    manualSplit: ManualBillableSplitHours | undefined
): EditorBaselineSnapshot {
    const timeFromRaw =
        (entry.timeFrom || "").length >= 5
            ? entry.timeFrom.slice(0, 5)
            : entry.timeFrom || "";
    const timeToRaw =
        entry.timeTo === "24:00"
            ? "24:00"
            : (entry.timeTo || "").length >= 5
              ? entry.timeTo.slice(0, 5)
              : entry.timeTo || "";
    const timeFromNorm = normalizeHHMM(timeFromRaw) ?? "";
    const timeToNorm =
        timeToRaw.trim() === "24:00" ? "24:00" : normalizeHHMM(timeToRaw) ?? "";

    return {
        descType: entry.descType,
        dateFrom: entry.dateFrom,
        dateTo: entry.dateTo,
        timeFromNorm,
        timeToNorm,
        manualInput: manualSplit
            ? serializeBillableSplitHours(manualSplit)
            : manual !== undefined
              ? String(manual)
              : "",
        persons: [...(entry.persons ?? [])],
    };
}

/** 자동 청구 문구(W=/N=/A=, 여러 줄)와 동일하면 null. 순수 숫자·접두어 형식은 수동 시간으로 해석 */
function parseManualBillableHoursInput(
    raw: string,
    autoChargeLabel: string
): number | null | "invalid" {
    const trimmed = raw.trim();
    if (trimmed === "") {
        return null;
    }

    const collapseLines = (s: string) =>
        s
            .replace(/\r\n/g, "\n")
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => line.length > 0)
            .join("\n");

    const autoN = collapseLines(autoChargeLabel || "");
    if (autoN.length > 0 && collapseLines(trimmed) === autoN) {
        return null;
    }

    const compactPlain = trimmed.replace(/\s/g, "").replace(",", ".");
    if (/^\d+(?:\.\d+)?$/.test(compactPlain)) {
        const n = Number(compactPlain);
        if (Number.isFinite(n) && n >= 0) {
            return roundBillable(n);
        }
    }

    const lines = trimmed.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const rows = lines.length > 0 ? lines : [trimmed];
    const segmentRe = /^(?:N|W|A|RN|RA)\s*=\s*(\d+(?:[.,]\d+)?)\s*$/i;
    const nums: number[] = [];
    for (const row of rows) {
        const m = row.match(segmentRe);
        if (!m) {
            return "invalid";
        }
        const v = Number(m[1].replace(",", "."));
        if (!Number.isFinite(v) || v < 0) {
            return "invalid";
        }
        nums.push(v);
    }
    const sum = nums.reduce((a, b) => a + b, 0);
    return roundBillable(sum);
}

type BillableSegmentKey = "normal" | "after" | "redNormal" | "redAfter";

const BILLABLE_SEGMENT_CONFIG: Array<{
    key: BillableSegmentKey;
    token: "N" | "A" | "RN" | "RA";
    label: string;
    red?: boolean;
}> = [
    { key: "normal", token: "N", label: "N" },
    { key: "after", token: "A", label: "A" },
    { key: "redNormal", token: "RN", label: "N", red: true },
    { key: "redAfter", token: "RA", label: "A", red: true },
];

function parseBillableSegmentInputs(
    raw: string,
    preferHolidayColumns = false
): Record<BillableSegmentKey, string> {
    const values: Record<BillableSegmentKey, string> = {
        normal: "",
        after: "",
        redNormal: "",
        redAfter: "",
    };
    const compactPlain = raw.trim().replace(/\s/g, "").replace(",", ".");
    if (/^\d+(?:\.\d+)?$/.test(compactPlain)) {
        values.normal = compactPlain;
        return values;
    }

    raw.split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .forEach((line) => {
            const match = line.match(/^(N|A|RN|RA)\s*=\s*(\d+(?:[.,]\d+)?)\s*$/i);
            if (!match) {
                return;
            }
            const token = match[1].toUpperCase();
            const value = match[2].replace(",", ".");
            const normalizedToken =
                preferHolidayColumns && token === "N"
                    ? "RN"
                    : preferHolidayColumns && token === "A"
                      ? "RA"
                      : token;
            const config = BILLABLE_SEGMENT_CONFIG.find(
                (item) => item.token === normalizedToken
            );
            if (config) {
                values[config.key] = value;
            }
        });

    return values;
}

function serializeBillableSegmentInputs(
    values: Record<BillableSegmentKey, string>
): string {
    return BILLABLE_SEGMENT_CONFIG.map((config) => {
        const value = values[config.key].trim().replace(",", ".");
        return value === "" ? "" : `${config.token}=${value}`;
    })
        .filter(Boolean)
        .join("\n");
}

function serializeBillableSplitHours(split: ManualBillableSplitHours): string {
    return serializeBillableSegmentInputs({
        normal: split.weekdayNormal > 0 ? String(split.weekdayNormal) : "",
        after: split.weekdayAfter > 0 ? String(split.weekdayAfter) : "",
        redNormal: split.weekendNormal > 0 ? String(split.weekendNormal) : "",
        redAfter: split.weekendAfter > 0 ? String(split.weekendAfter) : "",
    });
}

function parseManualBillableSplitHoursInput(
    raw: string
): ManualBillableSplitHours | null | "invalid" {
    if (raw.trim() === "") {
        return null;
    }
    const segments = parseBillableSegmentInputs(raw);
    const result: ManualBillableSplitHours = {
        weekdayNormal: 0,
        weekdayAfter: 0,
        weekendNormal: 0,
        weekendAfter: 0,
    };
    const map: Array<[BillableSegmentKey, keyof ManualBillableSplitHours]> = [
        ["normal", "weekdayNormal"],
        ["after", "weekdayAfter"],
        ["redNormal", "weekendNormal"],
        ["redAfter", "weekendAfter"],
    ];
    let hasValue = false;
    for (const [segmentKey, splitKey] of map) {
        const rawValue = segments[segmentKey].trim().replace(",", ".");
        if (rawValue === "") {
            continue;
        }
        if (!/^\d+(?:\.\d+)?$/.test(rawValue)) {
            return "invalid";
        }
        const value = Number(rawValue);
        if (!Number.isFinite(value) || value < 0) {
            return "invalid";
        }
        hasValue = true;
        result[splitKey] = roundBillable(value);
    }

    return hasValue ? result : null;
}

function sumManualBillableSplitHours(split: ManualBillableSplitHours): number {
    return roundBillable(
        split.weekdayNormal +
            split.weekdayAfter +
            split.weekendNormal +
            split.weekendAfter
    );
}

function getNumericBillableBaseForStepper(
    manualInput: string,
    autoChargeLabel: string
): number | "invalid" {
    const trimmed = manualInput.trim();
    if (trimmed !== "") {
        const p = parseManualBillableHoursInput(manualInput, autoChargeLabel);
        if (p === "invalid") {
            return "invalid";
        }
        if (typeof p === "number") {
            return p;
        }
        const compactPlain = trimmed.replace(/\s/g, "").replace(",", ".");
        if (/^\d+(?:\.\d+)?$/.test(compactPlain)) {
            const n = Number(compactPlain);
            if (Number.isFinite(n) && n >= 0) {
                return roundBillable(n);
            }
        }
        return "invalid";
    }
    const p = parseManualBillableHoursInput(autoChargeLabel || "0", "\u0000");
    if (p === "invalid") {
        return 0;
    }
    if (typeof p === "number") {
        return p;
    }
    return 0;
}

export type TimesheetEntryEditorFormProps = {
    entry: TimesheetEntryEditorEntry;
    contextEntries: TimesheetEntryEditorEntry[];
    invoiceTimesheetPeople: string[];
    manualBillableHours: number | undefined;
    manualBillableSplitHours?: ManualBillableSplitHours;
    isHolidayChargeDate?: (date: string) => boolean;
    getDurationLabel: (
        startDate: string,
        startTime: string,
        endDate: string,
        endTime: string
    ) => string;
    getChargeLabelForDraft: (draft: TimesheetEntryEditorEntry) => string;
    onSave: (payload: TimesheetEntryUpdatePayload) => void;
    onCancel: () => void;
    /** 처음 불러온 보고서 기준으로 이 엔트리만 되돌림(부모에서 처리) */
    onResetEntryToInitial?: (entryId: number) => void;
    /** 기본값 적용 후 폼 기준선 갱신용(엔트리별로 증가) */
    remountTick?: number;
    /** 기본값: 엔트리 수정 */
    formTitle?: string;
};

export function TimesheetEntryEditorForm({
    entry,
    contextEntries,
    invoiceTimesheetPeople,
    manualBillableHours,
    manualBillableSplitHours,
    isHolidayChargeDate,
    getDurationLabel,
    getChargeLabelForDraft,
    onSave,
    onCancel,
    onResetEntryToInitial,
    remountTick = 0,
    formTitle = "엔트리 수정",
}: TimesheetEntryEditorFormProps) {
    const baselineEntryIdRef = useRef<number | null>(null);
    const baselineRemountRef = useRef(0);
    const baselineRef = useRef<EditorBaselineSnapshot | null>(null);
    if (
        baselineEntryIdRef.current !== entry.id ||
        baselineRemountRef.current !== remountTick
    ) {
        baselineEntryIdRef.current = entry.id;
        baselineRemountRef.current = remountTick;
        baselineRef.current = buildEditorBaseline(
            entry,
            manualBillableHours,
            manualBillableSplitHours
        );
    }
    const baseline = baselineRef.current!;

    const [defaultConfirmOpen, setDefaultConfirmOpen] = useState(false);

    const [descType, setDescType] = useState(entry.descType);
    const [dateFrom, setDateFrom] = useState(entry.dateFrom);
    const [dateTo, setDateTo] = useState(entry.dateTo);
    const [timeFrom, setTimeFrom] = useState(() =>
        (entry.timeFrom || "").length >= 5 ? entry.timeFrom.slice(0, 5) : entry.timeFrom
    );
    const [timeTo, setTimeTo] = useState(() =>
        entry.timeTo === "24:00"
            ? "24:00"
            : (entry.timeTo || "").length >= 5
              ? entry.timeTo.slice(0, 5)
              : entry.timeTo
    );
    const [selectedPersons, setSelectedPersons] = useState<string[]>(() =>
        entry.clientDuplicated ? [] : [...(entry.persons ?? [])]
    );
    const [manualInput, setManualInput] = useState(
        manualBillableSplitHours
            ? serializeBillableSplitHours(manualBillableSplitHours)
            : manualBillableHours !== undefined
              ? String(manualBillableHours)
              : ""
    );

    useEffect(() => {
        setDescType(entry.descType);
        setDateFrom(entry.dateFrom);
        setDateTo(entry.dateTo);
        setTimeFrom(
            (entry.timeFrom || "").length >= 5 ? entry.timeFrom.slice(0, 5) : entry.timeFrom
        );
        setTimeTo(
            entry.timeTo === "24:00"
                ? "24:00"
                : (entry.timeTo || "").length >= 5
                  ? entry.timeTo.slice(0, 5)
                  : entry.timeTo
        );
        setSelectedPersons(
            entry.clientDuplicated ? [] : [...(entry.persons ?? [])]
        );
        setManualInput(
            manualBillableSplitHours
                ? serializeBillableSplitHours(manualBillableSplitHours)
                : manualBillableHours !== undefined
                  ? String(manualBillableHours)
                  : ""
        );
    }, [
        entry.id,
        entry.clientDuplicated,
        entry.descType,
        entry.dateFrom,
        entry.dateTo,
        entry.timeFrom,
        entry.timeTo,
        entry.persons,
        manualBillableHours,
        manualBillableSplitHours,
    ]);

    const normalizedTimeFrom = normalizeHHMM(timeFrom) ?? "";
    const normalizedTimeTo =
        timeTo.trim() === "24:00" ? "24:00" : normalizeHHMM(timeTo) ?? "";

    const draftInterval = useMemo(() => {
        if (!normalizedTimeFrom || !normalizedTimeTo) {
            return null;
        }
        return getEntryIntervalMs({
            dateFrom,
            dateTo,
            timeFrom: normalizedTimeFrom,
            timeTo: normalizedTimeTo,
        });
    }, [dateFrom, dateTo, normalizedTimeFrom, normalizedTimeTo]);

    const draftEntry: TimesheetEntryEditorEntry = useMemo(
        () => ({
            ...entry,
            descType,
            dateFrom,
            dateTo,
            timeFrom: normalizedTimeFrom,
            timeTo: normalizedTimeTo,
            persons: selectedPersons,
        }),
        [entry, descType, dateFrom, dateTo, normalizedTimeFrom, normalizedTimeTo, selectedPersons]
    );

    const personSelectable = useCallback(
        (person: string) => {
            if (selectedPersons.includes(person)) {
                return true;
            }
            if (!draftInterval) {
                return false;
            }
            for (const other of contextEntries) {
                if (other.id === entry.id) {
                    continue;
                }
                if (!(other.persons ?? []).includes(person)) {
                    continue;
                }
                const oi = getEntryIntervalMs(other);
                if (!oi) {
                    continue;
                }
                if (intervalsOverlap(draftInterval, oi)) {
                    return false;
                }
            }
            return true;
        },
        [contextEntries, draftInterval, entry.id, selectedPersons]
    );

    const durationLabel = getDurationLabel(
        dateFrom,
        normalizedTimeFrom,
        dateTo,
        normalizedTimeTo
    );

    const autoChargeLabel = getChargeLabelForDraft(draftEntry);
    const preferHolidayBillableColumns =
        descType === "작업" && (isHolidayChargeDate?.(dateFrom) ?? false);
    /** 비어 있으면 자동 청구(저장 시 null)이지만, 입력란에는 자동 산출 문구를 표시 */
    const displayManualCharge =
        manualInput.trim() === "" ? autoChargeLabel || "-" : manualInput;
    const billableSegmentInputs = parseBillableSegmentInputs(
        manualInput.trim() === "" ? autoChargeLabel || "" : manualInput,
        manualInput.trim() === "" ? preferHolidayBillableColumns : false
    );
    const handleBillableSegmentChange = (
        key: BillableSegmentKey,
        value: string
    ) => {
        const normalized = value.replace(/[^\d.,]/g, "");
        const next = {
            ...billableSegmentInputs,
            [key]: normalized,
        };
        setManualInput(serializeBillableSegmentInputs(next));
    };

    const baselineDraftEntry: TimesheetEntryEditorEntry = useMemo(
        () => ({
            ...entry,
            descType: baseline.descType,
            dateFrom: baseline.dateFrom,
            dateTo: baseline.dateTo,
            timeFrom: baseline.timeFromNorm,
            timeTo: baseline.timeToNorm,
            persons: baseline.persons,
        }),
        [entry, baseline]
    );

    const baselineDurationLabel = getDurationLabel(
        baseline.dateFrom,
        baseline.timeFromNorm,
        baseline.dateTo,
        baseline.timeToNorm
    );
    const baselineAutoCharge = getChargeLabelForDraft(baselineDraftEntry);
    const baselineChargeDisplay =
        baseline.manualInput.trim() !== ""
            ? baseline.manualInput
            : baselineAutoCharge || "-";

    const descTypeChanged = descType !== baseline.descType;
    const fromTimeChanged = normalizedTimeFrom !== baseline.timeFromNorm;
    const toTimeChanged = normalizedTimeTo !== baseline.timeToNorm;
    const durationChanged =
        (durationLabel || "-") !== (baselineDurationLabel || "-");
    const chargeChanged =
        normalizeMultilineCompare(displayManualCharge) !==
        normalizeMultilineCompare(baselineChargeDisplay);

    const fieldChangedClass =
        "inline-block rounded border border-blue-500 px-1 py-0.5 text-blue-700";

    const togglePerson = (person: string) => {
        setSelectedPersons((prev) => {
            if (prev.includes(person)) {
                return prev.filter((p) => p !== person);
            }
            if (!personSelectable(person)) {
                return prev;
            }
            return [...prev, person];
        });
    };

    const adjustFromByHours = (deltaHours: number) => {
        const tf =
            normalizedTimeFrom || normalizeHHMM((timeFrom || "").trim()) || "";
        if (!tf || tf === "24:00" || !dateFrom) {
            return;
        }
        const ms = parseInstantMs(dateFrom, tf);
        if (ms === null) {
            return;
        }
        const next = formatMsAsFromDateTime(ms + deltaHours * HOUR_MS);
        setDateFrom(next.date);
        setTimeFrom(next.time);
    };

    const adjustToByHours = (deltaHours: number) => {
        if (!dateTo) {
            return;
        }
        const ttRaw = (timeTo || "").trim();
        let ms: number | null;
        if (ttRaw === "24:00") {
            ms = parseToEndMs(dateTo, "24:00");
        } else {
            const tt =
                normalizedTimeTo || normalizeHHMM(ttRaw) || "";
            if (!tt || tt === "24:00") {
                return;
            }
            ms = parseInstantMs(dateTo, tt);
        }
        if (ms === null) {
            return;
        }
        const next = formatMsAsToDateTime(ms + deltaHours * HOUR_MS);
        setDateTo(next.date);
        setTimeTo(next.time);
    };

    const adjustBillableByHours = (deltaHours: number) => {
        const base = getNumericBillableBaseForStepper(manualInput, autoChargeLabel);
        if (base === "invalid") {
            window.alert("청구 시간을 숫자 형식으로 맞춘 뒤 조정해 주세요.");
            return;
        }
        const next = roundBillable(Math.max(0, base + deltaHours));
        setManualInput(String(next));
    };

    const handleSave = () => {
        if (!normalizedTimeFrom || !normalizedTimeTo) {
            window.alert("From / To 시간을 HH:mm 형식으로 입력해 주세요.");
            return;
        }
        if (!dateFrom || !dateTo) {
            window.alert("시작일·종료일을 입력해 주세요.");
            return;
        }
        if (selectedPersons.length === 0) {
            window.alert("인원을 한 명 이상 선택해 주세요.");
            return;
        }
        const parsedSplitBillable =
            descType === "작업"
                ? parseManualBillableSplitHoursInput(manualInput)
                : null;
        if (parsedSplitBillable === "invalid") {
            window.alert("청구 시간은 0 이상의 숫자로 입력해 주세요.");
            return;
        }
        const parsedBillable =
            parsedSplitBillable && typeof parsedSplitBillable === "object"
                ? sumManualBillableSplitHours(parsedSplitBillable)
                : parseManualBillableHoursInput(manualInput, autoChargeLabel);
        if (parsedBillable === "invalid") {
            window.alert("청구 시간은 0 이상의 숫자로 입력해 주세요.");
            return;
        }
        const manualBillableHoursPayload: number | null = parsedBillable;
        onSave({
            entryId: entry.id,
            descType,
            dateFrom,
            dateTo,
            timeFrom: normalizedTimeFrom,
            timeTo: normalizedTimeTo,
            persons: [...selectedPersons].sort((a, b) => a.localeCompare(b, "ko")),
            manualBillableHours: manualBillableHoursPayload,
            manualBillableSplitHours:
                parsedSplitBillable && typeof parsedSplitBillable === "object"
                    ? parsedSplitBillable
                    : null,
        });
        onCancel();
    };

    const descOptions = ["이동", "작업", "대기"] as const;
    const sortedPeople = [...invoiceTimesheetPeople].sort((a, b) =>
        a.localeCompare(b, "ko")
    );

    return (
        <div
            data-entry-edit-editor="true"
            className="my-2 space-y-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm ring-1 ring-gray-900/5"
        >
            <BaseModal
                isOpen={defaultConfirmOpen}
                onClose={() => setDefaultConfirmOpen(false)}
                title="기본값으로 되돌리기"
                maxWidth="max-w-md"
                footer={
                    <>
                        <button
                            type="button"
                            className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-50"
                            onClick={() => setDefaultConfirmOpen(false)}
                        >
                            취소
                        </button>
                        <button
                            type="button"
                            className="rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
                            onClick={() => {
                                setDefaultConfirmOpen(false);
                                onResetEntryToInitial?.(entry.id);
                            }}
                        >
                            기본값 적용
                        </button>
                    </>
                }
            >
                <p className="text-sm leading-relaxed text-gray-700">
                    이 엔트리에 대해 수정한 구분·일시·인원·청구시간과 이동 청구(자택/숙소)
                    선택만 초기화하고, 이 페이지를 처음 불러왔을 때의 보고서 값으로
                    되돌립니다. 다른 엔트리·타임시트 전체에는 영향을 주지 않습니다.
                    계속하시겠습니까?
                </p>
            </BaseModal>
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-semibold text-gray-900">{formTitle}</div>
                <div className="flex flex-wrap items-center gap-2">
                    {onResetEntryToInitial ? (
                        <button
                            type="button"
                            onClick={() => setDefaultConfirmOpen(true)}
                            className="rounded-full px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100"
                        >
                            기본값
                        </button>
                    ) : null}
                    <button
                        type="button"
                        onClick={onCancel}
                        className="rounded-full px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100"
                    >
                        취소
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        className="rounded-full bg-gray-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-gray-800"
                    >
                        저장
                    </button>
                </div>
            </div>
            <div>
                <div className="mb-1 text-xs font-semibold text-gray-500">구분</div>
                <div className="flex flex-wrap gap-2">
                    {descOptions.map((opt) => (
                        <button
                            key={opt}
                            type="button"
                            onClick={() => setDescType(opt)}
                            className={[
                                "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                                descType === opt
                                    ? [
                                          "border-gray-900 bg-gray-900",
                                          descTypeChanged
                                              ? "text-sky-200"
                                              : "text-white",
                                      ].join(" ")
                                    : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50",
                            ].join(" ")}
                        >
                            {opt}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs font-semibold text-gray-600">
                    시작일
                    <input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
                    />
                </label>
                <label className="block text-xs font-semibold text-gray-600">
                    종료일
                    <input
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
                    />
                </label>
                <label className="block text-xs font-semibold text-gray-600">
                    From (HH:mm)
                    <div className="relative mt-1">
                        <input
                            type="text"
                            value={timeFrom}
                            onChange={(e) => setTimeFrom(e.target.value)}
                            placeholder="09:00"
                            className={[
                                "w-full rounded-lg border border-gray-200 py-1.5 pl-2 pr-7 text-sm font-mono",
                                fromTimeChanged ? fieldChangedClass : "",
                            ]
                                .filter(Boolean)
                                .join(" ")}
                        />
                        <div className="absolute right-0.5 top-1/2 -translate-y-1/2">
                            <HourStepper
                                ariaLabelUp="From 1시간 증가"
                                ariaLabelDown="From 1시간 감소"
                                onUp={() => adjustFromByHours(1)}
                                onDown={() => adjustFromByHours(-1)}
                            />
                        </div>
                    </div>
                </label>
                <label className="block text-xs font-semibold text-gray-600">
                    To (HH:mm, 24:00 가능)
                    <div className="relative mt-1">
                        <input
                            type="text"
                            value={timeTo}
                            onChange={(e) => setTimeTo(e.target.value)}
                            placeholder="18:00"
                            className={[
                                "w-full rounded-lg border border-gray-200 py-1.5 pl-2 pr-7 text-sm font-mono",
                                toTimeChanged ? fieldChangedClass : "",
                            ]
                                .filter(Boolean)
                                .join(" ")}
                        />
                        <div className="absolute right-0.5 top-1/2 -translate-y-1/2">
                            <HourStepper
                                ariaLabelUp="To 1시간 증가"
                                ariaLabelDown="To 1시간 감소"
                                onUp={() => adjustToByHours(1)}
                                onDown={() => adjustToByHours(-1)}
                            />
                        </div>
                    </div>
                </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
                <div>
                    <div className="text-xs font-semibold text-gray-500">실제 시간</div>
                    <div
                        className={[
                            "mt-1 rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium",
                            durationChanged ? fieldChangedClass : "text-gray-900",
                        ].join(" ")}
                    >
                        {durationLabel || "-"}
                    </div>
                </div>
                <div>
                    <div className="text-xs font-semibold text-gray-500">청구 시간</div>
                    {descType === "작업" ? (
                        <div
                            className={[
                                "mt-1 grid grid-cols-8 overflow-hidden rounded-lg border border-gray-200 text-sm",
                                chargeChanged ? "border-blue-500 text-blue-700" : "",
                            ]
                                .filter(Boolean)
                                .join(" ")}
                        >
                            {BILLABLE_SEGMENT_CONFIG.map((config) => (
                                <div
                                    key={config.key}
                                    className="contents"
                                >
                                    <div
                                        className={[
                                            "flex items-center justify-center border-r border-gray-200 bg-gray-50 px-2 py-1.5 text-xs font-bold",
                                            config.red ? "text-red-600" : "text-gray-700",
                                        ].join(" ")}
                                    >
                                        {config.label}
                                    </div>
                                    <input
                                        type="text"
                                        inputMode="decimal"
                                        value={billableSegmentInputs[config.key]}
                                        onChange={(e) =>
                                            handleBillableSegmentChange(
                                                config.key,
                                                e.target.value
                                            )
                                        }
                                        className={[
                                            "min-w-0 border-r border-gray-200 px-2 py-1.5 text-center outline-none last:border-r-0",
                                            config.red
                                                ? "text-red-600 focus:bg-red-50"
                                                : "text-gray-900 focus:bg-blue-50",
                                        ].join(" ")}
                                        aria-label={`청구 시간 ${config.token}`}
                                    />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="relative mt-1">
                            <input
                                type="text"
                                inputMode="decimal"
                                value={displayManualCharge}
                                onChange={(e) => setManualInput(e.target.value)}
                                onFocus={(e) => {
                                    if (
                                        manualInput.trim() === "" &&
                                        (autoChargeLabel ?? "").length > 0
                                    ) {
                                        requestAnimationFrame(() => e.target.select());
                                    }
                                }}
                                className={[
                                    "w-full rounded-lg border border-gray-200 py-1.5 pl-2 pr-7 text-sm",
                                    chargeChanged ? fieldChangedClass : "",
                                ]
                                    .filter(Boolean)
                                    .join(" ")}
                            />
                            <div className="absolute right-0.5 top-1/2 -translate-y-1/2">
                                <HourStepper
                                    ariaLabelUp="청구 시간 1시간 증가"
                                    ariaLabelDown="청구 시간 1시간 감소"
                                    onUp={() => adjustBillableByHours(1)}
                                    onDown={() => adjustBillableByHours(-1)}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div>
                <div className="mb-2 text-xs font-semibold text-gray-500">
                    인원 (동일 시간대에 다른 엔트리에 배정된 인원은 선택 불가)
                </div>
                <div className="flex flex-wrap gap-2">
                    {sortedPeople.map((person) => {
                        const selected = selectedPersons.includes(person);
                        const allowed = personSelectable(person);
                        return (
                            <button
                                key={person}
                                type="button"
                                disabled={!selected && !allowed}
                                onClick={() => togglePerson(person)}
                                className={[
                                    "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                                    selected
                                        ? "border-gray-900 bg-gray-900 text-white"
                                        : allowed
                                          ? "border-gray-200 bg-white text-gray-800 hover:bg-gray-50"
                                          : "cursor-not-allowed border-gray-100 bg-gray-100 text-gray-400",
                                ].join(" ")}
                            >
                                {person}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
