import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: "primary" | "secondary" | "outline" | "ghost";
    size?: "sm" | "md" | "lg";
    icon?: React.ReactNode;
    fullWidth?: boolean;
}

export default function Button({
    variant = "primary",
    size = "md",
    icon,
    fullWidth = false,
    className = "",
    children,
    ...props
}: ButtonProps) {
    const baseStyles =
        "inline-flex items-center justify-center font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";

    const variantStyles = {
        primary:
            "bg-[#364153] text-white hover:bg-[#2d3545] focus:ring-[#364153]",
        secondary:
            "bg-[#eef7ff] text-[#3b82f6] hover:bg-[#dbeafe] focus:ring-[#3b82f6]",
        outline:
            "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 focus:ring-gray-500",
        ghost: "bg-transparent text-gray-700 hover:bg-gray-100 focus:ring-gray-500",
    };

    const sizeStyles = {
        sm: "h-10 px-3 text-sm rounded-lg",
        md: "h-12 px-4 text-base rounded-xl",
        lg: "h-14 px-6 text-lg rounded-xl",
    };

    const widthStyle = fullWidth ? "w-full" : "";

    return (
        <button
            className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${widthStyle} ${className}`}
            {...props}
        >
            {icon && <span className={children ? "mr-2" : ""}>{icon}</span>}
            {children}
        </button>
    );
}
