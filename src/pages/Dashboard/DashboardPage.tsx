// DashboardPage.tsx
import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import ScheduleModal from "../../components/common/ScheduleModal";
import Sidebar from "../../components/Sidebar";
import CalendarMenu from "../../components/CalendarMenu";
import EventModal from "../../components/EventModal";
import BaseModal from "../../components/ui/BaseModal";
import EventDetailMenu from "../../components/common/EventDetailMenu";
import { IconMenu } from "../../components/icons/Icons";
import { CalendarEvent } from "../../types";
import useCalendarWheelNavigation from "../../hooks/useCalendarWheelNavigation";
import { useAuth } from "../../store/auth";
import { supabase } from "../../lib/supabase";
import {
    getCalendarEvents,
    createCalendarEvent,
    updateCalendarEvent,
    deleteCalendarEvent,
    calendarEventRecordToCalendarEvent,
} from "../../lib/dashboardApi";
import DashboardSkeleton from "../../components/common/DashboardSkeleton";
import { useHolidays } from "../../hooks/useHolidays";
import {
    useDashboardEvents,
    useMergedHolidays,
    useSortedEvents,
} from "../../hooks/useDashboardEvents";
import {
    splitIntoWeeks,
    formatDateRange,
    getEventsForDate,
} from "../../utils/calendarUtils";
import { generateMonthGrid } from "../../utils/calendarUtils";
import CalendarHeader, { WeekDayHeader } from "./components/CalendarHeader";
import CalendarGrid from "./components/CalendarGrid";

export default function DashboardPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const today = new Date();

    const [year, setYear] = useState(today.getFullYear());
    const [month, setMonth] = useState(today.getMonth());

    // 권한 체크: 공사팀(스태프)은 접근 불가
    useEffect(() => {
        const checkAccess = async () => {
            if (!user?.id) return;
            
            const { data: profile } = await supabase
                .from("profiles")
                .select("role, department, position")
                .eq("id", user.id)
                .single();
            
            if (profile) {
                const isStaff = profile.role === "staff" || profile.department === "공사팀";
                const isCEO = profile.position === "대표";
                const isAdmin = profile.role === "admin" || profile.department === "공무팀";
                
                // 공사팀(스태프)만 접근 불가 - 조용히 리다이렉트
                if (isStaff && !isCEO && !isAdmin) {
                    navigate("/report", { replace: true });
                }
            }
        };
        checkAccess();
    }, [user?.id, navigate]);

    // 공휴일 데이터
    const holidays = useHolidays(year, month);

    // 이벤트 데이터
    const { allEvents, setAllEvents, loading } = useDashboardEvents(year, month);
    const mergedHolidays = useMergedHolidays(holidays);
    const sortedEvents = useSortedEvents(allEvents, mergedHolidays);

    // 그리드 생성
    const grid = useMemo(() => generateMonthGrid(year, month), [year, month]);
    const weeks = useMemo(() => splitIntoWeeks(grid), [grid]);

    // 사이드바 상태
    const [sidebarOpen, setSidebarOpen] = useState(false);

    // 메뉴 상태
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

    // 셀 높이 변경 핸들러 (useCallback으로 메모이제이션)
    const handleCellHeightChange = useCallback((dateKey: string, height: number) => {
        setCellHeights((prev) => {
            // 높이가 실제로 변경되었을 때만 업데이트
            if (prev[dateKey] === height) {
                return prev;
            }
            return {
                ...prev,
                [dateKey]: height,
            };
        });
    }, []);

    React.useEffect(() => {
        menuOpenRef.current = menuOpen;
        menuDateRef.current = menuDate;
    }, [menuOpen, menuDate]);

    // 전역 이벤트 리스너
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

    // 모바일 사이드바 열릴 때 body 스크롤 잠금
    useEffect(() => {
        document.body.style.overflow = sidebarOpen ? "hidden" : "";
        return () => {
            document.body.style.overflow = "";
        };
    }, [sidebarOpen]);

    // 날짜 네비게이션
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

    const { wheelRef: calendarWheelRef, motionStyle: calendarMotionStyle } =
        useCalendarWheelNavigation({
            onPrevMonth: prevMonth,
            onNextMonth: nextMonth,
        });

    // Schedule modal state
    const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
    const [selectedDateForModal, setSelectedDateForModal] =
        useState<string>("");
    const [selectedEndDateForModal, setSelectedEndDateForModal] =
        useState<string>("");

    // 셀 높이 측정을 위한 ResizeObserver
    useEffect(() => {
        const observer = new ResizeObserver((entries) => {
            const newHeights: Record<string, number> = {};
            for (let entry of entries) {
                if (entry.target instanceof HTMLElement) {
                    const dateKey = entry.target.dataset.dateKey;
                    if (dateKey) {
                        newHeights[dateKey] = entry.contentRect.height;
                        console.log(`[ResizeObserver] ${dateKey}: height=${entry.contentRect.height}`);
                    }
                }
            }
            if (Object.keys(newHeights).length > 0) {
                console.log(`[ResizeObserver] 업데이트된 셀 높이:`, newHeights);
            }
            setCellHeights((prev) => ({
                ...prev,
                ...newHeights,
            }));
        });

        // 셀 refs가 설정될 때까지 대기 후 관찰 시작
        const setupObserver = () => {
            let observedCount = 0;
            const refs = cellRefs.current;
            
            // 모든 셀 관찰
            for (const dateKey in refs) {
                const cell = refs[dateKey];
                if (cell) {
                    observer.observe(cell);
                    observedCount++;
                }
            }
            
            console.log(`[ResizeObserver] ${observedCount}개의 셀을 관찰 시작`, Object.keys(refs));
            
            // 셀이 없으면 다음 틱에 다시 시도 (최대 10번)
            if (observedCount === 0) {
                console.warn(`[ResizeObserver] 관찰할 셀이 없습니다. 다음 틱에 다시 시도합니다.`);
                let retryCount = 0;
                const retryInterval = setInterval(() => {
                    retryCount++;
                    const refs = cellRefs.current;
                    let count = 0;
                    for (const dateKey in refs) {
                        const cell = refs[dateKey];
                        if (cell) {
                            observer.observe(cell);
                            count++;
                        }
                    }
                    if (count > 0 || retryCount >= 10) {
                        clearInterval(retryInterval);
                        if (count > 0) {
                            console.log(`[ResizeObserver] 재시도 성공: ${count}개의 셀 관찰 시작`);
                        }
                    }
                }, 100);
            }
        };

        // 다음 틱에 실행하여 DOM이 완전히 렌더링된 후 관찰 시작
        setTimeout(setupObserver, 0);

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

    // 일정 저장 핸들러
    const handleEventSave = async (data: {
        title: string;
        startDate: string;
        startTime?: string;
        endDate: string;
        endTime?: string;
        allDay: boolean;
        attendees?: string[];
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
                    await updateCalendarEvent(
                        eventId,
                        {
                            title: data.title,
                            start_date: data.startDate,
                            end_date: data.endDate,
                            start_time: data.startTime || undefined,
                            end_time: data.endTime || undefined,
                            all_day: data.allDay,
                            attendees: data.attendees || [],
                        },
                        user.id
                    );
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
                    attendees: data.attendees || [],
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
        } catch (err: any) {
            console.error("Error saving event:", err);
            const errorMessage = err?.message || "일정 저장에 실패했습니다.";
            alert(errorMessage);
        }
    };

    // 일정 삭제 핸들러
    const handleEventDelete = async (eventId: string) => {
        try {
            // event- 접두사가 있는 경우만 삭제 가능 (calendar_events 테이블의 일정)
            if (eventId.startsWith("event-")) {
                const id = eventId.replace("event-", "");
                await deleteCalendarEvent(id, user?.id);
            } else {
                // 다른 타입의 이벤트는 삭제 불가
                console.warn("Cannot delete this type of event");
                alert("이 일정은 삭제할 수 없습니다.");
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
        } catch (err: any) {
            console.error("Error deleting event:", err);
            const errorMessage = err?.message || "일정 삭제에 실패했습니다.";
            alert(errorMessage);
        }
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
          ${sidebarOpen
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
                    {loading ? (
                        <DashboardSkeleton />
                    ) : (
                        <div className="flex-1 flex flex-col">
                            <CalendarHeader
                                year={year}
                                month={month}
                                onPrevMonth={prevMonth}
                                onNextMonth={nextMonth}
                                onGoToday={goToday}
                            />

                            <div className="bg-white flex-1 flex flex-col min-h-0 overflow-visible">
                                <WeekDayHeader />

                                <div
                                    ref={calendarWheelRef}
                                    key={`${year}-${month}`}
                                    className="flex-1 flex flex-col min-h-0 relative transition-all duration-300 ease-out"
                                    style={calendarMotionStyle}
                                >
                                    <CalendarGrid
                                        weeks={weeks}
                                        sortedEvents={sortedEvents}
                                        today={today}
                                        dragStart={dragStart}
                                        dragEnd={dragEnd}
                                        isDragging={isDragging}
                                        cellRefs={cellRefs}
                                        cellHeights={cellHeights}
                                        onCellHeightChange={handleCellHeightChange}
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
                                            setSelectedDateForModal(dateKey);
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
                                            setSelectedDateForModal(dateKey);
                                            setSelectedEndDateForModal(dateKey);
                                            e.preventDefault();
                                        }}
                                        onDragEnter={(dateKey) => {
                                            setDragEnd(dateKey);
                                            setSelectedEndDateForModal(dateKey);
                                        }}
                                        onHiddenCountClick={(dateKey, threshold) => {
                                            setHiddenEventsDate({
                                                dateKey,
                                                threshold,
                                            });
                                            setHiddenEventsModalOpen(true);
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    )}
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

            {/* Schedule modal */}
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
                        {getEventsForDate(
                            hiddenEventsDate.dateKey,
                            sortedEvents
                        )
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
                                    <div className="flex items-start gap-4">
                                        <div
                                            className="w-1 rounded-[2px] shrink-0 self-stretch"
                                            style={{
                                                backgroundColor: event.color,
                                                minHeight: '48px',
                                            }}
                                        />
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-gray-900 break-words">
                                                {event.title}
                                            </p>
                                            <p className="text-sm text-gray-500 mt-1">
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
                currentUserId={user?.id}
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
