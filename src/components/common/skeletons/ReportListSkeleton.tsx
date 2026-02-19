/**
 * 보고서 목록 페이지 로딩 스켈레톤 컴포넌트
 */
import SkeletonFilter from "./SkeletonFilter";

export default function ReportListSkeleton() {
    return (
        <div className="flex flex-col gap-6 w-full">
            {/* 필터 영역 */}
            <div className="flex flex-wrap items-center gap-4">
                <SkeletonFilter />
                <div className="h-10 w-20 bg-gray-200 rounded-lg animate-pulse" />
            </div>

            {/* 테이블 */}
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-[14px] text-gray-900">
                        <thead className="bg-gray-100 border-b border-gray-200">
                            <tr>
                                {[1, 2, 3, 4, 5, 6].map((i) => (
                                    <th
                                        key={i}
                                        className="px-4 py-3 font-semibold text-gray-600 text-left"
                                    >
                                        <div className="h-4 w-16 bg-gray-300 rounded animate-pulse" />
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {Array.from({ length: 10 }).map((_, index) => (
                                <tr
                                    key={index}
                                    className={`${
                                        index % 2 === 0 ? "bg-white" : "bg-gray-50"
                                    } border-b border-gray-100`}
                                >
                                    {[1, 2, 3, 4, 5, 6].map((i) => (
                                        <td key={i} className="px-4 py-3">
                                            <div className="h-4 bg-gray-200 rounded w-24 animate-pulse" />
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
