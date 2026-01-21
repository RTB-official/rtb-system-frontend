/**
 * 대시보드 페이지 로딩 스켈레톤 컴포넌트
 */
export default function DashboardSkeleton() {
    return (
        <div className="flex-1 flex flex-col min-h-0">
            {/* 캘린더 헤더 - 실제처럼 보이게 */}
            <div className="flex items-center justify-between mb-6 shrink-0 px-9">
                <div className="h-9 w-48 bg-gray-200 rounded animate-pulse" />
                <div className="flex items-center gap-1">
                    <div className="h-9 w-9 bg-gray-200 rounded animate-pulse" />
                    <div className="h-9 w-12 bg-gray-200 rounded animate-pulse" />
                    <div className="h-9 w-9 bg-gray-200 rounded animate-pulse" />
                </div>
            </div>

            {/* 캘린더 스켈레톤 */}
            <div className="bg-white flex-1 flex flex-col min-h-0 overflow-hidden">
                {/* 요일 헤더 스켈레톤 */}
                <div className="grid grid-cols-7 border-b border-gray-200 shrink-0">
                    {Array.from({ length: 7 }).map((_, i) => (
                        <div
                            key={i}
                            className="py-3 px-4 border-r border-gray-200 last:border-r-0"
                        >
                            <div className="h-5 w-8 bg-gray-200 rounded animate-pulse" />
                        </div>
                    ))}
                </div>

                {/* 날짜 그리드 스켈레톤 */}
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                    {Array.from({ length: 6 }).map((_, weekIdx) => (
                        <div
                            key={weekIdx}
                            className="grid grid-cols-7 border-b border-gray-200 last:border-b-0 flex-1"
                        >
                            {Array.from({ length: 7 }).map((_, dayIdx) => (
                                <div
                                    key={dayIdx}
                                    className="p-3 border-r border-gray-200 last:border-r-0 flex flex-col"
                                >
                                    <div className="h-6 w-6 bg-gray-200 rounded-full mb-2 animate-pulse shrink-0" />
                                    {Math.random() > 0.6 && (
                                        <div
                                            className="h-6 bg-gray-200 rounded mb-1 animate-pulse shrink-0"
                                            style={{
                                                width: `${
                                                    60 + Math.random() * 30
                                                }%`,
                                            }}
                                        />
                                    )}
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
