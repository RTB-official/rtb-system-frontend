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
    attendees?: string[];
}
