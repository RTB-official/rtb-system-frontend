import Table from "../../../components/common/Table";
import Pagination from "../../../components/common/Pagination";
import type { WorkloadTableRow } from "../../../lib/workloadApi";
import { IconChevronRight } from "../../../components/icons/Icons";

interface WorkloadTableSectionProps {
    isMobile?: boolean;
    columns: { key: string; label: string }[];
    tableData: WorkloadTableRow[];
    currentTableData: WorkloadTableRow[];
    totalPages: number;
    currentPage: number;
    onPageChange: (page: number) => void;
    onRowClick: (row: WorkloadTableRow) => void;
}

export default function WorkloadTableSection({
    isMobile = false,
    columns,
    tableData,
    currentTableData,
    totalPages,
    currentPage,
    onPageChange,
    onRowClick,
}: WorkloadTableSectionProps) {
    if (tableData.length === 0) {
        return (
            <div className={isMobile ? "" : "rounded-2xl border border-gray-200 bg-white p-7"}>
                <div className="py-8 text-center text-gray-500 text-sm">데이터가 없습니다.</div>
            </div>
        );
    }

    if (isMobile) {
        return (
            <div>
                <h2 className="text-base font-semibold text-gray-800 mb-1">상세 데이터</h2>
                <ul className="flex flex-col gap-2 mt-2">
                    {currentTableData.map((row) => (
                        <li key={row.id}>
                            <button
                                type="button"
                                className="w-full rounded-xl border border-gray-200 bg-white p-4 flex items-center justify-between gap-3 text-left active:bg-gray-50 transition-colors"
                                onClick={() => onRowClick(row)}
                            >
                                <div className="min-w-0 flex-1">
                                    <p className="font-medium text-gray-900">{row.name}</p>
                                    <p className="text-sm text-gray-500 mt-0.5">
                                        작업 {row.work} · 이동 {row.travel} · 대기 {row.wait} · {row.days}
                                    </p>
                                </div>
                                <IconChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
                            </button>
                        </li>
                    ))}
                </ul>
                {totalPages > 1 && (
                    <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={onPageChange}
                        className="py-4"
                    />
                )}
            </div>
        );
    }

    return (
        <div className="rounded-2xl border border-gray-200 bg-white p-7">
            <h2 className="text-lg font-semibold text-gray-800 mb-1">상세 데이터</h2>
            <p className="text-sm text-gray-500 mb-4">클릭하여 상세 내역을 확인하세요</p>
            <Table
                columns={columns}
                data={currentTableData}
                rowKey="id"
                onRowClick={onRowClick}
                pagination={
                    totalPages > 1
                        ? { currentPage, totalPages, onPageChange }
                        : undefined
                }
            />
        </div>
    );
}
