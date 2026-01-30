import React from "react";
import DayCell from "./DayCell";
import { CalendarEvent } from "../../types";
import { isVacationEvent, CALENDAR_TAG_ICON_SPACING, CALENDAR_TAG_ICON_SIZES } from "../../utils/calendarUtils";
import { TAG_LAYER_TOP, CELL_PADDING_LEFT, TAG_INNER_PADDING_LEFT } from "../../utils/calendarConstants";
import { useCalendarTagVisibility } from "../../hooks/useCalendarTagVisibility";

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

const pad = (n: number) => (n < 10 ? "0" + n : String(n));

const WeekRow: React.FC<WeekRowProps> = ({
    week,
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
    cellHeights,
    onEditEvent,
    onDeleteEvent,
    onEventClick,
    onDateClick,
    onDragStart,
    onDragEnter,
    onHiddenCountClick,
    onCellHeightChange,
}) => {
    // 각 날짜별로 보여줄 태그와 숨길 태그 계산
    const dateTagInfo = useCalendarTagVisibility(
        week,
        weekEventRows,
        cellHeights,
        tagHeight,
        tagSpacing
    );

    // 셀 너비 측정 (첫 번째 셀 기준) - 연속된 태그의 텍스트 위치 계산용
    const [cellWidth, setCellWidth] = React.useState<number>(0);

    React.useEffect(() => {
        if (week.length > 0) {
            const firstDate = week[0]?.date;
            if (!firstDate) return;

            const firstDateKey = `${firstDate.getFullYear()}-${pad(
                firstDate.getMonth() + 1
            )}-${pad(firstDate.getDate())}`;

            const firstCell = cellRefs.current[firstDateKey];
            if (!firstCell) return;

            const updateWidth = () => {
                const width = firstCell.offsetWidth || 0;
                if (width > 0) {
                    setCellWidth(width);
                }
            };

            updateWidth();
            const resizeObserver = new ResizeObserver(updateWidth);
            resizeObserver.observe(firstCell);
            return () => resizeObserver.disconnect();
        }
    }, [week, cellRefs]);

    const weekEndDate = week[week.length - 1]?.date;
    const weekEndKey = weekEndDate
        ? `${weekEndDate.getFullYear()}-${pad(weekEndDate.getMonth() + 1)}-${pad(
            weekEndDate.getDate()
        )}`
        : "";

    const isEventVisibleFromStart = (segment: WeekEventSegment) => {
        if (segment.rowIndex >= maxVisibleRows) return false;
        const startDate = week[segment.startOffset]?.date;
        if (!startDate) return true;
        const startDateKey = `${startDate.getFullYear()}-${pad(
            startDate.getMonth() + 1
        )}-${pad(startDate.getDate())}`;
        const startTagInfo = dateTagInfo.get(startDateKey);
        if (!startTagInfo) return true;
        return startTagInfo.visibleSegments.some(
            (s) => s.event.id === segment.event.id
        );
    };

    return (
        <div className="flex-1 grid grid-cols-7 border-b border-gray-200 relative" style={{ overflowX: 'visible' }}>
            {/* 연속된 태그의 텍스트를 WeekRow 레벨에 배치하여 전체 이벤트 너비에 걸쳐 표시 */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {cellWidth > 0 && weekEventRows
                .filter(segment => {
                    // 시작 셀에서만 텍스트 렌더링
                    const startDayIdx = segment.startOffset;
                    if (startDayIdx < 0 || startDayIdx >= week.length) return false;

                    const startDate = week[startDayIdx]?.date;
                    if (!startDate) return false;

                    const startDateKey = `${startDate.getFullYear()}-${pad(
                        startDate.getMonth() + 1
                    )}-${pad(startDate.getDate())}`;

                    const isVisible = isEventVisibleFromStart(segment);

                    // 연속된 태그만 (단일 셀 태그는 CalendarTag에서 표시)
                    const isMultiDay = segment.duration > 1;

                    return isVisible && segment.event.title && isMultiDay;
                })
                .map((segment) => {
                    const startDayIdx = segment.startOffset;
                    const startDate = week[startDayIdx]?.date;
                    if (!startDate) return null;

                    const startDateKey = `${startDate.getFullYear()}-${pad(
                        startDate.getMonth() + 1
                    )}-${pad(startDate.getDate())}`;

                    // 시작 셀의 위치 계산
                    const startCellLeft = startDayIdx * cellWidth;
                    const visibleDuration = Math.min(
                        segment.duration,
                        week.length - startDayIdx
                    );
                    const totalEventWidth = visibleDuration * cellWidth;

                    // 첫 셀의 패딩: 셀 패딩(12px) + 태그 내부 패딩(4px)
                    const firstCellPadding = CELL_PADDING_LEFT + TAG_INNER_PADDING_LEFT;
                    const lastCellPadding = CELL_PADDING_LEFT + TAG_INNER_PADDING_LEFT + 6;

                    const isHoliday = !!segment.event.isHoliday;
                    const isVacation = isVacationEvent(segment.event.title);
                    const isWorkLog = segment.event.id.startsWith("worklog-");
                    const isContinued = segment.event.endDate > weekEndKey;
                    const displayTitle = segment.event.title;
                    // 태그 타입별로 다른 간격 적용
                    // 텍스트 위치는 아이콘 너비 + 태그 타입별 간격을 사용
                    const iconSize = isHoliday ? CALENDAR_TAG_ICON_SIZES.holiday
                        : (isVacation || isWorkLog) ? CALENDAR_TAG_ICON_SIZES.vacation
                            : CALENDAR_TAG_ICON_SIZES.general;
                    const iconSpacing = isHoliday ? CALENDAR_TAG_ICON_SPACING.holiday
                        : (isVacation || isWorkLog) ? CALENDAR_TAG_ICON_SPACING.vacation
                            : CALENDAR_TAG_ICON_SPACING.general;
                    const iconWidth = iconSize + iconSpacing;

                    const top = segment.rowIndex * (tagHeight + tagSpacing);

                    // 모바일 반응형: 모바일에서는 텍스트 숨김 (점만 표시)
                    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

                    // 모바일에서는 텍스트를 표시하지 않음
                    if (isMobile) {
                        return null;
                    }

                    const textSize = 'text-[14px]';
                    const textWidth = Math.max(
                        0,
                        totalEventWidth - firstCellPadding - lastCellPadding - iconWidth
                    );

                    if (textWidth === 0) {
                        return null;
                    }

                    return (
                        <span
                            key={`text-${segment.event.id}-${startDayIdx}`}
                            className={`${textSize} leading-none absolute ${isHoliday
                                ? "font-medium text-red-600"
                                : "font-medium text-gray-800"
                                }`}
                            style={{
                                display: 'block',
                                left: `${startCellLeft + firstCellPadding + iconWidth}px`,
                                width: `${textWidth}px`,
                                maxWidth: `${textWidth}px`,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                top: `${TAG_LAYER_TOP + top + tagHeight / 2}px`,
                                transform: 'translateY(-50%)',
                                zIndex: 30,
                            }}
                        >
                            {displayTitle}
                        </span>
                    );
                })}
            </div>

            {/* 날짜 셀 */}
            {week.map(({ date, inMonth }, dayIdx) => {
                const dateKey = `${date.getFullYear()}-${pad(
                    date.getMonth() + 1
                )}-${pad(date.getDate())}`;

                const isToday =
                    date.toDateString() === today.toDateString();

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

                const daySegments = weekEventRows.filter((segment) => {
                    const segmentEnd = segment.startOffset + segment.duration;
                    return segment.startOffset <= dayIdx && dayIdx < segmentEnd;
                });
                const visibleSegments = daySegments.filter(
                    (segment) =>
                        segment.rowIndex < maxVisibleRows &&
                        isEventVisibleFromStart(segment)
                );
                const hiddenEventIds = daySegments
                    .filter((segment) => !visibleSegments.some((s) => s.event.id === segment.event.id))
                    .map((segment) => segment.event.id);
                const cellHeight = cellHeights[dateKey] || 0;

                return (
                    <DayCell
                        key={dayIdx}
                        date={date}
                        inMonth={inMonth}
                        dayIdx={dayIdx}
                        dateKey={dateKey}
                        isToday={isToday}
                        isInDragRange={!!isInDragRange}
                        columnPadding={getColumnPadding(dayIdx)}
                        hiddenCount={hiddenEventIds.length}
                        onHiddenCountClick={() =>
                            onHiddenCountClick(dateKey, hiddenEventIds)
                        }
                        cellRefs={cellRefs}
                        tagHeight={tagHeight}
                        tagSpacing={tagSpacing}
                        tagLayerTop={TAG_LAYER_TOP}
                        visibleSegments={
                            cellHeight > 0
                                ? visibleSegments
                                : daySegments
                        }
                        week={week}
                        getSafeDateKey={getSafeDateKey}
                        getEventsForDate={getEventsForDate}
                        onEditEvent={onEditEvent}
                        onDeleteEvent={onDeleteEvent}
                        onEventClick={onEventClick}
                        onMouseDown={(e) => onDragStart(dateKey, e)}
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
                        onCellHeightChange={onCellHeightChange}
                    />
                );
            })}
        </div>
    );
};

export default WeekRow;
