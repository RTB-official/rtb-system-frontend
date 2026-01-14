import React from "react";

interface WeekEventSegment {
    event: { id: string };
    startOffset: number;
    duration: number;
    rowIndex: number;
}

interface DayCellProps {
    date: Date;
    inMonth: boolean;
    dayIdx: number;
    dateKey: string;
    isToday: boolean;
    isInDragRange: boolean;
    columnPadding: string;
    hiddenCount: number;
    maxVisibleRows: number;
    cellRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
    onMouseDown: (e: React.MouseEvent) => void;
    onMouseEnter: () => void;
    onClick: (e: React.MouseEvent) => void;
    onHiddenCountClick: () => void;
}

const DayCell: React.FC<DayCellProps> = ({
    date,
    inMonth,
    dayIdx,
    dateKey,
    isToday,
    isInDragRange,
    columnPadding,
    hiddenCount,
    maxVisibleRows,
    cellRefs,
    onMouseDown,
    onMouseEnter,
    onClick,
    onHiddenCountClick,
}) => {
    return (
        <div
            key={dayIdx}
            data-date-key={dateKey}
            ref={(el) => {
                if (el) {
                    cellRefs.current[dateKey] = el;
                } else {
                    delete cellRefs.current[dateKey];
                }
            }}
            onMouseDown={onMouseDown}
            onMouseEnter={onMouseEnter}
            onClick={onClick}
            className={`pt-3 relative ${
                dayIdx < 6 ? "border-r border-gray-200" : ""
            } ${
                inMonth ? "cursor-pointer" : "cursor-default"
            } transition-colors select-none flex flex-col ${
                isInDragRange
                    ? "bg-blue-50"
                    : inMonth
                    ? "bg-white hover:bg-gray-50"
                    : "bg-white text-gray-400"
            } overflow-hidden`}
        >
            <div className={`${columnPadding} flex items-start`}>
                <div className="w-7.5 h-7.5 flex items-center justify-center relative">
                    {isToday && (
                        <div className="absolute inset-0 rounded-full bg-blue-500" />
                    )}
                    <div
                        data-date-number
                        className={`relative z-10 text-[17px] font-medium ${
                            isToday
                                ? "text-white"
                                : !inMonth
                                ? "text-gray-400"
                                : date.getDay() === 0
                                ? "text-red-500"
                                : date.getDay() === 6
                                ? "text-blue-500"
                                : "text-gray-800"
                        }`}
                    >
                        {date.getDate()}
                    </div>
                </div>
            </div>

            {/* 태그 개수 표시 (+N개) - 태그와 겹치지 않도록 여유 공간 확보 */}
            {hiddenCount > 0 && (
                <div
                    className={`absolute inset-x-0 bottom-0 pointer-events-auto z-20 cursor-pointer text-center pb-1`}
                    onClick={(e) => {
                        e.stopPropagation();
                        onHiddenCountClick();
                    }}
                >
                    <div className="text-[12px] text-gray-400 hover:text-gray-600 transition-colors bg-white/80 px-1 rounded">
                        +{hiddenCount}개
                    </div>
                </div>
            )}
        </div>
    );
};

export default DayCell;
