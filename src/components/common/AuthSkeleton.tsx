/**
 * 인증 로딩 스켈레톤 컴포넌트
 */
export default function AuthSkeleton() {
    return (
        <div className="flex items-center justify-center min-h-screen">
            <div className="animate-pulse space-y-4 text-center">
                <div className="h-12 w-12 bg-gray-200 rounded-full mx-auto"></div>
                <div className="h-4 bg-gray-200 rounded w-32 mx-auto"></div>
            </div>
        </div>
    );
}
