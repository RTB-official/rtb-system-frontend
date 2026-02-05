import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: "primary" | "secondary" | "outline" | "ghost" | "danger" | "disabled";
    size?: "xs" | "sm" | "md" | "lg";
    icon?: React.ReactNode;
    fullWidth?: boolean;
    width?: string | number; // 예: "50%", "200px", 50 (숫자면 %로 처리)
}

export default function Button({
    variant = "primary",
    size = "md",
    icon,
    fullWidth = false,
    width,
    className = "",
    children,
    style,
    disabled: disabledProp,
    ...props
}: ButtonProps) {
    const baseStyles =
        "flex whitespace-nowrap items-center justify-center font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";

    const variantStyles = {
        primary:
            "bg-gray-800 text-white hover:bg-gray-700 focus:ring-gray-800",
        secondary:
            "bg-[#eef7ff] text-[#3b82f6] hover:bg-[#dbeafe] focus:ring-[#3b82f6]",
        outline:
            "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 focus:ring-gray-500",
        ghost: "bg-transparent text-gray-700 hover:bg-gray-100 focus:ring-gray-500",
        danger: "bg-red-600 text-white hover:bg-red-600 focus:ring-red-500",
        disabled:
            "bg-gray-200 text-gray-500 cursor-not-allowed hover:bg-gray-200 focus:ring-gray-400",
    };

    const sizeStyles = {
        xs: "h-[28px] px-2 text-[12px] rounded-[6px] gap-0.5",
        sm: "h-[30px] px-2 text-[13px] rounded-[6px] gap-0.5",
        md: "h-[36px] px-3 text-[14px] rounded-[8px] gap-0.5",
        lg: "h-12 px-4 text-[16px] rounded-[10px] gap-1",
    };

    const widthStyle = fullWidth ? "w-full" : "";

    // width prop 처리
    const widthValue = width
        ? typeof width === "number"
            ? `${width}%`
            : width
        : undefined;

    const buttonStyle = widthValue
        ? { ...style, width: widthValue }
        : style;

    return (
        <button
            className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${widthStyle} ${className}`}
            style={buttonStyle}
            disabled={variant === "disabled" || disabledProp}
            {...props}
        >
            {icon && <span className={children ? "mr-1" : ""}>{icon}</span>}
            {children}
        </button>
    );
}
