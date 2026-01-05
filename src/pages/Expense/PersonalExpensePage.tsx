import { useEffect, useState, useMemo } from "react";
import { useLocation } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/common/Header";
import MileageCard from "./components/MileageCard";
import ExpenseFormCard from "./components/ExpenseFormCard";
import ExpenseHistorySection, {
    ExpenseHistoryItem,
} from "./components/ExpenseHistorySection";
import YearMonthSelector from "../../components/common/YearMonthSelector";
import Button from "../../components/common/Button";

export default function PersonalExpensePage() {
    const location = useLocation();
    const params = new URLSearchParams(location.search);
    const preselectedDate = params.get("date") || null;

    const [leftItems, setLeftItems] = useState<any[]>([]);
    const [rightItems, setRightItems] = useState<any[]>([]);

    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [year, setYear] = useState("2025년");
    const [month, setMonth] = useState("11월");
    const [submittedIds, setSubmittedIds] = useState<number[]>([]);

    useEffect(() => {
        document.body.style.overflow = sidebarOpen ? "hidden" : "";
        return () => {
            document.body.style.overflow = "";
        };
    }, [sidebarOpen]);

    const yearOptions = useMemo(() => {
        const currentYear = new Date().getFullYear();
        return Array.from({ length: 5 }, (_, i) => currentYear - 2 + i).map(
            (y) => ({ value: `${y}년`, label: `${y}년` })
        );
    }, []);

    const monthOptions = useMemo(() => {
        return Array.from({ length: 12 }, (_, i) => i + 1).map((m) => ({
            value: `${m}월`,
            label: `${m}월`,
        }));
    }, []);

    const handleRemoveLeftItem = (id: number) => {
        setLeftItems((prev) => prev.filter((item) => item.id !== id));
        setSubmittedIds((prev) => prev.filter((itemId) => itemId !== id));
    };

    const handleRemoveRightItem = (id: number) => {
        setRightItems((prev) => prev.filter((item) => item.id !== id));
        setSubmittedIds((prev) => prev.filter((itemId) => itemId !== id));
    };

    const mileageHistory = useMemo<ExpenseHistoryItem[]>(
        () =>
            leftItems.map((it) => ({
                id: it.id,
                variant: "mileage" as const,
                date: it.date || "",
                amount: `${(it.cost || 0).toLocaleString("ko-KR")}원`,
                routeLabel: `${it.from || "출발지"} → ${it.to || "도착지"}`,
                distanceLabel: `${it.distance || 0}km`,
                desc: it.note || "",
            })),
        [leftItems]
    );

    const cardHistory = useMemo<ExpenseHistoryItem[]>(
        () =>
            rightItems.map((it) => ({
                id: it.id,
                variant: "card" as const,
                date: it.date || "",
                amount: `${Number(it.amount || 0).toLocaleString("ko-KR")}원`,
                tag: it.type || "기타",
                desc: it.detail || "",
                img: it.img || null,
            })),
        [rightItems]
    );

    return (
        <div className="flex h-screen bg-[#f5f7fb] overflow-hidden">
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-20 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

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

            <div className="flex-1 flex flex-col h-screen overflow-hidden w-full">
                <Header
                    title="개인 지출 기록"
                    onMenuClick={() => setSidebarOpen(true)}
                />

                <div className="flex-1 overflow-y-auto p-4 lg:p-9">
                    <div className="max-w-7xl mx-auto">
                        {/* 조회 기간 */}
                        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-[0px_12px_35px_rgba(15,23,42,0.06)] mb-8 flex flex-wrap items-center gap-4">
                            <h2 className="text-lg font-semibold text-gray-900">
                                조회 기간
                            </h2>
                            <YearMonthSelector
                                year={year}
                                month={month}
                                onYearChange={setYear}
                                onMonthChange={setMonth}
                                yearOptions={yearOptions}
                                monthOptions={monthOptions}
                            />
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-6 items-stretch">
                            <MileageCard
                                initialDate={preselectedDate || undefined}
                                onAdd={(item) =>
                                    setLeftItems((prev) => [item, ...prev])
                                }
                            />
                            <ExpenseFormCard
                                initialDate={preselectedDate || undefined}
                                onAdd={(item) =>
                                    setRightItems((prev) => [item, ...prev])
                                }
                            />
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                            <ExpenseHistorySection
                                title="개인 차량 마일리지 내역"
                                items={mileageHistory}
                                emptyMessage="등록된 마일리지 내역이 없습니다."
                                submittedIds={submittedIds}
                                onRemove={handleRemoveLeftItem}
                            />
                            <ExpenseHistorySection
                                title="개인 카드/현금 지출내역"
                                items={cardHistory}
                                emptyMessage="등록된 지출 내역이 없습니다."
                                submittedIds={submittedIds}
                                onRemove={handleRemoveRightItem}
                            />
                        </div>

                        <div className="fixed bottom-6 left-6 right-6 lg:left-[239px]">
                            <Button
                                variant="primary"
                                size="lg"
                                fullWidth
                                onClick={() => {
                                    alert(
                                        "제출 처리: " +
                                            (leftItems.length +
                                                rightItems.length) +
                                            "개"
                                    );
                                    const allIds = [
                                        ...leftItems.map((i) => i.id),
                                        ...rightItems.map((i) => i.id),
                                    ];
                                    setSubmittedIds(allIds);
                                }}
                            >
                                모두 제출 (
                                {leftItems.length + rightItems.length}개)
                            </Button>
                        </div>

                        <div className="h-24" />
                    </div>
                </div>
            </div>
        </div>
    );
}
