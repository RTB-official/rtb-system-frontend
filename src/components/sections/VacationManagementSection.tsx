import type {
    VacationRow,
    VacationStatus,
} from "../../pages/Vacation/VacationPage";
import Select from "../common/Select";
import Tabs from "../common/Tabs";
import Table from "../common/Table";

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
    const summaryCards = [
        {
            label: "내 연차",
            value: `${summary.myAnnual}일`,
            color: "text-gray-900",
        },
        {
            label: "지급",
            value: `+ ${summary.granted}일`,
            color: "text-green-600",
        },
        {
            label: "사용",
            value: `-${summary.used}일`,
            color: "text-gray-900",
        },
        {
            label: "소멸",
            value: `- ${summary.expired}일`,
            color: "text-red-600",
        },
    ];

    return (
        <div className="flex flex-col gap-4 md:gap-6">
            {/* 4 cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                {summaryCards.map((card) => (
                    <div
                        key={card.label}
                        className="bg-gray-50 rounded-2xl p-5"
                    >
                        <div className="text-[13px] font-semibold text-gray-500">
                            {card.label}
                        </div>
                        <div
                            className={`mt-2 text-[26px] font-bold ${card.color}`}
                        >
                            {card.value}
                        </div>
                    </div>
                ))}
            </div>

            {/* filter */}
            <div className="flex items-center gap-4">
                <div className="text-[24px] font-semibold text-gray-900">
                    조회 기간
                </div>
                <Select
                    options={[
                        { value: "2025", label: "2025년" },
                        { value: "2024", label: "2024년" },
                        { value: "2023", label: "2023년" },
                    ]}
                    value={year}
                    onChange={onYearChange}
                    className="w-auto min-w-[140px]"
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
                <Table
                    columns={[
                        {
                            key: "period",
                            label: "기간",
                            width: "25%",
                        },
                        {
                            key: "item",
                            label: "항목",
                            width: "16.67%",
                        },
                        {
                            key: "reason",
                            label: "사유",
                            width: "25%",
                        },
                        {
                            key: "status",
                            label: "상태",
                            width: "16.67%",
                            render: (_value, row: VacationRow) => (
                                <StatusPill status={row.status} />
                            ),
                        },
                        {
                            key: "usedDays",
                            label: "사용 일수",
                            width: "8.33%",
                            align: "right",
                            render: (_value, row: VacationRow) => (
                                <span
                                    className={`font-medium ${
                                        row.usedDays < 0
                                            ? "text-red-600"
                                            : "text-gray-800"
                                    }`}
                                >
                                    {formatUsedDays(row.usedDays)}
                                </span>
                            ),
                        },
                        {
                            key: "remainDays",
                            label: "잔여",
                            width: "8.33%",
                            align: "right",
                            render: (_value, row: VacationRow) => (
                                <span className="font-medium text-gray-900">
                                    {row.remainDays}일
                                </span>
                            ),
                        },
                    ]}
                    data={rows}
                    rowKey="id"
                    className="text-[13px]"
                    pagination={{
                        currentPage: page,
                        totalPages,
                        onPageChange,
                    }}
                />
            ) : (
                <GrantExpireTable
                    rows={grantExpireRows ?? []}
                    pagination={{
                        currentPage: page,
                        totalPages,
                        onPageChange,
                    }}
                />
            )}
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
    pagination,
}: {
    rows: {
        id: string;
        monthLabel: string;
        granted?: number;
        expired?: number;
        used?: number;
        balance?: number;
    }[];
    pagination?: {
        currentPage: number;
        totalPages: number;
        onPageChange: (page: number) => void;
    };
}) {
    return (
        <Table
            columns={[
                {
                    key: "monthLabel",
                    label: "날짜",
                    width: "25%",
                },
                {
                    key: "granted",
                    label: "지급",
                    width: "16.67%",
                    render: (_value, row: GrantExpireRow) => (
                        <span
                            className={`font-medium ${
                                row.granted && row.granted > 0
                                    ? "text-gray-900"
                                    : "text-gray-400"
                            }`}
                        >
                            {formatDaysOrDash(row.granted)}
                        </span>
                    ),
                },
                {
                    key: "expired",
                    label: "소멸",
                    width: "16.67%",
                    render: (_value, row: GrantExpireRow) => (
                        <span
                            className={`font-medium ${
                                row.expired && row.expired < 0
                                    ? "text-gray-900"
                                    : "text-gray-400"
                            }`}
                        >
                            {formatDaysOrDash(row.expired)}
                        </span>
                    ),
                },
                {
                    key: "used",
                    label: "사용",
                    width: "16.67%",
                    render: (_value, row: GrantExpireRow) => (
                        <span
                            className={`font-medium ${
                                row.used && row.used < 0
                                    ? "text-gray-900"
                                    : "text-gray-400"
                            }`}
                        >
                            {formatDaysOrDash(row.used)}
                        </span>
                    ),
                },
                {
                    key: "balance",
                    label: "잔여",
                    width: "25%",
                    align: "right",
                    render: (_value, row: GrantExpireRow) => (
                        <span className="font-medium text-gray-900">
                            {formatBalanceOrDash(row.balance)}
                        </span>
                    ),
                },
            ]}
            data={rows}
            rowKey="id"
            className="text-[13px]"
            pagination={pagination}
        />
    );
}
