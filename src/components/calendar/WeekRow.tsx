import React, { useMemo } from "react";
import DayCell from "./DayCell";
import { CalendarEvent } from "../../types";
import { isVacationEvent, isWorkLogEvent, CALENDAR_TAG_ICON_SPACING, CALENDAR_TAG_ICON_SIZES } from "../../utils/calendarUtils";

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
    onHiddenCountClick: (dateKey: string, threshold: number) => void;
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
    const TAG_LAYER_TOP = 54; // 날짜 숫자(30px) + 상단 패딩(12px) + 간격(10px) = 52px (여유 2px)
    const HIDDEN_COUNT_HEIGHT = 0; // +n개 표시 공간
    const CELL_PADDING_BOTTOM = 0; // 하단 패딩
    const EXTRA_SPACE = 16; // 태그가 잘리지 않도록 여유 공간 제거 (태그 영역을 만들지 않음)

    // 각 날짜별로 보여줄 태그와 숨길 태그 계산
    // cellHeights가 변경될 때마다 재계산 (반응형 대응)
    // 같은 이벤트의 모든 세그먼트가 함께 보이거나 함께 숨겨져야 함
    const dateTagInfo = useMemo(() => {
        const info = new Map<
            string,
            { visibleSegments: WeekEventSegment[]; hiddenCount: number }
        >();

        // 1단계: 주 전체의 모든 고유 이벤트 수집 (시작 셀 기준)
        const uniqueEvents = new Map<string, { event: CalendarEvent; startDayIdx: number; rowIndex: number }>();
        weekEventRows.forEach(seg => {
            if (!uniqueEvents.has(seg.event.id)) {
                uniqueEvents.set(seg.event.id, {
                    event: seg.event,
                    startDayIdx: seg.startOffset,
                    rowIndex: seg.rowIndex
                });
            }
        });

        // 2단계: 각 이벤트의 시작 셀에서 표시 여부 결정
        const eventVisibility = new Map<string, boolean>();

        // rowIndex 순서대로 정렬된 이벤트 목록
        const sortedEvents = Array.from(uniqueEvents.values()).sort((a, b) => {
            if (a.event.isHoliday !== b.event.isHoliday) {
                return a.event.isHoliday ? -1 : 1; // 공휴일이 먼저
            }
            return a.rowIndex - b.rowIndex;
        });

        // 시작 셀별로 그룹화하여 처리
        const eventsByStartCell = new Map<number, typeof sortedEvents>();
        sortedEvents.forEach(({ event, startDayIdx }) => {
            if (!eventsByStartCell.has(startDayIdx)) {
                eventsByStartCell.set(startDayIdx, []);
            }
            eventsByStartCell.get(startDayIdx)!.push({ event, startDayIdx, rowIndex: 0 });
        });

        // 각 시작 셀에서 순차적으로 태그 배치
        eventsByStartCell.forEach((events, startDayIdx) => {
            const startDate = week[startDayIdx]?.date;
            if (!startDate) return;

            const startDateKey = `${startDate.getFullYear()}-${pad(
                startDate.getMonth() + 1
            )}-${pad(startDate.getDate())}`;

            const cellHeight = cellHeights[startDateKey] || 0;

            // 셀 높이가 측정되지 않았으면 모두 표시
            if (cellHeight === 0) {
                events.forEach(({ event }) => {
                    eventVisibility.set(event.id, true);
                });
                return;
            }

            // 해당 날짜의 모든 세그먼트 수집
            const daySegments = weekEventRows
                .filter(
                    (seg) =>
                        seg.startOffset <= startDayIdx &&
                        startDayIdx < seg.startOffset + seg.duration
                )
                .sort((a, b) => {
                    if (a.event.isHoliday !== b.event.isHoliday) {
                        return a.event.isHoliday ? -1 : 1;
                    }
                    return a.rowIndex - b.rowIndex;
                });

            // availableHeight 계산: 셀 높이에서 상단 영역과 하단 패딩만 제외
            // 더 많은 태그가 보이도록 여유 공간 추가
            const availableHeight = cellHeight - TAG_LAYER_TOP - CELL_PADDING_BOTTOM + EXTRA_SPACE;

            if (availableHeight <= 0) {
                events.forEach(({ event }) => {
                    eventVisibility.set(event.id, false);
                });
                return;
            }

            // 공휴일 태그 확인
            const hasHoliday = daySegments.some(seg => seg.event.isHoliday);
            const holidayOffset = hasHoliday ? tagHeight + tagSpacing : 0;

            // 순차적으로 태그를 배치하면서 들어갈 수 있는지 확인
            const visibleEvents = new Set<string>();

            // 공휴일 태그 먼저 처리
            let startTop = 0;
            if (hasHoliday) {
                const holidaySeg = daySegments.find(seg => seg.event.isHoliday);
                if (holidaySeg) {
                    const holidayBottom = tagHeight;
                    if (holidayBottom <= availableHeight) {
                        visibleEvents.add(holidaySeg.event.id);
                        startTop = holidayOffset;
                    }
                }
            }

            // 일반 이벤트 태그만 필터링 (공휴일 제외)
            const regularSegments = daySegments.filter(seg => !seg.event.isHoliday);

            // 태그가 잘리기 시작하는 순간을 감지하여 +n개 표시
            // 태그가 완전히 들어갈 수 있는지 확인 (태그가 잘리지 않도록)
            let currentTop = startTop;
            let hasOverflow = false;

            // 모든 태그가 완전히 들어가는지 확인하면서 동시에 배치
            for (const seg of regularSegments) {
                const tagTop = currentTop;
                const tagBottom = tagTop + tagHeight;

                // 태그가 availableHeight를 넘어서기 시작하면 +n개 표시로 전환
                // 태그가 완전히 들어가지 못하면 (잘리기 시작하면) 중단
                if (tagBottom > availableHeight) {
                    hasOverflow = true;
                    break;
                }

                // 태그가 완전히 들어가면 표시
                visibleEvents.add(seg.event.id);
                currentTop = tagBottom + tagSpacing;
            }

            // 태그가 잘리기 시작했으면, +n개 공간을 확보하고 최대한 표시
            if (hasOverflow) {
                // +n개 공간을 확보한 최대 높이 (태그가 완전히 들어갈 수 있는 높이)
                const maxVisibleHeight = availableHeight - HIDDEN_COUNT_HEIGHT;
                currentTop = startTop;

                // 공휴일 태그는 보존하고 일반 이벤트만 다시 계산
                const holidayEventIds = new Set<string>();
                if (hasHoliday) {
                    const holidaySeg = daySegments.find(seg => seg.event.isHoliday);
                    if (holidaySeg) {
                        holidayEventIds.add(holidaySeg.event.id);
                    }
                }

                visibleEvents.clear();
                // 공휴일 태그 다시 추가
                holidayEventIds.forEach(id => visibleEvents.add(id));

                // 태그가 완전히 들어갈 수 있는지 확인하면서 배치
                for (const seg of regularSegments) {
                    const tagTop = currentTop;
                    const tagBottom = tagTop + tagHeight;

                    // 태그가 maxVisibleHeight를 넘지 않으면 완전히 들어갈 수 있음
                    if (tagBottom <= maxVisibleHeight) {
                        visibleEvents.add(seg.event.id);
                        currentTop = tagBottom + tagSpacing;
                    } else {
                        // 태그가 잘리기 시작하면 더 이상 추가하지 않음 (완전히 들어가지 못함)
                        break;
                    }
                }
            }

            // 각 이벤트의 표시 여부 설정
            events.forEach(({ event }) => {
                eventVisibility.set(event.id, visibleEvents.has(event.id));
            });
        });

        // 3단계: 각 날짜별로 최종 visibleSegments 결정
        week.forEach(({ date }, dayIdx) => {
            const dateKey = `${date.getFullYear()}-${pad(
                date.getMonth() + 1
            )}-${pad(date.getDate())}`;

            // 해당 날짜에 해당하는 세그먼트 필터링
            const daySegments = weekEventRows
                .filter(
                    (seg) =>
                        seg.startOffset <= dayIdx &&
                        dayIdx < seg.startOffset + seg.duration
                )
                .sort((a, b) => {
                    if (a.event.isHoliday !== b.event.isHoliday) {
                        return a.event.isHoliday ? -1 : 1;
                    }
                    return a.rowIndex - b.rowIndex;
                });

            // 결정된 이벤트 표시 여부에 따라 최종 visibleSegments 결정
            const finalVisibleSegments = daySegments.filter(seg => {
                return eventVisibility.get(seg.event.id) ?? true;
            });

            const hiddenCount = daySegments.length - finalVisibleSegments.length;

            info.set(dateKey, {
                visibleSegments: finalVisibleSegments,
                hiddenCount,
            });
        });

        return info;
    }, [week, weekEventRows, cellHeights, tagHeight, tagSpacing]);

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

    return (
        <div className="flex-1 grid grid-cols-7 border-b border-gray-200 relative" style={{ overflowX: 'visible' }}>
            {/* 연속된 태그의 텍스트를 WeekRow 레벨에 배치하여 전체 이벤트 너비에 걸쳐 표시 */}
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

                    // 시작 셀의 visibleSegments에 포함된 이벤트만 텍스트 표시
                    const startTagInfo = dateTagInfo.get(startDateKey);
                    const isVisible = startTagInfo?.visibleSegments.some(
                        (s) => s.event.id === segment.event.id
                    );

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
                    const totalEventWidth = segment.duration * cellWidth;

                    // 첫 셀의 12px 패딩
                    const firstCellPadding = 12;
                    // 마지막 셀의 오른쪽 패딩 12px + 태그 끝나기 전 8px 여유
                    const lastCellPadding = 12 + 8;

                    const isHoliday = !!segment.event.isHoliday;
                    const isVacation = isVacationEvent(segment.event.title);
                    const isWorkLog = isWorkLogEvent(segment.event.title);
                    // 태그 타입별로 다른 간격 적용
                    // 텍스트 위치는 아이콘 너비 + 태그 타입별 간격을 사용
                    const iconSize = isHoliday ? CALENDAR_TAG_ICON_SIZES.holiday
                        : isVacation ? CALENDAR_TAG_ICON_SIZES.vacation
                            : isWorkLog ? CALENDAR_TAG_ICON_SIZES.workLog
                                : CALENDAR_TAG_ICON_SIZES.general;
                    const iconSpacing = isHoliday ? CALENDAR_TAG_ICON_SPACING.holiday
                        : isVacation ? CALENDAR_TAG_ICON_SPACING.vacation
                            : isWorkLog ? CALENDAR_TAG_ICON_SPACING.workLog
                                : CALENDAR_TAG_ICON_SPACING.general;
                    const iconWidth = iconSize + iconSpacing;

                    // 시작 날짜의 공휴일 유무 확인
                    const startDateHasHoliday = getEventsForDate(startDateKey).some(event => event.isHoliday);
                    const holidayOffset = startDateHasHoliday ? tagHeight + tagSpacing : 0;
                    const top = isHoliday ? 0 : segment.rowIndex * (tagHeight + tagSpacing) + holidayOffset;

                    // 모바일 반응형: 텍스트 크기 조정
                    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
                    const textSize = isMobile ? 'text-[13px]' : 'text-[15px]';

                    return (
                        <span
                            key={`text-${segment.event.id}-${startDayIdx}`}
                            className={`${textSize} leading-none absolute pointer-events-none ${isHoliday
                                ? "font-medium text-red-600"
                                : "font-medium text-gray-800"
                                }`}
                            style={{
                                left: `${startCellLeft + firstCellPadding + iconWidth}px`,
                                width: `${totalEventWidth - firstCellPadding - lastCellPadding - iconWidth}px`,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                top: `${TAG_LAYER_TOP + top + tagHeight / 2}px`,
                                transform: 'translateY(-50%)',
                                zIndex: 30,
                            }}
                        >
                            {segment.event.title}
                        </span>
                    );
                })}

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

                const tagInfo = dateTagInfo.get(dateKey);
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
                        hiddenCount={tagInfo?.hiddenCount ?? 0}
                        onHiddenCountClick={() =>
                            onHiddenCountClick(dateKey, tagInfo?.visibleSegments.length ?? 0)
                        }
                        cellRefs={cellRefs}
                        tagHeight={tagHeight}
                        tagSpacing={tagSpacing}
                        tagLayerTop={TAG_LAYER_TOP}
                        visibleSegments={
                            cellHeight > 0
                                ? weekEventRows.filter((segment) => {
                                    const segmentEnd = segment.startOffset + segment.duration;
                                    const overlaps = segment.startOffset <= dayIdx && dayIdx < segmentEnd;
                                    if (!overlaps) return false;
                                    return tagInfo?.visibleSegments.some(
                                        (s) => s.event.id === segment.event.id
                                    );
                                })
                                : weekEventRows.filter(
                                    (seg) =>
                                        seg.startOffset <= dayIdx &&
                                        dayIdx < seg.startOffset + seg.duration
                                )
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
