// DashboardPage.tsx
import React, { useMemo, useState, useEffect, useRef } from "react";
import ScheduleModal from "../../components/common/ScheduleModal";
import Sidebar from "../../components/Sidebar";
import CalendarMenu from "../../components/CalendarMenu";
import EventModal from "../../components/EventModal";
import Button from "../../components/common/Button";
import BaseModal from "../../components/ui/BaseModal";
import EventDetailMenu from "../../components/common/EventDetailMenu";
import WeekRow from "../../components/calendar/WeekRow";
import {
    IconChevronLeft,
    IconChevronRight,
    IconMenu,
} from "../../components/icons/Icons";
import { CalendarEvent } from "../../types";
import useCalendarWheelNavigation from "../../hooks/useCalendarWheelNavigation";
import { useAuth } from "../../store/auth";
import { getVacations } from "../../lib/vacationApi";
import {
    getWorkLogsForDashboard,
    getCalendarEvents,
    createCalendarEvent,
    updateCalendarEvent,
    deleteCalendarEvent,
    vacationToCalendarEvent,
    workLogToCalendarEvent,
    calendarEventRecordToCalendarEvent,
} from "../../lib/dashboardApi";
import { supabase } from "../../lib/supabase";

// 공휴일 API 정보
const HOLIDAY_API_KEY =
    "cac7adf961a1b55472fa90319e4cb89dde6c04242edcb3d3970ae9e09c931e98";
const HOLIDAY_API_ENDPOINT =
    "https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo";

function generateMonthGrid(year: number, month: number) {
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

export default function DashboardPage() {
    const { user } = useAuth();
    const today = new Date();

    const getColumnPadding = (index: number) => {
        if (index === 0) return "pl-9 pr-4";
        if (index === 6) return "pl-4 pr-9";
        return "px-4";
    };
    const [year, setYear] = useState(today.getFullYear());
    const [month, setMonth] = useState(today.getMonth());

    // 공휴일 상태
    const [holidays, setHolidays] = useState<Record<string, string>>({});

    // 공휴일 데이터 가져오기
    useEffect(() => {
        const fetchYearHolidays = async (targetYear: number) => {
            try {
                // 한 번에 일년치를 가져오려면 반복문이 필요할 수 있으나,
                // 해당 API는 월별 조회가 기본이므로 현재 연도의 1~12월을 가져옵니다.
                const results: Record<string, string> = {};

                // 성능을 위해 병렬 처리
                const fetchPromises = Array.from({ length: 12 }, (_, i) => {
                    const month = String(i + 1).padStart(2, "0");
                    const url = `${HOLIDAY_API_ENDPOINT}?serviceKey=${HOLIDAY_API_KEY}&solYear=${targetYear}&solMonth=${month}&_type=json&numOfRows=100`;
                    return fetch(url).then((res) => res.json());
                });

                const responses = await Promise.all(fetchPromises);

                responses.forEach((data) => {
                    const items = data.response?.body?.items?.item;
                    if (items) {
                        const itemList = Array.isArray(items) ? items : [items];
                        itemList.forEach((item: any) => {
                            // locdate: 20250101 -> 2025-01-01
                            const dateStr = String(item.locdate);
                            const formattedDate = `${dateStr.slice(
                                0,
                                4
                            )}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
                            results[formattedDate] = item.dateName;
                        });
                    }
                });

                setHolidays((prev) => ({ ...prev, ...results }));
            } catch (error) {
                console.error("공휴일 정보를 가져오는데 실패했습니다:", error);
            }
        };

        fetchYearHolidays(year);
        // 연도가 바뀌면 해당 연도 공휴일도 추가로 가져옴
    }, [year]);
    const grid = useMemo(() => generateMonthGrid(year, month), [year, month]);

    const [sidebarOpen, setSidebarOpen] = useState(false);

    const [menuOpen, setMenuOpen] = useState(false);
    const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(
        null
    );
    const [menuDate, setMenuDate] = useState<string | null>(null);
    const [eventModalOpen, setEventModalOpen] = useState(false);
    const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(
        null
    );
    const [hiddenEventsModalOpen, setHiddenEventsModalOpen] = useState(false);
    const [hiddenEventsDate, setHiddenEventsDate] = useState<{
        dateKey: string;
        threshold: number;
    } | null>(null);
    const [eventDetailMenuOpen, setEventDetailMenuOpen] = useState(false);
    const [eventDetailMenuPos, setEventDetailMenuPos] = useState<{
        x: number;
        y: number;
    } | null>(null);
    const [selectedEventForMenu, setSelectedEventForMenu] =
        useState<CalendarEvent | null>(null);

    const menuOpenRef = React.useRef(menuOpen);
    const menuDateRef = React.useRef(menuDate);

    const cellRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const [cellHeights, setCellHeights] = useState<Record<string, number>>({});

    React.useEffect(() => {
        menuOpenRef.current = menuOpen;
        menuDateRef.current = menuDate;
    }, [menuOpen, menuDate]);

    useEffect(() => {
        const handler = (e: any) => {
            const d = e.detail;
            if (d && d.x != null && d.y != null) {
                if (menuOpenRef.current && menuDateRef.current === d.date) {
                    setMenuOpen(false);
                    setMenuDate(null);
                    setMenuPos(null);
                    return;
                }

                setMenuPos({ x: d.x, y: d.y });
                setMenuDate(d.date);
                setMenuOpen(true);
            }
        };

        window.addEventListener("showCalendarMenu", handler as EventListener);

        const openHandler = (e: any) => {
            const date = e.detail?.date || selectedDateForModal || menuDate;
            const endDate = e.detail?.endDate || selectedEndDateForModal;
            if (date) {
                setSelectedDateForModal(date);
            }
            if (endDate) {
                setSelectedEndDateForModal(endDate);
            }
            setEventModalOpen(true);
            setMenuOpen(false);
            setMenuPos(null);
        };
        window.addEventListener("openEventForm", openHandler as EventListener);

        return () => {
            window.removeEventListener(
                "showCalendarMenu",
                handler as EventListener
            );
            window.removeEventListener(
                "openEventForm",
                openHandler as EventListener
            );
        };
    }, []);

    // (선택) 모바일 사이드바 열릴 때 body 스크롤 잠금
    useEffect(() => {
        document.body.style.overflow = sidebarOpen ? "hidden" : "";
        return () => {
            document.body.style.overflow = "";
        };
    }, [sidebarOpen]);

    const prevMonth = () => {
        if (month === 0) {
            setYear((y) => y - 1);
            setMonth(11);
        } else {
            setMonth((m) => m - 1);
        }
    };

    const nextMonth = () => {
        if (month === 11) {
            setYear((y) => y + 1);
            setMonth(0);
        } else {
            setMonth((m) => m + 1);
        }
    };

    const goToday = () => {
        setYear(today.getFullYear());
        setMonth(today.getMonth());
    };

    const {
        handleWheel: handleCalendarScroll,
        motionStyle: calendarMotionStyle,
    } = useCalendarWheelNavigation({
        onPrevMonth: prevMonth,
        onNextMonth: nextMonth,
    });

    // 안전하게 날짜 키 생성
    const getSafeDateKey = (d: Date) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
    };

    // Schedule modal state
    const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
    const [selectedDateForModal, setSelectedDateForModal] =
        useState<string>("");
    const [selectedEndDateForModal, setSelectedEndDateForModal] =
        useState<string>("");

    // 이벤트를 날짜별로 그룹화
    const [allEvents, setAllEvents] = useState<CalendarEvent[]>([]);
    const [loading, setLoading] = useState(true);

    // 실제 데이터 가져오기
    useEffect(() => {
        const loadEvents = async () => {
            if (!user?.id) {
                setLoading(false);
                return;
            }

            setLoading(true);
            try {
                const events: CalendarEvent[] = [];

                // 1. 휴가 조회 (전체 공개)
                try {
                    const vacations = await getVacations(undefined, {
                        year,
                        month,
                    });
                    for (const vacation of vacations) {
                        // 사용자 이름 가져오기 시도
                        let userName: string | undefined;
                        if (vacation.user_id) {
                            try {
                                const { data: profile } = await supabase
                                    .from("profiles")
                                    .select("name")
                                    .eq("id", vacation.user_id)
                                    .single();
                                if (profile) {
                                    userName = profile.name;
                                }
                            } catch (err) {
                                // RLS 에러 무시
                            }
                        }
                        events.push(
                            vacationToCalendarEvent(vacation, userName)
                        );
                    }
                } catch (err) {
                    console.error("Error loading vacations:", err);
                }

                // 2. 출장보고서 조회 (전체 공개)
                try {
                    // 권한 필터링 없이 모든 출장보고서 조회
                    const workLogs = await getWorkLogsForDashboard(
                        user.id,
                        null, // 필터링 제거 (전체 공개)
                        { year, month }
                    );
                    for (const workLog of workLogs) {
                        events.push(workLogToCalendarEvent(workLog));
                    }
                } catch (err) {
                    console.error("Error loading work logs:", err);
                }

                // 3. 일정 조회 (전체)
                try {
                    const calendarEvents = await getCalendarEvents({
                        year,
                        month,
                    });
                    for (const event of calendarEvents) {
                        events.push(calendarEventRecordToCalendarEvent(event));
                    }
                } catch (err) {
                    console.error("Error loading calendar events:", err);
                }

                setAllEvents(events);
            } catch (err) {
                console.error("Error loading events:", err);
            } finally {
                setLoading(false);
            }
        };

        loadEvents();
    }, [user?.id, year, month]);

    // 공휴일 데이터를 연속된 일정으로 병합
    const mergedHolidays = useMemo(() => {
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

        return merged;
    }, [holidays]);

    // 태그 우선순위에 따른 정렬된 이벤트
    const sortedEvents = useMemo(() => {
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

    // 주 단위로 그리드 데이터 나누기
    const weeks = useMemo(() => {
        const result = [];
        for (let i = 0; i < grid.length; i += 7) {
            result.push(grid.slice(i, i + 7));
        }
        return result;
    }, [grid]);

    // 셀 높이 측정을 위한 ResizeObserver
    useEffect(() => {
        const observer = new ResizeObserver((entries) => {
            const newHeights: Record<string, number> = {};
            for (let entry of entries) {
                if (entry.target instanceof HTMLElement) {
                    const dateKey = entry.target.dataset.dateKey;
                    if (dateKey) {
                        newHeights[dateKey] = entry.contentRect.height;
                    }
                }
            }
            setCellHeights((prev) => ({
                ...prev,
                ...newHeights,
            }));
        });

        // 모든 셀 관찰
        for (const dateKey in cellRefs.current) {
            const cell = cellRefs.current[dateKey];
            if (cell) {
                observer.observe(cell);
            }
        }

        return () => {
            observer.disconnect();
        };
    }, [weeks]);

    // 드래그 선택 상태
    const [dragStart, setDragStart] = useState<string | null>(null);
    const [dragEnd, setDragEnd] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);

    // 전역 마우스 이벤트로 드래그 처리
    useEffect(() => {
        const handleMouseUp = () => {
            if (isDragging) {
                setIsDragging(false);
                const dragDuration =
                    dragStart && dragEnd && dragStart !== dragEnd;
                if (dragStart && dragEnd && dragDuration) {
                    // 드래그가 끝나면 모달 열기
                    const ev = new CustomEvent("openEventForm", {
                        detail: {
                            date: dragStart,
                            endDate: dragEnd,
                        },
                    });
                    window.dispatchEvent(ev);
                }
                setDragStart(null);
                setDragEnd(null);
            }
        };

        if (isDragging) {
            document.addEventListener("mouseup", handleMouseUp);
            return () => {
                document.removeEventListener("mouseup", handleMouseUp);
            };
        }
    }, [isDragging, dragStart, dragEnd]);

    // 날짜 범위 포맷팅 함수
    const formatDateRange = (startDate: string, endDate: string): string => {
        const start = new Date(startDate);
        const end = new Date(endDate);

        const startStr = `${start.getMonth() + 1}월 ${start.getDate()}일`;
        const endStr = `${end.getMonth() + 1}월 ${end.getDate()}일`;

        if (startDate === endDate) {
            return `${startStr}`;
        }
        return `${startStr} ~ ${endStr}`;
    };

    // 일정 저장 핸들러
    const handleEventSave = async (data: {
        title: string;
        startDate: string;
        startTime?: string;
        endDate: string;
        endTime?: string;
        allDay: boolean;
        attendees?: string[]; // EventForm에서 전달하지만 사용하지 않음
    }) => {
        if (!user?.id) return;

        try {
            const colors = [
                "#60a5fa",
                "#fb923c",
                "#bbf7d0",
                "#fbbf24",
                "#a78bfa",
            ];
            const randomColor =
                colors[Math.floor(Math.random() * colors.length)];

            if (editingEvent) {
                // 기존 이벤트 수정 (event- 접두사가 있는 경우만)
                if (editingEvent.id.startsWith("event-")) {
                    const eventId = editingEvent.id.replace("event-", "");
                    await updateCalendarEvent(eventId, {
                        title: data.title,
                        start_date: data.startDate,
                        end_date: data.endDate,
                        start_time: data.startTime || undefined,
                        end_time: data.endTime || undefined,
                        all_day: data.allDay,
                    });
                } else {
                    // 다른 타입의 이벤트는 수정 불가
                    console.warn("Cannot edit this type of event");
                    return;
                }
            } else {
                // 새 이벤트 생성
                await createCalendarEvent({
                    user_id: user.id,
                    title: data.title,
                    color: randomColor,
                    start_date: data.startDate,
                    end_date: data.endDate,
                    start_time: data.startTime,
                    end_time: data.endTime,
                    all_day: data.allDay ?? true,
                });
            }

            // 데이터 다시 로드
            const calendarEvents = await getCalendarEvents({ year, month });
            const newEvents = calendarEvents.map(
                calendarEventRecordToCalendarEvent
            );

            // 기존 이벤트 중 calendar_events가 아닌 것들 유지
            const otherEvents = allEvents.filter(
                (e) => !e.id.startsWith("event-")
            );
            setAllEvents([...otherEvents, ...newEvents]);

            setEditingEvent(null);
            setEventModalOpen(false);
        } catch (err) {
            console.error("Error saving event:", err);
            alert("일정 저장에 실패했습니다.");
        }
    };

    // 일정 삭제 핸들러
    const handleEventDelete = async (eventId: string) => {
        try {
            // event- 접두사가 있는 경우만 삭제 가능 (calendar_events 테이블의 일정)
            if (eventId.startsWith("event-")) {
                const id = eventId.replace("event-", "");
                await deleteCalendarEvent(id);
            } else {
                // 다른 타입의 이벤트는 삭제 불가
                console.warn("Cannot delete this type of event");
                return;
            }

            // 데이터 다시 로드
            const calendarEvents = await getCalendarEvents({ year, month });
            const newEvents = calendarEvents.map(
                calendarEventRecordToCalendarEvent
            );

            // 기존 이벤트 중 calendar_events가 아닌 것들 유지
            const otherEvents = allEvents.filter(
                (e) => !e.id.startsWith("event-")
            );
            setAllEvents([...otherEvents, ...newEvents]);

            setEditingEvent(null);
            setEventModalOpen(false);
            setEventDetailMenuOpen(false);
        } catch (err) {
            console.error("Error deleting event:", err);
            alert("일정 삭제에 실패했습니다.");
        }
    };

    // 특정 날짜의 이벤트 목록 가져오기
    const getEventsForDate = (dateKey: string): CalendarEvent[] => {
        return sortedEvents.filter((event) => {
            const eventStart = new Date(event.startDate);
            const eventEnd = new Date(event.endDate);
            const current = new Date(dateKey);
            return current >= eventStart && current <= eventEnd;
        });
    };

    // 주 단위 이벤트 행 계산 함수 (연속된 일정을 위해)
    const getWeekEventRows = (week: { date: Date; inMonth: boolean }[]) => {
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
                    Math.max(eventStart.getTime(), weekStart.getTime())
                );
                const end = new Date(
                    Math.min(eventEnd.getTime(), weekEnd.getTime())
                );

                const startOffset = Math.round(
                    (start.getTime() - weekStart.getTime()) / dayMs
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

        // 슬롯(행) 할당
        const rows: (typeof segments)[] = [];
        segments.forEach((segment) => {
            let assigned = false;
            for (let i = 0; i < rows.length; i++) {
                const canFit = !rows[i].some(
                    (s) =>
                        segment.startOffset < s.startOffset + s.duration &&
                        s.startOffset < segment.startOffset + segment.duration
                );

                if (canFit) {
                    rows[i].push(segment);
                    assigned = true;
                    break;
                }
            }
            if (!assigned) {
                rows.push([segment]);
            }
        });

        // 각 세그먼트에 rowIndex를 추가하여 반환
        return rows
            .map((row, rowIndex) =>
                row.map((segment) => ({ ...segment, rowIndex }))
            )
            .flat();
    };

    return (
        <div className="flex h-screen bg-white overflow-hidden font-pretendard">
            {/* Mobile Overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-20 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar - 데스크탑 고정, 모바일 슬라이드 */}
            <div
                className={`
          fixed lg:static inset-y-0 left-0 z-30
          w-[239px] h-screen shrink-0
          transform transition-transform duration-300 ease-in-out
          ${
              sidebarOpen
                  ? "translate-x-0"
                  : "-translate-x-full lg:translate-x-0"
          }
        `}
            >
                <Sidebar onClose={() => setSidebarOpen(false)} />
            </div>

            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* 헤더 없이 사이드바 메뉴 버튼만 표시 */}
                <div className="lg:hidden sticky top-0 z-10 shrink-0 bg-white border-b border-gray-200 px-4 h-18 flex items-center">
                    <button
                        onClick={() => setSidebarOpen(true)}
                        className="p-2 rounded-lg hover:bg-gray-100 text-gray-700"
                        aria-label="메뉴 열기"
                    >
                        <IconMenu />
                    </button>
                </div>

                <main className="flex-1 flex flex-col pt-9 pb-0">
                    <div className="flex-1 flex flex-col">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-3xl font-bold pl-9">
                                {year}년 {month + 1}월
                            </h2>
                            <div className="flex items-center gap-1 pr-9">
                                <Button
                                    variant="outline"
                                    size="md"
                                    onClick={prevMonth}
                                    icon={<IconChevronLeft />}
                                />
                                <Button
                                    variant="outline"
                                    size="md"
                                    onClick={goToday}
                                >
                                    오늘
                                </Button>
                                <Button
                                    variant="outline"
                                    size="md"
                                    onClick={nextMonth}
                                    icon={<IconChevronRight />}
                                />
                            </div>
                        </div>

                        <div className="bg-white flex-1 flex flex-col min-h-0 overflow-visible">
                            <div className="grid grid-cols-7 shrink-0 border-b border-gray-200">
                                {["일", "월", "화", "수", "목", "금", "토"].map(
                                    (d, i) => (
                                        <div
                                            key={d}
                                            className={`py-3 text-[17px] text-left font-medium ${
                                                i === 0
                                                    ? "text-red-500"
                                                    : i === 6
                                                    ? "text-blue-500"
                                                    : "text-gray-800"
                                            }`}
                                        >
                                            <div
                                                className={`${getColumnPadding(
                                                    i
                                                )}`}
                                            >
                                                <div className="w-8 h-8 flex items-center justify-center">
                                                    {d}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                )}
                            </div>

                            <div
                                key={`${year}-${month}`}
                                className="flex-1 flex flex-col min-h-0 relative transition-all duration-300 ease-out"
                                style={calendarMotionStyle}
                                onWheel={handleCalendarScroll}
                            >
                                {weeks.map((week, weekIdx) => {
                                    // 주 단위 이벤트 행 정보 가져오기
                                    const weekEventRows =
                                        getWeekEventRows(week);

                                    // 각 날짜 셀의 최소 높이를 계산하여 표시 가능한 행 수 결정
                                    const dateHeaderHeight = 48;
                                    const bottomPadding = 18;
                                    const tagHeight = 24;
                                    const tagSpacing = 4;

                                    // 주의 모든 날짜 셀 중 최소 높이를 찾아서 표시 가능한 행 수 계산
                                    const pad = (n: number) =>
                                        n < 10 ? "0" + n : String(n);
                                    const weekCellHeights = week.map(
                                        ({ date }) => {
                                            const dateKey = `${date.getFullYear()}-${pad(
                                                date.getMonth() + 1
                                            )}-${pad(date.getDate())}`;
                                            return cellHeights[dateKey] || 0;
                                        }
                                    );

                                    const minCellHeight = Math.min(
                                        ...weekCellHeights.filter((h) => h > 0)
                                    );
                                    const availableHeight = Math.max(
                                        0,
                                        minCellHeight -
                                            dateHeaderHeight -
                                            bottomPadding
                                    );
                                    const maxVisibleRows =
                                        availableHeight > 0
                                            ? Math.ceil(
                                                  (availableHeight +
                                                      tagSpacing) /
                                                      (tagHeight + tagSpacing)
                                              )
                                            : 3;

                                    return (
                                        <WeekRow
                                            key={weekIdx}
                                            week={week}
                                            weekIdx={weekIdx}
                                            weekEventRows={weekEventRows}
                                            today={today}
                                            dragStart={dragStart}
                                            dragEnd={dragEnd}
                                            isDragging={isDragging}
                                            cellRefs={cellRefs}
                                            getColumnPadding={getColumnPadding}
                                            getSafeDateKey={getSafeDateKey}
                                            getEventsForDate={getEventsForDate}
                                            maxVisibleRows={maxVisibleRows}
                                            tagHeight={tagHeight}
                                            tagSpacing={tagSpacing}
                                            onEditEvent={(event) => {
                                                setEditingEvent(event);
                                                setSelectedDateForModal(
                                                    event.startDate
                                                );
                                                setSelectedEndDateForModal(
                                                    event.endDate
                                                );
                                                setEventModalOpen(true);
                                            }}
                                            onDeleteEvent={handleEventDelete}
                                            onEventClick={(event, e) => {
                                                setEventDetailMenuPos({
                                                    x: e.clientX,
                                                    y: e.clientY,
                                                });
                                                setSelectedEventForMenu(event);
                                                setEventDetailMenuOpen(true);
                                            }}
                                            onDateClick={(dateKey, e) => {
                                                setSelectedDateForModal(
                                                    dateKey
                                                );
                                                const ev = new CustomEvent(
                                                    "showCalendarMenu",
                                                    {
                                                        detail: {
                                                            date: dateKey,
                                                            x: e.clientX,
                                                            y: e.clientY,
                                                        },
                                                    }
                                                );
                                                window.dispatchEvent(ev);
                                            }}
                                            onDragStart={(dateKey, e) => {
                                                setIsDragging(true);
                                                setDragStart(dateKey);
                                                setDragEnd(dateKey);
                                                setSelectedDateForModal(
                                                    dateKey
                                                );
                                                setSelectedEndDateForModal(
                                                    dateKey
                                                );
                                                e.preventDefault();
                                            }}
                                            onDragEnter={(dateKey) => {
                                                setDragEnd(dateKey);
                                                setSelectedEndDateForModal(
                                                    dateKey
                                                );
                                            }}
                                            onHiddenCountClick={(
                                                dateKey,
                                                threshold
                                            ) => {
                                                setHiddenEventsDate({
                                                    dateKey,
                                                    threshold,
                                                });
                                                setHiddenEventsModalOpen(true);
                                            }}
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </main>
            </div>

            {menuOpen && (
                <CalendarMenu
                    isOpen={menuOpen}
                    anchorEl={null}
                    position={menuPos || undefined}
                    selectedDate={menuDate}
                    onClose={() => {
                        setMenuOpen(false);
                        setMenuDate(null);
                        setMenuPos(null);
                    }}
                />
            )}

            <EventModal
                isOpen={eventModalOpen}
                onClose={() => {
                    setEventModalOpen(false);
                    setSelectedDateForModal("");
                    setSelectedEndDateForModal("");
                    setEditingEvent(null);
                }}
                initialDate={
                    editingEvent
                        ? editingEvent.startDate
                        : selectedDateForModal || menuDate || undefined
                }
                initialEndDate={
                    editingEvent
                        ? editingEvent.endDate
                        : selectedEndDateForModal || undefined
                }
                editingEvent={editingEvent}
                onSave={handleEventSave}
            />
            {/* Schedule modal (담당: 재사용 컴포넌트) */}
            <ScheduleModal
                isOpen={scheduleModalOpen}
                onClose={() => setScheduleModalOpen(false)}
                onSave={(payload) => {
                    console.log("새 일정:", payload);
                    setScheduleModalOpen(false);
                }}
            />

            {/* 숨겨진 일정 목록 모달 */}
            <BaseModal
                isOpen={hiddenEventsModalOpen}
                onClose={() => {
                    setHiddenEventsModalOpen(false);
                    setHiddenEventsDate(null);
                }}
                title="일정 목록"
                maxWidth="max-w-md"
            >
                {hiddenEventsDate && (
                    <div className="space-y-2">
                        {getEventsForDate(hiddenEventsDate.dateKey)
                            .slice(hiddenEventsDate.threshold)
                            .map((event) => (
                                <div
                                    key={event.id}
                                    className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                                    onClick={(e) => {
                                        setEventDetailMenuPos({
                                            x: e.clientX,
                                            y: e.clientY,
                                        });
                                        setSelectedEventForMenu(event);
                                        setHiddenEventsModalOpen(false);
                                        setEventDetailMenuOpen(true);
                                    }}
                                >
                                    <div className="flex items-center gap-4">
                                        <div
                                            className="w-1 h-12 rounded-[2px] shrink-0"
                                            style={{
                                                backgroundColor: event.color,
                                            }}
                                        />
                                        <div className="flex-1">
                                            <p className="font-medium text-gray-900">
                                                {event.title}
                                            </p>
                                            <p className="text-sm text-gray-500">
                                                {formatDateRange(
                                                    event.startDate,
                                                    event.endDate
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                    </div>
                )}
            </BaseModal>

            {/* 일정 상세 정보 액션 메뉴 */}
            <EventDetailMenu
                isOpen={eventDetailMenuOpen}
                anchorEl={null}
                position={eventDetailMenuPos || undefined}
                onClose={() => setEventDetailMenuOpen(false)}
                event={selectedEventForMenu}
                onEdit={(eventToEdit) => {
                    setEventDetailMenuOpen(false);
                    setEditingEvent(eventToEdit);
                    setSelectedDateForModal(eventToEdit.startDate);
                    setSelectedEndDateForModal(eventToEdit.endDate);
                    setEventModalOpen(true);
                }}
                onDelete={(eventId) => {
                    handleEventDelete(eventId);
                    setEventDetailMenuOpen(false);
                }}
            />
        </div>
    );
}
