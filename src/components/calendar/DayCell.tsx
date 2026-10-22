import React from "react";
import CalendarTag from "../common/CalendarTag";
import { IconExclamation } from "../icons/Icons";
import { CalendarEvent } from "../../types";
import { CELL_PADDING_LEFT, CELL_PADDING_RIGHT } from "../../utils/calendarConstants";
import type { DateRangeRole } from "../../utils/calendarUtils";

interface WeekEventSegment {
    event: CalendarEvent;
    startOffset: number;
    duration: number;
    rowIndex: number;
}

interface DayCellProps {
    date: Date;
    inMonth: boolean;
    /** 2개월 뷰의 두 번째 달 — 밝은 회색 배경 */
    isFollowingMonth?: boolean;
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
    tagInsetLeft?: number;
    isMobile?: boolean;
    visibleSegments: WeekEventSegment[];
    week: { date: Date; inMonth: boolean }[];
    getSafeDateKey: (date: Date) => string;
    onEditEvent: (event: any) => void;
    onDeleteEvent: (eventId: string) => void;
    onEventClick: (event: any, e: React.MouseEvent) => void;
    onMouseDown: (e: React.MouseEvent) => void;
    onMouseEnter: () => void;
    onClick: (e: React.MouseEvent) => void;
    rangeRole?: DateRangeRole | null;
    scheduleMarks?: {
        id: string;
        role: DateRangeRole;
        lane: number;
        ratio: number;
        color: string;
        shipName: string;
        teamMember: string;
        priorLaneRatios: number[];
    }[];
    scheduleCellHeight?: number;
    dayAvailability?: { leaders: number; members: number; names: string[] };
    /** 개인 일정 — 날짜칸 상단 빨간 이름 + 호버 팝오버 */
    personalEntries?: {
        id: string;
        start: string;
        end: string;
        names: string[];
        reason: string;
    }[];
    onPersonalEntryClick?: (entry: {
        id: string;
        start: string;
        end: string;
        names: string[];
        reason: string;
    }) => void;
    onDayScheduleHover?: (info: DayScheduleHoverInfo) => void;
    onDayScheduleLeave?: () => void;
    allowOutsideMonthSelect?: boolean;
    getEventsForDate: (dateKey: string) => CalendarEvent[];
    onCellHeightChange?: (dateKey: string, height: number) => void;
}

function scheduleBarEdgeStyle(
    role: DateRangeRole,
    color: string
): React.CSSProperties {
    // Fill the cell's right border with the bar color so multi-day spans look continuous.
    const joinRight = { boxShadow: `1px 0 0 0 ${color}` };
    if (role === "start") {
        return { left: 6, right: 0, borderRadius: "6px 0 0 6px", ...joinRight };
    }
    if (role === "end") {
        return { left: 0, right: 6, borderRadius: "0 6px 6px 0" };
    }
    if (role === "middle") {
        return { left: 0, right: 0, borderRadius: 0, ...joinRight };
    }
    return { left: 6, right: 6, borderRadius: 6 };
}

export type DayScheduleHoverInfo = {
    dateKey: string;
    schedules: { id: string; shipName: string; teamMember: string; color: string }[];
    anchorEl: HTMLElement;
};

function ScheduleBarMark({
    mark,
    top,
    height,
}: {
    mark: {
        id: string;
        role: DateRangeRole;
        color: string;
        shipName: string;
        teamMember: string;
    };
    top: number;
    height: number;
}) {
    return (
        <div
            aria-hidden
            className="pointer-events-none absolute z-[2]"
            style={{
                top,
                height,
                backgroundColor: mark.color,
                ...scheduleBarEdgeStyle(mark.role, mark.color),
            }}
        />
    );
}

function stackedScheduleMarks(
    marks: {
        id: string;
        role: DateRangeRole;
        lane: number;
        ratio: number;
        color: string;
        shipName: string;
        teamMember: string;
        priorLaneRatios: number[];
    }[],
    isMobile: boolean,
    cellHeight: number
) {
    const baseTop = isMobile ? 28 : 40;
    const minHeight = isMobile ? 4 : 6;
    const gap = 2;
    if (marks.length === 0) return [];
    const available = Math.max(minHeight, cellHeight > 0 ? cellHeight - baseTop - 4 : 80);

    const rawHeight = (ratio: number) => {
        const clamped = Math.min(1, Math.max(0, ratio));
        return Math.max(minHeight, available * clamped);
    };

    return marks.map((mark) => {
        let offset = 0;
        mark.priorLaneRatios.forEach((ratio) => {
            offset += rawHeight(ratio) + gap;
        });
        return {
            mark,
            top: baseTop + offset,
            height: rawHeight(mark.ratio),
        };
    });
}

const DayCell: React.FC<DayCellProps> = ({
    date,
    inMonth,
    isFollowingMonth = false,
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
    tagInsetLeft = 0,
    visibleSegments,
    week,
    getSafeDateKey,
    onEditEvent,
    onDeleteEvent,
    onEventClick,
    onMouseDown,
    onMouseEnter,
    onClick,
    rangeRole = null,
    scheduleMarks = [],
    scheduleCellHeight = 0,
    dayAvailability,
    personalEntries = [],
    onPersonalEntryClick,
    onDayScheduleHover,
    onDayScheduleLeave,
    allowOutsideMonthSelect = false,
    getEventsForDate,
    onCellHeightChange,
    isMobile = false,
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

    const pointsRight = rangeRole === "pending" || rangeRole === "start";
    const pointsLeft = rangeRole === "end";
    const isRangeMarker =
        rangeRole === "single" || pointsRight || pointsLeft;
    const isWeekdayHoliday =
        date.getDay() !== 0 &&
        date.getDay() !== 6 &&
        getEventsForDate(dateKey).some((event) => event.isHoliday);
    const canSelect = inMonth || allowOutsideMonthSelect;

    const placeBesideDate = (left: string, width: string) => {
        if (!tagInsetLeft) return { left, width };
        const baseLeft = left.endsWith("px") ? Number.parseFloat(left) : 0;
        const nextLeft = Math.max(baseLeft, tagInsetLeft);
        const extra = nextLeft - baseLeft;
        return {
            left: `${nextLeft}px`,
            width: extra > 0 ? `calc(${width} - ${extra}px)` : width,
        };
    };
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
            onMouseEnter={(event) => {
                onMouseEnter();
                // 공사 일정이 있는 날만 상세 팝오버 (빈 날·개인일정만 있는 날은 열지 않음)
                if (scheduleMarks.length === 0) return;
                onDayScheduleHover?.({
                    dateKey,
                    schedules: scheduleMarks.map((mark) => ({
                        id: mark.id,
                        shipName: mark.shipName,
                        teamMember: mark.teamMember,
                        color: mark.color,
                    })),
                    anchorEl: event.currentTarget,
                });
            }}
            onMouseLeave={() => onDayScheduleLeave?.()}
            onClick={onClick}
            aria-selected={rangeRole != null}
            data-range-role={rangeRole ?? undefined}
            className={`${
                isMobile ? "px-0.5 pb-1 pt-0.5" : "p-1 md:p-2"
            } relative min-w-0 ${dayIdx < 6 ? "border-r border-gray-200" : ""
                } ${canSelect ? "cursor-pointer" : "cursor-default"
                } transition-colors select-none flex flex-col ${isInDragRange
                    ? "bg-blue-50"
                    : isFollowingMonth
                        ? "bg-gray-100 hover:bg-gray-200/70"
                        : inMonth
                            ? "bg-white hover:bg-gray-50"
                            : "bg-white text-gray-400"
                }`}
            style={{
                // visible 유지: 공휴일 별표 호버 펼침이 셀 밖으로 나갈 수 있게 함
                // (overflow-y:hidden 이면 overflow-x도 브라우저가 clip으로 강제함)
                overflow: "visible",
                position: 'relative',
                isolation: 'isolate',
            }}
        >
            {stackedScheduleMarks(scheduleMarks, isMobile, scheduleCellHeight).map(
                ({ mark, top, height }) => (
                    <ScheduleBarMark
                        key={mark.id}
                        mark={mark}
                        top={top}
                        height={height}
                    />
                )
            )}
            {rangeRole && rangeRole !== "single" && rangeRole !== "pending" && (
                <div
                    aria-hidden
                    className={`pointer-events-none absolute z-0 bg-yellow-200 top-1 h-6 md:top-2 md:h-[1.875rem] ${
                        rangeRole === "start"
                            ? "right-0 left-5 md:left-[31px]"
                            : rangeRole === "end"
                                ? "left-0 w-5 md:w-[31px]"
                                : "inset-x-0"
                    }`}
                />
            )}
            {!isMobile && dayAvailability ? (
                <div
                    className="pointer-events-none absolute z-20 top-1 right-1.5 text-right text-[11px] leading-tight text-gray-500"
                    title="그날 일정에 미배정된 투입 가능 인원 (SF=팀장, F=팀원)"
                >
                    SF{dayAvailability.leaders} / F{dayAvailability.members}
                </div>
            ) : null}
            <div
                className={`${
                    isMobile ? "pl-0.5 pr-0.5" : columnPadding
                } relative z-20 flex min-w-0 items-center gap-0.5`}
            >
                {/* 날짜(좌측 상단) → 공휴일 별표 / 모바일 개인일정 느낌표 */}
                <div
                    className={`${
                        isMobile ? "h-5 w-5" : "h-7.5 w-7.5"
                    } relative flex shrink-0 items-center justify-center`}
                >
                    {(isToday || isRangeMarker) && (
                        <div
                            aria-hidden
                            className={`absolute inset-0 ${
                                isToday && !isRangeMarker
                                    ? "rounded-full bg-blue-500"
                                    : pointsRight || pointsLeft
                                        ? "bg-yellow-400"
                                        : "rounded-full bg-yellow-400"
                            }`}
                            style={
                                pointsRight
                                    ? { clipPath: "polygon(0% 0%, 68% 0%, 100% 50%, 68% 100%, 0% 100%)" }
                                    : pointsLeft
                                        ? { clipPath: "polygon(32% 0%, 100% 0%, 100% 100%, 32% 100%, 0% 50%)" }
                                        : undefined
                            }
                        />
                    )}
                    <span
                        data-date-number
                        dir="ltr"
                        className={`relative z-10 font-medium tabular-nums ${isMobile ? "text-[12px]" : "text-[17px]"} ${
                            pointsRight ? "-translate-x-0.5" : pointsLeft ? "translate-x-0.5" : ""
                        } ${isRangeMarker
                            ? "text-gray-900"
                            : isToday
                            ? "text-white"
                            : !inMonth
                                ? "text-gray-400"
                                : date.getDay() === 0 || isWeekdayHoliday
                                    ? "text-red-500"
                                    : date.getDay() === 6
                                        ? "text-blue-500"
                                        : "text-gray-800"
                            }`}
                    >
                        {String(date.getDate())}
                    </span>
                </div>
                {!isMobile
                    ? holidaySegments.map((segment) => {
                          const isStartInCell = segment.startOffset === dayIdx;
                          const startDayDate = week[segment.startOffset]?.date;
                          if (!startDayDate) return null;
                          const isEventStart =
                              segment.event.startDate ===
                              getSafeDateKey(startDayDate);
                          if (!(isEventStart && isStartInCell)) return null;
                          return (
                              <CalendarTag
                                  key={`${segment.event.id}-${dayIdx}-holiday`}
                                  title={segment.event.title}
                                  color={segment.event.color}
                                  variant="holiday"
                                  isStart
                                  isEnd
                                  eventId={segment.event.id}
                                  onClick={(e) => onEventClick(segment.event, e)}
                              />
                          );
                      })
                    : personalEntries.length > 0 ? (
                          <span
                              className="inline-flex h-[16px] w-[16px] shrink-0 items-center justify-center rounded-full bg-red-100"
                              title="개인 일정"
                              aria-label="개인 일정"
                          >
                              <IconExclamation className="h-2.5 w-2.5 text-red-500" />
                          </span>
                      ) : null}
                {personalEntries.length > 0 && !isMobile ? (
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1 gap-y-0.5 text-[11px] leading-tight">
                        {personalEntries.map((entry) => (
                            <button
                                key={entry.id}
                                type="button"
                                className="max-w-full truncate rounded px-0.5 font-medium text-red-500 transition-colors hover:bg-red-50 hover:text-red-600"
                                title={entry.names.join(" ")}
                                onClick={(event) => {
                                    event.stopPropagation();
                                    onPersonalEntryClick?.(entry);
                                }}
                            >
                                {entry.names.join(" ")}
                            </button>
                        ))}
                    </div>
                ) : null}
            </div>

            {/* 태그 영역 - 연속된 태그가 셀 경계를 넘어가도록 left: 0, right: 0 */}
            <div
                className="absolute left-0 right-0 pointer-events-none"
                style={{
                    top: `${tagLayerTop}px`,
                    left: 0,
                    right: 0,
                    bottom: hiddenCount > 0 ? '18px' : '0px', // +n 더보기 영역 확보
                    overflowX: 'visible', // 연속된 태그가 셀 경계를 넘어가도록
                    overflowY: 'hidden',
                    zIndex: 10,
                }}
            >
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
                    ({ left, width } = placeBesideDate(left, width));

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


            {/* +N 더보기 (참고: 네이버 캘린더 스타일) */}
            {hiddenCount > 0 && (
                <div
                    className="absolute left-0 right-0 bottom-0 pointer-events-auto z-40 cursor-pointer flex items-center justify-center bg-white/80"
                    style={{
                        height: '18px',
                        minHeight: '18px',
                    }}
                    onClick={(e) => {
                        e.stopPropagation();
                        onHiddenCountClick();
                    }}
                >
                    <span className="text-[11px] font-medium text-gray-500 select-none">
                        +{hiddenCount}
                    </span>
                </div>
            )}
        </div>
    );
};

export default DayCell;
