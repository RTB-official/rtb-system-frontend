import Select from "./Select";

interface ExpenseFilterBarProps {
    year: string;
    month: string;
    user: string;
    onYearChange: (v: string) => void;
    onMonthChange: (v: string) => void;
    onUserChange: (v: string) => void;
    yearOptions?: Array<{ value: string; label: string }>;
    monthOptions?: Array<{ value: string; label: string }>;
    userOptions?: Array<{ value: string; label: string }>;
}

export default function ExpenseFilterBar({
    year,
    month,
    user,
    onYearChange,
    onMonthChange,
    onUserChange,
    yearOptions,
    monthOptions,
    userOptions,
}: ExpenseFilterBarProps) {
    const yearOpts = yearOptions ?? [
        { value: "2025년", label: "2025년" },
        { value: "2024년", label: "2024년" },
        { value: "2026년", label: "2026년" },
    ];
    const monthOpts = monthOptions ?? [
        { value: "12월", label: "12월" },
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
    ];
    const userOpts = userOptions ?? [{ value: "전체", label: "전체" }];

    return (
        <div className="flex flex-wrap items-center gap-2">
            <span className="text-[24px] font-semibold text-gray-900 mr-2">
                조회 기간
            </span>
            <Select
                value={year}
                onChange={onYearChange}
                options={yearOpts}
            />
            <Select
                value={month}
                onChange={onMonthChange}
                options={monthOpts}
            />
            <span className="text-[20px] font-semibold text-gray-700 ml-5 mr-2">
                사용자
            </span>
            <Select
                value={user}
                onChange={onUserChange}
                options={userOpts}
            />
        </div>
    );
}
