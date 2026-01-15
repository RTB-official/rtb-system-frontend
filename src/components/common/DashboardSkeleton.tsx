/**
 * 대시보드 페이지 로딩 스켈레톤 컴포넌트
 */
export default function DashboardSkeleton() {
    return (
        <div className="flex flex-col gap-6">
            {/* 네비게이션 */}
            <div className="flex items-center justify-between mb-4">
                <div className="h-8 w-32 bg-gray-200 rounded animate-pulse" />
                <div className="flex gap-2">
                    <div className="h-10 w-10 bg-gray-200 rounded-lg animate-pulse" />
                    <div className="h-10 w-10 bg-gray-200 rounded-lg animate-pulse" />
                </div>
            </div>

            {/* 캘린더 그리드 */}
            <div className="bg-white border border-gray-200 rounded-2xl p-7">
                <div className="mb-6">
                    <div className="h-7 w-40 bg-gray-200 rounded animate-pulse" />
                </div>
                
                {/* 요일 헤더 */}
                <div className="grid grid-cols-7 gap-2 mb-2">
                    {Array.from({ length: 7 }).map((_, i) => (
                        <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />
                    ))}
                </div>

                {/* 날짜 그리드 */}
                <div className="grid grid-cols-7 gap-2">
                    {Array.from({ length: 35 }).map((_, i) => (
                        <div
                            key={i}
                            className="aspect-square bg-gray-50 rounded-lg border border-gray-200 p-2"
                        >
                            <div className="h-5 w-5 bg-gray-200 rounded animate-pulse mb-2" />
                            <div className="space-y-1">
                                <div className="h-4 bg-gray-200 rounded animate-pulse" />
                                <div className="h-4 bg-gray-200 rounded animate-pulse" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

