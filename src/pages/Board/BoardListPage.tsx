// src/pages/Board/BoardListPage.tsx
import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/common/Header";
import Button from "../../components/common/Button";
import ActionMenu from "../../components/common/ActionMenu";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import { IconPlus, IconMoreVertical } from "../../components/icons/Icons";
import { BoardPostCard } from "../../components/board/BoardPostCards";
import BoardListSkeleton from "../../components/board/BoardListSkeleton";
import {
    getBoardPosts,
    deleteBoardPost,
    getMyVotesForPosts,
    getVoteCountsForPosts,
    submitVote,
    type BoardPostRow,
} from "../../lib/boardApi";
import { useUser } from "../../hooks/useUser";
import { useToast } from "../../components/ui/ToastProvider";
import { PATHS } from "../../utils/paths";
import PageContainer from "../../components/common/PageContainer";

/** "2026년 2월 14일 오후 2:30" 형식 */
function formatBoardDateTimeKo(iso: string) {
    const d = new Date(iso);
    const y = d.getFullYear();
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const h = d.getHours();
    const min = d.getMinutes();
    const ampm = h < 12 ? "오전" : "오후";
    const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    const time = `${ampm} ${hour12}:${String(min).padStart(2, "0")}`;
    return `${y}년 ${month}월 ${day}일 ${time}`;
}

export default function BoardListPage() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [posts, setPosts] = useState<BoardPostRow[]>([]);
    const [myVotes, setMyVotes] = useState<Record<string, number[]>>({});
    const [voteCounts, setVoteCounts] = useState<Record<string, Record<number, number>>>({});
    const [loading, setLoading] = useState(true);
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const menuAnchorRef = useRef<HTMLButtonElement | null>(null);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
    const [votingPostId, setVotingPostId] = useState<string | null>(null);
    const { currentUserId } = useUser();
    const navigate = useNavigate();
    const { showSuccess, showError } = useToast();

    const loadPosts = async () => {
        if (!currentUserId) return;
        setLoading(true);
        try {
            const list = await getBoardPosts(currentUserId);
            setPosts(list);
            const votePostIds = list.filter((p) => p.type === "vote").map((p) => p.id);
            const [votes, counts] = await Promise.all([
                getMyVotesForPosts(votePostIds, currentUserId),
                getVoteCountsForPosts(votePostIds),
            ]);
            setMyVotes(votes);
            setVoteCounts(counts);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadPosts();
    }, [currentUserId]);

    const handleVote = async (
        postId: string,
        optionIndex: number,
        allowMultiple: boolean,
        currentIndices: number[]
    ) => {
        if (!currentUserId || votingPostId) return;
        let next: number[];
        if (allowMultiple) {
            if (currentIndices.includes(optionIndex)) {
                next = currentIndices.filter((i) => i !== optionIndex);
            } else {
                next = [...currentIndices, optionIndex].sort((a, b) => a - b);
            }
        } else {
            next = [optionIndex];
        }
        setVotingPostId(postId);
        try {
            await submitVote(postId, currentUserId, next);
            setMyVotes((prev) => ({ ...prev, [postId]: next }));
            setVoteCounts((prev) => {
                const counts = { ...(prev[postId] ?? {}) };
                currentIndices.forEach((i) => {
                    counts[i] = (counts[i] ?? 1) - 1;
                    if (counts[i] <= 0) delete counts[i];
                });
                next.forEach((i) => {
                    counts[i] = (counts[i] ?? 0) + 1;
                });
                return { ...prev, [postId]: counts };
            });
            showSuccess("투표가 반영되었습니다.");
        } catch (e: unknown) {
            showError((e as Error)?.message ?? "투표에 실패했습니다.");
        } finally {
            setVotingPostId(null);
        }
    };

    const handleDeleteClick = (postId: string) => {
        setOpenMenuId(null);
        setDeleteTargetId(postId);
        setDeleteConfirmOpen(true);
    };

    const handleDeleteConfirm = async () => {
        if (!deleteTargetId || !currentUserId) return;
        try {
            await deleteBoardPost(deleteTargetId, currentUserId);
            showSuccess("글이 삭제되었습니다.");
            setPosts((prev) => prev.filter((p) => p.id !== deleteTargetId));
        } catch (e: unknown) {
            showError((e as Error)?.message ?? "삭제에 실패했습니다.");
        } finally {
            setDeleteConfirmOpen(false);
            setDeleteTargetId(null);
        }
    };

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
                    title="게시판"
                    onMenuClick={() => setSidebarOpen(true)}
                    rightContent={
                        <Button
                            variant="primary"
                            size="lg"
                            onClick={() => navigate(PATHS.boardCreate)}
                            icon={<IconPlus />}
                        >
                            글쓰기
                        </Button>
                    }
                />
                <div className="flex-1 overflow-y-auto pt-4 pb-24">
                    <PageContainer className="pt-4 flex flex-col gap-4 lg:px-24 xl:px-64">
                        {loading ? (
                            <BoardListSkeleton />
                        ) : posts.length === 0 ? (
                            <div className="py-12 text-center text-gray-500 text-sm">
                                게시글이 없습니다.
                            </div>
                        ) : (
                            posts.map((row) => {
                                const isOwner =
                                    !!currentUserId && String(row.author_id) === String(currentUserId);

                                const headerRight = isOwner ? (
                                    <>
                                        <button
                                            ref={openMenuId === row.id ? menuAnchorRef : null}
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setOpenMenuId(openMenuId === row.id ? null : row.id);
                                                menuAnchorRef.current = e.currentTarget;
                                            }}
                                            className="p-1.5 shrink-0 rounded-lg text-gray-500 hover:bg-gray-100"
                                            aria-label="메뉴"
                                        >
                                            <IconMoreVertical className="w-5 h-5" />
                                        </button>
                                        <ActionMenu
                                            isOpen={openMenuId === row.id}
                                            anchorEl={openMenuId === row.id ? menuAnchorRef.current : null}
                                            onClose={() => setOpenMenuId(null)}
                                            width="w-40"
                                            onEdit={() => {
                                                setOpenMenuId(null);
                                                navigate(PATHS.boardEdit(row.id));
                                            }}
                                            onDelete={() => handleDeleteClick(row.id)}
                                            showDelete
                                            showLogout={false}
                                        />
                                    </>
                                ) : undefined;

                                if (row.type === "vote" && row.body?.trim().startsWith("{")) {
                                    try {
                                        const parsed = JSON.parse(row.body) as {
                                            description?: string;
                                            options?: string[];
                                            allowMultiple?: boolean;
                                            optionImages?: string[];
                                        };
                                        const description = parsed.description?.trim() ?? "";
                                        const options = parsed.options ?? [];
                                        const optionImages = parsed.optionImages ?? [];
                                        const allowMultiple = !!parsed.allowMultiple;
                                        const selectedIndices = myVotes[row.id] ?? [];
                                        const counts = voteCounts[row.id] ?? {};
                                        return (
                                            <BoardPostCard
                                                key={row.id}
                                                title={row.title || "—"}
                                                description={description}
                                                headerRight={headerRight}
                                                authorName={row.author_name || "—"}
                                                authorEmail={row.author_email ?? null}
                                                createdAtLabel={formatBoardDateTimeKo(row.created_at)}
                                                chip={{ label: "투표", color: "blue-500", variant: "solid", size: "lg" }}
                                                vote={{
                                                    options,
                                                    optionImages,
                                                    allowMultiple,
                                                    selectedIndices,
                                                    counts,
                                                    voteDisabled: votingPostId === row.id,
                                                    onVote: (optionIndex, allowMulti, current) =>
                                                        handleVote(row.id, optionIndex, allowMulti, current),
                                                }}
                                                className=""
                                            />
                                        );
                                    } catch {
                                        // JSON 파싱 실패 시 일반 게시물로 표시
                                    }
                                }

                                return (
                                    <BoardPostCard
                                        key={row.id}
                                        title={row.title || "—"}
                                        body={row.body?.trim() || "—"}
                                        headerRight={headerRight}
                                        authorName={row.author_name || "—"}
                                        authorEmail={row.author_email ?? null}
                                        createdAtLabel={formatBoardDateTimeKo(row.created_at)}
                                        chip={
                                            row.type === "notice"
                                                ? { label: "공지사항", color: "red-500", variant: "solid", size: "lg" }
                                                : undefined
                                        }
                                    />
                                );
                            })
                        )}
                    </PageContainer>
                </div>
            </div>

            <ConfirmDialog
                isOpen={deleteConfirmOpen}
                onClose={() => {
                    setDeleteConfirmOpen(false);
                    setDeleteTargetId(null);
                }}
                onConfirm={handleDeleteConfirm}
                title="글 삭제"
                message="이 글을 삭제하시겠습니까?"
                confirmText="삭제"
                confirmVariant="danger"
            />
        </div>
    );
}
