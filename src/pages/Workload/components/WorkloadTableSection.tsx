import Table from "../../../components/common/Table";
import type { WorkloadTableRow } from "../../../lib/workloadApi";

interface WorkloadTableSectionProps {
    columns: { key: string; label: string }[];
    tableData: WorkloadTableRow[];
    currentTableData: WorkloadTableRow[];
    totalPages: number;
    currentPage: number;
    onPageChange: (page: number) => void;
    onRowClick: (row: WorkloadTableRow) => void;
}

export default function WorkloadTableSection({
    columns,
    tableData,
    currentTableData,
    totalPages,
    currentPage,
    onPageChange,
    onRowClick,
}: WorkloadTableSectionProps) {
    return (
        <div className="bg-white border border-gray-200 rounded-2xl p-7">
            <h2 className="text-lg font-semibold text-gray-800 mb-1">
                상세 데이터
            </h2>
            <p className="text-sm text-gray-500 mb-4">
                클릭하여 상세 내역을 확인하세요
            </p>

            {tableData.length === 0 ? (
                <div className="py-8 text-center text-gray-500">
                    데이터가 없습니다.
                </div>
            ) : (
                <Table
                    columns={columns}
                    data={currentTableData}
                    rowKey="id"
                    onRowClick={onRowClick}
                    pagination={
                        totalPages > 1
                            ? {
                                  currentPage,
                                  totalPages,
                                  onPageChange,
                              }
                            : undefined
                    }
                />
            )}
        </div>
    );
}
