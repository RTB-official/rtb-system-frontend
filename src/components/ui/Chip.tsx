import React from "react";

interface ChipProps {
    children: React.ReactNode;
    /** 컬러 이름 (예: blue-500, red-600, gray-400) */
    color?: string;
    /** 스타일 종류: 솔리드(배경색 있음), 아웃라인(테두리만 있음) */
    variant?: "solid" | "outline";
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

    // Tailwind v4의 CSS 변수를 활용한 동적 스타일 계산
    // 배경은 투명도 20%, 테두리는 아웃라인일 때 30% 적용
    const colorVar = `var(--color-${baseColor})`;

    const dynamicStyle: React.CSSProperties = {
        color: colorVar,
        backgroundColor:
            variant === "solid"
                ? `color-mix(in srgb, ${colorVar} 10%, transparent)`
                : "transparent",
        borderColor:
            variant === "outline"
                ? `color-mix(in srgb, ${colorVar} 30%, transparent)`
                : "transparent",
    };

    // 사이즈별 스타일 정의 (피그마 수치 적용)
    const sizeStyles = {
        sm: "text-[11px] py-[3px] px-[6px] rounded-[6px]",
        md: "text-[12px] py-[4px] px-[6px] rounded-[6px]",
        lg: "text-[13px] py-[5px] px-[8px] rounded-[8px]",
    };

    const baseClasses =
        "inline-flex items-center justify-center font-medium transition-all whitespace-nowrap border";

    const combinedClasses = `${baseClasses} ${sizeStyles[size]} ${
        onClick ? "cursor-pointer hover:opacity-80" : "cursor-default"
    } ${className}`;

    if (!onClick) {
        return (
            <span className={combinedClasses} style={dynamicStyle}>
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
            style={dynamicStyle}
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
