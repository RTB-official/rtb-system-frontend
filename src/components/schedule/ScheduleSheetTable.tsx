import type { HTMLAttributes, ReactNode } from "react";
import {
    SCHEDULE_CELL_BORDER,
    SCHEDULE_COLUMNS,
    SCHEDULE_LABEL_BG,
    SCHEDULE_TITLE_BG,
    type ScheduleSheetRow,
} from "./scheduleTableShared";

function CellText({
    value,
    multiline,
}: {
    value: string;
    multiline?: boolean;
}) {
    return (
        <div className="flex min-h-[72px] w-full items-center justify-center px-1 py-1">
            <div
                className={`w-full text-[11px] md:text-[12px] text-gray-900 text-center leading-snug ${
                    multiline
                        ? "whitespace-pre-wrap break-words"
                        : "overflow-hidden"
                }`}
            >
                {value}
            </div>
        </div>
    );
}

type ScheduleSheetTableProps = {
    rows: ScheduleSheetRow[];
    /** When set, No. column can be interactive (create page). */
    renderNoCell?: (row: ScheduleSheetRow, index: number) => ReactNode;
    renderCell?: (
        row: ScheduleSheetRow,
        field: Exclude<keyof ScheduleSheetRow, "id">,
        index: number
    ) => ReactNode;
    getRowClassName?: (row: ScheduleSheetRow, index: number) => string;
    getRowProps?: (
        row: ScheduleSheetRow,
        index: number
    ) => HTMLAttributes<HTMLTableRowElement>;
};

const MULTILINE_FIELDS = new Set([
    "customerCompany",
    "customerContact",
    "period",
    "workItem",
    "teamMember",
    "car",
    "remark",
]);

/**
 * Schedule sheet table chrome shared by create (editable cells via renderCell)
 * and list (read-only defaults). Column widths / header styles must stay identical.
 */
export default function ScheduleSheetTable({
    rows,
    renderNoCell,
    renderCell,
    getRowClassName,
    getRowProps,
}: ScheduleSheetTableProps) {
    const defaultCell = (
        row: ScheduleSheetRow,
        field: Exclude<keyof ScheduleSheetRow, "id">
    ) => (
        <CellText
            value={row[field]}
            multiline={MULTILINE_FIELDS.has(field)}
        />
    );

    return (
        <div className="w-full overflow-x-auto rounded-sm bg-white shadow-sm">
            <table className="w-full border-collapse min-w-[1280px] table-fixed">
                <colgroup>
                    {SCHEDULE_COLUMNS.map((col) => (
                        <col key={col.key} style={{ width: col.width }} />
                    ))}
                </colgroup>
                <thead>
                    <tr>
                        <th
                            colSpan={SCHEDULE_COLUMNS.length}
                            className={`${SCHEDULE_CELL_BORDER} py-2.5 px-2 text-center text-[14px] md:text-[15px] font-bold text-gray-900`}
                            style={{ backgroundColor: SCHEDULE_TITLE_BG }}
                        >
                            Confirmed service work
                        </th>
                    </tr>
                    <tr>
                        <th
                            className={`${SCHEDULE_CELL_BORDER} py-2 px-1 text-center text-[11px] md:text-[12px] font-bold text-gray-900`}
                            style={{ backgroundColor: SCHEDULE_LABEL_BG }}
                        >
                            No.
                        </th>
                        <th
                            colSpan={2}
                            className={`${SCHEDULE_CELL_BORDER} py-2 px-1 text-center text-[11px] md:text-[12px] font-bold text-gray-900`}
                            style={{ backgroundColor: SCHEDULE_LABEL_BG }}
                        >
                            Customer
                        </th>
                        {SCHEDULE_COLUMNS.filter(
                            (col) =>
                                col.key !== "no" &&
                                col.key !== "customerCompany" &&
                                col.key !== "customerContact"
                        ).map((col) => (
                            <th
                                key={col.key}
                                className={`${SCHEDULE_CELL_BORDER} py-2 px-1 text-center text-[11px] md:text-[12px] font-bold text-gray-900 whitespace-pre-line leading-tight`}
                                style={{ backgroundColor: SCHEDULE_LABEL_BG }}
                            >
                                {col.label}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, index) => {
                        const rowClass = getRowClassName?.(row, index) ?? "bg-white";
                        const rowProps = getRowProps?.(row, index) ?? {};
                        const cell = (field: Exclude<keyof ScheduleSheetRow, "id">) =>
                            renderCell?.(row, field, index) ?? defaultCell(row, field);

                        return (
                            <tr key={`${index}-${row.id}`} className={rowClass} {...rowProps}>
                                <td
                                    className={`${SCHEDULE_CELL_BORDER} min-h-[72px] p-0 text-center align-middle text-[11px] md:text-[12px] text-gray-900 font-medium ${rowClass}`}
                                >
                                    {renderNoCell?.(row, index) ?? (
                                        <div className="flex min-h-[72px] w-full items-center justify-center px-1">
                                            <span>{index + 1}</span>
                                        </div>
                                    )}
                                </td>
                                <td
                                    className={`${SCHEDULE_CELL_BORDER} min-h-[72px] p-0 align-middle ${rowClass}`}
                                >
                                    {cell("customerCompany")}
                                </td>
                                <td
                                    className={`${SCHEDULE_CELL_BORDER} min-h-[72px] p-0 align-middle ${rowClass}`}
                                >
                                    {cell("customerContact")}
                                </td>
                                <td
                                    className={`${SCHEDULE_CELL_BORDER} min-h-[72px] p-0 align-middle ${rowClass}`}
                                >
                                    {cell("shipName")}
                                </td>
                                <td
                                    className={`${SCHEDULE_CELL_BORDER} min-h-[72px] p-0 align-middle ${rowClass}`}
                                >
                                    {cell("engineType")}
                                </td>
                                <td
                                    className={`${SCHEDULE_CELL_BORDER} min-h-[72px] p-0 align-middle ${rowClass}`}
                                >
                                    {cell("workLocation")}
                                </td>
                                <td
                                    className={`${SCHEDULE_CELL_BORDER} min-h-[72px] p-0 align-middle ${rowClass}`}
                                >
                                    {cell("period")}
                                </td>
                                <td
                                    className={`${SCHEDULE_CELL_BORDER} min-h-[72px] p-0 align-middle ${rowClass}`}
                                >
                                    {cell("workItem")}
                                </td>
                                <td
                                    className={`${SCHEDULE_CELL_BORDER} min-h-[72px] p-0 align-middle ${rowClass}`}
                                >
                                    {cell("manpower")}
                                </td>
                                <td
                                    className={`${SCHEDULE_CELL_BORDER} min-h-[72px] p-0 align-middle ${rowClass}`}
                                >
                                    {cell("teamMember")}
                                </td>
                                <td
                                    className={`${SCHEDULE_CELL_BORDER} min-h-[72px] p-0 align-middle ${rowClass}`}
                                >
                                    {cell("car")}
                                </td>
                                <td
                                    className={`${SCHEDULE_CELL_BORDER} min-h-[72px] p-0 align-middle ${rowClass}`}
                                >
                                    {cell("yardPic")}
                                </td>
                                <td
                                    className={`${SCHEDULE_CELL_BORDER} min-h-[72px] p-0 align-middle ${rowClass}`}
                                >
                                    {cell("remark")}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
