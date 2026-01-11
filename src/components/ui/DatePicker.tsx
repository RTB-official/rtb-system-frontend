import { useState, useRef, useEffect, useCallback } from "react";
import Input from "../common/Input";
import Select from "../common/Select";
import {
    IconCalendar,
    IconChevronLeft,
    IconChevronRight,
} from "../icons/Icons";

interface DatePickerProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    label?: string;
    icon?: React.ReactNode;
    iconPosition?: "left" | "right";
    onClick?: () => void;
    minYear?: number;
    maxYear?: number;
}

interface PopupPosition {
    top: number;
    left: number;
}
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export default function DatePicker({
    value,
    onChange,
    placeholder = "날짜 선택",
    className = "",
    label,
    icon,
    iconPosition = "right",
    onClick,
    minYear = new Date().getFullYear() - 100,
    maxYear = new Date().getFullYear(),
}: DatePickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [viewDate, setViewDate] = useState(() => {
        if (value) return new Date(value);
        return new Date();
    });
    const [popupPosition, setPopupPosition] = useState<PopupPosition>({
        top: 0,
        left: 0,
    });
    const containerRef = useRef<HTMLDivElement>(null);
    const popupRef = useRef<HTMLDivElement>(null);

    // 팝업 위치 계산
    const calculatePosition = useCallback(() => {
        if (!containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const popupHeight = 400; // 예상 팝업 높이
        const popupWidth = 320;

        let top = rect.bottom + 8;
        let left = rect.left;

        // 화면 하단을 벗어나면 위로 표시
        if (top + popupHeight > window.innerHeight) {
            top = rect.top - popupHeight - 8;
        }

        // 화면 우측을 벗어나면 조정
        if (left + popupWidth > window.innerWidth) {
            left = window.innerWidth - popupWidth - 16;
        }

        // 최소값 보정
        if (left < 8) left = 8;
        if (top < 8) top = 8;

        setPopupPosition({ top, left });
    }, []);

    // 외부 클릭 시 닫기
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (
                containerRef.current &&
                !containerRef.current.contains(e.target as Node) &&
                popupRef.current &&
                !popupRef.current.contains(e.target as Node)
            ) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () =>
            document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // 열릴 때 위치 계산 (팝업 위치가 설정되지 않은 경우에만)
    useEffect(() => {
        if (isOpen && popupPosition.top === 0 && popupPosition.left === 0) {
            calculatePosition();
        }
    }, [isOpen, calculatePosition, popupPosition]);

    // 스크롤/리사이즈 시 위치 재계산
    useEffect(() => {
        if (!isOpen) return;

        const handleUpdate = () => calculatePosition();
        window.addEventListener("scroll", handleUpdate, true);
        window.addEventListener("resize", handleUpdate);

        return () => {
            window.removeEventListener("scroll", handleUpdate, true);
            window.removeEventListener("resize", handleUpdate);
        };
    }, [isOpen, calculatePosition]);

    // 값 변경 시 viewDate 동기화
    useEffect(() => {
        if (value) {
            setViewDate(new Date(value));
        }
    }, [value]);

    const selectedDate = value ? new Date(value) : null;

    // 현재 월의 날짜들 계산
    const getDaysInMonth = () => {
        const year = viewDate.getFullYear();
        const month = viewDate.getMonth();

        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startDayOfWeek = firstDay.getDay();

        const days: (number | null)[] = [];

        // 이전 월 빈 칸
        for (let i = 0; i < startDayOfWeek; i++) {
            days.push(null);
        }

        // 현재 월 날짜
        for (let i = 1; i <= daysInMonth; i++) {
            days.push(i);
        }

        return days;
    };

    const handleDateClick = (day: number) => {
        const year = viewDate.getFullYear();
        const month = viewDate.getMonth();
        const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(
            day
        ).padStart(2, "0")}`;
        onChange(dateStr);
        setIsOpen(false);
    };

    const handlePrevMonth = () => {
        setViewDate(
            (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
        );
    };

    const handleNextMonth = () => {
        setViewDate(
            (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
        );
    };

    const handleYearChange = (newYear: string) => {
        const year = parseInt(newYear.replace("년", ""));
        setViewDate(new Date(year, viewDate.getMonth(), 1));
    };

    const handleMonthChange = (newMonth: string) => {
        const month = parseInt(newMonth.replace("월", "")) - 1;
        setViewDate(new Date(viewDate.getFullYear(), month, 1));
    };

    const currentYear = viewDate.getFullYear();
    const currentMonth = viewDate.getMonth() + 1;

    const yearOptions = Array.from(
        { length: maxYear - minYear + 1 },
        (_, i) => maxYear - i
    ).map((y) => ({ value: `${y}년`, label: `${y}년` }));

    const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1).map(
        (m) => ({ value: `${m}월`, label: `${m}월` })
    );

    const handleToday = () => {
        const today = new Date();
        const dateStr = `${today.getFullYear()}-${String(
            today.getMonth() + 1
        ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
        onChange(dateStr);
        setViewDate(today);
        setIsOpen(false);
    };

    const formatDisplayValue = () => {
        if (!value) return "";
        const date = new Date(value);
        return `${date.getFullYear()}년 ${
            date.getMonth() + 1
        }월 ${date.getDate()}일`;
    };

    const isToday = (day: number) => {
        const today = new Date();
        return (
            viewDate.getFullYear() === today.getFullYear() &&
            viewDate.getMonth() === today.getMonth() &&
            day === today.getDate()
        );
    };

    const isSelected = (day: number) => {
        if (!selectedDate) return false;
        return (
            viewDate.getFullYear() === selectedDate.getFullYear() &&
            viewDate.getMonth() === selectedDate.getMonth() &&
            day === selectedDate.getDate()
        );
    };

    const days = getDaysInMonth();

    return (
        <div ref={containerRef} className={`relative ${className}`}>
            {/* 입력 필드 */}
            <Input
                type="text"
                value={formatDisplayValue()}
                label={label}
                onClick={() => {
                    if (onClick) {
                        onClick();
                    }
                    if (!isOpen && containerRef.current) {
                        // 클릭 위치를 기반으로 팝업 위치 설정
                        const rect =
                            containerRef.current.getBoundingClientRect();
                        const popupHeight = 400;
                        const popupWidth = 320;

                        let top = rect.bottom + 8;
                        let left = rect.left;

                        // 화면 하단을 벗어나면 위로 표시
                        if (top + popupHeight > window.innerHeight) {
                            top = rect.top - popupHeight - 8;
                        }

                        // 화면 우측을 벗어나면 조정
                        if (left + popupWidth > window.innerWidth) {
                            left = window.innerWidth - popupWidth - 16;
                        }

                        // 최소값 보정
                        if (left < 8) left = 8;
                        if (top < 8) top = 8;

                        setPopupPosition({ top, left });
                    }
                    setIsOpen(!isOpen);
                }}
                placeholder={placeholder}
                icon={
                    icon || <IconCalendar className="w-4 h-4 text-gray-400" />
                }
                iconPosition={iconPosition}
                readOnly
                className="w-full"
            />

            {/* 달력 팝업 */}
            {isOpen && (
                <div
                    ref={popupRef}
                    className="fixed z-[9999] bg-white rounded-2xl shadow-2xl border border-gray-200 p-4 min-w-[300px]"
                    style={{
                        top: popupPosition.top,
                        left: popupPosition.left,
                    }}
                >
                    {/* 헤더 */}
                    <div className="flex items-center justify-between mb-2">
                        <button
                            type="button"
                            onClick={handlePrevMonth}
                            className="w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-600 transition-colors"
                        >
                            <IconChevronLeft />
                        </button>
                        <div className="flex items-center gap-2">
                            <Select
                                value={`${currentYear}년`}
                                onChange={handleYearChange}
                                options={yearOptions}
                                size="sm"
                                className="w-[110px]"
                            />
                            <Select
                                value={`${currentMonth}월`}
                                onChange={handleMonthChange}
                                options={monthOptions}
                                size="sm"
                                className="w-[85px]"
                            />
                        </div>
                        <button
                            type="button"
                            onClick={handleNextMonth}
                            className="w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-600 transition-colors"
                        >
                            <IconChevronRight />
                        </button>
                    </div>

                    {/* 요일 헤더 */}
                    <div className="grid grid-cols-7 gap-1 mb-2">
                        {WEEKDAYS.map((day, idx) => (
                            <div
                                key={day}
                                className={`text-center text-[13px] font-semibold py-2 ${
                                    idx === 0
                                        ? "text-red-500"
                                        : idx === 6
                                        ? "text-blue-500"
                                        : "text-gray-500"
                                }`}
                            >
                                {day}
                            </div>
                        ))}
                    </div>

                    {/* 날짜 그리드 */}
                    <div className="grid grid-cols-7 gap-1">
                        {days.map((day, idx) => {
                            if (day === null) {
                                return (
                                    <div
                                        key={`empty-${idx}`}
                                        className="h-10"
                                    />
                                );
                            }

                            const dayOfWeek = idx % 7;
                            const selected = isSelected(day);
                            const today = isToday(day);

                            return (
                                <button
                                    key={day}
                                    type="button"
                                    onClick={() => handleDateClick(day)}
                                    className={`
                    h-8 w-8 mx-auto rounded-full text-[14px] font-medium transition-all flex items-center justify-center
                    ${
                        selected
                            ? "bg-blue-400 text-white shadow-md shadow-blue-200"
                            : today
                            ? "bg-blue-500 text-white font-bold"
                            : dayOfWeek === 0
                            ? "text-red-500 hover:bg-red-50"
                            : dayOfWeek === 6
                            ? "text-blue-500 hover:bg-blue-50"
                            : "text-gray-700 hover:bg-gray-100"
                    }
                  `}
                                >
                                    {day}
                                </button>
                            );
                        })}
                    </div>

                    {/* 하단 버튼 */}
                    <div className="flex justify-between items-center mt-3 pt-2 border-t border-gray-200">
                        <button
                            type="button"
                            onClick={handleToday}
                            className="px-4 py-2 text-[13px] font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                            오늘
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsOpen(false)}
                            className="px-4 py-2 text-[13px] font-medium text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            닫기
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
