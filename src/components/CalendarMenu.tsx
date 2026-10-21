import React from "react";
import { useNavigate } from "react-router-dom";
import ActionMenu from "./common/ActionMenu";
import {
    IconCalendar,
    IconInfo,
    IconPerson,
    IconVacation,
    IconCard,
} from "./icons/Icons";

interface Props {
    isOpen: boolean;
    anchorEl: HTMLElement | null;
    position?: { x: number; y: number };
    onClose: () => void;
    selectedDate?: string | null;
    /** Schedule registration shows only 일정 추가 and 개인 일정. */
    variant?: "dashboard" | "schedule";
    onAddSchedule?: () => void;
    onPersonalSchedule?: () => void;
    /** 모바일 등: 일정 추가 위에 상세정보 항목 표시 */
    onDayDetail?: () => void;
}

export default function CalendarMenu({
    isOpen,
    anchorEl,
    position,
    onClose,
    selectedDate,
    variant = "dashboard",
    onAddSchedule,
    onPersonalSchedule,
    onDayDetail,
}: Props) {
    const navigate = useNavigate();
    const itemClass =
        "w-full px-3 py-2.5 text-left text-[15px] hover:bg-gray-50 active:bg-gray-100 text-gray-800 flex items-center gap-3 rounded-lg transition-colors cursor-pointer font-medium";

    if (variant === "schedule") {
        return (
            <ActionMenu
                isOpen={isOpen}
                anchorEl={anchorEl}
                position={position}
                onClose={onClose}
                width="w-44"
                placement="bottom-right"
                estimatedHeight={onDayDetail ? 168 : 120}
            >
                {onDayDetail ? (
                    <button
                        type="button"
                        className={itemClass}
                        onClick={() => {
                            onDayDetail();
                            onClose();
                        }}
                    >
                        <IconInfo className="w-6 h-6 text-gray-700" />
                        상세정보
                    </button>
                ) : null}
                <button
                    type="button"
                    className={itemClass}
                    onClick={() => {
                        onAddSchedule?.();
                        onClose();
                    }}
                >
                    <IconCalendar className="w-6 h-6 text-gray-700" />
                    일정 추가
                </button>
                <button
                    type="button"
                    className={itemClass}
                    onClick={() => {
                        onPersonalSchedule?.();
                        onClose();
                    }}
                >
                    <IconPerson className="w-6 h-6 text-gray-700" />
                    개인 일정
                </button>
            </ActionMenu>
        );
    }

    return (
        <ActionMenu
            isOpen={isOpen}
            anchorEl={anchorEl}
            position={position}
            onClose={onClose}
            width="w-44"
            placement="right"
        >
            <button
                className="w-full px-3 py-2.5 text-left text-[15px] hover:bg-gray-50 active:bg-gray-100 text-gray-800 flex items-center gap-3 rounded-lg transition-colors cursor-pointer font-medium"
                onClick={() => {
                    const ev = new CustomEvent("openEventForm", {
                        detail: { date: selectedDate },
                    });
                    window.dispatchEvent(ev);
                    onClose();
                }}
            >
                <IconCalendar className="w-6 h-6 text-gray-700" />
                일정 추가
            </button>

            <button
                className="w-full px-3 py-2.5 text-left text-[15px] hover:bg-gray-50 active:bg-gray-100 text-gray-800 flex items-center gap-3 rounded-lg transition-colors cursor-pointer font-medium"
                onClick={() => {
                    const dateParam = selectedDate ? `&date=${encodeURIComponent(selectedDate)}` : "";
                    navigate(`/vacation?openModal=true${dateParam}`);
                    onClose();
                }}
            >
                <IconVacation className="w-6 h-6 text-gray-700" />
                휴가 등록
            </button>

            <button
                className="w-full px-3 py-2.5 text-left text-[15px] hover:bg-gray-50 active:bg-gray-100 text-gray-800 flex items-center gap-3 rounded-lg transition-colors cursor-pointer font-medium"
                onClick={() => {
                    const q = selectedDate
                        ? `?date=${encodeURIComponent(selectedDate)}`
                        : "";
                    navigate(`/expense${q}`);
                    onClose();
                }}
            >
                <IconCard className="w-6 h-6 text-gray-700" />
                개인 지출
            </button>
        </ActionMenu>
    );
}
