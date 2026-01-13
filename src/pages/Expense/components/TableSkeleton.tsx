// 스켈레톤 로딩 컴포넌트
export const TableSkeleton = ({ rows = 2 }: { rows?: number }) => (
    <div className="animate-pulse">
        <div className="space-y-2">
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} className="flex gap-4 py-2.5">
                    <div className="h-4 bg-gray-100 rounded flex-1"></div>
                    <div className="h-4 bg-gray-100 rounded flex-1"></div>
                    <div className="h-4 bg-gray-100 rounded flex-1"></div>
                    <div className="h-4 bg-gray-100 rounded w-24"></div>
                    <div className="h-4 bg-gray-100 rounded w-24"></div>
                </div>
            ))}
        </div>
    </div>
);
