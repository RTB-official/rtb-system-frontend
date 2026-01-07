import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { IconCalendar } from "../icons/Icons";
import { CalendarEvent } from "../../types";
import Button from "./Button";

interface EventDetailMenuProps {
    isOpen: boolean;
    anchorEl: HTMLElement | null;
    position?: { x: number; y: number };
    onClose: () => void;
    event: CalendarEvent | null;
    onEdit: (event: CalendarEvent) => void;
    onDelete: (eventId: string) => void;
}

const EventDetailMenu: React.FC<EventDetailMenuProps> = ({
    isOpen,
    anchorEl,
    position,
    onClose,
    event,
    onEdit,
    onDelete,
}) => {
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as Node;
            if (menuRef.current?.contains(target)) return;
            if (anchorEl?.contains(target)) return;
            onClose();
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () =>
            document.removeEventListener("mousedown", handleClickOutside);
    }, [isOpen, anchorEl, onClose]);

    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen || (!anchorEl && !position) || !event) return null;

    let top = 0;
    let left = 0;

    if (position) {
        top = position.y;
        left = position.x;
    } else if (anchorEl) {
        const rect = anchorEl.getBoundingClientRect();
        top = rect.bottom + 8;
        left = rect.left;
    }

    // 화면 밖으로 나가는 것 방지
    const menuWidth = 320; // 사용자가 수정한 w-80 기준
    const menuHeight = 350; // 예상 최대 높이

    // 가로 보정
    if (left + menuWidth > window.innerWidth - 12) {
        left = window.innerWidth - menuWidth - 12;
    }
    if (left < 12) left = 12;

    // 세로 보정 (바닥 뚫림 방지)
    if (top + menuHeight > window.innerHeight - 12) {
        top = window.innerHeight - menuHeight - 12;
    }
    if (top < 12) top = 12;

    // 날짜 및 시간 포맷팅
    const formatDateTimeRange = (
        startDate: string,
        endDate: string
    ): string => {
        const start = new Date(startDate);
        const end = new Date(endDate);

        const startTime = `${start.getHours()}시`;
        const endTime = `${end.getHours()}시`;

        const startDay = `${start.getMonth() + 1}월 ${start.getDate()}일`;
        const endDay = `${end.getMonth() + 1}월 ${end.getDate()}일`;

        if (startDate === endDate) {
            return `${startDay} ${startTime} ~ ${endTime}`;
        }
        return `${startDay} ${startTime} ~ ${endDay} ${endTime}`;
    };

    return createPortal(
        <div
            ref={menuRef}
            className="fixed z-9999 w-80 bg-white rounded-2xl shadow-lg border border-gray-200 p-4 flex flex-col gap-4"
            style={{ top, left }}
        >
            <div className="flex gap-3 items-start">
                {/* 텍스트 바로 앞에 배치되는 캘린더 아이콘 */}
                <div className="shrink-0">
                    <IconCalendar />
                </div>

                {/* 오른쪽 텍스트 묶음 */}
                <div className="flex flex-col">
                    <h3 className="text-lg font-semibold text-gray-900 leading-tight mb-0.5">
                        {event.title}
                    </h3>

                    <div className="text-sm text-gray-400 font-medium mb-2">
                        {formatDateTimeRange(event.startDate, event.endDate)}
                    </div>

                    {/* 참석자 정보 */}
                    <div className="flex flex-wrap gap-2 items-center">
                        {[1, 2, 3].map((_, i) => (
                            <div key={i} className="flex items-center gap-1">
                                <div className="w-5 h-5 rounded-full bg-[#FF8A00] flex items-center justify-center text-white text-[10px] font-bold border border-white shadow-sm">
                                    MK
                                </div>
                                <span className="text-base font-medium text-gray-700">
                                    강민지
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {!event.isHoliday && (
                <>
                    <div className="h-px bg-gray-100" />
                    <div className="flex gap-2">
                        <Button
                            variant="primary"
                            size="sm"
                            fullWidth
                            onClick={(e) => {
                                e.stopPropagation();
                                onEdit(event);
                                onClose();
                            }}
                        >
                            수정
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            fullWidth
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete(event.id);
                                onClose();
                            }}
                        >
                            삭제
                        </Button>
                    </div>
                </>
            )}
        </div>,
        document.body
    );
};

export default EventDetailMenu;
