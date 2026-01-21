/**
 * 관리자 휴가 관리 페이지 로딩 스켈레톤 컴포넌트
 */
import { TableSkeleton } from "../../pages/Expense/components/TableSkeleton";

export default function AdminVacationSkeleton() {
    return (
        <div className="flex flex-col gap-6 w-full">
            {/* 통계 카드 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="bg-gray-50 rounded-2xl p-5">
                        <div className="h-4 bg-gray-200 rounded animate-pulse mb-2" />
                        <div className="h-8 bg-gray-200 rounded animate-pulse" />
                    </div>
                ))}
            </div>

            {/* 연도 선택 */}
            <div className="flex items-center gap-4">
                <div className="h-7 w-24 bg-gray-200 rounded animate-pulse" />
                <div className="h-12 w-32 bg-gray-200 rounded-xl animate-pulse" />
            </div>

            {/* 직원 선택 */}
            <div className="flex items-center gap-4">
                <div className="h-7 w-32 bg-gray-200 rounded animate-pulse" />
                <div className="h-12 w-48 bg-gray-200 rounded-xl animate-pulse" />
            </div>

            {/* 테이블 */}
            <div className="bg-white border border-gray-200 rounded-2xl p-4 lg:p-6">
                <TableSkeleton rows={10} />
            </div>
        </div>
    );
}
