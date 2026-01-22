import { useMemo } from "react";
import { CalendarEvent } from "../types";
import { TAG_LAYER_TOP, HIDDEN_COUNT_HEIGHT, CELL_PADDING_BOTTOM, EXTRA_SPACE } from "../utils/calendarConstants";

interface WeekEventSegment {
    event: CalendarEvent;
    startOffset: number;
    duration: number;
    rowIndex: number;
}

interface DateTagInfo {
    visibleSegments: WeekEventSegment[];
    hiddenCount: number;
}

/**
 * 캘린더 태그 가시성 계산 Hook
 */
export function useCalendarTagVisibility(
    week: { date: Date; inMonth: boolean }[],
    weekEventRows: WeekEventSegment[],
    cellHeights: Record<string, number>,
    tagHeight: number,
    tagSpacing: number
): Map<string, DateTagInfo> {
    return useMemo(() => {
        const info = new Map<string, DateTagInfo>();

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

        const pad = (n: number) => (n < 10 ? "0" + n : String(n));

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
            let currentTop = startTop;
            let hasOverflow = false;

            // 모든 태그가 완전히 들어가는지 확인하면서 동시에 배치
            for (const seg of regularSegments) {
                const tagTop = currentTop;
                const tagBottom = tagTop + tagHeight;

                // 태그가 availableHeight를 넘어서기 시작하면 +n개 표시로 전환
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
                        // 태그가 잘리기 시작하면 더 이상 추가하지 않음
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
}

