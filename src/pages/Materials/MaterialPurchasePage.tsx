import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSidebarOpen } from "../../hooks/useSidebarOpen";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/common/Header";
import SectionCard from "../../components/ui/SectionCard";
import Input from "../../components/common/Input";
import Select from "../../components/common/Select";
import TextInput from "../../components/ui/TextInput";
import Button from "../../components/common/Button";
import { IconClose, IconPlus, IconUpload } from "../../components/icons/Icons";
import { useToast } from "../../components/ui/ToastProvider";
import { EXPENSE_CURRENCY_OPTIONS, ORDER_PERSONS, formatCurrency, parseCurrency, sanitizeDecimalAmountInput } from "../../store/workReportStore";
import { PURPOSE_AUTOCOMPLETE_OPTIONS } from "../../constants/purposeAutocompleteOptions";

type LineReceipt = {
    id: string;
    name: string;
    previewUrl: string;
    type: string;
};

type PurchaseLine = {
    id: string;
    material: string;
    vendor: string;
    cost: string;
    currency: string;
    note: string;
    receipts: LineReceipt[];
};

const ORDER_GROUP_OPTIONS = [
    { value: "ELU", label: "Everllence-ELU" },
    { value: "PRIME", label: "Everllence-Prime" },
    { value: "MITSUI", label: "Mitsui" },
    { value: "OTHER", label: "기타 (직접입력)" },
];

function createLine(): PurchaseLine {
    return {
        id: `line-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        material: "",
        vendor: "",
        cost: "",
        currency: "원",
        note: "",
        receipts: [],
    };
}

function lineName(line: PurchaseLine) {
    return line.material.trim();
}

function revokeReceipts(receipts: LineReceipt[]) {
    receipts.forEach((receipt) => {
        URL.revokeObjectURL(receipt.previewUrl);
    });
}

export default function MaterialPurchasePage() {
    const [sidebarOpen, setSidebarOpen] = useSidebarOpen();
    const { showError, showInfo } = useToast();
    const [purchaseStatus, setPurchaseStatus] = useState<"planned" | "confirmed">("planned");
    const [purchaseKind, setPurchaseKind] = useState<"work" | "personal">("work");
    const [workFieldsRendered, setWorkFieldsRendered] = useState(true);
    const [workFieldsOpen, setWorkFieldsOpen] = useState(true);

    const [vessel, setVessel] = useState("");
    const [orderGroup, setOrderGroup] = useState("");
    const [orderPersons, setOrderPersons] = useState<string[]>([]);
    const [selectedOrderPerson, setSelectedOrderPerson] = useState("");
    const [orderPersonCustom, setOrderPersonCustom] = useState("");
    const [isAddingOrderPerson, setIsAddingOrderPerson] = useState(false);
    const isAddingOrderPersonRef = useRef(false);
    const [tripPurpose, setTripPurpose] = useState("");
    const purposeInputRef = useRef<HTMLInputElement>(null);
    const [lines, setLines] = useState<PurchaseLine[]>(() => [createLine()]);
    const [focusedCostId, setFocusedCostId] = useState<string | null>(null);
    const [errors, setErrors] = useState<{ orderPersons?: string; lines?: string }>({});
    const [previewFile, setPreviewFile] = useState<{
        url: string;
        name: string;
        type: string;
    } | null>(null);
    const skipWorkFieldsIntro = useRef(true);

    useLayoutEffect(() => {
        if (skipWorkFieldsIntro.current) {
            skipWorkFieldsIntro.current = false;
            return;
        }
        if (purchaseKind === "work") {
            setWorkFieldsRendered(true);
            setWorkFieldsOpen(false);
            return;
        }
        setWorkFieldsOpen(false);
    }, [purchaseKind]);

    useEffect(() => {
        if (purchaseKind !== "work" || !workFieldsRendered) return;
        const frame = requestAnimationFrame(() => setWorkFieldsOpen(true));
        return () => cancelAnimationFrame(frame);
    }, [purchaseKind, workFieldsRendered]);

    const orderPersonOptions = useMemo(() => {
        if (!orderGroup || orderGroup === "OTHER" || orderGroup === "MITSUI") return [];
        return [
            ...(ORDER_PERSONS[orderGroup] || []).map((name) => ({ value: name, label: name })),
            { value: "OTHER", label: "기타(직접입력)" },
        ];
    }, [orderGroup]);

    const showOrderPersonCustomInput =
        orderGroup === "OTHER" || orderGroup === "MITSUI" || selectedOrderPerson === "OTHER";

    const addOrderPerson = (person: string) => {
        const next = person.trim();
        if (!next) return;
        setOrderPersons((prev) => (prev.includes(next) ? prev : [...prev, next]));
        if (errors.orderPersons) setErrors((prev) => ({ ...prev, orderPersons: undefined }));
    };

    const handleSelectOrderPerson = (value: string) => {
        setSelectedOrderPerson(value);
        if (value !== "OTHER") {
            addOrderPerson(value);
            setSelectedOrderPerson("");
        }
    };

    const handleAddCustomOrderPerson = () => {
        if (isAddingOrderPersonRef.current) return;
        const next = orderPersonCustom.trim();
        if (!next) return;
        isAddingOrderPersonRef.current = true;
        setIsAddingOrderPerson(true);
        addOrderPerson(next);
        setOrderPersonCustom("");
        setSelectedOrderPerson("");
        isAddingOrderPersonRef.current = false;
        setIsAddingOrderPerson(false);
    };

    const handlePurposeClick = (purpose: string) => {
        if (tripPurpose.trim().includes(" ")) {
            const parts = tripPurpose.trim().split(/\s+/);
            parts[parts.length - 1] = purpose;
            setTripPurpose(parts.join(" "));
        } else {
            setTripPurpose(purpose);
        }
        setTimeout(() => {
            purposeInputRef.current?.focus();
        }, 0);
    };

    const filteredPurposeOptions = useMemo(() => {
        if (!tripPurpose.trim()) return [];
        const parts = tripPurpose.trim().split(/\s+/);
        const searchText = parts[parts.length - 1].toLowerCase();
        if (!searchText) return [];
        return PURPOSE_AUTOCOMPLETE_OPTIONS.filter((option) =>
            option.toLowerCase().startsWith(searchText)
        );
    }, [tripPurpose]);

    const filledCount = useMemo(
        () => lines.filter((line) => lineName(line) || line.vendor.trim()).length,
        [lines]
    );

    const updateLine = (id: string, patch: Partial<PurchaseLine>) => {
        setLines((prev) => prev.map((line) => (line.id === id ? { ...line, ...patch } : line)));
        if (errors.lines) setErrors((prev) => ({ ...prev, lines: undefined }));
    };

    const addLine = () => {
        setLines((prev) => [...prev, createLine()]);
    };

    const removeLine = (id: string) => {
        setLines((prev) => {
            const target = prev.find((line) => line.id === id);
            if (target) revokeReceipts(target.receipts);
            return prev.length === 1 ? [createLine()] : prev.filter((line) => line.id !== id);
        });
    };

    const addReceipts = (lineId: string, files: FileList | null) => {
        if (!files || files.length === 0) return;
        const next = Array.from(files).map((file) => ({
            id: `receipt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            name: file.name,
            previewUrl: URL.createObjectURL(file),
            type: file.type || "application/octet-stream",
        }));
        setLines((prev) =>
            prev.map((line) => (line.id === lineId ? { ...line, receipts: [...line.receipts, ...next] } : line))
        );
    };

    const removeReceipt = (lineId: string, receiptId: string) => {
        setLines((prev) =>
            prev.map((line) => {
                if (line.id !== lineId) return line;
                const target = line.receipts.find((receipt) => receipt.id === receiptId);
                if (target) {
                    setPreviewFile((current) => (current?.url === target.previewUrl ? null : current));
                    revokeReceipts([target]);
                }
                return { ...line, receipts: line.receipts.filter((receipt) => receipt.id !== receiptId) };
            })
        );
    };

    const handleSubmit = () => {
        const nextErrors: { orderPersons?: string; lines?: string } = {};
        if (purchaseKind === "work" && orderPersons.length === 0) {
            nextErrors.orderPersons = "참관감독을 선택해 주세요.";
        }

        const namedLines = lines.filter((line) => lineName(line) || line.vendor.trim() || line.note.trim());
        if (namedLines.length === 0) {
            nextErrors.lines = "신청할 자재를 한 개 이상 입력해 주세요.";
        } else if (namedLines.some((line) => !lineName(line))) {
            nextErrors.lines = "자재명을 입력해 주세요.";
        }

        setErrors(nextErrors);
        if (Object.keys(nextErrors).length > 0) {
            showError(nextErrors.orderPersons || nextErrors.lines || "입력 내용을 확인해 주세요.");
            return;
        }

        showInfo("초안 화면입니다. 신청 내용은 아직 저장되지 않습니다.");
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
            w-[260px] max-w-[88vw] lg:max-w-none lg:w-[239px] h-screen shrink-0
            transform transition-transform duration-300 ease-in-out
            ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
          `}
            >
                <Sidebar onClose={() => setSidebarOpen(false)} />
            </div>

            <div className="flex-1 flex flex-col h-screen overflow-hidden w-full">
                <Header
                    title="등록"
                    onMenuClick={() => setSidebarOpen(true)}
                    rightContent={
                        <div className="flex items-center gap-2 md:gap-3">
                            <Button type="button" variant="outline" size="lg">
                                일정
                            </Button>
                            <Button type="button" variant="primary" size="lg" onClick={handleSubmit}>
                                등록
                            </Button>
                        </div>
                    }
                />
                <div className="flex-1 overflow-y-auto px-4 sm:px-6 md:px-12 lg:px-24 xl:px-48 py-6 md:py-9">
                    <div className="max-w-[960px] mx-auto flex flex-col gap-4 md:gap-6">
                        <div className="grid grid-cols-2 gap-3">
                            <Button
                                type="button"
                                variant="outline"
                                size="lg"
                                fullWidth
                                aria-pressed={purchaseStatus === "planned"}
                                className={
                                    purchaseStatus === "planned"
                                        ? "border-2! border-gray-900! text-gray-900"
                                        : "border-2! border-gray-200!"
                                }
                                onClick={() => setPurchaseStatus("planned")}
                            >
                                예정
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                size="lg"
                                fullWidth
                                aria-pressed={purchaseStatus === "confirmed"}
                                className={
                                    purchaseStatus === "confirmed"
                                        ? "border-2! border-gray-900! text-gray-900"
                                        : "border-2! border-gray-200!"
                                }
                                onClick={() => setPurchaseStatus("confirmed")}
                            >
                                완료
                            </Button>
                        </div>
                        <SectionCard
                            title="구매·가공"
                            headerContent={
                                <div className="flex items-center gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        aria-pressed={purchaseKind === "work"}
                                        className={
                                            purchaseKind === "work"
                                                ? "border-2! border-gray-900! bg-gray-100! text-gray-900"
                                                : "border-2! border-transparent! bg-gray-100! text-gray-700"
                                        }
                                        onClick={() => setPurchaseKind("work")}
                                    >
                                        작업
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        aria-pressed={purchaseKind === "personal"}
                                        className={
                                            purchaseKind === "personal"
                                                ? "border-2! border-gray-900! bg-gray-100! text-gray-900"
                                                : "border-2! border-transparent! bg-gray-100! text-gray-700"
                                        }
                                        onClick={() => setPurchaseKind("personal")}
                                    >
                                        개인
                                    </Button>
                                </div>
                            }
                        >
                            <div
                                className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${
                                    workFieldsOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                                } ${workFieldsRendered ? "" : "hidden"}`}
                                onTransitionEnd={(event) => {
                                    if (event.propertyName !== "grid-template-rows" || purchaseKind === "work") return;
                                    setWorkFieldsRendered(false);
                                }}
                            >
                                <div className={`overflow-hidden min-h-0 ${workFieldsOpen ? "" : "pointer-events-none"}`}>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:items-start">
                                <Input
                                    label="호선명"
                                    value={vessel}
                                    placeholder="호선명"
                                    onChange={setVessel}
                                />
                                <div className="flex flex-col gap-2">
                                    <Select
                                        label="참관감독"
                                        placeholder="그룹 선택"
                                        fullWidth
                                        required
                                        options={ORDER_GROUP_OPTIONS}
                                        value={orderGroup}
                                        onChange={(value) => {
                                            setOrderGroup(value);
                                            setSelectedOrderPerson("");
                                            setOrderPersonCustom("");
                                        }}
                                        error={orderPersons.length === 0 ? errors.orderPersons : undefined}
                                    />
                                    {orderGroup === "OTHER" || orderGroup === "MITSUI" ? null : orderGroup ? (
                                        <Select
                                            placeholder="감독 선택"
                                            fullWidth
                                            required={orderPersons.length === 0}
                                            options={orderPersonOptions}
                                            value={selectedOrderPerson}
                                            onChange={handleSelectOrderPerson}
                                        />
                                    ) : null}
                                    {showOrderPersonCustomInput && (
                                        <div className="flex items-center gap-2 w-full">
                                            <TextInput
                                                placeholder="직급 없이 이름만 기입해 주세요"
                                                value={orderPersonCustom}
                                                onChange={setOrderPersonCustom}
                                                onKeyDown={(event) => {
                                                    if (event.key === "Enter") {
                                                        event.preventDefault();
                                                        handleAddCustomOrderPerson();
                                                    }
                                                }}
                                                required={orderPersons.length === 0}
                                                className="flex-1 min-w-0"
                                            />
                                            <Button
                                                type="button"
                                                variant="primary"
                                                size="lg"
                                                onClick={handleAddCustomOrderPerson}
                                                loading={isAddingOrderPerson}
                                                className="shrink-0"
                                            >
                                                추가
                                            </Button>
                                        </div>
                                    )}
                                    {orderPersons.length > 0 && (
                                        <div className="flex flex-wrap gap-2">
                                            {orderPersons.map((person) => (
                                                <Button
                                                    key={person}
                                                    type="button"
                                                    variant="secondary"
                                                    size="md"
                                                    onClick={() =>
                                                        setOrderPersons((prev) => prev.filter((name) => name !== person))
                                                    }
                                                >
                                                    {person}
                                                    <IconClose className="ml-1 w-4 h-4" />
                                                </Button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="flex flex-col gap-2 lg:col-span-2">
                                    <TextInput
                                        label="출장 목적"
                                        placeholder="선박 점검 및 정비"
                                        required
                                        value={tripPurpose}
                                        onChange={setTripPurpose}
                                        autoComplete="off"
                                        inputRef={purposeInputRef}
                                    />
                                    <div className="flex h-8 items-center gap-2 overflow-x-auto overflow-y-hidden">
                                        {filteredPurposeOptions.map((purpose) => (
                                            <button
                                                key={purpose}
                                                type="button"
                                                onClick={(event) => {
                                                    event.preventDefault();
                                                    handlePurposeClick(purpose);
                                                }}
                                                onMouseDown={(event) => {
                                                    event.preventDefault();
                                                }}
                                                className="shrink-0 px-3 py-1.5 rounded-lg bg-sky-100 text-blue-700 font-medium text-sm hover:bg-sky-200 transition-colors"
                                            >
                                                {purpose}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                                </div>
                            </div>
                            <div className="flex flex-col gap-3">
                                {lines.map((row) => (
                                    <div
                                        key={row.id}
                                        className="rounded-2xl bg-gray-100 p-3 md:p-4 flex flex-col gap-3"
                                    >
                                        <div className="flex items-center gap-2">
                                            <Input
                                                value={row.material}
                                                placeholder="자재명"
                                                onChange={(value) => updateLine(row.id, { material: value })}
                                                className="flex-1 min-w-0"
                                                inputClassName="border-transparent! bg-white focus:border-blue-500!"
                                            />
                                            <button
                                                type="button"
                                                aria-label="품목 삭제"
                                                onClick={() => removeLine(row.id)}
                                                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100"
                                            >
                                                <IconClose className="w-5 h-5" />
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <Input
                                                label="구매처"
                                                value={row.vendor}
                                                placeholder="구매처"
                                                onChange={(value) => updateLine(row.id, { vendor: value })}
                                                inputClassName="border-transparent! bg-white focus:border-blue-500!"
                                            />
                                            <div className="flex flex-col gap-2">
                                                <label className="block text-sm font-medium text-gray-700">
                                                    {purchaseStatus === "planned" ? "예상 비용" : "비용"}
                                                </label>
                                                <div className="flex gap-2">
                                                    <div className="min-w-0 flex-1">
                                                        <TextInput
                                                            placeholder="0"
                                                            inputMode="decimal"
                                                            className="[&>div]:border-transparent! [&>div]:bg-white [&>div]:focus-within:border-blue-500! [&>div]:focus-within:ring-2 [&>div]:focus-within:ring-blue-500/20"
                                                            value={
                                                                focusedCostId === row.id
                                                                    ? row.cost
                                                                    : row.cost
                                                                      ? formatCurrency(parseCurrency(row.cost))
                                                                      : ""
                                                            }
                                                            onChange={(value) =>
                                                                updateLine(row.id, {
                                                                    cost: sanitizeDecimalAmountInput(value),
                                                                })
                                                            }
                                                            onFocus={(event) => {
                                                                setFocusedCostId(row.id);
                                                                const num = parseCurrency(event.target.value);
                                                                if (num > 0) {
                                                                    updateLine(row.id, { cost: String(num) });
                                                                }
                                                            }}
                                                            onBlur={(event) => {
                                                                setFocusedCostId((current) =>
                                                                    current === row.id ? null : current
                                                                );
                                                                const num = parseCurrency(event.target.value);
                                                                updateLine(row.id, {
                                                                    cost: num > 0 ? formatCurrency(num) : "",
                                                                });
                                                            }}
                                                        />
                                                    </div>
                                                    <div className="w-20 shrink-0 md:w-32 [&_select]:border-transparent! [&_select]:bg-white [&_select]:px-2 [&_select]:pr-7 [&_select]:bg-[length:14px] [&_select]:bg-[right_0.35rem_center] [&_select]:focus:border-blue-500! md:[&_select]:px-4 md:[&_select]:pr-11 md:[&_select]:bg-[length:18px] md:[&_select]:bg-[right_1rem_center]">
                                                        <Select
                                                            fullWidth
                                                            options={[...EXPENSE_CURRENCY_OPTIONS]}
                                                            value={row.currency}
                                                            onChange={(value) => updateLine(row.id, { currency: value })}
                                                            size="md"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <Input
                                            label="비고"
                                            value={row.note}
                                            placeholder="규격, 용도 등"
                                            onChange={(value) => updateLine(row.id, { note: value })}
                                            inputClassName="border-transparent! bg-white focus:border-blue-500!"
                                        />
                                        {purchaseStatus === "confirmed" && (
                                            <div className="flex flex-col gap-2">
                                                <span className="block text-sm font-medium text-gray-700">영수증</span>
                                                <label className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm text-gray-500">
                                                    <IconUpload />
                                                    영수증 첨부
                                                    <input
                                                        type="file"
                                                        accept="image/*,.pdf"
                                                        multiple
                                                        className="sr-only"
                                                        onChange={(event) => {
                                                            addReceipts(row.id, event.target.files);
                                                            event.currentTarget.value = "";
                                                        }}
                                                    />
                                                </label>
                                                {row.receipts.length > 0 && (
                                                    <div className="flex flex-col gap-2">
                                                        {row.receipts.map((receipt) => (
                                                            <div
                                                                key={receipt.id}
                                                                className="flex items-center gap-3 rounded-xl bg-white px-3 py-2"
                                                            >
                                                                {receipt.type.startsWith("image/") ? (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() =>
                                                                            setPreviewFile({
                                                                                url: receipt.previewUrl,
                                                                                name: receipt.name,
                                                                                type: receipt.type,
                                                                            })
                                                                        }
                                                                        className="h-10 w-10 shrink-0 overflow-hidden rounded-lg"
                                                                        title="클릭하여 크게 보기"
                                                                    >
                                                                        <img
                                                                            src={receipt.previewUrl}
                                                                            alt={receipt.name}
                                                                            className="h-full w-full object-cover"
                                                                        />
                                                                    </button>
                                                                ) : (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() =>
                                                                            setPreviewFile({
                                                                                url: receipt.previewUrl,
                                                                                name: receipt.name,
                                                                                type: receipt.type,
                                                                            })
                                                                        }
                                                                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-800 text-[10px] font-bold text-white"
                                                                        title="클릭하여 크게 보기"
                                                                    >
                                                                        PDF
                                                                    </button>
                                                                )}
                                                                <span className="min-w-0 flex-1 truncate text-sm text-gray-700">
                                                                    {receipt.name}
                                                                </span>
                                                                <button
                                                                    type="button"
                                                                    aria-label="영수증 삭제"
                                                                    onClick={() => removeReceipt(row.id, receipt.id)}
                                                                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"
                                                                >
                                                                    <IconClose className="h-4 w-4" />
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                            <div className="flex justify-center pt-1">
                                <button
                                    type="button"
                                    onClick={addLine}
                                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 transition-colors hover:bg-gray-100"
                                    aria-label="품목 추가"
                                    title="품목 추가"
                                >
                                    <IconPlus className="h-6 w-6" />
                                </button>
                            </div>
                            <div className="flex items-center justify-between gap-3 text-sm text-gray-500">
                                {filledCount > 0 && <span>{`입력 ${filledCount}건`}</span>}
                                {errors.lines && <span className="text-red-500">{errors.lines}</span>}
                            </div>
                        </SectionCard>
                    </div>
                </div>
            </div>
            {previewFile && (
                <div
                    onClick={() => setPreviewFile(null)}
                    className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999] p-4"
                >
                    <button
                        type="button"
                        onClick={() => setPreviewFile(null)}
                        className="absolute top-4 right-4 w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white transition-colors"
                        aria-label="닫기"
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                            <path
                                d="M19 6.41L17.59 5L12 10.59L6.41 5L5 6.41L10.59 12L5 17.59L6.41 19L12 13.41L17.59 19L19 17.59L13.41 12L19 6.41Z"
                                fill="currentColor"
                            />
                        </svg>
                    </button>

                    <div className="max-w-[92vw] max-h-[92vh]" onClick={(event) => event.stopPropagation()}>
                        {previewFile.type.startsWith("image/") ? (
                            <img
                                src={previewFile.url}
                                alt={previewFile.name}
                                className="max-w-full max-h-[85vh] rounded-xl shadow-2xl bg-white object-contain"
                            />
                        ) : (
                            <iframe
                                src={previewFile.url}
                                title={previewFile.name}
                                className="w-[92vw] h-[85vh] bg-white rounded-xl shadow-2xl"
                            />
                        )}
                        <p className="text-white text-center mt-3 text-[14px] truncate">{previewFile.name}</p>
                    </div>
                </div>
            )}
        </div>
    );
}
