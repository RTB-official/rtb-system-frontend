import { supabase } from "./supabase";
import { CalendarEvent } from "../types";
import { Vacation } from "./vacationApi";
import { PersonalExpense, PersonalMileage } from "./personalExpenseApi";

// ==================== 타입 정의 ====================

export interface CalendarEventRecord {
    id: string;
    user_id: string;
    title: string;
    color: string;
    start_date: string; // YYYY-MM-DD
    end_date: string; // YYYY-MM-DD
    start_time?: string | null;
    end_time?: string | null;
    all_day: boolean;
    description?: string | null;
    created_at: string;
    updated_at: string;
}

export interface CreateCalendarEventInput {
    user_id: string;
    title: string;
    color?: string;
    start_date: string; // YYYY-MM-DD
    end_date: string; // YYYY-MM-DD
    start_time?: string;
    end_time?: string;
    all_day?: boolean;
    description?: string;
}

export interface UpdateCalendarEventInput {
    title?: string;
    color?: string;
    start_date?: string;
    end_date?: string;
    start_time?: string;
    end_time?: string;
    all_day?: boolean;
    description?: string;
}

export interface WorkLogWithPersons {
    id: number;
    author: string;
    subject: string;
    created_at: string;
    persons: string[];
    date_from?: string;
    date_to?: string;
}

// ==================== 일정 관리 ====================

/**
 * 일정 생성
 */
export async function createCalendarEvent(
    data: CreateCalendarEventInput
): Promise<CalendarEventRecord> {
    const { data: event, error } = await supabase
        .from("calendar_events")
        .insert([
            {
                ...data,
                all_day: data.all_day ?? true,
            },
        ])
        .select()
        .single();

    if (error) {
        console.error("Error creating calendar event:", error);
        throw new Error(`일정 생성 실패: ${error.message}`);
    }

    return event;
}

/**
 * 일정 수정
 */
export async function updateCalendarEvent(
    eventId: string,
    data: UpdateCalendarEventInput
): Promise<CalendarEventRecord> {
    const { data: event, error } = await supabase
        .from("calendar_events")
        .update(data)
        .eq("id", eventId)
        .select()
        .single();

    if (error) {
        console.error("Error updating calendar event:", error);
        throw new Error(`일정 수정 실패: ${error.message}`);
    }

    return event;
}

/**
 * 일정 삭제
 */
export async function deleteCalendarEvent(
    eventId: string
): Promise<void> {
    const { error } = await supabase
        .from("calendar_events")
        .delete()
        .eq("id", eventId);

    if (error) {
        console.error("Error deleting calendar event:", error);
        throw new Error(`일정 삭제 실패: ${error.message}`);
    }
}

/**
 * 일정 목록 조회 (전체)
 */
export async function getCalendarEvents(filters?: {
    year?: number;
    month?: number;
}): Promise<CalendarEventRecord[]> {
    let query = supabase
        .from("calendar_events")
        .select("*")
        .order("start_date", { ascending: true });

    if (filters?.year) {
        const startDate = `${filters.year}-01-01`;
        const endDate = `${filters.year}-12-31`;
        query = query.gte("start_date", startDate).lte("end_date", endDate);
    }

    if (filters?.month !== undefined && filters?.year) {
        const startDate = `${filters.year}-${String(filters.month + 1).padStart(
            2,
            "0"
        )}-01`;
        const endDate = `${filters.year}-${String(filters.month + 1).padStart(
            2,
            "0"
        )}-31`;
        query = query.gte("start_date", startDate).lte("end_date", endDate);
    }

    const { data, error } = await query;

    if (error) {
        console.error("Error fetching calendar events:", error);
        throw new Error(`일정 조회 실패: ${error.message}`);
    }

    return data || [];
}

// ==================== 출장보고서 조회 ====================

/**
 * 출장보고서 조회 (전체 공개)
 */
export async function getWorkLogsForDashboard(
    currentUserId: string,
    currentUserName: string | null, // 사용하지 않지만 호환성을 위해 유지
    filters?: {
        year?: number;
        month?: number;
    }
): Promise<WorkLogWithPersons[]> {
    // 1. 먼저 work_logs 조회
    let query = supabase
        .from("work_logs")
        .select("id, author, subject, created_at")
        .eq("is_draft", false)
        .order("created_at", { ascending: false });

    const { data: workLogs, error: workLogsError } = await query;

    if (workLogsError) {
        console.error("Error fetching work logs:", workLogsError);
        throw new Error(`출장보고서 조회 실패: ${workLogsError.message}`);
    }

    if (!workLogs || workLogs.length === 0) return [];

    const workLogIds = workLogs.map((log) => log.id);

    // 2. work_log_persons 조회
    const { data: personsData, error: personsError } = await supabase
        .from("work_log_persons")
        .select("work_log_id, person_name")
        .in("work_log_id", workLogIds);

    if (personsError) {
        console.error("Error fetching work log persons:", personsError);
        throw new Error(`출장보고서 참여자 조회 실패: ${personsError.message}`);
    }

    // 3. work_log_entries 조회 (날짜 정보)
    const { data: entriesData, error: entriesError } = await supabase
        .from("work_log_entries")
        .select("work_log_id, date_from, date_to")
        .in("work_log_id", workLogIds);

    if (entriesError) {
        console.error("Error fetching work log entries:", entriesError);
        // 날짜 정보는 필수가 아니므로 에러를 무시
    }

    // 4. 데이터 그룹화
    const personsMap = new Map<number, string[]>();
    if (personsData) {
        for (const person of personsData) {
            const logId = person.work_log_id;
            if (!personsMap.has(logId)) {
                personsMap.set(logId, []);
            }
            const names = personsMap.get(logId)!;
            if (!names.includes(person.person_name)) {
                names.push(person.person_name);
            }
        }
    }

    const datesMap = new Map<number, { date_from?: string; date_to?: string }>();
    if (entriesData) {
        for (const entry of entriesData) {
            const logId = entry.work_log_id;
            if (!datesMap.has(logId)) {
                datesMap.set(logId, {
                    date_from: entry.date_from || undefined,
                    date_to: entry.date_to || undefined,
                });
            } else {
                const existing = datesMap.get(logId)!;
                if (entry.date_from && (!existing.date_from || entry.date_from < existing.date_from)) {
                    existing.date_from = entry.date_from;
                }
                if (entry.date_to && (!existing.date_to || entry.date_to > existing.date_to)) {
                    existing.date_to = entry.date_to;
                }
            }
        }
    }

    // 5. 결과 조합 (권한 필터링 제거 - 전체 공개)
    const result: WorkLogWithPersons[] = [];

    for (const log of workLogs) {
        const persons = personsMap.get(log.id) || [];
        const dates = datesMap.get(log.id);
        
        result.push({
            id: log.id,
            author: log.author,
            subject: log.subject,
            created_at: log.created_at,
            persons,
            date_from: dates?.date_from,
            date_to: dates?.date_to,
        });
    }

    return result;
}

// ==================== CalendarEvent 변환 ====================

/**
 * 휴가를 CalendarEvent로 변환
 */
export function vacationToCalendarEvent(
    vacation: Vacation,
    userName?: string
): CalendarEvent {
    const leaveTypeMap: Record<string, string> = {
        FULL: "연차",
        AM: "오전반차",
        PM: "오후반차",
    };

    const title = userName
        ? `휴가 - ${userName} (${leaveTypeMap[vacation.leave_type] || vacation.leave_type})`
        : `휴가 (${leaveTypeMap[vacation.leave_type] || vacation.leave_type})`;

    return {
        id: `vacation-${vacation.id}`,
        title,
        color: "#60a5fa",
        startDate: vacation.date,
        endDate: vacation.date,
        attendees: vacation.user_id ? [vacation.user_id] : undefined,
    };
}

/**
 * 출장보고서를 CalendarEvent로 변환
 */
export function workLogToCalendarEvent(
    workLog: WorkLogWithPersons
): CalendarEvent {
    const startDate = workLog.date_from || workLog.created_at.split("T")[0];
    const endDate = workLog.date_to || startDate;

    return {
        id: `worklog-${workLog.id}`,
        title: `출장보고서 - ${workLog.subject}`,
        color: "#fb923c",
        startDate,
        endDate,
        attendees: workLog.persons,
    };
}

/**
 * 지출 내역을 CalendarEvent로 변환
 */
export function expenseToCalendarEvent(
    expense: PersonalExpense | PersonalMileage,
    type: "expense" | "mileage"
): CalendarEvent {
    const date =
        type === "expense"
            ? (expense as PersonalExpense).expense_date
            : (expense as PersonalMileage).m_date;

    const title =
        type === "expense"
            ? `지출 - ${(expense as PersonalExpense).expense_type}`
            : `마일리지 - ${(expense as PersonalMileage).from_text} → ${(expense as PersonalMileage).to_text}`;

    return {
        id: `${type}-${expense.id}`,
        title,
        color: "#bbf7d0",
        startDate: date,
        endDate: date,
    };
}

/**
 * CalendarEventRecord를 CalendarEvent로 변환
 */
export function calendarEventRecordToCalendarEvent(
    record: CalendarEventRecord
): CalendarEvent {
    return {
        id: `event-${record.id}`,
        title: record.title,
        color: record.color,
        startDate: record.start_date,
        endDate: record.end_date,
    };
}
