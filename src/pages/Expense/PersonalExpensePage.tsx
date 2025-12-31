import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import ExpenseHeader from "./ExpenseHeader";
import MileageCard from "./components/MileageCard";
import ExpenseFormCard from "./components/ExpenseFormCard";
import ExpenseListItem from "./components/ExpenseListItem";

// ✅ 햄버거 아이콘 (가로줄 3개)
const IconHamburger = () => (
    <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
    >
        <path
            d="M4 6h16"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
        />
        <path
            d="M4 12h16"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
        />
        <path
            d="M4 18h16"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
        />
    </svg>
);

export default function PersonalExpensePage() {
    const location = useLocation();
    const params = new URLSearchParams(location.search);
    const preselectedDate = params.get("date") || null;

    const [leftItems, setLeftItems] = useState<any[]>([]);
    const [rightItems, setRightItems] = useState<any[]>([]);

    // ✅ 모바일 사이드바 토글 상태
    const [sidebarOpen, setSidebarOpen] = useState(false);

    // ✅ 사이드바 열려있을 때 모바일에서 body 스크롤 잠금(선택)
    useEffect(() => {
        document.body.style.overflow = sidebarOpen ? "hidden" : "";
        return () => {
            document.body.style.overflow = "";
        };
    }, [sidebarOpen]);

    return (
        <div className="flex h-screen bg-[#f4f5f7] overflow-hidden">
            {/* ✅ Mobile Overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-20 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* ✅ Sidebar - 데스크탑 고정, 모바일 슬라이드 */}
            <div
                className={`
          fixed lg:static inset-y-0 left-0 z-30
          w-[239px] h-screen flex-shrink-0
          transform transition-transform duration-300 ease-in-out
          ${
              sidebarOpen
                  ? "translate-x-0"
                  : "-translate-x-full lg:translate-x-0"
          }
        `}
            >
                <Sidebar
                    onClose={() => setSidebarOpen(false)}
                    activeMenu="지출 관리"
                    activeSubMenu="개인 지출"
                />
            </div>

            {/* ✅ Main Content (모바일에서는 ml 제거, 데스크탑에서만 Sidebar 만큼 밀기) */}
            <div className="flex-1 min-w-0 overflow-hidden lg:ml-[239px]">
                {/* ✅ 모바일 상단바(햄버거 + 타이틀) */}
                <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100">
                    <button
                        onClick={() => setSidebarOpen(true)}
                        aria-label="사이드바 열기"
                        className="p-2 rounded-lg hover:bg-gray-100 active:bg-gray-200 transition-colors text-[#101828]"
                    >
                        <IconHamburger />
                    </button>
                    <div className="text-sm font-semibold text-gray-800">
                        개인 지출
                    </div>
                    <div className="w-10" />
                </div>

                {/* ✅ 스크롤 영역 */}
                <div className="h-full overflow-y-auto p-3">
                    <div className="w-full px-6">
                        <ExpenseHeader year="2025년" month="11월" />

                        <div className="mb-4">
                            <div className="flex items-center gap-3">
                                <span className="text-base font-semibold text-gray-700">
                                    조회 기간
                                </span>
                                <select className="border rounded-md px-4 py-2 text-base bg-white">
                                    <option>2025년</option>
                                </select>
                                <select className="border rounded-md px-4 py-2 text-base bg-white">
                                    <option>11월</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 items-stretch">
                            <div>
                                <MileageCard
                                    initialDate={preselectedDate || undefined}
                                    onAdd={(item) =>
                                        setLeftItems((prev) => [item, ...prev])
                                    }
                                />
                            </div>
                            <div>
                                <ExpenseFormCard
                                    initialDate={preselectedDate || undefined}
                                    onAdd={(item) =>
                                        setRightItems((prev) => [item, ...prev])
                                    }
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
                            <div>
                                {leftItems.length === 0 ? (
                                    <div className="text-gray-400 py-8 text-center rounded border border-dashed border-gray-100">
                                        등록된 마일리지 내역이 없습니다.
                                    </div>
                                ) : (
                                    leftItems.map((it) => (
                                        <ExpenseListItem
                                            key={it.id}
                                            date={it.date || ""}
                                            tag={"개인"}
                                            desc={it.note || ""}
                                            amount={`${it.distance || 0}km`}
                                            tagColor="#3b82f6"
                                        />
                                    ))
                                )}
                            </div>

                            <div>
                                {rightItems.length === 0 ? (
                                    <div className="text-gray-400 py-8 text-center rounded border border-dashed border-gray-100">
                                        등록된 지출 내역이 없습니다.
                                    </div>
                                ) : (
                                    rightItems.map((it) => (
                                        <ExpenseListItem
                                            key={it.id}
                                            date={it.date || ""}
                                            tag={it.type || "기타"}
                                            desc={it.detail || ""}
                                            amount={`${it.amount || "0"}원`}
                                            tagColor={
                                                it.type === "교통비"
                                                    ? "#fb923c"
                                                    : "#94a3b8"
                                            }
                                            img={it.img}
                                        />
                                    ))
                                )}
                            </div>
                        </div>

                        {/* ✅ submit bar (데스크탑에서는 Sidebar만큼 왼쪽 여백, 모바일에서는 전체폭) */}
                        <div className="fixed bottom-6 left-6 right-6 lg:left-[239px]">
                            <button
                                onClick={() =>
                                    alert(
                                        "제출 처리: " +
                                            (leftItems.length +
                                                rightItems.length) +
                                            "개"
                                    )
                                }
                                className="w-full bg-[#364153] text-white rounded-full py-3 text-center font-medium"
                            >
                                모두 제출 (
                                {leftItems.length + rightItems.length}개)
                            </button>
                        </div>

                        {/* fixed submit bar 때문에 내용 가려지지 않도록 여백 */}
                        <div className="h-24" />
                    </div>
                </div>
            </div>
        </div>
    );
}
