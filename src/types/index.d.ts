// Global type definitions
export interface User {
    id: string;
    name: string;
}

export interface ApiResponse<T> {
    data: T;
    status: number;
}

export interface CalendarEvent {
    id: string;
    title: string;
    color: string;
    startDate: string; // YYYY-MM-DD 형식
    endDate: string; // YYYY-MM-DD 형식
    isHoliday?: boolean;
    /** 일정이 하루종일인 경우 true. 캘린더/상세에서 "하루종일" 표기 시 사용 */
    allDay?: boolean;
    /** 하루종일이 아닐 때 시작 시간 (HH:mm 등) */
    startTime?: string;
    /** 하루종일이 아닐 때 종료 시간 (HH:mm 등) */
    endTime?: string;
    attendees?: string[];
    userId?: string; // 일정 생성자 ID
}
