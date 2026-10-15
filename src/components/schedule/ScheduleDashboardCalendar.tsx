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

/**
 * Dashboard calendar, shortened so it can sit under the schedule sheet.
 * Month navigation and event display match the dashboard. Editing stays there.
 */
export default function ScheduleDashboardCalendar() {
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

    const holidays = useHolidays(year, month);
    const { loading } = useDashboardEvents(year, month);
    const mergedHolidays = useMergedHolidays(holidays);
    const sortedEvents = useSortedEvents([], mergedHolidays);

    const grid = useMemo(() => generateMonthGrid(year, month), [year, month]);
    const weeks = useMemo(() => splitIntoWeeks(grid), [grid]);
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
