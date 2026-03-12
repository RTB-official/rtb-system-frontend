// src/pages/Board/BoardEditPage.tsx
import { useState, useEffect, useRef } from "react";

function isImageContentType(ct: string | null): boolean {
    return !!ct && ct.startsWith("image/");
}

/** 이미지 파일이면 썸네일 URL 생성, 언마운트 시 revoke */
function useImagePreviewUrl(file: File | null): string | null {
    const [url, setUrl] = useState<string | null>(null);
    useEffect(() => {
        if (!file || !file.type.startsWith("image/")) {
            setUrl(null);
            return;
        }
        const u = URL.createObjectURL(file);
        setUrl(u);
        return () => URL.revokeObjectURL(u);
    }, [file?.name, file?.size, file?.lastModified]);
    return url;
}

function NewFileRow({ file, onRemove }: { file: File; onRemove: () => void }) {
    const previewUrl = useImagePreviewUrl(file);
    const isImage = file.type.startsWith("image/");
    return (
        <li className="flex items-center gap-2 text-sm text-gray-700">
            {isImage && previewUrl ? (
                <img src={previewUrl} alt="" className="h-12 w-12 rounded-lg object-cover border border-gray-200 shrink-0" />
            ) : (
                <span className="h-12 w-12 rounded-lg border border-gray-200 bg-gray-100 flex items-center justify-center shrink-0 text-gray-400 text-xs">파일</span>
            )}
            <span className="min-w-0 truncate flex-1">{file.name}</span>
            <button type="button" onClick={onRemove} className="shrink-0 p-1 text-gray-500 hover:text-red-600 rounded" aria-label="첨부 제거">
                <IconClose className="w-4 h-4" />
            </button>
        </li>
    );
}
import { useParams, useNavigate } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/common/Header";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import Select from "../../components/common/Select";
import SectionCard from "../../components/ui/SectionCard";
import { IconArrowBack, IconPlus, IconTrash, IconImage, IconClose, IconUpload } from "../../components/icons/Icons";
import {
    getBoardPostById,
    updateBoardPost,
    uploadBoardOptionImage,
    getBoardAttachments,
    uploadBoardAttachment,
    insertBoardAttachments,
    deleteBoardAttachment,
    type BoardPostType,
    type BoardVisibility,
    type BoardAttachment,
} from "../../lib/boardApi";
import { useUser } from "../../hooks/useUser";
import { useToast } from "../../components/ui/ToastProvider";
import { PATHS } from "../../utils/paths";
import PageContainer from "../../components/common/PageContainer";
import BoardEditSkeleton from "../../components/board/BoardEditSkeleton";
import ImagePreviewModal from "../../components/ui/ImagePreviewModal";

const TYPE_OPTIONS: { value: BoardPostType; label: string }[] = [
    { value: "notice", label: "공지" },
    { value: "post", label: "게시물" },
    { value: "vote", label: "투표" },
];

const VISIBILITY_OPTIONS: { value: BoardVisibility; label: string }[] = [
    { value: "all", label: "모두에게 보이기" },
    { value: "staff", label: "공사팀에만 보이기" },
    { value: "admin", label: "공무팀에만 보이기" },
];

const COMMENT_MODE_OPTIONS: { value: string; label: string }[] = [
    { value: "anonymous", label: "익명" },
    { value: "real", label: "실명" },
    { value: "secret", label: '비밀 댓글' },
];

export default function BoardEditPage() {
    const { id } = useParams<{ id: string }>();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [type, setType] = useState<BoardPostType>("post");
    const [visibility, setVisibility] = useState<BoardVisibility>("all");
    const [commentMode, setCommentMode] = useState<"anonymous" | "real" | "secret">("anonymous");
    const [title, setTitle] = useState("");
    const [body, setBody] = useState("");
    const [voteOptions, setVoteOptions] = useState<string[]>(["", ""]);
    const [voteOptionImages, setVoteOptionImages] = useState<string[]>(["", ""]);
    const [voteAllowMultiple, setVoteAllowMultiple] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [loading, setLoading] = useState(true);
    const [existingAttachments, setExistingAttachments] = useState<BoardAttachment[]>([]);
    const [newAttachmentFiles, setNewAttachmentFiles] = useState<File[]>([]);
    const [attachmentIdsToRemove, setAttachmentIdsToRemove] = useState<string[]>([]);
    const attachmentInputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const uploadForIndexRef = useRef<number>(0);
    const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
    const { currentUserId } = useUser();
    const navigate = useNavigate();
    const { showSuccess, showError } = useToast();

    const canSubmitVote = type !== "vote" || voteOptions.filter((o) => o.trim()).length >= 2;

    const addVoteOption = () => {
        setVoteOptions((prev) => [...prev, ""]);
        setVoteOptionImages((prev) => [...prev, ""]);
    };
    const removeVoteOption = (index: number) => {
        if (voteOptions.length <= 1) return;
        setVoteOptions((prev) => prev.filter((_, i) => i !== index));
        setVoteOptionImages((prev) => prev.filter((_, i) => i !== index));
    };
    const setVoteOptionAt = (index: number, value: string) => {
        setVoteOptions((prev) => {
            const next = [...prev];
            next[index] = value;
            return next;
        });
    };
    const removeVoteOptionImage = (index: number) => {
        setVoteOptionImages((prev) => {
            const next = [...prev];
            if (index < next.length) next[index] = "";
            return next;
        });
    };

    useEffect(() => {
        if (!id || !currentUserId) return;
        (async () => {
            try {
                const post = await getBoardPostById(id);
                if (!post) {
                    navigate(PATHS.board);
                    return;
                }
                if (post.author_id !== currentUserId) {
                    showError("본인이 작성한 글만 수정할 수 있습니다.");
                    navigate(PATHS.board);
                    return;
                }
                setTitle(post.title);
                setType(post.type as BoardPostType);
                setVisibility(post.visibility as BoardVisibility);
                setCommentMode(
                    post.secret_comments_only ? "secret" : post.allow_anonymous_comments !== false ? "anonymous" : "real"
                );
                if (post.type === "vote" && post.body?.trim().startsWith("{")) {
                    try {
                        const parsed = JSON.parse(post.body) as {
                            description?: string;
                            options?: string[];
                            allowMultiple?: boolean;
                            optionImages?: string[];
                        };
                        setBody(parsed.description?.trim() ?? "");
                        const opts = parsed.options?.length ? parsed.options : ["", ""];
                        setVoteOptions(opts);
                        const imgs = parsed.optionImages ?? opts.map(() => "");
                        setVoteOptionImages(
                            imgs.length >= opts.length
                                ? imgs.slice(0, opts.length)
                                : [...imgs, ...opts.slice(imgs.length).map(() => "")]
                        );
                        setVoteAllowMultiple(!!parsed.allowMultiple);
                    } catch {
                        setBody(post.body ?? "");
                    }
                } else {
                    setBody(post.body ?? "");
                }
                const attachments = await getBoardAttachments(id);
                setExistingAttachments(attachments);
            } catch (e) {
                console.error(e);
                navigate(PATHS.board);
            } finally {
                setLoading(false);
            }
        })();
    }, [id, currentUserId, navigate, showError]);

    const handleSubmit = async () => {
        if (!id || !currentUserId) return;
        const t = title.trim();
        if (!t) {
            showError("제목을 입력해 주세요.");
            return;
        }
        if (type === "vote") {
            const options = voteOptions.map((o) => o.trim()).filter(Boolean);
            if (options.length < 2) {
                showError("투표 항목을 2개 이상 입력해 주세요.");
                return;
            }
        }
        setSubmitting(true);
        try {
            const options = voteOptions.map((o) => o.trim()).filter(Boolean);
            const optionImages = voteOptions
                .map((o, i) => (o.trim() ? (voteOptionImages[i] ?? "") : ""))
                .filter((_, i) => voteOptions[i]?.trim());
            await updateBoardPost(id, currentUserId, {
                title: t,
                body: body.trim() || undefined,
                type,
                visibility,
                allow_anonymous_comments: commentMode !== "real",
                secret_comments_only: commentMode === "secret",
                ...(type === "vote" && {
                    voteOptions: options,
                    voteAllowMultiple: voteAllowMultiple,
                    voteOptionImages:
                        optionImages.length === options.length
                            ? optionImages
                            : options.map(() => ""),
                }),
            });
            for (const attId of attachmentIdsToRemove) {
                await deleteBoardAttachment(attId);
            }
            if (newAttachmentFiles.length > 0) {
                const items: { storage_path: string; file_name: string; content_type: string; file_size: number }[] = [];
                for (const file of newAttachmentFiles) {
                    const meta = await uploadBoardAttachment(currentUserId, file);
                    items.push(meta);
                }
                await insertBoardAttachments(id, items);
            }
            showSuccess("글이 수정되었습니다.");
            navigate(PATHS.board);
        } catch (e: any) {
            console.error(e);
            showError(e?.message ?? "수정에 실패했습니다.");
        } finally {
            setSubmitting(false);
        }
    };

    if (!id) return null;

    return (
        <div className="flex h-screen bg-gray-50 overflow-hidden">
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-20 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}
            <div
                className={`fixed lg:static inset-y-0 left-0 z-30 w-[260px] max-w-[88vw] lg:max-w-none lg:w-[239px] h-screen shrink-0 transform transition-transform duration-300 ease-in-out ${
                    sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
                }`}
            >
                <Sidebar onClose={() => setSidebarOpen(false)} />
            </div>
            <div className="flex-1 flex flex-col h-screen overflow-hidden w-full">
                <Header
                    title="게시글 수정"
                    onMenuClick={() => setSidebarOpen(true)}
                    leftContent={
                        <button
                            onClick={() => navigate(PATHS.board)}
                            className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
                            title="목록으로"
                        >
                            <IconArrowBack />
                        </button>
                    }
                />
                <div className="flex-1 overflow-y-auto pt-4 pb-24">
                    <PageContainer className="pt-2">
                        {loading ? (
                            <BoardEditSkeleton />
                        ) : (
                            <SectionCard title="글 수정">
                                <div className="flex flex-col gap-4">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <Select
                                            label="유형"
                                            options={TYPE_OPTIONS}
                                            value={type}
                                            onChange={(v) => setType(v as BoardPostType)}
                                        />
                                        <Select
                                            label="공개 범위"
                                            options={VISIBILITY_OPTIONS}
                                            value={visibility}
                                            onChange={(v) => setVisibility(v as BoardVisibility)}
                                        />
                                        <Select
                                            label="댓글 작성 방식"
                                            options={COMMENT_MODE_OPTIONS}
                                            value={commentMode}
                                            onChange={(v) => setCommentMode(v as "anonymous" | "real" | "secret")}
                                        />
                                    </div>
                                    <Input
                                        label="제목"
                                        required
                                        value={title}
                                        onChange={setTitle}
                                        placeholder="제목을 입력하세요"
                                    />
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            {type === "vote" ? "설명 (선택)" : "내용"}
                                        </label>
                                        <textarea
                                            value={body}
                                            onChange={(e) => setBody(e.target.value)}
                                            placeholder={type === "vote" ? "투표 설명을 입력하세요" : "내용을 입력하세요"}
                                            rows={type === "vote" ? 6 : 8}
                                            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-[15px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <div className="flex items-center justify-between mb-1">
                                            <label className="block text-sm font-medium text-gray-700">첨부파일</label>
                                            <label className="inline-flex items-center justify-center h-[30px] px-2 text-[13px] rounded-[8px] border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 cursor-pointer focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500">
                                                <IconUpload className="w-4 h-4 mr-1" />
                                                <span>파일 추가</span>
                                                <input
                                                    ref={attachmentInputRef}
                                                    type="file"
                                                    multiple
                                                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
                                                    className="sr-only"
                                                    onChange={(e) => {
                                                        const input = e.target;
                                                        const fileList = input.files;
                                                        if (!fileList?.length) return;
                                                        const newFiles = Array.from(fileList);
                                                        setNewAttachmentFiles((prev) => [...prev, ...newFiles]);
                                                        input.value = "";
                                                    }}
                                                />
                                            </label>
                                        </div>
                                        {(existingAttachments.filter((a) => !attachmentIdsToRemove.includes(a.id)).length > 0 || newAttachmentFiles.length > 0) ? (
                                            <ul className="mt-2 space-y-2 rounded-xl border border-gray-200 bg-gray-50/50 px-3 py-2">
                                                {existingAttachments
                                                    .filter((a) => !attachmentIdsToRemove.includes(a.id))
                                                    .map((a) => (
                                                        <li key={a.id} className="flex items-center gap-2 text-sm text-gray-700">
                                                            {isImageContentType(a.content_type) && a.url ? (
                                                                <a href={a.url} target="_blank" rel="noopener noreferrer" className="shrink-0 h-12 w-12 rounded-lg overflow-hidden border border-gray-200">
                                                                    <img src={a.url} alt="" className="h-full w-full object-cover" />
                                                                </a>
                                                            ) : (
                                                                <span className="h-12 w-12 rounded-lg border border-gray-200 bg-gray-100 flex items-center justify-center shrink-0 text-gray-400 text-xs">파일</span>
                                                            )}
                                                            <a href={a.url} target="_blank" rel="noopener noreferrer" className="min-w-0 truncate flex-1 text-blue-600 hover:underline">
                                                                {a.file_name}
                                                            </a>
                                                            <button
                                                                type="button"
                                                                onClick={() => setAttachmentIdsToRemove((prev) => [...prev, a.id])}
                                                                className="shrink-0 p-1 text-gray-500 hover:text-red-600 rounded"
                                                                aria-label="첨부 제거"
                                                            >
                                                                <IconClose className="w-4 h-4" />
                                                            </button>
                                                        </li>
                                                    ))}
                                                {newAttachmentFiles.map((f, i) => (
                                                    <NewFileRow
                                                        key={`new-${f.name}-${f.size}-${i}`}
                                                        file={f}
                                                        onRemove={() => setNewAttachmentFiles((prev) => prev.filter((_, idx) => idx !== i))}
                                                    />
                                                ))}
                                            </ul>
                                        ) : (
                                            <p className="text-sm text-gray-500 mt-1">사진, PDF 등 파일을 첨부할 수 있습니다.</p>
                                        )}
                                    </div>
                                    {type === "vote" && (
                                        <div>
                                            <div className="flex items-center justify-between mb-2">
                                                <label className="block text-sm font-medium text-gray-700">
                                                    투표 항목 (2개 이상)
                                                </label>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={addVoteOption}
                                                    icon={<IconPlus className="w-4 h-4" />}
                                                >
                                                    항목 추가
                                                </Button>
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                {voteOptions.map((opt, index) => (
                                                    <div key={index} className="flex gap-2 items-center">
                                                        <div className="flex-1 relative flex items-center min-w-0">
                                                            <input
                                                                value={opt}
                                                                onChange={(e) => setVoteOptionAt(index, e.target.value)}
                                                                placeholder={`항목 ${index + 1}`}
                                                                className="w-full h-12 border border-gray-200 rounded-xl pl-4 pr-24 text-base text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                                                            />
                                                            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                                                {voteOptionImages[index] ? (
                                                                    <div className="relative shrink-0">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => setPreviewImageUrl(voteOptionImages[index] ?? null)}
                                                                            className="h-8 w-8 rounded-lg overflow-hidden border border-gray-200 flex items-center justify-center bg-gray-50 hover:bg-gray-100"
                                                                            aria-label="이미지 크게 보기"
                                                                        >
                                                                            <img
                                                                                src={voteOptionImages[index]}
                                                                                alt="미리보기"
                                                                                className="h-full w-full object-cover"
                                                                            />
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={(e) => { e.stopPropagation(); removeVoteOptionImage(index); }}
                                                                            className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-gray-700/90 hover:bg-red-500 flex items-center justify-center text-white shrink-0 transition-colors"
                                                                            aria-label="이미지 제거"
                                                                        >
                                                                            <IconClose className="w-3 h-3" />
                                                                        </button>
                                                                    </div>
                                                                ) : (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            uploadForIndexRef.current = index;
                                                                            fileInputRef.current?.click();
                                                                        }}
                                                                        className="h-9 w-9 flex items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg shrink-0"
                                                                        aria-label="항목에 이미지 추가"
                                                                    >
                                                                        <IconImage className="w-5 h-5" />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => removeVoteOption(index)}
                                                            disabled={voteOptions.length <= 1}
                                                            className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-40 disabled:pointer-events-none shrink-0"
                                                            aria-label="항목 삭제"
                                                        >
                                                            <IconTrash className="w-5 h-5" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                            <ImagePreviewModal
                                                isOpen={!!previewImageUrl}
                                                onClose={() => setPreviewImageUrl(null)}
                                                imageSrc={previewImageUrl}
                                                imageAlt="투표 항목 이미지"
                                            />
                                            {!canSubmitVote && voteOptions.some((o) => o.trim()) && (
                                                <p className="mt-2 text-sm text-red-500">
                                                    투표 항목을 2개 이상 입력해 주세요.
                                                </p>
                                            )}
                                            <label className="flex items-center gap-2 cursor-pointer mt-3">
                                                <input
                                                    type="checkbox"
                                                    checked={voteAllowMultiple}
                                                    onChange={(e) => setVoteAllowMultiple(e.target.checked)}
                                                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                />
                                                <span className="text-sm font-medium text-gray-700">
                                                    중복 투표 가능 (여러 항목 선택)
                                                </span>
                                            </label>
                                            <input
                                                ref={fileInputRef}
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={async (e) => {
                                                    const file = e.target.files?.[0];
                                                    e.target.value = "";
                                                    if (!file || !currentUserId) return;
                                                    const index = uploadForIndexRef.current;
                                                    try {
                                                        const url = await uploadBoardOptionImage(
                                                            currentUserId,
                                                            file
                                                        );
                                                        setVoteOptionImages((prev) => {
                                                            const next = [...prev];
                                                            while (next.length <= index) next.push("");
                                                            next[index] = url;
                                                            return next;
                                                        });
                                                        showSuccess("이미지가 추가되었습니다.");
                                                    } catch (err: any) {
                                                        showError(
                                                            err?.message ?? "이미지 업로드에 실패했습니다."
                                                        );
                                                    }
                                                }}
                                            />
                                        </div>
                                    )}
                                    <div className="flex gap-2 justify-end pt-2">
                                        <Button
                                            variant="outline"
                                            size="lg"
                                            onClick={() => navigate(PATHS.board)}
                                        >
                                            취소
                                        </Button>
                                        <Button
                                            variant="primary"
                                            size="lg"
                                            onClick={handleSubmit}
                                            disabled={submitting || (type === "vote" && !canSubmitVote)}
                                        >
                                            {submitting ? "수정 중..." : "수정"}
                                        </Button>
                                    </div>
                                </div>
                            </SectionCard>
                        )}
                    </PageContainer>
                </div>
            </div>
        </div>
    );
}
