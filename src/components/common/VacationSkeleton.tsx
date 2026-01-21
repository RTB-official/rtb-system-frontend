/**
 * 휴가 관리 페이지 전용 스켈레톤
 */
import { TableSkeleton } from "../../pages/Expense/components/TableSkeleton";

export default function VacationSkeleton() {
    return (
        <div className="flex flex-col gap-4 md:gap-6">
            {/* 4개 카드 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 animate-pulse">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="bg-gray-50 rounded-2xl p-5">
                        <div className="h-4 bg-gray-100 rounded w-16 mb-2"></div>
                        <div className="h-8 bg-gray-100 rounded w-24"></div>
                    </div>
                ))}
            </div>

            {/* 필터 */}
            <div className="flex items-center gap-4 animate-pulse">
                <div className="h-7 bg-gray-100 rounded w-24"></div>
                <div className="h-12 bg-gray-100 rounded-xl w-32"></div>
            </div>

            {/* 탭 */}
            <div className="flex gap-1 border-b border-gray-200 pb-1 animate-pulse">
                <div className="h-10 bg-gray-100 rounded-t w-40"></div>
                <div className="h-10 bg-gray-100 rounded-t w-40"></div>
            </div>

            {/* 테이블 */}
            <div className="bg-white border border-gray-200 rounded-2xl p-4 lg:p-6">
                <TableSkeleton rows={5} />
            </div>
        </div>
    );
}
