// src/components/board/BoardCommentSection.tsx
import { useState, useCallback, useEffect, useRef } from "react";
import SectionCard from "../ui/SectionCard";
import Button from "../common/Button";
import ActionMenu from "../common/ActionMenu";
import {
    getBoardComments,
    createBoardComment,
    deleteBoardComment,
    updateBoardComment,
    type BoardComment,
    type BoardPost,
} from "../../lib/boardApi";
import { useToast } from "../ui/ToastProvider";
import ConfirmDialog from "../ui/ConfirmDialog";
import { IconMoreVertical } from "../icons/Icons";

function formatCommentDate(iso: string) {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return "방금 전";
    if (diffMins < 60) return `${diffMins}분 전`;
    if (diffHours < 24) return `${diffHours}시간 전`;
    if (diffDays < 7) return `${diffDays}일 전`;
    return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`;
}

function CommentItem({
    comment,
    currentUserId,
    onReply,
    onDeleted,
    onUpdated,
    depth,
    anonymousIndex,
    showSuccess,
    showError,
    /** true면 내용 대신 "비밀댓글입니다" 표시 (글 작성자·댓글 작성자 외) */
    isSecretHidden,
    /** 비밀댓글 글에서 이 댓글을 볼 수 있는 사람(글쓴이·댓글작성자)에게는 무조건 실명 표시 */
    forceShowRealName,
}: {
    comment: BoardComment;
    currentUserId: string | null;
    onReply: (parentId: string) => void;
    onDeleted: () => void;
    onUpdated: () => void;
    depth: number;
    /** 익명일 때 표시할 번호 (익명1, 익명2...) */
    anonymousIndex?: number;
    showSuccess?: (msg: string) => void;
    showError?: (msg: string) => void;
    isSecretHidden?: boolean;
    forceShowRealName?: boolean;
}) {
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [editing, setEditing] = useState(false);
    const [editBody, setEditBody] = useState(comment.body);
    const [saving, setSaving] = useState(false);
    const menuAnchorRef = useRef<HTMLButtonElement | null>(null);
    const isOwner = !!currentUserId && String(comment.author_id) === String(currentUserId);
    const displayName = isSecretHidden
        ? "비밀댓글"
        : forceShowRealName
          ? (comment.author_name || "—")
          : comment.is_anonymous
            ? (anonymousIndex != null ? `익명${anonymousIndex}` : "익명")
            : (comment.author_name || "—");

    const handleDelete = async () => {
        if (!currentUserId) return;
        try {
            await deleteBoardComment(comment.id, currentUserId);
            onDeleted();
        } catch (e) {
            console.error(e);
        } finally {
            setDeleteConfirmOpen(false);
        }
    };

    const handleSaveEdit = async () => {
        if (!currentUserId) return;
        const trimmed = editBody.trim();
        if (!trimmed) return;
        setSaving(true);
        try {
            await updateBoardComment(comment.id, currentUserId, trimmed);
            setEditing(false);
            onUpdated();
            showSuccess?.("댓글이 수정되었습니다.");
        } catch (e) {
            console.error(e);
            showError?.((e as Error)?.message ?? "댓글 수정에 실패했습니다.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className={depth > 0 ? "pl-6 md:pl-8 border-l-2 border-gray-100 ml-2 md:ml-4" : ""}>
            <div className="py-2 flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <span className="text-sm font-semibold text-gray-800">{displayName}</span>
                        <span className="text-xs text-gray-400 shrink-0">{formatCommentDate(comment.created_at)}</span>
                    </div>
                    {isOwner && (
                        <div className="flex items-center shrink-0">
                            <button
                                ref={menuAnchorRef}
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    menuAnchorRef.current = e.currentTarget;
                                    setMenuOpen((prev) => !prev);
                                }}
                                className="p-1 rounded-lg text-gray-500 hover:bg-gray-100"
                                aria-label="메뉴"
                            >
                                <IconMoreVertical className="w-4 h-4" />
                            </button>
                            <ActionMenu
                                isOpen={menuOpen}
                                anchorEl={menuOpen ? menuAnchorRef.current : null}
                                onClose={() => setMenuOpen(false)}
                                placement="right"
                                width="w-36"
                                showLogout={false}
                                showPdf={false}
                                onEdit={() => {
                                    setMenuOpen(false);
                                    setEditing(true);
                                    setEditBody(comment.body);
                                }}
                                onDelete={() => {
                                    setMenuOpen(false);
                                    setDeleteConfirmOpen(true);
                                }}
                                showDelete
                            />
                        </div>
                    )}
                </div>
                {editing ? (
                    <div className="mt-1 flex flex-col gap-2">
                        <textarea
                            value={editBody}
                            onChange={(e) => setEditBody(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    if (editBody.trim()) handleSaveEdit();
                                }
                            }}
                            rows={3}
                            className="w-full resize-none border border-gray-200 rounded-xl px-3 py-2 text-[14px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                        <div className="flex gap-2">
                            <Button variant="primary" size="xs" onClick={handleSaveEdit} disabled={saving || !editBody.trim()}>
                                {saving ? "저장 중..." : "저장"}
                            </Button>
                            <Button
                                variant="ghost"
                                size="xs"
                                onClick={() => {
                                    setEditing(false);
                                    setEditBody(comment.body);
                                }}
                            >
                                취소
                            </Button>
                        </div>
                    </div>
                ) : (
                    <>
                        <p className="text-[15px] text-gray-700 whitespace-pre-wrap break-words mb-0">
                            {isSecretHidden ? "비밀댓글입니다" : comment.body}
                        </p>
                        {depth === 0 && (
                            <Button
                                variant="ghost"
                                size="xs"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onReply(comment.id);
                                }}
                                className="w-fit"
                            >
                                답글 달기
                            </Button>
                        )}
                    </>
                )}
            </div>
            <ConfirmDialog
                isOpen={deleteConfirmOpen}
                onClose={() => setDeleteConfirmOpen(false)}
                onConfirm={handleDelete}
                title="댓글 삭제"
                message="이 댓글을 삭제하시겠습니까?"
                confirmText="삭제"
                confirmVariant="danger"
            />
        </div>
    );
}

const MIN_COMMENTS_TO_HIDE = 3;

interface BoardCommentSectionProps {
    post: BoardPost;
    currentUserId: string | null;
    authorName: string | null;
    onCommentCountChange?: (count: number) => void;
    /** true면 카드 없이 작성자 바로 밑에 인라인 표시 */
    embedded?: boolean;
}

export default function BoardCommentSection({
    post,
    currentUserId,
    authorName,
    onCommentCountChange,
    embedded = false,
}: BoardCommentSectionProps) {
    const [comments, setComments] = useState<BoardComment[]>([]);
    const [loading, setLoading] = useState(true);
    const [body, setBody] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [replyToId, setReplyToId] = useState<string | null>(null);
    const [replyBody, setReplyBody] = useState("");
    const [replySubmitting, setReplySubmitting] = useState(false);
    const [expandAllComments, setExpandAllComments] = useState(false);
    const [showCommentInput, setShowCommentInput] = useState(false);
    const { showSuccess, showError } = useToast();

    /** 글쓴이가 선택한 방식: true=익명, false=실명 (댓글 작성자는 선택 불가) */
    const commentAsAnonymous = post.allow_anonymous_comments ?? true;

    /** 댓글/답글 입력 placeholder: 익명·실명·비밀댓글 중 어떻게 작성되는지 안내 */
    const commentPlaceholder = post.secret_comments_only
        ? "비밀댓글"
        : commentAsAnonymous
          ? "익명"
          : "실명";

    const loadComments = useCallback(async () => {
        try {
            const list = await getBoardComments(post.id);
            setComments(list);
            onCommentCountChange?.(list.length);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [post.id, onCommentCountChange]);

    useEffect(() => {
        loadComments();
    }, [loadComments]);

    const refreshComments = useCallback(async () => {
        const list = await getBoardComments(post.id);
        setComments(list);
        onCommentCountChange?.(list.length);
    }, [post.id, onCommentCountChange]);

    const handleSubmit = async () => {
        if (!currentUserId) {
            showError("로그인 후 댓글을 남길 수 있습니다.");
            return;
        }
        const trimmed = body.trim();
        if (!trimmed) {
            showError("댓글 내용을 입력해 주세요.");
            return;
        }
        setSubmitting(true);
        try {
            await createBoardComment(post.id, currentUserId, authorName, trimmed, commentAsAnonymous);
            setBody("");
            setShowCommentInput(false);
            await refreshComments();
            showSuccess("댓글이 등록되었습니다.");
        } catch (e: unknown) {
            showError((e as Error)?.message ?? "댓글 등록에 실패했습니다.");
        } finally {
            setSubmitting(false);
        }
    };

    const handleReplySubmit = async () => {
        if (!currentUserId || !replyToId) return;
        const trimmed = replyBody.trim();
        if (!trimmed) {
            showError("답글 내용을 입력해 주세요.");
            return;
        }
        setReplySubmitting(true);
        try {
            await createBoardComment(
                post.id,
                currentUserId,
                authorName,
                trimmed,
                commentAsAnonymous,
                replyToId
            );
            setReplyBody("");
            setReplyToId(null);
            await refreshComments();
            showSuccess("답글이 등록되었습니다.");
        } catch (e: unknown) {
            showError((e as Error)?.message ?? "답글 등록에 실패했습니다.");
        } finally {
            setReplySubmitting(false);
        }
    };

    const topLevel = comments.filter((c) => !c.parent_id);
    const byParent = comments.reduce(
        (acc, c) => {
            if (!c.parent_id) return acc;
            if (!acc[c.parent_id]) acc[c.parent_id] = [];
            acc[c.parent_id].push(c);
            return acc;
        },
        {} as Record<string, BoardComment[]>
    );

    /** 답글 포함 표시 개수: 최대 3개까지 보여줄 그룹(부모+자식) 구성 */
    const visibleGroups = (() => {
        if (expandAllComments) {
            return topLevel.map((c) => ({ parent: c, children: byParent[c.id] ?? [] }));
        }
        let count = 0;
        const groups: { parent: BoardComment; children: BoardComment[] }[] = [];
        for (const c of topLevel) {
            if (count >= MIN_COMMENTS_TO_HIDE) break;
            const allChildren = byParent[c.id] ?? [];
            const visibleChildren: BoardComment[] = [];
            count += 1;
            for (const child of allChildren) {
                if (count >= MIN_COMMENTS_TO_HIDE) break;
                visibleChildren.push(child);
                count += 1;
            }
            groups.push({ parent: c, children: visibleChildren });
        }
        return groups;
    })();
    const hasMoreComments = comments.length > MIN_COMMENTS_TO_HIDE && !expandAllComments;

    /** 익명 댓글 작성자별 표시 번호 (등장 순서대로 익명1, 익명2...) */
    const anonymousOrderMap = (() => {
        const map = new Map<string, number>();
        let n = 0;
        for (const c of comments) {
            if (c.is_anonymous && !map.has(c.author_id)) {
                n += 1;
                map.set(c.author_id, n);
            }
        }
        return map;
    })();

    /** 비밀댓글 모드: 글쓴이는 모든 댓글 조회, 그 외에는 본인 댓글만 조회 가능 / 나머지는 "비밀댓글입니다" */
    const isSecretHiddenFor = (comment: BoardComment) => {
        if (post.secret_comments_only !== true) return false;
        const uid = currentUserId == null ? "" : String(currentUserId);
        const postAuthorId = String(post.author_id ?? "");
        const commentAuthorId = String(comment.author_id ?? "");
        if (uid === postAuthorId) return false; // 글쓴이는 다 보임
        if (uid === commentAuthorId) return false; // 본인 댓글은 보임
        return true; // 그 외 비밀댓글 표시
    };
    /** 비밀댓글 글에서 이 댓글을 볼 수 있는 사람(글쓴이·댓글작성자)에게는 실명 표시, 그 외는 "비밀댓글" */
    const forceShowRealNameFor = (comment: BoardComment) =>
        post.secret_comments_only === true && !isSecretHiddenFor(comment);

    const content = (
        <>
            <div className="flex items-center justify-between gap-3 mb-3">
                <p className="text-base font-semibold text-gray-800">댓글 {comments.length}개</p>
                {currentUserId && !showCommentInput && (
                    <Button variant="primary" size="sm" onClick={() => setShowCommentInput(true)}>
                        댓글 작성
                    </Button>
                )}
            </div>

            {currentUserId && showCommentInput && (
                <div className="mb-4 flex flex-col gap-2">
                    <textarea
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                if (body.trim()) handleSubmit();
                            }
                        }}
                        placeholder={`댓글을 입력하세요 (${commentPlaceholder})`}
                        rows={3}
                        className="w-full resize-none border border-gray-200 rounded-xl px-4 py-3 text-[15px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                    <div className="flex gap-2 justify-end">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                setShowCommentInput(false);
                                setBody("");
                            }}
                        >
                            취소
                        </Button>
                        <Button
                            variant="primary"
                            size="sm"
                            onClick={handleSubmit}
                            disabled={submitting || !body.trim()}
                        >
                            {submitting ? "등록 중..." : "등록"}
                        </Button>
                    </div>
                </div>
            )}

            <div className="flex flex-col gap-2">
                {loading ? (
                    <p className="text-sm text-gray-500 py-2">댓글을 불러오는 중...</p>
                ) : topLevel.length === 0 ? (
                    <p className="text-sm text-gray-500 py-2">아직 댓글이 없습니다.</p>
                ) : (
                    <>
                        {visibleGroups.map(({ parent: c, children: visibleChildren }) => (
                            <div key={c.id}>
                                <CommentItem
                                    comment={c}
                                    currentUserId={currentUserId}
                                    onReply={setReplyToId}
                                    onDeleted={refreshComments}
                                    onUpdated={refreshComments}
                                    depth={0}
                                    anonymousIndex={c.is_anonymous ? anonymousOrderMap.get(c.author_id) : undefined}
                                    showSuccess={showSuccess}
                                    showError={showError}
                                    isSecretHidden={isSecretHiddenFor(c)}
                                    forceShowRealName={forceShowRealNameFor(c)}
                                />
                                {visibleChildren.map((child) => (
                                    <div key={child.id} className="mt-1">
                                        <CommentItem
                                            comment={child}
                                            currentUserId={currentUserId}
                                            onReply={() => {}}
                                            onDeleted={refreshComments}
                                            onUpdated={refreshComments}
                                            depth={1}
                                            anonymousIndex={child.is_anonymous ? anonymousOrderMap.get(child.author_id) : undefined}
                                            showSuccess={showSuccess}
                                            showError={showError}
                                            isSecretHidden={isSecretHiddenFor(child)}
                                            forceShowRealName={forceShowRealNameFor(child)}
                                        />
                                    </div>
                                ))}
                                {replyToId === c.id && (
                                    <div className="pl-6 md:pl-8 mt-2 flex flex-col gap-2 border-l-2 border-gray-100">
                                        <textarea
                                            value={replyBody}
                                            onChange={(e) => setReplyBody(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter" && !e.shiftKey) {
                                                    e.preventDefault();
                                                    if (replyBody.trim()) handleReplySubmit();
                                                }
                                            }}
                                            placeholder={`답글을 입력하세요 (${commentPlaceholder})`}
                                            rows={2}
                                            className="w-full resize-none border border-gray-200 rounded-xl px-3 py-2 text-[14px]"
                                        />
                                        <div className="flex items-center gap-2">
                                            <Button
                                                variant="primary"
                                                size="xs"
                                                onClick={handleReplySubmit}
                                                disabled={replySubmitting || !replyBody.trim()}
                                            >
                                                등록
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="xs"
                                                onClick={() => {
                                                    setReplyToId(null);
                                                    setReplyBody("");
                                                }}
                                            >
                                                취소
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                        {hasMoreComments && (
                            <div className="flex justify-center pt-2">
                                <Button variant="outline" size="sm" onClick={() => setExpandAllComments(true)}>
                                    댓글 전체보기
                                </Button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </>
    );

    if (embedded) {
        return <div className="flex flex-col">{content}</div>;
    }

    return <SectionCard title="">{content}</SectionCard>;
}
