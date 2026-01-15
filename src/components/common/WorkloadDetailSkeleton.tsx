/**
 * 워크로드 상세 페이지 로딩 스켈레톤 컴포넌트
 */
import SkeletonCard from "./skeletons/SkeletonCard";
import SkeletonFilter from "./skeletons/SkeletonFilter";

export default function WorkloadDetailSkeleton() {
    return (
        <div className="flex flex-col gap-6 w-full">
            {/* 요약 카드 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="bg-gray-50 rounded-2xl p-5">
                        <div className="h-6 bg-gray-200 rounded animate-pulse mb-2" />
                        <div className="h-8 bg-gray-200 rounded animate-pulse" />
                    </div>
                ))}
            </div>

            {/* 조회 기간 */}
            <SkeletonFilter />

            {/* 날짜별 세부 분석 테이블 */}
            <div className="bg-white border border-gray-200 rounded-2xl p-7">
                <div className="h-7 w-32 bg-gray-200 rounded animate-pulse mb-6" />
                <div className="space-y-3">
                    {Array.from({ length: 10 }).map((_, i) => (
                        <div
                            key={i}
                            className="flex items-center gap-4 p-4 border border-gray-200 rounded-xl"
                        >
                            <div className="h-5 w-32 bg-gray-200 rounded animate-pulse" />
                            <div className="h-5 w-24 bg-gray-200 rounded animate-pulse" />
                            <div className="h-5 w-20 bg-gray-200 rounded animate-pulse" />
                            <div className="h-5 w-32 bg-gray-200 rounded animate-pulse" />
                            <div className="h-5 w-24 bg-gray-200 rounded animate-pulse" />
                            <div className="h-5 w-24 bg-gray-200 rounded animate-pulse" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

