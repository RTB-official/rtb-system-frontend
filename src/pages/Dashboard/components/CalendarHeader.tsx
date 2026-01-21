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
}

export default function CalendarHeader({
    year,
    month,
    onPrevMonth,
    onNextMonth,
    onGoToday,
}: CalendarHeaderProps) {
    return (
        <div className="flex items-center justify-between mb-6">
            <h2 className="text-3xl font-bold pl-9">
                {year}년 {month + 1}월
            </h2>
            <div className="flex items-center gap-1 pr-9">
                <Button
                    variant="outline"
                    size="md"
                    onClick={onPrevMonth}
                    icon={<IconChevronLeft />}
                />
                <Button
                    variant="outline"
                    size="md"
                    onClick={onGoToday}
                >
                    오늘
                </Button>
                <Button
                    variant="outline"
                    size="md"
                    onClick={onNextMonth}
                    icon={<IconChevronRight />}
                />
            </div>
        </div>
    );
}

/**
 * 요일 헤더 컴포넌트
 */
export function WeekDayHeader() {
    const weekDays = ["일", "월", "화", "수", "목", "금", "토"];

    return (
        <div className="grid grid-cols-7 shrink-0 border-b border-gray-200">
            {weekDays.map((d, i) => (
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
                    <div className={`${getColumnPadding(i)}`}>
                        <div className="w-8 h-8 flex items-center justify-center">
                            {d}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

