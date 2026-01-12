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
import { useAuth } from "../../store/auth";
import {
    createPersonalExpense,
    createPersonalMileage,
    getPersonalExpenses,
    getPersonalMileages,
    deletePersonalExpense,
    deletePersonalMileage,
    type PersonalExpense,
    type PersonalMileage,
} from "../../lib/personalExpenseApi";

export default function PersonalExpensePage() {
    const { user } = useAuth();
    const location = useLocation();
    const params = new URLSearchParams(location.search);
    const preselectedDate = params.get("date") || null;

    const [sidebarOpen, setSidebarOpen] = useState(false);
    const currentDate = new Date();
    const [year, setYear] = useState(`${currentDate.getFullYear()}년`);
    const [month, setMonth] = useState(`${currentDate.getMonth() + 1}월`);
    const [submittedIds, setSubmittedIds] = useState<number[]>([]);

    const [loading, setLoading] = useState(false);
    const [expenses, setExpenses] = useState<PersonalExpense[]>([]);
    const [mileages, setMileages] = useState<PersonalMileage[]>([]);

    const allItemsToSubmitCount = useMemo(() => {
        // submittedIds에 없는 항목만 카운트
        const unsubmittedExpenses = expenses.filter(
            (item) => !submittedIds.includes(item.id)
        );
        const unsubmittedMileages = mileages.filter(
            (item) => !submittedIds.includes(item.id)
        );
        return unsubmittedExpenses.length + unsubmittedMileages.length;
    }, [expenses, mileages, submittedIds]);

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

    // 데이터 로드
    useEffect(() => {
        if (!user?.id) return;

        const loadData = async () => {
            setLoading(true);
            try {
                const yearNum = parseInt(year.replace("년", ""));
                const monthNum = parseInt(month.replace("월", "")) - 1;

                const [expensesData, mileagesData] = await Promise.all([
                    getPersonalExpenses(user.id, { year: yearNum, month: monthNum }),
                    getPersonalMileages(user.id, { year: yearNum, month: monthNum }),
                ]);

                setExpenses(expensesData);
                setMileages(mileagesData);
            } catch (error) {
                console.error("데이터 로드 실패:", error);
                alert("데이터를 불러오는데 실패했습니다.");
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [user?.id, year, month]);

    // 날짜 필터링 함수
    const matchesFilter = (dateStr: string) => {
        if (!dateStr) return false;
        try {
            const date = new Date(dateStr);
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

    // 마일리지 추가 핸들러
    const handleMileageAdd = async (item: {
        id?: number;
        date: string;
        from: string;
        to: string;
        distance: string;
        note: string;
        cost: number;
    }) => {
        if (!user?.id) {
            alert("로그인이 필요합니다.");
            return;
        }

        try {
            const distanceNum = parseFloat(item.distance || "0");
            const costPerKm = 250;
            const calculatedCost = distanceNum * costPerKm;

            await createPersonalMileage({
                user_id: user.id,
                m_date: item.date,
                from_text: item.from,
                to_text: item.to,
                distance_km: distanceNum,
                detail: item.note || null,
                amount_won: calculatedCost,
            });

            // 목록 새로고침
            const yearNum = parseInt(year.replace("년", ""));
            const monthNum = parseInt(month.replace("월", "")) - 1;
            const data = await getPersonalMileages(user.id, {
                year: yearNum,
                month: monthNum,
            });
            setMileages(data);
        } catch (error: any) {
            console.error("마일리지 등록 실패:", error);
            alert(error.message || "마일리지 등록에 실패했습니다.");
        }
    };

    // 지출 추가 핸들러
    const handleExpenseAdd = async (item: {
        id?: number;
        date: string;
        type: string;
        amount: string;
        detail: string;
        img?: string | null;
    }) => {
        if (!user?.id) {
            alert("로그인이 필요합니다.");
            return;
        }

        try {
            const amountNum = parseInt(item.amount || "0");
            if (amountNum <= 0) {
                alert("금액을 입력해주세요.");
                return;
            }

            await createPersonalExpense({
                user_id: user.id,
                expense_date: item.date,
                expense_type: item.type,
                detail: item.detail || null,
                amount: amountNum,
                receipt_path: item.img || null, // 추후 파일 업로드 구현 시 수정
            });

            // 목록 새로고침
            const yearNum = parseInt(year.replace("년", ""));
            const monthNum = parseInt(month.replace("월", "")) - 1;
            const data = await getPersonalExpenses(user.id, {
                year: yearNum,
                month: monthNum,
            });
            setExpenses(data);
        } catch (error: any) {
            console.error("지출 등록 실패:", error);
            alert(error.message || "지출 등록에 실패했습니다.");
        }
    };

    // 마일리지 삭제 핸들러
    const handleRemoveMileage = async (id: number) => {
        if (!user?.id) {
            alert("로그인이 필요합니다.");
            return;
        }

        if (!confirm("정말 삭제하시겠습니까?")) return;

        try {
            await deletePersonalMileage(id, user.id);
            setMileages((prev) => prev.filter((item) => item.id !== id));
            setSubmittedIds((prev) => prev.filter((itemId) => itemId !== id));
        } catch (error: any) {
            console.error("마일리지 삭제 실패:", error);
            alert(error.message || "마일리지 삭제에 실패했습니다.");
        }
    };

    // 지출 삭제 핸들러
    const handleRemoveExpense = async (id: number) => {
        if (!user?.id) {
            alert("로그인이 필요합니다.");
            return;
        }

        if (!confirm("정말 삭제하시겠습니까?")) return;

        try {
            await deletePersonalExpense(id, user.id);
            setExpenses((prev) => prev.filter((item) => item.id !== id));
            setSubmittedIds((prev) => prev.filter((itemId) => itemId !== id));
        } catch (error: any) {
            console.error("지출 삭제 실패:", error);
            alert(error.message || "지출 삭제에 실패했습니다.");
        }
    };

    // 마일리지 히스토리 변환
    const mileageHistory = useMemo<ExpenseHistoryItem[]>(() => {
        return mileages
            .filter((it) => matchesFilter(it.m_date))
            .map((it) => ({
                id: it.id,
                variant: "mileage" as const,
                date: it.m_date,
                amount: `${(it.amount_won || 0).toLocaleString("ko-KR")}원`,
                routeLabel: `${it.from_text || "출발지"} → ${it.to_text || "도착지"}`,
                distanceLabel: `${Number(it.distance_km || 0)}km`,
                desc: it.detail || "",
            }));
    }, [mileages, year, month]);

    // 지출 히스토리 변환
    const cardHistory = useMemo<ExpenseHistoryItem[]>(() => {
        return expenses
            .filter((it) => matchesFilter(it.expense_date))
            .map((it) => ({
                id: it.id,
                variant: "card" as const,
                date: it.expense_date,
                amount: `${Number(it.amount || 0).toLocaleString("ko-KR")}원`,
                tag: it.expense_type || "기타",
                desc: it.detail || "",
                img: it.receipt_path || null,
            }));
    }, [expenses, year, month]);

    // 모두 제출 핸들러
    const handleSubmitAll = async () => {
        if (!user?.id) {
            alert("로그인이 필요합니다.");
            return;
        }

        const unsubmittedExpenses = expenses.filter(
            (item) => !submittedIds.includes(item.id)
        );
        const unsubmittedMileages = mileages.filter(
            (item) => !submittedIds.includes(item.id)
        );

        const currentItemsToSubmitCount =
            unsubmittedExpenses.length + unsubmittedMileages.length;

        if (currentItemsToSubmitCount === 0) {
            alert("제출할 항목이 없습니다.");
            return;
        }

        const confirmSubmit = window.confirm(
            `총 ${currentItemsToSubmitCount}개의 항목을 제출하시겠습니까?`
        );
        if (!confirmSubmit) return;

        // TODO: 실제 제출 로직 (서버에 제출 상태 업데이트 등)
        const allIdsToSubmit = [
            ...unsubmittedExpenses.map((i) => i.id),
            ...unsubmittedMileages.map((i) => i.id),
        ];

        console.log("제출할 항목 ID: ", allIdsToSubmit);
        alert(`총 ${allIdsToSubmit.length}개의 항목이 제출되었습니다.`);

        setSubmittedIds((prev) => [...prev, ...allIdsToSubmit]);
    };

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
                    <div className="mb-4 flex flex-wrap items-center gap-4">
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

                    {loading && (
                        <div className="text-center py-8 text-gray-500">
                            로딩 중...
                        </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3 items-stretch w-full">
                        <MileageCard
                            initialDate={preselectedDate || undefined}
                            onAdd={handleMileageAdd}
                        />
                        <ExpenseFormCard
                            initialDate={preselectedDate || undefined}
                            onAdd={handleExpenseAdd}
                        />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start w-full">
                        <ExpenseHistorySection
                            title="개인 차량 마일리지 내역"
                            items={mileageHistory}
                            emptyMessage="등록된 마일리지 내역이 없습니다."
                            submittedIds={submittedIds}
                            onRemove={handleRemoveMileage}
                        />
                        <ExpenseHistorySection
                            title="개인 카드/현금 지출 내역"
                            items={cardHistory}
                            emptyMessage="등록된 지출 내역이 없습니다."
                            submittedIds={submittedIds}
                            onRemove={handleRemoveExpense}
                        />
                    </div>

                    {allItemsToSubmitCount > 0 && (
                        <div className="fixed bottom-6 left-6 right-6 lg:left-[239px] mx-9">
                            <Button
                                variant="primary"
                                size="lg"
                                fullWidth
                                onClick={handleSubmitAll}
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
