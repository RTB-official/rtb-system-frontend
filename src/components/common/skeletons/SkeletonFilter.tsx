/**
 * 필터 스켈레톤 컴포넌트
 */
interface SkeletonFilterProps {
    labelWidth?: string;
    selectWidth?: string;
    className?: string;
}

export default function SkeletonFilter({
    labelWidth = "w-24",
    selectWidth = "w-32",
    className = "",
}: SkeletonFilterProps) {
    return (
        <div className={`animate-pulse flex items-center gap-4 ${className}`}>
            <div className={`h-6 bg-gray-100 rounded ${labelWidth}`}></div>
            <div className={`h-10 bg-gray-100 rounded-xl ${selectWidth}`}></div>
        </div>
    );
}
