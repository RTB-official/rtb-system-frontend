import type {
    VacationRow,
    VacationStatus,
} from "../../pages/Vacation/VacationPage";
import Select from "../common/Select";
import Tabs from "../common/Tabs";
import Table from "../common/Table";
import Chip from "../ui/Chip";
import ActionMenu from "../common/ActionMenu";
import { IconMore } from "../icons/Icons";
import { useState } from "react";

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

    onEdit?: (row: VacationRow) => void;
    onDelete?: (row: VacationRow) => void;
}

function StatusPill({ status }: { status: VacationStatus }) {
    if (status === "승인 완료") {
        return (
            <Chip color="green-700" variant="solid" size="sm">
                승인 완료
            </Chip>
        );
    }
    if (status === "대기 중") {
        return (
            <Chip color="blue-600" variant="solid" size="sm">
                대기 중
            </Chip>
        );
    }
    return (
        <Chip color="red-700" variant="solid" size="sm">
            반려
        </Chip>
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
    onEdit,
    onDelete,
}: Props) {
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
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
            value: `- ${summary.used}일`,
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
                        { value: "2026", label: "2026년" },
                        { value: "2025", label: "2025년" },
                    ]}
                    value={year}
                    onChange={onYearChange}
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
                            width: "20%",
                        },
                        {
                            key: "item",
                            label: "항목",
                            width: "16.67%",
                        },
                        {
                            key: "reason",
                            label: "사유",
                            width: "24%",
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
                            width: "12%",
                            align: "left",
                            render: (_value, row: VacationRow) => (
                                <span
                                    className={`font-medium ${row.usedDays < 0
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
                            width: "12%",
                            align: "left",
                            render: (_value, row: VacationRow) => (
                                <span className="font-medium text-gray-900">
                                    {row.remainDays}일
                                </span>
                            ),
                        },
                        {
                            key: "actions",
                            label: "",
                            width: "8%",
                            align: "right",
                            render: (_value, row: VacationRow) => {
                                // 오늘 날짜
                                const today = new Date();
                                today.setHours(0, 0, 0, 0);

                                // 휴가 날짜
                                const vacationDate = new Date(row.date);
                                vacationDate.setHours(0, 0, 0, 0);

                                // 지난 날짜의 승인 완료 휴가는 액션 메뉴 표시 안 함
                                const isPastApproved = row.status === "승인 완료" && vacationDate < today;

                                if (isPastApproved) {
                                    return null;
                                }

                                return (
                                    <div className="relative inline-flex">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setOpenMenuId(
                                                    openMenuId === row.id
                                                        ? null
                                                        : row.id
                                                );
                                                setMenuAnchor(
                                                    openMenuId === row.id
                                                        ? null
                                                        : e.currentTarget
                                                );
                                            }}
                                            className="p-2 rounded hover:bg-gray-100 text-gray-600"
                                            aria-label="행 메뉴"
                                        >
                                            <IconMore className="w-[18px] h-[18px]" />
                                        </button>
                                        <ActionMenu
                                            isOpen={openMenuId === row.id}
                                            anchorEl={menuAnchor}
                                            onClose={() => {
                                                setOpenMenuId(null);
                                                setMenuAnchor(null);
                                            }}
                                            onEdit={row.status === "대기 중" ? () => {
                                                onEdit?.(row);
                                                setOpenMenuId(null);
                                                setMenuAnchor(null);
                                            } : undefined} // 대기 중인 휴가만 수정 가능
                                            onDelete={row.status === "대기 중" ? () => {
                                                onDelete?.(row);
                                                setOpenMenuId(null);
                                                setMenuAnchor(null);
                                            } : undefined} // 대기 중인 휴가만 삭제 가능
                                            width="w-44"
                                            showDelete={row.status === "대기 중"} // 대기 중인 휴가만 삭제 가능
                                        />
                                    </div>
                                );
                            },
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
                    width: "20%",
                },
                {
                    key: "granted",
                    label: "지급",
                    width: "20%",
                    render: (_value, row: GrantExpireRow) => (
                        <span
                            className={`font-medium ${row.granted && row.granted > 0
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
                    width: "20%",
                    render: (_value, row: GrantExpireRow) => (
                        <span
                            className={`font-medium ${row.expired && row.expired < 0
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
                    width: "20%",
                    render: (_value, row: GrantExpireRow) => (
                        <span
                            className={`font-medium ${row.used && row.used < 0
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
                    width: "20%",
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
