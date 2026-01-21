/**
 * 그리드 스켈레톤 컴포넌트
 */
interface SkeletonGridProps {
    cols?: number;
    rows?: number;
    gap?: string;
    itemHeight?: string;
    className?: string;
}

export default function SkeletonGrid({
    cols = 2,
    rows = 1,
    gap = "gap-4",
    itemHeight = "h-64",
    className = "",
}: SkeletonGridProps) {
    const gridColsClass = {
        1: "grid-cols-1",
        2: "grid-cols-1 lg:grid-cols-2",
        3: "grid-cols-1 lg:grid-cols-3",
        4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
    }[cols] || "grid-cols-1 lg:grid-cols-2";

    return (
        <div className={`animate-pulse grid ${gridColsClass} ${gap} ${className}`}>
            {Array.from({ length: cols * rows }).map((_, i) => (
                <div
                    key={i}
                    className={`bg-gray-100 rounded-2xl ${itemHeight}`}
                ></div>
            ))}
        </div>
    );
}
