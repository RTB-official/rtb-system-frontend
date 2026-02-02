import React from "react";
import RequiredIndicator from "../ui/RequiredIndicator";

interface SelectProps
    extends Omit<
        React.SelectHTMLAttributes<HTMLSelectElement>,
        "onChange" | "size"
    > {
    label?: string;
    error?: string;
    required?: boolean;
    options: { value: string; label: string }[];
    placeholder?: string;
    onChange?: (value: string) => void;
    disabled?: boolean;
    labelClassName?: string;
    size?: "sm" | "md";
    fullWidth?: boolean;
}

export default function Select({
    label,
    error,
    required = false,
    options,
    placeholder,
    onChange,
    disabled = false,
    labelClassName = "",
    className = "",
    size = "md",
    fullWidth = false,
    value,
    ...props
}: SelectProps) {
    const sizeStyles = {
        sm: "h-9 text-[15px] px-3 pr-8 bg-[right_0.5rem_center] bg-[length:14px] rounded-[10px]",
        md: "h-12 text-base px-4 pr-11 bg-[right_1rem_center] bg-[length:18px] rounded-xl",
    };

    const isPlaceholder = !value;
    const baseStyles = `w-full ${sizeStyles[size]} border border-gray-200 ${
        isPlaceholder ? "text-gray-400" : "text-gray-900"
    } bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 appearance-none bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%3E%3Cpath%20d%3D%22M6%209L12%2015L18%209%22%20stroke%3D%22%23101828%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20fill%3D%22none%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat`;

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        onChange?.(e.target.value);
    };

    if (!label) {
        return (
            <div
                className={`relative ${
                    fullWidth ? "w-full" : "inline-block"
                } ${className}`}
            >
                <select
                    className={`${baseStyles} ${
                        error
                            ? "border-red-300 focus:border-red-500 focus:ring-red-500/20"
                            : ""
                    } ${disabled ? "bg-gray-50 cursor-not-allowed" : ""}`}
                    onChange={handleChange}
                    disabled={disabled}
                    value={value}
                    {...props}
                >
                    {placeholder && (
                        <option value="" disabled className="text-gray-400">
                            {placeholder}
                        </option>
                    )}
                    {options.map((option) => (
                        <option
                            key={option.value}
                            value={option.value}
                            className="text-gray-900"
                        >
                            {option.label}
                        </option>
                    ))}
                </select>
                {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
            </div>
        );
    }

    return (
        <div
            className={`flex flex-col gap-2 ${
                fullWidth ? "w-full" : "w-fit"
            } ${className}`}
        >
            <div className="flex items-center">
                <label
                    className={`block text-sm font-medium text-gray-700 ${labelClassName}`}
                >
                    {label}
                </label>
                {required && <RequiredIndicator />}
            </div>
            <div className="relative">
                <select
                    className={`${baseStyles} ${
                        error
                            ? "border-red-300 focus:border-red-500 focus:ring-red-500/20"
                            : ""
                    } ${disabled ? "bg-gray-50 cursor-not-allowed" : ""}`}
                    onChange={handleChange}
                    disabled={disabled}
                    value={value}
                    {...props}
                >
                    {placeholder && (
                        <option value="" disabled className="text-gray-400">
                            {placeholder}
                        </option>
                    )}
                    {options.map((option) => (
                        <option
                            key={option.value}
                            value={option.value}
                            className="text-gray-900"
                        >
                            {option.label}
                        </option>
                    ))}
                </select>
            </div>
            {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
        </div>
    );
}
