import { useState, useMemo } from "react";
import SectionCard from "../ui/SectionCard";
import DatePicker from "../ui/DatePicker";
import Button from "../common/Button";
import TextInput from "../ui/TextInput";
import {
    useWorkReportStore,
    formatCurrency,
    parseCurrency,
    EXPENSE_TYPES,
    ExpenseEntry,
} from "../../store/workReportStore";

export default function ExpenseSection() {
    const {
        expenses,
        editingExpenseId,
        addExpense,
        updateExpense,
        deleteExpense,
        editExpense,
        cancelEditExpense,
        workers,
        workLogEntries,
    } = useWorkReportStore();

    // 입력 상태
    const [date, setDate] = useState("");
    const [type, setType] = useState("");
    const [typeCustom, setTypeCustom] = useState("");
    const [detail, setDetail] = useState("");
    const [amount, setAmount] = useState("");

    // 엔트리에서 날짜 추출
    const entryDates = useMemo(() => {
        const dates = new Set<string>();
        workLogEntries.forEach((e) => {
            if (e.dateFrom) dates.add(e.dateFrom);
            if (e.dateTo && e.dateTo !== e.dateFrom) dates.add(e.dateTo);
        });
        return Array.from(dates).sort();
    }, [workLogEntries]);

    // 합계
    const total = useMemo(() => {
        return expenses.reduce((sum, e) => sum + e.amount, 0);
    }, [expenses]);

    // 분류별 색상
    const getTypeClass = (t: string) => {
        if (["조식", "중식", "석식"].includes(t)) return "bg-orange-50";
        if (t === "숙박") return "bg-blue-50";
        if (t === "유류비") return "bg-green-50";
        return "bg-pink-50";
    };

    const handleAmountChange = (value: string) => {
        const num = parseCurrency(value);
        setAmount(num > 0 ? formatCurrency(num) : "");
    };

    const handleAddExpense = () => {
        const finalDate = date || entryDates[0] || "";
        const finalType = type === "OTHER" ? typeCustom : type;

        if (!finalDate || !finalType || !detail || parseCurrency(amount) <= 0) {
            const missing = [];
            if (!finalDate) missing.push("날짜");
            if (!finalType) missing.push("분류");
            if (!detail) missing.push("상세내용");
            if (parseCurrency(amount) <= 0) missing.push("금액");
            alert("다음 항목을 확인해 주세요: " + missing.join(", "));
            return;
        }

        if (editingExpenseId) {
            updateExpense(editingExpenseId, {
                date: finalDate,
                type: finalType,
                detail,
                amount: parseCurrency(amount),
            });
        } else {
            addExpense({
                date: finalDate,
                type: finalType,
                detail,
                amount: parseCurrency(amount),
            });
        }

        // 초기화
        setType("");
        setTypeCustom("");
        setDetail("");
        setAmount("");
    };

    const handleEdit = (expense: ExpenseEntry) => {
        editExpense(expense.id);
        setDate(expense.date);
        setType(EXPENSE_TYPES.includes(expense.type) ? expense.type : "OTHER");
        setTypeCustom(EXPENSE_TYPES.includes(expense.type) ? "" : expense.type);
        setDetail(expense.detail);
        setAmount(formatCurrency(expense.amount));
    };

    const handleCancel = () => {
        cancelEditExpense();
        setDate("");
        setType("");
        setTypeCustom("");
        setDetail("");
        setAmount("");
    };

    // 인원 모두 추가
    const handleAddAllPersons = () => {
        setDetail(workers.join(", "));
    };

    return (
        <SectionCard
            title="지출 내역"
            headerContent={
                <div className="flex flex-col items-end">
                    <span className="font-medium text-[14px] text-gray-400">
                        총 {expenses.length}건
                    </span>
                    <span className="font-semibold text-[18px] md:text-[20px] text-gray-700">
                        {formatCurrency(total)}원
                    </span>
                </div>
            }
        >
            <div className="flex flex-col gap-5">
                {/* 입력 폼 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {/* 날짜 */}
                    <div className="flex flex-col gap-2">
                        <label className="font-medium text-[14px] text-gray-900">
                            날짜
                        </label>
                        {entryDates.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-2">
                                {entryDates.map((d) => (
                                    <Button
                                        key={d}
                                        size="lg"
                                        variant={
                                            date === d ? "primary" : "outline"
                                        }
                                        onClick={() => setDate(d)}
                                    >
                                        {new Date(d).toLocaleDateString(
                                            "ko-KR",
                                            { month: "numeric", day: "numeric" }
                                        )}
                                    </Button>
                                ))}
                            </div>
                        )}
                        <DatePicker
                            value={date}
                            onChange={setDate}
                            placeholder="날짜 선택"
                        />
                    </div>

                    {/* 분류 */}
                    <div className="flex flex-col gap-2">
                        <label className="font-medium text-[14px] text-gray-900">
                            분류
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {EXPENSE_TYPES.map((t) => (
                                <Button
                                    key={t}
                                    size="md"
                                    variant={type === t ? "primary" : "outline"}
                                    onClick={() => {
                                        setType(t);
                                        setTypeCustom("");
                                    }}
                                >
                                    {t}
                                </Button>
                            ))}
                            <Button
                                size="md"
                                variant={
                                    type === "OTHER" ? "primary" : "outline"
                                }
                                onClick={() => setType("OTHER")}
                            >
                                기타
                            </Button>
                        </div>
                        {type === "OTHER" && (
                            <TextInput
                                placeholder="분류를 직접 입력"
                                value={typeCustom}
                                onChange={setTypeCustom}
                            />
                        )}
                    </div>

                    {/* 상세내용 */}
                    <div className="flex flex-col gap-2">
                        <TextInput
                            label="상세내용"
                            placeholder="상세내용 입력"
                            value={detail}
                            onChange={setDetail}
                        />
                    </div>

                    {/* 금액 */}
                    <div className="flex flex-col gap-2">
                        <TextInput
                            label="금액"
                            placeholder="0"
                            value={amount}
                            onChange={handleAmountChange}
                            icon={<span className="text-gray-500">원</span>}
                        />
                    </div>
                </div>

                {/* 버튼들 */}
                <div className="flex flex-wrap gap-2">
                    <Button
                        onClick={handleAddAllPersons}
                        variant="outline"
                        size="md"
                    >
                        인원 모두추가
                    </Button>
                    <Button
                        onClick={handleAddExpense}
                        variant="primary"
                        size="md"
                        className="px-6"
                    >
                        {editingExpenseId ? "수정 저장" : "추가"}
                    </Button>
                    {editingExpenseId && (
                        <Button
                            onClick={handleCancel}
                            variant="outline"
                            size="md"
                        >
                            취소
                        </Button>
                    )}
                </div>

                {/* 테이블 */}
                {expenses.length > 0 && (
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="bg-gray-100">
                                    <th className="border border-gray-200 px-3 py-2 text-[13px] font-semibold">
                                        날짜
                                    </th>
                                    <th className="border border-gray-200 px-3 py-2 text-[13px] font-semibold">
                                        분류
                                    </th>
                                    <th className="border border-gray-200 px-3 py-2 text-[13px] font-semibold">
                                        상세내용
                                    </th>
                                    <th className="border border-gray-200 px-3 py-2 text-[13px] font-semibold">
                                        금액
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {expenses.map((expense) => (
                                    <tr
                                        key={expense.id}
                                        onClick={() => handleEdit(expense)}
                                        className={`cursor-pointer hover:outline hover:outline-2 hover:outline-blue-400 hover:-outline-offset-2 ${getTypeClass(
                                            expense.type
                                        )} ${
                                            editingExpenseId === expense.id
                                                ? "outline outline-2 outline-blue-500 -outline-offset-2"
                                                : ""
                                        }`}
                                    >
                                        <td className="border border-gray-200 px-3 py-2 text-[13px] text-center">
                                            {expense.date}
                                        </td>
                                        <td className="border border-gray-200 px-3 py-2 text-[13px] text-center">
                                            {expense.type}
                                        </td>
                                        <td className="border border-gray-200 px-3 py-2 text-[13px]">
                                            {expense.detail}
                                        </td>
                                        <td className="border border-gray-200 px-3 py-2 text-[13px] text-center relative">
                                            {formatCurrency(expense.amount)}원
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (
                                                        confirm(
                                                            "삭제하시겠습니까?"
                                                        )
                                                    )
                                                    deleteExpense(
                                                            expense.id
                                                        );
                                                }}
                                                className="absolute right-1 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full border border-red-400 text-red-400 text-[11px] hover:bg-red-50 opacity-0 hover:opacity-100"
                                            >
                                                ✕
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td
                                        colSpan={3}
                                        className="border border-gray-200 px-3 py-2 text-right font-semibold text-[13px]"
                                    >
                                        합계
                                    </td>
                                    <td className="border border-gray-200 px-3 py-2 text-center font-bold text-[14px]">
                                        {formatCurrency(total)}원
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                )}
            </div>
        </SectionCard>
    );
}
