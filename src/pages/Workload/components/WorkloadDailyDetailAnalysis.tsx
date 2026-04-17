import Table from "../../../components/common/Table";
import Pagination from "../../../components/common/Pagination";
import { IconChevronRight } from "../../../components/icons/Icons";
import {
    formatHours,
    formatDetailDate,
    formatTimeRange,
    type WorkloadDetailEntry,
} from "../../../lib/workloadDetailApi";
import { useMemo } from "react";

export interface WorkloadDailyDetailAnalysisProps {
    entries: WorkloadDetailEntry[];
    isMobile: boolean;
    loading?: boolean;
    currentPage: number;
    onPageChange: (page: number) => void;
    itemsPerPage?: number;
    onRowClick: (row: WorkloadDetailEntry) => void;
    /** false면 테두리/패딩 없이 제목+본문만 (부모 레이아웃에 맞출 때) */
    bordered?: boolean;
}

function TableLoadingRows() {
    return (
        <div className="space-y-3 py-2">
            {Array.from({ length: 5 }).map((_, i) => (
                <div
                    key={i}
                    className="flex items-center gap-4 p-4 border border-gray-200 rounded-xl"
                >
                    <div className="h-5 w-28 bg-gray-200 rounded animate-pulse" />
                    <div className="h-5 w-24 bg-gray-200 rounded animate-pulse" />
                    <div className="h-5 w-16 bg-gray-200 rounded animate-pulse" />
                    <div className="h-5 w-20 bg-gray-200 rounded animate-pulse" />
                </div>
            ))}
        </div>
    );
}

export default function WorkloadDailyDetailAnalysis({
    entries,
    isMobile,
    loading = false,
    currentPage,
    onPageChange,
    itemsPerPage = 10,
    onRowClick,
    bordered = true,
}: WorkloadDailyDetailAnalysisProps) {
    const totalPages = useMemo(() => {
        return Math.ceil(entries.length / itemsPerPage);
    }, [entries.length, itemsPerPage]);

    const currentTableData = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        return entries.slice(startIndex, endIndex);
    }, [entries, currentPage, itemsPerPage]);

    const wrapClass = bordered ? (isMobile ? "" : "rounded-2xl border border-gray-200 bg-white p-7") : "";

    return (
        <div className={wrapClass}>
            <h2 className="text-base md:text-[22px] font-semibold text-gray-700 tracking-tight mb-3 md:mb-6">
                날짜별 세부 분석
            </h2>

            {loading ? (
                <TableLoadingRows />
            ) : entries.length === 0 ? (
                <p className="py-8 text-center text-gray-500 text-sm">
                    선택한 기간의 작업 내역이 없습니다.
                </p>
            ) : isMobile ? (
                <>
                    <ul className="flex flex-col gap-2">
                        {currentTableData.map((row) => {
                            const formattedDate = formatDetailDate(row.date);
                            const date = new Date(row.date + "T00:00:00");
                            const dayOfWeek = date.getDay();
                            let dateColor = "text-gray-800";
                            if (dayOfWeek === 0) dateColor = "text-red-600";
                            else if (dayOfWeek === 6) dateColor = "text-blue-600";
                            return (
                                <li key={row.id}>
                                    <button
                                        type="button"
                                        className="w-full rounded-xl border border-gray-200 bg-white p-4 flex items-center justify-between gap-3 text-left active:bg-gray-50 transition-colors"
                                        onClick={() => onRowClick(row)}
                                    >
                                        <div className="min-w-0 flex-1">
                                            <p className={`font-medium ${dateColor}`}>{formattedDate}</p>
                                            <p className="text-sm text-gray-500 mt-0.5">
                                                {row.vesselName || "—"} · {formatTimeRange(row.timeFrom, row.timeTo)}
                                            </p>
                                            <p className="text-sm text-gray-600 mt-1">
                                                작업 {formatHours(row.workTime)} · 이동 {formatHours(row.travelTime)} · 대기{" "}
                                                {formatHours(row.waitTime)}
                                            </p>
                                        </div>
                                        <IconChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                    {totalPages > 1 && (
                        <Pagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            onPageChange={onPageChange}
                            className="py-4"
                        />
                    )}
                </>
            ) : (
                <Table
                    columns={[
                        {
                            key: "date",
                            label: "날짜",
                            render: (_value, row: WorkloadDetailEntry, index: number) => {
                                const prev = currentTableData[index - 1];
                                if (prev?.date === row.date) {
                                    return <span className="text-transparent">-</span>;
                                }
                                const formattedDate = formatDetailDate(row.date);
                                const date = new Date(row.date + "T00:00:00");
                                const dayOfWeek = date.getDay();
                                let colorClass = "text-gray-800";
                                if (dayOfWeek === 0) colorClass = "text-red-600";
                                else if (dayOfWeek === 6) colorClass = "text-blue-600";
                                return (
                                    <span className={`font-medium ${colorClass}`}>
                                        {formattedDate}
                                    </span>
                                );
                            },
                        },
                        {
                            key: "vesselName",
                            label: "호선명",
                            render: (value: string | null, row: WorkloadDetailEntry, index: number) => {
                                const prev = currentTableData[index - 1];
                                if (prev?.date === row.date) return <span className="text-transparent">-</span>;
                                return value || "";
                            },
                        },
                        {
                            key: "workTime",
                            label: "작업시간",
                            render: (_, row: WorkloadDetailEntry) => formatHours(row.workTime),
                        },
                        {
                            key: "timeRange",
                            label: "시간대",
                            render: (_, row: WorkloadDetailEntry) =>
                                formatTimeRange(row.timeFrom, row.timeTo),
                        },
                        {
                            key: "travelTime",
                            label: "이동시간",
                            render: (_, row: WorkloadDetailEntry) => formatHours(row.travelTime),
                        },
                        {
                            key: "waitTime",
                            label: "대기시간",
                            render: (_, row: WorkloadDetailEntry) => formatHours(row.waitTime),
                        },
                    ]}
                    data={currentTableData}
                    rowKey="id"
                    onRowClick={onRowClick}
                    emptyText="선택한 기간의 작업 내역이 없습니다."
                    pagination={
                        totalPages > 1
                            ? { currentPage, totalPages, onPageChange }
                            : undefined
                    }
                />
            )}
        </div>
    );
}
