/**
 * 카드 스켈레톤 컴포넌트
 */
interface SkeletonCardProps {
    height?: string;
    className?: string;
}

export default function SkeletonCard({
    height = "h-64",
    className = "",
}: SkeletonCardProps) {
    return (
        <div
            className={`animate-pulse bg-gray-100 rounded-2xl ${height} ${className}`}
        />
    );
}
