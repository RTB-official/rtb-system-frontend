//MembersPage.tsx
import { useMemo, useState } from "react";
import Sidebar from "../../components/Sidebar";
import AppHeader from "../../layout/headers/AppHeader";
import AddMemberModal from "../../components/modals/AddMemberModal";
import MemberActionMenu from "../../components/modals/MemberActionMenu";

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
    etc: "M12234567\nKANG MINJI",
  },
  ...Array.from({ length: 9 }).map((_, i) => ({
    id: String(i + 2),
    name: "강민지",
    username: "mj.kang",
    role:
      ["감사", "부장", "차장", "과장", "대리", "대리", "주임", "사원", "사원"][i] ||
      "사원",
    phone: "010-1234-5678",
    address1: "서울특별시 용산구 한강대로 151, △△",
    address2: "빌딩 301호 (한강로3가)",
    joinDate: "211220",
    birth: "990312",
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

function Header({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="sticky top-0 z-10 bg-white border-b border-[#e5e7eb]">
      <div className="px-6 py-4 flex items-center justify-between">
        <h1 className="text-[20px] font-semibold text-[#101828]">구성원 관리</h1>
        <button
          onClick={onAdd}
          className="h-10 px-4 rounded-xl bg-[#364153] text-white text-[14px] font-medium hover:opacity-90 transition"
        >
          <span className="inline-flex items-center gap-2">
            <span className="text-[18px] leading-none">+</span>
            구성원 추가
          </span>
        </button>
      </div>
    </div>
  );
}

function Tabs({
  active,
  onChange,
  total,
  admin,
  staff,
}: {
  active: "ALL" | "ADMIN" | "STAFF";
  onChange: (v: "ALL" | "ADMIN" | "STAFF") => void;
  total: number;
  admin: number;
  staff: number;
}) {
  const tabClass = (isActive: boolean) =>
    `text-[14px] font-medium ${
      isActive ? "text-[#101828]" : "text-[#6a7282] hover:text-[#101828]"
    }`;

  return (
    <div className="flex items-center gap-4">
      <button className={tabClass(active === "ALL")} onClick={() => onChange("ALL")}>
        전체 <span className="text-[#101828]">{total}</span>
      </button>
      <button className={tabClass(active === "ADMIN")} onClick={() => onChange("ADMIN")}>
        공무팀 <span className="text-[#101828]">{admin}</span>
      </button>
      <button className={tabClass(active === "STAFF")} onClick={() => onChange("STAFF")}>
        공사팀 <span className="text-[#101828]">{staff}</span>
      </button>
    </div>
  );
}

export default function MembersPage() {
  const [activeTab, setActiveTab] = useState<"ALL" | "ADMIN" | "STAFF">("ALL");
  const [page, setPage] = useState(1);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Add Member Modal
  const [addModalOpen, setAddModalOpen] = useState(false);

  // ... Action Menu
  const [actionOpen, setActionOpen] = useState(false);
  const [actionAnchor, setActionAnchor] = useState<HTMLElement | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  // TODO: 실제 데이터 연동 시 탭별 필터링만 교체
  const members = useMemo(() => {
    return mockMembers;
  }, [activeTab]);

  // 데모 카운트(실데이터 연결하면 서버/스토어 값으로 교체)
  const totalCount = 24;
  const adminCount = 8;
  const staffCount = 16;

  const pageCount = 3;

  const handleAdd = () => setAddModalOpen(true);

  return (
    <div className="flex h-screen bg-[#f9fafb] overflow-hidden">
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
          w-[239px] h-screen flex-shrink-0
          transform transition-transform duration-300 ease-in-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        <Sidebar onClose={() => setSidebarOpen(false)} activeMenu="구성원 관리" />
      </div>


      {/* Main */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <div className="sticky top-0 z-10 flex-shrink-0">
          <AppHeader
            title="구성원 관리"
            onMenuClick={() => setSidebarOpen(true)}
            actions={
              <button
                onClick={handleAdd}
                className="h-9 px-3 rounded-lg bg-[#364153] text-white text-[13px] font-medium hover:opacity-90 transition inline-flex items-center gap-2"
              >
                <span className="text-[18px] leading-none">+</span>
                구성원 추가
              </button>
            }
          />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-6 py-6">
            {/* Tabs row */}
            <div className="mb-4">
              <Tabs
                active={activeTab}
                onChange={(v) => {
                  setActiveTab(v);
                  setPage(1);
                }}
                total={totalCount}
                admin={adminCount}
                staff={staffCount}
              />
            </div>

            {/* Table Card */}
            <div className="bg-white border border-[#e5e7eb] rounded-2xl overflow-hidden">
              {/* 가로 스크롤 안전장치 */}
              <div className="overflow-x-auto">
                <div className="min-w-[980px]">
                  {/* Table header */}
                  <div className="px-4 py-3 bg-[#f9fafb] border-b border-[#e5e7eb]">
                    <div
                      className="grid items-center text-[14px] font-semibold text-[#101828]"
                      style={{
                        gridTemplateColumns:
                          "2.2fr 1.1fr 1.6fr 3.6fr 1.1fr 1.1fr 1.6fr",
                      }}
                    >
                      <div>이름</div>
                      <div>직급</div>
                      <div>전화번호</div>
                      <div>주소</div>
                      <div>입사일</div>
                      <div>생년월일</div>
                      <div>여권정보</div>
                    </div>
                  </div>

                  {/* Table body */}
                  <div className="divide-y divide-[#f2f4f7]">
                    {members.map((m) => (
                      <div key={m.id} className="px-4 py-4">
                        <div
                          className="grid items-center"
                          style={{
                            gridTemplateColumns:
                              "2.2fr 1.1fr 1.6fr 3.6fr 1.1fr 1.1fr 1.6fr",
                          }}
                        >
                          {/* name */}
                          <div className="flex items-center gap-3">
                            <BadgeAvatar name={m.name} />
                            <div className="leading-tight">
                              <div className="text-[14px] font-semibold text-[#101828]">
                                {m.name}
                              </div>
                              <div className="text-[12px] text-[#6a7282]">{m.username}</div>
                            </div>
                          </div>

                          {/* role */}
                          <div className="text-[14px] text-[#101828]">{m.role}</div>

                          {/* phone */}
                          <div className="text-[14px] text-[#101828]">{m.phone}</div>

                          {/* address */}
                          <div className="text-[14px] text-[#101828] min-w-0">
                            <div>{m.address1}</div>
                            <div className="text-[12px] text-[#6a7282] mt-1">{m.address2}</div>
                          </div>

                          {/* join */}
                          <div className="text-[14px] text-[#101828]">{m.joinDate}</div>

                          {/* birth */}
                          <div className="text-[14px] text-[#101828]">{m.birth}</div>

                          {/* passport / etc + kebab */}
                          <div className="flex items-start pr-2">
                            <div className="flex-1 min-w-0 whitespace-pre-line text-[12px] text-[#6a7282]">
                              {m.etc}
                            </div>

                            <button
                              className="ml-3 flex-none w-8 h-8 rounded-lg hover:bg-[#f2f4f7] transition flex items-center justify-center text-[#6a7282]"
                              onClick={(e) => {
                                setSelectedMemberId(m.id);
                                setActionAnchor(e.currentTarget);
                                setActionOpen((prev) => !prev);
                              }}
                              aria-label="more"
                            >
                              <span className="text-[18px] leading-none">···</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Pagination */}
                  <div className="px-4 py-4 flex items-center justify-center gap-3">
                    <button
                      className="w-8 h-8 rounded-full hover:bg-[#f2f4f7] text-[#6a7282] disabled:opacity-40"
                      disabled={page === 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      ‹
                    </button>

                    {Array.from({ length: pageCount }).map((_, idx) => {
                      const n = idx + 1;
                      const active = n === page;
                      return (
                        <button
                          key={n}
                          onClick={() => setPage(n)}
                          className={`w-8 h-8 rounded-full text-[14px] ${
                            active
                              ? "bg-[#f2f4f7] text-[#101828] font-semibold"
                              : "text-[#6a7282] hover:bg-[#f2f4f7]"
                          }`}
                        >
                          {n}
                        </button>
                      );
                    })}

                    <button
                      className="w-8 h-8 rounded-full hover:bg-[#f2f4f7] text-[#6a7282] disabled:opacity-40"
                      disabled={page === pageCount}
                      onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                    >
                      ›
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* 바닥 여백 */}
            <div className="h-8" />
          </div>
        </div>
      </div>

      {/* Add Member Modal */}
      <AddMemberModal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSubmit={(payload) => {
          console.log("추가 payload:", payload);
          // TODO: 여기서 API 호출 또는 멤버 리스트 state 업데이트
        }}
      />

      {/* ... Action Menu (수정/삭제) */}
      <MemberActionMenu
        isOpen={actionOpen}
        anchorEl={actionAnchor}
        onClose={() => {
          setActionOpen(false);
          setActionAnchor(null);
        }}
        onEdit={() => {
          console.log("수정:", selectedMemberId);
          alert(`수정: ${selectedMemberId}`);
          // TODO: 수정 모달 열기(예: EditMemberModal)
        }}
        onDelete={() => {
          console.log("삭제:", selectedMemberId);
          if (confirm("정말 삭제하시겠습니까?")) {
            alert(`삭제 완료: ${selectedMemberId}`);
            // TODO: 삭제 API 호출 및 목록 갱신
          }
        }}
      />
    </div>
  );
}
