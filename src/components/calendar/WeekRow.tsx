import React from "react";
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
    cellHeights: Record<string, number>;
    onEditEvent: (event: CalendarEvent) => void;
    onDeleteEvent: (eventId: string) => void;
    onEventClick: (event: CalendarEvent, e: React.MouseEvent) => void;
    onDateClick: (dateKey: string, e: React.MouseEvent) => void;
    onDragStart: (dateKey: string, e: React.MouseEvent) => void;
    onDragEnter: (dateKey: string) => void;
    onHiddenCountClick: (dateKey: string, threshold: number) => void;
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
}) => {
    const TAG_LAYER_TOP = 42; // 셀 상단 패딩(8px) + 날짜 숫자 영역(30px) + 여백(4px) = 42px
    const HIDDEN_COUNT_HEIGHT = 24;

    // 각 날짜별로 보여줄 태그와 숨길 태그 계산
    const dateTagInfo = new Map<
        string,
        { visibleSegments: WeekEventSegment[]; hiddenCount: number }
    >();

    week.forEach(({ date }, dayIdx) => {
        const dateKey = `${date.getFullYear()}-${pad(
            date.getMonth() + 1
        )}-${pad(date.getDate())}`;

        const cellHeight = cellHeights[dateKey] || 0;

        // 해당 날짜에 해당하는 세그먼트 필터링 (공휴일 제외)
        // 공휴일 태그는 rowIndex를 차지하지 않음
        const daySegments = weekEventRows
            .filter(
                (seg) =>
                    seg.startOffset <= dayIdx &&
                    dayIdx < seg.startOffset + seg.duration &&
                    !seg.event.isHoliday // 공휴일 제외
            );
        
        // 며칠에 걸친 일정(duration >= 2)과 단일 일정(duration === 1)을 분리
        const multiDaySegments = daySegments.filter(seg => seg.duration >= 2);
        const singleDaySegments = daySegments.filter(seg => seg.duration === 1);
        
        // 며칠에 걸친 일정은 원래 rowIndex를 그대로 유지 (같은 줄에 표시되도록)
        // 단일 일정은 며칠에 걸친 일정과 겹치지 않도록 배치
        
        // 며칠에 걸친 일정의 rowIndex 집합
        const multiDayRowIndices = new Set(multiDaySegments.map(seg => seg.rowIndex));
        
        // 각 일정에 실제 rowIndex 할당 (겹치지 않도록)
        const assignedRows: Map<number, typeof daySegments> = new Map();
        
        // 며칠에 걸친 일정 배치: 원래 rowIndex를 그대로 사용 (같은 줄에 표시)
        multiDaySegments.forEach((segment) => {
            const targetRowIndex = segment.rowIndex;
            const existing = assignedRows.get(targetRowIndex) || [];
            assignedRows.set(targetRowIndex, [...existing, segment]);
        });
        
        // 단일 일정 배치: 며칠에 걸친 일정과 겹치지 않도록
        singleDaySegments.sort((a, b) => a.rowIndex - b.rowIndex).forEach((segment) => {
            let targetRowIndex = segment.rowIndex;
            
            // 며칠에 걸친 일정이 해당 rowIndex를 사용 중이면 아래로 내림
            while (multiDayRowIndices.has(targetRowIndex) || 
                   (assignedRows.has(targetRowIndex) && assignedRows.get(targetRowIndex)!.length > 0)) {
                targetRowIndex++;
            }
            
            const existing = assignedRows.get(targetRowIndex) || [];
            assignedRows.set(targetRowIndex, [...existing, segment]);
        });
        
        // 최종 rowIndex 할당
        const finalDaySegments = Array.from(assignedRows.entries())
            .sort((a, b) => a[0] - b[0]) // rowIndex로 정렬
            .flatMap(([rowIndex, segments]) => 
                segments.map(segment => ({ ...segment, rowIndex }))
            );
        
        // 디버깅: 1월 1일과 1월 2일의 모든 일정 rowIndex 확인
        if (dateKey === "2026-01-01" || dateKey === "2026-01-02") {
            console.log(`\n=== [${dateKey}] 일정 정보 ===`);
            finalDaySegments.forEach(seg => {
                const originalSeg = weekEventRows.find(s => s.event.id === seg.event.id);
                console.log(`일정: "${seg.event.title}"`);
                console.log(`  - 원래 rowIndex: ${originalSeg?.rowIndex ?? 'N/A'}`);
                console.log(`  - 최종 rowIndex: ${seg.rowIndex}`);
                console.log(`  - startOffset: ${seg.startOffset}`);
                console.log(`  - duration: ${seg.duration}`);
                console.log(`  - event.id: ${seg.event.id}`);
                console.log(`  - startDate: ${seg.event.startDate}`);
                console.log(`  - endDate: ${seg.event.endDate}`);
            });
            if (finalDaySegments.length === 0) {
                console.log(`  (일정 없음)`);
            }
        }

        // 태그가 하나도 없으면 처리할 필요 없음
        if (finalDaySegments.length === 0) {
            dateTagInfo.set(dateKey, {
                visibleSegments: [],
                hiddenCount: 0,
            });
            return;
        }

        // 일정이 4개 이상이면 3개만 보여주고 나머지는 "+n개"로 표시
        const MAX_VISIBLE_EVENTS = 3;

        if (finalDaySegments.length > MAX_VISIBLE_EVENTS) {
            // 처음 3개만 보여주고 나머지는 숨김
            dateTagInfo.set(dateKey, {
                visibleSegments: finalDaySegments.slice(0, MAX_VISIBLE_EVENTS),
                hiddenCount: finalDaySegments.length - MAX_VISIBLE_EVENTS,
            });
            return;
        }

        // 3개 이하면 모두 보여주기 (셀 높이와 관계없이)
            dateTagInfo.set(dateKey, {
            visibleSegments: finalDaySegments,
                hiddenCount: 0,
        });
    });

    return (
        <div className="flex-1 grid grid-cols-7 border-b border-gray-200 relative">
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
                            cellHeight > 0 && tagInfo
                                ? (() => {
                                    // dateTagInfo에서 재계산된 visibleSegments 사용
                                    const visibleFromTagInfo = tagInfo.visibleSegments;
                                    
                                    // 며칠에 걸친 일정의 연속된 부분도 포함
                                    const result: typeof weekEventRows = [];
                                    
                                    // 이미 추가된 이벤트 ID 추적
                                    const addedEventIds = new Set<string>();
                                    
                                    // 먼저 해당 날짜의 visibleSegments 추가
                                    visibleFromTagInfo.forEach(visibleSeg => {
                                        result.push(visibleSeg);
                                        addedEventIds.add(visibleSeg.event.id);
                                    });
                                    
                                    // 며칠에 걸친 일정(duration >= 2)의 연속된 부분 추가
                                    // 시작 날짜가 아닌 경우, 시작 날짜의 visibleSegments에서 rowIndex 가져오기
                                    weekEventRows
                                        .filter(seg => 
                                            seg.duration >= 2 &&
                                            seg.startOffset !== dayIdx &&
                                            seg.startOffset <= dayIdx &&
                                            dayIdx < seg.startOffset + seg.duration &&
                                            !addedEventIds.has(seg.event.id) // 중복 제거
                                        )
                                        .forEach(seg => {
                                            // 시작 날짜의 dateTagInfo에서 rowIndex 가져오기
                                            const startDateKey = `${week[seg.startOffset]?.date.getFullYear()}-${pad(
                                                week[seg.startOffset]?.date.getMonth() + 1 || 1
                                            )}-${pad(week[seg.startOffset]?.date.getDate() || 1)}`;
                                            const startTagInfo = dateTagInfo.get(startDateKey);
                                            const startVisibleSeg = startTagInfo?.visibleSegments.find(
                                                s => s.event.id === seg.event.id
                                            );
                                            
                                            if (startVisibleSeg) {
                                                // 시작 날짜의 rowIndex 사용 (같은 줄에 표시)
                                                result.push({ ...seg, rowIndex: startVisibleSeg.rowIndex });
                                                addedEventIds.add(seg.event.id);
                                            }
                                        });
                                    
                                    return result;
                                })()
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
                    />
                );
            })}
        </div>
    );
};

export default WeekRow;
