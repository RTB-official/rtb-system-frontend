import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import Select from "../../components/common/Select";
import { IconClose, IconEdit, IconUpload } from "../../components/icons/Icons";
import Chip from "../../components/ui/Chip";
import ImagePreviewModal from "../../components/ui/ImagePreviewModal";
import TextInput from "../../components/ui/TextInput";
import { useToast } from "../../components/ui/ToastProvider";
import { PURPOSE_AUTOCOMPLETE_OPTIONS } from "../../constants/purposeAutocompleteOptions";
import {
    addMaterialPurchaseReceipts,
    updateMaterialPurchase,
    type MaterialPurchaseDetail,
    type MaterialPurchaseKind,
    type MaterialPurchaseReceiptDetail,
} from "../../lib/materialPurchaseApi";
import {
    EXPENSE_CURRENCY_OPTIONS,
    ORDER_PERSONS,
    formatCurrency,
    parseCurrency,
    sanitizeDecimalAmountInput,
} from "../../store/workReportStore";

const ORDER_GROUP_OPTIONS = [
    { value: "ELU", label: "Everllence-ELU" },
    { value: "PRIME", label: "Everllence-Prime" },
    { value: "MITSUI", label: "Mitsui" },
    { value: "OTHER", label: "기타 (직접입력)" },
];

const CURRENCY_MARK: Record<string, string> = {
    원: "₩",
    엔: "¥",
    달러: "$",
    유로: "€",
    위안: "元",
};

const fieldInputClass = "border-transparent! bg-white focus:border-blue-500!";

type NewReceipt = {
    id: string;
    name: string;
    previewUrl: string;
    type: string;
    file: File;
};

type PurchaseEditDraft = {
    kind: MaterialPurchaseKind;
    vessel: string;
    orderGroup: string;
    orderPersons: string[];
    selectedOrderPerson: string;
    orderPersonCustom: string;
    tripPurpose: string;
    materialName: string;
    vendor: string;
    cost: string;
    currency: string;
    spec: string;
    grade: string;
    note: string;
    urgent: boolean;
    keptReceiptIds: string[];
    newReceipts: NewReceipt[];
};

interface MaterialPurchaseDetailSidePanelProps {
    isOpen: boolean;
    loading: boolean;
    detail: MaterialPurchaseDetail | null;
    canApprove: boolean;
    approving: boolean;
    completing: boolean;
    onClose: () => void;
    onApprove: () => void;
    onRevoke: () => void;
    onTogglePurchased: () => void;
    onSaved: () => Promise<void>;
}

function CloseIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path
                d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41Z"
                fill="currentColor"
            />
        </svg>
    );
}

function receiptIsImage(receipt: { contentType: string }) {
    return receipt.contentType.startsWith("image/");
}

function revokeNewReceipts(receipts: NewReceipt[]) {
    receipts.forEach((receipt) => URL.revokeObjectURL(receipt.previewUrl));
}

function draftFromDetail(detail: MaterialPurchaseDetail): PurchaseEditDraft {
    const line = detail.lines[0];
    return {
        kind: detail.kind,
        vessel: detail.vessel,
        orderGroup: detail.orderGroup,
        orderPersons: [...detail.orderPersons],
        selectedOrderPerson: "",
        orderPersonCustom: "",
        tripPurpose: detail.tripPurpose,
        materialName: line?.materialName ?? "",
        vendor: line?.vendor ?? "",
        cost: line?.amountText ?? "",
        currency: line?.currency || "원",
        spec: line?.spec ?? "",
        grade: line?.grade ?? "",
        note: line?.note ?? "",
        urgent: line?.urgent ?? false,
        keptReceiptIds: (line?.receipts ?? []).map((receipt) => receipt.id),
        newReceipts: [],
    };
}

function ReadValue({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <p className="text-sm font-medium text-gray-700">{label}</p>
            <p className="mt-2 text-base text-gray-900 whitespace-pre-wrap break-words">{value || "—"}</p>
        </div>
    );
}

export default function MaterialPurchaseDetailSidePanel({
    isOpen,
    loading,
    detail,
    canApprove,
    approving,
    completing,
    onClose,
    onApprove,
    onRevoke,
    onTogglePurchased,
    onSaved,
}: MaterialPurchaseDetailSidePanelProps) {
    const { showError, showSuccess, showInfo } = useToast();
    const panelRef = useRef<HTMLElement>(null);
    const previewRef = useRef<MaterialPurchaseReceiptDetail | null>(null);
    const editingRef = useRef(false);
    const savingRef = useRef(false);
    const [preview, setPreview] = useState<MaterialPurchaseReceiptDetail | null>(null);
    const [shown, setShown] = useState<MaterialPurchaseDetail | null>(detail);
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [uploadingReceipts, setUploadingReceipts] = useState(false);
    const [draft, setDraft] = useState<PurchaseEditDraft | null>(null);
    const [currencyOpen, setCurrencyOpen] = useState(false);
    const [costFocused, setCostFocused] = useState(false);
    const purposeInputRef = useRef<HTMLInputElement>(null);
    const addingPersonRef = useRef(false);

    previewRef.current = preview;
    editingRef.current = editing;
    savingRef.current = saving;

    useEffect(() => {
        if (detail) setShown(detail);
    }, [detail]);

    useEffect(() => {
        if (isOpen) return;
        setPreview(null);
        setEditing(false);
        setCurrencyOpen(false);
        setCostFocused(false);
        setDraft((current) => {
            if (current) revokeNewReceipts(current.newReceipts);
            return null;
        });
    }, [isOpen]);

    useEffect(() => {
        if (!currencyOpen) return;
        const close = (event: MouseEvent) => {
            const target = event.target as HTMLElement | null;
            if (target?.closest("[data-currency-menu]")) return;
            setCurrencyOpen(false);
        };
        document.addEventListener("mousedown", close);
        return () => document.removeEventListener("mousedown", close);
    }, [currencyOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key !== "Escape") return;
            if (previewRef.current) return;
            if (savingRef.current) return;
            if (editingRef.current) {
                setEditing(false);
                setCurrencyOpen(false);
                setCostFocused(false);
                setDraft((current) => {
                    if (current) revokeNewReceipts(current.newReceipts);
                    return null;
                });
                return;
            }
            onClose();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose]);

    useEffect(() => {
        if (!isOpen) return;
        const handlePointerDown = (event: MouseEvent) => {
            const target = event.target as HTMLElement | null;
            if (!target) return;
            if (previewRef.current) return;
            if (editingRef.current) return;
            if (panelRef.current?.contains(target)) return;
            if (target.closest("[data-materials-list='true']")) return;
            if (target.closest("[data-base-modal='true']")) return;
            if (target.closest('[data-app-toast="true"]')) return;
            onClose();
        };
        document.addEventListener("mousedown", handlePointerDown);
        return () => document.removeEventListener("mousedown", handlePointerDown);
    }, [isOpen, onClose]);

    const view = shown;
    const line = view?.lines[0];
    const showApprove = canApprove && view?.approvalStatus === "pending";
    const showRevoke = canApprove && view?.approvalStatus === "approved";

    const orderPersonOptions = useMemo(() => {
        if (!draft?.orderGroup || draft.orderGroup === "OTHER" || draft.orderGroup === "MITSUI") return [];
        return [
            ...(ORDER_PERSONS[draft.orderGroup] || []).map((name) => ({ value: name, label: name })),
            { value: "OTHER", label: "기타(직접입력)" },
        ];
    }, [draft?.orderGroup]);

    const filteredPurposeOptions = useMemo(() => {
        const tripPurpose = draft?.tripPurpose ?? "";
        if (!tripPurpose.trim()) return [];
        const parts = tripPurpose.trim().split(/\s+/);
        const searchText = parts[parts.length - 1].toLowerCase();
        if (!searchText) return [];
        return PURPOSE_AUTOCOMPLETE_OPTIONS.filter((option) => option.toLowerCase().startsWith(searchText));
    }, [draft?.tripPurpose]);

    const showOrderPersonCustomInput =
        !!draft &&
        (draft.orderGroup === "OTHER" || draft.orderGroup === "MITSUI" || draft.selectedOrderPerson === "OTHER");

    const patchDraft = (patch: Partial<PurchaseEditDraft>) => {
        setDraft((current) => (current ? { ...current, ...patch } : current));
    };

    const addOrderPerson = (person: string) => {
        const next = person.trim();
        if (!next) return;
        setDraft((current) => {
            if (!current || current.orderPersons.includes(next)) return current;
            return { ...current, orderPersons: [...current.orderPersons, next] };
        });
    };

    const startEdit = () => {
        if (!view?.lines[0] || saving) return;
        setDraft(draftFromDetail(view));
        setEditing(true);
    };

    const cancelEdit = () => {
        if (saving) return;
        setEditing(false);
        setCurrencyOpen(false);
        setCostFocused(false);
        setDraft((current) => {
            if (current) revokeNewReceipts(current.newReceipts);
            return null;
        });
    };

    const saveEdit = async () => {
        if (!view || !draft || !line || saving) return;
        if (draft.kind === "work" && draft.orderPersons.length === 0) {
            showError("참관감독을 선택해 주세요.");
            return;
        }
        if (!draft.materialName.trim()) {
            showError("자재명을 입력해 주세요.");
            return;
        }

        setSaving(true);
        try {
            await updateMaterialPurchase({
                purchaseId: view.id,
                lineId: line.id,
                kind: draft.kind,
                vesselName: draft.vessel,
                orderGroup: draft.orderGroup,
                orderPersons: draft.orderPersons,
                tripPurpose: draft.tripPurpose,
                materialName: draft.materialName,
                vendor: draft.vendor,
                amount: draft.cost.trim() ? parseCurrency(draft.cost) : null,
                currency: draft.currency || "원",
                spec: draft.spec,
                grade: draft.grade,
                note: draft.note,
                urgent: draft.urgent,
                keptReceiptIds: draft.keptReceiptIds,
                newReceipts: draft.newReceipts.map((receipt) => receipt.file),
            });
            await onSaved();
            revokeNewReceipts(draft.newReceipts);
            setDraft(null);
            setEditing(false);
            setCurrencyOpen(false);
            setCostFocused(false);
            showSuccess("수정되었습니다.");
        } catch (error) {
            showError(error instanceof Error ? error.message : "수정에 실패했습니다.");
        } finally {
            setSaving(false);
        }
    };

    const keptReceipts = (line?.receipts ?? []).filter((receipt) => draft?.keptReceiptIds.includes(receipt.id));

    const addViewReceipts = async (files: FileList | null) => {
        if (!view || !line || !files || files.length === 0 || uploadingReceipts) return;
        setUploadingReceipts(true);
        try {
            await addMaterialPurchaseReceipts({
                purchaseId: view.id,
                lineId: line.id,
                files: Array.from(files),
            });
            await onSaved();
            showSuccess("영수증이 추가되었습니다.");
        } catch (error) {
            showError(error instanceof Error ? error.message : "영수증 추가에 실패했습니다.");
        } finally {
            setUploadingReceipts(false);
        }
    };

    return createPortal(
        <>
            {isOpen && (
                <button
                    type="button"
                    className="fixed inset-0 z-[9999] bg-black/20 sm:hidden"
                    aria-label="상세 닫기"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                        if (editing || saving) return;
                        onClose();
                    }}
                />
            )}
            <aside
                ref={panelRef}
                className={`fixed inset-y-0 right-0 z-[10000] h-screen w-[calc(100%-3.5rem)] sm:w-[560px] lg:w-[min(calc(50vw+24px),960px)] border-l border-gray-200 bg-white shadow-2xl transition-transform duration-300 ease-in-out ${
                    isOpen ? "translate-x-0" : "translate-x-full"
                }`}
            >
                <div className="flex h-full flex-col">
                    <div className="flex items-center justify-between border-b border-gray-200 px-6 py-3.5">
                        <h2 className="text-xl font-bold text-gray-900">구매·가공 상세</h2>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={startEdit}
                                disabled={!line || editing}
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-sm transition-all hover:border-blue-200 hover:text-blue-600 disabled:opacity-40"
                                aria-label="수정"
                            >
                                <IconEdit className="h-4 w-4" />
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    if (saving) return;
                                    onClose();
                                }}
                                className="flex h-10 w-10 items-center justify-center rounded-full text-gray-700 transition-colors hover:bg-gray-100"
                                aria-label="close"
                            >
                                <CloseIcon />
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto px-6 py-6">
                        {loading && !view ? (
                            <div className="py-10 text-center text-sm text-gray-500">불러오는 중...</div>
                        ) : !view || !line ? (
                            <div className="py-10 text-center text-sm text-gray-500">불러오는 중...</div>
                        ) : editing && draft ? (
                            <div className="flex flex-col gap-4">
                                <div className="flex items-center justify-end gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        aria-pressed={draft.kind === "work"}
                                        className={
                                            draft.kind === "work"
                                                ? "border-2! border-green-600! bg-green-500! text-white! hover:bg-green-600!"
                                                : "border-2! border-transparent! bg-green-100! text-green-800! hover:bg-green-200!"
                                        }
                                        onClick={() => patchDraft({ kind: "work" })}
                                    >
                                        작업 자재
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        aria-pressed={draft.kind === "personal"}
                                        className={
                                            draft.kind === "personal"
                                                ? "border-2! border-gray-900! bg-gray-100! text-gray-900"
                                                : "border-2! border-transparent! bg-gray-100! text-gray-700"
                                        }
                                        onClick={() => patchDraft({ kind: "personal" })}
                                    >
                                        기타
                                    </Button>
                                </div>

                                {draft.kind === "work" && (
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:items-start">
                                        <Input
                                            label="호선명"
                                            value={draft.vessel}
                                            placeholder="호선명"
                                            uppercase
                                            onChange={(value) => patchDraft({ vessel: value })}
                                        />
                                        <div className="flex flex-col gap-2">
                                            <Select
                                                label="참관감독"
                                                placeholder="그룹 선택"
                                                fullWidth
                                                options={
                                                    draft.orderGroup &&
                                                    !ORDER_GROUP_OPTIONS.some((option) => option.value === draft.orderGroup)
                                                        ? [
                                                              ...ORDER_GROUP_OPTIONS,
                                                              { value: draft.orderGroup, label: draft.orderGroup },
                                                          ]
                                                        : ORDER_GROUP_OPTIONS
                                                }
                                                value={draft.orderGroup}
                                                onChange={(value) =>
                                                    patchDraft({
                                                        orderGroup: value,
                                                        selectedOrderPerson: "",
                                                        orderPersonCustom: "",
                                                    })
                                                }
                                            />
                                            {draft.orderGroup && draft.orderGroup !== "OTHER" && draft.orderGroup !== "MITSUI" && (
                                                <Select
                                                    placeholder="감독 선택"
                                                    fullWidth
                                                    options={orderPersonOptions}
                                                    value={draft.selectedOrderPerson}
                                                    onChange={(value) => {
                                                        patchDraft({ selectedOrderPerson: value });
                                                        if (value !== "OTHER") {
                                                            addOrderPerson(value);
                                                            patchDraft({ selectedOrderPerson: "" });
                                                        }
                                                    }}
                                                />
                                            )}
                                            {showOrderPersonCustomInput && (
                                                <div className="flex items-center gap-2 w-full">
                                                    <TextInput
                                                        placeholder="직급 없이 이름만 기입해 주세요"
                                                        value={draft.orderPersonCustom}
                                                        onChange={(value) => patchDraft({ orderPersonCustom: value })}
                                                        onKeyDown={(event) => {
                                                            if (event.key !== "Enter") return;
                                                            event.preventDefault();
                                                            if (addingPersonRef.current) return;
                                                            addingPersonRef.current = true;
                                                            addOrderPerson(draft.orderPersonCustom);
                                                            patchDraft({ orderPersonCustom: "", selectedOrderPerson: "" });
                                                            addingPersonRef.current = false;
                                                        }}
                                                        className="flex-1 min-w-0"
                                                    />
                                                    <Button
                                                        type="button"
                                                        variant="primary"
                                                        size="lg"
                                                        className="shrink-0"
                                                        onClick={() => {
                                                            addOrderPerson(draft.orderPersonCustom);
                                                            patchDraft({ orderPersonCustom: "", selectedOrderPerson: "" });
                                                        }}
                                                    >
                                                        추가
                                                    </Button>
                                                </div>
                                            )}
                                            {draft.orderPersons.length > 0 && (
                                                <div className="flex flex-wrap gap-2">
                                                    {draft.orderPersons.map((person) => (
                                                        <Button
                                                            key={person}
                                                            type="button"
                                                            variant="secondary"
                                                            size="md"
                                                            onClick={() =>
                                                                patchDraft({
                                                                    orderPersons: draft.orderPersons.filter((name) => name !== person),
                                                                })
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
                                                value={draft.tripPurpose}
                                                onChange={(value) => patchDraft({ tripPurpose: value })}
                                                autoComplete="off"
                                                inputRef={purposeInputRef}
                                            />
                                            {filteredPurposeOptions.length > 0 && (
                                                <div className="flex h-8 items-center gap-2 overflow-x-auto overflow-y-hidden">
                                                    {filteredPurposeOptions.map((purpose) => (
                                                        <button
                                                            key={purpose}
                                                            type="button"
                                                            onMouseDown={(event) => event.preventDefault()}
                                                            onClick={() => {
                                                                const current = draft.tripPurpose.trim();
                                                                const next = current.includes(" ")
                                                                    ? `${current.split(/\s+/).slice(0, -1).join(" ")} ${purpose}`
                                                                    : purpose;
                                                                patchDraft({ tripPurpose: next });
                                                                setTimeout(() => purposeInputRef.current?.focus(), 0);
                                                            }}
                                                            className="shrink-0 px-3 py-1.5 rounded-lg bg-sky-100 text-blue-700 font-medium text-sm hover:bg-sky-200 transition-colors"
                                                        >
                                                            {purpose}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                <div
                                    className={`rounded-2xl p-3 md:p-4 flex flex-col gap-3 ${
                                        draft.urgent ? "bg-red-50" : "bg-gray-100"
                                    }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <Input
                                            value={draft.materialName}
                                            placeholder="자재명"
                                            onChange={(value) => patchDraft({ materialName: value })}
                                            className="flex-1 min-w-0"
                                            inputClassName={fieldInputClass}
                                        />
                                        <button
                                            type="button"
                                            aria-pressed={draft.urgent}
                                            onClick={() => {
                                                const nextUrgent = !draft.urgent;
                                                patchDraft({ urgent: nextUrgent });
                                                if (nextUrgent) {
                                                    showInfo("30만 원 미만이면 승인 없이 구매를 진행할 수 있습니다.");
                                                }
                                            }}
                                            className={`h-12 shrink-0 whitespace-nowrap rounded-xl border px-3 text-sm font-medium ${
                                                draft.urgent
                                                    ? "border-red-500 bg-red-500 text-white"
                                                    : "border-gray-200 bg-white text-gray-500"
                                            }`}
                                        >
                                            긴급
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <Input
                                            label="구매처"
                                            value={draft.vendor}
                                            placeholder="구매처"
                                            onChange={(value) => patchDraft({ vendor: value })}
                                            inputClassName={fieldInputClass}
                                        />
                                        <div className="flex flex-col gap-2 min-w-0">
                                            <label className="block text-sm font-medium text-gray-700">비용</label>
                                            <div className="relative min-w-0">
                                                <TextInput
                                                    placeholder="0"
                                                    inputMode="decimal"
                                                    className="[&>div]:border-transparent! [&>div]:bg-white [&>div]:p-2! [&>div]:focus-within:border-blue-500! [&>div]:focus-within:ring-2 [&>div]:focus-within:ring-blue-500/20"
                                                    icon={
                                                        <button
                                                            type="button"
                                                            data-currency-menu="true"
                                                            className="ml-2 inline-flex h-8 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-gray-200 px-2 text-sm font-medium text-gray-900"
                                                            onMouseDown={(event) => event.preventDefault()}
                                                            onClick={() => setCurrencyOpen((current) => !current)}
                                                        >
                                                            {CURRENCY_MARK[draft.currency] ?? draft.currency}
                                                        </button>
                                                    }
                                                    value={
                                                        costFocused
                                                            ? draft.cost
                                                            : draft.cost
                                                              ? formatCurrency(parseCurrency(draft.cost))
                                                              : ""
                                                    }
                                                    onChange={(value) =>
                                                        patchDraft({ cost: sanitizeDecimalAmountInput(value) })
                                                    }
                                                    onFocus={(event) => {
                                                        setCostFocused(true);
                                                        const num = parseCurrency(event.target.value);
                                                        if (num > 0) patchDraft({ cost: String(num) });
                                                    }}
                                                    onBlur={(event) => {
                                                        setCostFocused(false);
                                                        const num = parseCurrency(event.target.value);
                                                        patchDraft({ cost: num > 0 ? formatCurrency(num) : "" });
                                                    }}
                                                />
                                                {currencyOpen && (
                                                    <div
                                                        data-currency-menu="true"
                                                        className="absolute right-0 top-full z-30 mt-1 min-w-[7.5rem] overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-lg"
                                                    >
                                                        {EXPENSE_CURRENCY_OPTIONS.map((option) => (
                                                            <button
                                                                key={option.value}
                                                                type="button"
                                                                className={`block w-full px-3 py-2 text-left text-sm hover:bg-gray-50 ${
                                                                    draft.currency === option.value
                                                                        ? "font-semibold text-gray-900"
                                                                        : "text-gray-700"
                                                                }`}
                                                                onMouseDown={(event) => event.preventDefault()}
                                                                onClick={() => {
                                                                    patchDraft({ currency: option.value });
                                                                    setCurrencyOpen(false);
                                                                }}
                                                            >
                                                                {`${CURRENCY_MARK[option.value] ?? ""} ${option.label}`}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <Input
                                            label="규격"
                                            value={draft.spec}
                                            placeholder="규격"
                                            onChange={(value) => patchDraft({ spec: value })}
                                            inputClassName={fieldInputClass}
                                        />
                                        <Input
                                            label="재질/Grade"
                                            value={draft.grade}
                                            placeholder="재질/Grade"
                                            onChange={(value) => patchDraft({ grade: value })}
                                            inputClassName={fieldInputClass}
                                        />
                                    </div>
                                    <Input
                                        label="비고"
                                        value={draft.note}
                                        placeholder="용도, 특이사항 등"
                                        onChange={(value) => patchDraft({ note: value })}
                                        inputClassName={fieldInputClass}
                                    />
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
                                                    const files = event.target.files;
                                                    if (!files || files.length === 0) return;
                                                    const next = Array.from(files).map((file) => ({
                                                        id: `receipt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                                                        name: file.name,
                                                        previewUrl: URL.createObjectURL(file),
                                                        type: file.type || "application/octet-stream",
                                                        file,
                                                    }));
                                                    setDraft((current) =>
                                                        current
                                                            ? { ...current, newReceipts: [...current.newReceipts, ...next] }
                                                            : current
                                                    );
                                                    event.currentTarget.value = "";
                                                }}
                                            />
                                        </label>
                                        {[...keptReceipts, ...draft.newReceipts].length > 0 && (
                                            <div className="flex flex-col gap-2">
                                                {keptReceipts.map((receipt) => (
                                                    <div
                                                        key={receipt.id}
                                                        className="flex items-center gap-3 rounded-xl bg-white px-3 py-2"
                                                    >
                                                        <ReceiptThumb
                                                            name={receipt.fileName}
                                                            type={receipt.contentType}
                                                            url={receipt.url}
                                                            onOpen={() => setPreview(receipt)}
                                                        />
                                                        <span className="min-w-0 flex-1 truncate text-sm text-gray-700">
                                                            {receipt.fileName}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            aria-label="영수증 삭제"
                                                            onClick={() =>
                                                                patchDraft({
                                                                    keptReceiptIds: draft.keptReceiptIds.filter(
                                                                        (id) => id !== receipt.id
                                                                    ),
                                                                })
                                                            }
                                                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"
                                                        >
                                                            <IconClose className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                ))}
                                                {draft.newReceipts.map((receipt) => (
                                                    <div
                                                        key={receipt.id}
                                                        className="flex items-center gap-3 rounded-xl bg-white px-3 py-2"
                                                    >
                                                        <ReceiptThumb
                                                            name={receipt.name}
                                                            type={receipt.type}
                                                            url={receipt.previewUrl}
                                                            onOpen={() =>
                                                                setPreview({
                                                                    id: receipt.id,
                                                                    fileName: receipt.name,
                                                                    contentType: receipt.type,
                                                                    url: receipt.previewUrl,
                                                                    storagePath: "",
                                                                })
                                                            }
                                                        />
                                                        <span className="min-w-0 flex-1 truncate text-sm text-gray-700">
                                                            {receipt.name}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            aria-label="영수증 삭제"
                                                            onClick={() => {
                                                                URL.revokeObjectURL(receipt.previewUrl);
                                                                patchDraft({
                                                                    newReceipts: draft.newReceipts.filter(
                                                                        (item) => item.id !== receipt.id
                                                                    ),
                                                                });
                                                            }}
                                                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"
                                                        >
                                                            <IconClose className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-6">
                                {view.kind === "work" && (
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                        <ReadValue label="호선명" value={view.vessel} />
                                        <div>
                                            <p className="text-sm font-medium text-gray-700">참관감독</p>
                                            <div className="mt-2 flex flex-wrap items-center gap-2">
                                                <span className="text-base text-gray-900">{view.orderGroupLabel || "—"}</span>
                                                {view.orderPersons.map((person) => (
                                                    <span
                                                        key={person}
                                                        className="inline-flex h-9 items-center rounded-[10px] bg-[#eef7ff] px-3 text-sm font-medium text-[#3b82f6]"
                                                    >
                                                        {person}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="lg:col-span-2">
                                            <ReadValue label="출장 목적" value={view.tripPurpose} />
                                        </div>
                                    </div>
                                )}

                                <div
                                    className={`rounded-2xl p-3 md:p-4 flex flex-col gap-4 ${
                                        line.urgent ? "bg-red-50" : "bg-gray-100"
                                    }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <p className="min-w-0 flex-1 text-base text-gray-900 break-words">
                                            {line.materialName || "—"}
                                        </p>
                                        <Chip
                                            color={view.kind === "personal" ? "purple-500" : "green-500"}
                                            variant="solid"
                                            size="md"
                                        >
                                            {view.kind === "personal" ? "기타" : "작업 자재"}
                                        </Chip>
                                        {line.urgent && (
                                            <span className="shrink-0 border border-red-500 px-1.5 py-0.5 text-xs font-medium leading-none text-red-500">
                                                긴급
                                            </span>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <ReadValue label="구매처" value={line.vendor} />
                                        <ReadValue
                                            label="비용"
                                            value={
                                                line.amountText
                                                    ? `${line.amountText} ${CURRENCY_MARK[line.currency] ?? line.currency}`
                                                    : ""
                                            }
                                        />
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <ReadValue label="규격" value={line.spec} />
                                        <ReadValue label="재질/Grade" value={line.grade} />
                                    </div>
                                    <ReadValue label="비고" value={line.note} />
                                    <div className="flex flex-col gap-2">
                                        <span className="block text-sm font-medium text-gray-700">영수증</span>
                                        {line.receipts.map((receipt) => (
                                            <div
                                                key={receipt.id}
                                                className="flex items-center gap-3 rounded-xl bg-white px-3 py-2"
                                            >
                                                <ReceiptThumb
                                                    name={receipt.fileName}
                                                    type={receipt.contentType}
                                                    url={receipt.url}
                                                    onOpen={() => setPreview(receipt)}
                                                />
                                                <span className="min-w-0 flex-1 truncate text-sm text-gray-700">
                                                    {receipt.fileName}
                                                </span>
                                            </div>
                                        ))}
                                        <label
                                            className={`flex h-12 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm text-gray-500 ${
                                                uploadingReceipts ? "pointer-events-none opacity-60" : "cursor-pointer"
                                            }`}
                                        >
                                            <IconUpload />
                                            {uploadingReceipts ? "업로드 중..." : "영수증 첨부"}
                                            <input
                                                type="file"
                                                accept="image/*,.pdf"
                                                multiple
                                                className="sr-only"
                                                disabled={uploadingReceipts}
                                                onChange={(event) => {
                                                    void addViewReceipts(event.target.files);
                                                    event.currentTarget.value = "";
                                                }}
                                            />
                                        </label>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {editing ? (
                        <div className="flex justify-end gap-2 border-t border-gray-200 px-6 py-4">
                            <Button type="button" variant="outline" size="lg" disabled={saving} onClick={cancelEdit}>
                                취소
                            </Button>
                            <Button type="button" variant="primary" size="lg" loading={saving} onClick={saveEdit}>
                                저장
                            </Button>
                        </div>
                    ) : (
                        (showApprove || showRevoke) && (
                            <div className="flex justify-end gap-2 border-t border-gray-200 px-6 py-4">
                                {showApprove ? (
                                    <Button variant="primary" size="lg" loading={approving} disabled={completing} onClick={onApprove}>
                                        승인
                                    </Button>
                                ) : (
                                    <Button variant="outline" size="lg" loading={approving} disabled={completing} onClick={onRevoke}>
                                        승인 해제
                                    </Button>
                                )}
                                <Button
                                    variant={view?.purchased ? "outline" : "primary"}
                                    size="lg"
                                    loading={completing}
                                    disabled={approving}
                                    onClick={onTogglePurchased}
                                >
                                    {view?.purchased ? "구매 완료 해제" : "구매 완료"}
                                </Button>
                            </div>
                        )
                    )}
                </div>
            </aside>
            <ImagePreviewModal
                isOpen={preview != null}
                onClose={() => setPreview(null)}
                imageSrc={preview?.url ?? null}
                imageAlt={preview?.fileName}
                fileName={preview?.fileName}
                fileType={preview?.contentType}
                zIndex={10050}
            />
        </>,
        document.body
    );
}

function ReceiptThumb({
    name,
    type,
    url,
    onOpen,
}: {
    name: string;
    type: string;
    url: string;
    onOpen: () => void;
}) {
    if (receiptIsImage({ contentType: type })) {
        return (
            <button
                type="button"
                onClick={onOpen}
                className="h-10 w-10 shrink-0 overflow-hidden rounded-lg"
                title="클릭하여 크게 보기"
            >
                <img src={url} alt={name} className="h-full w-full object-cover" />
            </button>
        );
    }
    return (
        <button
            type="button"
            onClick={onOpen}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-800 text-[10px] font-bold text-white"
            title="클릭하여 크게 보기"
        >
            PDF
        </button>
    );
}
