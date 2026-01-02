import type {
    VacationRow,
    VacationStatus,
} from "../../pages/Vacation/VacationPage";
import Select from "../common/Select";
import Tabs from "../common/Tabs";
import Button from "../common/Button";

interface Summary {
    myAnnual: number; // 내 연차
    granted: number; // 지급
    used: number; // 사용
    expired: number; // 소멸
}

export interface GrantExpireRow {
    id: string;
    monthLabel: string; // "2025년 1월"
    granted?: number; // 15
    expired?: number; // -3 (표시는 -3일)
    used?: number; // -3
    balance?: number; // 15
}

interface Props {
    summary: Summary;

    year: string;
    onYearChange: (v: string) => void;

    tab: "사용 내역" | "지급/소멸 내역";
    onTabChange: (v: "사용 내역" | "지급/소멸 내역") => void;

    rows: VacationRow[];

    grantExpireRows?: GrantExpireRow[];

    page: number;
    totalPages: number;
    onPageChange: (p: number) => void;
}

function StatusPill({ status }: { status: VacationStatus }) {
    if (status === "승인 완료") {
        return (
            <span className="inline-flex items-center justify-center px-2 py-1 rounded text-[12px] font-medium text-green-700 bg-green-50">
                승인 완료
            </span>
        );
    }
    if (status === "대기 중") {
        return (
            <span className="inline-flex items-center justify-center px-2 py-1 rounded text-[12px] font-medium text-blue-600 bg-blue-50">
                대기 중
            </span>
        );
    }
    return (
        <span className="inline-flex items-center justify-center px-2 py-1 rounded text-[12px] font-medium text-red-700 bg-red-50">
            반려
        </span>
    );
}

function formatUsedDays(v: number) {
    // -1 => "-1일", -0.5 => "-0.5일"
    const s = v > 0 ? `+${v}` : `${v}`;
    return `${s}일`;
}

export default function VacationManagementSection({
    summary,
    year,
    onYearChange,
    tab,
    onTabChange,
    rows,
    grantExpireRows,
    page,
    totalPages,
    onPageChange,
}: Props) {
    return (
        <div className="flex flex-col gap-4 md:gap-6">
            {/* 4 cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                <div className="bg-white rounded-2xl border border-gray-100 p-5">
                    <div className="text-[13px] font-bold text-gray-500">
                        내 연차
                    </div>
                    <div className="mt-2 text-[26px] font-black text-gray-900">
                        {summary.myAnnual}일
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 p-5">
                    <div className="text-[13px] font-bold text-gray-500">
                        지급
                    </div>
                    <div className="mt-2 text-[26px] font-black text-green-600">
                        + {summary.granted}일
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 p-5">
                    <div className="text-[13px] font-bold text-gray-500">
                        사용
                    </div>
                    <div className="mt-2 text-[26px] font-black text-gray-900">
                        -{summary.used}일
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 p-5">
                    <div className="text-[13px] font-bold text-gray-500">
                        소멸
                    </div>
                    <div className="mt-2 text-[26px] font-black text-red-600">
                        - {summary.expired}일
                    </div>
                </div>
            </div>

            {/* filter */}
            <div className="flex items-center gap-3">
                <div className="text-[18px] font-extrabold text-gray-900">
                    조회기간
                </div>
                <Select
                    options={[
                        { value: "2025", label: "2025년" },
                        { value: "2024", label: "2024년" },
                        { value: "2023", label: "2023년" },
                    ]}
                    value={year}
                    onChange={onYearChange}
                    className="w-auto min-w-[120px]"
                />
            </div>

            {/* tabs */}
            <Tabs
                items={[
                    { value: "사용 내역", label: "사용 내역" },
                    { value: "지급/소멸 내역", label: "지급/소멸 내역" },
                ]}
                value={tab}
                onChange={(v) =>
                    onTabChange(v as "사용 내역" | "지급/소멸 내역")
                }
            />

            {/* table */}
            {tab === "사용 내역" ? (
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                    <div className="grid grid-cols-12 gap-2 px-5 py-3 bg-gray-50 text-[13px] font-extrabold text-gray-600">
                        <div className="col-span-3">기간</div>
                        <div className="col-span-2">항목</div>
                        <div className="col-span-3">사유</div>
                        <div className="col-span-2">상태</div>
                        <div className="col-span-1 text-right">사용 일수</div>
                        <div className="col-span-1 text-right">잔여</div>
                    </div>

                    <div className="divide-y divide-gray-100">
                        {rows.map((r) => (
                            <div
                                key={r.id}
                                className="grid grid-cols-12 gap-2 px-5 py-3 text-[13px] items-center"
                            >
                                <div className="col-span-3 text-gray-800">
                                    {r.period}
                                </div>
                                <div className="col-span-2 text-gray-800">
                                    {r.item}
                                </div>
                                <div className="col-span-3 text-gray-800">
                                    {r.reason}
                                </div>
                                <div className="col-span-2">
                                    <StatusPill status={r.status} />
                                </div>
                                <div
                                    className={`col-span-1 text-right font-extrabold ${
                                        r.usedDays < 0
                                            ? "text-red-600"
                                            : "text-gray-800"
                                    }`}
                                >
                                    {formatUsedDays(r.usedDays)}
                                </div>
                                <div className="col-span-1 text-right font-extrabold text-gray-900">
                                    {r.remainDays}일
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <GrantExpireTable rows={grantExpireRows ?? []} />
            )}

            {/* pagination */}
            <div className="flex justify-center items-center gap-2 pt-1">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onPageChange(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="rounded-lg"
                    aria-label="prev"
                >
                    &lt;
                </Button>

                <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }).map((_, i) => {
                        const p = i + 1;
                        const active = p === page;
                        return (
                            <Button
                                key={p}
                                variant="ghost"
                                size="sm"
                                onClick={() => onPageChange(p)}
                                className={`rounded-lg ${
                                    active
                                        ? "bg-gray-100 text-gray-900"
                                        : "text-gray-500 hover:bg-gray-100"
                                }`}
                            >
                                {p}
                            </Button>
                        );
                    })}
                </div>

                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onPageChange(Math.min(totalPages, page + 1))}
                    disabled={page === totalPages}
                    className="rounded-lg"
                    aria-label="next"
                >
                    &gt;
                </Button>
            </div>
        </div>
    );
}

function formatDaysOrDash(v?: number) {
    if (v === undefined || v === null) return "-";
    if (v === 0) return "0일";
    // 지급은 +, 소멸/사용은 -로 들어올 수 있음
    const s = v > 0 ? `+${v}` : `${v}`;
    return `${s}일`;
}

function formatBalanceOrDash(v?: number) {
    if (v === undefined || v === null) return "-";
    return `${v}일`;
}

function GrantExpireTable({
    rows,
}: {
    rows: {
        id: string;
        monthLabel: string;
        granted?: number;
        expired?: number;
        used?: number;
        balance?: number;
    }[];
}) {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="grid grid-cols-12 gap-2 px-6 py-4 bg-gray-50 text-[13px] font-extrabold text-gray-600">
                <div className="col-span-3">날짜</div>
                <div className="col-span-2">지급</div>
                <div className="col-span-2">소멸</div>
                <div className="col-span-2">사용</div>
                <div className="col-span-3 text-right">잔여</div>
            </div>

            <div className="divide-y divide-gray-100">
                {rows.map((r) => (
                    <div
                        key={r.id}
                        className="grid grid-cols-12 gap-2 px-6 py-4 text-[13px] items-center"
                    >
                        <div className="col-span-3 text-gray-800">
                            {r.monthLabel}
                        </div>

                        <div
                            className={`col-span-2 font-extrabold ${
                                r.granted && r.granted > 0
                                    ? "text-gray-900"
                                    : "text-gray-400"
                            }`}
                        >
                            {formatDaysOrDash(r.granted)}
                        </div>

                        <div
                            className={`col-span-2 font-extrabold ${
                                r.expired && r.expired < 0
                                    ? "text-gray-900"
                                    : "text-gray-400"
                            }`}
                        >
                            {formatDaysOrDash(r.expired)}
                        </div>

                        <div
                            className={`col-span-2 font-extrabold ${
                                r.used && r.used < 0
                                    ? "text-gray-900"
                                    : "text-gray-400"
                            }`}
                        >
                            {formatDaysOrDash(r.used)}
                        </div>

                        <div className="col-span-3 text-right font-extrabold text-gray-900">
                            {formatBalanceOrDash(r.balance)}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
