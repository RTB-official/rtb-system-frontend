// 스켈레톤 로딩 컴포넌트
export const TableSkeleton = ({ rows = 2 }: { rows?: number }) => (
    <div className="animate-pulse">
        <div className="space-y-2">
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} className="flex gap-6 py-3">
                    <div className="h-5 bg-gray-200 rounded flex-1"></div>
                    <div className="h-5 bg-gray-200 rounded flex-1"></div>
                    <div className="h-5 bg-gray-200 rounded flex-1"></div>
                    <div className="h-5 bg-gray-200 rounded w-32"></div>
                    <div className="h-5 bg-gray-200 rounded w-32"></div>
                </div>
            ))}
        </div>
    </div>
);
