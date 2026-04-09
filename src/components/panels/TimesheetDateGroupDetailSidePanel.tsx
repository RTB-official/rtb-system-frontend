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

interface TimesheetSourceEntryData {
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
}

interface TimesheetDateGroupDetailSidePanelProps {
    isOpen: boolean;
    onClose: () => void;
    sectionTitle: string;
    /** true면 패널 바깥 클릭으로 닫히지 않음(특정 진입 플로우에서만 사용) */
    disableOutsideClose?: boolean;
    fullGroupEntries: TimesheetSourceEntryData[];
    workLocationsByDate?: Record<string, Record<string, string[]>>;
    /** 인보이스 페이지와 동일한 공휴일 집합(주말은 별도 판별). */
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
    /** Engineer Name and Title에 선택된 스킬드 핏터(비고 연분홍 검사 기준) */
    requiredSkilledFittersInRemarks: string[];
    personVesselHistoryByPerson: Record<
        string,
        Array<{
            date: string;
            vessels: string[];
        }>
    >;
    /** 인보이스 타임시트에 등장하는 전체 인원(비고 인원 교체 후보 풀) */
    invoiceTimesheetPeople?: string[];
    /** 최초 로드 시점의 엔트리 인원 배열(슬롯 원복 후보 계산용) */
    getOriginalTimesheetEntryPersons?: (entryId: number) => string[];
    /** 비고에서 엔트리 단위로 참여자 이름 교체(원본 work log 데이터 반영) */
    onReplaceTimesheetEntryPerson?: (args: {
        entryId: number;
        fromPerson: string;
        toPerson: string;
    }) => void;
}

type TravelChargeOverrideTarget = "home" | "lodging";
type TravelBadgeDirection = "arrival" | "departure";
type TravelDescriptionBadgeData = {
    label: string;
    people: string[];
    target: TravelChargeOverrideTarget;
    direction: TravelBadgeDirection;
};

type PersonVesselHistoryItem = {
    date: string;
    vessels: string[];
};

const GANGDONG_FACTORY = "강동동 공장";

const sortPeopleByKoreanOrder = (people: string[]) =>
    [...people].sort((a, b) => a.localeCompare(b, "ko"));

const getEntryTimeRange = (entry: TimesheetSourceEntryData) => {
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
    entries: TimesheetSourceEntryData[],
    currentEntry: TimesheetSourceEntryData
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

const normalizeLocationName = (value: string | null | undefined): string => {
    if (!value) return "";

    const normalized = value.trim();
    if (!normalized) return "";

    if (normalized === "HHI") return "HD중공업(해양)";
    if (normalized === "HMD") return "HD미포";
    if (normalized === "HSHI") return "HD삼호";

    return normalized;
};

const getFinalDestination = (entry: TimesheetSourceEntryData): string => {
    const moveTo = entry.moveTo?.trim();
    if (moveTo) {
        return moveTo;
    }

    const details = (entry.details ?? "").replace(/\s*이동\.?\s*$/, "").trim();
    if (!details.includes("→")) {
        return details;
    }

    return details.split("→").pop()?.trim() ?? "";
};

const getTravelEntryOrigin = (entry: TimesheetSourceEntryData): string => {
    const moveFrom = entry.moveFrom?.trim();
    if (moveFrom) {
        return moveFrom;
    }

    const details = (entry.details ?? "").replace(/\s*이동\.?\s*$/, "").trim();
    if (!details.includes("→")) {
        return details;
    }

    return details.split("→")[0]?.trim() ?? "";
};

const sortEntriesByStart = (entries: TimesheetSourceEntryData[]) =>
    [...entries].sort((a, b) => {
        const aStart = new Date(
            `${a.dateFrom}T${a.timeFrom || "00:00"}`
        ).getTime();
        const bStart = new Date(
            `${b.dateFrom}T${b.timeFrom || "00:00"}`
        ).getTime();
        return aStart - bStart;
    });

const shiftDateByDays = (dateString: string, days: number): string => {
    const date = new Date(`${dateString}T00:00:00`);
    date.setDate(date.getDate() + days);

    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");

    return `${yyyy}-${mm}-${dd}`;
};

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

function DescTypeBadge({ value }: { value: string }) {
    const styles =
        value === "이동"
            ? "bg-lime-100 text-lime-800 ring-lime-200"
            : value === "작업"
              ? "bg-sky-100 text-sky-800 ring-sky-200"
              : value === "대기"
                ? "bg-orange-100 text-orange-800 ring-orange-200"
                : "bg-gray-100 text-gray-800 ring-gray-200";

    return (
        <span
            className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-semibold leading-4 ring-1 ring-inset ${styles}`}
        >
            {value}
        </span>
    );
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
}: {
    label: string;
    onClick?: () => void;
    isActive?: boolean;
}) {
    const isHome = label.includes("자택");
    const styles = isHome
        ? "bg-amber-50 text-amber-700 ring-amber-200 hover:bg-amber-100"
        : "bg-sky-50 text-sky-700 ring-sky-200 hover:bg-sky-100";
    const arrowClass = isHome
        ? "mx-px font-extrabold text-orange-950 tabular-nums"
        : "mx-px font-extrabold text-blue-950 tabular-nums";
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

export default function TimesheetDateGroupDetailSidePanel({
    isOpen,
    onClose,
    sectionTitle,
    disableOutsideClose = false,
    fullGroupEntries,
    workLocationsByDate,
    holidayDateKeys,
    travelChargeOverrides,
    onTravelChargeOverrideChange,
    onTravelChargeOverrideResetEntry,
    requiredSkilledFittersInRemarks,
    personVesselHistoryByPerson,
    invoiceTimesheetPeople = [],
    getOriginalTimesheetEntryPersons,
    onReplaceTimesheetEntryPerson,
}: TimesheetDateGroupDetailSidePanelProps) {
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
            `[data-travel-override-editor="true"][data-editor-key="${escapedKey}"]`
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
        dismissRemarkEditorImmediate();
        if (closeEditorTimerRef.current != null) {
            window.clearTimeout(closeEditorTimerRef.current);
            closeEditorTimerRef.current = null;
        }
        setEditorClosingKey(null);
        setExpandedEditorKey(key);
    }, [dismissRemarkEditorImmediate]);

    const getTravelChargeOverrideKey = (entryId: number, person: string) =>
        `${entryId}:${person}`;

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
                onClose();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose]);

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

            if (target.closest('[data-timesheet-date-group-badge="true"]')) {
                return;
            }

            if (disableOutsideClose) {
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
        disableOutsideClose,
        dismissRemarkEditorImmediate,
        expandedEditorKey,
        expandedRemarkKey,
        isOpen,
        onClose,
    ]);

    const getWeekdayLabel = (dateText: string) => {
        const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
        const date = new Date(`${dateText}T00:00:00`);
        return Number.isNaN(date.getTime()) ? "-" : weekdays[date.getDay()];
    };

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
                ? new Date(
                      new Date(`${endDate}T00:00:00`).getTime() + 24 * 60 * 60 * 1000
                  )
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

    const getWorkingChargeLabel = (entry: TimesheetSourceEntryData) => {
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

    type PersonBlock = {
        anchorEntries: TimesheetSourceEntryData[];
        beforeTravelEntries: TimesheetSourceEntryData[];
        afterTravelEntries: TimesheetSourceEntryData[];
    };

    const roundHours = (value: number) => Math.round(value * 10) / 10;

    const hasHomeInTravel = (entry: TimesheetSourceEntryData): boolean => {
        const details = entry.details ?? "";
        return (
            details.includes("자택") ||
            entry.moveFrom === "자택" ||
            entry.moveTo === "자택"
        );
    };

    const calculateRawTravelHours = (entry: TimesheetSourceEntryData): number => {
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
        beforeTravelEntries: TimesheetSourceEntryData[],
        afterTravelEntries: TimesheetSourceEntryData[]
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
        beforeTravelEntries: TimesheetSourceEntryData[],
        afterTravelEntries: TimesheetSourceEntryData[],
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

    const isDestinationWorkPlace = (entry: TimesheetSourceEntryData): boolean => {
        const destination = normalizeLocationName(getFinalDestination(entry));
        const workPlace = getPrimaryLocation(entry.location);

        if (!destination || !workPlace) {
            return false;
        }

        return destination === workPlace;
    };

    const summarizeTravelEntries = (
        entries: TimesheetSourceEntryData[],
        useFixedHomeHours: boolean
    ) => {
        if (entries.length === 0) {
            return { hours: 0, kind: "none" };
        }

        const lastEntry = entries[entries.length - 1];
        const fixedHours = getHomeTravelHours(lastEntry.location) ?? 0;
        const hasHome = entries.some((item) => hasHomeInTravel(item));

        if (useFixedHomeHours && hasHome && fixedHours > 0) {
            return { hours: fixedHours, kind: "home" };
        }

        return {
            hours: roundHours(
                entries.reduce((sum, item) => sum + calculateRawTravelHours(item), 0)
            ),
            kind: "travel",
        };
    };

    const splitTravelEntriesByGap = (
        travelEntries: TimesheetSourceEntryData[],
        minimumGapHours: number
    ) => {
        if (travelEntries.length <= 1) {
            return travelEntries.length === 0 ? [] : [travelEntries];
        }

        const sortedEntries = sortEntriesByStart(travelEntries);
        const minimumGapMs = minimumGapHours * 60 * 60 * 1000;
        const groups: TimesheetSourceEntryData[][] = [];
        let currentGroup: TimesheetSourceEntryData[] = [];

        sortedEntries.forEach((entry, index) => {
            if (index === 0) {
                currentGroup = [entry];
                return;
            }

            const previousEntry = sortedEntries[index - 1];
            const previousEnd =
                previousEntry.timeTo && previousEntry.dateTo
                    ? new Date(`${previousEntry.dateTo}T${previousEntry.timeTo}`).getTime()
                    : null;
            const currentStart =
                entry.timeFrom && entry.dateFrom
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

    const getPersonBlocks = (
        person: string,
        entries: TimesheetSourceEntryData[]
    ): PersonBlock[] => {
        const personEntries = sortEntriesByStart(
            entries.filter((entry) => (entry.persons ?? []).includes(person))
        );
        const blocks: PersonBlock[] = [];
        let currentBlock: PersonBlock | null = null;
        let interBlockTravelEntries: TimesheetSourceEntryData[] = [];

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

    const getZeroBillingTravelIdsForDate = (dateText: string) => {
        const dayEntries = fullGroupEntries.filter((entry) => entry.dateFrom === dateText);
        const allPersons = new Set(dayEntries.flatMap((entry) => entry.persons ?? []));
        const result = new Set<number>();
        const factory = normalizeLocationName(GANGDONG_FACTORY);

        for (const person of allPersons) {
            const blocks = getPersonBlocks(person, dayEntries);
            blocks.forEach((block) => {
                const lastBefore =
                    block.beforeTravelEntries[block.beforeTravelEntries.length - 1];
                const firstAfter = block.afterTravelEntries[0];

                if (
                    lastBefore &&
                    firstAfter &&
                    normalizeLocationName(getFinalDestination(lastBefore)) === factory &&
                    normalizeLocationName(getTravelEntryOrigin(firstAfter)) === factory
                ) {
                    block.beforeTravelEntries.forEach((travelEntry) =>
                        result.add(travelEntry.id)
                    );
                    block.afterTravelEntries.forEach((travelEntry) =>
                        result.add(travelEntry.id)
                    );
                }
            });
        }

        return result;
    };

    const resolvedWorkLocationsByDate = workLocationsByDate ?? {};

    const getTravelChargeHoursForPerson = (
        entry: TimesheetSourceEntryData,
        person: string
    ): number | null => getTravelChargeResultForPerson(entry, person).hours;

    const getTravelChargeResultForPerson = (
        entry: TimesheetSourceEntryData,
        person: string
    ): { hours: number | null; kind: string } => {
        const override =
            travelChargeOverrides[getTravelChargeOverrideKey(entry.id, person)] ?? null;
        const fixedHours = getHomeTravelHours(entry.location) ?? 0;

        if (override?.target === "lodging") {
            return { hours: 1, kind: "continued" };
        }

        if (override?.target === "home" && fixedHours > 0) {
            return { hours: fixedHours, kind: "home" };
        }

        const dayEntries = fullGroupEntries.filter(
            (candidate) => candidate.dateFrom === entry.dateFrom
        );
        const zeroBillingTravelIds = getZeroBillingTravelIdsForDate(entry.dateFrom);
        const blocks = getPersonBlocks(person, dayEntries);
        const factory = normalizeLocationName(GANGDONG_FACTORY);

        if (blocks.length === 0) {
            const personEntries = sortEntriesByStart(
                dayEntries.filter((candidate) =>
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

            const previousWorkLocations =
                resolvedWorkLocationsByDate[shiftDateByDays(entry.dateFrom, -1)] ??
                {};
            const nextWorkLocations =
                resolvedWorkLocationsByDate[shiftDateByDays(entry.dateFrom, 1)] ??
                {};

            const beforeTravel = (() => {
                if (block.beforeTravelEntries.length === 0) {
                    return { hours: 0, kind: "none" };
                }

                if (blockIndex === 0) {
                    if (
                        !doesWorkContextMatchBlockLocation(
                            person,
                            block.beforeTravelEntries,
                            effectiveAfterTravelEntries,
                            previousWorkLocations
                        )
                    ) {
                        const fixedHours =
                            getHomeTravelHours(block.beforeTravelEntries[0].location) ?? 0;
                        const hasHome = block.beforeTravelEntries.some((travelEntry) =>
                            hasHomeInTravel(travelEntry)
                        );

                        if (hasHome && fixedHours > 0) {
                            return { hours: fixedHours, kind: "initial-home" };
                        }

                        return summarizeTravelEntries(block.beforeTravelEntries, false);
                    }

                    return { hours: 1, kind: "continued" };
                }

                return summarizeTravelEntries(block.beforeTravelEntries, true);
            })();

            const afterTravel = (() => {
                if (effectiveAfterTravelEntries.length === 0) {
                    return { hours: 0, kind: "none" };
                }

                if (blockIndex < blocks.length - 1) {
                    return summarizeTravelEntries(effectiveAfterTravelEntries, true);
                }

                if (
                    doesWorkContextMatchBlockLocation(
                        person,
                        block.beforeTravelEntries,
                        effectiveAfterTravelEntries,
                        nextWorkLocations
                    )
                ) {
                    return { hours: 1, kind: "continued" };
                }

                return summarizeTravelEntries(effectiveAfterTravelEntries, true);
            })();

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
                          kind: beforeTravel.kind ?? "travel",
                      };
            }

            if (
                effectiveAfterTravelEntries.some((candidate) => candidate.id === entry.id)
            ) {
                return zeroBillingTravelIds.has(entry.id) || factoryWrapsBlock
                    ? { hours: 0, kind: "zero-billing" }
                    : {
                          hours: afterTravel.hours,
                          kind: afterTravel.kind ?? "travel",
                      };
            }
        }

        return { hours: null, kind: "none" };
    };

    const getChargeLabel = (entry: TimesheetSourceEntryData) => {
        const zeroBillingTravelIds = getZeroBillingTravelIdsForDate(entry.dateFrom);
        const durationHours = getDurationHours(
            entry.dateFrom,
            entry.timeFrom,
            entry.dateTo,
            entry.timeTo
        );
        const durationLabel =
            durationHours === null ? "" : formatHoursLabel(durationHours);

        if (entry.descType === "작업" || entry.descType === "대기") {
            return getWorkingChargeLabel(entry);
        }

        if (entry.descType !== "이동") {
            return durationLabel || "-";
        }

        const personHours = entry.persons
            .map((person) => getTravelChargeHoursForPerson(entry, person))
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
        entry: TimesheetSourceEntryData
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

        entry.persons.forEach((person) => {
            const chargeResult = getTravelChargeResultForPerson(entry, person);
            const isHomeCharge =
                chargeResult.kind === "home" ||
                chargeResult.kind.endsWith("-home");
            const target: TravelChargeOverrideTarget | null =
                chargeResult.hours === 1 && (containsLodging || containsHome)
                    ? "lodging"
                    : isHomeCharge
                      ? "home"
                      : null;

            if (target) {
                groupedPeople[target].push(person);
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
            };
        });
    };

    const getTravelOverrideEditorData = (entry: TimesheetSourceEntryData) => {
        const badges = getTravelDescriptionBadges(entry);

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

    const getFullGroupRemarkEditorKey = (entryId: number, person: string) =>
        `full-group-remark:${entryId}:${person}`;

    const getRemarkPersonHistoryNeighbors = (
        entry: TimesheetSourceEntryData,
        person: string
    ) => {
        const history = personVesselHistoryByPerson[person] ?? [];
        const targetDate = entry.dateFrom;
        const currentIndex = history.findIndex((item) => item.date === entry.dateFrom);
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
        const previousIndex = currentIndex >= 0 ? currentIndex - 1 : nextIndex - 1;
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
        entry: TimesheetSourceEntryData,
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

    const renderInteractiveRemarkPersons = (entry: TimesheetSourceEntryData) => {
        const persons = entry.persons ?? [];
        if (persons.length === 0) {
            return "-";
        }

        const lines: string[][] = [];
        for (let index = 0; index < persons.length; index += 3) {
            lines.push(persons.slice(index, index + 3));
        }

        const originalEntryPersons =
            getOriginalTimesheetEntryPersons?.(entry.id) ?? [];

        return (
            <div className="flex flex-col gap-1">
                {lines.map((line, lineIdx) => (
                    <div
                        key={`remark-line-${entry.id}-${lineIdx}`}
                        className="flex flex-wrap items-baseline"
                    >
                        {line.map((person, i) => {
                            const rk = getFullGroupRemarkEditorKey(entry.id, person);
                            const isActive = expandedRemarkKey === rk;
                            const slotIndex = lineIdx * 3 + i;
                            const originalForSlot = originalEntryPersons[slotIndex];
                            const isReplacedRemarkPerson =
                                originalForSlot !== undefined &&
                                person !== originalForSlot;
                            return (
                                <Fragment key={`${entry.id}-${person}-${lineIdx}-${i}`}>
                                    {i > 0 ? (
                                        <span className="select-none text-gray-500">, </span>
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
                                                    ? "bg-red-50 font-bold text-red-700 underline ring-1 ring-red-200"
                                                    : "bg-blue-50 text-blue-900 ring-1 ring-blue-200"
                                                : isReplacedRemarkPerson
                                                  ? "font-bold text-red-600 underline"
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

    const renderTravelOverrideBox = (
        entry: TimesheetSourceEntryData,
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

    return createPortal(
        <aside
            ref={panelRef}
            data-timesheet-date-group-panel="true"
            className={`fixed inset-y-0 right-0 z-[10000] h-screen w-full sm:w-[560px] lg:w-[min(calc(50vw+24px),960px)] border-l border-gray-200 bg-white shadow-2xl transition-transform duration-300 ease-in-out ${
                isOpen ? "translate-x-0" : "translate-x-full"
            }`}
        >
            <div className="flex h-full flex-col">
                <div className="flex items-center justify-between border-b border-gray-200 px-6 py-3.5">
                    <div>
                        <div className="text-xs font-semibold text-gray-500">
                            {sectionTitle}
                        </div>
                        <h2 className="mt-1 text-xl font-bold text-gray-900">
                            Date Group Detail
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
                    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                        <div className="border-b border-gray-200 bg-blue-50 px-4 py-3">
                            <div className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                                Actual DB Entries - Full Group
                            </div>
                        </div>

                        {fullGroupEntries.length === 0 ? (
                            <div className="px-4 py-6 text-sm text-gray-500">
                                선택된 기간의 원본 엔트리가 없습니다.
                            </div>
                        ) : (
                            (() => {
                                const datesMissingSkilledFitterRemark =
                                    getDatesMissingSkilledFitterRemark(
                                        fullGroupEntries,
                                        requiredSkilledFittersInRemarks
                                    );
                                return (
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
                                        {fullGroupEntries.map((entry, index, entries) => {
                                            const [, month, dayOfMonth] = entry.dateFrom.split("-");
                                            const chargeLabel = getChargeLabel(entry);
                                            const durationHours = getDurationHours(
                                                entry.dateFrom,
                                                entry.timeFrom,
                                                entry.dateTo,
                                                entry.timeTo
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
                                            const descriptionBadges =
                                                getTravelDescriptionBadges(entry);
                                            const travelEditorData =
                                                getTravelOverrideEditorData(entry);
                                            const editorKey = `full-group:${entry.id}`;
                                            const isEditorOpen =
                                                expandedEditorKey === editorKey;
                                            const isEditorRowVisible =
                                                isEditorOpen ||
                                                editorClosingKey === editorKey;
                                            const rowPink = datesMissingSkilledFitterRemark.has(
                                                entry.dateFrom
                                            );
                                            const remarkShellKey =
                                                entry.persons
                                                    ?.map((person) =>
                                                        getFullGroupRemarkEditorKey(
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
                                                        getFullGroupRemarkEditorKey(
                                                            entry.id,
                                                            person
                                                        )
                                                ) ?? null;
                                            const isRemarkEditorRowVisible =
                                                remarkShellKey !== null;

                                            return (
                                                <Fragment key={`full-group-${entry.id}-${index}`}>
                                                    <tr
                                                        className={
                                                            rowPink
                                                                ? "align-top bg-pink-50"
                                                                : "align-top bg-white"
                                                        }
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
                                                            <DescTypeBadge value={entry.descType} />
                                                        </td>
                                                        <td
                                                            className={`border-b border-r border-gray-200 px-3 py-2 text-center whitespace-nowrap ${dateBoundaryTopClass}`}
                                                        >
                                                            {formatTimeToMinutes(entry.timeFrom)}
                                                        </td>
                                                        <td
                                                            className={`border-b border-r border-gray-200 px-3 py-2 text-center whitespace-nowrap ${dateBoundaryTopClass}`}
                                                        >
                                                            {formatTimeToMinutes(entry.timeTo)}
                                                        </td>
                                                        <td
                                                            className={`border-b border-r border-gray-200 px-3 py-2 text-center whitespace-nowrap ${dateBoundaryTopClass}`}
                                                        >
                                                            {durationHours === null
                                                                ? "-"
                                                                : formatHoursLabel(durationHours)}
                                                        </td>
                                                        <td
                                                            className={`border-b border-r border-gray-200 px-3 py-2 text-center whitespace-pre-line ${
                                                                isChargeHighlightDate(entry.dateFrom)
                                                                    ? "font-semibold text-red-600"
                                                                    : ""
                                                            } ${dateBoundaryTopClass}`}
                                                        >
                                                            {chargeLabel}
                                                        </td>
                                                        <td
                                                            className={`border-b border-r border-gray-200 px-3 py-2 text-gray-900 ${dateBoundaryTopClass}`}
                                                        >
                                                            <div className="flex items-start justify-between gap-3">
                                                                <div className="min-w-0 whitespace-pre-wrap break-words">
                                                                    {descriptionText || "-"}
                                                                </div>
                                                                {descriptionBadges.length > 0 ? (
                                                                    <div className="flex shrink-0 flex-col items-end gap-1">
                                                                        {descriptionBadges.map(
                                                                            (badge) => (
                                                                                <TravelDescriptionBadge
                                                                                    key={badge.label}
                                                                                    label={badge.label}
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
                                                                            )
                                                                        )}
                                                                    </div>
                                                                ) : null}
                                                            </div>
                                                        </td>
                                                        <td
                                                            className={`border-b border-gray-200 px-3 py-2 whitespace-pre-wrap break-keep leading-5 text-gray-700 ${dateBoundaryTopClass}`}
                                                        >
                                                            {renderInteractiveRemarkPersons(
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
                                                        >
                                                            <td
                                                                colSpan={10}
                                                                className="overflow-hidden border-b border-gray-200 px-3 py-0"
                                                            >
                                                                <TravelOverrideEditorAnimatedShell
                                                                    editorKey={editorKey}
                                                                    isExpanded={isEditorOpen}
                                                                    isClosing={
                                                                        editorClosingKey ===
                                                                        editorKey
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
                                                                                                    onClick={(e) => {
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
                                                                                                            (p) =>
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
                                                                                                                        fullGroupEntries,
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
                                                                                                                                getFullGroupRemarkEditorKey(
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
                                );
                            })()
                        )}
                    </div>
                </div>
            </div>
        </aside>,
        document.body
    );
}
