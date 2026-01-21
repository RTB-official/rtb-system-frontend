// CalendarTag.tsx
import React from "react";
import { IconStar, IconVacation, IconReport } from "../icons/Icons";

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
    isFirstInRow?: boolean;
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
    isFirstInRow = false,
}) => {
    const isHoliday = variant === "holiday";
    const isVacation = title.includes("휴가");
    const isWorkLog =
        title.startsWith("출장보고서 - ") || title.startsWith("출장 보고서 - ");

    const [isHovered, setIsHovered] = React.useState(false);

    return (
        <div
            className={`h-6 flex items-center truncate pointer-events-auto group z-10 cursor-pointer transition-all
                ${isHoliday ? "bg-red-100 hover:bg-red-200" : "text-gray-900"} 
                ${isStart ? "rounded-l-sm" : "rounded-l-none"}
                ${isEnd ? "rounded-r-sm" : "rounded-r-none"}
            `}
            style={{
                width,
                position: style?.position,
                top: style?.top,
                left: style?.left,
                backgroundColor: isHoliday
                    ? undefined
                    : isHovered
                        ? `${color}40`
                        : `${color}20`,
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={(e) => {
                if (onClick && !isHoliday) {
                    e.stopPropagation();
                    onClick(e);
                }
            }}
        >
            <div
                className={`flex items-center w-full h-full
                    // ${!isStart && isFirstInRow ? "pl-9" : "pl-1"}
                    ${isEnd ? "pr-1" : "pr-9"}
                `}
            >
                {isHoliday ? (
                    <div className="w-4 h-4 rounded-full bg-white flex items-center justify-center mr-1.5 shrink-0">
                        <IconStar className="w-3.5 h-3.5 text-red-500" />
                    </div>
                ) : isVacation ? (
                    <div className="w-4 h-4 flex items-center justify-center mr-1 shrink-0">
                        <IconVacation className="w-4 h-4 text-blue-500" />
                    </div>
                ) : isWorkLog ? (
                    <div className="w-4 h-4 flex items-center justify-center mr-1 shrink-0">
                        <IconReport className="w-4 h-4 text-green-600" />
                    </div>
                ) : (
                    isStart && (
                        <div
                            className="w-1 h-5 rounded-full shrink-0 mr-2"
                            style={{
                                backgroundColor: color,
                            }}
                        />
                    )
                )}
                <span
                    className={`text-[15px] truncate leading-none ${isHoliday
                        ? "font-medium text-red-600"
                        : "font-medium text-gray-800"
                        }`}
                >
                    {title}
                </span>
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
