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
    const currentDate = new Date();
    const [year, setYear] = useState(`${currentDate.getFullYear()}년`);
    const [month, setMonth] = useState(`${currentDate.getMonth() + 1}월`);
    const [submittedIds, setSubmittedIds] = useState<number[]>([]);

    const allItemsToSubmitCount = useMemo(() => {
        const unsubmittedLeftItems = leftItems.filter(
            (item) => !submittedIds.includes(item.id)
        );
        const unsubmittedRightItems = rightItems.filter(
            (item) => !submittedIds.includes(item.id)
        );
        return unsubmittedLeftItems.length + unsubmittedRightItems.length;
    }, [leftItems, rightItems, submittedIds]);

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

    // 날짜 필터링 함수
    const matchesFilter = (dateStr: string) => {
        if (!dateStr) return false;
        try {
            const date = new Date(dateStr);
            // Invalid date 체크
            if (isNaN(date.getTime())) return false;

            const selectedYear = parseInt(year.replace("년", ""));
            const selectedMonth = parseInt(month.replace("월", ""));

            return (
                date.getFullYear() === selectedYear &&
                date.getMonth() + 1 === selectedMonth
            );
        } catch (e) {
            return false;
        }
    };

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
            leftItems
                .filter((it) => matchesFilter(it.date || ""))
                .map((it) => ({
                    id: it.id,
                    variant: "mileage" as const,
                    date: it.date || "",
                    amount: `${(it.cost || 0).toLocaleString("ko-KR")}원`,
                    routeLabel: `${it.from || "출발지"} → ${it.to || "도착지"}`,
                    distanceLabel: `${it.distance || 0}km`,
                    desc: it.note || "",
                })),
        [leftItems, year, month]
    );

    const cardHistory = useMemo<ExpenseHistoryItem[]>(
        () =>
            rightItems
                .filter((it) => matchesFilter(it.date || ""))
                .map((it) => ({
                    id: it.id,
                    variant: "card" as const,
                    date: it.date || "",
                    amount: `${Number(it.amount || 0).toLocaleString(
                        "ko-KR"
                    )}원`,
                    tag: it.type || "기타",
                    desc: it.detail || "",
                    img: it.img || null,
                })),
        [rightItems, year, month]
    );

    return (
        <div className="flex h-screen bg-white overflow-hidden">
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

                <div className="flex-1 overflow-y-auto py-4 lg:py-9 px-9">
                    {/* 조회 기간 */}
                    <div className="mb-8 flex flex-wrap items-center gap-4">
                        <h2 className="text-[24px] font-semibold text-gray-900">
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

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-6 items-stretch w-full">
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

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start w-full">
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

                    {allItemsToSubmitCount > 0 && (
                        <div className="fixed bottom-6 left-6 right-6 lg:left-[239px] mx-9">
                            <Button
                                variant="primary"
                                size="lg"
                                fullWidth
                                onClick={() => {
                                    const itemsToSubmitLeft = leftItems.filter(
                                        (item) =>
                                            !submittedIds.includes(item.id)
                                    );
                                    const itemsToSubmitRight =
                                        rightItems.filter(
                                            (item) =>
                                                !submittedIds.includes(item.id)
                                        );

                                    const currentItemsToSubmitCount =
                                        itemsToSubmitLeft.length +
                                        itemsToSubmitRight.length;

                                    if (currentItemsToSubmitCount === 0) {
                                        alert("제출할 항목이 없습니다.");
                                        return;
                                    }

                                    const confirmSubmit = window.confirm(
                                        `총 ${currentItemsToSubmitCount}개의 항목을 제출하시겠습니까?`
                                    );
                                    if (!confirmSubmit) return;

                                    const allIdsToSubmit = [
                                        ...itemsToSubmitLeft.map((i) => i.id),
                                        ...itemsToSubmitRight.map((i) => i.id),
                                    ];
                                    console.log(
                                        "제출할 항목 ID: ",
                                        allIdsToSubmit
                                    );
                                    alert(
                                        `총 ${allIdsToSubmit.length}개의 항목이 제출되었습니다.`
                                    );

                                    // 제출 완료 후 submittedIds 업데이트
                                    setSubmittedIds((prev) => [
                                        ...prev,
                                        ...allIdsToSubmit,
                                    ]);
                                }}
                            >
                                모두 제출 ({allItemsToSubmitCount}개)
                            </Button>
                        </div>
                    )}

                    <div className="h-24" />
                </div>
            </div>
        </div>
    );
}
