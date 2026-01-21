import React from "react";

interface ChipProps {
    children: React.ReactNode;
    /** 컬러 이름 (예: blue-500, red-600, gray-400) */
    color?: string;
    /** 스타일 종류: outline(흰색 배경+컬러 텍스트), solid(10% 컬러 배경+컬러 텍스트), filled(컬러 배경+흰색 텍스트) */
    variant?: "outline" | "solid" | "filled";
    /** 사이즈: sm(11px), md(12px), lg(13px) */
    size?: "sm" | "md" | "lg";
    icon?: React.ReactNode;
    onClick?: () => void;
    onRemove?: () => void;
    className?: string;
    draggable?: boolean;
    onDragStart?: (e: React.DragEvent) => void;
}

export default function Chip({
    children,
    color = "gray-400",
    variant = "solid",
    size = "md",
    icon,
    onClick,
    onRemove,
    className = "",
    draggable = false,
    onDragStart,
}: ChipProps) {
    // 컬러 값에서 'bg-' 등이 붙어있을 경우 제거
    const baseColor = color
        .replace("bg-", "")
        .replace("text-", "")
        .replace("border-", "");

    // 색상 클래스 매핑 (Tailwind 클래스 사용, 500 또는 600)
    const getColorClasses = () => {
        // 400 색상을 500으로 변환
        const colorMap: Record<
            string,
            { text: string; bg: string; border: string; borderOutline: string }
        > = {
            "orange-400": {
                text: "text-orange-500",
                bg: "bg-orange-500/10",
                border: "border-orange-500",
                borderOutline: "border-orange-500",
            },
            "orange-500": {
                text: "text-orange-500",
                bg: "bg-orange-500/10",
                border: "border-orange-500",
                borderOutline: "border-orange-500",
            },
            "blue-400": {
                text: "text-blue-500",
                bg: "bg-blue-500/10",
                border: "border-blue-500",
                borderOutline: "border-blue-500",
            },
            "blue-500": {
                text: "text-blue-500",
                bg: "bg-blue-500/10",
                border: "border-blue-500",
                borderOutline: "border-blue-500",
            },
            "blue-600": {
                text: "text-blue-600",
                bg: "bg-blue-50",
                border: "border-blue-600",
                borderOutline: "border-blue-600",
            },
            "green-400": {
                text: "text-green-500",
                bg: "bg-green-500/10",
                border: "border-green-500",
                borderOutline: "border-green-500",
            },
            "green-500": {
                text: "text-green-500",
                bg: "bg-green-500/10",
                border: "border-green-500",
                borderOutline: "border-green-500",
            },
            "green-700": {
                text: "text-green-700",
                bg: "bg-green-50",
                border: "border-green-700",
                borderOutline: "border-green-700",
            },
            "purple-400": {
                text: "text-purple-500",
                bg: "bg-purple-500/10",
                border: "border-purple-500",
                borderOutline: "border-purple-500",
            },
            "purple-500": {
                text: "text-purple-500",
                bg: "bg-purple-500/10",
                border: "border-purple-500",
                borderOutline: "border-purple-500",
            },
            "gray-400": {
                text: "text-gray-500",
                bg: "bg-gray-500/10",
                border: "border-gray-500",
                borderOutline: "border-gray-500",
            },
            "gray-500": {
                text: "text-gray-500",
                bg: "bg-gray-500/10",
                border: "border-gray-500",
                borderOutline: "border-gray-500",
            },
            "red-600": {
                text: "text-red-600",
                bg: "bg-red-600/10",
                border: "border-red-600",
                borderOutline: "border-red-600",
            },
            "red-700": {
                text: "text-red-700",
                bg: "bg-red-50",
                border: "border-red-700",
                borderOutline: "border-red-700",
            },
        };

        const colors = colorMap[baseColor] || colorMap["gray-500"];

        if (variant === "outline") {
            return {
                text: colors.text,
                bg: "bg-white",
                border: colors.borderOutline,
            };
        } else if (variant === "solid") {
            return {
                text: colors.text,
                bg: colors.bg,
                border: "border-transparent",
            };
        } else {
            // filled variant - 컬러 배경 + 흰색 텍스트
            const filledBgMap: Record<string, string> = {
                "text-orange-500": "bg-orange-500",
                "text-blue-500": "bg-blue-500",
                "text-blue-600": "bg-blue-600",
                "text-green-500": "bg-green-500",
                "text-green-700": "bg-green-700",
                "text-purple-500": "bg-purple-500",
                "text-gray-500": "bg-gray-500",
                "text-red-600": "bg-red-600",
                "text-red-700": "bg-red-700",
            };
            return {
                text: "text-white",
                bg: filledBgMap[colors.text] || "bg-gray-500",
                border: "border-transparent",
            };
        }
    };

    const colorClasses = getColorClasses();

    // 사이즈별 스타일 정의 (피그마 수치 적용)
    const sizeStyles = {
        sm: "text-[11px] py-[3px] px-[6px] rounded-[6px]",
        md: "text-[12px] py-[4px] px-[6px] rounded-[6px]",
        lg: "text-[13px] py-[5px] px-[8px] rounded-[8px]",
    };

    const baseClasses =
        "inline-flex items-center justify-center font-medium transition-all whitespace-nowrap border";

    const combinedClasses = `${baseClasses} ${sizeStyles[size]} ${colorClasses.text
        } ${colorClasses.bg} ${colorClasses.border} ${onClick ? "cursor-pointer hover:opacity-80" : "cursor-default"
        } ${className}`;

    if (!onClick) {
        return (
            <span className={combinedClasses}>
                {icon && <span className="mr-1 flex items-center">{icon}</span>}
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
            className={combinedClasses}
        >
            {icon && <span className="mr-1 flex items-center">{icon}</span>}
            <span>{children}</span>
            {onRemove && (
                <span
                    onClick={(e) => {
                        e.stopPropagation();
                        onRemove();
                    }}
                    className="ml-2 hover:bg-black/10 rounded-full p-0.5 transition-colors flex items-center justify-center shrink-0"
                >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path
                            d="M3 3L9 9M9 3L3 9"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                        />
                    </svg>
                </span>
            )}
        </button>
    );
}
