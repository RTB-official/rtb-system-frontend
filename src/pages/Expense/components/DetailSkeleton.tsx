import { TableSkeleton } from "./TableSkeleton";

export const DetailSkeleton = () => (
    <div className="animate-pulse space-y-6">
        {/* 헤더 스켈레톤 */}
        <div className="flex items-center justify-between">
            <div className="space-y-3">
                <div className="h-4 bg-gray-100 rounded w-36"></div>
                <div className="h-6 bg-gray-100 rounded w-56"></div>
            </div>
            <div className="h-10 bg-gray-100 rounded w-36"></div>
        </div>

        {/* 탭 스켈레톤 */}
        <div className="flex gap-1 border-b border-gray-200 pb-1">
            <div className="h-10 bg-gray-100 rounded-t w-44"></div>
            <div className="h-10 bg-gray-100 rounded-t w-44"></div>
        </div>

        {/* 테이블 스켈레톤 */}
        <TableSkeleton rows={3} />
    </div>
);
