import { useEffect, useMemo, useRef, useState } from "react";
import CalendarMenu from "../CalendarMenu";
import CalendarHeader, {
    WeekDayHeader,
} from "../../pages/Dashboard/components/CalendarHeader";
import CalendarGrid from "../../pages/Dashboard/components/CalendarGrid";
import useIsMobile from "../../hooks/useIsMobile";
import { useHolidays } from "../../hooks/useHolidays";
import {
    useDashboardEvents,
    useMergedHolidays,
    useSortedEvents,
} from "../../hooks/useDashboardEvents";
import { useCellHeights } from "../../hooks/useCellHeights";
import {
    applyScheduleDateClick,
    EMPTY_SCHEDULE_DATE_SELECTION,
    generateMonthGrid,
    splitIntoWeeks,
    type ScheduleDateSelection,
} from "../../utils/calendarUtils";
import {
    SCHEDULE_TEAM_LEADERS,
    type ScheduleInsertValues,
} from "./scheduleTableShared";
import { useWorkReportStore, type StaffProfile } from "../../store/workReportStore";

export type DayAvailability = {
    leaders: number;
    members: number;
    /** 그날 일정에 미배정된 투입 가능 인원 (팀장 → 팀원 순) */
    names: string[];
};

function pad2(n: number) {
    return n < 10 ? `0${n}` : String(n);
}

/** 일정 막대 기간별 배정 인원 → 날짜별 이름 집합 */
function buildScheduledNamesByDay(
    bars: { start: string; end: string; teamMember: string }[]
): Map<string, Set<string>> {
    const byDay = new Map<string, Set<string>>();
    for (const bar of bars) {
        const names = bar.teamMember.split(/\s+/).filter(Boolean);
        if (names.length === 0) continue;
        const start = new Date(`${bar.start}T00:00:00`);
        const end = new Date(`${bar.end}T00:00:00`);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue;
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const key = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
            let set = byDay.get(key);
            if (!set) {
                set = new Set();
                byDay.set(key, set);
            }
            for (const name of names) set.add(name);
        }
    }
    return byDay;
}

function buildDayAvailability(
    dateKeys: string[],
    staff: StaffProfile[],
    scheduledByDay: Map<string, Set<string>>
): Record<string, DayAvailability> {
    const leaderSet = new Set<string>(SCHEDULE_TEAM_LEADERS);
    const members = staff
        .filter(
            (member) =>
                member.department === "공사팀" &&
                member.name.trim() &&
                !leaderSet.has(member.name.trim())
        )
        .map((member) => member.name.trim());

    const result: Record<string, DayAvailability> = {};
    for (const dateKey of dateKeys) {
        const busy = scheduledByDay.get(dateKey) ?? new Set();
        const availableLeaders = SCHEDULE_TEAM_LEADERS.filter((name) => !busy.has(name));
        const availableMembers = members.filter((name) => !busy.has(name));
        result[dateKey] = {
            leaders: availableLeaders.length,
            members: availableMembers.length,
            names: [...availableLeaders, ...availableMembers],
        };
    }
    return result;
}

export type ScheduleCalendarEntry = {
    id: string;
    period: string;
    periodFrom?: string;
    teamMember?: string;
    shipName?: string;
};

/** Table row opened for calendar edit (prefill + update on save). */
export type ScheduleCalendarEditTarget = ScheduleInsertValues & {
    id: string;
};

const SCHEDULE_BAR_COLORS = [
    { name: "안재훈", color: "#93C5FD" },
    { name: "온권태", color: "#C4B5FD" },
    { name: "이효익", color: "#86EFAC" },
    { name: "정상민", color: "#FDBA74" },
] as const;

function scheduleBarColor(teamMember: string) {
    const names = new Set(teamMember.split(/\s+/).filter(Boolean));
    return SCHEDULE_BAR_COLORS.find((item) => names.has(item.name))?.color ?? "#D1D5DB";
}

function constructionStaffRatio(teamMember: string, staff: StaffProfile[]) {
    const construction = new Set(
        staff
            .filter((member) => member.department === "공사팀" && member.name.trim())
            .map((member) => member.name.trim())
    );
    if (construction.size === 0) return 0;
    const selected = new Set(teamMember.split(/\s+/).filter(Boolean));
    let count = 0;
    construction.forEach((name) => {
        if (selected.has(name)) count += 1;
    });
    return count / construction.size;
}

function monthDayKey(year: number, value: string): string | null {
    const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})$/);
    if (!match) return null;
    return `${year}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}`;
}

function padDatePart(n: number) {
    return n < 10 ? `0${n}` : String(n);
}

function todayDateKey() {
    const now = new Date();
    return `${now.getFullYear()}-${padDatePart(now.getMonth() + 1)}-${padDatePart(now.getDate())}`;
}

/** Resolve MM/DD~MM/DD (+ optional periodFrom) to YYYY-MM-DD start/end. */
export function resolveSchedulePeriodRange(
    period: string,
    periodFrom: string | undefined,
    viewYear: number
): { start: string; end: string } | null {
    const parts = period.split("~").map((part) => part.trim()).filter(Boolean);
    const storedFrom = /^\d{4}-\d{2}-\d{2}$/.test(periodFrom ?? "")
        ? periodFrom
        : null;
    const startYear = storedFrom ? Number(storedFrom.slice(0, 4)) : viewYear;
    const start = storedFrom ?? (parts[0] ? monthDayKey(startYear, parts[0]) : null);
    if (!start) return null;
    let end = parts[1] ? monthDayKey(startYear, parts[1]) : start;
    if (!end) end = start;
    if (parts[1] && end < start) {
        end = monthDayKey(startYear + 1, parts[1]) ?? end;
    }
    return { start, end };
}

export function scheduleBarsFromEntries(
    entries: ScheduleCalendarEntry[],
    viewYear: number,
    staff: StaffProfile[]
) {
    return entries.flatMap((entry) => {
        const parts = entry.period.split("~").map((part) => part.trim()).filter(Boolean);
        const storedFrom = /^\d{4}-\d{2}-\d{2}$/.test(entry.periodFrom ?? "")
            ? entry.periodFrom
            : null;
        const startYear = storedFrom ? Number(storedFrom.slice(0, 4)) : viewYear;
        const start = storedFrom ?? (parts[0] ? monthDayKey(startYear, parts[0]) : null);
        if (!start) return [];
        let end = parts[1] ? monthDayKey(startYear, parts[1]) : start;
        if (!end) end = start;
        if (parts[1] && end < start) {
            end = monthDayKey(startYear + 1, parts[1]) ?? end;
        }
        return [{
            id: entry.id,
            start,
            end,
            ratio: constructionStaffRatio(entry.teamMember ?? "", staff),
            color: scheduleBarColor(entry.teamMember ?? ""),
            shipName: entry.shipName?.trim() ?? "",
            teamMember: entry.teamMember?.trim() ?? "",
        }];
    });
}

/**
 * Dashboard calendar, shortened so it can sit under the schedule sheet.
 * Month navigation and event display match the dashboard. Editing stays there.
 */
export default function ScheduleDashboardCalendar({
    onScheduleSave,
    onScheduleUpdate,
    schedules = [],
    editTarget = null,
    onEditTargetClear,
}: {
    onScheduleSave?: (values: ScheduleInsertValues) => void;
    onScheduleUpdate?: (id: string, values: ScheduleInsertValues) => void;
    schedules?: ScheduleCalendarEntry[];
    editTarget?: ScheduleCalendarEditTarget | null;
    onEditTargetClear?: () => void;
}) {
    const today = new Date();
    const isMobile = useIsMobile();
    const [year, setYear] = useState(today.getFullYear());
    const [month, setMonth] = useState(today.getMonth());
    const [selection, setSelection] = useState<ScheduleDateSelection>(
        EMPTY_SCHEDULE_DATE_SELECTION
    );
    const [hoverDate, setHoverDate] = useState<string | null>(null);
    const [menuOpen, setMenuOpen] = useState(false);
    const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
    const [menuAnchorKey, setMenuAnchorKey] = useState<string | null>(null);
    const [dayDetailDateKey, setDayDetailDateKey] = useState<string | null>(null);
    const [dayDetailPosition, setDayDetailPosition] = useState<{
        x: number;
        y: number;
    } | null>(null);
    const [insertAfterDate, setInsertAfterDate] = useState<string | null>(null);
    const [insertEditId, setInsertEditId] = useState<string | null>(null);
    const [insertInitialValues, setInsertInitialValues] =
        useState<ScheduleInsertValues | null>(null);
    const allStaff = useWorkReportStore((state) => state.allStaff);
    const fetchAllStaff = useWorkReportStore((state) => state.fetchAllStaff);

    useEffect(() => {
        void fetchAllStaff();
    }, [fetchAllStaff]);

    useEffect(() => {
        if (!editTarget) return;
        const fallbackYear = /^\d{4}/.test(editTarget.periodFrom)
            ? Number(editTarget.periodFrom.slice(0, 4))
            : new Date().getFullYear();
        const range =
            resolveSchedulePeriodRange(
                editTarget.period,
                editTarget.periodFrom,
                fallbackYear
            ) ?? (() => {
                const key = todayDateKey();
                return { start: key, end: key };
            })();
        const startDate = new Date(`${range.start}T00:00:00`);
        if (!Number.isNaN(startDate.getTime())) {
            setYear(startDate.getFullYear());
            setMonth(startDate.getMonth());
        }
        setHoverDate(null);
        setMenuOpen(false);
        setMenuPos(null);
        setSelection({
            anchor: null,
            start: range.start,
            end: range.end,
        });
        setInsertAfterDate(range.end);
        setInsertEditId(editTarget.id);
        const { id: _id, ...values } = editTarget;
        setInsertInitialValues(values);
    }, [editTarget]);

    const holidays = useHolidays(year, month);
    const { loading } = useDashboardEvents(year, month);
    const mergedHolidays = useMergedHolidays(holidays);
    const sortedEvents = useSortedEvents([], mergedHolidays);

    const grid = useMemo(() => generateMonthGrid(year, month), [year, month]);
    const weeks = useMemo(() => splitIntoWeeks(grid), [grid]);
    const scheduleBars = useMemo(
        () => scheduleBarsFromEntries(schedules, year, allStaff),
        [schedules, year, allStaff]
    );
    const dayAvailability = useMemo(() => {
        const dateKeys = grid.map((cell) => {
            const d = cell.date;
            const m = String(d.getMonth() + 1).padStart(2, "0");
            const day = String(d.getDate()).padStart(2, "0");
            return `${d.getFullYear()}-${m}-${day}`;
        });
        return buildDayAvailability(
            dateKeys,
            allStaff,
            buildScheduledNamesByDay(scheduleBars)
        );
    }, [grid, allStaff, scheduleBars]);
    const cellRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const headerRef = useRef<HTMLDivElement>(null);
    const { cellHeights, handleCellHeightChange } = useCellHeights(cellRefs, weeks);
    const closedHeight = isMobile ? 640 : 760;
    const [headerHeight, setHeaderHeight] = useState(isMobile ? 41 : 57);

    useEffect(() => {
        const header = headerRef.current;
        if (!header) return;
        const update = () => setHeaderHeight(header.offsetHeight);
        update();
        const observer = new ResizeObserver(update);
        observer.observe(header);
        return () => observer.disconnect();
    }, [isMobile]);

    const rowHeight =
        weeks.length > 0 ? (closedHeight - headerHeight) / weeks.length : undefined;

    const prevMonth = () => {
        setHoverDate(null);
        if (month === 0) {
            setYear((current) => current - 1);
            setMonth(11);
        } else {
            setMonth((current) => current - 1);
        }
    };

    const nextMonth = () => {
        setHoverDate(null);
        if (month === 11) {
            setYear((current) => current + 1);
            setMonth(0);
        } else {
            setMonth((current) => current + 1);
        }
    };

    const goToday = () => {
        const now = new Date();
        setYear(now.getFullYear());
        setMonth(now.getMonth());
    };

    const displayStart = selection.anchor ?? selection.start;
    const displayEnd = selection.anchor
        ? hoverDate ?? selection.anchor
        : selection.end;

    return (
        <section
            className="mt-6"
            aria-label="달력"
            onMouseLeave={() => setHoverDate(null)}
        >
            <CalendarHeader
                year={year}
                month={month}
                onPrevMonth={prevMonth}
                onNextMonth={nextMonth}
                onGoToday={goToday}
                isMobile={isMobile}
                compact
            />
            <div className="flex flex-col overflow-hidden rounded-sm border border-gray-200 bg-white">
                <div ref={headerRef} className="shrink-0">
                    <WeekDayHeader isMobile={isMobile} uniformColumns />
                </div>
                {loading ? (
                    <div
                        className="flex items-center justify-center text-sm text-gray-500"
                        style={{ height: Math.max(0, closedHeight - headerHeight) }}
                    >
                        불러오는 중…
                    </div>
                ) : (
                    <CalendarGrid
                        weeks={weeks}
                        sortedEvents={sortedEvents}
                        today={today}
                        isMobile={isMobile}
                        dragStart={null}
                        dragEnd={null}
                        isDragging={false}
                        cellRefs={cellRefs}
                        cellHeights={cellHeights}
                        onCellHeightChange={handleCellHeightChange}
                        onEditEvent={() => {}}
                        onDeleteEvent={() => {}}
                        onEventClick={() => {}}
                        onDateClick={(dateKey, event) => {
                            if (insertAfterDate) return;
                            setHoverDate(null);
                            const next = applyScheduleDateClick(selection, dateKey);
                            setSelection(next);
                            const completed = next.anchor == null && next.start != null;
                            if (completed) {
                                setMenuAnchorKey(dateKey);
                                setMenuPos({ x: event.clientX, y: event.clientY });
                                setMenuOpen(true);
                                return;
                            }
                            setMenuOpen(false);
                            setMenuPos(null);
                            setMenuAnchorKey(null);
                        }}
                        onDateHover={(dateKey) => {
                            if (selection.anchor) setHoverDate(dateKey);
                        }}
                        selectionStart={displayStart}
                        selectionEnd={displayEnd}
                        selectionPending={selection.anchor != null}
                        allowOutsideMonthSelect
                        onDragStart={() => {}}
                        onDragEnter={() => {}}
                        onHiddenCountClick={() => {}}
                        tagLayerTop={isMobile ? 5 : 10}
                        tagsBesideDate
                        uniformColumns
                        insertAfterDate={insertAfterDate}
                        onInsertClose={() => {
                            setInsertAfterDate(null);
                            setInsertEditId(null);
                            setInsertInitialValues(null);
                            onEditTargetClear?.();
                        }}
                        onScheduleSave={onScheduleSave}
                        insertInitialValues={insertInitialValues}
                        insertEditId={insertEditId}
                        onScheduleUpdate={(id, values) => {
                            onScheduleUpdate?.(id, values);
                            onEditTargetClear?.();
                        }}
                        scheduleBars={scheduleBars}
                        dayAvailability={dayAvailability}
                        rowHeight={rowHeight}
                        dayDetailDateKey={dayDetailDateKey}
                        dayDetailPosition={dayDetailPosition}
                        onDayDetailClose={() => {
                            setDayDetailDateKey(null);
                            setDayDetailPosition(null);
                        }}
                    />
                )}
            </div>
            <CalendarMenu
                variant="schedule"
                isOpen={menuOpen}
                anchorEl={
                    menuAnchorKey ? cellRefs.current[menuAnchorKey] ?? null : null
                }
                position={menuPos ?? undefined}
                selectedDate={selection.start}
                onClose={() => {
                    setMenuOpen(false);
                    setMenuPos(null);
                    setMenuAnchorKey(null);
                }}
                onDayDetail={
                    isMobile &&
                    selection.start != null &&
                    selection.end != null &&
                    selection.start === selection.end
                        ? () => {
                              const dateKey = selection.start;
                              if (!dateKey) return;
                              setDayDetailPosition(menuPos);
                              setDayDetailDateKey(dateKey);
                          }
                        : undefined
                }
                onAddSchedule={() => {
                    if (selection.end) {
                        setDayDetailDateKey(null);
                        setDayDetailPosition(null);
                        setInsertEditId(null);
                        setInsertInitialValues(null);
                        setInsertAfterDate(selection.end);
                    }
                }}
            />
        </section>
    );
}
