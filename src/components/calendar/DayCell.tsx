import React from "react";
import CalendarTag from "../common/CalendarTag";
import { CalendarEvent } from "../../types";

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
}) => {
    // 공휴일 이벤트 찾기 (날짜 옆에 작은 태그로 표시)
    const holidayEvent = getEventsForDate(dateKey).find(event => event.isHoliday);
    
    // 공휴일이 아닌 이벤트만 태그로 표시
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
            className={`pt-2 pb-3 px-4 relative ${dayIdx < 6 ? "border-r border-gray-200" : ""
                } ${inMonth ? "cursor-pointer" : "cursor-default"
                } transition-colors select-none flex flex-col ${isInDragRange
                    ? "bg-blue-50"
                    : inMonth
                        ? "bg-white hover:bg-gray-50"
                        : "bg-white text-gray-400"
                }`}
            style={{
                overflow: 'hidden',
                position: 'relative',
                isolation: 'isolate',
            }}
        >
            {/* 날짜 숫자 영역 - 높이 고정하여 일정 시작 위치 통일 */}
            <div className={`${columnPadding} relative h-[30px]`}>
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
                {/* 공휴일 태그를 날짜 숫자 옆에 배치 (이전 위치로 복원) */}
                {holidayEvent && (
                    <div 
                        className="absolute top-0 left-[calc(1rem+30px)] flex items-center pointer-events-auto z-20"
                        style={{ pointerEvents: 'auto' }}
                    >
                        <CalendarTag
                            title={holidayEvent.title}
                            variant="holiday"
                            isStart={true}
                            isEnd={true}
                            width="auto"
                        />
                    </div>
                )}
            </div>

            {/* 태그 영역 - absolute로 배치하여 셀 높이 변경 없음, overflow로 클리핑 */}
            {/* 공휴일 태그 유무와 관계없이 일정 태그는 항상 같은 위치에서 시작 */}
            <div
                className="absolute left-0 right-0 pointer-events-none"
                style={{
                    top: `${tagLayerTop}px`, // 항상 같은 위치에서 시작
                    left: 0,
                    right: 0,
                    overflow: 'hidden',
                    height: hiddenCount > 0
                        ? `calc(100% - ${tagLayerTop}px - 24px)`
                        : `calc(100% - ${tagLayerTop}px)`,
                }}
            >
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

                    let width = "100%";
                    let left = "0px";
                    if (isStartInCell && isEndInCell) {
                        // 시작과 끝 모두 이 셀에 있으면 양쪽 간격
                        width = "calc(100% - 16px)";
                        left = "8px";
                    } else if (isStartInCell) {
                        // 시작만 이 셀에 있으면 왼쪽 간격
                        width = "calc(100% - 8px)";
                        left = "8px";
                    } else if (isEndInCell) {
                        // 끝만 이 셀에 있으면 오른쪽 간격
                        width = "calc(100% - 8px)";
                        left = "0px";
                    } else {
                        // 중간에 있는 태그는 간격 없음
                        width = "100%";
                        left = "0px";
                    }

                    // rowIndex로 위치 계산
                    // 공휴일 태그 유무와 관계없이 일정 태그는 항상 같은 위치에서 시작하므로
                    // 단순히 rowIndex로 계산하면 됨
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
                    className="absolute left-0 right-0 bottom-0 pointer-events-auto z-40 cursor-pointer flex items-center justify-center bg-white/95 border-t border-gray-200"
                    style={{
                        height: '24px',
                    }}
                    onClick={(e) => {
                        e.stopPropagation();
                        onHiddenCountClick();
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(249, 250, 251, 0.95)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.95)';
                    }}
                >
                    <span className="text-[12px] font-semibold text-gray-700 select-none">
                        +{hiddenCount}개
                    </span>
                </div>
            )}
        </div>
    );
};

export default DayCell;
