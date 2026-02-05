// src/pages/Expense/components/EmployeeDetailView.tsx
import Table, { TableColumn } from "../../../components/common/Table";
import {
    type EmployeeMileageDetail,
    type EmployeeCardExpenseDetail,
} from "../../../lib/personalExpenseApi";
import useIsMobile from "../../../hooks/useIsMobile";

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
    onReceiptClick?: (receiptPath: string) => void;
}

const formatCurrency = (amount: number) =>
    amount.toLocaleString("ko-KR") + "원";

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
    onReceiptClick,
}: EmployeeDetailViewProps) {
    const isMobile = useIsMobile();
    const containerClass =
        isMobile
            ? "p-0 bg-transparent"
            : variant === "dropdown"
                ? "p-6 bg-gray-50"
                : "bg-white border border-gray-200 rounded-2xl p-4 lg:p-6";

    return (
        <div className={containerClass}>
            {/* 헤더 */}
            <div className="mb-2">
                <p className="text-sm text-gray-500">
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

            {/* 탭 */}
            <div className={`flex gap-1 mb-6 ${isMobile ? "" : "border-b border-gray-200"}`}>
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

            {/* 마일리지 내역 */}
            {activeTab === "mileage" && (
                isMobile ? (
                    mileageDetails.length === 0 ? (
                        <p className="text-gray-500 text-sm py-6 text-center">마일리지 내역이 없습니다.</p>
                    ) : (
                        <ul className="flex flex-col gap-2">
                            {mileageDetails.map((row) => (
                                <li
                                    key={row.id}
                                    className="rounded-xl bg-gray-50 p-4 flex flex-col gap-1.5"
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-gray-500">{row.date}</span>
                                        <span className="font-semibold text-gray-900">{formatCurrency(row.amount)}</span>
                                    </div>
                                    <p className="text-gray-800 text-sm">{row.route}</p>
                                    <p className="text-gray-500 text-xs">
                                        {row.distance}km
                                        {row.details?.trim() ? ` · ${row.details}` : ""}
                                    </p>
                                </li>
                            ))}
                        </ul>
                    )
                ) : (
                    <Table
                        columns={mileageColumns}
                        data={mileageDetails}
                        rowKey="id"
                        emptyText="마일리지 내역이 없습니다."
                        className="border-gray-200"
                    />
                )
            )}

            {/* 카드 지출 내역 */}
            {activeTab === "card" && (
                isMobile ? (
                    cardDetails.length === 0 ? (
                        <p className="text-gray-500 text-sm py-6 text-center">카드 지출 내역이 없습니다.</p>
                    ) : (
                        <ul className="flex flex-col gap-2">
                            {cardDetails.map((row) => (
                                <li
                                    key={row.id}
                                    className="rounded-xl bg-gray-50 p-4 flex flex-col gap-1.5"
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-gray-500">{row.date}</span>
                                        <span className="font-semibold text-gray-900">{formatCurrency(row.amount)}</span>
                                    </div>
                                    <p className="text-gray-800 text-sm">{row.category}</p>
                                    {row.details?.trim() ? (
                                        <p className="text-gray-500 text-xs">{row.details}</p>
                                    ) : null}
                                    {row.receipt_path && onReceiptClick && (
                                        <button
                                            type="button"
                                            onClick={() => onReceiptClick(row.receipt_path!)}
                                            className="text-blue-500 text-sm underline text-left mt-1"
                                        >
                                            영수증 보기
                                        </button>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )
                ) : (
                    <Table
                        columns={cardColumns}
                        data={cardDetails}
                        rowKey="id"
                        emptyText="카드 지출 내역이 없습니다."
                        className="border-gray-200"
                    />
                )
            )}
        </div>
    );
}
