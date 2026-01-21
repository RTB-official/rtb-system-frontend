/**
 * SectionCard 스켈레톤 컴포넌트
 */
interface SkeletonSectionCardProps {
    title?: string;
    children: React.ReactNode;
    className?: string;
}

export default function SkeletonSectionCard({
    title,
    children,
    className = "",
}: SkeletonSectionCardProps) {
    return (
        <div className={`bg-white border border-gray-200 rounded-2xl p-4 lg:p-6 ${className}`}>
            {title && (
                <div className="animate-pulse mb-4">
                    <div className="h-6 bg-gray-100 rounded w-40"></div>
                </div>
            )}
            {children}
        </div>
    );
}
