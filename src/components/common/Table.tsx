import React from "react";
import Pagination from "./Pagination";

export interface TableColumn<T = any> {
    key: string;
    label: string;
    width?: string;
    align?: "left" | "right" | "center";
    render?: (value: any, row: T, index: number) => React.ReactNode;
}

interface TableProps<T = any> {
    columns: TableColumn<T>[];
    data: T[];
    rowKey?: string | ((row: T) => string | number);
    onRowClick?: (row: T, index: number) => void;
    expandableRowRender?: (row: T) => React.ReactNode;
    expandedRowKeys?: (string | number)[];
    emptyText?: string;
    className?: string;
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
    expandableRowRender,
    expandedRowKeys = [],
    emptyText = "데이터가 없습니다.",
    className = "",
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
                className={`overflow-auto border border-gray-200 rounded-2xl w-full`}
            >
                <table
                    className={`w-full text-[14px] text-gray-900 ${className}`}
                >
                    <thead className="bg-gray-100 border-b border-gray-200">
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
                                    }`}
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
                                    {emptyText}
                                </td>
                            </tr>
                        ) : (
                            data.map((row, index) => {
                                const key = getRowKey(row, index);
                                const isExpanded = isRowExpanded(row);
                                return (
                                    <React.Fragment key={key}>
                                        <tr
                                            className={`border-b border-gray-200 bg-white hover:bg-blue-50 transition-colors ${
                                                onRowClick
                                                    ? "cursor-pointer"
                                                    : ""
                                            }`}
                                            onClick={() =>
                                                onRowClick?.(row, index)
                                            }
                                        >
                                            {columns.map((column) => (
                                                <td
                                                    key={column.key}
                                                    className={`px-4 py-3 text-gray-900 ${
                                                        column.align === "right"
                                                            ? "text-right"
                                                            : column.align ===
                                                              "center"
                                                            ? "text-center"
                                                            : "text-left"
                                                    }`}
                                                >
                                                    {column.render
                                                        ? column.render(
                                                              (row as any)[
                                                                  column.key
                                                              ],
                                                              row,
                                                              index
                                                          )
                                                        : (row as any)[
                                                              column.key
                                                          ]}
                                                </td>
                                            ))}
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
