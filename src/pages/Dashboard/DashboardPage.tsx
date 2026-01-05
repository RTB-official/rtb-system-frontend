// DashboardPage.tsx
import React, { useMemo, useState, useEffect } from "react";
import MonthNavigator from "../../components/common/MonthNavigator";
import ScheduleModal from "../../components/common/ScheduleModal";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/common/Header";
import CalendarMenu from "../../components/CalendarMenu";
import EventModal from "../../components/EventModal";

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

const sampleEvents: Record<string, { title: string; color: string }[]> = {
    "2024-12-18": [
        { title: "휴가 - 강민지", color: "#60a5fa" },
        { title: "12월12일 양모니아 교육", color: "#fb923c" },
    ],
    "2024-12-19": [{ title: "테크 점검", color: "#bbf7d0" }],
};

export default function DashboardPage() {
    const today = new Date();
    const [year, setYear] = useState(2025);
    const [month, setMonth] = useState(11);
    const grid = useMemo(() => generateMonthGrid(year, month), [year, month]);

    const [sidebarOpen, setSidebarOpen] = useState(false);

    const [menuOpen, setMenuOpen] = useState(false);
    const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(
        null
    );
    const [menuDate, setMenuDate] = useState<string | null>(null);
    const [eventModalOpen, setEventModalOpen] = useState(false);

    const menuOpenRef = React.useRef(menuOpen);
    const menuDateRef = React.useRef(menuDate);

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

        const openHandler = () => {
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

    // Schedule modal state
    const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
    const [selectedDateForModal, setSelectedDateForModal] =
        useState<string>("");
    // calendar events stored per date as { "YYYY-MM-DD": [{ title, color }] }
    const [calendarEvents, setCalendarEvents] = useState<any>({});
    // Initialize with sample events
    useEffect(() => {
        // If existing, merge sample events into calendarEvents
        // for simplicity, preload a couple of events for today
        const todayKey = `${today.getFullYear()}-${String(
            today.getMonth() + 1
        ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
        setCalendarEvents((prev: any) => ({
            ...prev,
            [todayKey]: prev[todayKey] || [
                { title: "휴가 - 현재", color: "#60a5fa" },
            ],
        }));
    }, []);

    return (
        <div className="flex h-screen bg-[#f4f5f7] overflow-hidden font-pretendard">
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
                <Header
                    title="대시보드"
                    onMenuClick={() => setSidebarOpen(true)}
                />

                <main className="flex-1 overflow-auto px-4 lg:px-8 py-6 lg:py-10">
                    <div>
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-3xl font-extrabold">
                                {year}년 {month + 1}월
                            </h2>
                            <div className="flex items-center gap-2">
                                <MonthNavigator
                                    onPrev={prevMonth}
                                    onToday={goToday}
                                    onNext={nextMonth}
                                />
                            </div>
                        </div>

                        <div className="bg-white border border-gray-100 rounded-xl">
                            <div className="grid grid-cols-7 gap-0 border-b border-gray-100">
                                {["일", "월", "화", "수", "목", "금", "토"].map(
                                    (d, i) => (
                                        <div
                                            key={d}
                                            className={`px-4 py-3 text-sm text-center ${
                                                i === 0
                                                    ? "text-red-500"
                                                    : i === 6
                                                    ? "text-blue-500"
                                                    : "text-gray-500"
                                            }`}
                                        >
                                            {d}
                                        </div>
                                    )
                                )}
                            </div>

                            <div className="grid grid-cols-7 gap-0">
                                {grid.map(({ date, inMonth }, idx) => {
                                    const pad = (n: number) =>
                                        n < 10 ? "0" + n : String(n);
                                    const key = `${date.getFullYear()}-${pad(
                                        date.getMonth() + 1
                                    )}-${pad(date.getDate())}`;
                                    const events = sampleEvents[key] || [];
                                    const isToday =
                                        date.getFullYear() ===
                                            today.getFullYear() &&
                                        date.getMonth() === today.getMonth() &&
                                        date.getDate() === today.getDate();

                                    return (
                                        <div
                                            key={idx}
                                            onClick={(e) => {
                                                const el =
                                                    e.currentTarget as HTMLElement;
                                                const menuWidth = 160;
                                                const menuHeight = 180;
                                                const scrollX =
                                                    window.scrollX ||
                                                    window.pageXOffset;
                                                const scrollY =
                                                    window.scrollY ||
                                                    window.pageYOffset;

                                                const dateEl = el.querySelector(
                                                    "[data-date-number]"
                                                ) as HTMLElement | null;
                                                const anchor = dateEl
                                                    ? dateEl.getBoundingClientRect()
                                                    : el.getBoundingClientRect();

                                                const offsetX = 24;
                                                const offsetY = 24;
                                                const cellRect =
                                                    el.getBoundingClientRect();
                                                const desiredX =
                                                    anchor.right +
                                                    scrollX +
                                                    offsetX;

                                                const maxInsideCellLeft =
                                                    cellRect.left +
                                                    scrollX +
                                                    cellRect.width -
                                                    menuWidth -
                                                    8;
                                                let x = desiredX;
                                                if (
                                                    desiredX > maxInsideCellLeft
                                                ) {
                                                    x = Math.max(
                                                        maxInsideCellLeft,
                                                        cellRect.left +
                                                            scrollX +
                                                            8
                                                    );
                                                }

                                                let y =
                                                    anchor.top +
                                                    scrollY -
                                                    offsetY;

                                                const calendarContainer =
                                                    el.closest(
                                                        ".bg-white"
                                                    ) as HTMLElement | null;
                                                const containerRect =
                                                    calendarContainer
                                                        ? calendarContainer.getBoundingClientRect()
                                                        : null;

                                                const rightLimit = containerRect
                                                    ? scrollX +
                                                      containerRect.right -
                                                      menuWidth -
                                                      8
                                                    : scrollX +
                                                      window.innerWidth -
                                                      menuWidth -
                                                      8;

                                                const leftLimit = containerRect
                                                    ? scrollX +
                                                      containerRect.left +
                                                      8
                                                    : scrollX + 8;

                                                if (x > rightLimit) {
                                                    x =
                                                        anchor.left +
                                                        scrollX -
                                                        menuWidth -
                                                        8;
                                                }
                                                if (x < leftLimit)
                                                    x = leftLimit;

                                                const bottomLimit =
                                                    scrollY +
                                                    window.innerHeight -
                                                    menuHeight -
                                                    8;
                                                if (y > bottomLimit)
                                                    y = bottomLimit;
                                                const topLimit = scrollY + 8;
                                                if (y < topLimit) y = topLimit;

                                                const ev = new CustomEvent(
                                                    "showCalendarMenu",
                                                    {
                                                        detail: {
                                                            date: key,
                                                            x,
                                                            y,
                                                        },
                                                    }
                                                );
                                                window.dispatchEvent(ev);
                                            }}
                                            className={`h-32 p-3 border-r border-b border-gray-100 min-h-[120px] cursor-pointer ${
                                                inMonth
                                                    ? "bg-white"
                                                    : "bg-gray-50 text-gray-300"
                                            }`}
                                        >
                                            <div className="flex items-start justify-between">
                                                {isToday ? (
                                                    <div className="w-7 h-7 rounded-full bg-blue-500 text-white text-sm font-medium flex items-center justify-center">
                                                        {date.getDate()}
                                                    </div>
                                                ) : (
                                                    <div
                                                        data-date-number
                                                        className={
                                                            !inMonth
                                                                ? "text-sm text-gray-300"
                                                                : date.getDay() ===
                                                                  0
                                                                ? "text-sm font-medium text-red-500"
                                                                : date.getDay() ===
                                                                  6
                                                                ? "text-sm font-medium text-blue-500"
                                                                : "text-sm font-medium text-gray-800"
                                                        }
                                                    >
                                                        {date.getDate()}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="mt-2 flex items-start justify-between">
                                                <div className="flex-1 flex flex-col gap-1">
                                                    {events
                                                        .slice(0, 2)
                                                        .map((e, i) => (
                                                            <div
                                                                key={i}
                                                                className="flex items-center gap-2"
                                                            >
                                                                <div
                                                                    style={{
                                                                        width: 4,
                                                                        height: 18,
                                                                        background:
                                                                            e.color,
                                                                        borderRadius: 2,
                                                                    }}
                                                                />
                                                                <div className="text-[12px] text-gray-700 truncate">
                                                                    {e.title}
                                                                </div>
                                                            </div>
                                                        ))}
                                                </div>

                                                <div className="ml-2 flex flex-col items-end gap-1 min-w-[56px]">
                                                    {events
                                                        .slice(2, 5)
                                                        .map((e, i) => (
                                                            <div
                                                                key={i}
                                                                className="px-2 py-1 rounded-md text-[11px] text-gray-700 truncate"
                                                                style={{
                                                                    background: `${e.color}20`,
                                                                    borderLeft: `3px solid ${e.color}`,
                                                                    maxWidth: 120,
                                                                }}
                                                            >
                                                                {e.title}
                                                            </div>
                                                        ))}
                                                    {events.length > 5 && (
                                                        <div className="text-[11px] text-gray-400">
                                                            +{" "}
                                                            {events.length - 5}
                                                            개
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </main>
            </div>

            {menuOpen && menuPos && (
                <div
                    style={{
                        position: "absolute",
                        left: menuPos.x,
                        top: menuPos.y,
                        zIndex: 60,
                    }}
                >
                    <CalendarMenu
                        selectedDate={menuDate}
                        onClose={() => {
                            setMenuOpen(false);
                            setMenuDate(null);
                            setMenuPos(null);
                        }}
                    />
                </div>
            )}

            {eventModalOpen && (
                <EventModal onClose={() => setEventModalOpen(false)} />
            )}
            {/* Schedule modal (담당: 재사용 컴포넌트) */}
            <ScheduleModal
                isOpen={scheduleModalOpen}
                onClose={() => setScheduleModalOpen(false)}
                onSave={(payload) => {
                    console.log("새 일정:", payload);
                    setScheduleModalOpen(false);
                }}
            />
        </div>
    );
}
