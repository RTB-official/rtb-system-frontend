type ReportMemoBadgeProps = {
    memo: string | null | undefined;
    memoReadAt: string | null | undefined;
    className?: string;
    onClick?: () => void;
};

/**
 * 메모가 있으면 좌상단이 접힌 노란 메모장 아이콘을 표시하고,
 * 읽은 시간이 없으면 상단 구석에 빨간 점을 표시합니다.
 */
export default function ReportMemoBadge({
    memo,
    memoReadAt,
    className = "",
    onClick,
}: ReportMemoBadgeProps) {
    const hasMemo = Boolean(memo?.trim());
    if (!hasMemo) return null;

    const isUnread = !memoReadAt;
    const label = isUnread ? "읽지 않은 메모" : "메모";

    return (
        <button
            type="button"
            className={`relative inline-flex shrink-0 rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 ${className}`}
            title={label}
            aria-label={label}
            onClick={(e) => {
                e.stopPropagation();
                onClick?.();
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
        >
            <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
            >
                {/* 메모장 본체 */}
                <path
                    d="M5.5 2.5H16.5C17.0523 2.5 17.5 2.94772 17.5 3.5V16.5C17.5 17.0523 17.0523 17.5 16.5 17.5H3.5C2.94772 17.5 2.5 17.0523 2.5 16.5V5.5L5.5 2.5Z"
                    fill="#FDE047"
                    stroke="#EAB308"
                    strokeWidth="1"
                    strokeLinejoin="round"
                />
                {/* 좌상단 접힌 모서리 */}
                <path
                    d="M2.5 5.5H5.5V2.5L2.5 5.5Z"
                    fill="#FEF9C3"
                    stroke="#EAB308"
                    strokeWidth="1"
                    strokeLinejoin="round"
                />
                {/* 접힌 면 그림자 라인 */}
                <path
                    d="M2.5 5.5H5.5V2.5"
                    stroke="#CA8A04"
                    strokeWidth="0.75"
                    strokeLinejoin="round"
                    fill="none"
                />
                {/* 메모 줄 무늬 */}
                <path
                    d="M7 8.5H14.5M7 11.5H14.5M7 14.5H12"
                    stroke="#CA8A04"
                    strokeWidth="1"
                    strokeLinecap="round"
                    opacity="0.45"
                />
            </svg>

            {isUnread && (
                <span
                    className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white"
                    aria-hidden="true"
                />
            )}
        </button>
    );
}
