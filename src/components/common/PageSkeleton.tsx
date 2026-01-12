/**
 * 페이지 전체 로딩 스켈레톤 컴포넌트
 * 재사용 가능한 스켈레톤 컴포넌트들을 조합하여 사용
 */
import {
    SkeletonHeader,
    SkeletonGrid,
    SkeletonCard,
} from "./skeletons";

export default function PageSkeleton() {
    return (
        <div className="space-y-6">
            <SkeletonHeader titleWidth="w-48" subtitleWidth="w-64" />
            <SkeletonGrid cols={2} rows={1} gap="gap-3" itemHeight="h-64" />
            <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                    <SkeletonCard key={i} height="h-24" />
                ))}
            </div>
        </div>
    );
}
