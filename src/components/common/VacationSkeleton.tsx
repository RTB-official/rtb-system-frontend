/**
 * 휴가 관리 페이지 전용 스켈레톤
 */
import {
    SkeletonGrid,
    SkeletonFilter,
    SkeletonTabs,
} from "./skeletons";
import { TableSkeleton } from "../../pages/Expense/components/TableSkeleton";

export default function VacationSkeleton() {
    return (
        <div className="space-y-4 md:space-y-6">
            {/* 4개 카드 */}
            <SkeletonGrid cols={4} rows={1} gap="gap-3 md:gap-4" itemHeight="h-auto" />

            {/* 필터 */}
            <SkeletonFilter labelWidth="w-24" selectWidth="w-32" />

            {/* 탭 */}
            <SkeletonTabs count={2} tabWidth="w-40" />

            {/* 테이블 */}
            <TableSkeleton rows={5} />
        </div>
    );
}
