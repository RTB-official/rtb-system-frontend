import type {
    VacationRow,
    VacationStatus,
} from "../../pages/Vacation/VacationPage";
import { formatVacationDays } from "../../lib/vacationApi";
import Select from "../common/Select";
import Tabs from "../common/Tabs";
import Table from "../common/Table";
import Chip from "../ui/Chip";
import ActionMenu from "../common/ActionMenu";
import { IconMore, IconMoreVertical } from "../icons/Icons";
import useIsMobile from "../../hooks/useIsMobile";
import { useState } from "react";
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
    // 정수면 "n일", 반차 등 소수면 "n.5일" (n.0일 표기 안 함)
    const n = Number(v);
    const abs = Math.abs(n);
    const dayStr = Math.abs(abs - Math.round(abs)) < 1e-9 ? String(Math.round(abs)) : Number(abs).toFixed(1);
    const sign = n > 0 ? "+" : n < 0 ? "-" : "";
    return sign + dayStr + "일";
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
    const isMobile = useIsMobile();
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
    const summaryCards = [
        {
            label: "내 연차",
            value: formatVacationDays(summary.myAnnual),
            color: "text-gray-900",
        },
        {
            label: "지급",
            value: `+ ${formatVacationDays(summary.granted)}`,
            color: "text-green-600",
        },
        {
            label: "사용",
            value: `- ${formatVacationDays(summary.used)}`,
            color: "text-gray-900",
        },
        {
            label: "소멸",
            value: `- ${formatVacationDays(summary.expired)}`,
            color: "text-red-600",
        },
    ];

    return (
        <div className="flex flex-col gap-4 md:gap-6">
            {/* 4 cards: 모바일 2열 2행, 데스크톱 4열 */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
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

            {/* filter: 모바일 한 줄, 16px 간격 */}
            <div className="flex flex-row items-center gap-4 flex-wrap">
                <span className="text-base sm:text-[24px] font-semibold text-gray-900 shrink-0">
                    조회 기간
                </span>
                <Select
                    options={[
                        { value: "2026", label: "2026년" },
                        { value: "2025", label: "2025년" },
                    ]}
                    value={year}
                    onChange={onYearChange}
                    className="w-auto min-w-0 shrink-0"
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

            {/* table or mobile cards */}
            {tab === "사용 내역" ? (
                isMobile ? (
                    <>
                        <ul className="flex flex-col gap-2">
                            {rows.length === 0 ? (
                                <p className="py-8 text-center text-gray-500 text-sm rounded-2xl border border-dashed border-gray-200 bg-gray-50">
                                    휴가 사용 내역이 없습니다.
                                </p>
                            ) : (
                                rows.map((row) => {
                                    const today = new Date();
                                    today.setHours(0, 0, 0, 0);
                                    const vacationDate = new Date(row.date);
                                    vacationDate.setHours(0, 0, 0, 0);
                                    const isPastApproved = row.status === "승인 완료" && vacationDate < today;
                                    const canEdit = row.status === "대기 중";
                                    const canDelete = row.status === "대기 중" || (row.status === "승인 완료" && vacationDate >= today);
                                    const showActions = !isPastApproved && (canEdit || canDelete);
                                    return (
                                        <li key={row.id} className="rounded-xl border border-gray-200 p-4 flex flex-col gap-1 bg-white relative">
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <p className="text-[13px] text-gray-500">{row.period}</p>
                                                    <StatusPill status={row.status} />
                                                </div>
                                                {showActions && (
                                                    <div className="relative inline-flex shrink-0 -mt-1 -mr-1">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setOpenMenuId(openMenuId === row.id ? null : row.id);
                                                                setMenuAnchor(openMenuId === row.id ? null : e.currentTarget);
                                                            }}
                                                            className="p-2 rounded hover:bg-gray-100 text-gray-600"
                                                            aria-label="행 메뉴"
                                                        >
                                                            <IconMoreVertical className="w-[18px] h-[18px]" />
                                                        </button>
                                                        <ActionMenu
                                                            isOpen={openMenuId === row.id}
                                                            anchorEl={menuAnchor}
                                                            onClose={() => {
                                                                setOpenMenuId(null);
                                                                setMenuAnchor(null);
                                                            }}
                                                            onEdit={canEdit ? () => { onEdit?.(row); setOpenMenuId(null); setMenuAnchor(null); } : undefined}
                                                            onDelete={canDelete ? () => { onDelete?.(row); setOpenMenuId(null); setMenuAnchor(null); } : undefined}
                                                            width="w-44"
                                                            showDelete={canDelete}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                            <p className="text-lg font-semibold text-gray-900">{row.item}</p>
                                            {row.reason && <p className="text-sm text-gray-700 pt-0.5">{row.reason}</p>}
                                        </li>
                                    );
                                })
                            )}
                        </ul>
                        {totalPages > 1 && (
                            <div className="flex items-center justify-center gap-2 py-2">
                                <Button variant="outline" size="sm" onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page === 1}>
                                    이전
                                </Button>
                                <span className="text-sm text-gray-600">{page} / {totalPages}</span>
                                <Button variant="outline" size="sm" onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page === totalPages}>
                                    다음
                                </Button>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="overflow-x-auto">
                        <Table
                            columns={[
                                { key: "period", label: "기간", width: "20%" },
                                { key: "item", label: "항목", width: "16.67%" },
                                { key: "reason", label: "사유", width: "24%" },
                                { key: "status", label: "상태", width: "16.67%", render: (_value, row: VacationRow) => <StatusPill status={row.status} /> },
                                {
                                    key: "usedDays",
                                    label: "사용 일수",
                                    width: "12%",
                                    align: "left",
                                    render: (_value, row: VacationRow) =>
                                        row.usedDays == null ? null : (
                                            <span className={`font-medium ${row.usedDays < 0 ? "text-red-600" : "text-gray-800"}`}>
                                                {formatUsedDays(row.usedDays)}
                                            </span>
                                        ),
                                },
                                {
                                    key: "remainDays",
                                    label: "잔여",
                                    width: "12%",
                                    align: "left",
                                    render: (_value, row: VacationRow) =>
                                        row.remainDays == null ? null : <span className="font-medium text-gray-900">{formatVacationDays(row.remainDays)}</span>,
                                },
                                {
                                    key: "actions",
                                    label: "",
                                    width: "8%",
                                    align: "right",
                                    render: (_value, row: VacationRow) => {
                                        const today = new Date();
                                        today.setHours(0, 0, 0, 0);
                                        const vacationDate = new Date(row.date);
                                        vacationDate.setHours(0, 0, 0, 0);
                                        const isPastApproved = row.status === "승인 완료" && vacationDate < today;
                                        const canEdit = row.status === "대기 중";
                                        const canDelete = row.status === "대기 중" || (row.status === "승인 완료" && vacationDate >= today);
                                        if (isPastApproved || (!canEdit && !canDelete)) return null;
                                        return (
                                            <div className="relative inline-flex">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setOpenMenuId(openMenuId === row.id ? null : row.id);
                                                        setMenuAnchor(openMenuId === row.id ? null : e.currentTarget);
                                                    }}
                                                    className="p-2 rounded hover:bg-gray-100 text-gray-600"
                                                    aria-label="행 메뉴"
                                                >
                                                    <IconMore className="w-[18px] h-[18px]" />
                                                </button>
                                                <ActionMenu
                                                    isOpen={openMenuId === row.id}
                                                    anchorEl={menuAnchor}
                                                    onClose={() => { setOpenMenuId(null); setMenuAnchor(null); }}
                                                    onEdit={canEdit ? () => { onEdit?.(row); setOpenMenuId(null); setMenuAnchor(null); } : undefined}
                                                    onDelete={canDelete ? () => { onDelete?.(row); setOpenMenuId(null); setMenuAnchor(null); } : undefined}
                                                    width="w-44"
                                                    showDelete={canDelete}
                                                />
                                            </div>
                                        );
                                    },
                                },
                            ]}
                            data={rows}
                            rowKey="id"
                            className="text-[13px]"
                            emptyText="휴가 사용 내역이 없습니다."
                            pagination={{ currentPage: page, totalPages, onPageChange }}
                        />
                    </div>
                )
            ) : (
                isMobile ? (
                    <>
                        <ul className="flex flex-col gap-2">
                            {(grantExpireRows ?? []).length === 0 ? (
                                <p className="py-8 text-center text-gray-500 text-sm rounded-2xl border border-dashed border-gray-200 bg-gray-50">
                                    지급/소멸 내역이 없습니다.
                                </p>
                            ) : (
                                (grantExpireRows ?? []).map((row) => {
                                    const labelWithYear = row.monthLabel.includes("년") ? row.monthLabel : `${year}년 ${row.monthLabel}`;
                                    return (
                                    <li key={row.id} className="rounded-xl border border-gray-200 p-4 flex flex-col gap-1 bg-white">
                                        <p className="font-medium text-gray-900">{labelWithYear}</p>
                                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
                                            {row.granted != null && <span>지급 {formatDaysOrDash(row.granted)}</span>}
                                            {row.expired != null && <span>소멸 {formatDaysOrDash(row.expired)}</span>}
                                            {row.used != null && <span>사용 {formatDaysOrDash(row.used)}</span>}
                                            {row.balance != null && <span className="font-medium text-gray-900">잔여 {formatBalanceOrDash(row.balance)}</span>}
                                        </div>
                                    </li>
                                    );
                                })
                            )}
                        </ul>
                        {totalPages > 1 && (
                            <div className="flex items-center justify-center gap-2 py-2">
                                <Button variant="outline" size="sm" onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page === 1}>이전</Button>
                                <span className="text-sm text-gray-600">{page} / {totalPages}</span>
                                <Button variant="outline" size="sm" onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page === totalPages}>다음</Button>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="overflow-x-auto">
                        <GrantExpireTable
                        rows={grantExpireRows ?? []}
                        pagination={{
                            currentPage: page,
                            totalPages,
                            onPageChange,
                        }}
                    />
                </div>
                )
            )}
        </div>
    );
}

function formatDaysOrDash(v?: number) {
    if (v === undefined || v === null) return "";
    if (v === 0) return "0일";
    const n = Number(v);
    return (n > 0 ? "+" : "-") + formatVacationDays(Math.abs(n));
}

function formatBalanceOrDash(v?: number) {
    if (v === undefined || v === null) return "";
    return formatVacationDays(v);
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
                    render: (_value, row: GrantExpireRow) => {
                        if (row.granted === null || row.granted === undefined) {
                            return null;
                        }
                        return (
                            <span
                                className={`font-medium ${row.granted > 0
                                    ? "text-gray-900"
                                    : "text-gray-400"
                                    }`}
                            >
                                {formatDaysOrDash(row.granted)}
                            </span>
                        );
                    },
                },
                {
                    key: "expired",
                    label: "소멸",
                    width: "20%",
                    render: (_value, row: GrantExpireRow) => {
                        if (row.expired === null || row.expired === undefined) {
                            return null;
                        }
                        return (
                            <span
                                className={`font-medium ${row.expired < 0
                                    ? "text-gray-900"
                                    : "text-gray-400"
                                    }`}
                            >
                                {formatDaysOrDash(row.expired)}
                            </span>
                        );
                    },
                },
                {
                    key: "used",
                    label: "사용",
                    width: "20%",
                    render: (_value, row: GrantExpireRow) => {
                        if (row.used === null || row.used === undefined) {
                            return null;
                        }
                        return (
                            <span
                                className={`font-medium ${row.used < 0
                                    ? "text-gray-900"
                                    : "text-gray-400"
                                    }`}
                            >
                                {formatDaysOrDash(row.used)}
                            </span>
                        );
                    },
                },
                {
                    key: "balance",
                    label: "잔여",
                    width: "20%",
                    render: (_value, row: GrantExpireRow) => {
                        if (row.balance === null || row.balance === undefined) {
                            return null;
                        }
                        return (
                            <span className="font-medium text-gray-900">
                                {formatBalanceOrDash(row.balance)}
                            </span>
                        );
                    },
                },
            ]}
            data={rows}
            rowKey="id"
            className="text-[13px]"
            emptyText="지급/소멸 내역이 없습니다."
            pagination={pagination}
        />
    );
}
