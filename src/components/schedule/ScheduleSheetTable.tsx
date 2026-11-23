import {
    useLayoutEffect,
    useRef,
    useState,
    type HTMLAttributes,
    type ReactNode,
    type Ref,
} from "react";
import {
    SCHEDULE_BASE_MIN_WIDTH,
    SCHEDULE_CELL_BORDER,
    SCHEDULE_EDITABLE_FIELDS,
    SCHEDULE_EXTRA_FIELD_KEYS,
    SCHEDULE_LABEL_BG,
    SCHEDULE_TITLE_BG,
    buildScheduleMergeLookup,
    getScheduleColumns,
    type ScheduleFieldKey,
    type ScheduleFieldMerge,
    type ScheduleSheetRow,
} from "./scheduleTableShared";
import ScheduleTableZoom from "./ScheduleTableZoom";

/** Split text and wrap case-insensitive matches in a yellow mark. */
export function highlightSearchMatches(
    text: string,
    query: string
): ReactNode {
    const q = query.trim();
    if (!q || !text) return text;

    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(${escaped})`, "gi");
    const parts = text.split(re);
    if (parts.length === 1) return text;

    return parts.map((part, i) =>
        i % 2 === 1 ? (
            <mark
                key={i}
                className="rounded-sm bg-yellow-300 px-0.5 text-inherit"
            >
                {part}
            </mark>
        ) : (
            <span key={i}>{part}</span>
        )
    );
}

function CellText({
    value,
    multiline,
    highlightQuery,
}: {
    value: string;
    multiline?: boolean;
    highlightQuery?: string;
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
                {highlightQuery
                    ? highlightSearchMatches(value, highlightQuery)
                    : value}
            </div>
        </div>
    );
}

type ScheduleSheetTableProps = {
    rows: ScheduleSheetRow[];
    /** Visual cell merges (same content across contiguous rows). */
    cellMerges?: ScheduleFieldMerge[];
    /** Highlight matching substrings in cell text (yellow mark). */
    highlightQuery?: string;
    /** Scroll wrapper around the table (used to capture the full sheet). */
    rootRef?: Ref<HTMLDivElement>;
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

const LIST_FIELDS = SCHEDULE_EDITABLE_FIELDS.filter(
    (field) => !(SCHEDULE_EXTRA_FIELD_KEYS as readonly string[]).includes(field)
);
const MULTILINE_FIELDS = new Set<ScheduleFieldKey>(LIST_FIELDS);

/**
 * 일정 목록용 시트 테이블. 출입신청·자재준비 컬럼은 생략한다.
 */
export default function ScheduleSheetTable({
    rows,
    cellMerges = [],
    highlightQuery,
    rootRef,
    renderNoCell,
    renderCell,
    getRowClassName,
    getRowProps,
}: ScheduleSheetTableProps) {
    const mergeLookup = buildScheduleMergeLookup(cellMerges, rows);
    const [baseWidth, setBaseWidth] = useState(SCHEDULE_BASE_MIN_WIDTH);
    const measureRef = useRef<HTMLDivElement>(null);
    const columns = getScheduleColumns(baseWidth, { includeExtra: false });
    const tableWidth = Math.max(SCHEDULE_BASE_MIN_WIDTH, baseWidth);

    useLayoutEffect(() => {
        const el = measureRef.current;
        if (!el) return;
        const update = () => {
            setBaseWidth(Math.max(SCHEDULE_BASE_MIN_WIDTH, el.clientWidth));
        };
        update();
        const observer = new ResizeObserver(update);
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    const defaultCell = (
        row: ScheduleSheetRow,
        field: Exclude<keyof ScheduleSheetRow, "id">
    ) => (
        <CellText
            value={row[field]}
            multiline={MULTILINE_FIELDS.has(field)}
            highlightQuery={highlightQuery}
        />
    );

    return (
        <div ref={measureRef} className="relative w-full">
            <ScheduleTableZoom scrollerRef={rootRef}>
                <table
                    className="border-collapse table-fixed"
                    style={{ width: tableWidth, minWidth: tableWidth }}
                >
                    <colgroup>
                        {columns.map((col) => (
                            <col key={col.key} style={{ width: col.width }} />
                        ))}
                    </colgroup>
                    <thead>
                        <tr>
                            <th
                                colSpan={columns.length}
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
                            {columns
                                .filter(
                                    (col) =>
                                        col.key !== "no" &&
                                        col.key !== "customerCompany" &&
                                        col.key !== "customerContact"
                                )
                                .map((col) => (
                                    <th
                                        key={col.key}
                                        className={`${SCHEDULE_CELL_BORDER} py-2 px-1 text-center text-[11px] md:text-[12px] font-bold whitespace-pre-line leading-tight text-gray-900`}
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
                                    {LIST_FIELDS.map((field) => {
                                        const mergeInfo = mergeLookup.get(`${row.id}__${field}`);
                                        if (mergeInfo === "skip") return null;
                                        const rowspan =
                                            typeof mergeInfo === "object"
                                                ? mergeInfo.rowspan
                                                : undefined;
                                        return (
                                            <td
                                                key={field}
                                                rowSpan={rowspan}
                                                className={`${SCHEDULE_CELL_BORDER} min-h-[72px] p-0 align-middle ${rowClass}`}
                                            >
                                                {cell(field)}
                                            </td>
                                        );
                                    })}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </ScheduleTableZoom>
        </div>
    );
}
