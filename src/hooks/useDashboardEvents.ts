import { useState, useEffect, useMemo } from "react";
import { CalendarEvent } from "../types";
import { useAuth } from "../store/auth";
import { supabase } from "../lib/supabase";
import { getVacations } from "../lib/vacationApi";
import {
    getWorkLogsForDashboard,
    getCalendarEvents,
    vacationToCalendarEvent,
    workLogToCalendarEvent,
    calendarEventRecordToCalendarEvent,
} from "../lib/dashboardApi";

/**
 * 대시보드 이벤트 데이터를 관리하는 훅
 */
export function useDashboardEvents(year: number, month: number) {
    const { user } = useAuth();
    const [allEvents, setAllEvents] = useState<CalendarEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [userDepartment, setUserDepartment] = useState<string | null>(null);

    // 사용자 department 정보 로드
    useEffect(() => {
        if (!user?.id) return;

        const fetchUserDepartment = async () => {
            const { data, error } = await supabase
                .from("profiles")
                .select("department")
                .eq("id", user.id)
                .single();

            if (error) {
                console.error("유저 department 조회 실패:", error.message);
                return;
            }

            if (data?.department) {
                setUserDepartment(data.department);
            }
        };

        fetchUserDepartment();
    }, [user]);

    // 실제 데이터 가져오기
    useEffect(() => {
        const loadEvents = async () => {
            if (!user?.id) {
                setLoading(false);
                return;
            }

            setLoading(true);
            try {
                // 병렬로 모든 데이터 로드
                const [vacationsResult, workLogsResult, calendarEventsResult] =
                    await Promise.allSettled([
                        getVacations(undefined, { year, month }),
                        getWorkLogsForDashboard(user.id, null, { year, month }),
                        getCalendarEvents({ year, month }),
                    ]);

                const events: CalendarEvent[] = [];

                // 1. 휴가 처리 (프로필 배치 조회)
                if (vacationsResult.status === "fulfilled") {
                    const vacations = vacationsResult.value;

                    // 모든 user_id 수집
                    const userIds = [
                        ...new Set(
                            vacations.map((v) => v.user_id).filter(Boolean)
                        ),
                    ];

                    // 프로필을 한 번에 조회
                    let profileMap = new Map<string, string>();
                    if (userIds.length > 0) {
                        try {
                            const { data: profiles } = await supabase
                                .from("profiles")
                                .select("id, name")
                                .in("id", userIds);

                            if (profiles) {
                                profiles.forEach((p) => {
                                    if (p.id && p.name) {
                                        profileMap.set(p.id, p.name);
                                    }
                                });
                            }
                        } catch (err) {
                            console.error("프로필 조회 실패:", err);
                        }
                    }

                    // 휴가 이벤트 생성
                    // 모든 사용자에게 모든 상태(대기 중/승인 완료/반려)의 모든 휴가 표시
                    vacations.forEach((vacation) => {
                        const userName = vacation.user_id
                            ? profileMap.get(vacation.user_id)
                            : undefined;
                        events.push(
                            vacationToCalendarEvent(vacation, userName)
                        );
                    });
                } else {
                    console.error(
                        "Error loading vacations:",
                        vacationsResult.reason
                    );
                }

                // 2. 출장보고서 처리
                if (workLogsResult.status === "fulfilled") {
                    const workLogs = workLogsResult.value;
                    workLogs.forEach((workLog) => {
                        const event = workLogToCalendarEvent(workLog);
                        events.push(event);
                    });
                } else {
                    console.error(
                        "Error loading work logs:",
                        workLogsResult.reason
                    );
                }

                // 3. 캘린더 이벤트 처리
                if (calendarEventsResult.status === "fulfilled") {
                    const calendarEvents = calendarEventsResult.value;
                    calendarEvents.forEach((event) => {
                        events.push(calendarEventRecordToCalendarEvent(event));
                    });
                } else {
                    console.error(
                        "Error loading calendar events:",
                        calendarEventsResult.reason
                    );
                }

                setAllEvents(events);
            } catch (err) {
                console.error("Error loading events:", err);
            } finally {
                setLoading(false);
            }
        };

        loadEvents();
    }, [user?.id, year, month, userDepartment]);

    return {
        allEvents,
        setAllEvents,
        loading,
        userDepartment,
    };
}

/**
 * 공휴일 데이터를 연속된 일정으로 병합
 */
export function useMergedHolidays(
    holidays: Record<string, string>
): CalendarEvent[] {
    return useMemo(() => {
        const merged: CalendarEvent[] = [];
        const sortedKeys = Object.keys(holidays).sort();

        let currentHoliday: {
            title: string;
            start: string;
            end: string;
        } | null = null;

        for (const key of sortedKeys) {
            const title = holidays[key];
            if (!currentHoliday) {
                currentHoliday = { title, start: key, end: key };
            } else if (currentHoliday.title === title) {
                // 다음 날인지 확인
                const prevEndDate = new Date(currentHoliday.end);
                const currentDate = new Date(key);
                const diffTime = currentDate.getTime() - prevEndDate.getTime();
                const diffDays = diffTime / (1000 * 60 * 60 * 24);

                if (diffDays === 1) {
                    currentHoliday.end = key;
                } else {
                    merged.push({
                        id: `holiday-${currentHoliday.start}`,
                        title: currentHoliday.title,
                        color: "#ef4444",
                        startDate: currentHoliday.start,
                        endDate: currentHoliday.end,
                        isHoliday: true,
                    });
                    currentHoliday = { title, start: key, end: key };
                }
            } else {
                merged.push({
                    id: `holiday-${currentHoliday.start}`,
                    title: currentHoliday.title,
                    color: "#ef4444",
                    startDate: currentHoliday.start,
                    endDate: currentHoliday.end,
                    isHoliday: true,
                });
                currentHoliday = { title, start: key, end: key };
            }
        }

        if (currentHoliday) {
            merged.push({
                id: `holiday-${currentHoliday.start}`,
                title: currentHoliday.title,
                color: "#ef4444",
                startDate: currentHoliday.start,
                endDate: currentHoliday.end,
                isHoliday: true,
            });
        }

        return merged;
    }, [holidays]);
}

/**
 * 태그 우선순위에 따른 정렬된 이벤트
 */
export function useSortedEvents(
    allEvents: CalendarEvent[],
    mergedHolidays: CalendarEvent[]
): CalendarEvent[] {
    return useMemo(() => {
        const combined = [...allEvents, ...mergedHolidays];
        return combined.sort((a, b) => {
            // 0. 공휴일 우선 순위 (공휴일은 항상 맨 위)
            if (a.isHoliday && !b.isHoliday) return -1;
            if (!a.isHoliday && b.isHoliday) return 1;

            const aStart = new Date(a.startDate).getTime();
            const bStart = new Date(b.startDate).getTime();
            const aEnd = new Date(a.endDate).getTime();
            const bEnd = new Date(b.endDate).getTime();
            const aDuration = aEnd - aStart;
            const bDuration = bEnd - bStart;

            // 1. 연속된 같은 일정 (1일 이상일 경우) - 기간이 긴 순서
            if (aDuration !== bDuration) {
                return bDuration - aDuration;
            }
            // 2. 시간이 빠른 일정 - 시작일이 빠른 순서
            return aStart - bStart;
        });
    }, [allEvents, mergedHolidays]);
}

