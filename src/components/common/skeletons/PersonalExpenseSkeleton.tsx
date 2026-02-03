/**
 * 개인 지출 기록 페이지 전용 스켈레톤
 */
import SkeletonSectionCard from "./SkeletonSectionCard";

export default function PersonalExpenseSkeleton() {
    return (
        <div className="space-y-4">
            {/* 조회 기간 */}
            <div className="mb-4 flex flex-wrap items-center gap-4 animate-pulse">
                <div className="h-7 bg-gray-100 rounded w-24"></div>
                <div className="h-10 bg-gray-100 rounded-xl w-32"></div>
                <div className="h-10 bg-gray-100 rounded-xl w-28"></div>
            </div>

            {/* 마일리지 카드 & 지출 카드 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3 items-stretch w-full">
                <SkeletonSectionCard title="개인 차량 마일리지">
                    <div className="space-y-4 animate-pulse">
                        <div className="space-y-3">
                            <div className="h-4 bg-gray-100 rounded w-20"></div>
                            <div className="h-12 bg-gray-100 rounded-xl"></div>
                        </div>
                        <div className="space-y-3">
                            <div className="h-4 bg-gray-100 rounded w-16"></div>
                            <div className="flex gap-2">
                                <div className="h-10 bg-gray-100 rounded-xl flex-1"></div>
                                <div className="h-10 bg-gray-100 rounded-xl flex-1"></div>
                            </div>
                        </div>
                        <div className="space-y-3">
                            <div className="h-4 bg-gray-100 rounded w-12"></div>
                            <div className="h-12 bg-gray-100 rounded-xl"></div>
                        </div>
                        <div className="h-12 bg-gray-100 rounded-xl"></div>
                    </div>
                </SkeletonSectionCard>

                <SkeletonSectionCard title="개인 카드/현금 지출">
                    <div className="space-y-4 animate-pulse">
                        <div className="space-y-3">
                            <div className="h-4 bg-gray-100 rounded w-16"></div>
                            <div className="h-12 bg-gray-100 rounded-xl"></div>
                        </div>
                        <div className="space-y-3">
                            <div className="h-4 bg-gray-100 rounded w-12"></div>
                            <div className="h-12 bg-gray-100 rounded-xl"></div>
                        </div>
                        <div className="space-y-3">
                            <div className="h-4 bg-gray-100 rounded w-20"></div>
                            <div className="h-12 bg-gray-100 rounded-xl"></div>
                        </div>
                        <div className="space-y-3">
                            <div className="h-4 bg-gray-100 rounded w-24"></div>
                            <div className="h-12 bg-gray-100 rounded-xl"></div>
                        </div>
                        <div className="h-12 bg-gray-100 rounded-xl"></div>
                    </div>
                </SkeletonSectionCard>
            </div>

            {/* 히스토리 섹션 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start w-full">
                <SkeletonSectionCard title="개인 차량 마일리지 내역">
                    <div className="space-y-3 animate-pulse">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="space-y-2 p-4 border border-gray-200 rounded-xl">
                                <div className="flex items-center justify-between">
                                    <div className="h-4 bg-gray-100 rounded w-32"></div>
                                    <div className="h-4 bg-gray-100 rounded w-20"></div>
                                </div>
                                <div className="h-4 bg-gray-100 rounded w-24"></div>
                                <div className="h-4 bg-gray-100 rounded w-40"></div>
                            </div>
                        ))}
                    </div>
                </SkeletonSectionCard>

                <SkeletonSectionCard title="개인 카드/현금 지출 내역">
                    <div className="space-y-3 animate-pulse">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="space-y-2 p-4 border border-gray-200 rounded-xl">
                                <div className="flex items-center justify-between">
                                    <div className="h-4 bg-gray-100 rounded w-32"></div>
                                    <div className="h-4 bg-gray-100 rounded w-20"></div>
                                </div>
                                <div className="h-4 bg-gray-100 rounded w-24"></div>
                                <div className="h-4 bg-gray-100 rounded w-40"></div>
                            </div>
                        ))}
                    </div>
                </SkeletonSectionCard>
            </div>
        </div>
    );
}
