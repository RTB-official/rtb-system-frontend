//expenseSection.tsx
import { useState, useMemo } from "react";
import SectionCard from "../ui/SectionCard";
import DatePicker from "../ui/DatePicker";
import Button from "../common/Button";
import TextInput from "../ui/TextInput";
import Select from "../common/Select";
import RequiredIndicator from "../ui/RequiredIndicator";
import useIsMobile from "../../hooks/useIsMobile";
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
    
    const isMobile = useIsMobile();

    // 입력 상태
    const [date, setDate] = useState("");
    const [type, setType] = useState("");
    const [typeCustom, setTypeCustom] = useState("");
    const [detail, setDetail] = useState("");
    const [amount, setAmount] = useState("");
    const [isAmountFocused, setIsAmountFocused] = useState(false);
    const [currency, setCurrency] = useState<string>("원");

    // 에러 상태
    const [errors, setErrors] = useState<{
        date?: string;
        type?: string;
        detail?: string;
        amount?: string;
    }>({});

    // 엔트리에서 날짜 추출
    const entryDates = useMemo(() => {
        const dates = new Set<string>();
        workLogEntries.forEach((e) => {
            if (e.dateFrom) dates.add(e.dateFrom);
            if (e.dateTo && e.dateTo !== e.dateFrom) dates.add(e.dateTo);
        });
        return Array.from(dates).sort();
    }, [workLogEntries]);

    // 통화별 합계
    const totalsByCurrency = useMemo(() => {
        const totals: Record<string, number> = {};
        expenses.forEach((e) => {
            const currency = e.currency || "원";
            totals[currency] = (totals[currency] || 0) + e.amount;
        });
        return totals;
    }, [expenses]);

    // 분류별 색상
    const getTypeClass = (t: string) => {
        if (["조식", "중식", "석식", "간식"].includes(t)) return "bg-orange-50";
        if (t === "숙박") return "bg-blue-50";
        if (t === "유류비") return "bg-green-50";
        return "bg-pink-50";
    };

    const handleAmountChange = (value: string) => {
        // 숫자만 추출하여 저장
        const cleaned = value.replace(/[^\d]/g, '');
        setAmount(cleaned);
    };

    const handleAddExpense = () => {
        const finalDate = date || entryDates[0] || "";
        const finalType = type === "OTHER" || type === "기타" ? (typeCustom || type) : type;

        // 유효성 검사
        const newErrors: typeof errors = {};
        if (!finalDate) {
            newErrors.date = "날짜를 선택해주세요";
        }
        if (!finalType) {
            newErrors.type = "분류를 선택해주세요";
        }
        if (!detail) {
            newErrors.detail = "상세내용을 입력해주세요";
        }
        if (parseCurrency(amount) <= 0) {
            newErrors.amount = "금액을 입력해주세요";
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        setErrors({});

        if (editingExpenseId) {
            updateExpense(editingExpenseId, {
                date: finalDate,
                type: finalType,
                detail,
                amount: parseCurrency(amount),
                currency: currency || "원",
            });
        } else {
            addExpense({
                date: finalDate,
                type: finalType,
                detail,
                amount: parseCurrency(amount),
                currency: currency || "원",
            });
        }

        // 초기화 (화폐 단위는 유지)
        setType("");
        setTypeCustom("");
        setDetail("");
        setAmount("");
        // currency는 유지 (이전에 선택한 단위 그대로 사용)
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.preventDefault();
            handleAddExpense();
        }
    };

    const handleEdit = (expense: ExpenseEntry) => {
        editExpense(expense.id);
        setDate(expense.date);
        const isInExpenseTypes = EXPENSE_TYPES.includes(expense.type);
        setType(isInExpenseTypes ? expense.type : "OTHER");
        setTypeCustom(isInExpenseTypes ? "" : expense.type);
        setDetail(expense.detail);
        // 수정 모드에서는 포맷팅하지 않은 숫자만 저장 (입력 중 포맷팅 방지)
        setAmount(String(expense.amount));
        setCurrency(expense.currency || "원");
    };

    const handleCancel = () => {
        cancelEditExpense();
        setDate("");
        setType("");
        setTypeCustom("");
        setDetail("");
        setAmount("");
        // currency는 유지 (이전에 선택한 단위 그대로 사용)
    };

    // 인원 모두 추가
    const handleAddAllPersons = () => {
        setDetail(workers.join(", "));
    };

    // 날짜 포맷팅 함수 (YYYY-MM-DD -> M월 D일 또는 M/D)
    const formatDate = (dateString: string, isMobile: boolean = false) => {
        if (!dateString) return "";
        const date = new Date(dateString);
        const month = date.getMonth() + 1;
        const day = date.getDate();
        if (isMobile) {
            return `${month}/${day}`;
        }
        return `${month}월 ${day}일`;
    };

    return (
        <SectionCard
            title="지출 내역"
            headerContent={
                <span className="font-medium text-[14px] text-gray-400">
                    총 {expenses.length}건
                </span>
            }
        >
            <div className="flex flex-col gap-2 -mt-4">
                {/* 입력 폼 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-2">
                    {/* 날짜 */}
                    <div className="flex flex-col gap-2">
                        <label className="font-medium text-[14px] text-gray-900">
                            날짜
                            <RequiredIndicator />
                        </label>
                        <DatePicker
                            value={date}
                            onChange={(val) => {
                                setDate(val);
                                if (errors.date) {
                                    setErrors((prev) => ({
                                        ...prev,
                                        date: undefined,
                                    }));
                                }
                            }}
                            placeholder="날짜 선택"
                            error={errors.date}
                        />
                        {entryDates.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {entryDates.map((d) => (
                                    <Button
                                        key={d}
                                        size="sm"
                                        variant={
                                            date === d ? "primary" : "outline"
                                        }
                                        onClick={() => setDate(d)}
                                    >
                                        {formatDate(d)}
                                    </Button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* 분류 */}
                    <div className="flex flex-col gap-2">
                        <Select
                            label="분류"
                            required
                            placeholder="분류 선택"
                            options={[
                                ...EXPENSE_TYPES.filter((t) => t !== "기타").map((t) => ({
                                    value: t,
                                    label: t,
                                })),
                                { value: "OTHER", label: "기타" },
                            ]}
                            value={type}
                            onChange={(val) => {
                                setType(val);
                                setTypeCustom("");
                                if (errors.type) {
                                    setErrors((prev) => ({
                                        ...prev,
                                        type: undefined,
                                    }));
                                }
                            }}
                            error={errors.type}
                            size="md"
                            fullWidth
                        />
                        {(type === "OTHER" || type === "기타") && (
                            <TextInput
                                placeholder="분류를 직접 입력"
                                value={typeCustom}
                                onChange={(val) => {
                                    setTypeCustom(val);
                                    if (errors.type) {
                                        setErrors((prev) => ({
                                            ...prev,
                                            type: undefined,
                                        }));
                                    }
                                }}
                                onKeyDown={handleKeyDown}
                            />
                        )}
                    </div>

                    {/* 상세내용 */}
                    <TextInput
                        label="상세내용"
                        required
                        placeholder="상세내용 입력"
                        value={detail}
                        onChange={(val) => {
                            setDetail(val);
                            if (errors.detail) {
                                setErrors((prev) => ({
                                    ...prev,
                                    detail: undefined,
                                }));
                            }
                        }}
                        onKeyDown={handleKeyDown}
                        error={errors.detail}
                    />

                    {/* 금액 */}
                    <div className="flex flex-col gap-2">
                        <label className="font-medium text-[14px] text-gray-900">
                            금액
                            <RequiredIndicator />
                        </label>
                        <div className="flex gap-2">
                            <div className="flex-[2] md:flex-1 min-w-0">
                                <TextInput
                                    placeholder="0"
                                    inputMode="numeric"
                                    value={isAmountFocused ? amount : (amount ? formatCurrency(parseCurrency(amount)) : '')}
                                    onChange={(val) => {
                                        handleAmountChange(val);
                                        if (errors.amount) {
                                            setErrors((prev) => ({
                                                ...prev,
                                                amount: undefined,
                                            }));
                                        }
                                    }}
                                    onFocus={(e) => {
                                        // 포커스를 받을 때 포맷팅 제거 (숫자만 표시)
                                        setIsAmountFocused(true);
                                        const num = parseCurrency(e.target.value);
                                        if (num > 0) {
                                            setAmount(String(num));
                                        }
                                    }}
                                    onBlur={(e) => {
                                        // 포커스를 잃을 때 포맷팅 적용
                                        setIsAmountFocused(false);
                                        const num = parseCurrency(e.target.value);
                                        if (num > 0) {
                                            setAmount(formatCurrency(num));
                                        } else {
                                            setAmount("");
                                        }
                                    }}
                                    onKeyDown={handleKeyDown}
                                    error={errors.amount}
                                />
                            </div>
                            <div className="w-20 md:w-24 shrink-0">
                                <Select
                                    options={[
                                        { value: "원", label: "원" },
                                        { value: "엔", label: "엔" },
                                        { value: "달러", label: "달러" },
                                        { value: "유로", label: "유로" },
                                    ]}
                                    value={currency}
                                    onChange={(val) => setCurrency(val)}
                                    size="md"
                                />
                            </div>
                        </div>
                        {errors.amount && (
                            <p className="text-red-500 text-[12px]">
                                {errors.amount}
                            </p>
                        )}
                    </div>
                </div>

                {/* 버튼들 */}
                <div className="flex flex-col gap-5">
                    <div className="flex justify-start">
                        <Button
                            onClick={handleAddAllPersons}
                            variant="outline"
                            size="md"
                        >
                            인원 모두추가
                        </Button>
                    </div>
                    <div className="flex gap-2 ㅡㅁㅁㅁ">
                        <Button
                            onClick={handleAddExpense}
                            variant="primary"
                            size="lg"
                            fullWidth
                        >
                            {editingExpenseId ? "수정 저장" : "추가"}
                        </Button>
                        {editingExpenseId && (
                            <Button
                                onClick={handleCancel}
                                variant="outline"
                                size="lg"
                                width={"10%"}
                            >
                                취소
                            </Button>
                        )}
                    </div>
                </div>

                {/* 테이블 */}
                {expenses.length > 0 && (
                    <div className="overflow-x-auto mt-4">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="bg-gray-100">
                                    <th className="border border-gray-200 px-2 md:px-3 py-1.5 md:py-2 text-[11px] md:text-[13px] font-semibold">
                                        날짜
                                    </th>
                                    <th className="border border-gray-200 px-2 md:px-3 py-1.5 md:py-2 text-[11px] md:text-[13px] font-semibold">
                                        분류
                                    </th>
                                    <th className="border border-gray-200 px-2 md:px-3 py-1.5 md:py-2 text-[11px] md:text-[13px] font-semibold">
                                        상세내용
                                    </th>
                                    <th className="border border-gray-200 px-2 md:px-3 py-1.5 md:py-2 text-[11px] md:text-[13px] font-semibold">
                                        금액
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {expenses.map((expense) => {
                                    const isSelected = editingExpenseId === expense.id;
                                    return (
                                        <tr
                                            key={expense.id}
                                            onClick={() => handleEdit(expense)}
                                            className={`group cursor-pointer hover:outline hover:outline-2 hover:outline-blue-400 hover:-outline-offset-2 ${getTypeClass(
                                                expense.type
                                            )} ${
                                                isSelected
                                                    ? "outline outline-2 outline-blue-500 -outline-offset-2"
                                                    : ""
                                            }`}
                                        >
                                            <td className="border border-gray-200 px-2 md:px-3 py-1.5 md:py-2 text-[11px] md:text-[13px] text-center">
                                                {formatDate(expense.date, isMobile)}
                                            </td>
                                            <td className="border border-gray-200 px-2 md:px-3 py-1.5 md:py-2 text-[11px] md:text-[13px] text-center">
                                                {expense.type}
                                            </td>
                                            <td className="border border-gray-200 px-2 md:px-3 py-1.5 md:py-2 text-[11px] md:text-[13px]">
                                                {expense.detail}
                                            </td>
                                            <td className="border border-gray-200 px-2 md:px-3 py-1.5 md:py-2 text-[11px] md:text-[13px] text-center relative">
                                                <span className="whitespace-nowrap">{formatCurrency(expense.amount)}{expense.currency || "원"}</span>
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
                                                    className={`absolute right-1 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full border border-red-400 text-red-400 text-[11px] hover:bg-red-50 transition-opacity ${
                                                        isSelected
                                                            ? "opacity-100"
                                                            : "opacity-0 group-hover:opacity-100"
                                                    }`}
                                                >
                                                    ✕
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot>
                                {Object.entries(totalsByCurrency).map(([currency, total], index) => (
                                    <tr key={currency}>
                                        <td
                                            colSpan={3}
                                            className="border border-gray-200 px-2 md:px-3 py-1.5 md:py-2 text-right font-semibold text-[11px] md:text-[13px]"
                                        >
                                            {index === 0 ? "합계" : ""}
                                        </td>
                                        <td className="border border-gray-200 px-2 md:px-3 py-1.5 md:py-2 text-center font-bold text-[12px] md:text-[14px]">
                                            <span className="whitespace-nowrap">{formatCurrency(total)}{currency}</span>
                                        </td>
                                    </tr>
                                ))}
                            </tfoot>
                        </table>
                    </div>
                )}
            </div>
        </SectionCard>
    );
}
