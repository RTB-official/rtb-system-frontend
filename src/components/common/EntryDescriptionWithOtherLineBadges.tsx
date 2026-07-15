import {
    OTHER_LINE_BADGE_CLASS,
    splitOtherLineNotesFromText,
} from "../../utils/otherLineWorkNote";

type EntryDescriptionWithOtherLineBadgesProps = {
    text?: string | null;
    emptyFallback?: string;
    className?: string;
};

/** 상세/특이사항 텍스트 + 다른호선 작업 보라 배지 */
export default function EntryDescriptionWithOtherLineBadges({
    text,
    emptyFallback = "-",
    className = "",
}: EntryDescriptionWithOtherLineBadgesProps) {
    const { plainText, otherLineBadges } = splitOtherLineNotesFromText(text || "");

    if (!plainText && otherLineBadges.length === 0) {
        return <span className={className}>{emptyFallback}</span>;
    }

    return (
        <div className={`flex flex-col gap-1.5 min-w-0 ${className}`}>
            {plainText ? (
                <span className="whitespace-pre-wrap break-words">{plainText}</span>
            ) : null}
            {otherLineBadges.map((badge) => (
                <span key={badge} className={`${OTHER_LINE_BADGE_CLASS} w-fit`}>
                    {badge}
                </span>
            ))}
        </div>
    );
}
