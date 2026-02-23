// src/components/board/BoardEditSkeleton.tsx
import SkeletonSectionCard from "../common/skeletons/SkeletonSectionCard";

/** 게시글 수정 페이지 로딩 스켈레톤 */
export default function BoardEditSkeleton() {
    return (
        <SkeletonSectionCard title="글 수정">
            <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <div className="h-4 w-12 rounded bg-gray-100 animate-pulse mb-2" />
                        <div className="h-12 w-full rounded-xl bg-gray-100 animate-pulse" />
                    </div>
                    <div>
                        <div className="h-4 w-16 rounded bg-gray-100 animate-pulse mb-2" />
                        <div className="h-12 w-full rounded-xl bg-gray-100 animate-pulse" />
                    </div>
                </div>
                <div>
                    <div className="h-4 w-8 rounded bg-gray-100 animate-pulse mb-2" />
                    <div className="h-12 w-full rounded-xl bg-gray-100 animate-pulse" />
                </div>
                <div>
                    <div className="h-4 w-12 rounded bg-gray-100 animate-pulse mb-2" />
                    <div className="h-32 w-full rounded-xl bg-gray-100 animate-pulse" />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                    <div className="h-10 w-16 rounded-lg bg-gray-100 animate-pulse" />
                    <div className="h-10 w-14 rounded-lg bg-gray-100 animate-pulse" />
                </div>
            </div>
        </SkeletonSectionCard>
    );
}
