// src/pages/Expense/components/EmployeeDetailView.tsx
import Table, { TableColumn } from "../../../components/common/Table";
import { IconDownload } from "../../../components/icons/Icons";
import {
    type EmployeeMileageDetail,
    type EmployeeCardExpenseDetail,
} from "../../../lib/personalExpenseApi";
import { generateExpenseReportPDF } from "../../../lib/pdfUtils";
import { useToast } from "../../../components/ui/ToastProvider";

interface EmployeeDetailViewProps {
    employeeName: string;
    year: string;
    month: string;
    mileageDetails: EmployeeMileageDetail[];
    cardDetails: EmployeeCardExpenseDetail[];
    activeTab: "mileage" | "card";
    onTabChange: (tab: "mileage" | "card") => void;
    mileageColumns: TableColumn<EmployeeMileageDetail>[];
    cardColumns: TableColumn<EmployeeCardExpenseDetail>[];
    variant?: "default" | "dropdown";
    onHeaderClick?: () => void;
}

export default function EmployeeDetailView({
    employeeName,
    year,
    month,
    mileageDetails,
    cardDetails,
    activeTab,
    onTabChange,
    mileageColumns,
    cardColumns,
    variant = "default",
    onHeaderClick,
}: EmployeeDetailViewProps) {
    const { showError } = useToast();
    const containerClass =
        variant === "dropdown"
            ? "p-6 bg-gray-50"
            : "bg-white border border-gray-200 rounded-2xl p-4 lg:p-6";

    return (
        <div className={containerClass}>
            {/* 헤더 */}
            <div className={`flex items-center justify-between mb-2`}>
                <div>
                    <p className={`text-sm text-gray-500`}>
                        {year} {month}
                    </p>
                    <h2
                        className={`text-xl font-semibold text-gray-800 ${onHeaderClick && variant === "dropdown"
                                ? "cursor-pointer transition-colors hover:text-gray-500"
                                : ""
                            }`}
                        onClick={(e) => {
                            if (onHeaderClick && variant === "dropdown") {
                                e.stopPropagation();
                                onHeaderClick();
                            }
                        }}
                    >
                        {employeeName}님의 청구서
                    </h2>
                </div>
                <button
                    type="button"
                    onClick={async () => {
                        await generateExpenseReportPDF({
                            onError: showError,
                            employeeName,
                            year,
                            month,
                            mileageDetails,
                            cardDetails,
                        });
                    }}
                    className="flex items-center justify-center gap-1.5 h-[36px] px-3 text-[14px] rounded-[10px] bg-gray-800 hover:bg-gray-900 text-white font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-600 cursor-pointer"
                >
                    <IconDownload />
                    PDF 다운로드
                </button>
            </div>

            {/* 탭 */}
            <div className="flex gap-1 border-b border-gray-200 mb-6">
                <button
                    onClick={(e) => {
                        if (variant === "dropdown") {
                            e.stopPropagation();
                        }
                        onTabChange("mileage");
                    }}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === "mileage"
                            ? "text-gray-900 border-b-2 border-gray-900"
                            : "text-gray-500 hover:text-gray-700"
                        }`}
                >
                    마일리지 내역 ({mileageDetails.length}건)
                </button>
                <button
                    onClick={(e) => {
                        if (variant === "dropdown") {
                            e.stopPropagation();
                        }
                        onTabChange("card");
                    }}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === "card"
                            ? "text-gray-900 border-b-2 border-gray-900"
                            : "text-gray-500 hover:text-gray-700"
                        }`}
                >
                    카드 지출 내역 ({cardDetails.length}건)
                </button>
            </div>

            {/* 마일리지 내역 테이블 */}
            {activeTab === "mileage" && (
                <Table
                    columns={mileageColumns}
                    data={mileageDetails}
                    rowKey="id"
                    emptyText="마일리지 내역이 없습니다."
                    className="border-gray-200"
                />
            )}

            {/* 카드 지출 내역 테이블 */}
            {activeTab === "card" && (
                <Table
                    columns={cardColumns}
                    data={cardDetails}
                    rowKey="id"
                    emptyText="카드 지출 내역이 없습니다."
                    className="border-gray-200"
                />
            )}
        </div>
    );
}
