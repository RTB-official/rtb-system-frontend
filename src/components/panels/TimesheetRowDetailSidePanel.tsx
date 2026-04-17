import {
    Fragment,
    useCallback,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
    type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import {
    TRAVEL_OVERRIDE_EDITOR_ANIM_MS,
    TravelOverrideEditorAnimatedShell,
} from "./TravelOverrideEditorAnimatedShell";
import { getDatesMissingSkilledFitterRemark } from "../../constants/skilledFitter";
import {
    buildConsecutiveWorkClusterIndices,
    getWorkEntryAutoBillableTotalHours,
    sumClusterWorkBillableHours,
    type WorkEntryClusterable,
} from "../../utils/workEntryBillableHours";

interface TimesheetRowDetailSidePanelProps {
    isOpen: boolean;
    onClose: () => void;
    sectionTitle: string;
    selectedPersons: string[];
    day: string;
    dateFormatted: string;
    timeFrom: string;
    timeTo: string;
    description: string;
    sourceEntries: Array<{
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
    }>;
    groupSourceEntries: Array<{
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
    }>;
    previousWorkLocations: Record<string, string[]>;
    nextWorkLocations: Record<string, string[]>;
    /** 인보이스 페이지와 동일: 공휴일(행정 API·캘린더 키워드). 주말은 별도 판별. */
    holidayDateKeys?: ReadonlySet<string>;
    travelChargeOverrides: Record<
        string,
        {
            target: "home" | "lodging";
            updatedAt: number;
        }
    >;
    onTravelChargeOverrideChange: (
        entryId: number,
        person: string,
        target: "home" | "lodging"
    ) => void;
    onTravelChargeOverrideResetEntry: (entryId: number) => void;
    requiredSkilledFittersInRemarks: string[];
    personVesselHistoryByPerson: Record<
        string,
        Array<{
            date: string;
            vessels: string[];
        }>
    >;
    invoiceTimesheetPeople?: string[];
    getOriginalTimesheetEntryPersons?: (entryId: number) => string[];
    getTimesheetEntryEditBaseline?: (entryId: number) =>
        | {
              descType: string;
              dateFrom: string;
              dateTo: string;
              timeFrom: string;
              timeTo: string;
              manualBillableHours?: number;
          }
        | undefined;
    onReplaceTimesheetEntryPerson?: (args: {
        entryId: number;
        fromPerson: string;
        toPerson: string;
    }) => void;
    /** 엔트리별 수동 청구시간(시) — 비어 있으면 자동 계산 */
    manualBillableHoursByEntryId?: Record<number, number>;
    /** 인보이스 페이지에서 삭제한 엔트리 목록(조회용) */
    deletedEntries?: Array<{
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
    }>;
    onRestoreDeletedTimesheetEntry?: (entryId: number) => void;
    onRestoreAllDeletedTimesheetEntriesInScope?: (entryIds: number[]) => void;
    /** 타임시트 행 YYYY-MM-DD — 내 엔트리만 모두 삭제해도 삭제 목록 스코프 유지 */
    timesheetRowCalendarDate?: string;
}

type TravelChargeOverrideTarget = "home" | "lodging";
type TravelBadgeDirection = "arrival" | "departure";
type TravelDescriptionBadgeData = {
    label: string;
    people: string[];
    target: TravelChargeOverrideTarget;
    direction: TravelBadgeDirection;
    isChanged: boolean;
};

type PersonVesselHistoryItem = {
    date: string;
    vessels: string[];
};

const GANGDONG_FACTORY = "강동동 공장";

/** 복사(clientDuplicated) 엔트리 행 배경 — 기본 색 위에 아주 연한 빗금만 얹음 */
const DUPLICATED_ENTRY_ROW_STRIPE_IMAGE =
    "repeating-linear-gradient(135deg, transparent 0px, transparent 6px, rgba(15, 23, 42, 0.08) 6px, rgba(15, 23, 42, 0.08) 7px)";

const sortPeopleByKoreanOrder = (people: string[]) =>
    [...people].sort((a, b) => a.localeCompare(b, "ko"));

const getEntryTimeRange = (
    entry: TimesheetRowDetailSidePanelProps["sourceEntries"][number]
) => {
    if (!entry.dateFrom || !entry.dateTo || !entry.timeFrom || !entry.timeTo) {
        return null;
    }

    const start = new Date(`${entry.dateFrom}T${entry.timeFrom}`);
    const end =
        entry.timeTo === "24:00"
            ? new Date(
                  new Date(`${entry.dateTo}T00:00:00`).getTime() +
                      24 * 60 * 60 * 1000
              )
            : new Date(`${entry.dateTo}T${entry.timeTo}`);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
        return null;
    }

    return { start, end };
};

const getConcurrentEntryPersons = (
    entries: TimesheetRowDetailSidePanelProps["sourceEntries"],
    currentEntry: TimesheetRowDetailSidePanelProps["sourceEntries"][number]
) => {
    const blocked = new Set<string>();
    const currentRange = getEntryTimeRange(currentEntry);
    if (!currentRange) {
        return blocked;
    }

    entries.forEach((entry) => {
        if (entry.id === currentEntry.id) {
            return;
        }

        const range = getEntryTimeRange(entry);
        if (!range) {
            return;
        }

        const overlaps =
            currentRange.start < range.end && range.start < currentRange.end;
        if (!overlaps) {
            return;
        }

        (entry.persons ?? []).forEach((person) => {
            if (person) {
                blocked.add(person);
            }
        });
    });

    return blocked;
};

const getRemarkReplaceCandidates = ({
    invoiceTimesheetPeople,
    entryPersons,
    selectedRemarkPerson,
    originalEntryPersons,
    blockedPersons,
}: {
    invoiceTimesheetPeople: string[];
    entryPersons: string[];
    selectedRemarkPerson: string;
    originalEntryPersons: string[];
    blockedPersons?: ReadonlySet<string>;
}) => {
    const selectedIndex = entryPersons.findIndex(
        (person) => person === selectedRemarkPerson
    );
    const originalPersonForSlot =
        selectedIndex >= 0 ? originalEntryPersons[selectedIndex] : null;
    const occupied = new Set(
        entryPersons.filter((person) => person !== selectedRemarkPerson)
    );
    const candidates = sortPeopleByKoreanOrder(
        invoiceTimesheetPeople.filter(
            (person) =>
                person !== selectedRemarkPerson &&
                !occupied.has(person) &&
                !blockedPersons?.has(person)
        )
    );

    if (
        originalPersonForSlot &&
        originalPersonForSlot !== selectedRemarkPerson &&
        !occupied.has(originalPersonForSlot) &&
        !blockedPersons?.has(originalPersonForSlot)
    ) {
        return [
            originalPersonForSlot,
            ...candidates.filter((person) => person !== originalPersonForSlot),
        ];
    }

    return candidates;
};

function normalizeLocationName(value: string | null | undefined): string {
    if (!value) return "";

    const normalized = value.trim();
    if (!normalized) return "";

    if (normalized === "HHI") return "HD중공업(해양)";
    if (normalized === "HMD") return "HD미포";
    if (normalized === "HSHI") return "HD삼호";

    return normalized;
}

function getFinalDestination(
    entry: TimesheetRowDetailSidePanelProps["sourceEntries"][number]
): string {
    const moveTo = entry.moveTo?.trim();
    if (moveTo) {
        return moveTo;
    }

    const details = (entry.details ?? "").replace(/\s*이동\.?\s*$/, "").trim();
    if (!details.includes("→")) {
        return details;
    }

    return details.split("→").pop()?.trim() ?? "";
}

function getTravelEntryOrigin(
    entry: TimesheetRowDetailSidePanelProps["sourceEntries"][number]
): string {
    const moveFrom = entry.moveFrom?.trim();
    if (moveFrom) {
        return moveFrom;
    }

    const details = (entry.details ?? "").replace(/\s*이동\.?\s*$/, "").trim();
    if (!details.includes("→")) {
        return details;
    }

    return details.split("→")[0]?.trim() ?? "";
}

function sortEntriesByStart(
    entries: TimesheetRowDetailSidePanelProps["sourceEntries"]
) {
    return [...entries].sort((a, b) => {
        const aStart = new Date(
            `${a.dateFrom}T${a.timeFrom || "00:00"}`
        ).getTime();
        const bStart = new Date(
            `${b.dateFrom}T${b.timeFrom || "00:00"}`
        ).getTime();
        return aStart - bStart;
    });
}

/** 인보이스 단일 행과 동일: 선행 이동·말미 이동이 강동동 공장에서 맞물리면 해당 이동들 청구 0 */
function getZeroBillingTravelIdsForRowScopedEntries(
    entries: TimesheetRowDetailSidePanelProps["sourceEntries"]
): Set<number> {
    const sorted = sortEntriesByStart(entries);
    let i = 0;
    while (i < sorted.length && sorted[i].descType === "이동") {
        i += 1;
    }
    const before = sorted.slice(0, i);
    let j = sorted.length - 1;
    while (j >= i && sorted[j].descType === "이동") {
        j -= 1;
    }
    const after = sorted.slice(j + 1);

    const lastBefore = before[before.length - 1];
    const firstAfter = after[0];
    const factory = normalizeLocationName(GANGDONG_FACTORY);

    if (
        !lastBefore ||
        !firstAfter ||
        normalizeLocationName(getFinalDestination(lastBefore)) !== factory ||
        normalizeLocationName(getTravelEntryOrigin(firstAfter)) !== factory
    ) {
        return new Set();
    }

    return new Set(
        [...before, ...after].filter((e) => e.descType === "이동").map((e) => e.id)
    );
}

/** 전체 일자 그룹: 인당 작업 블록마다 동일 규칙 적용 */
function getZeroBillingTravelIdsForGroupEntries(
    entries: TimesheetRowDetailSidePanelProps["groupSourceEntries"]
): Set<number> {
    if (entries.length === 0) {
        return new Set();
    }

    const asSource = entries as TimesheetRowDetailSidePanelProps["sourceEntries"];
    const allPersons = new Set(asSource.flatMap((e) => e.persons ?? []));
    const result = new Set<number>();
    const factory = normalizeLocationName(GANGDONG_FACTORY);

    for (const person of allPersons) {
        const personEntries = sortEntriesByStart(
            asSource.filter((e) => (e.persons ?? []).includes(person))
        );
        let i = 0;
        while (i < personEntries.length) {
            const beforeStart = i;
            while (i < personEntries.length && personEntries[i].descType === "이동") {
                i += 1;
            }
            const before = personEntries.slice(beforeStart, i);
            if (i >= personEntries.length) {
                break;
            }
            while (
                i < personEntries.length &&
                personEntries[i].descType !== "이동"
            ) {
                i += 1;
            }
            const afterStart = i;
            while (i < personEntries.length && personEntries[i].descType === "이동") {
                i += 1;
            }
            const after = personEntries.slice(afterStart, i);

            const lastBefore = before[before.length - 1];
            const firstAfter = after[0];
            if (
                lastBefore &&
                firstAfter &&
                normalizeLocationName(getFinalDestination(lastBefore)) === factory &&
                normalizeLocationName(getTravelEntryOrigin(firstAfter)) === factory
            ) {
                before
                    .filter((e) => e.descType === "이동")
                    .forEach((e) => result.add(e.id));
                after
                    .filter((e) => e.descType === "이동")
                    .forEach((e) => result.add(e.id));
            }
        }
    }

    return result;
}

interface PanelDisplayData {
    sectionTitle: string;
    selectedPersons: string[];
    day: string;
    dateFormatted: string;
    timeFrom: string;
    timeTo: string;
    description: string;
    sourceEntries: TimesheetRowDetailSidePanelProps["sourceEntries"];
    groupSourceEntries: TimesheetRowDetailSidePanelProps["groupSourceEntries"];
    timesheetRowCalendarDate: string;
}

function scopeDeletedEntriesForInvoiceRowPanel(
    deleted: NonNullable<TimesheetRowDetailSidePanelProps["deletedEntries"]>,
    source: TimesheetRowDetailSidePanelProps["sourceEntries"],
    group: TimesheetRowDetailSidePanelProps["groupSourceEntries"],
    rowCalendarDate: string | undefined
) {
    const datesFromRemaining = new Set(
        [...source, ...group].flatMap((e) =>
            [e.dateFrom, e.dateTo].filter(Boolean)
        )
    );
    const rowCal = rowCalendarDate?.trim();
    return deleted.filter((e) => {
        if (e.clientDuplicated === true) {
            return false;
        }
        if (datesFromRemaining.has(e.dateFrom)) {
            return true;
        }
        if (rowCal && (e.dateFrom === rowCal || e.dateTo === rowCal)) {
            return true;
        }
        if (!rowCal && datesFromRemaining.size === 0) {
            return true;
        }
        return false;
    });
}

function CloseIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path
                d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41Z"
                fill="currentColor"
            />
        </svg>
    );
}

function DescTypeBadge({
    value,
    emphasizeChangedText,
}: {
    value: string;
    emphasizeChangedText?: boolean;
}) {
    const bgRing =
        value === "이동"
            ? "bg-lime-100 ring-lime-200"
            : value === "작업"
              ? "bg-sky-100 ring-sky-200"
              : value === "대기"
                ? "bg-orange-100 ring-orange-200"
                : "bg-gray-100 ring-gray-200";
    const textColor = emphasizeChangedText
        ? "border-2 border-blue-500 text-blue-800"
        : value === "이동"
          ? "text-lime-800"
          : value === "작업"
            ? "text-sky-800"
            : value === "대기"
              ? "text-orange-800"
              : "text-gray-800";

    return (
        <span
            className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-semibold leading-4 ring-1 ring-inset ${bgRing} ${textColor}`}
        >
            {value}
        </span>
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

function renderTravelBadgeLabelWithArrow(label: string, arrowClassName: string): ReactNode {
    if (!label.includes("→")) {
        return label;
    }
    const parts = label.split("→");
    const nodes: ReactNode[] = [];
    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (part) {
            nodes.push(
                <span key={`t-${i}`} className="font-semibold">
                    {part}
                </span>
            );
        }
        if (i < parts.length - 1) {
            nodes.push(
                <span key={`a-${i}`} className={arrowClassName}>
                    →
                </span>
            );
        }
    }
    return nodes;
}

function getTravelBadgeLabel(
    direction: TravelBadgeDirection,
    target: TravelChargeOverrideTarget
) {
    if (direction === "departure") {
        return target === "home" ? "자택→ " : "숙소→ ";
    }

    return target === "home" ? "→자택" : "→숙소";
}

function TravelDescriptionBadge({
    label,
    onClick,
    isActive = false,
    emphasizeChangedText = false,
}: {
    label: string;
    onClick?: () => void;
    isActive?: boolean;
    emphasizeChangedText?: boolean;
}) {
    const isHome = label.includes("자택");
    const textClass = emphasizeChangedText
        ? "text-blue-800"
        : isHome
          ? "text-amber-700"
          : "text-sky-700";
    const styles = isHome
        ? `bg-amber-50 ring-amber-200 hover:bg-amber-100 ${textClass} ${
              emphasizeChangedText ? "border-2 border-blue-500" : ""
          }`
        : `bg-sky-50 ring-sky-200 hover:bg-sky-100 ${textClass} ${
              emphasizeChangedText ? "border-2 border-blue-500" : ""
          }`;
    const arrowClass = isHome
        ? `mx-px font-extrabold tabular-nums ${
              emphasizeChangedText ? "text-blue-800" : "text-orange-950"
          }`
        : `mx-px font-extrabold tabular-nums ${
              emphasizeChangedText ? "text-blue-800" : "text-blue-950"
          }`;
    const activeClass = isActive
        ? isHome
            ? "ring-amber-400 shadow-sm"
            : "ring-sky-400 shadow-sm"
        : "";

    return (
        <button
            type="button"
            onClick={onClick}
            data-travel-override-badge="true"
            className={`inline-flex items-center gap-0 rounded-full px-2 py-0.5 text-[11px] font-semibold leading-4 ring-1 ring-inset transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ${styles} ${activeClass}`}
        >
            {renderTravelBadgeLabelWithArrow(label, arrowClass)}
        </button>
    );
}

export default function TimesheetRowDetailSidePanel({
    isOpen,
    onClose,
    sectionTitle,
    selectedPersons,
    day,
    dateFormatted,
    timeFrom,
    timeTo,
    description,
    sourceEntries,
    groupSourceEntries,
    previousWorkLocations,
    nextWorkLocations,
    holidayDateKeys,
    travelChargeOverrides,
    onTravelChargeOverrideChange,
    onTravelChargeOverrideResetEntry,
    requiredSkilledFittersInRemarks,
    personVesselHistoryByPerson,
    invoiceTimesheetPeople = [],
    getOriginalTimesheetEntryPersons,
    getTimesheetEntryEditBaseline,
    onReplaceTimesheetEntryPerson,
    manualBillableHoursByEntryId = {},
    deletedEntries = [],
    onRestoreDeletedTimesheetEntry,
    onRestoreAllDeletedTimesheetEntriesInScope,
    timesheetRowCalendarDate = "",
}: TimesheetRowDetailSidePanelProps) {
    const panelRef = useRef<HTMLElement | null>(null);
    const scrollBodyRef = useRef<HTMLDivElement | null>(null);
    const [expandedEditorKey, setExpandedEditorKey] = useState<string | null>(null);
    const [editorClosingKey, setEditorClosingKey] = useState<string | null>(null);
    const expandedEditorKeyRef = useRef<string | null>(null);
    expandedEditorKeyRef.current = expandedEditorKey;
    const closeEditorTimerRef = useRef<number | null>(null);

    const [expandedRemarkKey, setExpandedRemarkKey] = useState<string | null>(null);
    const [remarkClosingKey, setRemarkClosingKey] = useState<string | null>(null);
    const [remarkPersonReplacePickerKey, setRemarkPersonReplacePickerKey] = useState<
        string | null
    >(null);
    const expandedRemarkKeyRef = useRef<string | null>(null);
    expandedRemarkKeyRef.current = expandedRemarkKey;
    const closeRemarkTimerRef = useRef<number | null>(null);

    useEffect(() => {
        setRemarkPersonReplacePickerKey(null);
    }, [expandedRemarkKey]);

    const dismissRemarkEditorImmediate = useCallback(() => {
        setExpandedRemarkKey(null);
        setRemarkClosingKey(null);
        if (closeRemarkTimerRef.current != null) {
            window.clearTimeout(closeRemarkTimerRef.current);
            closeRemarkTimerRef.current = null;
        }
    }, []);

    const dismissTravelEditorImmediate = useCallback(() => {
        setExpandedEditorKey(null);
        setEditorClosingKey(null);
        if (closeEditorTimerRef.current != null) {
            window.clearTimeout(closeEditorTimerRef.current);
            closeEditorTimerRef.current = null;
        }
    }, []);

    const ensureExpandedEditorVisible = useCallback((editorKey: string) => {
        const body = scrollBodyRef.current;
        if (!body) return;

        const escapedKey =
            typeof CSS !== "undefined" && typeof CSS.escape === "function"
                ? CSS.escape(editorKey)
                : editorKey.replace(/"/g, '\\"');
        const editorEl = body.querySelector<HTMLElement>(
            `[data-editor-key="${escapedKey}"]`
        );
        if (!editorEl) return;

        const bodyRect = body.getBoundingClientRect();
        const editorRect = editorEl.getBoundingClientRect();
        const padding = 16;

        if (editorRect.bottom > bodyRect.bottom - padding) {
            body.scrollTop += editorRect.bottom - bodyRect.bottom + padding;
        } else if (editorRect.top < bodyRect.top + padding) {
            body.scrollTop -= bodyRect.top + padding - editorRect.top;
        }
    }, []);

    const closeRemarkEditor = useCallback(() => {
        const key = expandedRemarkKeyRef.current;
        if (key === null) return;
        setRemarkClosingKey(key);
        setExpandedRemarkKey(null);
        if (closeRemarkTimerRef.current != null) {
            window.clearTimeout(closeRemarkTimerRef.current);
        }
        closeRemarkTimerRef.current = window.setTimeout(() => {
            setRemarkClosingKey(null);
            closeRemarkTimerRef.current = null;
        }, TRAVEL_OVERRIDE_EDITOR_ANIM_MS);
    }, []);

    const openRemarkEditor = useCallback((key: string) => {
        dismissTravelEditorImmediate();
        if (closeRemarkTimerRef.current != null) {
            window.clearTimeout(closeRemarkTimerRef.current);
            closeRemarkTimerRef.current = null;
        }
        setRemarkClosingKey(null);
        setExpandedRemarkKey(key);
    }, [dismissTravelEditorImmediate]);

    const closeEditor = useCallback(() => {
        const key = expandedEditorKeyRef.current;
        if (key === null) return;
        setEditorClosingKey(key);
        setExpandedEditorKey(null);
        if (closeEditorTimerRef.current != null) {
            window.clearTimeout(closeEditorTimerRef.current);
        }
        closeEditorTimerRef.current = window.setTimeout(() => {
            setEditorClosingKey(null);
            closeEditorTimerRef.current = null;
        }, TRAVEL_OVERRIDE_EDITOR_ANIM_MS);
    }, []);

    const openEditor = useCallback((key: string) => {
        if (closeEditorTimerRef.current != null) {
            window.clearTimeout(closeEditorTimerRef.current);
            closeEditorTimerRef.current = null;
        }
        setEditorClosingKey(null);
        setExpandedEditorKey(key);
    }, []);

    const [displayData, setDisplayData] = useState<PanelDisplayData>({
        sectionTitle,
        selectedPersons,
        day,
        dateFormatted,
        timeFrom,
        timeTo,
        description,
        sourceEntries,
        groupSourceEntries,
        timesheetRowCalendarDate,
    });

    const patchDisplayDataEntryPersons = useCallback(
        (entryId: number, fromPerson: string, toPerson: string) => {
            const patchEntry = (
                entry: TimesheetRowDetailSidePanelProps["sourceEntries"][number]
            ) =>
                entry.id !== entryId
                    ? entry
                    : {
                          ...entry,
                          persons: (entry.persons ?? []).map((person) =>
                              person === fromPerson ? toPerson : person
                          ),
                      };

            setDisplayData((prev) => ({
                ...prev,
                sourceEntries: prev.sourceEntries.map(patchEntry),
                groupSourceEntries: prev.groupSourceEntries.map(patchEntry),
            }));
        },
        []
    );

    const getTravelChargeOverrideKey = (entryId: number, person: string) =>
        `${entryId}:${person}`;

    const isChargeHighlightDate = (dateText: string) => {
        const date = new Date(`${dateText}T00:00:00`);
        if (Number.isNaN(date.getTime())) {
            return false;
        }

        const day = date.getDay();
        if (day === 0 || day === 6) {
            return true;
        }

        return holidayDateKeys?.has(dateText) ?? false;
    };

    const renderSourceEntriesTable = (
        title: string,
        _subtitle: string,
        entriesData: TimesheetRowDetailSidePanelProps["sourceEntries"],
        highlightedEntryIds: Set<number> = new Set(),
        zeroBillingScope: "row" | "group" = "row"
    ) => {
        const travelChargeContextEntries =
            zeroBillingScope === "group"
                ? entriesData
                : displayData.groupSourceEntries.length > 0
                  ? (displayData.groupSourceEntries as TimesheetRowDetailSidePanelProps["sourceEntries"])
                  : entriesData;
        const zeroBillingTravelIds =
            zeroBillingScope === "row"
                ? getZeroBillingTravelIdsForRowScopedEntries(entriesData)
                : getZeroBillingTravelIdsForGroupEntries(
                      entriesData as TimesheetRowDetailSidePanelProps["groupSourceEntries"]
                  );
        const datesMissingSkilledFitterRemark =
            getDatesMissingSkilledFitterRemark(
                entriesData,
                requiredSkilledFittersInRemarks
            );

        const getSourceTableRemarkEditorKey = (
            entryId: number,
            person: string
        ) => `${title}:remark:${entryId}:${person}`;

        const getRemarkPersonHistoryNeighbors = (
            entry: (typeof entriesData)[number],
            person: string
        ) => {
            const history = personVesselHistoryByPerson[person] ?? [];
            const targetDate = entry.dateFrom;
            const currentIndex = history.findIndex(
                (item) => item.date === entry.dateFrom
            );
            const insertionIndex =
                currentIndex >= 0
                    ? currentIndex
                    : history.findIndex((item) => item.date > targetDate);
            const nextIndex =
                currentIndex >= 0
                    ? currentIndex + 1
                    : insertionIndex >= 0
                      ? insertionIndex
                      : history.length;
            const previousIndex =
                currentIndex >= 0 ? currentIndex - 1 : nextIndex - 1;
            const current =
                currentIndex >= 0
                    ? history[currentIndex]
                    : ({
                          date: entry.dateFrom,
                          vessels: [],
                      } satisfies PersonVesselHistoryItem);

            return {
                previous:
                    previousIndex >= 0 && previousIndex < history.length
                        ? history[previousIndex]
                        : null,
                current,
                next:
                    nextIndex >= 0 && nextIndex < history.length
                        ? history[nextIndex]
                        : null,
            };
        };

        const renderRemarkPersonHistory = (
            entry: (typeof entriesData)[number],
            person: string
        ) => {
            const { previous, current, next } = getRemarkPersonHistoryNeighbors(
                entry,
                person
            );
            const cards = [
                { label: "직전", item: previous },
                { label: "당일", item: current },
                { label: "직후", item: next },
            ];

            return (
                <div className="grid gap-3 md:grid-cols-3">
                    {cards.map(({ label, item }) => (
                        <div
                            key={`${person}-${label}`}
                            className="rounded-xl border border-gray-200 bg-white p-3"
                        >
                            <div className="mb-2 flex items-baseline justify-between gap-2">
                                <div className="min-w-0 text-left text-sm font-semibold text-gray-900">
                                    {item?.date ?? "-"}
                                </div>
                                <div className="shrink-0 text-right text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                                    {label}
                                </div>
                            </div>
                            <div className="text-sm text-gray-700">
                                {item && item.vessels.length > 0
                                    ? item.vessels.join(", ")
                                    : "-"}
                            </div>
                        </div>
                    ))}
                </div>
            );
        };

        const renderRemarkPersonsInteractive = (
            entry: (typeof entriesData)[number]
        ) => {
            const persons = entry.persons ?? [];
            if (entry.clientDuplicated) {
                const baseline =
                    getOriginalTimesheetEntryPersons?.(entry.id) ?? [];
                const unchangedFromDuplicateBaseline =
                    baseline.length === persons.length &&
                    baseline.every((p, i) => p === persons[i]);
                if (persons.length === 0 || unchangedFromDuplicateBaseline) {
                    return null;
                }
            }
            if (persons.length === 0) {
                return "-";
            }

            const lines: string[][] = [];
            for (let index = 0; index < persons.length; index += 3) {
                lines.push(persons.slice(index, index + 3));
            }

            const highlightedPersons = new Set(displayData.selectedPersons);
            const originalEntryPersons =
                getOriginalTimesheetEntryPersons?.(entry.id) ?? [];
            const originalPersonSet = new Set(originalEntryPersons);
            const hasPersonsBaseline = originalEntryPersons.length > 0;

            return (
                <div className="flex flex-col gap-1">
                    {lines.map((line, lineIdx) => (
                        <div
                            key={`remark-line-${entry.id}-${lineIdx}`}
                            className="flex flex-wrap items-baseline"
                        >
                            {line.map((person, i) => {
                                const rk = getSourceTableRemarkEditorKey(
                                    entry.id,
                                    person
                                );
                                const isActive = expandedRemarkKey === rk;
                                const isReplacedRemarkPerson =
                                    hasPersonsBaseline &&
                                    !originalPersonSet.has(person);
                                return (
                                    <Fragment
                                        key={`${entry.id}-${person}-${lineIdx}-${i}`}
                                    >
                                        {i > 0 ? (
                                            <span className="select-none text-gray-500">
                                                ,{" "}
                                            </span>
                                        ) : null}
                                        <button
                                            type="button"
                                            data-remark-person="true"
                                            aria-pressed={isActive}
                                            className={[
                                                "rounded px-0.5 py-0.5 text-left transition-colors",
                                                "hover:bg-gray-100 hover:text-gray-900",
                                                isActive
                                                    ? isReplacedRemarkPerson
                                                        ? "bg-blue-50 font-bold text-blue-800 ring-2 ring-blue-400"
                                                        : [
                                                              "bg-blue-50 text-blue-900 ring-1 ring-blue-200",
                                                              highlightedPersons.has(
                                                                  person
                                                              )
                                                                  ? "font-bold"
                                                                  : "",
                                                          ]
                                                              .filter(Boolean)
                                                              .join(" ")
                                                    : isReplacedRemarkPerson
                                                      ? "rounded border border-blue-500 px-0.5 font-bold text-blue-700"
                                                      : highlightedPersons.has(
                                                            person
                                                        )
                                                        ? "font-bold text-gray-900"
                                                        : "text-gray-700",
                                            ]
                                                .filter(Boolean)
                                                .join(" ")}
                                            onClick={() => {
                                                if (expandedRemarkKey === rk) {
                                                    closeRemarkEditor();
                                                } else {
                                                    openRemarkEditor(rk);
                                                }
                                            }}
                                        >
                                            {person}
                                        </button>
                                    </Fragment>
                                );
                            })}
                        </div>
                    ))}
                </div>
            );
        };

        return (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <div className="border-b border-gray-200 bg-blue-50 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                    {title}
                </div>
            </div>

            {entriesData.length === 0 ? (
                <div className="px-4 py-6 text-sm text-gray-500">
                    연결된 원본 엔트리가 없습니다.
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full table-fixed text-xs">
                        <colgroup>
                            <col className="w-[38px]" />
                            <col className="w-[38px]" />
                            <col className="w-[42px]" />
                            <col className="w-[68px]" />
                            <col className="w-[74px]" />
                            <col className="w-[74px]" />
                            <col className="w-[96px]" />
                            <col className="w-[96px]" />
                            <col className="w-[40%]" />
                            <col className="w-[16%]" />
                        </colgroup>
                        <thead className="bg-gray-50 text-gray-600">
                            <tr>
                                <th className="border-b border-r border-gray-200 px-3 py-2 text-center font-semibold">월</th>
                                <th className="border-b border-r border-gray-200 px-3 py-2 text-center font-semibold">일</th>
                                <th className="border-b border-r border-gray-200 px-3 py-2 text-center font-semibold">요일</th>
                                <th className="border-b border-r border-gray-200 px-3 py-2 text-center font-semibold">구분</th>
                                <th className="border-b border-r border-gray-200 px-3 py-2 text-center font-semibold">From</th>
                                <th className="border-b border-r border-gray-200 px-3 py-2 text-center font-semibold">To</th>
                                <th className="border-b border-r border-gray-200 px-3 py-2 text-center font-semibold whitespace-pre-line">실제{"\n"}시간</th>
                                <th className="border-b border-r border-gray-200 px-3 py-2 text-center font-semibold whitespace-pre-line">청구{"\n"}시간</th>
                                <th className="border-b border-r border-gray-200 px-3 py-2 text-left font-semibold">작업내용(Description)</th>
                                <th className="border-b border-gray-200 px-3 py-2 text-left font-semibold">비고(Remark)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {entriesData.map((entry, index, entries) => {
                                const [, month, dayOfMonth] = entry.dateFrom.split("-");
                                const correctionLabel =
                                    getCorrectionLabel(
                                        entry,
                                        travelChargeContextEntries,
                                        zeroBillingTravelIds
                                    );
                                const durationLabel = getDurationLabel(
                                    entry.dateFrom,
                                    entry.timeFrom,
                                    entry.dateTo,
                                    entry.timeTo
                                );
                                const editBaseline =
                                    getTimesheetEntryEditBaseline?.(entry.id);
                                const fieldEditedClass =
                                    "inline-block rounded border border-blue-500 px-1 py-0.5 font-medium text-blue-700";
                                const baselineSynth = editBaseline
                                    ? {
                                          ...entry,
                                          descType: editBaseline.descType,
                                          dateFrom: editBaseline.dateFrom,
                                          dateTo: editBaseline.dateTo,
                                          timeFrom: editBaseline.timeFrom,
                                          timeTo: editBaseline.timeTo,
                                      }
                                    : null;
                                const baselineDurationHours = baselineSynth
                                    ? getDurationHours(
                                          baselineSynth.dateFrom,
                                          baselineSynth.timeFrom,
                                          baselineSynth.dateTo,
                                          baselineSynth.timeTo
                                      )
                                    : null;
                                const baselineDurationLabel =
                                    baselineDurationHours === null
                                        ? "-"
                                        : formatHoursLabel(baselineDurationHours);
                                const currentDurationLabel =
                                    durationLabel || "-";
                                const baselineCorrectionLabel = baselineSynth
                                    ? getCorrectionLabel(
                                          baselineSynth,
                                          travelChargeContextEntries,
                                          zeroBillingTravelIds,
                                          false,
                                          {
                                              manualBillableHours:
                                                  editBaseline!.manualBillableHours,
                                              ignoreTravelOverrides: true,
                                          }
                                      )
                                    : "";
                                const descTypeChanged = Boolean(
                                    editBaseline &&
                                        entry.descType !== editBaseline.descType
                                );
                                const fromChanged = Boolean(
                                    editBaseline &&
                                        formatTimeToMinutes(entry.timeFrom) !==
                                            formatTimeToMinutes(
                                                editBaseline.timeFrom
                                            )
                                );
                                const toChanged = Boolean(
                                    editBaseline &&
                                        formatTimeToMinutes(entry.timeTo) !==
                                            formatTimeToMinutes(editBaseline.timeTo)
                                );
                                const durationChanged = Boolean(
                                    editBaseline &&
                                        currentDurationLabel !== baselineDurationLabel
                                );
                                const chargeChanged = Boolean(
                                    editBaseline &&
                                        normalizeMultilineCompare(
                                            String(correctionLabel)
                                        ) !==
                                            normalizeMultilineCompare(
                                                String(baselineCorrectionLabel)
                                            )
                                );
                                const isSameDateAsPrevious =
                                    index > 0 &&
                                    entries[index - 1]?.dateFrom === entry.dateFrom;
                                const isDateGroupStart = !isSameDateAsPrevious;
                                const dateBoundaryTopClass =
                                    isDateGroupStart && index > 0
                                        ? "border-t-2 border-t-gray-800"
                                        : "";
                                const dateHeaderRedClass =
                                    !isSameDateAsPrevious &&
                                    isChargeHighlightDate(entry.dateFrom)
                                        ? "font-semibold text-red-600"
                                        : "";
                                const descriptionText = [
                                    entry.details?.trim(),
                                    entry.note?.trim(),
                                ]
                                    .filter(Boolean)
                                    .join("\n");
                                const workChargeBracketBadge =
                                    getWorkChargeBracketBadgeLabel(
                                        entry,
                                        entries,
                                        index
                                    );
                                const descriptionBadges = getTravelDescriptionBadges(
                                    entry,
                                    travelChargeContextEntries,
                                    zeroBillingTravelIds
                                );
                                const travelEditorData = getTravelOverrideEditorData(
                                    entry,
                                    travelChargeContextEntries,
                                    zeroBillingTravelIds
                                );
                                const editorKey = `${title}:${entry.id}`;
                                const isEditorOpen = expandedEditorKey === editorKey;
                                const isEditorRowVisible =
                                    isEditorOpen || editorClosingKey === editorKey;
                                const rowPink = datesMissingSkilledFitterRemark.has(
                                    entry.dateFrom
                                );
                                const remarkShellKey =
                                    entry.persons
                                        ?.map((person) =>
                                            getSourceTableRemarkEditorKey(
                                                entry.id,
                                                person
                                            )
                                        )
                                        .find(
                                            (k) =>
                                                expandedRemarkKey === k ||
                                                remarkClosingKey === k
                                        ) ?? null;
                                const selectedRemarkPerson =
                                    entry.persons?.find(
                                        (person) =>
                                            remarkShellKey ===
                                            getSourceTableRemarkEditorKey(
                                                entry.id,
                                                person
                                            )
                                    ) ?? null;
                                const isRemarkEditorRowVisible =
                                    remarkShellKey !== null;

                                const duplicatedStripeStyle = entry.clientDuplicated
                                    ? {
                                          backgroundImage:
                                              DUPLICATED_ENTRY_ROW_STRIPE_IMAGE,
                                      }
                                    : undefined;

                                return (
                                    <Fragment key={`${title}-${entry.id}-${index}`}>
                                        <tr
                                            className={`align-top ${
                                                rowPink
                                                    ? "bg-pink-50"
                                                    : highlightedEntryIds.has(entry.id)
                                                      ? "bg-blue-50"
                                                      : "bg-white"
                                            }`}
                                            style={duplicatedStripeStyle}
                                        >
                                            <td
                                                className={`border-b border-r border-gray-200 px-3 py-2 text-center ${dateBoundaryTopClass} ${dateHeaderRedClass}`}
                                            >
                                                {isSameDateAsPrevious ? "" : Number(month)}
                                            </td>
                                            <td
                                                className={`border-b border-r border-gray-200 px-3 py-2 text-center ${dateBoundaryTopClass} ${dateHeaderRedClass}`}
                                            >
                                                {isSameDateAsPrevious ? "" : Number(dayOfMonth)}
                                            </td>
                                            <td
                                                className={`border-b border-r border-gray-200 px-3 py-2 text-center ${dateBoundaryTopClass} ${dateHeaderRedClass}`}
                                            >
                                                {isSameDateAsPrevious
                                                    ? ""
                                                    : getWeekdayLabel(entry.dateFrom)}
                                            </td>
                                            <td
                                                className={`border-b border-r border-gray-200 px-3 py-2 text-center whitespace-nowrap ${dateBoundaryTopClass}`}
                                            >
                                                <DescTypeBadge
                                                    value={entry.descType}
                                                    emphasizeChangedText={
                                                        descTypeChanged
                                                    }
                                                />
                                            </td>
                                            <td
                                                className={`border-b border-r border-gray-200 px-3 py-2 text-center whitespace-nowrap ${dateBoundaryTopClass}`}
                                            >
                                                <span
                                                    className={
                                                        fromChanged
                                                            ? fieldEditedClass
                                                            : undefined
                                                    }
                                                >
                                                    {formatTimeToMinutes(
                                                        entry.timeFrom
                                                    )}
                                                </span>
                                            </td>
                                            <td
                                                className={`border-b border-r border-gray-200 px-3 py-2 text-center whitespace-nowrap ${dateBoundaryTopClass}`}
                                            >
                                                <span
                                                    className={
                                                        toChanged
                                                            ? fieldEditedClass
                                                            : undefined
                                                    }
                                                >
                                                    {formatTimeToMinutes(entry.timeTo)}
                                                </span>
                                            </td>
                                            <td
                                                className={`border-b border-r border-gray-200 px-3 py-2 text-center whitespace-nowrap ${dateBoundaryTopClass}`}
                                            >
                                                <span
                                                    className={
                                                        durationChanged
                                                            ? fieldEditedClass
                                                            : undefined
                                                    }
                                                >
                                                    {durationLabel || "-"}
                                                </span>
                                            </td>
                                            <td
                                                className={`relative border-b border-r border-gray-200 px-3 py-2 text-center whitespace-pre-line ${
                                                    isChargeHighlightDate(entry.dateFrom)
                                                        ? "font-semibold text-red-600"
                                                        : ""
                                                } ${dateBoundaryTopClass}`}
                                            >
                                                {workChargeBracketBadge ? (
                                                    <span
                                                        className="pointer-events-none absolute right-0.5 top-0 z-[1] -translate-y-1 rounded bg-amber-500 px-0.5 py-px text-[9px] font-bold leading-none text-white shadow-sm"
                                                        aria-hidden="true"
                                                    >
                                                        {workChargeBracketBadge}
                                                    </span>
                                                ) : null}
                                                <span
                                                    className={
                                                        chargeChanged
                                                            ? `${fieldEditedClass} whitespace-pre-line inline-block`
                                                            : "whitespace-pre-line inline-block"
                                                    }
                                                >
                                                    {correctionLabel}
                                                </span>
                                            </td>
                                            <td
                                                className={`border-b border-r border-gray-200 px-3 py-2 text-gray-900 ${dateBoundaryTopClass}`}
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0 flex-1 whitespace-pre-wrap break-words">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            {descriptionText || "-"}
                                                        </div>
                                                    </div>
                                                    {descriptionBadges.length > 0 ? (
                                                        <div className="flex shrink-0 flex-col items-end gap-1">
                                                            {descriptionBadges.map((badge) => (
                                                                <TravelDescriptionBadge
                                                                    key={badge.label}
                                                                    label={badge.label}
                                                                    emphasizeChangedText={
                                                                        badge.isChanged
                                                                    }
                                                                    isActive={
                                                                        isEditorOpen &&
                                                                        travelEditorData?.direction ===
                                                                            badge.direction
                                                                    }
                                                                    onClick={() =>
                                                                        isEditorOpen
                                                                            ? closeEditor()
                                                                            : openEditor(
                                                                                  editorKey
                                                                              )
                                                                    }
                                                                />
                                                            ))}
                                                        </div>
                                                    ) : null}
                                                </div>
                                            </td>
                                            <td
                                                className={`border-b border-gray-200 px-3 py-2 whitespace-pre-wrap break-keep leading-5 text-gray-700 ${dateBoundaryTopClass}`}
                                            >
                                                {renderRemarkPersonsInteractive(
                                                    entry
                                                )}
                                            </td>
                                        </tr>
                                        {travelEditorData && isEditorRowVisible ? (
                                            <tr
                                                className={
                                                    rowPink
                                                        ? "bg-pink-50"
                                                        : "bg-slate-50/60"
                                                }
                                                style={duplicatedStripeStyle}
                                            >
                                                <td
                                                    colSpan={10}
                                                    className="overflow-hidden border-b border-gray-200 px-3 py-0"
                                                >
                                                    <TravelOverrideEditorAnimatedShell
                                                        editorKey={editorKey}
                                                        isExpanded={isEditorOpen}
                                                        isClosing={
                                                            editorClosingKey === editorKey
                                                        }
                                                    >
                                                        <div className="overflow-hidden">
                                                            <div className="mb-3 flex items-center justify-end gap-2">
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        onTravelChargeOverrideResetEntry(
                                                                            entry.id
                                                                        )
                                                                    }
                                                                    className="rounded-full px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100"
                                                                >
                                                                    기본값
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={closeEditor}
                                                                    className="rounded-full px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100"
                                                                >
                                                                    닫기
                                                                </button>
                                                            </div>
                                                            <div className="grid gap-3 md:grid-cols-2">
                                                                {renderTravelOverrideBox(
                                                                    entry,
                                                                    travelEditorData.homeLabel,
                                                                    travelEditorData.homePeople,
                                                                    "lodging",
                                                                    "home"
                                                                )}
                                                                {renderTravelOverrideBox(
                                                                    entry,
                                                                    travelEditorData.lodgingLabel,
                                                                    travelEditorData.lodgingPeople,
                                                                    "home",
                                                                    "lodging"
                                                                )}
                                                            </div>
                                                        </div>
                                                    </TravelOverrideEditorAnimatedShell>
                                                </td>
                                            </tr>
                                        ) : null}
                                        {isRemarkEditorRowVisible ? (
                                            <tr
                                                className={
                                                    rowPink
                                                        ? "bg-pink-50"
                                                        : "bg-slate-50/60"
                                                }
                                                style={duplicatedStripeStyle}
                                            >
                                                <td
                                                    colSpan={10}
                                                    className="overflow-hidden border-b border-gray-200 px-3 py-0"
                                                >
                                                    <div
                                                        data-remark-editor="true"
                                                        className="w-full"
                                                    >
                                                        <TravelOverrideEditorAnimatedShell
                                                            editorKey={
                                                                remarkShellKey
                                                            }
                                                            isExpanded={
                                                                expandedRemarkKey ===
                                                                remarkShellKey
                                                            }
                                                            isClosing={
                                                                remarkClosingKey ===
                                                                remarkShellKey
                                                            }
                                                        >
                                                            <div className="px-1 pt-1">
                                                                <div
                                                                    className={`mb-3 flex items-center gap-2 ${
                                                                        selectedRemarkPerson
                                                                            ? "justify-between"
                                                                            : "justify-end"
                                                                    }`}
                                                                >
                                                                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
                                                                        {selectedRemarkPerson ? (
                                                                            <>
                                                                                {onReplaceTimesheetEntryPerson ? (
                                                                                    <button
                                                                                        type="button"
                                                                                        className="max-w-full truncate text-left text-sm font-semibold text-gray-900 underline decoration-dotted decoration-gray-400 underline-offset-2 hover:text-blue-800"
                                                                                        onClick={(
                                                                                            e
                                                                                        ) => {
                                                                                            e.stopPropagation();
                                                                                            setRemarkPersonReplacePickerKey(
                                                                                                (k) =>
                                                                                                    k ===
                                                                                                    remarkShellKey
                                                                                                        ? null
                                                                                                        : remarkShellKey
                                                                                            );
                                                                                        }}
                                                                                    >
                                                                                        {
                                                                                            selectedRemarkPerson
                                                                                        }
                                                                                    </button>
                                                                                ) : (
                                                                                    <div className="max-w-full truncate text-sm font-semibold text-gray-900">
                                                                                        {
                                                                                            selectedRemarkPerson
                                                                                        }
                                                                                    </div>
                                                                                )}
                                                                                {remarkPersonReplacePickerKey ===
                                                                                    remarkShellKey &&
                                                                                onReplaceTimesheetEntryPerson ? (
                                                                                    (() => {
                                                                                        const replacePerson =
                                                                                            onReplaceTimesheetEntryPerson;
                                                                                        const entryPersonsForReplace =
                                                                                            entry.persons ??
                                                                                            [];
                                                                                        const originalsForReplace =
                                                                                            getOriginalTimesheetEntryPersons?.(
                                                                                                entry.id
                                                                                            ) ?? [];
                                                                                        const selectedSlotIndex =
                                                                                            entryPersonsForReplace.findIndex(
                                                                                                (
                                                                                                    p
                                                                                                ) =>
                                                                                                    p ===
                                                                                                    selectedRemarkPerson
                                                                                            );
                                                                                        const originalPersonForReplacePicker =
                                                                                            selectedSlotIndex >=
                                                                                            0
                                                                                                ? originalsForReplace[
                                                                                                      selectedSlotIndex
                                                                                                  ] ??
                                                                                                  null
                                                                                                : null;
                                                                                        const replaceCandidates =
                                                                                            getRemarkReplaceCandidates(
                                                                                                {
                                                                                                    invoiceTimesheetPeople,
                                                                                                    entryPersons:
                                                                                                        entryPersonsForReplace,
                                                                                                    selectedRemarkPerson,
                                                                                                    originalEntryPersons:
                                                                                                        originalsForReplace,
                                                                                                    blockedPersons:
                                                                                                        getConcurrentEntryPersons(
                                                                                                            entriesData,
                                                                                                            entry
                                                                                                        ),
                                                                                                }
                                                                                            );
                                                                                        return replaceCandidates.length >
                                                                                            0 ? (
                                                                                            <div className="flex max-w-full flex-wrap items-center gap-1 border-l border-gray-300 pl-2">
                                                                                                {replaceCandidates.map(
                                                                                                    (name: string) => {
                                                                                                        const isOriginalSlotButton =
                                                                                                            originalPersonForReplacePicker !=
                                                                                                                null &&
                                                                                                            name ===
                                                                                                                originalPersonForReplacePicker;
                                                                                                        return (
                                                                                                        <button
                                                                                                            key={
                                                                                                                name
                                                                                                            }
                                                                                                            type="button"
                                                                                                            className={
                                                                                                                isOriginalSlotButton
                                                                                                                    ? "shrink-0 rounded-full border border-green-600 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-900 shadow-sm hover:bg-green-100"
                                                                                                                    : "shrink-0 rounded-full border border-gray-200 bg-white px-2 py-0.5 text-xs font-medium text-gray-800 shadow-sm hover:bg-gray-50"
                                                                                                            }
                                                                                                            onClick={(
                                                                                                                e
                                                                                                            ) => {
                                                                                                                e.stopPropagation();
                                                                                                                if (
                                                                                                                    !selectedRemarkPerson
                                                                                                                ) {
                                                                                                                    return;
                                                                                                                }
                                                                                                                patchDisplayDataEntryPersons(
                                                                                                                    entry.id,
                                                                                                                    selectedRemarkPerson,
                                                                                                                    name
                                                                                                                );
                                                                                                                replacePerson(
                                                                                                                    {
                                                                                                                        entryId:
                                                                                                                            entry.id,
                                                                                                                        fromPerson:
                                                                                                                            selectedRemarkPerson,
                                                                                                                        toPerson:
                                                                                                                            name,
                                                                                                                    }
                                                                                                                );
                                                                                                                openRemarkEditor(
                                                                                                                    getSourceTableRemarkEditorKey(
                                                                                                                        entry.id,
                                                                                                                        name
                                                                                                                    )
                                                                                                                );
                                                                                                                setRemarkPersonReplacePickerKey(
                                                                                                                    null
                                                                                                                );
                                                                                                            }}
                                                                                                        >
                                                                                                            {name}
                                                                                                        </button>
                                                                                                        );
                                                                                                    }
                                                                                                )}
                                                                                            </div>
                                                                                        ) : (
                                                                                            <span className="text-xs text-gray-500">
                                                                                                교체 가능한 인원이
                                                                                                없습니다.
                                                                                            </span>
                                                                                        );
                                                                                    })()
                                                                                ) : null}
                                                                            </>
                                                                        ) : null}
                                                                    </div>
                                                                    <button
                                                                        type="button"
                                                                        onClick={
                                                                            closeRemarkEditor
                                                                        }
                                                                        className="shrink-0 rounded-full px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100"
                                                                    >
                                                                        닫기
                                                                    </button>
                                                                </div>
                                                                {selectedRemarkPerson ? (
                                                                    <div className="pb-3">
                                                                        {renderRemarkPersonHistory(
                                                                            entry,
                                                                            selectedRemarkPerson
                                                                        )}
                                                                    </div>
                                                                ) : null}
                                                            </div>
                                                        </TravelOverrideEditorAnimatedShell>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : null}
                                    </Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
        );
    };

    const getWeekdayLabel = (dateText: string) => {
        const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
        const date = new Date(`${dateText}T00:00:00`);
        return Number.isNaN(date.getTime()) ? "-" : weekdays[date.getDay()];
    };

    const getDurationLabel = (
        startDate: string,
        startTime: string,
        endDate: string,
        endTime: string
    ) => {
        const durationHours = getDurationHours(startDate, startTime, endDate, endTime);
        return durationHours === null ? "" : formatHoursLabel(durationHours);
    };

    const getDurationHours = (
        startDate: string,
        startTime: string,
        endDate: string,
        endTime: string
    ) => {
        if (!startDate || !endDate || !startTime || !endTime) {
            return null;
        }

        const start = new Date(`${startDate}T${startTime}`);
        const end =
            endTime === "24:00"
                ? new Date(new Date(`${endDate}T00:00:00`).getTime() + 24 * 60 * 60 * 1000)
                : new Date(`${endDate}T${endTime}`);

        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
            return null;
        }

        return Math.round(((end.getTime() - start.getTime()) / (1000 * 60 * 60)) * 10) / 10;
    };

    const formatHoursLabel = (value: number) => {
        return Number.isInteger(value) ? String(value) : String(value);
    };

    const getOverlapMinutes = (
        rangeStart: Date,
        rangeEnd: Date,
        targetStart: Date,
        targetEnd: Date
    ) => {
        const overlapStart = new Date(
            Math.max(rangeStart.getTime(), targetStart.getTime())
        );
        const overlapEnd = new Date(
            Math.min(rangeEnd.getTime(), targetEnd.getTime())
        );

        if (overlapEnd <= overlapStart) {
            return 0;
        }

        return Math.floor((overlapEnd.getTime() - overlapStart.getTime()) / 60000);
    };

    const getWorkingCorrectionLabel = (
        entry: TimesheetRowDetailSidePanelProps["sourceEntries"][number]
    ) => {
        if (!entry.dateFrom || !entry.dateTo || !entry.timeFrom || !entry.timeTo) {
            return "-";
        }

        const start = new Date(`${entry.dateFrom}T${entry.timeFrom}`);
        const end =
            entry.timeTo === "24:00"
                ? new Date(
                      new Date(`${entry.dateTo}T00:00:00`).getTime() +
                          24 * 60 * 60 * 1000
                  )
                : new Date(`${entry.dateTo}T${entry.timeTo}`);

        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
            return "-";
        }

        const totalMinutes = Math.floor((end.getTime() - start.getTime()) / 60000);
        const normalStart = new Date(`${entry.dateFrom}T08:00:00`);
        const normalEnd = new Date(`${entry.dateFrom}T17:00:00`);
        const lunchStart = new Date(`${entry.dateFrom}T12:00:00`);
        const lunchEnd = new Date(`${entry.dateFrom}T13:00:00`);

        const rawNormalMinutes = getOverlapMinutes(
            start,
            end,
            normalStart,
            normalEnd
        );
        let normalMinutes = rawNormalMinutes;

        const shouldDeductLunch =
            entry.descType === "대기" ||
            (entry.descType === "작업" && !entry.lunchWorked);

        if (shouldDeductLunch) {
            normalMinutes -= getOverlapMinutes(start, end, lunchStart, lunchEnd);
        }

        normalMinutes = Math.max(0, normalMinutes);
        const afterMinutes = Math.max(0, totalMinutes - rawNormalMinutes);

        if (entry.descType === "대기") {
            const waitingMinutes = normalMinutes + afterMinutes;
            return waitingMinutes > 0
                ? `W=${formatHoursLabel(waitingMinutes / 60)}`
                : "-";
        }

        const labels = [
            normalMinutes > 0 ? `N=${formatHoursLabel(normalMinutes / 60)}` : "",
            afterMinutes > 0 ? `A=${formatHoursLabel(afterMinutes / 60)}` : "",
        ].filter(Boolean);

        return labels.length > 0 ? labels.join("\n") : "-";
    };

    const getHomeTravelHours = (location?: string | null) => {
        const primaryLocation = location?.split(",")[0].trim() ?? "";

        if (
            primaryLocation === "HD중공업(해양)" ||
            primaryLocation === "HD미포" ||
            primaryLocation === "HHI" ||
            primaryLocation === "HMD"
        ) {
            return 2;
        }

        if (primaryLocation === "HD삼호" || primaryLocation === "HSHI") {
            return 4;
        }

        if (["PNC", "PNIT", "HPNT", "BNCT", "HJNC"].includes(primaryLocation)) {
            return 1;
        }

        return null;
    };

    type PanelEntry = TimesheetRowDetailSidePanelProps["sourceEntries"][number];
    type PersonBlock = {
        anchorEntries: PanelEntry[];
        beforeTravelEntries: PanelEntry[];
        afterTravelEntries: PanelEntry[];
    };

    const roundHours = (value: number) => Math.round(value * 10) / 10;

    const getWorkChargeBracketBadgeLabel = (
        entry: PanelEntry,
        allEntries: PanelEntry[],
        entryIndex: number,
        opts?: { manualBillableHours?: number }
    ): "4▼" | "8▼" | null => {
        if (entry.descType !== "작업") {
            return null;
        }
        const cluster = buildConsecutiveWorkClusterIndices(
            allEntries as WorkEntryClusterable[],
            entryIndex
        );
        const hours = sumClusterWorkBillableHours(cluster, (i) => {
            const e = allEntries[i];
            if (e.descType !== "작업") {
                return null;
            }
            let manual: number | undefined;
            if (
                opts &&
                Object.prototype.hasOwnProperty.call(opts, "manualBillableHours") &&
                i === entryIndex
            ) {
                manual = opts.manualBillableHours;
            } else {
                manual = manualBillableHoursByEntryId[e.id];
            }
            if (manual !== undefined) {
                return roundHours(manual);
            }
            return getWorkEntryAutoBillableTotalHours(e);
        });
        if (hours === null || hours <= 0) {
            return null;
        }
        if (hours < 4) {
            return "4▼";
        }
        /** 인보이스 타임시트 분할 합계와 동일: 4 ≤ h < 8 → 8▼ (정확히 4h도 포함) */
        if (hours >= 4 && hours < 8) {
            return "8▼";
        }
        return null;
    };

    const hasHomeInTravel = (entry: PanelEntry): boolean => {
        const details = entry.details ?? "";
        return (
            details.includes("자택") ||
            entry.moveFrom === "자택" ||
            entry.moveTo === "자택"
        );
    };

    const calculateRawTravelHours = (entry: PanelEntry): number => {
        if (
            entry.descType !== "이동" ||
            !entry.dateFrom ||
            !entry.dateTo ||
            !entry.timeFrom ||
            !entry.timeTo
        ) {
            return 0;
        }

        const start = new Date(`${entry.dateFrom}T${entry.timeFrom}`);
        const end =
            entry.timeTo === "24:00"
                ? new Date(
                      new Date(`${entry.dateTo}T00:00:00`).getTime() +
                          24 * 60 * 60 * 1000
                  )
                : new Date(`${entry.dateTo}T${entry.timeTo}`);

        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
            return 0;
        }

        return Math.floor((end.getTime() - start.getTime()) / 60000) / 60;
    };

    const getPrimaryLocation = (location?: string | null) =>
        normalizeLocationName(location?.split(",")[0].trim() ?? "");

    const inferWorkPlaceFromTravelSegments = (
        beforeTravelEntries: PanelEntry[],
        afterTravelEntries: PanelEntry[]
    ) => {
        const lastBeforeTravelEntry =
            beforeTravelEntries[beforeTravelEntries.length - 1];
        const leadingDestination = lastBeforeTravelEntry
            ? normalizeLocationName(getFinalDestination(lastBeforeTravelEntry))
            : "";

        if (leadingDestination && leadingDestination !== "자택") {
            return leadingDestination;
        }

        const firstAfterTravelEntry = afterTravelEntries[0];
        const trailingOrigin = firstAfterTravelEntry
            ? normalizeLocationName(getTravelEntryOrigin(firstAfterTravelEntry))
            : "";

        if (trailingOrigin && trailingOrigin !== "자택") {
            return trailingOrigin;
        }

        return "";
    };

    const doesWorkContextMatchBlockLocation = (
        person: string,
        beforeTravelEntries: PanelEntry[],
        afterTravelEntries: PanelEntry[],
        workLocations: Record<string, string[]>
    ) => {
        const blockWorkPlace = inferWorkPlaceFromTravelSegments(
            beforeTravelEntries,
            afterTravelEntries
        );
        if (!blockWorkPlace) {
            return false;
        }

        return (workLocations[person] ?? []).includes(blockWorkPlace);
    };

    const isDestinationWorkPlace = (entry: PanelEntry): boolean => {
        const destination = normalizeLocationName(getFinalDestination(entry));
        const workPlace = getPrimaryLocation(entry.location);

        if (!destination || !workPlace) {
            return false;
        }

        return destination === workPlace;
    };

    const summarizeTravelEntries = (
        entries: PanelEntry[],
        useFixedHomeHours: boolean
    ) => {
        if (entries.length === 0) {
            return {
                kind: "none",
                hours: 0,
            };
        }

        const lastEntry = entries[entries.length - 1];
        const fixedHours = getHomeTravelHours(lastEntry.location) ?? 0;
        const hasHome = entries.some((entry) => hasHomeInTravel(entry));

        if (useFixedHomeHours && hasHome && fixedHours > 0) {
            return {
                kind: "home",
                hours: fixedHours,
            };
        }

        return {
            kind: "travel",
            hours: roundHours(
                entries.reduce((sum, entry) => sum + calculateRawTravelHours(entry), 0)
            ),
        };
    };

    const splitTravelEntriesByGap = (
        travelEntries: PanelEntry[],
        minimumGapHours: number
    ) => {
        if (travelEntries.length <= 1) {
            return travelEntries.length === 0 ? [] : [travelEntries];
        }

        const sortedEntries = sortEntriesByStart(travelEntries);
        const minimumGapMs = minimumGapHours * 60 * 60 * 1000;
        const groups: PanelEntry[][] = [];
        let currentGroup: PanelEntry[] = [];

        sortedEntries.forEach((entry, index) => {
            if (index === 0) {
                currentGroup = [entry];
                return;
            }

            const previousEntry = sortedEntries[index - 1];
            const previousEnd =
                previousEntry.dateTo && previousEntry.timeTo
                    ? new Date(`${previousEntry.dateTo}T${previousEntry.timeTo}`).getTime()
                    : null;
            const currentStart =
                entry.dateFrom && entry.timeFrom
                    ? new Date(`${entry.dateFrom}T${entry.timeFrom}`).getTime()
                    : null;
            const shouldSplit =
                previousEnd !== null &&
                currentStart !== null &&
                currentStart - previousEnd >= minimumGapMs;

            if (shouldSplit) {
                groups.push(currentGroup);
                currentGroup = [entry];
                return;
            }

            currentGroup.push(entry);
        });

        if (currentGroup.length > 0) {
            groups.push(currentGroup);
        }

        return groups;
    };

    const getBlockSpanForEntries = (entries: PanelEntry[]) => {
        const earliest =
            entries
                .map((entry) => entry.timeFrom)
                .filter((value): value is string => Boolean(value))
                .sort()[0] ?? "00:00";
        const latest =
            entries
                .map((entry) => entry.timeTo)
                .filter((value): value is string => Boolean(value))
                .sort();

        return {
            earliest,
            latest: latest.length > 0 ? latest[latest.length - 1] : earliest,
        };
    };

    const getPersonBlocks = (
        person: string,
        entries: PanelEntry[]
    ): PersonBlock[] => {
        const personEntries = sortEntriesByStart(
            entries.filter((entry) => (entry.persons ?? []).includes(person))
        );
        const blocks: PersonBlock[] = [];

        let currentBlock: PersonBlock | null = null;
        let interBlockTravelEntries: PanelEntry[] = [];

        personEntries.forEach((entry) => {
            if (entry.descType === "이동") {
                interBlockTravelEntries.push(entry);
                return;
            }

            if (currentBlock && interBlockTravelEntries.length === 0) {
                currentBlock.anchorEntries.push(entry);
                return;
            }

            if (!currentBlock) {
                currentBlock = {
                    anchorEntries: [entry],
                    beforeTravelEntries: interBlockTravelEntries.slice(),
                    afterTravelEntries: [],
                };
                interBlockTravelEntries = [];
                return;
            }

            const beforeTravelEntriesForNext = interBlockTravelEntries.filter(
                (travelEntry) => isDestinationWorkPlace(travelEntry)
            );
            const currentAfterTravelEntries = interBlockTravelEntries.filter(
                (travelEntry) => !isDestinationWorkPlace(travelEntry)
            );

            currentBlock.afterTravelEntries = currentAfterTravelEntries;
            blocks.push(currentBlock);

            currentBlock = {
                anchorEntries: [entry],
                beforeTravelEntries: beforeTravelEntriesForNext,
                afterTravelEntries: [],
            };
            interBlockTravelEntries = [];
        });

        if (currentBlock) {
            const finalizedBlock = currentBlock as PersonBlock;
            blocks.push({
                anchorEntries: finalizedBlock.anchorEntries,
                beforeTravelEntries: finalizedBlock.beforeTravelEntries,
                afterTravelEntries: interBlockTravelEntries.slice(),
            });
        }

        return blocks;
    };

    const getBeforeTravelSummary = (
        person: string,
        blockIndex: number,
        beforeTravelEntries: PanelEntry[],
        afterTravelEntries: PanelEntry[]
    ) => {
        if (beforeTravelEntries.length === 0) {
            return { kind: "none", hours: 0 };
        }

        if (blockIndex === 0) {
            if (
                !doesWorkContextMatchBlockLocation(
                    person,
                    beforeTravelEntries,
                    afterTravelEntries,
                    previousWorkLocations
                )
            ) {
                const fixedHours =
                    getHomeTravelHours(beforeTravelEntries[0].location) ?? 0;
                const hasHome = beforeTravelEntries.some((entry) => hasHomeInTravel(entry));

                if (hasHome && fixedHours > 0) {
                    return { kind: "initial-home", hours: fixedHours };
                }

                return summarizeTravelEntries(beforeTravelEntries, false);
            }

            return { kind: "continued", hours: 1 };
        }

        return summarizeTravelEntries(beforeTravelEntries, true);
    };

    const getAfterTravelSummary = (
        person: string,
        blockIndex: number,
        totalBlocks: number,
        beforeTravelEntries: PanelEntry[],
        afterTravelEntries: PanelEntry[]
    ) => {
        if (afterTravelEntries.length === 0) {
            return { kind: "none", hours: 0 };
        }

        if (blockIndex < totalBlocks - 1) {
            return summarizeTravelEntries(afterTravelEntries, true);
        }

        if (
            doesWorkContextMatchBlockLocation(
                person,
                beforeTravelEntries,
                afterTravelEntries,
                nextWorkLocations
            )
        ) {
            return { kind: "continued", hours: 1 };
        }

        return summarizeTravelEntries(afterTravelEntries, true);
    };

    const getTravelChargeResultForPerson = (
        entry: PanelEntry,
        person: string,
        contextEntries: PanelEntry[],
        zeroBillingTravelIds: Set<number>,
        opts?: { ignoreOverride?: boolean }
    ): { hours: number | null; kind: string } => {
        const override = opts?.ignoreOverride
            ? null
            : travelChargeOverrides[getTravelChargeOverrideKey(entry.id, person)] ??
              null;
        const fixedHours = getHomeTravelHours(entry.location) ?? 0;

        if (override?.target === "lodging") {
            return { hours: 1, kind: "continued" };
        }

        if (override?.target === "home" && fixedHours > 0) {
            return { hours: fixedHours, kind: "home" };
        }

        const blocks = getPersonBlocks(person, contextEntries);
        const factory = normalizeLocationName(GANGDONG_FACTORY);

        if (blocks.length === 0) {
            const personEntries = sortEntriesByStart(
                contextEntries.filter((candidate) =>
                    (candidate.persons ?? []).includes(person)
                )
            );

            if (!personEntries.some((candidate) => candidate.id === entry.id)) {
                return { hours: null, kind: "none" };
            }

            if (zeroBillingTravelIds.has(entry.id)) {
                return { hours: 0, kind: "zero-billing" };
            }

            return summarizeTravelEntries(
                personEntries.filter((candidate) => candidate.descType === "이동"),
                true
            );
        }

        for (let blockIndex = 0; blockIndex < blocks.length; blockIndex += 1) {
            const block = blocks[blockIndex];
            const afterTravelGroups =
                blockIndex === blocks.length - 1
                    ? splitTravelEntriesByGap(block.afterTravelEntries, 2)
                    : [block.afterTravelEntries];
            const effectiveAfterTravelEntries = afterTravelGroups[0] ?? [];
            const detachedAfterTravelGroup = afterTravelGroups
                .slice(1)
                .find((group) => group.some((candidate) => candidate.id === entry.id));

            if (detachedAfterTravelGroup) {
                return summarizeTravelEntries(detachedAfterTravelGroup, true);
            }

            const blockSpan = getBlockSpanForEntries(block.anchorEntries);
            const beforeTravel = getBeforeTravelSummary(
                person,
                blockIndex,
                block.beforeTravelEntries,
                effectiveAfterTravelEntries
            );
            const afterTravel = getAfterTravelSummary(
                person,
                blockIndex,
                blocks.length,
                block.beforeTravelEntries,
                effectiveAfterTravelEntries
            );
            const lastBeforeTravelEntry =
                block.beforeTravelEntries[block.beforeTravelEntries.length - 1];
            const firstAfterTravelEntry = effectiveAfterTravelEntries[0];
            const factoryWrapsBlock =
                lastBeforeTravelEntry &&
                firstAfterTravelEntry &&
                normalizeLocationName(
                    getFinalDestination(lastBeforeTravelEntry)
                ) === factory &&
                normalizeLocationName(
                    getTravelEntryOrigin(firstAfterTravelEntry)
                ) === factory;

            if (block.beforeTravelEntries.some((candidate) => candidate.id === entry.id)) {
                return zeroBillingTravelIds.has(entry.id) || factoryWrapsBlock
                    ? { hours: 0, kind: "zero-billing" }
                    : {
                          hours: beforeTravel.hours,
                          kind: beforeTravel.kind,
                      };
            }

            if (
                effectiveAfterTravelEntries.some((candidate) => candidate.id === entry.id)
            ) {
                return zeroBillingTravelIds.has(entry.id) || factoryWrapsBlock
                    ? { hours: 0, kind: "zero-billing" }
                    : {
                          hours: afterTravel.hours,
                          kind: afterTravel.kind,
                      };
            }

            if (
                block.anchorEntries.some((candidate) => candidate.id === entry.id) &&
                blockSpan.earliest
            ) {
                return { hours: null, kind: "none" };
            }
        }

        return { hours: null, kind: "none" };
    };

    const getCorrectionLabel = (
        entry: PanelEntry,
        contextEntries: PanelEntry[],
        zeroBillingTravelIds: Set<number>,
        ignoreEntryManual = false,
        opts?: { manualBillableHours?: number; ignoreTravelOverrides?: boolean }
    ) => {
        const rawTravelHours = roundHours(calculateRawTravelHours(entry));
        const durationLabel = getDurationLabel(
            entry.dateFrom,
            entry.timeFrom,
            entry.dateTo,
            entry.timeTo
        );

        if (!ignoreEntryManual) {
            const manual =
                opts && Object.prototype.hasOwnProperty.call(opts, "manualBillableHours")
                    ? opts.manualBillableHours
                    : manualBillableHoursByEntryId[entry.id];
            if (manual !== undefined) {
                if (entry.descType === "대기") {
                    return `W=${formatHoursLabel(manual)}`;
                }
                if (entry.descType === "작업" || entry.descType === "이동") {
                    return formatHoursLabel(manual);
                }
            }
        }

        if (entry.descType === "작업" || entry.descType === "대기") {
            return getWorkingCorrectionLabel(entry);
        }

        if (entry.descType !== "이동") {
            return durationLabel || "-";
        }

        const personHours = entry.persons
            .map((person) => {
                const chargeResult = getTravelChargeResultForPerson(
                    entry,
                    person,
                    contextEntries,
                    zeroBillingTravelIds,
                    opts?.ignoreTravelOverrides ? { ignoreOverride: true } : undefined
                );

                if (chargeResult.hours === null) {
                    return null;
                }

                // 상세 패널의 청구시간은 행 단위 값이어야 하므로,
                // 일반 이동(travel)은 이동 묶음 합계 대신 현재 엔트리의 시간만 표시한다.
                return chargeResult.kind === "travel"
                    ? rawTravelHours
                    : chargeResult.hours;
            })
            .filter((value): value is number => value !== null);

        if (personHours.length > 0) {
            const personLabels = Array.from(
                new Set(personHours.map((value) => formatHoursLabel(value)))
            );
            return personLabels.every((label) => label === personLabels[0])
                ? personLabels[0]
                : personLabels.join(",");
        }

        if (zeroBillingTravelIds.has(entry.id)) {
            return formatHoursLabel(0);
        }

        const fixedHours = getHomeTravelHours(entry.location);
        if (!fixedHours) {
            return durationLabel || "-";
        }

        const details = entry.details ?? "";
        const containsHome =
            details.includes("자택") ||
            entry.moveFrom === "자택" ||
            entry.moveTo === "자택";

        if (!containsHome) {
            return durationLabel || "-";
        }

        return formatHoursLabel(fixedHours);
    };

    const getTravelDescriptionBadges = (
        entry: PanelEntry,
        contextEntries: PanelEntry[],
        zeroBillingTravelIds: Set<number>
    ): TravelDescriptionBadgeData[] => {
        if (entry.descType !== "이동") {
            return [];
        }

        const details = entry.details ?? "";
        const containsLodging = details.includes("숙소");
        const containsHome =
            details.includes("자택") ||
            entry.moveFrom === "자택" ||
            entry.moveTo === "자택";
        const travelOrigin = normalizeLocationName(getTravelEntryOrigin(entry));
        const travelDestination = normalizeLocationName(getFinalDestination(entry));
        const direction: TravelBadgeDirection | null =
            travelDestination === "자택"
                ? "arrival"
                : travelOrigin === "자택"
                  ? "departure"
                  : travelDestination === "숙소"
                    ? "arrival"
                    : travelOrigin === "숙소"
                      ? "departure"
                      : null;

        if (!direction) {
            return [];
        }

        const groupedPeople: Record<TravelChargeOverrideTarget, string[]> = {
            home: [],
            lodging: [],
        };
        const groupedChangedPeople: Record<TravelChargeOverrideTarget, string[]> = {
            home: [],
            lodging: [],
        };
        const resolveBadgeTargetFromChargeResult = (chargeResult: {
            hours: number | null;
            kind: string;
        }): TravelChargeOverrideTarget | null => {
            const isHomeCharge =
                chargeResult.kind === "home" ||
                chargeResult.kind.endsWith("-home");
            return chargeResult.hours === 1 && (containsLodging || containsHome)
                ? "lodging"
                : isHomeCharge
                  ? "home"
                  : null;
        };

        entry.persons.forEach((person) => {
            const chargeResult = getTravelChargeResultForPerson(
                entry,
                person,
                contextEntries,
                zeroBillingTravelIds
            );
            const target = resolveBadgeTargetFromChargeResult(chargeResult);

            if (target) {
                groupedPeople[target].push(person);
                const baselineTarget = resolveBadgeTargetFromChargeResult(
                    getTravelChargeResultForPerson(
                        entry,
                        person,
                        contextEntries,
                        zeroBillingTravelIds,
                        { ignoreOverride: true }
                    )
                );
                if (target !== baselineTarget) {
                    groupedChangedPeople[target].push(person);
                }
            }
        });

        const badgeTargets = (["home", "lodging"] as TravelChargeOverrideTarget[]).filter(
            (target) => groupedPeople[target].length > 0
        );
        const relevantPeopleCount = badgeTargets.reduce(
            (sum, target) => sum + groupedPeople[target].length,
            0
        );
        const shouldShowNames =
            badgeTargets.length > 1 || relevantPeopleCount !== entry.persons.length;

        return badgeTargets.map((target) => {
            const baseLabel = getTravelBadgeLabel(direction, target);
            const people = groupedPeople[target];
            return {
                label: shouldShowNames ? `${baseLabel}(${people.join(", ")})` : baseLabel,
                people,
                target,
                direction,
                isChanged: groupedChangedPeople[target].length > 0,
            };
        });
    };

    const getTravelOverrideEditorData = (
        entry: PanelEntry,
        contextEntries: PanelEntry[],
        zeroBillingTravelIds: Set<number>
    ) => {
        const badges = getTravelDescriptionBadges(
            entry,
            contextEntries,
            zeroBillingTravelIds
        );

        if (badges.length === 0) {
            return null;
        }

        const direction = badges[0].direction;
        return {
            direction,
            homeLabel: getTravelBadgeLabel(direction, "home"),
            lodgingLabel: getTravelBadgeLabel(direction, "lodging"),
            homePeople:
                badges.find((badge) => badge.target === "home")?.people ?? [],
            lodgingPeople:
                badges.find((badge) => badge.target === "lodging")?.people ?? [],
        };
    };

    const formatTimeToMinutes = (value: string) => {
        if (!value) {
            return "-";
        }

        return value.slice(0, 5);
    };

    const renderTravelOverrideBox = (
        entry: PanelEntry,
        label: string,
        people: string[],
        nextTarget: TravelChargeOverrideTarget,
        tone: "home" | "lodging"
    ) => (
        <div
            className={`rounded-xl border p-3 ${
                tone === "home"
                    ? "border-amber-200 bg-amber-50/80"
                    : "border-sky-200 bg-sky-50/80"
            }`}
        >
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-700">
                {label}
            </div>
            <div className="flex min-h-12 flex-wrap gap-2">
                {people.length === 0 ? (
                    <span className="text-xs text-gray-400">인원 없음</span>
                ) : (
                    people.map((person) => (
                        <button
                            key={`${entry.id}-${label}-${person}`}
                            type="button"
                            onClick={() =>
                                onTravelChargeOverrideChange(
                                    entry.id,
                                    person,
                                    nextTarget
                                )
                            }
                            className="rounded-full border border-white/70 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:text-gray-900 hover:shadow"
                        >
                            {person}
                        </button>
                    ))
                )}
            </div>
        </div>
    );

    const shouldShowFullGroupTable = (() => {
        if (displayData.groupSourceEntries.length === 0) {
            return false;
        }

        if (
            displayData.groupSourceEntries.length !== displayData.sourceEntries.length
        ) {
            return true;
        }

        const sourceIds = displayData.sourceEntries
            .map((entry) => entry.id)
            .sort((a, b) => a - b);
        const groupIds = displayData.groupSourceEntries
            .map((entry) => entry.id)
            .sort((a, b) => a - b);

        return sourceIds.some((id, index) => id !== groupIds[index]);
    })();

    useEffect(() => {
        if (!isOpen) {
            setExpandedEditorKey(null);
            setEditorClosingKey(null);
            if (closeEditorTimerRef.current != null) {
                window.clearTimeout(closeEditorTimerRef.current);
                closeEditorTimerRef.current = null;
            }
            dismissRemarkEditorImmediate();
        }
    }, [dismissRemarkEditorImmediate, isOpen]);

    useLayoutEffect(() => {
        if (!isOpen) return;

        const activeEditorKey = expandedRemarkKey ?? expandedEditorKey;
        if (!activeEditorKey) return;

        let rafId = 0;
        const endAt = performance.now() + TRAVEL_OVERRIDE_EDITOR_ANIM_MS + 220;

        const syncScroll = () => {
            ensureExpandedEditorVisible(activeEditorKey);
            if (performance.now() < endAt) {
                rafId = requestAnimationFrame(syncScroll);
            }
        };

        rafId = requestAnimationFrame(syncScroll);
        return () => cancelAnimationFrame(rafId);
    }, [
        ensureExpandedEditorVisible,
        expandedEditorKey,
        expandedRemarkKey,
        isOpen,
    ]);

    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                if (expandedEditorKey) {
                    closeEditor();
                    return;
                }
                if (expandedRemarkKey) {
                    closeRemarkEditor();
                    return;
                }
                onClose();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [
        closeEditor,
        closeRemarkEditor,
        expandedEditorKey,
        expandedRemarkKey,
        isOpen,
        onClose,
    ]);

    useEffect(() => {
        if (!isOpen) return;

        const handlePointerDown = (event: MouseEvent) => {
            const target = event.target as HTMLElement | null;
            if (!target) return;

            if (panelRef.current?.contains(target)) {
                if (
                    expandedRemarkKey &&
                    !target.closest('[data-remark-editor="true"]') &&
                    !target.closest('[data-remark-person="true"]')
                ) {
                    closeRemarkEditor();
                }
                if (
                    expandedEditorKey &&
                    !target.closest('[data-travel-override-editor="true"]') &&
                    !target.closest('[data-travel-override-badge="true"]')
                ) {
                    closeEditor();
                }
                return;
            }

            if (target.closest('[data-timesheet-row-trigger="true"]')) {
                return;
            }

            if (target.closest("[data-base-modal='true']")) {
                return;
            }

            if (target.closest('[data-app-toast="true"]')) {
                return;
            }

            dismissRemarkEditorImmediate();
            setExpandedEditorKey(null);
            setEditorClosingKey(null);
            if (closeEditorTimerRef.current != null) {
                window.clearTimeout(closeEditorTimerRef.current);
                closeEditorTimerRef.current = null;
            }
            onClose();
        };

        document.addEventListener("mousedown", handlePointerDown);
        return () => document.removeEventListener("mousedown", handlePointerDown);
    }, [
        closeEditor,
        closeRemarkEditor,
        dismissRemarkEditorImmediate,
        expandedEditorKey,
        expandedRemarkKey,
        isOpen,
        onClose,
    ]);

    useLayoutEffect(() => {
        if (!isOpen) return;

        setDisplayData({
            sectionTitle,
            selectedPersons,
            day,
            dateFormatted,
            timeFrom,
            timeTo,
            description,
            sourceEntries,
            groupSourceEntries,
            timesheetRowCalendarDate,
        });
    }, [
        isOpen,
        sectionTitle,
        selectedPersons,
        day,
        dateFormatted,
        timeFrom,
        timeTo,
        description,
        sourceEntries,
        groupSourceEntries,
        timesheetRowCalendarDate,
    ]);

    return createPortal(
        <aside
            ref={panelRef}
            className={`fixed inset-y-0 right-0 z-[10000] h-screen w-full sm:w-[560px] lg:w-[min(calc(50vw+24px),960px)] border-l border-gray-200 bg-white shadow-2xl transition-transform duration-300 ease-in-out ${
                isOpen ? "translate-x-0" : "translate-x-full"
            }`}
        >
            <div className="flex h-full flex-col">
                <div className="flex items-center justify-between border-b border-gray-200 px-6 py-3.5">
                    <div>
                        <div className="text-xs font-semibold text-gray-500">
                            {displayData.sectionTitle}
                        </div>
                        <h2 className="mt-1 text-xl font-bold text-gray-900">
                            Timesheet Detail
                        </h2>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-10 w-10 items-center justify-center rounded-full text-gray-700 transition-colors hover:bg-gray-100"
                        aria-label="close"
                    >
                        <CloseIcon />
                    </button>
                </div>

                <div ref={scrollBodyRef} className="flex-1 overflow-y-auto px-6 py-6">
                    <div className="space-y-4 text-sm text-gray-900">
                        <div className="rounded-lg border border-gray-200 p-3">
                            <div className="text-xs font-semibold text-gray-500">
                                Description
                            </div>
                            <div className="mt-1 whitespace-pre-wrap break-words">
                                {displayData.description}
                            </div>
                        </div>

                        {renderSourceEntriesTable(
                            "Actual DB Entries",
                            "인보이스 보정 전 원본 작업일지 데이터",
                            displayData.sourceEntries
                        )}

                        {shouldShowFullGroupTable &&
                            renderSourceEntriesTable(
                                "Actual DB Entries - Full Group",
                                "선택한 날짜의 전체 실제 작업일지 데이터",
                                displayData.groupSourceEntries as TimesheetRowDetailSidePanelProps["sourceEntries"],
                                new Set(
                                    displayData.sourceEntries.map((entry) => entry.id)
                                ),
                                "group"
                            )}

                        {(() => {
                            const scoped = scopeDeletedEntriesForInvoiceRowPanel(
                                deletedEntries,
                                displayData.sourceEntries,
                                displayData.groupSourceEntries,
                                displayData.timesheetRowCalendarDate || undefined
                            );
                            if (scoped.length === 0) {
                                return null;
                            }
                            return (
                                <details className="rounded-xl border border-gray-200 bg-white">
                                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-gray-900 [&::-webkit-details-marker]:hidden">
                                        <span className="flex min-w-0 flex-1 items-center gap-2">
                                            삭제된 엔트리 보기{" "}
                                            <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">
                                                {scoped.length}
                                            </span>
                                        </span>
                                        {onRestoreAllDeletedTimesheetEntriesInScope &&
                                        scoped.length > 0 ? (
                                            <button
                                                type="button"
                                                className="shrink-0 rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-800 transition-colors hover:bg-gray-50"
                                                onClick={(ev) => {
                                                    ev.preventDefault();
                                                    ev.stopPropagation();
                                                    onRestoreAllDeletedTimesheetEntriesInScope(
                                                        scoped.map((x) => x.id)
                                                    );
                                                }}
                                            >
                                                모두 되돌리기
                                            </button>
                                        ) : null}
                                    </summary>
                                    <div className="border-t border-gray-200 px-4 py-3">
                                        <div className="space-y-2">
                                            {scoped.map((e) => (
                                                <div
                                                    key={`deleted-${e.id}`}
                                                    className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
                                                >
                                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                                        <div className="text-xs font-semibold text-gray-900">
                                                            #{e.id} · {e.descType}
                                                        </div>
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <div className="text-xs text-gray-600">
                                                                {e.dateFrom}{" "}
                                                                {e.timeFrom || "--:--"}–
                                                                {e.timeTo || "--:--"}
                                                            </div>
                                                            {onRestoreDeletedTimesheetEntry ? (
                                                                <button
                                                                    type="button"
                                                                    className="shrink-0 rounded-md border border-gray-300 bg-white px-2 py-0.5 text-xs font-medium text-gray-800 transition-colors hover:bg-gray-100"
                                                                    onClick={(ev) => {
                                                                        ev.preventDefault();
                                                                        ev.stopPropagation();
                                                                        onRestoreDeletedTimesheetEntry(
                                                                            e.id
                                                                        );
                                                                    }}
                                                                >
                                                                    되돌리기
                                                                </button>
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                    <div className="mt-1 text-xs text-gray-700">
                                                        {(e.persons ?? []).join(", ") || "인원 없음"}
                                                    </div>
                                                    {e.details ? (
                                                        <div className="mt-1 whitespace-pre-wrap break-words text-xs text-gray-700">
                                                            {e.details}
                                                        </div>
                                                    ) : null}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </details>
                            );
                        })()}
                    </div>
                </div>
            </div>
        </aside>,
        document.body
    );
}
