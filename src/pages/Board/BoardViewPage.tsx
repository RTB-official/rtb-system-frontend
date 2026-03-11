// src/pages/Board/BoardViewPage.tsx
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/common/Header";
import Button from "../../components/common/Button";
import { BoardPostCard } from "../../components/board/BoardPostCards";
import BoardCommentSection from "../../components/board/BoardCommentSection";
import {
    getBoardPostById,
    markBoardPostAsRead,
    getMyVotes,
    getVoteCounts,
    submitVote,
    type BoardPost,
} from "../../lib/boardApi";
import { useUser } from "../../hooks/useUser";
import { useToast } from "../../components/ui/ToastProvider";
import { PATHS } from "../../utils/paths";
import PageContainer from "../../components/common/PageContainer";
import { IconArrowBack } from "../../components/icons/Icons";

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

export default function BoardViewPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { currentUserId } = useUser();
    const { showSuccess, showError } = useToast();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [post, setPost] = useState<BoardPost | null>(null);
    const [loading, setLoading] = useState(true);
    const [myVotes, setMyVotes] = useState<number[]>([]);
    const [voteCounts, setVoteCounts] = useState<Record<number, number>>({});
    const [voting, setVoting] = useState(false);

    useEffect(() => {
        if (!id) return;
        (async () => {
            setLoading(true);
            try {
                const p = await getBoardPostById(id);
                if (!p) {
                    navigate(PATHS.board);
                    return;
                }
                setPost(p);
                if (currentUserId) {
                    markBoardPostAsRead(currentUserId, id);
                    if (p.type === "vote") {
                        const [votes, counts] = await Promise.all([
                            getMyVotes(id, currentUserId),
                            getVoteCounts(id),
                        ]);
                        setMyVotes(votes);
                        setVoteCounts(counts);
                    }
                }
            } catch (e) {
                console.error(e);
                navigate(PATHS.board);
            } finally {
                setLoading(false);
            }
        })();
    }, [id, currentUserId, navigate]);

    const handleVote = async (optionIndex: number, allowMultiple: boolean, currentIndices: number[]) => {
        if (!id || !currentUserId || voting) return;
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
        setVoting(true);
        try {
            await submitVote(id, currentUserId, next);
            setMyVotes(next);
            setVoteCounts((prev) => {
                const counts = { ...prev };
                currentIndices.forEach((i) => {
                    counts[i] = (counts[i] ?? 1) - 1;
                    if (counts[i] <= 0) delete counts[i];
                });
                next.forEach((i) => {
                    counts[i] = (counts[i] ?? 0) + 1;
                });
                return counts;
            });
            showSuccess("투표가 반영되었습니다.");
        } catch (e) {
            showError((e as Error)?.message ?? "투표에 실패했습니다.");
        } finally {
            setVoting(false);
        }
    };

    if (!id) return null;
    const isOwner = !!currentUserId && !!post && String(post.author_id) === String(currentUserId);
    const profileName =
        typeof localStorage !== "undefined" ? localStorage.getItem("profile_name") ?? null : null;

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
                    title="게시글"
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
                    rightContent={
                        isOwner ? (
                            <Button
                                variant="outline"
                                size="md"
                                onClick={() => navigate(PATHS.boardEdit(id))}
                            >
                                수정
                            </Button>
                        ) : undefined
                    }
                />
                <div className="flex-1 overflow-y-auto pt-4 pb-24">
                    <PageContainer className="pt-2 flex flex-col gap-6 lg:px-24 xl:px-64">
                        {loading ? (
                            <div className="py-12 text-center text-gray-500 text-sm">불러오는 중...</div>
                        ) : !post ? null : (
                            (() => {
                                const commentFooter = (
                                    <BoardCommentSection
                                        post={post}
                                        currentUserId={currentUserId}
                                        authorName={profileName}
                                        embedded
                                    />
                                );
                                if (post.type === "vote" && post.body?.trim().startsWith("{")) {
                                    try {
                                        const parsed = JSON.parse(post.body) as {
                                            description?: string;
                                            options?: string[];
                                            allowMultiple?: boolean;
                                            optionImages?: string[];
                                        };
                                        const description = parsed.description?.trim() ?? "";
                                        const options = parsed.options ?? [];
                                        const optionImages = parsed.optionImages ?? [];
                                        const allowMultiple = !!parsed.allowMultiple;
                                        return (
                                            <BoardPostCard
                                                title={post.title || "—"}
                                                description={description}
                                                headerRight={
                                                    isOwner ? (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => navigate(PATHS.boardEdit(id))}
                                                        >
                                                            수정
                                                        </Button>
                                                    ) : undefined
                                                }
                                                authorName={post.author_name || "—"}
                                                authorEmail={post.author_email ?? null}
                                                createdAtLabel={formatBoardDateTimeKo(post.created_at)}
                                                chip={{ label: "투표", color: "blue-500", variant: "solid", size: "lg" }}
                                                vote={{
                                                    options,
                                                    optionImages,
                                                    allowMultiple,
                                                    selectedIndices: myVotes,
                                                    counts: voteCounts,
                                                    voteDisabled: voting,
                                                    onVote: (optionIndex, allowMulti, current) =>
                                                        handleVote(optionIndex, allowMulti, current),
                                                }}
                                                footer={commentFooter}
                                            />
                                        );
                                    } catch {
                                        return (
                                            <BoardPostCard
                                                title={post.title || "—"}
                                                body={post.body ?? ""}
                                                authorName={post.author_name || "—"}
                                                authorEmail={post.author_email ?? null}
                                                createdAtLabel={formatBoardDateTimeKo(post.created_at)}
                                                chip={{ label: "투표", color: "blue-500", variant: "solid", size: "lg" }}
                                                footer={commentFooter}
                                            />
                                        );
                                    }
                                }
                                return (
                                    <BoardPostCard
                                        title={post.title || "—"}
                                        body={post.body ?? ""}
                                        authorName={post.author_name || "—"}
                                        authorEmail={post.author_email ?? null}
                                        createdAtLabel={formatBoardDateTimeKo(post.created_at)}
                                        chip={
                                            post.type === "notice"
                                                ? { label: "공지사항", color: "red-500", variant: "solid", size: "lg" }
                                                : undefined
                                        }
                                        footer={commentFooter}
                                    />
                                );
                            })()
                        )}
                    </PageContainer>
                </div>
            </div>
        </div>
    );
}
