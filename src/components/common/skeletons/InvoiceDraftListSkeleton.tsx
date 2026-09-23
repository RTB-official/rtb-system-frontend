/**
 * 인보이스 > 저장 목록(호선 카드 그리드) 로딩 스켈레톤
 */
export default function InvoiceDraftListSkeleton({
    count = 8,
}: {
    count?: number;
}) {
    return (
        <div
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
            aria-busy="true"
            aria-label="저장 목록 불러오는 중"
        >
            {Array.from({ length: count }).map((_, index) => (
                <div
                    key={index}
                    className="flex min-w-0 flex-col rounded-2xl border border-gray-200 bg-white px-4 py-4 shadow-sm"
                >
                    <div className="h-5 w-[70%] rounded bg-gray-200 animate-pulse" />
                    <div className="mt-2 h-3 w-[55%] rounded bg-gray-200 animate-pulse" />
                </div>
            ))}
        </div>
    );
}
