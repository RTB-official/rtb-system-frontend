import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/common/Header";
import Button from "../../components/common/Button";
import SectionCard from "../../components/ui/SectionCard";
import Chip from "../../components/ui/Chip";
import { IconArrowBack } from "../../components/icons/Icons";
import {
    getBoardPostById,
    markBoardPostAsRead,
    type BoardPost,
    type BoardPostType,
} from "../../lib/boardApi";
import { useUser } from "../../hooks/useUser";
import { PATHS } from "../../utils/paths";
import PageContainer from "../../components/common/PageContainer";

function formatBoardDateTime(iso: string) {
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const h = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    return `${y}.${m}.${day} ${h}:${min}`;
}

const TYPE_LABEL: Record<BoardPostType, string> = {
    notice: "공지사항",
    post: "게시물",
    vote: "투표",
};

export default function BoardDetailPage() {
    const { id } = useParams<{ id: string }>();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [post, setPost] = useState<BoardPost | null>(null);
    const [loading, setLoading] = useState(true);
    const { currentUserId } = useUser();
    const navigate = useNavigate();

    useEffect(() => {
        if (!id || !currentUserId) return;
        let mounted = true;
        (async () => {
            try {
                const p = await getBoardPostById(id);
                if (mounted && p) {
                    setPost(p);
                    await markBoardPostAsRead(currentUserId, id);
                }
            } catch (e) {
                console.error(e);
            } finally {
                if (mounted) setLoading(false);
            }
        })();
        return () => {
            mounted = false;
        };
    }, [id, currentUserId]);

    if (!id) {
        navigate(PATHS.board);
        return null;
    }

    return (
        <div className="flex h-screen bg-[#f9fafb] overflow-hidden">
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
                />
                <div className="flex-1 overflow-y-auto pt-4 pb-24">
                    <PageContainer className="pt-2">
                        {loading ? (
                            <SectionCard title="로딩 중...">
                                <div className="py-8 text-center text-gray-500 text-sm">
                                    로딩 중...
                                </div>
                            </SectionCard>
                        ) : !post ? (
                            <SectionCard title="게시글">
                                <div className="py-8 text-center text-gray-500 text-sm">
                                    글을 찾을 수 없습니다.
                                </div>
                                <div className="flex justify-center">
                                    <Button variant="outline" onClick={() => navigate(PATHS.board)}>
                                        목록으로
                                    </Button>
                                </div>
                            </SectionCard>
                        ) : (
                            <SectionCard title={post.title}>
                                <div className="flex flex-col gap-4">
                                    <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
                                        {post.type === "notice" && (
                                            <Chip color="amber-600" variant="filled" size="sm">
                                                {TYPE_LABEL[post.type]}
                                            </Chip>
                                        )}
                                        <span>작성자: {post.author_name || "—"}</span>
                                        <span>{formatBoardDateTime(post.created_at)}</span>
                                    </div>
                                    <div className="border-t border-gray-100 pt-4">
                                        <p className="text-[15px] text-gray-800 whitespace-pre-line">
                                            {post.body || "—"}
                                        </p>
                                    </div>
                                    <div className="flex justify-end pt-2">
                                        <Button
                                            variant="outline"
                                            size="lg"
                                            onClick={() => navigate(PATHS.board)}
                                        >
                                            목록으로
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
