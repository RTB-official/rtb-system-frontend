import React from "react";
import CalendarTag from "../common/CalendarTag";
import DayCell from "./DayCell";
import { CalendarEvent } from "../../types";

interface WeekEventSegment {
    event: CalendarEvent;
    startOffset: number;
    duration: number;
    rowIndex: number;
}

interface WeekRowProps {
    week: { date: Date; inMonth: boolean }[];
    weekIdx: number;
    weekEventRows: WeekEventSegment[];
    today: Date;
    dragStart: string | null;
    dragEnd: string | null;
    isDragging: boolean;
    cellRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
    getColumnPadding: (dayIdx: number) => string;
    getSafeDateKey: (date: Date) => string;
    getEventsForDate: (dateKey: string) => CalendarEvent[];
    maxVisibleRows: number;
    tagHeight: number;
    tagSpacing: number;
    onEditEvent: (event: CalendarEvent) => void;
    onDeleteEvent: (eventId: string) => void;
    onEventClick: (event: CalendarEvent, e: React.MouseEvent) => void;
    onDateClick: (dateKey: string, e: React.MouseEvent) => void;
    onDragStart: (dateKey: string, e: React.MouseEvent) => void;
    onDragEnter: (dateKey: string) => void;
    onHiddenCountClick: (dateKey: string, threshold: number) => void;
}

const WeekRow: React.FC<WeekRowProps> = ({
    week,
    weekIdx,
    weekEventRows,
    today,
    dragStart,
    dragEnd,
    isDragging,
    cellRefs,
    getColumnPadding,
    getSafeDateKey,
    getEventsForDate,
    maxVisibleRows,
    tagHeight,
    tagSpacing,
    onEditEvent,
    onDeleteEvent,
    onEventClick,
    onDateClick,
    onDragStart,
    onDragEnter,
    onHiddenCountClick,
}) => {
    const pad = (n: number) => (n < 10 ? "0" + n : String(n));

    // 각 날짜별로 마지막 행 태그와 +n개 겹침 여부를 미리 계산
    const shouldHideLastRowTag = new Map<number, boolean>();
    week.forEach(({ date }, dayIdx) => {
        const dateKey = `${date.getFullYear()}-${pad(
            date.getMonth() + 1
        )}-${pad(date.getDate())}`;
        
        const dayEvents = getEventsForDate(dateKey);
        const daySegments = weekEventRows.filter(
            (segment) =>
                segment.startOffset <= dayIdx &&
                dayIdx < segment.startOffset + segment.duration
        );
        
        const visibleRowIndices = new Set(
            daySegments
                .filter((s) => s.rowIndex < maxVisibleRows)
                .map((s) => s.rowIndex)
        );
        
        const hiddenCountRaw = dayEvents.filter((event) => {
            const segment = daySegments.find(
                (s) => s.event.id === event.id
            );
            return segment && !visibleRowIndices.has(segment.rowIndex);
        }).length;
        
        const hasLastRowTag = daySegments.some(
            (s) => s.rowIndex === maxVisibleRows - 1
        );
        
        // 마지막 행에 태그가 있고 숨겨진 태그가 있으면, 마지막 행 태그를 숨김
        shouldHideLastRowTag.set(dayIdx, hasLastRowTag && hiddenCountRaw > 0);
    });

    // 태그는 maxVisibleRows까지 표시하되, 특정 날짜의 마지막 행 태그는 조건부로 숨김
    const visibleSegments = weekEventRows.filter((segment) => {
        if (segment.rowIndex >= maxVisibleRows) return false;
        
        // 마지막 행 태그인 경우, 해당 날짜에서 숨겨야 하는지 확인
        if (segment.rowIndex === maxVisibleRows - 1) {
            // 이 세그먼트가 포함된 모든 날짜를 확인
            for (let dayIdx = segment.startOffset; dayIdx < segment.startOffset + segment.duration; dayIdx++) {
                if (shouldHideLastRowTag.get(dayIdx)) {
                    return false; // 이 날짜에서 마지막 행 태그를 숨김
                }
            }
        }
        
        return true;
    });

    return (
        <div
            key={weekIdx}
            className="flex-1 grid grid-cols-7 border-b border-gray-200 relative overflow-hidden"
        >
            {/* 주 단위 이벤트 렌더링 */}
            <div
                className="absolute inset-0 pointer-events-none"
                style={{ top: "46px" }}
            >
                {visibleSegments.map((segment) => {
                    const left = (segment.startOffset / 7) * 100;
                    const width = (segment.duration / 7) * 100;

                    const startDayDate = week[segment.startOffset]?.date;
                    const endDayDate =
                        week[
                            Math.min(
                                6,
                                segment.startOffset + segment.duration - 1
                            )
                        ]?.date;

                    if (!startDayDate || !endDayDate) return null;

                    const isEventStart =
                        segment.event.startDate ===
                        getSafeDateKey(startDayDate);
                    const isEventEnd =
                        segment.event.endDate === getSafeDateKey(endDayDate);

                    return (
                        <CalendarTag
                            key={`${segment.event.id}-${segment.startOffset}-${segment.rowIndex}`}
                            title={
                                isEventStart || segment.startOffset === 0
                                    ? segment.event.title
                                    : ""
                            }
                            variant={
                                segment.event.isHoliday ? "holiday" : "event"
                            }
                            color={segment.event.color}
                            isStart={isEventStart}
                            isEnd={isEventEnd}
                            left={`${left}%`}
                            width={`calc(${width}% - ${
                                isEventStart ? 8 : 0
                            }px - ${isEventEnd ? 8 : 0}px)`}
                            top={`${
                                segment.rowIndex * (tagHeight + tagSpacing)
                            }px`}
                            onEdit={
                                segment.event.isHoliday
                                    ? undefined
                                    : () => onEditEvent(segment.event)
                            }
                            onDelete={
                                segment.event.isHoliday
                                    ? undefined
                                    : () => onDeleteEvent(segment.event.id)
                            }
                            onClick={
                                segment.event.isHoliday
                                    ? undefined
                                    : (e) => onEventClick(segment.event, e)
                            }
                        />
                    );
                })}
            </div>

            {/* 각 날짜 셀 렌더링 */}
            {week.map(({ date, inMonth }, dayIdx) => {
                const dateKey = `${date.getFullYear()}-${pad(
                    date.getMonth() + 1
                )}-${pad(date.getDate())}`;

                const isToday =
                    date.getFullYear() === today.getFullYear() &&
                    date.getMonth() === today.getMonth() &&
                    date.getDate() === today.getDate();

                // 드래그 선택 범위 확인
                const isInDragRange =
                    dragStart &&
                    dragEnd &&
                    (() => {
                        const start = new Date(dragStart);
                        const end = new Date(dragEnd);
                        const current = new Date(dateKey);
                        const minDate = start < end ? start : end;
                        const maxDate = start < end ? end : start;
                        return current >= minDate && current <= maxDate;
                    })();

                const columnPadding = getColumnPadding(dayIdx);

                // 해당 날짜의 이벤트 가져오기
                const dayEvents = getEventsForDate(dateKey);

                // 해당 날짜에 해당하는 세그먼트 필터링
                const daySegments = weekEventRows.filter(
                    (segment) =>
                        segment.startOffset <= dayIdx &&
                        dayIdx < segment.startOffset + segment.duration
                );

                // 숨겨진 이벤트 개수 계산
                const visibleRowIndices = new Set(
                    daySegments
                        .filter((s) => s.rowIndex < maxVisibleRows)
                        .map((s) => s.rowIndex)
                );
                
                const hiddenCountRaw = dayEvents.filter((event) => {
                    const segment = daySegments.find(
                        (s) => s.event.id === event.id
                    );
                    return segment && !visibleRowIndices.has(segment.rowIndex);
                }).length;
                
                // 마지막 행 태그가 숨겨져 있으면 +n개에 포함
                const isLastRowTagHidden = shouldHideLastRowTag.get(dayIdx) || false;
                const hiddenCount = isLastRowTagHidden 
                    ? hiddenCountRaw + 1 
                    : hiddenCountRaw;

                return (
                    <DayCell
                        key={dayIdx}
                        date={date}
                        inMonth={inMonth}
                        dayIdx={dayIdx}
                        dateKey={dateKey}
                        isToday={isToday}
                        isInDragRange={!!isInDragRange}
                        columnPadding={columnPadding}
                        hiddenCount={hiddenCount}
                        maxVisibleRows={maxVisibleRows}
                        cellRefs={cellRefs}
                        onMouseDown={(e) => {
                            if (e.button === 0) {
                                onDragStart(dateKey, e);
                            }
                        }}
                        onMouseEnter={() => {
                            if (isDragging && dragStart) {
                                onDragEnter(dateKey);
                            }
                        }}
                        onClick={(e) => {
                            if (!inMonth) return;
                            if (!isDragging && !dragStart) {
                                onDateClick(dateKey, e);
                            }
                        }}
                        onHiddenCountClick={() => {
                            onHiddenCountClick(dateKey, maxVisibleRows);
                        }}
                    />
                );
            })}
        </div>
    );
};

export default WeekRow;
