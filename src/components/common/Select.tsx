import React from "react";

interface SelectProps
    extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "onChange"> {
    label?: string;
    error?: string;
    required?: boolean;
    options: { value: string; label: string }[];
    placeholder?: string;
    onChange?: (value: string) => void;
    disabled?: boolean;
}

export default function Select({
    label,
    error,
    required = false,
    options,
    placeholder,
    onChange,
    disabled = false,
    className = "",
    ...props
}: SelectProps) {
    // className에서 width 관련 클래스 추출
    const widthMatch = className.match(
        /\b(w-(?:auto|full|fit|screen|\d+|\[.*?\]))\b/
    );
    const widthClass = widthMatch ? widthMatch[1] : "w-full";
    const otherClasses = className
        .replace(/\bw-(?:auto|full|fit|screen|\d+|\[.*?\])\b/g, "")
        .trim();

    const baseStyles = `${widthClass} h-12 border border-gray-200 rounded-xl px-4 pr-10 text-base text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 appearance-none bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%3E%3Cpath%20d%3D%22M6%209L12%2015L18%209%22%20stroke%3D%22%23101828%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20fill%3D%22none%22%2F%3E%3C%2Fsvg%3E')] bg-[length:16px] bg-[right_1rem_center] bg-no-repeat`;

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        onChange?.(e.target.value);
    };

    // label이 없을 때는 wrapper 없이 직접 반환
    if (!label) {
        return (
            <>
                <div className="relative h-12 inline-block">
                    <select
                        className={`${baseStyles} ${
                            error
                                ? "border-red-300 focus:border-red-500 focus:ring-red-500/20"
                                : ""
                        } ${
                            disabled ? "bg-gray-50 cursor-not-allowed" : ""
                        } h-full`}
                        onChange={handleChange}
                        disabled={disabled}
                        {...props}
                    >
                        {placeholder && (
                            <option value="" disabled>
                                {placeholder}
                            </option>
                        )}
                        {options.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </div>
                {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
            </>
        );
    }

    return (
        <div className={`flex flex-col gap-2 ${widthClass} ${otherClasses}`}>
            <div className="flex gap-2 items-center">
                <label className="block text-sm font-medium text-gray-700">
                    {label}
                </label>
                {required && <span className="text-red-600 text-sm">*</span>}
            </div>
            <div className={`relative h-12 ${widthClass}`}>
                <select
                    className={`${baseStyles} ${
                        error
                            ? "border-red-300 focus:border-red-500 focus:ring-red-500/20"
                            : ""
                    } ${
                        disabled ? "bg-gray-50 cursor-not-allowed" : ""
                    } h-full`}
                    onChange={handleChange}
                    disabled={disabled}
                    {...props}
                >
                    {placeholder && (
                        <option value="" disabled>
                            {placeholder}
                        </option>
                    )}
                    {options.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
            </div>
            {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
        </div>
    );
}
