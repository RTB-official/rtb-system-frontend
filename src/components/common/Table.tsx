import React from "react";
import EmptyValueIndicator from "../../pages/Expense/components/EmptyValueIndicator";
import Pagination from "./Pagination";

export interface TableColumn<T = any> {
    key: string;
    label: React.ReactNode;
    width?: string;
    align?: "left" | "right" | "center";
    render?: (value: any, row: T, index: number) => React.ReactNode;
    headerClassName?: string;
    cellClassName?:
        | string
        | ((value: any, row: T, index: number) => string);
    showEmptyIndicator?: boolean;
}

interface TableProps<T = any> {
    columns: TableColumn<T>[];
    data: T[];
    rowKey?: string | ((row: T) => string | number);
    onRowClick?: (row: T, index: number) => void;
    rowClassName?: (row: T, index: number) => string;
    expandableRowRender?: (row: T) => React.ReactNode;
    expandedRowKeys?: (string | number)[];
    emptyText?: string;
    className?: string;
    footer?: React.ReactNode;
    hideRowBorders?: boolean;
    hideHeaderBorder?: boolean;
    outerBorder?: boolean;
    pagination?: {
        currentPage: number;
        totalPages: number;
        onPageChange: (page: number) => void;
    };
}

export default function Table<T = any>({
    columns,
    data,
    rowKey = "id",
    onRowClick,
    rowClassName,
    expandableRowRender,
    expandedRowKeys = [],
    emptyText = "데이터가 없습니다.",
    className = "",
    footer,
    hideRowBorders = false,
    hideHeaderBorder = false,
    outerBorder = true,
    pagination,
}: TableProps<T>) {
    const getRowKey = (row: T, index: number): string | number => {
        if (typeof rowKey === "function") {
            return rowKey(row);
        }
        return (row as any)[rowKey] ?? index;
    };

    const isRowExpanded = (row: T): boolean => {
        const key = getRowKey(row, 0);
        return expandedRowKeys.includes(key);
    };

    return (
        <div className="flex flex-col">
            <div
                className={`overflow-auto w-full ${outerBorder ? "border border-gray-200 rounded-2xl" : ""}`}
            >
                <table
                    className={`w-full text-[14px] text-gray-900 ${className}`}
                >
                    <thead
                        className={`bg-gray-100 ${
                            hideHeaderBorder ? "" : "border-b border-gray-200"
                        }`}
                    >
                        <tr>
                            {columns.map((column) => (
                                <th
                                    key={column.key}
                                    className={`px-4 py-3 font-semibold text-gray-600 ${
                                        column.align === "right"
                                            ? "text-right"
                                            : column.align === "center"
                                            ? "text-center"
                                            : "text-left"
                                    } ${column.headerClassName ?? ""}`}
                                    style={
                                        column.width
                                            ? { width: column.width }
                                            : undefined
                                    }
                                >
                                    {column.label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {data.length === 0 ? (
                            <tr className="bg-white">
                                <td
                                    colSpan={columns.length}
                                    className="px-4 py-10 text-center text-gray-500 bg-white"
                                >
                                    <span className="text-sm text-gray-500">
                                        {emptyText || "데이터가 없습니다."}
                                    </span>
                                </td>
                            </tr>
                        ) : (
                            data.map((row, index) => {
                                const key = getRowKey(row, index);
                                const isExpanded = isRowExpanded(row);
                                const isLastRow = index === data.length - 1;
                                const rowClass = rowClassName?.(row, index) ?? "";
                                return (
                                    <React.Fragment key={key}>
                                        <tr
                                            className={`${
                                                isLastRow || hideRowBorders
                                                    ? ""
                                                    : "border-b border-gray-200"
                                            } bg-white hover:bg-blue-50 transition-colors ${
                                                onRowClick
                                                    ? "cursor-pointer"
                                                    : ""
                                            } ${rowClass}`}
                                            onClick={() =>
                                                onRowClick?.(row, index)
                                            }
                                        >
                                            {columns.map((column) => {
                                                const rawValue = (row as any)[column.key];
                                                const renderedValue = column.render
                                                    ? column.render(rawValue, row, index)
                                                    : rawValue;
                                                const isEmpty =
                                                    renderedValue === null ||
                                                    renderedValue === undefined ||
                                                    (typeof renderedValue === "string" &&
                                                        (renderedValue.trim() === "" ||
                                                            renderedValue.trim() === "-" ||
                                                            renderedValue.trim() === "—"));
                                                const cellClass =
                                                    typeof column.cellClassName === "function"
                                                        ? column.cellClassName(rawValue, row, index)
                                                        : column.cellClassName ?? "";
                                                const shouldShowEmptyIndicator =
                                                    column.showEmptyIndicator ?? true;
                                                return (
                                                    <td
                                                        key={column.key}
                                                        className={`px-4 py-3 text-gray-900 ${
                                                            column.align === "right"
                                                                ? "text-right"
                                                                : column.align ===
                                                                  "center"
                                                                ? "text-center"
                                                                : "text-left"
                                                        } ${cellClass}`}
                                                    >
                                                        {isEmpty ? (
                                                            shouldShowEmptyIndicator ? (
                                                                <EmptyValueIndicator />
                                                            ) : null
                                                        ) : (
                                                            renderedValue
                                                        )}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                        {isExpanded && expandableRowRender && (
                                            <tr>
                                                <td
                                                    colSpan={columns.length}
                                                    className="px-0 py-0 bg-white"
                                                >
                                                    {expandableRowRender(row)}
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })
                        )}
                    </tbody>
                    {footer && <tfoot>{footer}</tfoot>}
                </table>
            </div>
            {pagination && (
                <Pagination
                    currentPage={pagination.currentPage}
                    totalPages={pagination.totalPages}
                    onPageChange={pagination.onPageChange}
                    className="mt-4"
                />
            )}
        </div>
    );
}
