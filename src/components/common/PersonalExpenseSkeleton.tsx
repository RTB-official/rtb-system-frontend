/**
 * 개인 지출 기록 페이지 전용 스켈레톤
 */
import {
    SkeletonHeader,
    SkeletonFilter,
    SkeletonGrid,
    SkeletonCard,
} from "./skeletons";

export default function PersonalExpenseSkeleton() {
    return (
        <div className="space-y-4">
            {/* 조회 기간 */}
            <SkeletonFilter labelWidth="w-24" selectWidth="w-32" />

            {/* 마일리지 카드 & 지출 카드 */}
            <SkeletonGrid cols={2} rows={1} gap="gap-3" itemHeight="h-auto" />

            {/* 히스토리 섹션 */}
            <SkeletonGrid cols={2} rows={1} gap="gap-3" itemHeight="h-64" />
        </div>
    );
}
