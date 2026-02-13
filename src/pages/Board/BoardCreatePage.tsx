import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/common/Header";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import Select from "../../components/common/Select";
import SectionCard from "../../components/ui/SectionCard";
import { IconArrowBack } from "../../components/icons/Icons";
import { createBoardPost, type BoardPostType, type BoardVisibility } from "../../lib/boardApi";
import { useUser } from "../../hooks/useUser";
import { useToast } from "../../components/ui/ToastProvider";
import { PATHS } from "../../utils/paths";
import PageContainer from "../../components/common/PageContainer";

const TYPE_OPTIONS: { value: BoardPostType; label: string }[] = [
    { value: "notice", label: "공지" },
    { value: "post", label: "게시물" },
    { value: "vote", label: "투표" },
];

const VISIBILITY_OPTIONS: { value: BoardVisibility; label: string }[] = [
    { value: "all", label: "모두에게 보이기" },
    { value: "staff", label: "staff 계정에만 보이기" },
    { value: "admin", label: "admin에게만 보이기" },
];

export default function BoardCreatePage() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [type, setType] = useState<BoardPostType>("post");
    const [visibility, setVisibility] = useState<BoardVisibility>("all");
    const [title, setTitle] = useState("");
    const [body, setBody] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const { currentUserId } = useUser();
    const navigate = useNavigate();
    const { showSuccess, showError } = useToast();

    const handleSubmit = async () => {
        const t = title.trim();
        if (!t) {
            showError("제목을 입력해 주세요.");
            return;
        }
        if (!currentUserId) {
            showError("로그인이 필요합니다.");
            return;
        }
        setSubmitting(true);
        try {
            const profileName =
                typeof localStorage !== "undefined"
                    ? localStorage.getItem("profile_name") ?? null
                    : null;
            const post = await createBoardPost(currentUserId, profileName, {
                title: t,
                body: body.trim() || undefined,
                type,
                visibility,
            });
            showSuccess("글이 등록되었습니다.");
            navigate(PATHS.boardDetail(post.id));
        } catch (e: any) {
            console.error(e);
            showError(e?.message ?? "글 등록에 실패했습니다.");
        } finally {
            setSubmitting(false);
        }
    };

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
                    title="게시글 작성"
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
                        <SectionCard title="글쓰기">
                            <div className="flex flex-col gap-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                                        내용
                                    </label>
                                    <textarea
                                        value={body}
                                        onChange={(e) => setBody(e.target.value)}
                                        placeholder="내용을 입력하세요"
                                        rows={8}
                                        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-[15px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                    />
                                </div>
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
                                        disabled={submitting}
                                    >
                                        {submitting ? "등록 중..." : "등록"}
                                    </Button>
                                </div>
                            </div>
                        </SectionCard>
                    </PageContainer>
                </div>
            </div>
        </div>
    );
}
