import React from "react";
import Chip from "../ui/Chip";
import { IconChevronRight } from "../icons/Icons";

type DescType = "작업" | "이동" | "대기" | "";

type WorkLogEntryCardProps = {
    descType: DescType;
    hoursLabel: string;
    title?: string;
    meta?: React.ReactNode;
    isExpanded: boolean;
    onToggle: () => void;
    noLunchText?: string;
    showNoLunch?: boolean;
    noDinnerText?: string;
    showNoDinner?: boolean;
    children?: React.ReactNode;
};

const typeStyles = {
    작업: {
        gradient: "from-blue-500 to-indigo-600",
        bg: "bg-gradient-to-br from-blue-50 to-indigo-50",
        border: "border-blue-200",
        text: "text-blue-700",
        chipColor: "blue-600",
    },
    이동: {
        gradient: "from-emerald-500 to-teal-600",
        bg: "bg-gradient-to-br from-emerald-50 to-teal-50",
        border: "border-emerald-200",
        text: "text-emerald-700",
        chipColor: "green-700",
    },
    대기: {
        gradient: "from-amber-500 to-orange-600",
        bg: "bg-gradient-to-br from-amber-50 to-orange-50",
        border: "border-amber-200",
        text: "text-amber-700",
        chipColor: "orange-500",
    },
} as const;

const lunchBadgeClass =
    "inline-flex items-center px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-[12px] font-semibold border border-amber-200 shadow-sm";
const dinnerBadgeClass =
    "inline-flex items-center px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-[12px] font-semibold border border-blue-200 shadow-sm";

export default function WorkLogEntryCard({
    descType,
    hoursLabel,
    title,
    meta,
    isExpanded,
    onToggle,
    noLunchText,
    showNoLunch = false,
    noDinnerText,
    showNoDinner = false,
    children,
}: WorkLogEntryCardProps) {
    const style = typeStyles[descType as keyof typeof typeStyles] || typeStyles["작업"];
    return (
        <div
            className={`relative rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 border ${style.border} ${style.bg}`}
        >
            <div className={`h-1 bg-gradient-to-r ${style.gradient}`} />

            <div className="relative p-4 cursor-pointer" onClick={onToggle}>
                <div className="flex items-stretch justify-between gap-3">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2.5 mb-2">
                            <Chip color={style.chipColor} variant="filled" size="lg">
                                {descType || "—"}
                            </Chip>
                            <span className={`text-[15px] font-bold ${style.text}`}>
                                {hoursLabel}
                            </span>
                        </div>

                        {title && (
                            <div className="text-[14px] font-semibold text-gray-800 mb-2">
                                {title}
                            </div>
                        )}

                        {/* 데스크: 인원만. 모바일: 인원 아래 뱃지 */}
                        <div className="min-w-0">
                            {meta}
                            {(showNoLunch || showNoDinner) && (
                                <div className="mt-3 flex flex-wrap gap-2 md:hidden">
                                    {showNoDinner && noDinnerText && (
                                        <span className={dinnerBadgeClass}>{noDinnerText}</span>
                                    )}
                                    {showNoLunch && noLunchText && (
                                        <span className={lunchBadgeClass}>{noLunchText}</span>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 오른쪽: 데스크톱에서 카드 높이 전체 사용(화살표 위·뱃지 아래) */}
                    <div className="flex flex-col items-end gap-2 md:justify-between md:gap-0 shrink-0">
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggle();
                            }}
                            className="w-10 h-10 rounded-full bg-white shadow flex items-center justify-center text-gray-500 hover:bg-gray-50"
                            aria-label="toggle"
                        >
                            <IconChevronRight
                                className={`w-5 h-5 transition-transform duration-200 ${
                                    isExpanded ? "-rotate-90" : "rotate-90"
                                }`}
                            />
                        </button>
                        {(showNoLunch || showNoDinner) && (
                            <div className="hidden md:flex flex-wrap gap-2 justify-end">
                                {showNoDinner && noDinnerText && (
                                    <span className={dinnerBadgeClass}>{noDinnerText}</span>
                                )}
                                {showNoLunch && noLunchText && (
                                    <span className={lunchBadgeClass}>{noLunchText}</span>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {children && (
                <div
                    className={`overflow-hidden transition-all duration-300 ${
                        isExpanded ? "max-h-[80vh] opacity-100" : "max-h-0 opacity-0"
                    }`}
                >
                    <div className="px-4 pb-4 border-t border-white/50 overflow-y-auto max-h-[78vh]">
                        <div className="space-y-3">{children}</div>
                    </div>
                </div>
            )}
        </div>
    );
}
