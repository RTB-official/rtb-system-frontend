import React from "react";
import CalendarTag from "../common/CalendarTag";
import { CalendarEvent } from "../../types";
import { CELL_PADDING_LEFT, CELL_PADDING_RIGHT } from "../../utils/calendarConstants";

interface WeekEventSegment {
    event: CalendarEvent;
    startOffset: number;
    duration: number;
    rowIndex: number;
}

interface DayCellProps {
    date: Date;
    inMonth: boolean;
    dayIdx: number;
    dateKey: string;
    isToday: boolean;
    isInDragRange: boolean;
    columnPadding: string;
    hiddenCount: number;
    onHiddenCountClick: () => void;
    cellRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
    tagHeight: number;
    tagSpacing: number;
    tagLayerTop: number;
    visibleSegments: WeekEventSegment[];
    week: { date: Date; inMonth: boolean }[];
    getSafeDateKey: (date: Date) => string;
    onEditEvent: (event: any) => void;
    onDeleteEvent: (eventId: string) => void;
    onEventClick: (event: any, e: React.MouseEvent) => void;
    onMouseDown: (e: React.MouseEvent) => void;
    onMouseEnter: () => void;
    onClick: (e: React.MouseEvent) => void;
    getEventsForDate: (dateKey: string) => CalendarEvent[];
    onCellHeightChange?: (dateKey: string, height: number) => void;
}

const DayCell: React.FC<DayCellProps> = ({
    date,
    inMonth,
    dayIdx,
    dateKey,
    isToday,
    isInDragRange,
    columnPadding,
    hiddenCount,
    onHiddenCountClick,
    cellRefs,
    tagHeight,
    tagSpacing,
    tagLayerTop,
    visibleSegments,
    week,
    getSafeDateKey,
    onEditEvent,
    onDeleteEvent,
    onEventClick,
    onMouseDown,
    onMouseEnter,
    onClick,
    getEventsForDate,
    onCellHeightChange,
}) => {

    // 셀 높이 측정
    const heightRef = React.useRef<number>(0);
    const onCellHeightChangeRef = React.useRef(onCellHeightChange);

    // onCellHeightChange ref 업데이트
    React.useEffect(() => {
        onCellHeightChangeRef.current = onCellHeightChange;
    }, [onCellHeightChange]);

    React.useEffect(() => {
        const cellElement = cellRefs.current[dateKey];
        if (!cellElement) return;

        // ResizeObserver로 높이 변경 감지
        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                if (entry.target === cellElement) {
                    const newHeight = entry.contentRect.height;
                    // 높이가 실제로 변경되었을 때만 호출 (무한 루프 방지)
                    if (newHeight > 0 && newHeight !== heightRef.current) {
                        heightRef.current = newHeight;
                        if (onCellHeightChangeRef.current) {
                            onCellHeightChangeRef.current(dateKey, newHeight);
                        }
                    }
                }
            }
        });
        resizeObserver.observe(cellElement);

        // 초기 높이 측정 (한 번만)
        const initialHeight = cellElement.offsetHeight;
        if (initialHeight > 0 && initialHeight !== heightRef.current) {
            heightRef.current = initialHeight;
            if (onCellHeightChangeRef.current) {
                onCellHeightChangeRef.current(dateKey, initialHeight);
            }
        }

        return () => {
            resizeObserver.disconnect();
        };
    }, [dateKey]); // onCellHeightChange를 의존성에서 제거하여 무한 루프 방지

    // 공휴일과 일반 이벤트 분리 (공휴일은 제일 위에 배치)
    const holidaySegments = visibleSegments.filter(seg => seg.event.isHoliday);
    const nonHolidaySegments = visibleSegments.filter(seg => !seg.event.isHoliday);
    return (
        <div
            key={dayIdx}
            data-date-key={dateKey}
            ref={(el) => {
                if (el) {
                    cellRefs.current[dateKey] = el;
                } else {
                    delete cellRefs.current[dateKey];
                }
            }}
            onMouseDown={onMouseDown}
            onMouseEnter={onMouseEnter}
            onClick={onClick}
            className={`p-2 relative ${dayIdx < 6 ? "border-r border-gray-200" : ""
                } ${inMonth ? "cursor-pointer" : "cursor-default"
                } transition-colors select-none flex flex-col ${isInDragRange
                    ? "bg-blue-50"
                    : inMonth
                        ? "bg-white hover:bg-gray-50"
                        : "bg-white text-gray-400"
                }`}
            style={{
                overflowX: 'visible', // 가로 방향으로는 잘리지 않게 (연속된 태그의 텍스트를 위해)
                overflowY: 'hidden', // 세로 방향으로는 잘리게
                position: 'relative',
                isolation: 'isolate',
            }}
        >
            <div className={`${columnPadding} flex items-start`}>
                <div className="w-7.5 h-7.5 flex items-center justify-center relative">
                    {isToday && (
                        <div className="absolute inset-0 rounded-full bg-blue-500" />
                    )}
                    <div
                        data-date-number
                        className={`relative z-10 text-[17px] font-medium ${isToday
                            ? "text-white"
                            : !inMonth
                                ? "text-gray-400"
                                : date.getDay() === 0
                                    ? "text-red-500"
                                    : date.getDay() === 6
                                        ? "text-blue-500"
                                        : "text-gray-800"
                            }`}
                    >
                        {date.getDate()}
                    </div>
                </div>
            </div>

            {/* 태그 영역 - 연속된 태그가 셀 경계를 넘어가도록 left: 0, right: 0 */}
            <div
                className="absolute left-0 right-0 pointer-events-none"
                style={{
                    top: `${tagLayerTop}px`,
                    left: 0,
                    right: 0,
                    bottom: hiddenCount > 0 ? '16px' : '0px', // +n개 표시 시에만 24px 공간 확보
                    overflowX: 'visible', // 연속된 태그가 셀 경계를 넘어가도록
                    overflowY: 'hidden',
                    zIndex: 10,
                }}
            >
                {/* 공휴일 태그 */}
                {holidaySegments.map((segment) => {
                    const isStartInCell = segment.startOffset === dayIdx;
                    const isEndInCell = segment.startOffset + segment.duration - 1 === dayIdx;

                    const startDayDate = week[segment.startOffset]?.date;
                    const endDayDate = week[
                        Math.min(6, segment.startOffset + segment.duration - 1)
                    ]?.date;

                    if (!startDayDate || !endDayDate) return null;

                    const isEventStart =
                        segment.event.startDate === getSafeDateKey(startDayDate);
                    const isEventEnd =
                        segment.event.endDate === getSafeDateKey(endDayDate);

                    // 연속된 태그가 셀 경계를 넘어가도록 위치 조정
                    let width = "100%";
                    let left = "0px";
                    if (isStartInCell && isEndInCell) {
                        // 시작과 끝 모두 이 셀에 있으면 양쪽 패딩
                        width = `calc(100% - ${CELL_PADDING_LEFT + CELL_PADDING_RIGHT}px)`;
                        left = `${CELL_PADDING_LEFT}px`;
                    } else if (isStartInCell) {
                        // 시작만 이 셀에 있으면 왼쪽 패딩
                        width = `calc(100% - ${CELL_PADDING_LEFT}px)`;
                        left = `${CELL_PADDING_LEFT}px`;
                    } else if (isEndInCell) {
                        // 끝만 이 셀에 있으면 오른쪽 패딩
                        width = `calc(100% - ${CELL_PADDING_RIGHT}px)`;
                        left = "0px";
                    } else {
                        // 중간에 있는 태그는 패딩 없음 (연속된 태그)
                        width = "100%";
                        left = "0px";
                    }

                    // 공휴일도 rowIndex 기준으로 배치 (우선순위 낮춤)
                    const top = segment.rowIndex * (tagHeight + tagSpacing);

                    return (
                        <CalendarTag
                            key={`${segment.event.id}-${dayIdx}-holiday`}
                            title={isEventStart && isStartInCell ? segment.event.title : ""}
                            color={segment.event.color}
                            variant="holiday"
                            isStart={isEventStart && isStartInCell}
                            isEnd={isEventEnd && isEndInCell}
                            width={width}
                            eventId={segment.event.id}
                            style={{
                                position: 'absolute',
                                top: `${top}px`,
                                left: left,
                                maxWidth: '100%',
                            }}
                            onClick={(e) => onEventClick(segment.event, e)}
                        />
                    );
                })}

                {/* 일반 이벤트 태그 (공휴일이 있으면 그 아래에 배치) */}
                {nonHolidaySegments.map((segment) => {
                    const isStartInCell = segment.startOffset === dayIdx;
                    const isEndInCell = segment.startOffset + segment.duration - 1 === dayIdx;

                    const startDayDate = week[segment.startOffset]?.date;
                    const endDayDate = week[
                        Math.min(6, segment.startOffset + segment.duration - 1)
                    ]?.date;

                    if (!startDayDate || !endDayDate) return null;

                    const isEventStart =
                        segment.event.startDate === getSafeDateKey(startDayDate);
                    const isEventEnd =
                        segment.event.endDate === getSafeDateKey(endDayDate);

                    // 연속된 태그가 셀 경계를 넘어가도록 위치 조정
                    let width = "100%";
                    let left = "0px";
                    if (isStartInCell && isEndInCell) {
                        // 시작과 끝 모두 이 셀에 있으면 양쪽 패딩
                        width = `calc(100% - ${CELL_PADDING_LEFT + CELL_PADDING_RIGHT}px)`;
                        left = `${CELL_PADDING_LEFT}px`;
                    } else if (isStartInCell) {
                        // 시작만 이 셀에 있으면 왼쪽 패딩
                        width = `calc(100% - ${CELL_PADDING_LEFT}px)`;
                        left = `${CELL_PADDING_LEFT}px`;
                    } else if (isEndInCell) {
                        // 끝만 이 셀에 있으면 오른쪽 패딩
                        width = `calc(100% - ${CELL_PADDING_RIGHT}px)`;
                        left = "0px";
                    } else {
                        // 중간에 있는 태그는 패딩 없음 (연속된 태그)
                        width = "100%";
                        left = "0px";
                    }

                    // rowIndex로 위치 계산
                    const top = segment.rowIndex * (tagHeight + tagSpacing);

                    return (
                        <CalendarTag
                            key={`${segment.event.id}-${dayIdx}-${segment.rowIndex}`}
                            title={
                                isEventStart && isStartInCell ? segment.event.title : ""
                            }
                            color={segment.event.color}
                            variant={segment.event.isHoliday ? "holiday" : "event"}
                            isStart={isEventStart && isStartInCell}
                            isEnd={isEventEnd && isEndInCell}
                            width={width}
                            eventId={segment.event.id}
                            style={{
                                position: 'absolute',
                                top: `${top}px`,
                                left: left,
                                maxWidth: '100%',
                            }}
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


            {/* +N개 표시 */}
            {hiddenCount > 0 && (
                <div
                    className="absolute left-0 right-0 bottom-0 pointer-events-auto z-40 cursor-pointer flex items-center justify-center"
                    style={{
                        height: '16px',
                    }}
                    onClick={(e) => {
                        e.stopPropagation();
                        onHiddenCountClick();
                    }}
                >
                    <span className="text-[12px] font-semibold text-gray-400 select-none">
                        +{hiddenCount}개
                    </span>
                </div>
            )}
        </div>
    );
};

export default DayCell;
