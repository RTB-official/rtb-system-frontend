import React from "react";

interface InputProps
    extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
    label?: string;
    error?: string;
    required?: boolean;
    icon?: React.ReactNode;
    iconPosition?: "left" | "right";
    onChange?: (value: string) => void;
    onClick?: () => void;
    uppercase?: boolean;
    labelClassName?: string;
}

export default function Input({
    label,
    error,
    required = false,
    icon,
    iconPosition = "right",
    onChange,
    onClick,
    uppercase = false,
    labelClassName = "",
    className = "",
    ...props
}: InputProps) {
    const baseStyles =
        "w-full h-12 border border-gray-200 rounded-xl px-4 text-base text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white";

    const iconPadding = icon
        ? iconPosition === "left"
            ? "pl-10"
            : "pr-12"
        : "";

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let val = e.target.value;
        if (uppercase) val = val.toUpperCase();
        onChange?.(val);
    };

    return (
        <div className={`flex flex-col gap-2 w-full ${className}`}>
            {label && (
                <div className="flex gap-1 items-center">
                    <label className={`block text-sm font-medium text-gray-700 ${labelClassName}`}>
                        {label}
                    </label>
                    {required && (
                        <span className="text-red-600 text-sm">*</span>
                    )}
                </div>
            )}
            <div className="relative h-12">
                {icon && iconPosition === "left" && (
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                        {icon}
                    </div>
                )}
                <input
                    className={`${baseStyles} ${iconPadding} ${
                        error
                            ? "border-red-300 focus:border-red-500 focus:ring-red-500/20"
                            : ""
                    } h-full`}
                    onChange={handleChange}
                    onClick={onClick}
                    {...props}
                />
                {icon && iconPosition === "right" && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                        {icon}
                    </div>
                )}
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
    );
}
