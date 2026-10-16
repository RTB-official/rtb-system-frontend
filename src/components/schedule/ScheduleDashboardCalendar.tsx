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
import type { ScheduleInsertValues } from "./scheduleTableShared";
import { useWorkReportStore, type StaffProfile } from "../../store/workReportStore";
import { fetchRegisteredNamesByDay } from "../../lib/workloadApi";

const SCHEDULE_TEAM_LEADERS = ["안재훈", "온권태", "정상민", "이효익"] as const;

export type DayAvailability = { leaders: number; members: number };

function buildDayAvailability(
    dateKeys: string[],
    staff: StaffProfile[],
    registeredByDay: Map<string, Set<string>>
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
        const busy = registeredByDay.get(dateKey) ?? new Set();
        result[dateKey] = {
            leaders: SCHEDULE_TEAM_LEADERS.filter((name) => !busy.has(name)).length,
            members: members.filter((name) => !busy.has(name)).length,
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
    schedules = [],
}: {
    onScheduleSave?: (values: ScheduleInsertValues) => void;
    schedules?: ScheduleCalendarEntry[];
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
    const [insertAfterDate, setInsertAfterDate] = useState<string | null>(null);
    const allStaff = useWorkReportStore((state) => state.allStaff);
    const fetchAllStaff = useWorkReportStore((state) => state.fetchAllStaff);

    useEffect(() => {
        void fetchAllStaff();
    }, [fetchAllStaff]);

    const [registeredByDay, setRegisteredByDay] = useState<Map<string, Set<string>>>(
        () => new Map()
    );

    useEffect(() => {
        let cancelled = false;
        void fetchRegisteredNamesByDay(year, month + 1)
            .then((map) => {
                if (!cancelled) setRegisteredByDay(map);
            })
            .catch((err) => {
                console.error("일지 등록 인원 조회 실패:", err);
                if (!cancelled) setRegisteredByDay(new Map());
            });
        return () => {
            cancelled = true;
        };
    }, [year, month]);

    const holidays = useHolidays(year, month);
    const { loading } = useDashboardEvents(year, month);
    const mergedHolidays = useMergedHolidays(holidays);
    const sortedEvents = useSortedEvents([], mergedHolidays);

    const grid = useMemo(() => generateMonthGrid(year, month), [year, month]);
    const weeks = useMemo(() => splitIntoWeeks(grid), [grid]);
    const dayAvailability = useMemo(() => {
        const dateKeys = grid.map((cell) => {
            const d = cell.date;
            const m = String(d.getMonth() + 1).padStart(2, "0");
            const day = String(d.getDate()).padStart(2, "0");
            return `${d.getFullYear()}-${m}-${day}`;
        });
        return buildDayAvailability(dateKeys, allStaff, registeredByDay);
    }, [grid, allStaff, registeredByDay]);
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
                                setMenuPos({ x: event.clientX, y: event.clientY });
                                setMenuOpen(true);
                                return;
                            }
                            setMenuOpen(false);
                            setMenuPos(null);
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
                        onInsertClose={() => setInsertAfterDate(null)}
                        onScheduleSave={onScheduleSave}
                        scheduleBars={scheduleBarsFromEntries(schedules, year, allStaff)}
                        dayAvailability={dayAvailability}
                        rowHeight={rowHeight}
                    />
                )}
            </div>
            <CalendarMenu
                variant="schedule"
                isOpen={menuOpen}
                anchorEl={null}
                position={menuPos ?? undefined}
                selectedDate={selection.start}
                onClose={() => {
                    setMenuOpen(false);
                    setMenuPos(null);
                }}
                onAddSchedule={() => {
                    if (selection.end) setInsertAfterDate(selection.end);
                }}
            />
        </section>
    );
}
