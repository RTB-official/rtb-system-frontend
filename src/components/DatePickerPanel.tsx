import React from "react";

function generateMonthGrid(year: number, month: number) {
    const first = new Date(year, month, 1);
    const startDay = first.getDay(); // 0=Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevDays = startDay;
    const totalCells = Math.ceil((prevDays + daysInMonth) / 7) * 7;
    const grid: { date: Date; inMonth: boolean }[] = [];

    for (let i = 0; i < totalCells; i++) {
        const dayIndex = i - prevDays + 1;
        const d = new Date(year, month, dayIndex);
        grid.push({ date: d, inMonth: d.getMonth() === month });
    }
    return grid;
}

export default function DatePickerPanel({
    selected,
    onSelect,
    initialYear,
    initialMonth,
}: {
    selected?: string | null;
    onSelect: (yMd: string) => void;
    initialYear?: number;
    initialMonth?: number;
}) {
    const today = new Date();
    const initYear =
        initialYear ??
        (selected ? new Date(selected).getFullYear() : today.getFullYear());
    const initMonth =
        initialMonth ??
        (selected ? new Date(selected).getMonth() : today.getMonth());
    const [year, setYear] = React.useState(initYear);
    const [month, setMonth] = React.useState(initMonth);

    const grid = React.useMemo(
        () => generateMonthGrid(year, month),
        [year, month]
    );

    const pad = (n: number) => (n < 10 ? "0" + n : String(n));
    const format = (d: Date) =>
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    const isToday = (date: Date) => {
        const todayStr = format(today);
        const dateStr = format(date);
        return todayStr === dateStr;
    };

    const isSelected = (date: Date) => {
        if (!selected) return false;
        const selectedDate = new Date(selected);
        const dateStr = format(date);
        const selectedStr = format(selectedDate);
        return dateStr === selectedStr;
    };

    return (
        <div className="w-[280px] bg-white border border-gray-200 rounded-md p-3 text-sm">
            <div className="flex items-center justify-between mb-2">
                <button
                    onClick={() => {
                        if (month === 0) {
                            setYear(year - 1);
                            setMonth(11);
                        } else setMonth((m) => m - 1);
                    }}
                    className="px-2 py-1 rounded hover:bg-gray-100"
                >
                    &lt;
                </button>
                <div className="font-medium">
                    {year}년 {month + 1}월
                </div>
                <button
                    onClick={() => {
                        if (month === 11) {
                            setYear(year + 1);
                            setMonth(0);
                        } else setMonth((m) => m + 1);
                    }}
                    className="px-2 py-1 rounded hover:bg-gray-100"
                >
                    &gt;
                </button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-xs text-center text-gray-500 border-b pb-2">
                {["일", "월", "화", "수", "목", "금", "토"].map((d) => (
                    <div key={d}>{d}</div>
                ))}
            </div>

            <div className="grid grid-cols-7 gap-1 mt-2">
                {grid.map(({ date, inMonth }, idx) => {
                    const key = format(date);
                    const isTodayDate = isToday(date);
                    const isSelectedDate = isSelected(date);
                    return (
                        <button
                            key={idx}
                            onClick={() => onSelect(key)}
                            className={`px-1 py-2 rounded ${
                                isSelectedDate
                                    ? "bg-blue-500 text-white font-semibold"
                                    : isTodayDate && inMonth
                                    ? "bg-blue-50 text-blue-600 font-semibold"
                                    : inMonth
                                    ? "text-gray-800"
                                    : "text-gray-300"
                            } hover:bg-gray-100`}
                        >
                            {date.getDate()}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
