// CalendarTag.tsx
import React from "react";
import { IconStar, IconVacation, IconReport } from "../icons/Icons";
import { isVacationEvent, isWorkLogEvent } from "../../utils/calendarUtils";

interface CalendarTagProps {
    title: string;
    color?: string;
    variant?: "event" | "holiday";
    isStart?: boolean;
    isEnd?: boolean;
    width?: string;
    style?: React.CSSProperties;
    onEdit?: () => void;
    onDelete?: () => void;
    onClick?: (e: React.MouseEvent) => void;
    details?: React.ReactNode;
    eventId?: string; // 같은 이벤트 ID를 가진 태그들 간 호버 상태 공유를 위해
}

const CalendarTag: React.FC<CalendarTagProps> = ({
    title,
    color = "#60a5fa",
    variant = "event",
    isStart = true,
    isEnd = true,
    width = "100%",
    style,
    onEdit,
    onDelete,
    onClick,
    details,
    eventId,
}) => {
    const isHoliday = variant === "holiday";
    const isVacation = isVacationEvent(title);
    const isWorkLog = isWorkLogEvent(title);

    const [isHovered, setIsHovered] = React.useState(false);

    // 같은 이벤트 ID를 가진 태그들 간 호버 상태 공유
    React.useEffect(() => {
        if (!eventId) return;

        const handleHover = (e: CustomEvent) => {
            if (e.detail.eventId === eventId) {
                setIsHovered(e.detail.isHovered);
            }
        };

        window.addEventListener(`calendarTagHover-${eventId}`, handleHover as EventListener);
        return () => {
            window.removeEventListener(`calendarTagHover-${eventId}`, handleHover as EventListener);
        };
    }, [eventId]);

    // 모바일 반응형: 작은 화면에서는 태그 높이와 텍스트 크기 조정
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const tagHeight = isMobile ? 'h-5' : 'h-[24px]'; // 데스크톱에서 22px로 조정
    const textSize = isMobile ? 'text-[13px]' : 'text-[14px]';

    return (
        <div
            className={`${tagHeight} flex items-center pointer-events-auto group z-10 cursor-pointer transition-all
                ${isHoliday ? "" : "text-gray-900"} 
                ${isStart ? "rounded-l-sm" : "rounded-l-none"}
                ${isEnd ? "rounded-r-sm" : "rounded-r-none"}
            `}
            style={{
                width,
                position: style?.position,
                top: style?.top,
                left: style?.left,
                backgroundColor: isHoliday
                    ? isHovered
                        ? "rgb(254 202 202)" // bg-red-300 (호버 시)
                        : "rgb(254 226 226)" // bg-red-200 (기본)
                    : isHovered
                        ? `${color}40`
                        : `${color}20`,
                overflow: 'hidden', // 태그 안에서만 텍스트 표시
            }}
            onMouseEnter={() => {
                setIsHovered(true);
                // 같은 이벤트 ID를 가진 모든 태그에 호버 상태 전파
                if (eventId) {
                    window.dispatchEvent(new CustomEvent(`calendarTagHover-${eventId}`, {
                        detail: { eventId, isHovered: true }
                    }));
                }
            }}
            onMouseLeave={() => {
                setIsHovered(false);
                // 같은 이벤트 ID를 가진 모든 태그에 호버 해제 상태 전파
                if (eventId) {
                    window.dispatchEvent(new CustomEvent(`calendarTagHover-${eventId}`, {
                        detail: { eventId, isHovered: false }
                    }));
                }
            }}
            onClick={(e) => {
                if (onClick && !isHoliday) {
                    e.stopPropagation();
                    onClick(e);
                }
            }}
        >
            <div
                className={`flex items-center h-full relative
                    ${isStart ? "pl-1" : "pl-0"}
                    ${isEnd ? "pr-1" : "pr-0"}
                `}
                style={{
                    minWidth: 0, // flex 자식 요소의 overflow를 위해 필요
                    width: '100%', // 부모 너비에 맞춤
                }}
            >
                {isHoliday ? (
                    // 공휴일은 시작 셀에만 아이콘 표시
                    isStart && (
                        <div className="w-4 h-4 rounded-full bg-white flex items-center justify-center mr-1.5 shrink-0">
                            <IconStar className="w-3.5 h-3.5 text-red-500" />
                        </div>
                    )
                ) : isVacation ? (
                    <div className="w-4 h-4 flex items-center justify-center mr-1.5 shrink-0">
                        <IconVacation className="w-4 h-4 text-blue-500" />
                    </div>
                ) : isWorkLog ? (
                    <div className="w-4 h-4 flex items-center justify-center mr-1.5 shrink-0">
                        <IconReport className="w-4 h-4 text-green-600" />
                    </div>
                ) : isStart ? (
                    <div
                        className="w-1 h-5 rounded-full shrink-0 mr-2"
                        style={{
                            backgroundColor: color,
                        }}
                    />
                ) : null}
                {/* 단일 셀 태그의 텍스트만 표시 (연속된 태그는 WeekRow에서 렌더링) */}
                {title && (isStart && isEnd) ? (
                    <span
                        className={`${textSize} leading-none flex-1 ${isHoliday
                            ? "font-medium text-red-600"
                            : "font-medium text-gray-800"
                            }`}
                        style={{
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            minWidth: 0,
                            maxWidth: '100%', // 태그 너비를 넘지 않도록
                        }}
                    >
                        {title}
                    </span>
                ) : null}
            </div>


            {/* 툴팁/상세 정보 (onEdit, onDelete가 있을 때만 표시) */}
            {(onEdit || onDelete || details) && (
                <div className="absolute bottom-full left-0 mb-2 hidden  z-50 w-64 bg-white rounded-lg shadow-lg border border-gray-200 p-4 whitespace-normal pointer-events-auto">
                    {details}
                    <div className="flex gap-2 mt-3">
                        {onEdit && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onEdit();
                                }}
                                className="flex-1 px-3 py-2 text-sm font-medium text-blue-500 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                            >
                                수정
                            </button>
                        )}
                        {onDelete && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDelete();
                                }}
                                className="flex-1 px-3 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                            >
                                삭제
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default CalendarTag;
