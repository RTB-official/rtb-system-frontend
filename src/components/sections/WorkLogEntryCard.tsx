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

export default function WorkLogEntryCard({
    descType,
    hoursLabel,
    title,
    meta,
    isExpanded,
    onToggle,
    noLunchText,
    showNoLunch = false,
    children,
}: WorkLogEntryCardProps) {
    const style = typeStyles[descType as keyof typeof typeStyles] || typeStyles["작업"];
    return (
        <div
            className={`relative rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 border ${style.border} ${style.bg}`}
        >
            <div className={`h-1 bg-gradient-to-r ${style.gradient}`} />

            <div className="relative p-4 cursor-pointer" onClick={onToggle}>
                <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
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

                        {showNoLunch && noLunchText && (
                            <div className="absolute bottom-3 right-3 z-20">
                                <span className="inline-flex items-center px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-[12px] font-semibold border border-amber-200 shadow-sm">
                                    {noLunchText}
                                </span>
                            </div>
                        )}

                        {meta}
                    </div>

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
                </div>
            </div>

            {children && (
                <div
                    className={`overflow-hidden transition-all duration-300 ${
                        isExpanded ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
                    }`}
                >
                    <div className="px-4 pb-4 border-t border-white/50">
                        <div className="space-y-3">{children}</div>
                    </div>
                </div>
            )}
        </div>
    );
}
