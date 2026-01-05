import Select from "./Select";

interface YearMonthSelectorProps {
    year: string;
    month: string;
    onYearChange: (year: string) => void;
    onMonthChange: (month: string) => void;
    yearOptions?: { value: string; label: string }[];
    monthOptions?: { value: string; label: string }[];
    className?: string;
}

export default function YearMonthSelector({
    year,
    month,
    onYearChange,
    onMonthChange,
    yearOptions,
    monthOptions,
    className = "",
}: YearMonthSelectorProps) {
    const defaultYearOptions = yearOptions || [
        { value: "2024년", label: "2024년" },
        { value: "2025년", label: "2025년" },
        { value: "2026년", label: "2026년" },
    ];

    const defaultMonthOptions = monthOptions || [
        { value: "1월", label: "1월" },
        { value: "2월", label: "2월" },
        { value: "3월", label: "3월" },
        { value: "4월", label: "4월" },
        { value: "5월", label: "5월" },
        { value: "6월", label: "6월" },
        { value: "7월", label: "7월" },
        { value: "8월", label: "8월" },
        { value: "9월", label: "9월" },
        { value: "10월", label: "10월" },
        { value: "11월", label: "11월" },
        { value: "12월", label: "12월" },
    ];

    return (
        <div className={`flex items-center gap-2 ${className}`}>
            <Select
                options={defaultYearOptions}
                value={year}
                onChange={onYearChange}
                className="w-auto min-w-[120px]"
            />
            <Select
                options={defaultMonthOptions}
                value={month}
                onChange={onMonthChange}
                className="w-auto min-w-[100px]"
            />
        </div>
    );
}
