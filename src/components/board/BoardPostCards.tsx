// src/components/board/BoardPostCards.tsx
import { useState } from "react";
import type { ReactNode } from "react";
import SectionCard from "../ui/SectionCard";
import Chip from "../ui/Chip";
import Avatar from "../common/Avatar";
import { IconCheck, IconDownload } from "../icons/Icons";
import ImagePreviewModal from "../ui/ImagePreviewModal";
import type { BoardAttachment } from "../../lib/boardApi";

/** URL을 fetch해서 파일로 저장 (cross-origin에서 download 속성 동작 안 함 대응) */
async function downloadFileFromUrl(url: string, fileName: string) {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) throw new Error("다운로드에 실패했습니다.");
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = fileName || "download";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(objectUrl);
}

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
        <div className="flex items-center justify-start gap-3 mt-4 pt-4">
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
    /** 작성자 바로 밑에 표시 (예: 댓글 영역) */
    footer?: ReactNode;
    /** 첨부파일 목록 (있으면 본문 아래에 표시) */
    attachments?: BoardAttachment[];
    className?: string;
}

function isImageContentType(ct: string | null): boolean {
    if (!ct) return false;
    return ct.startsWith("image/");
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
    footer,
    attachments,
    className = "",
}: BoardPostCardProps) {
    const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
    const [attachmentPreview, setAttachmentPreview] = useState<{ images: { url: string; fileName: string }[]; index: number } | null>(null);
    const [downloadingId, setDownloadingId] = useState<string | null>(null);
    const hasVote = !!vote && vote.options.length > 0;

    const handleFileDownload = async (url: string, fileName: string, id: string) => {
        if (downloadingId) return;
        setDownloadingId(id);
        try {
            await downloadFileFromUrl(url, fileName);
        } catch (e) {
            console.error(e);
            window.open(url, "_blank");
        } finally {
            setDownloadingId(null);
        }
    };
    const totalVotes = hasVote
        ? Object.values(vote.counts).reduce((a, b) => a + b, 0)
        : 0;

    return (
        <SectionCard title="" className={`bg-white ${className}`}>
            <div className="flex flex-col">
                            <div className="flex flex-col gap-2">
                {chip ? (
                    <>
                        <div className="flex items-start justify-between gap-2">
                            <Chip
                                color={chip.color}
                                variant={chip.variant ?? "solid"}
                                size="md"
                                sizeFromMd="lg"
                            >
                                {chip.label}
                            </Chip>

                            {headerRight ? <div className="shrink-0">{headerRight}</div> : null}
                        </div>
                        <h2 className="mt-1 text-xl font-bold text-gray-800 md:text-2xl">{title || "—"}</h2>
                    </>
                ) : (
                    <div className="flex items-center justify-between gap-2">
                        <h2 className="min-w-0 flex-1 text-xl font-bold text-gray-800 md:text-2xl">
                            {title || "—"}
                        </h2>

                        {headerRight ? <div className="shrink-0">{headerRight}</div> : null}
                    </div>
                )}
                {(() => {
                    const text = [description, body].filter(Boolean).join("\n\n").trim();
                    return text ? (
                        <p className="text-[16px] whitespace-pre-line text-gray-600">{text}</p>
                    ) : null;
                })()}
                </div>
                {attachments && attachments.length > 0 && (() => {
                    const imageAttachments = attachments.filter((a) => isImageContentType(a.content_type) && a.url);
                    const fileAttachments = attachments.filter((a) => !isImageContentType(a.content_type) || !a.url);
                    return (
                        <div className="mt-3 flex flex-col gap-3">
                            {imageAttachments.length > 0 && (
                                <div className="flex flex-wrap gap-[10px]">
                                    {imageAttachments.map((a, idx) => (
                                        <button
                                            key={a.id}
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setAttachmentPreview({
                                                    images: imageAttachments.map((x) => ({ url: x.url!, fileName: x.file_name })),
                                                    index: idx,
                                                });
                                            }}
                                            className="block h-52 w-52 rounded-xl overflow-hidden border border-gray-200 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-blue-400 shrink-0"
                                            aria-label="이미지 크게 보기"
                                        >
                                            <img src={a.url!} alt="" className="h-full w-full object-cover" />
                                        </button>
                                    ))}
                                </div>
                            )}
                            {fileAttachments.length > 0 && (
                                <div className="flex flex-col gap-2">
                                    {fileAttachments.map((a) => (
                                        <div
                                            key={a.id}
                                            className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2.5 min-w-0"
                                        >
                                            <span className="h-10 w-10 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center shrink-0 text-gray-400 text-xs">
                                                파일
                                            </span>
                                            <a
                                                href={a.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="min-w-0 truncate text-sm text-gray-700 flex-1 hover:text-blue-600"
                                            >
                                                {a.file_name}
                                            </a>
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    handleFileDownload(a.url ?? "", a.file_name, a.id);
                                                }}
                                                disabled={!!downloadingId}
                                                className="shrink-0 p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors disabled:opacity-50"
                                                aria-label="다운로드"
                                            >
                                                {downloadingId === a.id ? (
                                                    <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
                                                ) : (
                                                    <IconDownload className="w-5 h-5" />
                                                )}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })()}
                {hasVote && (
                    <div className="mt-3 flex flex-col gap-3">
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
                                    onClick={(e) => {
                                        e.stopPropagation();
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
                {footer ? <div className="border-t border-gray-100 mt-4 pt-4">{footer}</div> : null}
            </div>
            <ImagePreviewModal
                isOpen={!!previewImageUrl}
                onClose={() => setPreviewImageUrl(null)}
                imageSrc={previewImageUrl}
                imageAlt="투표 항목 이미지"
            />
            <ImagePreviewModal
                isOpen={!!attachmentPreview}
                onClose={() => setAttachmentPreview(null)}
                imageSrc={
                    attachmentPreview
                        ? attachmentPreview.images[attachmentPreview.index]?.url ?? null
                        : null
                }
                imageAlt="첨부 이미지"
                fileName={attachmentPreview?.images[attachmentPreview.index]?.fileName}
                images={attachmentPreview ? attachmentPreview.images.map((i) => ({ src: i.url, fileName: i.fileName })) : undefined}
                currentIndex={attachmentPreview?.index ?? 0}
                onPrev={
                    attachmentPreview && attachmentPreview.images.length > 1
                        ? () =>
                              setAttachmentPreview((prev) =>
                                  prev
                                      ? {
                                            ...prev,
                                            index: (prev.index - 1 + prev.images.length) % prev.images.length,
                                        }
                                      : null
                              )
                        : undefined
                }
                onNext={
                    attachmentPreview && attachmentPreview.images.length > 1
                        ? () =>
                              setAttachmentPreview((prev) =>
                                  prev
                                      ? {
                                            ...prev,
                                            index: (prev.index + 1) % prev.images.length,
                                        }
                                      : null
                              )
                        : undefined
                }
            />
        </SectionCard>
    );
}
