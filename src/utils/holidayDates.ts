import { getCalendarEvents } from "../lib/dashboardApi";

const HOLIDAY_API_KEY =
    "cac7adf961a1b55472fa90319e4cb89dde6c04242edcb3d3970ae9e09c931e98";
const HOLIDAY_API_ENDPOINT =
    "https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo";

const HOLIDAY_KEYWORDS = [
    "휴일",
    "공휴일",
    "대체공휴일",
    "임시공휴일",
    "선거",
] as const;

export const EMPTY_HOLIDAY_DATE_SET: ReadonlySet<string> = new Set<string>();

export function isWeekend(dateString: string): boolean {
    const date = new Date(`${dateString}T00:00:00`);
    const day = date.getDay();
    return day === 0 || day === 6;
}

export function isWeekendOrHoliday(
    dateString: string,
    holidayDateKeys: ReadonlySet<string>
): boolean {
    return isWeekend(dateString) || holidayDateKeys.has(dateString);
}

export function enumerateDateRange(startDate: string, endDate: string): string[] {
    const dates: string[] = [];
    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T00:00:00`);

    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
        return dates;
    }

    const cursor = new Date(start);
    while (cursor <= end) {
        const yyyy = cursor.getFullYear();
        const mm = String(cursor.getMonth() + 1).padStart(2, "0");
        const dd = String(cursor.getDate()).padStart(2, "0");
        dates.push(`${yyyy}-${mm}-${dd}`);
        cursor.setDate(cursor.getDate() + 1);
    }

    return dates;
}

export function getDatesInMonth(year: number, month: number): string[] {
    const lastDay = new Date(year, month, 0).getDate();
    const monthStr = String(month).padStart(2, "0");
    return Array.from({ length: lastDay }, (_, index) => {
        const day = String(index + 1).padStart(2, "0");
        return `${year}-${monthStr}-${day}`;
    });
}

export async function fetchPublicHolidays(
    year: number,
    monthZeroBased: number
): Promise<string[]> {
    const monthStr = String(monthZeroBased + 1).padStart(2, "0");
    const url = `${HOLIDAY_API_ENDPOINT}?serviceKey=${HOLIDAY_API_KEY}&solYear=${year}&solMonth=${monthStr}&_type=json&numOfRows=100`;
    const response = await fetch(url);
    const data = await response.json();
    const items = data.response?.body?.items?.item;

    if (!items) return [];

    const itemList = Array.isArray(items) ? items : [items];
    return itemList.map((item: { locdate: string | number }) => {
        const dateStr = String(item.locdate);
        return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(
            6,
            8
        )}`;
    });
}

/** 인보이스 생성 페이지와 동일: 행정 API + 캘린더 키워드 이벤트 병합 */
export async function fetchHolidayDateSet(
    targetDates: string[]
): Promise<Set<string>> {
    if (targetDates.length === 0) {
        return new Set<string>();
    }

    const uniqueDates = Array.from(new Set(targetDates));
    const yearMonthPairs = Array.from(
        new Set(uniqueDates.map((date) => date.slice(0, 7)))
    );
    const years = Array.from(
        new Set(uniqueDates.map((date) => Number(date.slice(0, 4))))
    );

    const publicHolidayResults = await Promise.all(
        yearMonthPairs.map(async (pair) => {
            const [year, month] = pair.split("-").map(Number);
            return fetchPublicHolidays(year, month - 1);
        })
    );

    const calendarEventsResults = await Promise.all(
        years.map((year) => getCalendarEvents({ year }))
    );

    const merged = new Set<string>();

    publicHolidayResults.flat().forEach((date) => merged.add(date));

    calendarEventsResults.flat().forEach((event) => {
        const title = event.title?.trim() ?? "";
        const isHolidayLikeEvent = HOLIDAY_KEYWORDS.some((keyword) =>
            title.includes(keyword)
        );

        if (!isHolidayLikeEvent) return;

        enumerateDateRange(event.start_date, event.end_date).forEach((date) =>
            merged.add(date)
        );
    });

    return merged;
}

/** 워크로드 날짜 표시용: 토요일 파랑, 일요일·공휴일 빨강 */
export function getWorkloadDateColorClass(
    dateText: string,
    holidayDateKeys: ReadonlySet<string> = EMPTY_HOLIDAY_DATE_SET
): string {
    const date = new Date(`${dateText}T00:00:00`);
    if (Number.isNaN(date.getTime())) {
        return "text-gray-800";
    }

    const day = date.getDay();
    if (day === 0 || holidayDateKeys.has(dateText)) {
        return "text-red-600";
    }
    if (day === 6) {
        return "text-blue-600";
    }
    return "text-gray-800";
}
