import React, { useState, useEffect } from "react";
import WeekRow from "../../../components/calendar/WeekRow";
import { CalendarEvent } from "../../../types";
import { getWeekEventRows, getEventsForDate, getSafeDateKey, getColumnPadding } from "../../../utils/calendarUtils";

interface CalendarGridProps {
    weeks: { date: Date; inMonth: boolean }[][];
    sortedEvents: CalendarEvent[];
    today: Date;
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
    onHiddenCountClick: (dateKey: string, threshold: number) => void;
    onCellHeightChange?: (dateKey: string, height: number) => void;
}

export default function CalendarGrid({
    weeks,
    sortedEvents,
    today,
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
    const dateHeaderHeight = 48;
    const bottomPadding = 18;
    // 모바일 반응형: 작은 화면에서는 태그 높이와 간격을 줄임
    const [isMobile, setIsMobile] = useState(
        typeof window !== 'undefined' && window.innerWidth < 768
    );

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 768);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // 모바일에서는 점 형태로 표시되므로 높이와 간격을 작게 설정
    const tagHeight = isMobile ? 8 : 22; // 모바일: 점 높이(8px), 데스크톱: 태그 높이(22px)
    const tagSpacing = isMobile ? 4 : 6; // 모바일: 점 간격(4px), 데스크톱: 태그 간격(6px)

    const pad = (n: number) => (n < 10 ? "0" + n : String(n));

    return (
        <div
            className="bg-white flex-1 flex flex-col min-h-0"
            style={{
                overflowX: 'auto', // 모바일에서 가로 스크롤 허용
                overflowY: 'auto',
                WebkitOverflowScrolling: 'touch' // iOS 부드러운 스크롤
            }}
        >
            {weeks.map((week, weekIdx) => {
                // 주 단위 이벤트 행 정보 가져오기
                const weekEventRows = getWeekEventRows(week, sortedEvents);

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

