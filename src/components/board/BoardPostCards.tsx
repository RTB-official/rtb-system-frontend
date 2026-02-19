import { useState } from "react";
import type { ReactNode } from "react";
import SectionCard from "../ui/SectionCard";
import Chip from "../ui/Chip";
import Avatar from "../common/Avatar";
import { IconCheck } from "../icons/Icons";
import ImagePreviewModal from "../ui/ImagePreviewModal";

function BoardAuthorMeta({
    authorName,
    authorEmail,
    createdAtLabel,
    authorClassName = "text-gray-700",
}: {
    authorName: string;
    authorEmail?: string | null;
    createdAtLabel: string;
    authorClassName?: string;
}) {
    return (
        <div className="flex items-center justify-start gap-3 border-t border-gray-100 mt-4 pt-4">
            {authorEmail ? (
                <Avatar email={authorEmail} size={32} />
            ) : (
                <span className="h-8 w-8 shrink-0 rounded-full bg-gray-300" aria-hidden />
            )}
            <div className="text-left flex flex-col">
                <span className={`text-base text-gray-800 font-semibold ${authorClassName}`}>{authorName}</span>
                <span className="text-sm text-gray-500">{createdAtLabel}</span>
            </div>
        </div>
    );
}

interface BoardPostCardProps {
    title: string;
    body?: string;
    description?: string;
    headerRight?: ReactNode;
    authorName: string;
    authorEmail?: string | null;
    createdAtLabel: string;
    chip?: {
        label: string;
        color: string;
        variant?: "outline" | "solid" | "filled";
        size?: "sm" | "md" | "lg";
    };
    vote?: {
        options: string[];
        optionImages?: string[];
        allowMultiple: boolean;
        selectedIndices: number[];
        counts: Record<number, number>;
        voteDisabled?: boolean;
        onVote: (optionIndex: number, allowMultiple: boolean, currentIndices: number[]) => void;
    };
    className?: string;
}

export function BoardPostCard({
    title,
    body,
    description,
    headerRight,
    authorName,
    authorEmail,
    createdAtLabel,
    chip,
    vote,
    className = "",
}: BoardPostCardProps) {
    const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
    const hasVote = !!vote && vote.options.length > 0;
    const totalVotes = hasVote
        ? Object.values(vote.counts).reduce((a, b) => a + b, 0)
        : 0;

    return (
        <SectionCard title="" className={`bg-white ${className}`}>
            <div className="flex flex-col">
                            <div className="flex flex-col gap-2">
                {chip ? (
                    <>
                        <div className="flex items-start justify-between">
                            <Chip
                                color={chip.color}
                                variant={chip.variant ?? "solid"}
                                size="md"
                                sizeFromMd="lg"
                            >
                                {chip.label}
                            </Chip>
                            {headerRight}
                        </div>
                        <h2 className="mt-1 text-xl font-bold text-gray-800 md:text-2xl">{title || "—"}</h2>
                    </>
                ) : (
                    <div className="flex items-center justify-between gap-2">
                        <h2 className="min-w-0 flex-1 text-xl font-bold text-gray-800 md:text-2xl">{title || "—"}</h2>
                        {headerRight}
                    </div>
                )}
                {(() => {
                    const text = [description, body].filter(Boolean).join("\n\n").trim();
                    return text ? (
                        <p className="text-[16px] whitespace-pre-line text-gray-600">{text}</p>
                    ) : null;
                })()}
                </div>
                {hasVote && (
                    <div className="mt-3 flex flex-col gap-2">
                        {vote.options.map((opt, i) => {
                            const selected = vote.selectedIndices.includes(i);
                            const count = vote.counts[i] ?? 0;
                            const pct = totalVotes > 0 ? (count / totalVotes) * 100 : 0;
                            const optionText = selected ? "text-blue-600" : "text-gray-800";
                            const imageUrl = vote.optionImages?.[i];
                            const isVoting = vote.voteDisabled;
                            return (
                                <button
                                    key={i}
                                    type="button"
                                    onClick={() => {
                                        if (isVoting) return;
                                        vote.onVote(i, vote.allowMultiple, vote.selectedIndices);
                                    }}
                                    className={`relative flex cursor-pointer items-center gap-4 overflow-hidden rounded-2xl border px-5 py-4 text-left transition-colors ${
                                        selected
                                            ? "border-blue-200 bg-blue-50 hover:bg-blue-50"
                                            : "border-gray-200 bg-white hover:bg-gray-50"
                                    }`}
                                >
                                    <div
                                        className="absolute inset-y-0 left-0 bg-blue-100/80 transition-all rounded-r-2xl"
                                        style={{ width: `${pct}%` }}
                                        aria-hidden
                                    />
                                    <span className="relative flex items-center gap-4 min-w-0">
                                        {selected ? (
                                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-blue-500">
                                                <IconCheck className="h-3.5 w-3.5 text-white" />
                                            </span>
                                        ) : (
                                            <span
                                                className="h-6 w-6 shrink-0 rounded-md border border-gray-300 bg-white"
                                                aria-hidden
                                            />
                                        )}
                                        {imageUrl ? (
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setPreviewImageUrl(imageUrl);
                                                }}
                                                className="h-10 w-10 shrink-0 rounded-lg overflow-hidden border border-gray-200 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-blue-400"
                                                aria-label="이미지 크게 보기"
                                            >
                                                <img
                                                    src={imageUrl}
                                                    alt=""
                                                    className="h-full w-full object-cover"
                                                />
                                            </button>
                                        ) : null}
                                        <span className={`text-[15px] min-w-0 ${optionText}`}>{opt || "—"}</span>
                                    </span>
                                    {count > 0 && (
                                        <span className="relative ml-auto text-sm text-gray-500 shrink-0">
                                            {count}명
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                )}
                <BoardAuthorMeta
                    authorName={authorName}
                    authorEmail={authorEmail}
                    createdAtLabel={createdAtLabel}
                    authorClassName="text-gray-700"
                />
            </div>
            <ImagePreviewModal
                isOpen={!!previewImageUrl}
                onClose={() => setPreviewImageUrl(null)}
                imageSrc={previewImageUrl}
                imageAlt="투표 항목 이미지"
            />
        </SectionCard>
    );
}
