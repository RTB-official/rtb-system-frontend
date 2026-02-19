//expenseSection.tsx
import { useRef, useState, useMemo } from "react";
import SectionCard from "../ui/SectionCard";
import DatePicker from "../ui/DatePicker";
import Button from "../common/Button";
import Select from "../common/Select";
import Table from "../common/Table";
import TextInput from "../ui/TextInput";
import RequiredIndicator from "../ui/RequiredIndicator";
import ConfirmDialog from "../ui/ConfirmDialog";
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
    const [isSaving, setIsSaving] = useState(false);
    const isSavingRef = useRef(false);

    // 삭제 확인 상태
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [expenseToDelete, setExpenseToDelete] = useState<number | string | null>(
        null
    );

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

    // 합계
    const total = useMemo(() => {
        return expenses.reduce((sum, e) => sum + e.amount, 0);
    }, [expenses]);

    // 분류별 색상
    const getTypeClass = (t: string) => {
        if (["조식", "중식", "석식", "간식", "식비"].includes(t)) return "bg-orange-50";
        if (t === "숙박") return "bg-blue-50";
        if (["유대", "유류비", "주유"].includes(t)) return "bg-green-50";
        return "bg-pink-50";
    };

    const handleAmountChange = (value: string) => {
        const num = parseCurrency(value);
        setAmount(num > 0 ? formatCurrency(num) : "");
    };

    const handleAddExpense = () => {
        if (isSavingRef.current) return;
        const finalDate = date || entryDates[0] || "";
        const finalType = type === "기타" && typeCustom ? typeCustom : type;

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
        isSavingRef.current = true;
        setIsSaving(true);

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

        isSavingRef.current = false;
        setIsSaving(false);
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
        setType(EXPENSE_TYPES.includes(expense.type) ? expense.type : "기타");
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

    // 날짜 포맷팅 함수 (YYYY-MM-DD -> M월 D일)
    const formatDate = (dateString: string) => {
        if (!dateString) return "";
        const date = new Date(dateString);
        const month = date.getMonth() + 1;
        const day = date.getDate();
        return `${month}월 ${day}일`;
    };

    return (
        <SectionCard
            title="지출 내역"
        >
            <div className="flex flex-col gap-2">
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
                        <label className="font-medium text-[14px] text-gray-900">
                            분류
                            <RequiredIndicator />
                        </label>
                        <Select
                            value={type}
                            onChange={(value) => {
                                setType(value);
                                if (value !== "기타") {
                                    setTypeCustom("");
                                }
                                if (errors.type) {
                                    setErrors((prev) => ({
                                        ...prev,
                                        type: undefined,
                                    }));
                                }
                            }}
                            placeholder="분류 선택"
                            options={EXPENSE_TYPES.map((t) => ({
                                value: t,
                                label: t,
                            }))}
                        />
                        {type === "기타" && (
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
                        {errors.type && (
                            <p className="text-red-500 text-[12px]">
                                {errors.type}
                            </p>
                        )}
                    </div>

                    {/* 금액 */}
                    <TextInput
                        label="금액"
                        required
                        placeholder="0"
                        value={amount}
                        onChange={(val) => {
                            handleAmountChange(val);
                            if (errors.amount) {
                                setErrors((prev) => ({
                                    ...prev,
                                    amount: undefined,
                                }));
                            }
                        }}
                        onKeyDown={handleKeyDown}
                        icon={<span className="text-gray-500">원</span>}
                        error={errors.amount}
                    />

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

                    <div className="flex justify-start md:col-start-2 -mt-2 mb-2">
                        <Button
                            onClick={handleAddAllPersons}
                            variant="outline"
                            size="sm"
                        >
                            인원 모두추가
                        </Button>
                    </div>
                </div>

                {/* 버튼들 */}
                <div className="flex flex-col gap-5">
                    <div className="flex gap-2 ㅡㅁㅁㅁ">
                        <Button
                            onClick={handleAddExpense}
                            variant="primary"
                            size="lg"
                            fullWidth
                            loading={isSaving}
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
                <div className="mt-4">
                    <Table<ExpenseEntry>
                        columns={[
                            {
                                key: "date",
                                label: "날짜",
                                align: "center",
                                headerClassName:
                                    "border border-gray-200 px-3 py-2 text-[13px]",
                                cellClassName:
                                    "border border-gray-200 px-3 py-2 text-[13px] text-center",
                                render: (value) => formatDate(String(value || "")),
                            },
                            {
                                key: "type",
                                label: "분류",
                                align: "center",
                                headerClassName:
                                    "border border-gray-200 px-3 py-2 text-[13px]",
                                cellClassName:
                                    "border border-gray-200 px-3 py-2 text-[13px] text-center",
                                render: (value) => {
                                    if (value === "유류비" || value === "주유") return "유대";
                                    return value || "-";
                                },
                            },
                            {
                                key: "detail",
                                label: "상세내용",
                                headerClassName:
                                    "border border-gray-200 px-3 py-2 text-[13px]",
                                cellClassName:
                                    "border border-gray-200 px-3 py-2 text-[13px]",
                            },
                            {
                                key: "amount",
                                label: "금액",
                                align: "center",
                                headerClassName:
                                    "border border-gray-200 px-3 py-2 text-[13px]",
                                cellClassName:
                                    "border border-gray-200 px-3 py-2 text-[13px] text-center relative",
                                render: (value, row) => {
                                    const isSelected = editingExpenseId === row.id;
                                    return (
                                        <div className="relative">
                                            {formatCurrency(Number(value || 0))}원
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    e.stopPropagation();
                                                    setExpenseToDelete(row.id);
                                                    setDeleteConfirmOpen(true);
                                                }}
                                                className={`absolute right-1 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full border border-red-400 text-red-400 text-[11px] hover:bg-red-50 transition-opacity ${isSelected
                                                        ? "opacity-100"
                                                        : "opacity-0 group-hover:opacity-100"
                                                    }`}
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    );
                                },
                            },
                        ]}
                        data={expenses}
                        rowKey={(row) => row.id}
                        onRowClick={(row) => handleEdit(row)}
                        rowClassName={(row) => {
                            const isSelected = editingExpenseId === row.id;
                            return `group cursor-pointer hover:outline hover:outline-2 hover:outline-blue-400 hover:-outline-offset-2 ${getTypeClass(
                                row.type
                            )} ${isSelected
                                    ? "outline outline-2 outline-blue-500 -outline-offset-2"
                                    : ""
                                }`;
                        }}
                        className="border-collapse"
                        emptyText="등록된 지출 내역이 없습니다."
                        footer={
                            <tr>
                                <td
                                    colSpan={3}
                                    className="border border-gray-200 px-3 py-2 text-right font-semibold text-[13px]"
                                >
                                    합계<span className="font-light ml-0.5 text-[12px] text-gray-400">
                                        ({expenses.length})
                                    </span>
                                </td>
                                <td className="border border-gray-200 px-3 py-2 text-center font-bold text-[14px]">
                                    {formatCurrency(total)}원
                                </td>
                            </tr>
                        }
                    />
                </div>
            </div>

            <ConfirmDialog
                isOpen={deleteConfirmOpen}
                onClose={() => {
                    setDeleteConfirmOpen(false);
                    setExpenseToDelete(null);
                }}
                onConfirm={() => {
                    if (expenseToDelete !== null) {
                        deleteExpense(expenseToDelete as number);
                    }
                    setDeleteConfirmOpen(false);
                    setExpenseToDelete(null);
                }}
                title="지출 내역 삭제"
                message="해당 지출 내역을 삭제하시겠습니까?"
                confirmText="삭제"
                cancelText="취소"
                confirmVariant="danger"
            />
        </SectionCard>
    );
}
