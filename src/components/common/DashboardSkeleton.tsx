/**
 * 대시보드 페이지 로딩 스켈레톤 컴포넌트
 */
export default function DashboardSkeleton() {
    return (
        <div className="flex-1 flex flex-col h-full">
            {/* 캘린더 헤더 - 실제처럼 보이게 */}
            <div className="flex items-center justify-between mb-6">
                <div className="h-9 w-48 pl-9" />
                <div className="flex items-center gap-1 pr-9">
                    <div className="h-10 w-10" />
                    <div className="h-10 w-16" />
                    <div className="h-10 w-10" />
                </div>
            </div>

            {/* 캘린더 스켈레톤 */}
            <div className="bg-white flex-1 flex flex-col min-h-0 overflow-visible h-full">
                {/* 요일 헤더 스켈레톤 */}
                <div className="grid grid-cols-7 border-b border-gray-200">
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
                <div className="flex-1 flex flex-col">
                    {Array.from({ length: 6 }).map((_, weekIdx) => (
                        <div
                            key={weekIdx}
                            className="grid grid-cols-7 border-b border-gray-200 last:border-b-0"
                        >
                            {Array.from({ length: 7 }).map((_, dayIdx) => (
                                <div
                                    key={dayIdx}
                                    className="p-3 border-r border-gray-200 last:border-r-0 min-h-[100px]"
                                >
                                    <div className="h-6 w-6 bg-gray-200 rounded-full mb-2 animate-pulse" />
                                    {Math.random() > 0.6 && (
                                        <div
                                            className="h-6 bg-gray-200 rounded mb-1 animate-pulse"
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
