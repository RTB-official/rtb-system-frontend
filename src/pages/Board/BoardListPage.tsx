import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/common/Header";
import Table from "../../components/common/Table";
import Button from "../../components/common/Button";
import SectionCard from "../../components/ui/SectionCard";
import Chip from "../../components/ui/Chip";
import { IconPlus } from "../../components/icons/Icons";
import { getBoardPosts, type BoardPostRow } from "../../lib/boardApi";
import { useUser } from "../../hooks/useUser";
import { PATHS } from "../../utils/paths";
import PageContainer from "../../components/common/PageContainer";

function formatBoardDate(iso: string) {
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const h = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    return { date: `${y}.${m}.${day}`, time: `${h}:${min}` };
}

export default function BoardListPage() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [posts, setPosts] = useState<BoardPostRow[]>([]);
    const [loading, setLoading] = useState(true);
    const { currentUserId } = useUser();
    const navigate = useNavigate();

    const loadPosts = async () => {
        if (!currentUserId) return;
        setLoading(true);
        try {
            const list = await getBoardPosts(currentUserId);
            setPosts(list);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadPosts();
    }, [currentUserId]);

    const columns = [
        {
            key: "author_name",
            label: "작성자",
            width: "120px",
            render: (_: unknown, row: BoardPostRow) => (
                <span className={row.read_at ? "text-gray-700" : "text-gray-800"}>
                    {row.author_name || "—"}
                </span>
            ),
        },
        {
            key: "title",
            label: "제목",
            render: (_: unknown, row: BoardPostRow) => (
                <div className="flex items-center gap-2">
                    {row.type === "notice" && (
                        <Chip color="amber-600" variant="filled" size="sm">
                            공지사항
                        </Chip>
                    )}
                    <span className={row.read_at ? "text-gray-700" : "text-gray-800"}>
                        {row.title || "—"}
                    </span>
                </div>
            ),
        },
        {
            key: "created_at",
            label: "작성일자",
            width: "100px",
            render: (_: unknown, row: BoardPostRow) => {
                const { date } = formatBoardDate(row.created_at);
                return (
                    <span className={row.read_at ? "text-gray-700" : "text-gray-800"}>{date}</span>
                );
            },
        },
        {
            key: "time",
            label: "시간",
            width: "80px",
            render: (_: unknown, row: BoardPostRow) => {
                const { time } = formatBoardDate(row.created_at);
                return (
                    <span className={row.read_at ? "text-gray-700" : "text-gray-800"}>{time}</span>
                );
            },
        },
    ];

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
                    <PageContainer className="pt-2">
                        <SectionCard
                            title="게시글 목록"
                            headerContent={
                                <Button
                                    variant="outline"
                                    size="md"
                                    onClick={() => navigate(PATHS.boardCreate)}
                                    icon={<IconPlus />}
                                >
                                    글쓰기
                                </Button>
                            }
                        >
                            {loading ? (
                                <div className="py-12 text-center text-gray-500 text-sm">
                                    로딩 중...
                                </div>
                            ) : posts.length === 0 ? (
                                <div className="py-12 text-center text-gray-500 text-sm">
                                    게시글이 없습니다.
                                </div>
                            ) : (
                                <Table<BoardPostRow>
                                    columns={columns}
                                    data={posts}
                                    rowKey="id"
                                    onRowClick={(row) => navigate(PATHS.boardDetail(row.id))}
                                    rowClassName={(row) =>
                                        row.read_at ? "text-gray-700" : "text-gray-800"
                                    }
                                />
                            )}
                        </SectionCard>
                    </PageContainer>
                </div>
            </div>
        </div>
    );
}
