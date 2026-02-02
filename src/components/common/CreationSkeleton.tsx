/**
 * 출장 보고서 작성 페이지 로딩 스켈레톤 컴포넌트
 */
import SkeletonSectionCard from "./SkeletonSectionCard";

export default function CreationSkeleton() {
    return (
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 md:px-12 lg:px-24 xl:px-48 py-6 md:py-9">
            <div className="max-w-[960px] mx-auto flex flex-col gap-4 md:gap-6">
                {/* 기본 정보 */}
                <SkeletonSectionCard title="기본 정보">
                    <div className="space-y-4">
                        <div className="h-12 bg-gray-100 rounded-xl animate-pulse"></div>
                        <div className="h-12 bg-gray-100 rounded-xl animate-pulse"></div>
                        <div className="h-12 bg-gray-100 rounded-xl animate-pulse"></div>
                    </div>
                </SkeletonSectionCard>

                {/* 작업자 */}
                <SkeletonSectionCard title="작업자">
                    <div className="space-y-3">
                        <div className="h-10 bg-gray-100 rounded-xl animate-pulse"></div>
                        <div className="flex flex-wrap gap-2">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <div key={i} className="h-8 w-20 bg-gray-100 rounded-lg animate-pulse"></div>
                            ))}
                        </div>
                    </div>
                </SkeletonSectionCard>

                {/* 출장 업무 일지 */}
                <SkeletonSectionCard title="출장 업무 일지">
                    <div className="space-y-4">
                        {Array.from({ length: 2 }).map((_, i) => (
                            <div key={i} className="h-32 bg-gray-100 rounded-xl animate-pulse"></div>
                        ))}
                    </div>
                </SkeletonSectionCard>

                {/* 경비 내역 */}
                <SkeletonSectionCard title="경비 내역">
                    <div className="space-y-3">
                        <div className="h-10 bg-gray-100 rounded-xl animate-pulse"></div>
                        <div className="h-24 bg-gray-100 rounded-xl animate-pulse"></div>
                    </div>
                </SkeletonSectionCard>

                {/* 소모품 사용량 */}
                <SkeletonSectionCard title="소모품 사용량">
                    <div className="space-y-3">
                        <div className="h-10 bg-gray-100 rounded-xl animate-pulse"></div>
                        <div className="flex flex-wrap gap-2">
                            {Array.from({ length: 3 }).map((_, i) => (
                                <div key={i} className="h-8 w-24 bg-gray-100 rounded-lg animate-pulse"></div>
                            ))}
                        </div>
                    </div>
                </SkeletonSectionCard>

                {/* 첨부파일 업로드 */}
                <SkeletonSectionCard title="첨부파일 업로드">
                    <div className="space-y-3">
                        <div className="h-32 bg-gray-100 rounded-xl animate-pulse"></div>
                    </div>
                </SkeletonSectionCard>

                {/* 타임라인 요약 */}
                <SkeletonSectionCard title="타임라인 요약">
                    <div className="space-y-3">
                        <div className="h-64 bg-gray-100 rounded-xl animate-pulse"></div>
                    </div>
                </SkeletonSectionCard>
            </div>
        </div>
    );
}
