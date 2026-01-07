import React from "react";

interface ChipProps {
    children: React.ReactNode;
    variant?:
        | "default"
        | "selected"
        | "gray"
        | "tag"
        | "region-bc"
        | "region-ul"
        | "region-jy"
        | "region-gj"
        | "submitted"
        | "pending"
        | "not_submitted";
    size?: "sm" | "md" | "lg";
    onClick?: () => void;
    onRemove?: () => void;
    className?: string;
    draggable?: boolean;
    onDragStart?: (e: React.DragEvent) => void;
}

export default function Chip({
    children,
    variant = "default",
    size = "md",
    onClick,
    onRemove,
    className = "",
    draggable = false,
    onDragStart,
}: ChipProps) {
    const baseClasses =
        "flex gap-1 items-center justify-center rounded-[10px] transition-colors cursor-pointer";

    const variantClasses: Record<string, string> = {
        default:
            "bg-white border border-gray-200 text-gray-700 hover:bg-gray-100",
        selected: "bg-blue-600 text-white",
        gray: "bg-gray-100 text-gray-600 hover:bg-gray-200",
        tag: "bg-blue-50 text-blue-600 rounded-full",
        submitted: "bg-blue-500/[0.08] text-blue-600 rounded-lg",
        pending: "bg-green-500/[0.08] text-green-700 rounded-lg",
        not_submitted: "bg-gray-500/[0.08] text-gray-700 rounded-lg",
        "region-bc": "bg-blue-600 text-white hover:bg-blue-700",
        "region-ul": "bg-emerald-500 text-white hover:bg-emerald-600",
        "region-jy": "bg-amber-500 text-white hover:bg-amber-600",
        "region-gj": "bg-violet-500 text-white hover:bg-violet-600",
    };

    const sizeClasses = {
        sm: "h-[30px] px-2 py-1.5 text-[13px]",
        md: "h-9 px-2.5 py-3 text-[15px]",
        lg: "h-12 px-4 py-3 text-[16px]",
    };

    // 상태 칩 variant들(submitted, pending, not_submitted)은 작은 크기로 고정
    const isStatusChip =
        variant === "submitted" ||
        variant === "pending" ||
        variant === "not_submitted";
    const finalSizeClasses = isStatusChip
        ? "h-7 px-2 text-[13px] font-medium leading-[18px]"
        : sizeClasses[size];

    // 상태 칩 variant들은 클릭 불가능한 정보 표시용
    if (isStatusChip) {
        return (
            <span
                className={`inline-flex items-center justify-center ${variantClasses[variant]} ${finalSizeClasses} ${className}`}
            >
                {children}
            </span>
        );
    }

    return (
        <button
            type="button"
            onClick={onClick}
            draggable={draggable}
            onDragStart={onDragStart}
            className={`${baseClasses} ${variantClasses[variant]} ${finalSizeClasses} ${className}`}
        >
            <span className="font-medium leading-[1.467] text-center whitespace-nowrap">
                {children}
            </span>
            {onRemove && (
                <span
                    onClick={(e) => {
                        e.stopPropagation();
                        onRemove();
                    }}
                    className="ml-1 hover:opacity-70"
                >
                    <svg
                        width="11"
                        height="11"
                        viewBox="0 0 11 11"
                        fill="currentColor"
                    >
                        <path
                            d="M8.25 2.75L2.75 8.25M2.75 2.75L8.25 8.25"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                        />
                    </svg>
                </span>
            )}
        </button>
    );
}
