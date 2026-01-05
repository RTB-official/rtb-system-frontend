import React from "react";
import { IconUpload } from "../../../components/icons/Icons";

interface ExpenseListItemProps {
    variant: "mileage" | "card";
    date: string;
    tag?: string;
    desc?: string;
    amount: string;
    img?: string | null;
    distanceLabel?: string;
    routeLabel?: string;
    submitted?: boolean;
    onRemove?: () => void;
}

export default function ExpenseListItem({
    variant,
    date,
    tag,
    desc,
    amount,
    img,
    distanceLabel,
    routeLabel,
    submitted,
    onRemove,
}: ExpenseListItemProps) {
    if (variant === "card") {
        return (
            <div className="bg-white border border-gray-100 rounded-2xl p-4 mb-4 shadow-[0px_8px_30px_rgba(15,23,42,0.05)]">
                <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-[#f5f7fb] flex items-center justify-center overflow-hidden flex-shrink-0">
                        {img ? (
                            <img
                                src={img}
                                alt="receipt"
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <IconUpload className="w-6 h-6 text-gray-400" />
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                            {tag && (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-[11px] font-medium text-[#2b7fff] bg-[#eff6ff]">
                                    {tag}
                                </span>
                            )}
                            <span className="text-xs text-gray-400">{date}</span>
                            {submitted && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold text-[#1d4ed8] bg-[#e0ecff]">
                                    제출완료
                                </span>
                            )}
                        </div>
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                                <div className="text-[20px] font-extrabold text-gray-900">
                                    {amount}
                                </div>
                                {desc && (
                                    <div className="text-sm text-gray-500 mt-1 break-words">
                                        {desc}
                                    </div>
                                )}
                            </div>
                            {onRemove && (
                                <button
                                    onClick={onRemove}
                                    className="w-5 h-5 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center hover:bg-gray-200 transition-colors flex-shrink-0"
                                    aria-label="삭제"
                                >
                                    <svg
                                        width="20"
                                        height="20"
                                        viewBox="0 0 20 20"
                                        fill="none"
                                        xmlns="http://www.w3.org/2000/svg"
                                    >
                                        <path
                                            d="M5 5L15 15M15 5L5 15"
                                            stroke="currentColor"
                                            strokeWidth="1.5"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        />
                                    </svg>
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white border border-gray-100 rounded-2xl p-5 mb-4 shadow-[0px_8px_30px_rgba(15,23,42,0.05)]">
            <div className="flex items-start justify-between">
                <div className="flex flex-col gap-1">
                    <div className="text-xs text-gray-400">{date}</div>
                    {submitted && (
                        <span className="inline-flex w-fit items-center px-2 py-0.5 rounded-full text-[11px] font-semibold text-[#1d4ed8] bg-[#e0ecff]">
                            제출완료
                        </span>
                    )}
                </div>
                {onRemove && (
                    <button
                        onClick={onRemove}
                        className="w-5 h-5 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center hover:bg-gray-200 transition-colors flex-shrink-0"
                        aria-label="삭제"
                    >
                        <svg
                            width="20"
                            height="20"
                            viewBox="0 0 20 20"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            <path
                                d="M5 5L15 15M15 5L5 15"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                    </button>
                )}
            </div>

            <div className="mt-3 flex items-center justify-between">
                <div>
                    <div className="text-[22px] font-extrabold text-gray-900">
                        {amount}
                    </div>
                    {routeLabel && (
                        <div className="text-sm text-gray-500 mt-1">
                            {routeLabel}
                        </div>
                    )}
                </div>
                {distanceLabel && (
                    <div className="text-sm text-gray-500">{distanceLabel}</div>
                )}
            </div>
        </div>
    );
}
