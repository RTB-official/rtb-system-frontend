import React from "react";
import Button from "../../../components/common/Button";
import { IconChevronLeft, IconChevronRight } from "../../../components/icons/Icons";
import { getColumnPadding } from "../../../utils/calendarUtils";

interface CalendarHeaderProps {
    year: number;
    month: number;
    onPrevMonth: () => void;
    onNextMonth: () => void;
    onGoToday: () => void;
    isMobile?: boolean;
}

export default function CalendarHeader({
    year,
    month,
    onPrevMonth,
    onNextMonth,
    onGoToday,
    isMobile = false,
}: CalendarHeaderProps) {
    return (
        <div className="flex items-center justify-between mb-4 md:mb-6 px-4 md:px-6 lg:px-9">
            <h2 className="text-xl md:text-3xl font-bold">
                {year}년 {month + 1}월
            </h2>
            <div className="flex items-center gap-1">
                <Button
                    variant="outline"
                    size={isMobile ? "sm" : "md"}
                    onClick={onPrevMonth}
                    icon={<IconChevronLeft />}
                />
                <Button
                    variant="outline"
                    size={isMobile ? "sm" : "md"}
                    onClick={onGoToday}
                >
                    오늘
                </Button>
                <Button
                    variant="outline"
                    size={isMobile ? "sm" : "md"}
                    onClick={onNextMonth}
                    icon={<IconChevronRight />}
                />
            </div>
        </div>
    );
}

/**
 * 요일 헤더 컴포넌트 (반응형)
 */
export function WeekDayHeader({ isMobile = false }: { isMobile?: boolean }) {
    const weekDays = ["일", "월", "화", "수", "목", "금", "토"];

    return (
        <div className="grid grid-cols-7 shrink-0 border-b border-gray-200 min-w-0">
            {weekDays.map((d, i) => (
                <div
                    key={d}
                    className={`min-w-0 py-2 md:py-3 text-xs md:text-[17px] text-left font-medium ${i === 0
                        ? "text-red-500"
                        : i === 6
                            ? "text-blue-500"
                            : "text-gray-800"
                        }`}
                >
                    <div className={`${getColumnPadding(i, isMobile)}`}>
                        <div className="w-6 h-6 md:w-8 md:h-8 flex items-center justify-center">
                            {d}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

