/**
 * 탭 스켈레톤 컴포넌트
 */
interface SkeletonTabsProps {
    count?: number;
    tabWidth?: string;
    className?: string;
}

export default function SkeletonTabs({
    count = 2,
    tabWidth = "w-44",
    className = "",
}: SkeletonTabsProps) {
    return (
        <div className={`animate-pulse flex gap-1 border-b border-gray-200 pb-1 ${className}`}>
            {Array.from({ length: count }).map((_, i) => (
                <div
                    key={i}
                    className={`h-10 bg-gray-100 rounded-t ${tabWidth}`}
                ></div>
            ))}
        </div>
    );
}
