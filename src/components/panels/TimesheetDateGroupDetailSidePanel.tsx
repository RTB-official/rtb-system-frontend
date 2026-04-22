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
import { TimesheetEntryEditorForm } from "./TimesheetEntryEditorForm";
import { getDatesMissingSkilledFitterRemark } from "../../constants/skilledFitter";
import {
    buildConsecutiveWorkClusterIndices,
    getWorkEntryAutoBillableTotalHours,
    isManualRoundedBillableFourOrEight,
    sumClusterWorkBillableHours,
    type WorkEntryClusterable,
} from "../../utils/workEntryBillableHours";

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
    clientDuplicated?: boolean;
}

interface TimesheetDateGroupDetailSidePanelProps {
    isOpen: boolean;
    onClose: () => void;
    sectionTitle: string;
    /** When true, outside clicks do not close the panel (e.g. nested pickers). */
    disableOutsideClose?: boolean;
    fullGroupEntries: TimesheetSourceEntryData[];
    workLocationsByDate?: Record<string, Record<string, string[]>>;
    /** Dates (YYYY-MM-DD) treated as holidays for highlighting/rules. */
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
    /** Skilled fitter display names that must appear in remarks when required. */
    requiredSkilledFittersInRemarks: string[];
    personVesselHistoryByPerson: Record<
        string,
        Array<{
            date: string;
            vessels: string[];
        }>
    >;
    /** Invoice timesheet people list for editors/pickers. */
    invoiceTimesheetPeople?: string[];
    /** Original persons for an entry before local edits (if tracked). */
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
    /** Replace one assigned person on an entry (work-log sync). */
    onReplaceTimesheetEntryPerson?: (args: {
        entryId: number;
        fromPerson: string;
        toPerson: string;
    }) => void;
    onDuplicateTimesheetEntry?: (entryId: number) => void;
    onDeleteTimesheetEntry?: (entryId: number) => void;
    onUndo?: () => void;
    onRedo?: () => void;
    /** Reset the full date group to the saved/default snapshot (confirm in parent). */
    onFullGroupResetToDefault?: () => void;
    /** When true, disable full-group reset (parent-controlled). */
    resetToInitialDisabled?: boolean;
    undoDisabled?: boolean;
    redoDisabled?: boolean;
    /** Per-entry manual billable hours (e.g. 4h/8h rounded work claims). */
    manualBillableHoursByEntryId?: Record<number, number>;
    onUpdateTimesheetEntry?: (payload: {
        entryId: number;
        descType: string;
        dateFrom: string;
        dateTo: string;
        timeFrom: string;
        timeTo: string;
        persons: string[];
        manualBillableHours: number | null;
    }) => void;
    /** Revert a single entry to its initial snapshot. */
    onResetSingleTimesheetEntryToInitial?: (entryId: number) => void;
    /** Bump value to force-remount the inline entry editor for an entry id. */
    timesheetEntryEditorRemountTickById?: Record<number, number>;
    /** Soft-deleted entries to list under the table (restore actions). */
    deletedEntries?: TimesheetSourceEntryData[];
    onRestoreDeletedTimesheetEntry?: (entryId: number) => void;
    onRestoreAllDeletedTimesheetEntriesInScope?: (entryIds: number[]) => void;
    /** Panel calendar dates (YYYY-MM-DD) used to scope deleted/visible rows. */
    panelCalendarDates?: string[];
    /** Scroll "Actual DB Entries - Full Group" to the first row whose work day matches (YYYY-MM-DD). */
    scrollToFullGroupDate?: string;
    /** Bump so the same date can scroll again on repeated row clicks. */
    scrollToFullGroupNonce?: number;
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

const GANGDONG_FACTORY = "\uAC15\uB3D9\uB3D9 \uACF5\uC7A5";

function scopeDeletedEntriesForInvoiceDateGroupPanel(
    deleted: NonNullable<TimesheetDateGroupDetailSidePanelProps["deletedEntries"]>,
    fullGroupEntries: TimesheetSourceEntryData[],
    panelCalendarDates: string[] | undefined
) {
    const datesFromRemaining = new Set(
        fullGroupEntries.flatMap((e) => [e.dateFrom, e.dateTo].filter(Boolean))
    );
    const cal = (panelCalendarDates ?? []).map((d) => d.trim()).filter(Boolean);
    return deleted.filter((e) => {
        if (e.clientDuplicated === true) {
            return false;
        }
        if (datesFromRemaining.has(e.dateFrom)) {
            return true;
        }
        if (cal.some((d) => e.dateFrom === d || e.dateTo === d)) {
            return true;
        }
        if (cal.length === 0 && datesFromRemaining.size === 0) {
            return true;
        }
        return false;
    });
}

/** Diagonal stripe for rows flagged as client-duplicated. */
const DUPLICATED_ENTRY_ROW_STRIPE_IMAGE =
    "repeating-linear-gradient(135deg, transparent 0px, transparent 6px, rgba(15, 23, 42, 0.08) 6px, rgba(15, 23, 42, 0.08) 7px)";

const entryTouchesCalendarDay = (
    entry: TimesheetSourceEntryData,
    calendarYmd: string
) => {
    if (!calendarYmd) {
        return false;
    }
    if (!entry.dateFrom || !entry.dateTo) {
        return entry.dateFrom === calendarYmd;
    }
    return calendarYmd >= entry.dateFrom && calendarYmd <= entry.dateTo;
};

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

    if (normalized === "HHI") return "HD\uC911\uACF5\uC5C5(\uD574\uC591)";
    if (normalized === "HMD") return "HD\uBBF8\uD3EC";
    if (normalized === "HSHI") return "HD\uC0BC\uD638";

    return normalized;
};

const getFinalDestination = (entry: TimesheetSourceEntryData): string => {
    const moveTo = entry.moveTo?.trim();
    if (moveTo) {
        return moveTo;
    }

    const details = (entry.details ?? "")
        .replace(/\s*\uC774\uB3D9\.?\s*$/, "")
        .trim();
    const arrow = "\u2192";
    if (!details.includes(arrow)) {
        return details;
    }

    return details.split(arrow).pop()?.trim() ?? "";
};

const getTravelEntryOrigin = (entry: TimesheetSourceEntryData): string => {
    const moveFrom = entry.moveFrom?.trim();
    if (moveFrom) {
        return moveFrom;
    }

    const details = (entry.details ?? "")
        .replace(/\s*\uC774\uB3D9\.?\s*$/, "")
        .trim();
    const arrow = "\u2192";
    if (!details.includes(arrow)) {
        return details;
    }

    return details.split(arrow)[0]?.trim() ?? "";
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

function UndoIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path
                d="M9 7L4 12L9 17"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path
                d="M20 12H5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

function RedoIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path
                d="M15 7L20 12L15 17"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path
                d="M4 12H19"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

function ResetIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path
                d="M18.6 11.5A6.6 6.6 0 1 1 8.9 5.2"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path
                d="M5.4 3.2H11V8.8"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

function DescTypeBadge({
    value,
    emphasizeChangedText,
}: {
    value: string;
    /** When true, emphasize changed text (border) while keeping badge colors. */
    emphasizeChangedText?: boolean;
}) {
    const bgRing =
        value === "\uC774\uB3D9"
            ? "bg-lime-100 ring-lime-200"
            : value === "\uC791\uC5C5"
              ? "bg-sky-100 ring-sky-200"
              : value === "\uB300\uAE30"
                ? "bg-orange-100 ring-orange-200"
                : "bg-gray-100 ring-gray-200";
    const textColor = emphasizeChangedText
        ? "border-2 border-blue-500 text-blue-800"
        : value === "\uC774\uB3D9"
          ? "text-lime-800"
          : value === "\uC791\uC5C5"
            ? "text-sky-800"
            : value === "\uB300\uAE30"
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
    const arrow = "\u2192";
    if (!label.includes(arrow)) {
        return label;
    }
    const parts = label.split(arrow);
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
                    {arrow}
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
        return target === "home"
            ? "\uC790\uD0DD\u2192 "
            : "\uC219\uC18C\u2192 ";
    }

    return target === "home"
        ? "\u2192\uC790\uD0DD"
        : "\u2192\uC219\uC18C";
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
    const isHome = label.includes("\uC790\uD0DD");
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
    getTimesheetEntryEditBaseline,
    onReplaceTimesheetEntryPerson,
    onDuplicateTimesheetEntry,
    onDeleteTimesheetEntry,
    onUndo,
    onRedo,
    onFullGroupResetToDefault,
    resetToInitialDisabled,
    undoDisabled = true,
    redoDisabled = true,
    manualBillableHoursByEntryId = {},
    onUpdateTimesheetEntry,
    onResetSingleTimesheetEntryToInitial,
    timesheetEntryEditorRemountTickById = {},
    deletedEntries = [],
    onRestoreDeletedTimesheetEntry,
    onRestoreAllDeletedTimesheetEntriesInScope,
    panelCalendarDates = [],
    scrollToFullGroupDate,
    scrollToFullGroupNonce,
}: TimesheetDateGroupDetailSidePanelProps) {
    const panelRef = useRef<HTMLElement | null>(null);
    const scrollBodyRef = useRef<HTMLDivElement | null>(null);
    const [expandedEditorKey, setExpandedEditorKey] = useState<string | null>(null);
    const [editorClosingKey, setEditorClosingKey] = useState<string | null>(null);
    const expandedEditorKeyRef = useRef<string | null>(null);
    expandedEditorKeyRef.current = expandedEditorKey;
    const closeEditorTimerRef = useRef<number | null>(null);

    const [expandedEntryEditKey, setExpandedEntryEditKey] = useState<string | null>(null);
    const [entryEditClosingKey, setEntryEditClosingKey] = useState<string | null>(null);
    const expandedEntryEditKeyRef = useRef<string | null>(null);
    expandedEntryEditKeyRef.current = expandedEntryEditKey;
    const closeEntryEditTimerRef = useRef<number | null>(null);

    const [expandedRemarkKey, setExpandedRemarkKey] = useState<string | null>(null);
    const [remarkClosingKey, setRemarkClosingKey] = useState<string | null>(null);
    const [remarkPersonReplacePickerKey, setRemarkPersonReplacePickerKey] = useState<
        string | null
    >(null);
    const [dbEntryContextMenu, setDbEntryContextMenu] = useState<{
        x: number;
        y: number;
        entryId: number;
    } | null>(null);
    const expandedRemarkKeyRef = useRef<string | null>(null);
    expandedRemarkKeyRef.current = expandedRemarkKey;
    const closeRemarkTimerRef = useRef<number | null>(null);

    useLayoutEffect(() => {
        if (!isOpen || !scrollToFullGroupDate) {
            return;
        }
        const body = scrollBodyRef.current;
        if (!body) {
            return;
        }
        const run = () => {
            const matchingEntries = fullGroupEntries.filter((e) =>
                entryTouchesCalendarDay(e, scrollToFullGroupDate)
            );
            if (matchingEntries.length === 0) {
                return;
            }
            const bodyRect = body.getBoundingClientRect();
            let blockTop = Infinity;
            let blockBottom = -Infinity;

            const accumulateEntryRowChain = (mainTr: HTMLElement) => {
                let el: Element | null = mainTr;
                while (el && el.tagName === "TR") {
                    const rect = el.getBoundingClientRect();
                    const top = body.scrollTop + (rect.top - bodyRect.top);
                    const bottom = top + rect.height;
                    blockTop = Math.min(blockTop, top);
                    blockBottom = Math.max(blockBottom, bottom);
                    const nextEl: Element | null = el.nextElementSibling;
                    if (
                        nextEl instanceof HTMLTableRowElement &&
                        !nextEl.hasAttribute("data-full-group-entry-id")
                    ) {
                        el = nextEl;
                    } else {
                        break;
                    }
                }
            };

            for (const entry of matchingEntries) {
                const mainTr = body.querySelector<HTMLElement>(
                    `[data-full-group-entry-id="${entry.id}"]`
                );
                if (mainTr) {
                    accumulateEntryRowChain(mainTr);
                }
            }

            if (!Number.isFinite(blockTop) || !Number.isFinite(blockBottom)) {
                return;
            }

            const blockCenter = (blockTop + blockBottom) / 2;
            const nextTop = blockCenter - body.clientHeight / 2;
            const maxScroll = Math.max(0, body.scrollHeight - body.clientHeight);
            const clampedTop = Math.min(maxScroll, Math.max(0, nextTop));
            const prefersReducedMotion =
                typeof window !== "undefined" &&
                window.matchMedia("(prefers-reduced-motion: reduce)").matches;
            body.scrollTo({
                top: clampedTop,
                behavior: prefersReducedMotion ? "auto" : "smooth",
            });
        };
        requestAnimationFrame(() => {
            requestAnimationFrame(run);
        });
    }, [
        isOpen,
        scrollToFullGroupDate,
        scrollToFullGroupNonce,
        fullGroupEntries,
    ]);

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

    const dismissEntryEditImmediate = useCallback(() => {
        setExpandedEntryEditKey(null);
        setEntryEditClosingKey(null);
        if (closeEntryEditTimerRef.current != null) {
            window.clearTimeout(closeEntryEditTimerRef.current);
            closeEntryEditTimerRef.current = null;
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
        dismissEntryEditImmediate();
        if (closeRemarkTimerRef.current != null) {
            window.clearTimeout(closeRemarkTimerRef.current);
            closeRemarkTimerRef.current = null;
        }
        setRemarkClosingKey(null);
        setExpandedRemarkKey(key);
    }, [dismissEntryEditImmediate, dismissTravelEditorImmediate]);

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
        dismissEntryEditImmediate();
        if (closeEditorTimerRef.current != null) {
            window.clearTimeout(closeEditorTimerRef.current);
            closeEditorTimerRef.current = null;
        }
        setEditorClosingKey(null);
        setExpandedEditorKey(key);
    }, [dismissEntryEditImmediate, dismissRemarkEditorImmediate]);

    const closeEntryEdit = useCallback(() => {
        const key = expandedEntryEditKeyRef.current;
        if (key === null) return;
        setEntryEditClosingKey(key);
        setExpandedEntryEditKey(null);
        if (closeEntryEditTimerRef.current != null) {
            window.clearTimeout(closeEntryEditTimerRef.current);
        }
        closeEntryEditTimerRef.current = window.setTimeout(() => {
            setEntryEditClosingKey(null);
            closeEntryEditTimerRef.current = null;
        }, TRAVEL_OVERRIDE_EDITOR_ANIM_MS);
    }, []);

    const openEntryEdit = useCallback(
        (key: string) => {
            dismissTravelEditorImmediate();
            dismissRemarkEditorImmediate();
            if (closeEntryEditTimerRef.current != null) {
                window.clearTimeout(closeEntryEditTimerRef.current);
                closeEntryEditTimerRef.current = null;
            }
            setEntryEditClosingKey(null);
            setExpandedEntryEditKey(key);
        },
        [dismissRemarkEditorImmediate, dismissTravelEditorImmediate]
    );

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
            dismissEntryEditImmediate();
            dismissRemarkEditorImmediate();
        }
    }, [dismissEntryEditImmediate, dismissRemarkEditorImmediate, isOpen]);

    useLayoutEffect(() => {
        if (!isOpen) return;

        const activeEditorKey =
            expandedRemarkKey ?? expandedEditorKey ?? expandedEntryEditKey;
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
        expandedEntryEditKey,
        expandedRemarkKey,
        isOpen,
    ]);

    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                if (expandedEntryEditKey) {
                    closeEntryEdit();
                    return;
                }
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
        closeEntryEdit,
        closeRemarkEditor,
        expandedEditorKey,
        expandedEntryEditKey,
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
                if (
                    expandedEntryEditKey &&
                    !target.closest('[data-entry-edit-editor="true"]')
                ) {
                    closeEntryEdit();
                }
                return;
            }

            if (target.closest('[data-timesheet-date-group-badge="true"]')) {
                return;
            }

            if (target.closest("[data-base-modal='true']")) {
                return;
            }

            if (target.closest('[data-app-toast="true"]')) {
                return;
            }

            if (disableOutsideClose) {
                return;
            }

            dismissEntryEditImmediate();
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
        closeEntryEdit,
        closeRemarkEditor,
        disableOutsideClose,
        dismissEntryEditImmediate,
        dismissRemarkEditorImmediate,
        expandedEditorKey,
        expandedEntryEditKey,
        expandedRemarkKey,
        isOpen,
        onClose,
    ]);

    const getWeekdayLabel = (dateText: string) => {
        const weekdays = [
            "\uC77C",
            "\uC6D4",
            "\uD654",
            "\uC218",
            "\uBAA9",
            "\uAE08",
            "\uD1A0",
        ];
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

    const getDurationLabel = (
        startDate: string,
        startTime: string,
        endDate: string,
        endTime: string
    ) => {
        const durationHours = getDurationHours(startDate, startTime, endDate, endTime);
        return durationHours === null ? "" : formatHoursLabel(durationHours);
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
            entry.descType === "\uB300\uAE30" ||
            (entry.descType === "\uC791\uC5C5" && !entry.lunchWorked);

        if (shouldDeductLunch) {
            normalMinutes -= getOverlapMinutes(start, end, lunchStart, lunchEnd);
        }

        normalMinutes = Math.max(0, normalMinutes);
        const afterMinutes = Math.max(0, totalMinutes - rawNormalMinutes);

        if (entry.descType === "\uB300\uAE30") {
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
            primaryLocation === "HD\uC911\uACF5\uC5C5(\uD574\uC591)" ||
            primaryLocation === "HD\uBBF8\uD3EC" ||
            primaryLocation === "HHI" ||
            primaryLocation === "HMD"
        ) {
            return 2;
        }

        if (primaryLocation === "HD\uC0BC\uD638" || primaryLocation === "HSHI") {
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

    const getWorkChargeBracketBadgeLabel = (
        entry: TimesheetSourceEntryData,
        allEntries: TimesheetSourceEntryData[],
        entryIndex: number,
        opts?: { manualBillableHours?: number }
    ): "4\u25BC" | "8\u25BC" | null => {
        if (entry.descType !== "\uC791\uC5C5") {
            return null;
        }
        const cluster = buildConsecutiveWorkClusterIndices(
            allEntries as WorkEntryClusterable[],
            entryIndex
        );
        const hours = sumClusterWorkBillableHours(cluster, (i) => {
            const e = allEntries[i];
            if (e.descType !== "\uC791\uC5C5") {
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
            return "4\u25BC";
        }
        if (hours >= 4 && hours < 8) {
            return "8\u25BC";
        }
        return null;
    };

    type WorkChargeBadgeDisplay =
        | { source: "manual"; label: "4h \uCCAD\uAD6C" | "8h \uCCAD\uAD6C" }
        | { source: "auto"; label: "4\u25BC" | "8\u25BC" };

    /** \uD0C0\uC784\uC2DC\uD2B8 \uADF8\uB9AC\uB4DC\uC640 \uB3D9\uC77C: \uC62C\uB9BC \uCCAD\uAD6C\uB294 \uD30C\uB791, \uC790\uB3D9 \uAD6C\uAC04\uC740 \uC8FC\uD669 */
    const getWorkChargeBadgeDisplay = (
        entry: TimesheetSourceEntryData,
        allEntries: TimesheetSourceEntryData[],
        entryIndex: number,
        opts?: { manualBillableHours?: number }
    ): WorkChargeBadgeDisplay | null => {
        if (entry.descType !== "\uC791\uC5C5") {
            return null;
        }
        let manualForSelf: number | undefined;
        if (
            opts &&
            Object.prototype.hasOwnProperty.call(opts, "manualBillableHours")
        ) {
            manualForSelf = opts.manualBillableHours;
        } else {
            manualForSelf = manualBillableHoursByEntryId[entry.id];
        }
        if (isManualRoundedBillableFourOrEight(manualForSelf)) {
            return {
                source: "manual",
                label:
                    roundHours(manualForSelf!) === 4
                        ? "4h \uCCAD\uAD6C"
                        : "8h \uCCAD\uAD6C",
            };
        }
        const cluster = buildConsecutiveWorkClusterIndices(
            allEntries as WorkEntryClusterable[],
            entryIndex
        );
        const hours = sumClusterWorkBillableHours(cluster, (i) => {
            const e = allEntries[i];
            if (e.descType !== "\uC791\uC5C5") {
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
            return { source: "auto", label: "4\u25BC" };
        }
        if (hours >= 4 && hours < 8) {
            return { source: "auto", label: "8\u25BC" };
        }
        return null;
    };

    const hasHomeInTravel = (entry: TimesheetSourceEntryData): boolean => {
        const details = entry.details ?? "";
        return (
            details.includes("\uC790\uD0DD") ||
            entry.moveFrom === "\uC790\uD0DD" ||
            entry.moveTo === "\uC790\uD0DD"
        );
    };

    const calculateRawTravelHours = (entry: TimesheetSourceEntryData): number => {
        if (
            entry.descType !== "\uC774\uB3D9" ||
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

        if (leadingDestination && leadingDestination !== "\uC790\uD0DD") {
            return leadingDestination;
        }

        const firstAfterTravelEntry = afterTravelEntries[0];
        const trailingOrigin = firstAfterTravelEntry
            ? normalizeLocationName(getTravelEntryOrigin(firstAfterTravelEntry))
            : "";

        if (trailingOrigin && trailingOrigin !== "\uC790\uD0DD") {
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
            if (entry.descType === "\uC774\uB3D9") {
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

    const getTravelChargeResultForPerson = (
        entry: TimesheetSourceEntryData,
        person: string,
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
                personEntries.filter(
                    (candidate) => candidate.descType === "\uC774\uB3D9"
                ),
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

    const getChargeLabel = (
        entry: TimesheetSourceEntryData,
        ignoreEntryManualOrOpts:
            | boolean
            | {
                  ignoreEntryManual?: boolean;
                  manualBillableHours?: number;
                  ignoreTravelOverrides?: boolean;
              } = false
    ) => {
        let ignoreEntryManual = false;
        let useExplicitManual = false;
        let explicitManual: number | undefined;
        let ignoreTravelOverrides = false;
        if (typeof ignoreEntryManualOrOpts === "boolean") {
            ignoreEntryManual = ignoreEntryManualOrOpts;
        } else if (ignoreEntryManualOrOpts && typeof ignoreEntryManualOrOpts === "object") {
            ignoreEntryManual = ignoreEntryManualOrOpts.ignoreEntryManual ?? false;
            ignoreTravelOverrides =
                ignoreEntryManualOrOpts.ignoreTravelOverrides ?? false;
            if (
                Object.prototype.hasOwnProperty.call(
                    ignoreEntryManualOrOpts,
                    "manualBillableHours"
                )
            ) {
                useExplicitManual = true;
                explicitManual = ignoreEntryManualOrOpts.manualBillableHours;
            }
        }

        const zeroBillingTravelIds = getZeroBillingTravelIdsForDate(entry.dateFrom);
        const rawTravelHours = roundHours(calculateRawTravelHours(entry));
        const durationHours = getDurationHours(
            entry.dateFrom,
            entry.timeFrom,
            entry.dateTo,
            entry.timeTo
        );
        const durationLabel =
            durationHours === null ? "" : formatHoursLabel(durationHours);

        if (!ignoreEntryManual) {
            const manual = useExplicitManual
                ? explicitManual
                : manualBillableHoursByEntryId[entry.id];
            if (manual !== undefined) {
                if (entry.descType === "\uB300\uAE30") {
                    return `W=${formatHoursLabel(manual)}`;
                }
                if (
                    entry.descType === "\uC791\uC5C5" ||
                    entry.descType === "\uC774\uB3D9"
                ) {
                    return formatHoursLabel(manual);
                }
            }
        }

        if (
            entry.descType === "\uC791\uC5C5" ||
            entry.descType === "\uB300\uAE30"
        ) {
            return getWorkingChargeLabel(entry);
        }

        if (entry.descType !== "\uC774\uB3D9") {
            return durationLabel || "-";
        }

        const personHours = entry.persons
            .map((person) => {
                const chargeResult = getTravelChargeResultForPerson(
                    entry,
                    person,
                    ignoreTravelOverrides ? { ignoreOverride: true } : undefined
                );

                if (chargeResult.hours === null) {
                    return null;
                }

                // Travel rows: keep raw window hours; work uses computed charge hours.
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
            details.includes("\uC790\uD0DD") ||
            entry.moveFrom === "\uC790\uD0DD" ||
            entry.moveTo === "\uC790\uD0DD";

        if (!containsHome) {
            return durationLabel || "-";
        }

        return formatHoursLabel(fixedHours);
    };

    const getTravelDescriptionBadges = (
        entry: TimesheetSourceEntryData
    ): TravelDescriptionBadgeData[] => {
        if (entry.descType !== "\uC774\uB3D9") {
            return [];
        }

        const details = entry.details ?? "";
        const containsLodging = details.includes("\uC219\uC18C");
        const containsHome =
            details.includes("\uC790\uD0DD") ||
            entry.moveFrom === "\uC790\uD0DD" ||
            entry.moveTo === "\uC790\uD0DD";
        const travelOrigin = normalizeLocationName(getTravelEntryOrigin(entry));
        const travelDestination = normalizeLocationName(getFinalDestination(entry));
        const direction: TravelBadgeDirection | null =
            travelDestination === "\uC790\uD0DD"
                ? "arrival"
                : travelOrigin === "\uC790\uD0DD"
                  ? "departure"
                  : travelDestination === "\uC219\uC18C"
                    ? "arrival"
                    : travelOrigin === "\uC219\uC18C"
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
            const chargeResult = getTravelChargeResultForPerson(entry, person);
            const target = resolveBadgeTargetFromChargeResult(chargeResult);

            if (target) {
                groupedPeople[target].push(person);
                const baselineTarget = resolveBadgeTargetFromChargeResult(
                    getTravelChargeResultForPerson(entry, person, {
                        ignoreOverride: true,
                    })
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
            { label: "\uC9C1\uC804", item: previous },
            { label: "\uB2F9\uC77C", item: current },
            { label: "\uC9C1\uD6C4", item: next },
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
                            const rk = getFullGroupRemarkEditorKey(entry.id, person);
                            const isActive = expandedRemarkKey === rk;
                            const isReplacedRemarkPerson =
                                hasPersonsBaseline &&
                                !originalPersonSet.has(person);
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
                                                    ? "bg-blue-50 font-bold text-blue-800 ring-2 ring-blue-400"
                                                    : "bg-blue-50 text-blue-900 ring-1 ring-blue-200"
                                                : isReplacedRemarkPerson
                                                  ? "rounded border border-blue-500 px-0.5 font-bold text-blue-700"
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
                    <span className="text-xs text-gray-400">
                        {"\uC9C0\uC815\uB41C \uC778\uC6D0\uC774 \uC5C6\uC2B5\uB2C8\uB2E4"}
                    </span>
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

    useEffect(() => {
        if (!isOpen) {
            setDbEntryContextMenu(null);
        }
    }, [isOpen]);

    useEffect(() => {
        if (!dbEntryContextMenu) {
            return;
        }
        const onPointerDown = (e: MouseEvent) => {
            const t = e.target as Element;
            if (t.closest('[data-db-entry-context-menu="true"]')) {
                return;
            }
            // Keep the menu open when interacting with a DB row (row click opens it).
            const inDbRow = t.closest("[data-db-entry-row]");
            if (
                inDbRow &&
                !t.closest("button") &&
                !t.closest("[data-remark-person]") &&
                !t.closest("[data-travel-override-badge]")
            ) {
                return;
            }
            setDbEntryContextMenu(null);
        };
        document.addEventListener("mousedown", onPointerDown);
        return () => document.removeEventListener("mousedown", onPointerDown);
    }, [dbEntryContextMenu]);

    const dbEntryMenuPortal =
        dbEntryContextMenu &&
        (onDuplicateTimesheetEntry ||
            onDeleteTimesheetEntry ||
            onUpdateTimesheetEntry) ? (
            (() => {
                const MENU_W = 168;
                const contextEntry = fullGroupEntries.find(
                    (e) => e.id === dbEntryContextMenu.entryId
                );
                const contextEntryIndex = contextEntry
                    ? fullGroupEntries.findIndex((e) => e.id === contextEntry.id)
                    : -1;
                const workBracketBadge =
                    contextEntry && contextEntryIndex >= 0
                        ? getWorkChargeBracketBadgeLabel(
                              contextEntry,
                              fullGroupEntries,
                              contextEntryIndex
                          )
                        : null;
                const manualBillableStored = contextEntry
                    ? manualBillableHoursByEntryId[contextEntry.id]
                    : undefined;
                const manualBillableRounded =
                    manualBillableStored !== undefined
                        ? roundHours(manualBillableStored)
                        : undefined;
                const revertAutoBillableHours = contextEntry
                    ? getWorkEntryAutoBillableTotalHours(contextEntry)
                    : null;
                const revertManualBillableMenuLabel =
                    revertAutoBillableHours !== null && revertAutoBillableHours > 0
                        ? `\uB418\uB3CC\uB9AC\uAE30 (${formatHoursLabel(
                              roundHours(revertAutoBillableHours)
                          )}h)`
                        : "\uB418\uB3CC\uB9AC\uAE30";
                const showRevertManualBillable =
                    Boolean(onUpdateTimesheetEntry) &&
                    contextEntry?.descType === "\uC791\uC5C5" &&
                    (manualBillableRounded === 4 || manualBillableRounded === 8);
                const showWorkCharge8h =
                    Boolean(onUpdateTimesheetEntry) &&
                    contextEntry?.descType === "\uC791\uC5C5" &&
                    (workBracketBadge === "4\u25BC" ||
                        workBracketBadge === "8\u25BC");
                const showWorkCharge4h =
                    Boolean(onUpdateTimesheetEntry) &&
                    contextEntry?.descType === "\uC791\uC5C5" &&
                    workBracketBadge === "4\u25BC";
                const menuRowCount =
                    (showRevertManualBillable ? 1 : 0) +
                    (showWorkCharge8h ? 1 : 0) +
                    (showWorkCharge4h ? 1 : 0) +
                    (onDuplicateTimesheetEntry ? 1 : 0) +
                    1 +
                    1 +
                    1;
                const MENU_H = menuRowCount * 40 + 16;
                const applyWorkManualBillableHours = (hours: number) => {
                    if (!onUpdateTimesheetEntry || !contextEntry) {
                        return;
                    }
                    onUpdateTimesheetEntry({
                        entryId: contextEntry.id,
                        descType: contextEntry.descType,
                        dateFrom: contextEntry.dateFrom,
                        dateTo: contextEntry.dateTo,
                        timeFrom: contextEntry.timeFrom,
                        timeTo: contextEntry.timeTo,
                        persons: [...contextEntry.persons],
                        manualBillableHours: hours,
                    });
                    setDbEntryContextMenu(null);
                };
                const applyRevertManualBillableToAuto = () => {
                    if (!onUpdateTimesheetEntry || !contextEntry) {
                        return;
                    }
                    onUpdateTimesheetEntry({
                        entryId: contextEntry.id,
                        descType: contextEntry.descType,
                        dateFrom: contextEntry.dateFrom,
                        dateTo: contextEntry.dateTo,
                        timeFrom: contextEntry.timeFrom,
                        timeTo: contextEntry.timeTo,
                        persons: [...contextEntry.persons],
                        manualBillableHours: null,
                    });
                    setDbEntryContextMenu(null);
                };
                const x = Math.max(
                    8,
                    Math.min(
                        dbEntryContextMenu.x,
                        window.innerWidth - MENU_W - 8
                    )
                );
                const y = Math.max(
                    8,
                    Math.min(
                        dbEntryContextMenu.y,
                        window.innerHeight - MENU_H - 8
                    )
                );
                return createPortal(
                    <div
                        data-db-entry-context-menu="true"
                        className="fixed z-[20000] min-w-[160px] rounded-lg border border-gray-200 bg-white py-1 text-sm shadow-xl"
                        style={{ left: x, top: y }}
                        onMouseDown={(e) => e.stopPropagation()}
                        role="menu"
                    >
                        {showRevertManualBillable ? (
                            <button
                                type="button"
                                role="menuitem"
                                className="block w-full px-3 py-2 text-left text-gray-900 hover:bg-gray-100"
                                onClick={applyRevertManualBillableToAuto}
                            >
                                {revertManualBillableMenuLabel}
                            </button>
                        ) : null}
                        {showWorkCharge8h ? (
                            <button
                                type="button"
                                role="menuitem"
                                className="block w-full px-3 py-2 text-left text-gray-900 hover:bg-gray-100"
                                onClick={() => applyWorkManualBillableHours(8)}
                            >
                                {"8h \uCCAD\uAD6C"}
                            </button>
                        ) : null}
                        {showWorkCharge4h ? (
                            <button
                                type="button"
                                role="menuitem"
                                className="block w-full px-3 py-2 text-left text-gray-900 hover:bg-gray-100"
                                onClick={() => applyWorkManualBillableHours(4)}
                            >
                                {"4h \uCCAD\uAD6C"}
                            </button>
                        ) : null}
                        {onDuplicateTimesheetEntry ? (
                            <button
                                type="button"
                                role="menuitem"
                                className="block w-full px-3 py-2 text-left text-gray-900 hover:bg-gray-100"
                                onClick={() => {
                                    onDuplicateTimesheetEntry(
                                        dbEntryContextMenu.entryId
                                    );
                                    setDbEntryContextMenu(null);
                                }}
                            >
                                {"\uBCF5\uC0AC"}
                            </button>
                        ) : null}
                        {onUpdateTimesheetEntry ? (
                            <button
                                type="button"
                                role="menuitem"
                                className="block w-full px-3 py-2 text-left text-gray-900 hover:bg-gray-100"
                                onClick={() => {
                                    const id = dbEntryContextMenu.entryId;
                                    setDbEntryContextMenu(null);
                                    openEntryEdit(`full-group:edit:${id}`);
                                }}
                            >
                                {"\uC218\uC815"}
                            </button>
                        ) : (
                            <button
                                type="button"
                                disabled
                                className="block w-full cursor-not-allowed px-3 py-2 text-left text-gray-400"
                            >
                                {"\uC218\uC815"}
                            </button>
                        )}
                        {onDeleteTimesheetEntry ? (
                            <button
                                type="button"
                                role="menuitem"
                                className="block w-full px-3 py-2 text-left text-red-700 hover:bg-red-50"
                                onClick={() => {
                                    onDeleteTimesheetEntry(
                                        dbEntryContextMenu.entryId
                                    );
                                    setDbEntryContextMenu(null);
                                }}
                            >
                                {"\uC0AD\uC81C"}
                            </button>
                        ) : (
                            <button
                                type="button"
                                disabled
                                className="block w-full cursor-not-allowed px-3 py-2 text-left text-gray-400"
                            >
                                {"\uC0AD\uC81C"}
                            </button>
                        )}
                    </div>,
                    document.body
                );
            })()
        ) : null;

    return (
        <>
            {createPortal(
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
                    <div className="flex items-center gap-2">
                        {onUndo ? (
                            <button
                                type="button"
                                className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                                disabled={undoDisabled}
                                onMouseDown={(e) => e.stopPropagation()}
                                onClick={onUndo}
                                aria-label="Undo"
                                title="Undo"
                            >
                                <UndoIcon />
                            </button>
                        ) : null}
                        {onRedo ? (
                            <button
                                type="button"
                                className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                                disabled={redoDisabled}
                                onMouseDown={(e) => e.stopPropagation()}
                                onClick={onRedo}
                                aria-label="Redo"
                                title="Redo"
                            >
                                <RedoIcon />
                            </button>
                        ) : null}
                        {onFullGroupResetToDefault ? (
                            <button
                                type="button"
                                className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                                disabled={
                                    resetToInitialDisabled !== undefined
                                        ? resetToInitialDisabled
                                        : fullGroupEntries.length === 0
                                }
                                onMouseDown={(e) => e.stopPropagation()}
                                onClick={onFullGroupResetToDefault}
                                aria-label={"???"}
                                title={"???"}
                            >
                                <ResetIcon />
                            </button>
                        ) : null}
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 transition-colors hover:bg-gray-100"
                            aria-label={"??"}
                            title={"??"}
                        >
                            <CloseIcon />
                        </button>
                    </div>
                </div>

                <div ref={scrollBodyRef} className="flex-1 overflow-y-auto px-6 py-6">
                    <div className="rounded-xl border border-gray-200 bg-white overflow-visible">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 bg-blue-50 px-4 py-3">
                            <div className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                                Actual DB Entries - Full Group
                            </div>
                            <div />
                        </div>

                        {fullGroupEntries.length === 0 ? (
                            <div className="px-4 py-6 text-sm text-gray-500">
                                {
                                    "\uC774 \uADF8\uB8F9\uC5D0 \uD45C\uC2DC\uD560 DB \uC5D4\uD2B8\uB9AC\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4."
                                }
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
                                            <th className="border-b border-r border-gray-200 px-3 py-2 text-center font-semibold">
                                                {"\uC6D4"}
                                            </th>
                                            <th className="border-b border-r border-gray-200 px-3 py-2 text-center font-semibold">
                                                {"\uC77C"}
                                            </th>
                                            <th className="border-b border-r border-gray-200 px-3 py-2 text-center font-semibold">
                                                {"\uC694\uC77C"}
                                            </th>
                                            <th className="border-b border-r border-gray-200 px-3 py-2 text-center font-semibold">
                                                {"\uAD6C\uBD84"}
                                            </th>
                                            <th className="border-b border-r border-gray-200 px-3 py-2 text-center font-semibold">From</th>
                                            <th className="border-b border-r border-gray-200 px-3 py-2 text-center font-semibold">To</th>
                                            <th className="border-b border-r border-gray-200 px-3 py-2 text-center font-semibold whitespace-pre-line">
                                                {"\uC18C\uC694\n\uC2DC\uAC04"}
                                            </th>
                                            <th className="border-b border-r border-gray-200 px-3 py-2 text-center font-semibold whitespace-pre-line">
                                                {"\uCCAD\uAD6C\n\uC2DC\uAC04"}
                                            </th>
                                            <th className="border-b border-r border-gray-200 px-3 py-2 text-left font-semibold">
                                                {"\uC0C1\uC138 \uB0B4\uC6A9(Description)"}
                                            </th>
                                            <th className="border-b border-gray-200 px-3 py-2 text-left font-semibold">
                                                {"\uBE44\uACE0(Remark)"}
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {fullGroupEntries.map((entry, index, entries) => {
                                            const [, month, dayOfMonth] = entry.dateFrom.split("-");
                                            const chargeLabel = getChargeLabel(entry);
                                            const workChargeBadgeDisplay =
                                                getWorkChargeBadgeDisplay(
                                                    entry,
                                                    fullGroupEntries,
                                                    index
                                                );
                                            const durationHours = getDurationHours(
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
                                                durationHours === null
                                                    ? "-"
                                                    : formatHoursLabel(durationHours);
                                            const baselineChargeLabel = baselineSynth
                                                ? getChargeLabel(baselineSynth, {
                                                      manualBillableHours:
                                                          editBaseline!.manualBillableHours,
                                                      ignoreTravelOverrides: true,
                                                  })
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
                                                        String(chargeLabel)
                                                    ) !==
                                                        normalizeMultilineCompare(
                                                            String(baselineChargeLabel)
                                                        )
                                            );
                                            const manualRoundedForEntry =
                                                manualBillableHoursByEntryId[entry.id];
                                            const chargeManualRoundedHighlight =
                                                entry.descType === "\uC791\uC5C5" &&
                                                isManualRoundedBillableFourOrEight(
                                                    manualRoundedForEntry
                                                );
                                            const chargeCellHighlightClass =
                                                chargeManualRoundedHighlight || chargeChanged;
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

                                            const entryEditKey = `full-group:edit:${entry.id}`;
                                            const isEntryEditOpen =
                                                expandedEntryEditKey === entryEditKey;
                                            const isEntryEditRowVisible =
                                                isEntryEditOpen ||
                                                entryEditClosingKey === entryEditKey;

                                            const dbRowInteractive = Boolean(
                                                onDuplicateTimesheetEntry ||
                                                    onDeleteTimesheetEntry ||
                                                    onUpdateTimesheetEntry
                                            );
                                            const isTimesheetFocusedDateRow = Boolean(
                                                scrollToFullGroupDate &&
                                                    entryTouchesCalendarDay(
                                                        entry,
                                                        scrollToFullGroupDate
                                                    )
                                            );
                                            /** ???? ?? ??: ? ??? ?? + ?? ????? */
                                            const focusedBlockTrClass = isTimesheetFocusedDateRow
                                                ? "relative z-[1] -translate-y-px shadow-[0_1px_2px_rgba(15,23,42,0.05),0_4px_14px_-4px_rgba(15,23,42,0.07)] ring-1 ring-slate-900/[0.04]"
                                                : "";
                                            const rowSurfaceClass = rowPink
                                                ? isTimesheetFocusedDateRow
                                                    ? "align-top bg-pink-100"
                                                    : "align-top bg-pink-50"
                                                : isTimesheetFocusedDateRow
                                                  ? "align-top bg-slate-100"
                                                  : "align-top bg-white";
                                            const expandedRowSurfaceClass = rowPink
                                                ? isTimesheetFocusedDateRow
                                                    ? "bg-pink-100"
                                                    : "bg-pink-50"
                                                : isTimesheetFocusedDateRow
                                                  ? "bg-slate-100"
                                                  : "bg-slate-50/60";
                                            const dbRowHoverClass = dbRowInteractive
                                                ? rowPink
                                                    ? isTimesheetFocusedDateRow
                                                        ? "cursor-pointer transition-colors hover:bg-pink-200/85"
                                                        : "cursor-pointer transition-colors hover:bg-pink-100/90"
                                                    : isTimesheetFocusedDateRow
                                                      ? "cursor-pointer transition-colors hover:bg-slate-200/90"
                                                      : "cursor-pointer transition-colors hover:bg-gray-50"
                                                : "";

                                            const duplicatedStripeStyle =
                                                entry.clientDuplicated
                                                    ? {
                                                          backgroundImage:
                                                              DUPLICATED_ENTRY_ROW_STRIPE_IMAGE,
                                                      }
                                                    : undefined;

                                            return (
                                                <Fragment key={`full-group-${entry.id}-${index}`}>
                                                    <tr
                                                        data-full-group-entry-id={entry.id}
                                                        data-full-group-row-date={entry.dateFrom}
                                                        data-db-entry-row={
                                                            dbRowInteractive
                                                                ? "true"
                                                                : undefined
                                                        }
                                                        className={`${rowSurfaceClass} ${dbRowHoverClass} ${focusedBlockTrClass}`}
                                                        style={duplicatedStripeStyle}
                                                        onClick={
                                                            dbRowInteractive
                                                                ? (e) => {
                                                                      const el =
                                                                          e.target as HTMLElement;
                                                                      if (
                                                                          el.closest(
                                                                              "button"
                                                                          )
                                                                      ) {
                                                                          return;
                                                                      }
                                                                      if (
                                                                          el.closest(
                                                                              "[data-remark-person]"
                                                                          )
                                                                      ) {
                                                                          return;
                                                                      }
                                                                      if (
                                                                          el.closest(
                                                                              "[data-travel-override-badge]"
                                                                          )
                                                                      ) {
                                                                          return;
                                                                      }
                                                                      setDbEntryContextMenu(
                                                                          (prev) =>
                                                                              prev?.entryId ===
                                                                              entry.id
                                                                                  ? null
                                                                                  : {
                                                                                        x: e.clientX,
                                                                                        y: e.clientY,
                                                                                        entryId:
                                                                                            entry.id,
                                                                                    }
                                                                      );
                                                                  }
                                                                : undefined
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
                                                                {durationHours === null
                                                                    ? "-"
                                                                    : formatHoursLabel(
                                                                          durationHours
                                                                      )}
                                                            </span>
                                                        </td>
                                                        <td
                                                            className={`relative border-b border-r border-gray-200 px-3 py-2 text-center whitespace-pre-line ${
                                                                isChargeHighlightDate(entry.dateFrom)
                                                                    ? "font-semibold text-red-600"
                                                                    : ""
                                                            } ${dateBoundaryTopClass}`}
                                                        >
                                                            {workChargeBadgeDisplay ? (
                                                                <span
                                                                    className={
                                                                        workChargeBadgeDisplay.source ===
                                                                        "manual"
                                                                            ? "pointer-events-none absolute right-0.5 top-0 z-[1] -translate-y-1 rounded bg-blue-600 px-0.5 py-px text-[8px] font-bold leading-none text-white shadow-sm"
                                                                            : "pointer-events-none absolute right-0.5 top-0 z-[1] -translate-y-1 rounded bg-amber-500 px-0.5 py-px text-[9px] font-bold leading-none text-white shadow-sm"
                                                                    }
                                                                    aria-hidden="true"
                                                                >
                                                                    {workChargeBadgeDisplay.label}
                                                                </span>
                                                            ) : null}
                                                            <span
                                                                className={
                                                                    chargeCellHighlightClass
                                                                        ? `${fieldEditedClass} whitespace-pre-line inline-block`
                                                                        : "whitespace-pre-line inline-block"
                                                                }
                                                            >
                                                                {chargeLabel}
                                                            </span>
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
                                                            className={`${expandedRowSurfaceClass} ${focusedBlockTrClass}`}
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
                                                                                {
                                                                                    "\uC7AC\uC124\uC815"
                                                                                }
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                onClick={closeEditor}
                                                                                className="rounded-full px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100"
                                                                            >
                                                                                {"\uB2EB\uAE30"}
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
                                                    {onUpdateTimesheetEntry &&
                                                    isEntryEditRowVisible ? (
                                                        <tr
                                                            className={`${expandedRowSurfaceClass} ${focusedBlockTrClass}`}
                                                        >
                                                            <td
                                                                colSpan={10}
                                                                className="overflow-hidden border-b border-gray-200 px-3 py-0"
                                                            >
                                                                <TravelOverrideEditorAnimatedShell
                                                                    editorKey={entryEditKey}
                                                                    isExpanded={isEntryEditOpen}
                                                                    isClosing={
                                                                        entryEditClosingKey ===
                                                                        entryEditKey
                                                                    }
                                                                >
                                                                    <TimesheetEntryEditorForm
                                                                        entry={entry}
                                                                        contextEntries={
                                                                            fullGroupEntries
                                                                        }
                                                                        invoiceTimesheetPeople={
                                                                            invoiceTimesheetPeople
                                                                        }
                                                                        manualBillableHours={
                                                                            manualBillableHoursByEntryId[
                                                                                entry.id
                                                                            ]
                                                                        }
                                                                        getDurationLabel={
                                                                            getDurationLabel
                                                                        }
                                                                        getChargeLabelForDraft={(
                                                                            draft
                                                                        ) =>
                                                                            getChargeLabel(
                                                                                draft,
                                                                                true
                                                                            )
                                                                        }
                                                                        onSave={
                                                                            onUpdateTimesheetEntry
                                                                        }
                                                                        onCancel={closeEntryEdit}
                                                                        onResetEntryToInitial={
                                                                            onResetSingleTimesheetEntryToInitial
                                                                        }
                                                                        remountTick={
                                                                            timesheetEntryEditorRemountTickById[
                                                                                entry.id
                                                                            ] ?? 0
                                                                        }
                                                                        formTitle={
                                                                            entry.clientDuplicated
                                                                                ? "\uBCF5\uC0AC \uC5D4\uD2B8\uB9AC \uD3B8\uC9D1"
                                                                                : "\uC5D4\uD2B8\uB9AC \uD3B8\uC9D1"
                                                                        }
                                                                    />
                                                                </TravelOverrideEditorAnimatedShell>
                                                            </td>
                                                        </tr>
                                                    ) : null}
                                                    {isRemarkEditorRowVisible ? (
                                                        <tr
                                                            className={`${expandedRowSurfaceClass} ${focusedBlockTrClass}`}
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
                                                                                                            {
                                                                                                                "\uAD50\uCCB4\uD560 \uC778\uC6D0\uC744 \uC120\uD0DD\uD574 \uC8FC\uC138\uC694."
                                                                                                            }
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
                                                                                    {"\uB2EB\uAE30"}
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

                    {(() => {
                        const scoped = scopeDeletedEntriesForInvoiceDateGroupPanel(
                            deletedEntries,
                            fullGroupEntries,
                            panelCalendarDates
                        );
                        if (scoped.length === 0) {
                            return null;
                        }
                        return (
                            <div className="mt-4">
                                <details className="rounded-xl border border-gray-200 bg-white">
                                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-gray-900 [&::-webkit-details-marker]:hidden">
                                        <span className="flex min-w-0 flex-1 items-center gap-2">
                                            {"\uC0AD\uC81C\uB41C \uC5D4\uD2B8\uB9AC"}{" "}
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
                                                {"\uBAA8\uB450 \uBCF5\uC6D0"}
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
                                                            #{e.id} {"\u00B7"} {e.descType}
                                                        </div>
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <div className="text-xs text-gray-600">
                                                                {e.dateFrom}{" "}
                                                                {e.timeFrom || "--:--"} ~{" "}
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
                                                                    {"\uBCF5\uC6D0"}
                                                                </button>
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                    <div className="mt-1 text-xs text-gray-700">
                                                        {(e.persons ?? []).join(", ") ||
                                                            "\uC778\uC6D0 \uC5C6\uC74C"}
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
                            </div>
                        );
                    })()}
                </div>
            </div>
        </aside>,
        document.body
            )}
            {dbEntryMenuPortal}
        </>
    );
}
