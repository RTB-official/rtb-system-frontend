//MembersPage.tsx
import { useMemo, useState } from "react";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/common/Header";
import Tabs from "../../components/common/Tabs";
import ActionMenu from "../../components/common/ActionMenu";
import AddMemberModal from "../../components/modals/AddMemberModal";
import ResetPasswordModal from "../../components/modals/ResetPasswordModal";
import Table from "../../components/common/Table";
import Chip from "../../components/ui/Chip";
import { IconMore } from "../../components/icons/Icons";

type Member = {
    id: string;
    name: string;
    username: string; // 아래 작은 글씨
    role: string; // 직급
    phone: string;
    address1: string;
    address2: string;
    joinDate: string; // yymmdd or yyyymmdd 형태
    birth: string; // yymmdd
    passportNo: string;
    passportLastName: string;
    passportFirstName: string;
    passportExpiry: string; // YYMMDD
    etc: string; // 예: M12234567 / KANG MINJI
};

const mockMembers: Member[] = [
    {
        id: "1",
        name: "강민지",
        username: "mj.kang",
        role: "대표",
        phone: "010-1234-5678",
        address1: "서울특별시 용산구 한강대로 151, △△",
        address2: "빌딩 301호 (한강로3가)",
        joinDate: "211220",
        birth: "990312",
        passportNo: "M12234567",
        passportLastName: "KANG",
        passportFirstName: "MINJI",
        passportExpiry: "251227",
        etc: "M12234567\nKANG MINJI",
    },
    ...Array.from({ length: 9 }).map((_, i) => ({
        id: String(i + 2),
        name: "강민지",
        username: "mj.kang",
        role:
            [
                "감사",
                "부장",
                "차장",
                "과장",
                "대리",
                "대리",
                "주임",
                "사원",
                "사원",
            ][i] || "사원",
        phone: "010-1234-5678",
        address1: "서울특별시 용산구 한강대로 151, △△",
        address2: "빌딩 301호 (한강로3가)",
        joinDate: "211220",
        birth: "990312",
        passportNo: "M12234567",
        passportLastName: "KANG",
        passportFirstName: "MINJI",
        passportExpiry: "251227",
        etc: "M12234567\nKANG MINJI",
    })),
];

function BadgeAvatar({ name }: { name: string }) {
    return (
        <div className="w-6 h-6 rounded-full bg-[#F79009] flex items-center justify-center text-white text-[12px] font-semibold">
            {name?.slice(0, 1) || "U"}
        </div>
    );
}

export default function MembersPage() {
    const [activeTab, setActiveTab] = useState<"ALL" | "ADMIN" | "STAFF">(
        "ALL"
    );
    const [page, setPage] = useState(1);
    const [sidebarOpen, setSidebarOpen] = useState(false);

    // Edit Member Modal
    const [editModalOpen, setEditModalOpen] = useState(false);

    // Reset Password Modal
    const [resetPasswordModalOpen, setResetPasswordModalOpen] = useState(false);

    // ... Action Menu
    const [actionOpen, setActionOpen] = useState(false);
    const [actionAnchor, setActionAnchor] = useState<HTMLElement | null>(null);
    const [selectedMemberId, setSelectedMemberId] = useState<string | null>(
        null
    );

    // TODO: 실제 데이터 연동 시 탭별 필터링만 교체
    const members = useMemo(() => {
        return mockMembers;
    }, [activeTab]);

    // 데모 카운트(실데이터 연결하면 서버/스토어 값으로 교체)
    const totalCount = 24;
    const adminCount = 8;
    const staffCount = 16;

    const pageCount = 3;

    const selectedMember = members.find((m) => m.id === selectedMemberId);

    const handleResetPassword = () => {
        setResetPasswordModalOpen(true);
    };

    return (
        <div className="flex h-screen bg-white overflow-hidden">
            {/* Mobile Overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-20 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar - 데스크탑 고정, 모바일 슬라이드 */}
            <div
                className={`
          fixed lg:static inset-y-0 left-0 z-30
          w-[239px] h-screen shrink-0
          transform transition-transform duration-300 ease-in-out
          ${
              sidebarOpen
                  ? "translate-x-0"
                  : "-translate-x-full lg:translate-x-0"
          }
        `}
            >
                <Sidebar onClose={() => setSidebarOpen(false)} />
            </div>

            {/* Main */}
            <div className="flex-1 flex flex-col h-screen overflow-hidden">
                <Header
                    title="구성원 관리"
                    onMenuClick={() => setSidebarOpen(true)}
                />

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-10">
                    <div className="py-9">
                        {/* Tabs row */}
                        <div className="mb-4">
                            <Tabs
                                items={[
                                    {
                                        value: "ALL",
                                        label: `전체 ${totalCount}`,
                                    },
                                    {
                                        value: "ADMIN",
                                        label: `공무팀 ${adminCount}`,
                                    },
                                    {
                                        value: "STAFF",
                                        label: `공사팀 ${staffCount}`,
                                    },
                                ]}
                                value={activeTab}
                                onChange={(v) => {
                                    setActiveTab(
                                        v as "ALL" | "ADMIN" | "STAFF"
                                    );
                                    setPage(1);
                                }}
                            />
                        </div>

                        {/* Table Card */}
                        <div className="overflow-x-auto">
                            <div className="min-w-[980px]">
                                <Table
                                    columns={[
                                        {
                                            key: "name",
                                            label: "이름",
                                            render: (_, row) => (
                                                <div className="flex items-center gap-3">
                                                    <BadgeAvatar
                                                        name={row.name}
                                                    />
                                                    <div className="leading-tight">
                                                        <div className="text-[14px] font-semibold text-gray-900">
                                                            {row.name}
                                                        </div>
                                                        <div className="text-[12px] text-gray-500">
                                                            {row.username}
                                                        </div>
                                                    </div>
                                                </div>
                                            ),
                                        },
                                        {
                                            key: "role",
                                            label: "직급",
                                            render: (value) => (
                                                <div className="text-[14px] text-gray-900">
                                                    {value}
                                                </div>
                                            ),
                                        },
                                        {
                                            key: "phone",
                                            label: "전화번호",
                                            render: (value) => (
                                                <div className="text-[14px] text-gray-900">
                                                    {value}
                                                </div>
                                            ),
                                        },
                                        {
                                            key: "address",
                                            label: "주소",
                                            render: (_, row) => (
                                                <div className="text-[14px] text-gray-900 min-w-0">
                                                    <div>{row.address1}</div>
                                                    <div className="text-[12px] text-gray-500 mt-1">
                                                        {row.address2}
                                                    </div>
                                                </div>
                                            ),
                                        },
                                        {
                                            key: "joinDate",
                                            label: "입사일",
                                            render: (value) => (
                                                <div className="text-[14px] text-gray-900">
                                                    {value}
                                                </div>
                                            ),
                                        },
                                        {
                                            key: "birth",
                                            label: "생년월일",
                                            render: (value) => (
                                                <div className="text-[14px] text-gray-900">
                                                    {value}
                                                </div>
                                            ),
                                        },
                                        {
                                            key: "etc",
                                            label: "여권정보",
                                            render: (_, row) => {
                                                // 251227 -> 25년 12월 만료 형식으로 변환 (YYMMDD)
                                                let formattedExpiry = "";
                                                if (
                                                    row.passportExpiry &&
                                                    row.passportExpiry
                                                        .length === 6
                                                ) {
                                                    const year =
                                                        row.passportExpiry.slice(
                                                            0,
                                                            2
                                                        );
                                                    const month = parseInt(
                                                        row.passportExpiry.slice(
                                                            2,
                                                            4
                                                        ),
                                                        10
                                                    );
                                                    formattedExpiry = `${year}년 ${month}월 만료`;
                                                }

                                                return (
                                                    <div className="flex items-start pr-2">
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <span className="text-[14px] font-semibold text-gray-900">
                                                                    {row.passportNo ||
                                                                        "-"}
                                                                </span>
                                                                {formattedExpiry && (
                                                                    <Chip
                                                                        color="red-600"
                                                                        variant="solid"
                                                                        size="sm"
                                                                    >
                                                                        {
                                                                            formattedExpiry
                                                                        }
                                                                    </Chip>
                                                                )}
                                                            </div>
                                                            <div className="text-[12px] text-gray-500 uppercase tracking-tight -mt-1">
                                                                {
                                                                    row.passportLastName
                                                                }{" "}
                                                                {
                                                                    row.passportFirstName
                                                                }
                                                            </div>
                                                        </div>
                                                        <button
                                                            className="ml-3 flex-none w-8 h-8 rounded-lg hover:bg-gray-100 transition flex items-center justify-center text-gray-400"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setSelectedMemberId(
                                                                    row.id
                                                                );
                                                                setActionAnchor(
                                                                    e.currentTarget
                                                                );
                                                                setActionOpen(
                                                                    (prev) =>
                                                                        !prev
                                                                );
                                                            }}
                                                            aria-label="more"
                                                        >
                                                            <IconMore className="w-5 h-5" />
                                                        </button>
                                                    </div>
                                                );
                                            },
                                        },
                                    ]}
                                    data={members}
                                    rowKey="id"
                                    pagination={{
                                        currentPage: page,
                                        totalPages: pageCount,
                                        onPageChange: setPage,
                                    }}
                                />
                            </div>
                        </div>

                        {/* 바닥 여백 */}
                        <div className="h-8" />
                    </div>
                </div>
            </div>

            {/* Edit Member Modal */}
            <AddMemberModal
                isOpen={editModalOpen}
                onClose={() => setEditModalOpen(false)}
                member={selectedMember}
                onSubmit={(payload) => {
                    console.log("수정 payload:", payload);
                    // TODO: 여기서 API 호출 또는 멤버 리스트 state 업데이트
                }}
            />

            {/* Action Menu (수정/삭제/비밀번호 재설정) */}
            <ActionMenu
                isOpen={actionOpen}
                anchorEl={actionAnchor}
                onClose={() => {
                    setActionOpen(false);
                    setActionAnchor(null);
                }}
                onEdit={() => {
                    setEditModalOpen(true);
                }}
                onResetPassword={handleResetPassword}
                onDelete={() => {
                    console.log("삭제:", selectedMemberId);
                    if (confirm("정말 삭제하시겠습니까?")) {
                        alert(`삭제 완료: ${selectedMemberId}`);
                        // TODO: 삭제 API 호출 및 목록 갱신
                    }
                }}
                width="w-44"
            />

            {/* Reset Password Modal */}
            <ResetPasswordModal
                isOpen={resetPasswordModalOpen}
                memberName={selectedMember?.name}
                onClose={() => setResetPasswordModalOpen(false)}
                onSubmit={(payload) => {
                    console.log("비밀번호 재설정:", selectedMemberId, payload);
                    // TODO: 여기서 API 호출
                    alert(
                        `${selectedMember?.name}님의 비밀번호가 재설정되었습니다.`
                    );
                }}
            />
        </div>
    );
}
