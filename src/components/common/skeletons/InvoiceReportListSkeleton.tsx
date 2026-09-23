/**
 * 인보이스 > 보고서 목록 테이블 로딩 스켈레톤
 */
export default function InvoiceReportListSkeleton({
    rows = 10,
}: {
    rows?: number;
}) {
    return (
        <div className="overflow-x-auto" aria-busy="true" aria-label="보고서 불러오는 중">
            <table className="w-full text-[14px] table-fixed text-gray-900">
                <thead className="bg-gray-100 border-b border-gray-200">
                    <tr>
                        <th
                            className="px-4 py-3 font-semibold text-gray-600 text-left"
                            style={{ width: "14%" }}
                        >
                            작성자
                        </th>
                        <th
                            className="px-4 py-3 font-semibold text-gray-600 text-left"
                            style={{ width: "44%" }}
                        >
                            제목
                        </th>
                        <th
                            className="px-4 py-3 font-semibold text-gray-600 text-left"
                            style={{ width: "14%" }}
                        >
                            출장지
                        </th>
                        <th
                            className="px-4 py-3 font-semibold text-gray-600 text-left"
                            style={{ width: "14%" }}
                        >
                            참관감독
                        </th>
                        <th
                            className="px-4 py-3 font-semibold text-gray-600 text-left"
                            style={{ width: "14%" }}
                        >
                            작성일
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {Array.from({ length: rows }).map((_, index) => (
                        <tr
                            key={index}
                            className={`${
                                index % 2 === 0 ? "bg-white" : "bg-gray-50"
                            } border-b border-gray-100`}
                        >
                            <td className="px-4 py-3">
                                <div className="flex items-center gap-2 animate-pulse">
                                    <div className="h-6 w-6 shrink-0 rounded-full bg-gray-200" />
                                    <div className="h-4 w-16 rounded bg-gray-200" />
                                </div>
                            </td>
                            <td className="px-4 py-3">
                                <div className="animate-pulse space-y-1.5">
                                    <div className="h-4 w-[92%] max-w-md rounded bg-gray-200" />
                                    <div className="h-3 w-[55%] max-w-xs rounded bg-gray-200" />
                                </div>
                            </td>
                            <td className="px-4 py-3">
                                <div className="h-4 w-20 rounded bg-gray-200 animate-pulse" />
                            </td>
                            <td className="px-4 py-3">
                                <div className="h-4 w-16 rounded bg-gray-200 animate-pulse" />
                            </td>
                            <td className="px-4 py-3">
                                <div className="h-4 w-24 rounded bg-gray-200 animate-pulse" />
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
