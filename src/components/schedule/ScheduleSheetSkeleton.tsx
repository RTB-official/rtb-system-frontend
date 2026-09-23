import {
    SCHEDULE_CELL_BORDER,
    SCHEDULE_COLUMNS,
    SCHEDULE_LABEL_BG,
    SCHEDULE_TITLE_BG,
} from "./scheduleTableShared";

function SkeletonBar({ className = "" }: { className?: string }) {
    return (
        <div
            className={`mx-auto rounded-md bg-gray-300 animate-pulse ${className}`}
            aria-hidden
        />
    );
}

function SkeletonCell({ wide }: { wide?: boolean }) {
    return (
        <td className={`${SCHEDULE_CELL_BORDER} min-h-[72px] p-0 align-middle bg-white`}>
            <div className="flex min-h-[72px] w-full flex-col items-center justify-center gap-2 px-2 py-3">
                <SkeletonBar className={`h-3.5 ${wide ? "w-[88%]" : "w-[72%]"}`} />
                {wide ? <SkeletonBar className="h-3.5 w-[58%]" /> : null}
            </div>
        </td>
    );
}

type ScheduleSheetSkeletonProps = {
    /** Number of placeholder body rows */
    rowCount?: number;
};

/** Table-shaped skeleton matching schedule sheet layout (create/list). */
export default function ScheduleSheetSkeleton({
    rowCount = 5,
}: ScheduleSheetSkeletonProps) {
    const rows = Math.max(1, rowCount);

    return (
        <div
            className="w-full overflow-x-auto rounded-sm bg-white shadow-sm"
            aria-busy="true"
            aria-label="일정 불러오는 중"
        >
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
                    {Array.from({ length: rows }, (_, index) => (
                        <tr key={index} className="bg-white">
                            <td
                                className={`${SCHEDULE_CELL_BORDER} min-h-[72px] p-0 align-middle bg-white`}
                            >
                                <div className="flex min-h-[72px] w-full items-center justify-center px-1">
                                    <SkeletonBar className="h-3 w-4" />
                                </div>
                            </td>
                            <SkeletonCell />
                            <SkeletonCell />
                            <SkeletonCell />
                            <SkeletonCell wide />
                            <SkeletonCell />
                            <SkeletonCell />
                            <SkeletonCell wide />
                            <SkeletonCell />
                            <SkeletonCell wide />
                            <SkeletonCell />
                            <SkeletonCell />
                            <SkeletonCell wide />
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
