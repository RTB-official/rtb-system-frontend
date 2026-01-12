/**
 * 헤더 스켈레톤 컴포넌트
 */
interface SkeletonHeaderProps {
    titleWidth?: string;
    subtitleWidth?: string;
    className?: string;
}

export default function SkeletonHeader({
    titleWidth = "w-48",
    subtitleWidth = "w-64",
    className = "",
}: SkeletonHeaderProps) {
    return (
        <div className={`animate-pulse space-y-4 ${className}`}>
            <div className={`h-8 bg-gray-100 rounded ${titleWidth}`}></div>
            {subtitleWidth && (
                <div className={`h-6 bg-gray-100 rounded ${subtitleWidth}`}></div>
            )}
        </div>
    );
}
