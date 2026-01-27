import { supabase } from "./supabase";
import { CalendarEvent } from "../types";
import { Vacation } from "./vacationApi";
import { PersonalExpense, PersonalMileage } from "./personalExpenseApi";
import {
    getGongmuTeamUserIds,
    createNotificationsForUsers,
} from "./notificationApi";

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
    attendees?: string[] | null;
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
    attendees?: string[];
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
    attendees?: string[];
}

export interface WorkLogWithPersons {
    id: number;
    author: string;
    subject: string;
    vessel?: string | null;
    created_at: string;
    persons: string[];
    date_from?: string;
    date_to?: string;
}

// ==================== 유틸리티 함수 ====================

/**
 * 특정 연도와 월의 마지막 날짜를 반환
 */
function getLastDayOfMonth(year: number, month: number): number {
    // month는 0-11 (0 = 1월, 11 = 12월)
    // 다음 달의 0일은 이번 달의 마지막 날
    return new Date(year, month + 1, 0).getDate();
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
                attendees: data.attendees || [],
            },
        ])
        .select()
        .single();

    if (error) {
        console.error("Error creating calendar event:", error);
        throw new Error(`일정 생성 실패: ${error.message}`);
    }

    // 일정 생성 시 공무팀 및 참여자에게 알림 생성
    try {
        // 사용자 이름 가져오기
        const { data: profile } = await supabase
            .from("profiles")
            .select("name")
            .eq("id", data.user_id)
            .single();

        const userName = profile?.name || "사용자";
        const targetUserIds: string[] = [];

        // 1. 참여자에게 알림 보내기
        if (data.attendees && data.attendees.length > 0) {
            // 참여자 이름을 user_id로 변환
            const { data: attendeeProfiles } = await supabase
                .from("profiles")
                .select("id, name")
                .in("name", data.attendees);

            if (attendeeProfiles) {
                const attendeeUserIds = attendeeProfiles
                    .map(p => p.id)
                    .filter(id => id !== data.user_id); // 본인 제외

                if (attendeeUserIds.length > 0) {
                    await createNotificationsForUsers(
                        attendeeUserIds,
                        "일정 참여 초대",
                        `${userName}님이 "${data.title}" 일정에 당신을 참여자로 추가했습니다.`,
                        "schedule"
                    );
                    targetUserIds.push(...attendeeUserIds);
                }
            }
        }

        // 2. 공무팀에 알림 생성 (본인 및 참여자 제외)
        const gongmuUserIds = await getGongmuTeamUserIds();
        const gongmuTargetUserIds = gongmuUserIds.filter(
            id => id !== data.user_id && !targetUserIds.includes(id)
        );
        
        if (gongmuTargetUserIds.length > 0) {
            await createNotificationsForUsers(
                gongmuTargetUserIds,
                "새 일정",
                `${userName}님이 새 일정 "${data.title}"을(를) 추가했습니다.`,
                "schedule"
            );
        }
    } catch (notificationError: any) {
        // 알림 생성 실패는 일정 생성을 막지 않음
        console.error("알림 생성 실패:", notificationError?.message || notificationError);
    }

    return event;
}

/**
 * 일정 수정
 */
export async function updateCalendarEvent(
    eventId: string,
    data: UpdateCalendarEventInput,
    currentUserId?: string
): Promise<CalendarEventRecord> {
    // 권한 체크 및 기존 일정 정보 가져오기
    let existingEvent: { user_id?: string; attendees?: string[] | null; title?: string } | null = null;
    
    if (currentUserId) {
        const { data: fetchedEvent, error: fetchError } = await supabase
            .from("calendar_events")
            .select("user_id, attendees, title")
            .eq("id", eventId)
            .single();

        if (fetchError) {
            console.error("Error fetching calendar event:", fetchError);
            throw new Error(`일정 조회 실패: ${fetchError.message}`);
        }

        if (fetchedEvent?.user_id !== currentUserId) {
            throw new Error("일정을 수정할 권한이 없습니다. 생성자만 수정할 수 있습니다.");
        }

        existingEvent = fetchedEvent;
    } else {
        // currentUserId가 없어도 기존 일정 정보는 가져와야 함
        const { data: fetchedEvent } = await supabase
            .from("calendar_events")
            .select("attendees, title")
            .eq("id", eventId)
            .single();
        
        existingEvent = fetchedEvent;
    }

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

    // 참여자가 추가된 경우 새로 추가된 참여자에게 알림 보내기
    if (data.attendees && existingEvent && currentUserId) {
        try {
            const existingAttendees = existingEvent.attendees || [];
            const newAttendees = data.attendees.filter(
                (name: string) => !existingAttendees.includes(name)
            );

            if (newAttendees.length > 0) {
                // 사용자 이름 가져오기
                const { data: profile } = await supabase
                    .from("profiles")
                    .select("name")
                    .eq("id", currentUserId)
                    .single();

                const userName = profile?.name || "사용자";

                // 새 참여자 이름을 user_id로 변환
                const { data: attendeeProfiles } = await supabase
                    .from("profiles")
                    .select("id, name")
                    .in("name", newAttendees);

                if (attendeeProfiles) {
                    const attendeeUserIds = attendeeProfiles
                        .map(p => p.id)
                        .filter(id => id !== currentUserId); // 본인 제외

                    if (attendeeUserIds.length > 0) {
                        await createNotificationsForUsers(
                            attendeeUserIds,
                            "일정 참여 초대",
                            `${userName}님이 "${existingEvent.title || event.title}" 일정에 당신을 참여자로 추가했습니다.`,
                            "schedule"
                        );
                    }
                }
            }
        } catch (notificationError: any) {
            // 알림 생성 실패는 일정 수정을 막지 않음
            console.error(
                "❌ [알림] 알림 생성 실패 (일정은 정상 수정됨):",
                notificationError?.message || notificationError,
                notificationError
            );
        }
    }

    return event;
}

/**
 * 일정 삭제
 */
export async function deleteCalendarEvent(
    eventId: string,
    currentUserId?: string
): Promise<void> {
    // 권한 체크: 생성자만 삭제 가능
    if (currentUserId) {
        const { data: existingEvent, error: fetchError } = await supabase
            .from("calendar_events")
            .select("user_id")
            .eq("id", eventId)
            .single();

        if (fetchError) {
            console.error("Error fetching calendar event:", fetchError);
            throw new Error(`일정 조회 실패: ${fetchError.message}`);
        }

        if (existingEvent?.user_id !== currentUserId) {
            throw new Error("일정을 삭제할 권한이 없습니다. 생성자만 삭제할 수 있습니다.");
        }
    }

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
        .select(
            "id, user_id, title, color, start_date, end_date, start_time, end_time, all_day, description, attendees, created_at, updated_at"
        )
        .order("start_date", { ascending: true })
        .limit(1000);

    if (filters?.year) {
        const startDate = `${filters.year}-01-01`;
        const endDate = `${filters.year}-12-31`;
        query = query.gte("start_date", startDate).lte("end_date", endDate);
    }

    if (filters?.month !== undefined && filters?.year) {
        const month = filters.month + 1; // 0-11 -> 1-12
        const lastDay = getLastDayOfMonth(filters.year, filters.month);
        const startDate = `${filters.year}-${String(month).padStart(2, "0")}-01`;
        const endDate = `${filters.year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
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
 * 출장보고서 조회 (전체 공개) - 최적화 버전
 */
export async function getWorkLogsForDashboard(
    _currentUserId: string,
    _currentUserName: string | null,
    filters?: {
        year?: number;
        month?: number;
    }
): Promise<WorkLogWithPersons[]> {
    // 1. 먼저 work_log_entries에서 날짜로 필터링하여 해당 월의 work_log_id만 가져오기
    let entriesQuery = supabase
        .from("work_log_entries")
        .select("work_log_id, date_from, date_to")
        .limit(1000);

    if (filters?.year && filters?.month !== undefined) {
        const month = filters.month + 1; // 0-11 -> 1-12
        const lastDay = getLastDayOfMonth(filters.year, filters.month);
        const startDate = `${filters.year}-${String(month).padStart(2, "0")}-01`;
        const endDate = `${filters.year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
        entriesQuery = entriesQuery
            .gte("date_from", startDate)
            .lte("date_from", endDate);
    } else if (filters?.year) {
        const startDate = `${filters.year}-01-01`;
        const endDate = `${filters.year}-12-31`;
        entriesQuery = entriesQuery
            .gte("date_from", startDate)
            .lte("date_from", endDate);
    }

    const { data: entriesData, error: entriesError } = await entriesQuery;

    if (entriesError || !entriesData || entriesData.length === 0) {
        return [];
    }

    // 고유한 work_log_id만 추출
    const workLogIds = [...new Set(entriesData.map((e) => e.work_log_id))];
    if (workLogIds.length === 0) return [];

    // 2. 병렬로 work_logs와 work_log_persons 조회
    const [workLogsResult, personsResult] = await Promise.all([
        supabase
            .from("work_logs")
            .select("id, author, subject, vessel, created_at")
            .eq("is_draft", false)
            .in("id", workLogIds)
            .limit(500),
        supabase
            .from("work_log_persons")
            .select("work_log_id, person_name")
            .in("work_log_id", workLogIds),
    ]);

    const { data: workLogs, error: workLogsError } = workLogsResult;
    const { data: personsData, error: personsError } = personsResult;

    if (workLogsError) {
        console.error("Error fetching work logs:", workLogsError);
        throw new Error(`출장보고서 조회 실패: ${workLogsError.message}`);
    }

    if (!workLogs || workLogs.length === 0) return [];

    if (personsError) {
        console.error("Error fetching work log persons:", personsError);
        // 에러가 있어도 계속 진행
    }

    // 3. 데이터 그룹화
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

    const datesMap = new Map<
        number,
        { date_from?: string; date_to?: string }
    >();
    for (const entry of entriesData) {
        const logId = entry.work_log_id;
        if (!datesMap.has(logId)) {
            datesMap.set(logId, {
                date_from: entry.date_from || undefined,
                date_to: entry.date_to || undefined,
            });
        } else {
            const existing = datesMap.get(logId)!;
            if (
                entry.date_from &&
                (!existing.date_from || entry.date_from < existing.date_from)
            ) {
                existing.date_from = entry.date_from;
            }
            if (
                entry.date_to &&
                (!existing.date_to || entry.date_to > existing.date_to)
            ) {
                existing.date_to = entry.date_to;
            }
        }
    }

    // 4. 결과 조합
    const result: WorkLogWithPersons[] = [];

    for (const log of workLogs) {
        const persons = personsMap.get(log.id) || [];
        const dates = datesMap.get(log.id);

        result.push({
            id: log.id,
            author: log.author,
            subject: log.subject,
            vessel: log.vessel,
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

    const leaveTypeText = leaveTypeMap[vacation.leave_type] || vacation.leave_type;

    const title = userName
        ? `휴가 - ${userName} ${leaveTypeText}`
        : `휴가 ${leaveTypeText}`;

    // 상태에 따라 색상 변경
    let color = "#60a5fa"; // 기본 파란색 (승인 완료)
    if (vacation.status === "pending") {
        color = "#fbbf24"; // 노란색 (대기 중)
    } else if (vacation.status === "rejected") {
        color = "#ef4444"; // 빨간색 (반려)
    }

    return {
        id: `vacation-${vacation.id}`,
        title,
        color,
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
    const vessel = workLog.vessel?.trim() || "";
    const subject = workLog.subject?.trim() || "";
    const detail = [vessel, subject].filter(Boolean).join(" ");

    return {
        id: `worklog-${workLog.id}`,
        title: `출장 보고서 - ${detail}`,
        color: "#84cc16", // 연두색
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
            : `마일리지 - ${(expense as PersonalMileage).from_text} → ${
                  (expense as PersonalMileage).to_text
              }`;

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
        color: "#fb923c", // 주황색 (일정)
        startDate: record.start_date,
        endDate: record.end_date,
        userId: record.user_id, // 생성자 ID 포함
        attendees: record.attendees || [],
    };
}
