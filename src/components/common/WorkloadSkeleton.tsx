/**
 * 워크로드 페이지 로딩 스켈레톤 컴포넌트
 */
import SkeletonCard from "./skeletons/SkeletonCard";
import SkeletonFilter from "./skeletons/SkeletonFilter";

export default function WorkloadSkeleton() {
    return (
        <div className="flex flex-col gap-6 w-full">
            {/* 조회 기간 */}
            <SkeletonFilter />

            {/* 인원별 작업시간 차트 */}
            <div className="bg-white border border-gray-200 rounded-2xl p-7">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                    <div className="h-7 w-32 bg-gray-200 rounded animate-pulse" />
                    <div className="flex items-center gap-5">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="flex items-center gap-1.5">
                                <div className="w-4 h-4 rounded bg-gray-200 animate-pulse" />
                                <div className="h-4 w-8 bg-gray-200 rounded animate-pulse" />
                            </div>
                        ))}
                    </div>
                </div>
                <div className="h-[300px] w-full bg-gray-100 rounded-xl animate-pulse" />
            </div>

            {/* 상세 데이터 테이블 */}
            <div className="bg-white border border-gray-200 rounded-2xl p-7">
                <div className="mb-6">
                    <div className="h-7 w-24 bg-gray-200 rounded animate-pulse mb-1" />
                    <div className="h-4 w-48 bg-gray-200 rounded animate-pulse" />
                </div>
                <div className="space-y-3">
                    {Array.from({ length: 10 }).map((_, i) => (
                        <div
                            key={i}
                            className="flex items-center gap-4 p-4 border border-gray-200 rounded-xl"
                        >
                            <div className="h-5 w-20 bg-gray-200 rounded animate-pulse" />
                            <div className="h-5 w-24 bg-gray-200 rounded animate-pulse" />
                            <div className="h-5 w-24 bg-gray-200 rounded animate-pulse" />
                            <div className="h-5 w-24 bg-gray-200 rounded animate-pulse" />
                            <div className="h-5 w-16 bg-gray-200 rounded animate-pulse" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

