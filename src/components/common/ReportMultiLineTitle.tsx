import { OTHER_LINE_BADGE_CLASS } from "../../utils/otherLineWorkNote";

type ReportMultiLineTitleProps = {
    title?: string | null;
    badge?: string | null;
    /** 모바일 카드 등 제목 여러 줄 허용 */
    clamp?: boolean;
    className?: string;
};

/** 보고서 제목 + 복수호선 배지 (제목 우측 끝) */
export default function ReportMultiLineTitle({
    title,
    badge,
    clamp = false,
    className = "",
}: ReportMultiLineTitleProps) {
    return (
        <div className={`flex items-center justify-between gap-2 min-w-0 w-full ${className}`}>
            <span
                className={`min-w-0 text-gray-900 ${
                    clamp
                        ? "line-clamp-2 break-words flex-1 text-[13px] md:text-[16px] font-semibold"
                        : "truncate"
                }`}
            >
                {title?.trim() ? title : "—"}
            </span>
            {badge ? (
                <span className={`${OTHER_LINE_BADGE_CLASS} shrink-0`}>
                    {badge}
                </span>
            ) : null}
        </div>
    );
}
