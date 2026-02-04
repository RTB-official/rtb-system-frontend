import React, { useEffect } from "react";
import WeekRow from "../../../components/calendar/WeekRow";
import { CalendarEvent } from "../../../types";
import { getWeekEventRows, getEventsForDate, getSafeDateKey, getColumnPadding } from "../../../utils/calendarUtils";
import { prefetchWorkLogById } from "../../../lib/workLogApi";

interface CalendarGridProps {
    weeks: { date: Date; inMonth: boolean }[][];
    sortedEvents: CalendarEvent[];
    today: Date;
    isMobile?: boolean;
    dragStart: string | null;
    dragEnd: string | null;
    isDragging: boolean;
    cellRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
    cellHeights: Record<string, number>;
    onEditEvent: (event: CalendarEvent) => void;
    onDeleteEvent: (eventId: string) => void;
    onEventClick: (event: CalendarEvent, e: React.MouseEvent) => void;
    onDateClick: (dateKey: string, e: React.MouseEvent) => void;
    onDragStart: (dateKey: string, e: React.MouseEvent) => void;
    onDragEnter: (dateKey: string) => void;
    onHiddenCountClick: (dateKey: string, hiddenEventIds: string[]) => void;
    onCellHeightChange?: (dateKey: string, height: number) => void;
}

export default function CalendarGrid({
    weeks,
    sortedEvents,
    today,
    isMobile = false,
    dragStart,
    dragEnd,
    isDragging,
    cellRefs,
    cellHeights,
    onEditEvent,
    onDeleteEvent,
    onEventClick,
    onDateClick,
    onDragStart,
    onDragEnter,
    onHiddenCountClick,
    onCellHeightChange,
}: CalendarGridProps) {
    const dateHeaderHeight = isMobile ? 40 : 48;
    const bottomPadding = 18;
    const tagLayerTop = isMobile ? 36 : 48;

    // 모바일: 작은 사각형 태그로 세로 쌓기(참고: 네이버 캘린더 스타일), 데스크톱: 기존 태그 높이
    const tagHeight = isMobile ? 20 : 22; // 모바일: 태그 한 줄 높이(20px), 데스크톱: 22px
    const tagSpacing = isMobile ? 2 : 6; // 모바일: 태그 간격(2px), 데스크톱: 6px

    const pad = (n: number) => (n < 10 ? "0" + n : String(n));
    const rowIndexByEvent = new Map<string, number>();

    useEffect(() => {
        // Prefetch visible worklog details in the background to reduce menu loading time.
        const workLogIds = Array.from(
            new Set(
                sortedEvents
                    .filter((e) => e.id.startsWith("worklog-"))
                    .map((e) => parseInt(e.id.replace("worklog-", ""), 10))
                    .filter((id) => !Number.isNaN(id))
            )
        ).slice(0, 50);

        if (workLogIds.length === 0) return;

        let cancelled = false;
        const runPrefetch = () => {
            if (cancelled) return;
            workLogIds.forEach((id) => {
                prefetchWorkLogById(id);
            });
        };

        if ("requestIdleCallback" in window) {
            const idleId = (window as any).requestIdleCallback(runPrefetch, { timeout: 1500 });
            return () => {
                cancelled = true;
                (window as any).cancelIdleCallback?.(idleId);
            };
        }

        const timer = window.setTimeout(runPrefetch, 300);
        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [sortedEvents]);

    return (
        <div
            dir="ltr"
            className="bg-white flex-1 flex flex-col min-h-0 min-w-[280px]"
            style={{
                overflowX: 'auto',
                overflowY: 'auto',
                WebkitOverflowScrolling: 'touch'
            }}
        >
            {weeks.map((week, weekIdx) => {
                // 주 단위 이벤트 행 정보 가져오기
                const weekEventRows = getWeekEventRows(
                    week,
                    sortedEvents,
                    rowIndexByEvent
                );
                const weekStartKey = getSafeDateKey(week[0].date);
                const weekEndKey = getSafeDateKey(week[6].date);
                weekEventRows.forEach((segment) => {
                    const startKey = segment.event.startDate.slice(0, 10);
                    if (startKey >= weekStartKey && startKey <= weekEndKey) {
                        rowIndexByEvent.set(segment.event.id, segment.rowIndex);
                    } else if (!rowIndexByEvent.has(segment.event.id)) {
                        rowIndexByEvent.set(segment.event.id, segment.rowIndex);
                    }
                });

                // 각 날짜 셀의 최소 높이를 계산하여 표시 가능한 행 수 결정
                const weekCellHeights = week.map(({ date }) => {
                    const dateKey = `${date.getFullYear()}-${pad(
                        date.getMonth() + 1
                    )}-${pad(date.getDate())}`;
                    return cellHeights[dateKey] || 0;
                });

                const minCellHeight = Math.min(
                    ...weekCellHeights.filter((h) => h > 0)
                );
                const availableHeight = Math.max(
                    0,
                    minCellHeight - dateHeaderHeight - bottomPadding
                );
                const maxVisibleRows =
                    availableHeight > 0
                        ? Math.ceil(
                            (availableHeight + tagSpacing) /
                            (tagHeight + tagSpacing)
                        )
                        : 3;

                return (
                    <WeekRow
                        key={weekIdx}
                        week={week}
                        weekIdx={weekIdx}
                        weekEventRows={weekEventRows}
                        today={today}
                        isMobile={isMobile}
                        tagLayerTop={tagLayerTop}
                        dragStart={dragStart}
                        dragEnd={dragEnd}
                        isDragging={isDragging}
                        cellRefs={cellRefs}
                        getColumnPadding={getColumnPadding}
                        getSafeDateKey={getSafeDateKey}
                        getEventsForDate={(dateKey) =>
                            getEventsForDate(dateKey, sortedEvents)
                        }
                        maxVisibleRows={maxVisibleRows}
                        tagHeight={tagHeight}
                        tagSpacing={tagSpacing}
                        cellHeights={cellHeights}
                        onEditEvent={onEditEvent}
                        onDeleteEvent={onDeleteEvent}
                        onEventClick={onEventClick}
                        onDateClick={onDateClick}
                        onDragStart={onDragStart}
                        onDragEnter={onDragEnter}
                        onHiddenCountClick={onHiddenCountClick}
                        onCellHeightChange={onCellHeightChange}
                    />
                );
            })}
        </div>
    );
}
