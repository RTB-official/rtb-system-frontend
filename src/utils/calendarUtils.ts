import { CalendarEvent } from "../types";

/**
 * 월 그리드 생성
 */
export function generateMonthGrid(year: number, month: number) {
    const first = new Date(year, month, 1);
    const startDay = first.getDay(); // 0=Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevDays = startDay;
    const totalCells = Math.ceil((prevDays + daysInMonth) / 7) * 7;
    const grid: { date: Date; inMonth: boolean }[] = [];

    for (let i = 0; i < totalCells; i++) {
        const dayIndex = i - prevDays + 1;
        const d = new Date(year, month, dayIndex);
        grid.push({ date: d, inMonth: d.getMonth() === month });
    }
    return grid;
}

/**
 * 주 단위로 그리드 데이터 나누기
 */
export function splitIntoWeeks(grid: { date: Date; inMonth: boolean }[]) {
    const result = [];
    for (let i = 0; i < grid.length; i += 7) {
        result.push(grid.slice(i, i + 7));
    }
    return result;
}

/**
 * 안전하게 날짜 키 생성
 */
export function getSafeDateKey(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

/**
 * 주 단위 이벤트 행 계산 함수 (연속된 일정을 위해)
 */
export function getWeekEventRows(
    week: { date: Date; inMonth: boolean }[],
    sortedEvents: CalendarEvent[],
    preferredRowIndexByEvent?: Map<string, number>,
) {
    const preferredRows = preferredRowIndexByEvent ?? new Map<string, number>();
    const normalizeDateKey = (value: string) => {
        const base = value.length >= 10 ? value.slice(0, 10) : value;
        const parts = base.split("-");
        if (parts.length !== 3) return base;
        const y = parts[0];
        const m = parts[1].padStart(2, "0");
        const d = parts[2].padStart(2, "0");
        return `${y}-${m}-${d}`;
    };
    const weekStartKey = getSafeDateKey(week[0].date);
    const weekStart = new Date(week[0].date);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(week[6].date);
    weekEnd.setHours(23, 59, 59, 999);

    const dayMs = 24 * 60 * 60 * 1000;

    // 현재 주에 걸쳐 있는 이벤트 세그먼트 추출
    const segments = sortedEvents
        .map((event) => {
            const eventStart = new Date(event.startDate);
            eventStart.setHours(0, 0, 0, 0);
            const eventEnd = new Date(event.endDate);
            eventEnd.setHours(0, 0, 0, 0);

            if (eventEnd < weekStart || eventStart > weekEnd) return null;

            const start = new Date(
                Math.max(eventStart.getTime(), weekStart.getTime()),
            );
            const end = new Date(
                Math.min(eventEnd.getTime(), weekEnd.getTime()),
            );

            const startOffset = Math.round(
                (start.getTime() - weekStart.getTime()) / dayMs,
            );
            const duration =
                Math.round((end.getTime() - start.getTime()) / dayMs) + 1;

            return { event, startOffset, duration };
        })
        .filter((s) => s !== null) as {
        event: CalendarEvent;
        startOffset: number;
        duration: number;
    }[];

    // 슬롯(행) 할당 (연속된 태그를 위로, 공휴일은 아래로)
    const orderedSegments = [...segments].sort((a, b) => {
        const aStartKey = normalizeDateKey(a.event.startDate);
        const bStartKey = normalizeDateKey(b.event.startDate);
        const aContinued = aStartKey < weekStartKey;
        const bContinued = bStartKey < weekStartKey;
        if (aContinued !== bContinued) {
            return aContinued ? -1 : 1; // 이전 주에서 넘어온 태그 우선
        }
        if (a.event.isHoliday !== b.event.isHoliday) {
            return a.event.isHoliday ? 1 : -1; // 공휴일은 뒤로
        }
        if (a.startOffset !== b.startOffset) {
            return a.startOffset - b.startOffset;
        }
        return a.event.id.localeCompare(b.event.id);
    });

    const rows: (typeof segments)[] = [];
    orderedSegments.forEach((segment) => {
        let assigned = false;
        const preferredRow = preferredRows.get(segment.event.id);
        if (preferredRow !== undefined) {
            while (rows.length <= preferredRow) {
                rows.push([]);
            }
            const canFitPreferred = !rows[preferredRow].some(
                (s) =>
                    segment.startOffset < s.startOffset + s.duration &&
                    s.startOffset < segment.startOffset + segment.duration,
            );
            if (canFitPreferred) {
                rows[preferredRow].push(segment);
                assigned = true;
            }
        }
        if (!assigned) {
            for (let i = 0; i < rows.length; i++) {
                const canFit = !rows[i].some(
                    (s) =>
                        segment.startOffset < s.startOffset + s.duration &&
                        s.startOffset < segment.startOffset + segment.duration,
                );

                if (canFit) {
                    rows[i].push(segment);
                    assigned = true;
                    break;
                }
            }
        }
        if (!assigned) {
            rows.push([segment]);
        }
    });

    // 각 세그먼트에 rowIndex를 추가하여 반환
    const result = rows
        .map((row, rowIndex) =>
            row.map((segment) => ({ ...segment, rowIndex })),
        )
        .flat();

    return result;

    return result;
}

/**
 * 특정 날짜의 이벤트 목록 가져오기
 */
export function getEventsForDate(
    dateKey: string,
    sortedEvents: CalendarEvent[],
): CalendarEvent[] {
    return sortedEvents.filter((event) => {
        const eventStart = new Date(event.startDate);
        const eventEnd = new Date(event.endDate);
        const current = new Date(dateKey);
        return current >= eventStart && current <= eventEnd;
    });
}

/**
 * 날짜 범위 포맷팅
 */
export function formatDateRange(startDate: string, endDate: string): string {
    const start = new Date(startDate);
    const end = new Date(endDate);

    const startStr = `${start.getMonth() + 1}월 ${start.getDate()}일`;
    const endStr = `${end.getMonth() + 1}월 ${end.getDate()}일`;

    if (startDate === endDate) {
        return `${startStr}`;
    }
    return `${startStr} ~ ${endStr}`;
}

/**
 * 컬럼 패딩 계산 (모바일에서 좌우 여백 축소)
 */
export function getColumnPadding(index: number, isMobile?: boolean): string {
    if (isMobile) {
        // 모바일: 좌우 대칭으로 7열 균등 유지
        return "px-1";
    }
    if (index === 0) return "pl-9 pr-4";
    if (index === 6) return "pl-4 pr-9";
    return "";
}

/**
 * 이벤트 타입 판단 유틸리티
 */
export function isVacationEvent(title: string): boolean {
    return title.includes("휴가");
}

/**
 * 캘린더 태그 아이콘 간격 상수 (px)
 * - 홀리데이, 휴가, 출장보고서: 6px (mr-1.5)
 * - 기본 일정: 8px (mr-2)
 */
export const CALENDAR_TAG_ICON_SPACING = {
    holiday: 6, // 공휴일
    vacation: 6, // 휴가
    general: 8, // 기본 일정
} as const;

/**
 * 캘린더 태그 아이콘 너비 (아이콘만, 간격 제외)
 * - 공휴일: w-4(16px)
 * - 휴가: w-4(16px)
 * - 출장보고서: w-4(16px)
 * - 일반 이벤트: w-1(4px)
 */
export const CALENDAR_TAG_ICON_SIZES = {
    holiday: 16, // 공휴일
    vacation: 16, // 휴가
    general: 4, // 일반 이벤트
} as const;

/**
 * 캘린더 태그 아이콘 너비 (아이콘 + 간격)
 */
export const CALENDAR_TAG_ICON_WIDTHS = {
    holiday:
        CALENDAR_TAG_ICON_SIZES.holiday + CALENDAR_TAG_ICON_SPACING.holiday, // 22px
    vacation:
        CALENDAR_TAG_ICON_SIZES.vacation + CALENDAR_TAG_ICON_SPACING.vacation, // 22px
    general:
        CALENDAR_TAG_ICON_SIZES.general + CALENDAR_TAG_ICON_SPACING.general, // 12px
} as const;

/**
 * 이벤트 타입에 따른 아이콘 너비 계산 (아이콘 + 간격)
 */
export function getCalendarTagIconWidth(
    isHoliday: boolean,
    isVacation: boolean,
): number {
    if (isHoliday) return CALENDAR_TAG_ICON_WIDTHS.holiday;
    if (isVacation) return CALENDAR_TAG_ICON_WIDTHS.vacation;
    return CALENDAR_TAG_ICON_WIDTHS.general;
}
