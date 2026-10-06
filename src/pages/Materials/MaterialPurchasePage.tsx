import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useSidebarOpen } from "../../hooks/useSidebarOpen";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/common/Header";
import SectionCard from "../../components/ui/SectionCard";
import Input from "../../components/common/Input";
import Select from "../../components/common/Select";
import TextInput from "../../components/ui/TextInput";
import Button from "../../components/common/Button";
import { IconClose, IconImage, IconPlus, IconSearch, IconUpload } from "../../components/icons/Icons";
import { useToast } from "../../components/ui/ToastProvider";
import {
    createMaterialPurchase,
    fetchMaterialPurchaseList,
    isUrgentAmountOverLimit,
    URGENT_AMOUNT_LIMIT_MESSAGE,
    type MaterialPurchaseListItem,
    type MaterialPurchaseListReceipt,
} from "../../lib/materialPurchaseApi";
import Chip from "../../components/ui/Chip";
import ImagePreviewModal from "../../components/ui/ImagePreviewModal";
import SchedulePickModal, { type SchedulePickItem } from "./SchedulePickModal";
import { EXPENSE_CURRENCY_OPTIONS, ORDER_PERSONS, formatCurrency, parseCurrency, sanitizeDecimalAmountInput } from "../../store/workReportStore";
import { PURPOSE_AUTOCOMPLETE_OPTIONS } from "../../constants/purposeAutocompleteOptions";

type LineReceipt = {
    id: string;
    name: string;
    previewUrl: string;
    type: string;
    file: File;
};

type PurchaseLine = {
    id: string;
    material: string;
    vendor: string;
    cost: string;
    currency: string;
    spec: string;
    grade: string;
    note: string;
    urgent: boolean;
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
        spec: "",
        grade: "",
        note: "",
        urgent: false,
        receipts: [],
    };
}

function lineName(line: PurchaseLine) {
    return line.material.trim();
}

function compactText(value: string) {
    return value.replace(/\s+/g, "").toLowerCase();
}

function historyItemMatchesFilter(item: MaterialPurchaseListItem, filter: string) {
    if (!filter) return false;
    return [item.materialName, item.vendor, item.amountLabel, item.createdAtLabel, item.vessel, item.author].some(
        (value) => compactText(value).includes(filter)
    );
}

function highlightText(text: string, query: string) {
    const needle = query.trim();
    if (!needle || !text) return text;
    const lower = text.toLowerCase();
    const target = needle.toLowerCase();
    const nodes: ReactNode[] = [];
    let start = 0;
    let index = lower.indexOf(target);
    let key = 0;
    while (index >= 0) {
        if (index > start) nodes.push(text.slice(start, index));
        nodes.push(
            <mark key={key} className="rounded-sm bg-yellow-200 text-inherit">
                {text.slice(index, index + needle.length)}
            </mark>
        );
        key += 1;
        start = index + needle.length;
        index = lower.indexOf(target, start);
    }
    if (nodes.length === 0) return text;
    if (start < text.length) nodes.push(text.slice(start));
    return nodes;
}

type HistorySort = "date-desc" | "date-asc" | "amount-desc" | "amount-asc";
type HistorySortMenu = "order" | null;

function historyAmount(item: MaterialPurchaseListItem): number | null {
    if (!item.amountLabel.trim()) return null;
    const amount = parseCurrency(item.amountLabel);
    return Number.isFinite(amount) ? amount : null;
}

function compareHistory(a: MaterialPurchaseListItem, b: MaterialPurchaseListItem, sort: HistorySort) {
    if (sort === "date-desc" || sort === "date-asc") {
        if (a.createdAtLabel === b.createdAtLabel) return 0;
        if (!a.createdAtLabel) return 1;
        if (!b.createdAtLabel) return -1;
        const compared = a.createdAtLabel < b.createdAtLabel ? -1 : 1;
        return sort === "date-asc" ? compared : -compared;
    }
    const left = historyAmount(a);
    const right = historyAmount(b);
    if (left == null && right == null) return 0;
    if (left == null) return 1;
    if (right == null) return -1;
    return sort === "amount-asc" ? left - right : right - left;
}

function HistorySortControls({
    sort,
    menu,
    onToggleMenu,
    onSelect,
    buttonClassName,
}: {
    sort: HistorySort | null;
    menu: HistorySortMenu;
    onToggleMenu: (menu: Exclude<HistorySortMenu, null>) => void;
    onSelect: (sort: HistorySort) => void;
    buttonClassName: string;
}) {
    const optionClass = (active: boolean) =>
        `block w-full px-3 py-2 text-left text-sm hover:bg-gray-50 ${
            active ? "font-semibold text-gray-900" : "text-gray-700"
        }`;

    return (
        <div className="flex items-center" data-history-sort="true">
            <div className="relative">
                <button
                    type="button"
                    aria-label="정렬"
                    aria-pressed={sort != null}
                    className={`${buttonClassName} ${sort != null ? "bg-gray-100 text-gray-900" : ""}`}
                    onClick={() => onToggleMenu("order")}
                >
                    <svg className="h-4 w-5" viewBox="0 0 32 24" aria-hidden="true">
                        <path fill="currentColor" d="M8 1.2 14.2 9H10.4v13.6H5.6V9H1.8L8 1.2z" />
                        <path fill="currentColor" fillOpacity="0.45" d="M24 22.8 17.8 15h3.8V1.4h4.8V15h3.8L24 22.8z" />
                    </svg>
                </button>
                {menu === "order" && (
                    <div className="absolute right-0 top-full z-30 mt-1 min-w-[8.5rem] overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
                        <button type="button" className={optionClass(sort === "amount-desc")} onClick={() => onSelect("amount-desc")}>
                            금액 높은순
                        </button>
                        <button type="button" className={optionClass(sort === "amount-asc")} onClick={() => onSelect("amount-asc")}>
                            금액 낮은순
                        </button>
                        <button type="button" className={optionClass(sort === "date-desc")} onClick={() => onSelect("date-desc")}>
                            날짜 최근순
                        </button>
                        <button type="button" className={optionClass(sort === "date-asc")} onClick={() => onSelect("date-asc")}>
                            날짜 과거순
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

function HistorySearchField({
    value,
    open,
    onChange,
    onOpenChange,
    heightClassName,
}: {
    value: string;
    open: boolean;
    onChange: (value: string) => void;
    onOpenChange: (open: boolean) => void;
    heightClassName: string;
}) {
    const inputRef = useRef<HTMLInputElement>(null);
    const slotClassName = heightClassName === "h-9" ? "h-9 w-9" : "h-8 w-8";

    useEffect(() => {
        if (open) inputRef.current?.focus();
    }, [open]);

    return (
        <div className={`relative shrink-0 ${slotClassName}`}>
            <div
                className={`absolute right-0 top-1/2 z-20 flex -translate-y-1/2 items-center overflow-hidden rounded-full bg-white transition-[width] duration-300 ease-out ${heightClassName} ${
                    open ? "w-44 border border-gray-200 bg-gray-50 shadow-sm" : slotClassName
                }`}
            >
                <button
                    type="button"
                    aria-label="구매내역 검색"
                    aria-expanded={open}
                    className={`flex ${slotClassName} shrink-0 items-center justify-center text-gray-500 hover:bg-gray-100 ${
                        open ? "" : "rounded-full"
                    }`}
                    onClick={() => onOpenChange(!open)}
                >
                    <IconSearch className="!h-[18px] !w-[18px]" />
                </button>
                <input
                    ref={inputRef}
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    onBlur={() => {
                        if (!value.trim()) onOpenChange(false);
                    }}
                    placeholder="검색"
                    className="min-w-0 flex-1 bg-transparent pr-2 text-sm text-gray-900 outline-none placeholder:text-gray-400"
                    tabIndex={open ? 0 : -1}
                />
            </div>
        </div>
    );
}

function revokeReceipts(receipts: LineReceipt[]) {
    receipts.forEach((receipt) => {
        URL.revokeObjectURL(receipt.previewUrl);
    });
}

function orderGroupFromCustomer(company: string): string {
    const normalized = company.replace(/\s+/g, "").toLowerCase();
    if (!normalized) return "";
    if (normalized.includes("prime")) return "PRIME";
    if (normalized.includes("mitsui")) return "MITSUI";
    if (normalized.includes("elu") || normalized.includes("leo")) return "ELU";
    return "";
}

function supervisorNamesFromContact(contact: string): string[] {
    return [
        ...new Set(
            contact
                .split(/[,、·/\n]+/)
                .map((name) => name.replace(/감독/g, "").trim())
                .filter(Boolean)
        ),
    ];
}

function supervisorsFromCustomer(company: string, contact: string): { group: string; persons: string[] } {
    const persons = supervisorNamesFromContact(contact);
    const companyGroup = orderGroupFromCustomer(company);
    if (companyGroup) return { group: companyGroup, persons };
    const matchedGroup = (["ELU", "PRIME"] as const).find((group) =>
        persons.length > 0 && persons.every((name) => (ORDER_PERSONS[group] ?? []).includes(name))
    );
    if (matchedGroup) return { group: matchedGroup, persons };
    if (persons.length === 0 && !company.trim()) return { group: "", persons: [] };
    return { group: "OTHER", persons };
}

const CURRENCY_MARK: Record<string, string> = {
    원: "₩",
    엔: "¥",
    달러: "$",
    유로: "€",
    위안: "元",
};

export default function MaterialPurchasePage() {
    const [sidebarOpen, setSidebarOpen] = useSidebarOpen();
    const { showError, showSuccess, showInfo } = useToast();
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
    const [currencyMenuLineId, setCurrencyMenuLineId] = useState<string | null>(null);
    const [errors, setErrors] = useState<{ orderPersons?: string; lines?: string }>({});
    const [saving, setSaving] = useState(false);
    const [scheduleOpen, setScheduleOpen] = useState(false);
    const [previewFile, setPreviewFile] = useState<{
        url: string;
        name: string;
        type: string;
    } | null>(null);
    const skipWorkFieldsIntro = useRef(true);
    const formColumnRef = useRef<HTMLDivElement>(null);
    const [historyLineId, setHistoryLineId] = useState<string | null>(null);
    const [historyDismissedQuery, setHistoryDismissedQuery] = useState<string | null>(null);
    const [historyItems, setHistoryItems] = useState<MaterialPurchaseListItem[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyError, setHistoryError] = useState("");
    const [historyPanelLeft, setHistoryPanelLeft] = useState<number | null>(null);
    const [historyPanelTop, setHistoryPanelTop] = useState(73);
    const [historyDesktopLayout, setHistoryDesktopLayout] = useState(
        () => typeof window !== "undefined" && window.innerWidth >= 1024
    );
    const [historySort, setHistorySort] = useState<HistorySort | null>(null);
    const [historySortMenu, setHistorySortMenu] = useState<HistorySortMenu>(null);
    const [historyFilter, setHistoryFilter] = useState("");
    const [historySearchOpen, setHistorySearchOpen] = useState(false);
    const [historyPreview, setHistoryPreview] = useState<{ receipts: MaterialPurchaseListReceipt[]; index: number } | null>(
        null
    );

    useEffect(() => {
        if (!currencyMenuLineId) return;
        const close = (event: MouseEvent) => {
            const target = event.target as HTMLElement | null;
            if (target?.closest("[data-currency-menu]")) return;
            setCurrencyMenuLineId(null);
        };
        document.addEventListener("mousedown", close);
        return () => document.removeEventListener("mousedown", close);
    }, [currencyMenuLineId]);

    useEffect(() => {
        if (!historySortMenu) return;
        const close = (event: MouseEvent) => {
            const target = event.target as HTMLElement | null;
            if (target?.closest("[data-history-sort]")) return;
            setHistorySortMenu(null);
        };
        document.addEventListener("mousedown", close);
        return () => document.removeEventListener("mousedown", close);
    }, [historySortMenu]);

    const historyQuery = lines.find((line) => line.id === historyLineId)?.material.trim() ?? "";
    const historyDismissed = historyQuery.length > 0 && historyDismissedQuery === historyQuery;
    const historyActive = historyQuery.length > 0 && !historyDismissed;
    const historyDesktopOpen = historyActive && historyDesktopLayout && historyPanelLeft != null;
    const historyMobileOpen = historyActive && !historyDesktopOpen;
    const historyDesktopReopen = historyDismissed && historyDesktopLayout;
    const historyHeaderReopen = historyDismissed && !historyDesktopLayout;
    const historyMatches = useMemo(() => {
        const query = compactText(historyQuery);
        if (!query) return [];
        const base = historyItems.filter((item) => compactText(item.materialName).includes(query));
        const sorted = historySort ? [...base].sort((a, b) => compareHistory(a, b, historySort)) : base;
        const filter = compactText(historyFilter);
        if (!filter) return sorted;
        const hits: MaterialPurchaseListItem[] = [];
        const rest: MaterialPurchaseListItem[] = [];
        for (const item of sorted) {
            if (historyItemMatchesFilter(item, filter)) hits.push(item);
            else rest.push(item);
        }
        return [...hits, ...rest];
    }, [historyItems, historyQuery, historySort, historyFilter]);

    useEffect(() => {
        let cancelled = false;
        setHistoryLoading(true);
        setHistoryError("");
        fetchMaterialPurchaseList()
            .then((items) => {
                if (!cancelled) setHistoryItems(items);
            })
            .catch((error) => {
                if (!cancelled) {
                    setHistoryError(error instanceof Error ? error.message : "구매내역을 불러오지 못했습니다.");
                }
            })
            .finally(() => {
                if (!cancelled) setHistoryLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    useLayoutEffect(() => {
        const form = formColumnRef.current;
        if (!form) return;
        const measure = () => {
            const right = form.getBoundingClientRect().right;
            const room = window.innerWidth - right;
            const desktop = window.innerWidth >= 1024;
            setHistoryDesktopLayout(desktop);
            setHistoryPanelLeft(desktop && room >= 160 ? Math.round(right + 16) : null);
            const header = form.parentElement?.previousElementSibling;
            if (header instanceof HTMLElement) {
                setHistoryPanelTop(Math.ceil(header.getBoundingClientRect().bottom));
            }
        };
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(form);
        if (form.parentElement) observer.observe(form.parentElement);
        window.addEventListener("resize", measure);
        return () => {
            observer.disconnect();
            window.removeEventListener("resize", measure);
        };
    }, []);

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
            file,
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

    const applySchedule = (item: SchedulePickItem) => {
        const supervisors = supervisorsFromCustomer(item.customerCompany, item.customerContact);
        setPurchaseKind("work");
        setVessel(item.shipName.trim().toUpperCase());
        setOrderGroup(supervisors.group);
        setOrderPersons(supervisors.persons);
        setSelectedOrderPerson("");
        setOrderPersonCustom("");
        setTripPurpose(item.workItem.replace(/\s+/g, " ").trim());
        setErrors((prev) => ({ ...prev, orderPersons: undefined }));
        setScheduleOpen(false);
    };

    const handleSubmit = async () => {
        if (saving) return;
        const nextErrors: { orderPersons?: string; lines?: string } = {};
        if (purchaseKind === "work" && orderPersons.length === 0) {
            nextErrors.orderPersons = "참관감독을 선택해 주세요.";
        }

        const namedLines = lines.filter(
            (line) =>
                lineName(line) ||
                line.vendor.trim() ||
                line.spec.trim() ||
                line.grade.trim() ||
                line.note.trim() ||
                line.cost.trim() ||
                line.urgent ||
                line.receipts.length > 0
        );
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

        if (
            namedLines.some((line) =>
                isUrgentAmountOverLimit(
                    line.urgent,
                    line.cost.trim() ? parseCurrency(line.cost) : null,
                    line.currency || "원"
                )
            )
        ) {
            showError(URGENT_AMOUNT_LIMIT_MESSAGE);
            return;
        }

        const isWork = purchaseKind === "work";
        setSaving(true);
        try {
            await createMaterialPurchase({
                status: "confirmed",
                kind: purchaseKind,
                vesselName: isWork ? vessel : "",
                orderGroup: isWork ? orderGroup : "",
                orderPersons: isWork ? orderPersons : [],
                tripPurpose: isWork ? tripPurpose : "",
                lines: namedLines.map((line) => ({
                    materialName: lineName(line),
                    vendor: line.vendor,
                    amount: line.cost.trim() ? parseCurrency(line.cost) : null,
                    currency: line.currency || "원",
                    spec: line.spec,
                    grade: line.grade,
                    urgent: line.urgent,
                    note: line.note,
                    receipts: line.receipts.map((receipt) => receipt.file),
                })),
            });
            showSuccess("등록되었습니다.");
        } catch (error) {
            showError(error instanceof Error ? error.message : "등록에 실패했습니다.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="flex min-h-dvh bg-white lg:h-dvh lg:max-h-dvh lg:overflow-hidden">
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-20 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            <div
                className={`
            fixed lg:static inset-y-0 left-0 z-30
            w-[260px] max-w-[88vw] lg:max-w-none lg:w-[239px] h-dvh shrink-0
            transform transition-transform duration-300 ease-in-out
            ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
          `}
            >
                <Sidebar onClose={() => setSidebarOpen(false)} />
            </div>

            <div className="flex w-full min-w-0 flex-1 flex-col lg:min-h-0 lg:overflow-hidden">
                <Header
                    title="등록"
                    onMenuClick={() => setSidebarOpen(true)}
                    rightContent={
                        <div className="flex items-center gap-2 md:gap-3">
                            <Button type="button" variant="outline" size="lg" onClick={() => setScheduleOpen(true)}>
                                일정
                            </Button>
                            <Button type="button" variant="primary" size="lg" onClick={handleSubmit} loading={saving}>
                                등록
                            </Button>
                        </div>
                    }
                    bottomContent={
                        historyHeaderReopen ? (
                            <div className="relative flex h-10 flex-nowrap items-center justify-between gap-2 overflow-visible border-t border-gray-200 bg-white px-3">
                                <p className="min-w-0 flex-1 truncate whitespace-nowrap text-sm font-medium text-gray-800">
                                    과거내역
                                    <span className="ml-1.5 font-normal text-gray-500">{historyQuery}</span>
                                    {!historyLoading && !historyError && (
                                        <span className="ml-1 text-xs font-normal text-gray-400">
                                            {historyMatches.length}건
                                        </span>
                                    )}
                                </p>
                                <div className="flex min-w-0 items-center">
                                    <HistorySearchField
                                        value={historyFilter}
                                        open={historySearchOpen}
                                        onChange={setHistoryFilter}
                                        onOpenChange={setHistorySearchOpen}
                                        heightClassName="h-8"
                                    />
                                    <HistorySortControls
                                        sort={historySort}
                                        menu={historySortMenu}
                                        onToggleMenu={(next) =>
                                            setHistorySortMenu((current) => (current === next ? null : next))
                                        }
                                        onSelect={(next) => {
                                            setHistorySort(next);
                                            setHistorySortMenu(null);
                                        }}
                                        buttonClassName="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setHistoryDismissedQuery(null)}
                                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
                                        aria-label="과거내역 펼치기"
                                    >
                                        <IconPlus className="h-5 w-5" />
                                    </button>
                                </div>
                            </div>
                        ) : historyMobileOpen ? (
                            <div className="border-t border-gray-200 bg-white">
                                <div className="relative flex h-10 flex-nowrap items-center justify-between gap-2 overflow-visible px-3">
                                    <p className="min-w-0 flex-1 truncate whitespace-nowrap text-sm font-medium text-gray-800">
                                        과거내역
                                        <span className="ml-1.5 font-normal text-gray-500">{historyQuery}</span>
                                        {!historyLoading && !historyError && (
                                            <span className="ml-1 text-xs font-normal text-gray-400">
                                                {historyMatches.length}건
                                            </span>
                                        )}
                                    </p>
                                    <div className="flex min-w-0 items-center">
                                        <HistorySearchField
                                            value={historyFilter}
                                            open={historySearchOpen}
                                            onChange={setHistoryFilter}
                                            onOpenChange={setHistorySearchOpen}
                                            heightClassName="h-8"
                                        />
                                        <HistorySortControls
                                            sort={historySort}
                                            menu={historySortMenu}
                                            onToggleMenu={(next) =>
                                                setHistorySortMenu((current) => (current === next ? null : next))
                                            }
                                            onSelect={(next) => {
                                                setHistorySort(next);
                                                setHistorySortMenu(null);
                                            }}
                                            buttonClassName="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setHistoryDismissedQuery(historyQuery)}
                                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
                                            aria-label="과거내역 닫기"
                                        >
                                            <IconClose className="h-5 w-5" />
                                        </button>
                                    </div>
                                </div>
                                <div className="max-h-[156px] overflow-y-auto border-t border-gray-100">
                                        {historyLoading ? (
                                            <p className="px-3 py-3 text-xs text-gray-500">불러오는 중...</p>
                                        ) : historyError ? (
                                            <p className="px-3 py-3 text-xs text-red-500">{historyError}</p>
                                        ) : historyMatches.length === 0 ? (
                                            <p className="px-3 py-3 text-xs text-gray-500">일치하는 구매내역이 없습니다.</p>
                                        ) : (
                                            <ul>
                                                {historyMatches.map((item) => (
                                                    <li key={item.id} className="flex h-[52px] items-center gap-2 border-b border-gray-100 px-3 last:border-b-0">
                                                        <div className="min-w-0 flex-1">
                                                        <div className="flex items-baseline justify-between gap-2">
                                                            <p className="min-w-0 truncate text-[13px] font-medium text-gray-900">
                                                                {item.urgent && (
                                                                    <span className="mr-1 text-[11px] font-medium text-red-500">긴급</span>
                                                                )}
                                                                {highlightText(item.materialName, historyFilter)}
                                                            </p>
                                                            <span className="shrink-0 text-[12px] text-gray-800">
                                                                {item.amountLabel
                                                                    ? highlightText(item.amountLabel, historyFilter)
                                                                    : "-"}
                                                            </span>
                                                        </div>
                                                        <p className="truncate text-[11px] leading-4 text-gray-500">
                                                            {[item.vendor, item.createdAtLabel, item.vessel, item.author].filter(
                                                                Boolean
                                                            ).length > 0
                                                                ? [item.vendor, item.createdAtLabel, item.vessel, item.author]
                                                                      .filter(Boolean)
                                                                      .map((part, index, parts) => (
                                                                          <span key={`${item.id}-${index}`}>
                                                                              {highlightText(part, historyFilter)}
                                                                              {index < parts.length - 1 ? " · " : ""}
                                                                          </span>
                                                                      ))
                                                                : "—"}
                                                        </p>
                                                        </div>
                                                        {item.receipts.length > 0 && (
                                                            <button
                                                                type="button"
                                                                onClick={() => setHistoryPreview({ receipts: item.receipts, index: 0 })}
                                                                className="flex h-8 w-8 shrink-0 items-center justify-center text-gray-500"
                                                                aria-label="영수증 보기"
                                                            >
                                                                <IconImage className="h-5 w-5" />
                                                            </button>
                                                        )}
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                            </div>
                        ) : null
                    }
                />
                <div
                    data-purchase-form-scroll="true"
                    className="px-4 sm:px-6 md:px-12 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-y-contain lg:[overflow-anchor:none] lg:px-24 xl:px-48 py-6 md:py-9"
                >
                    <div ref={formColumnRef} className="max-w-[960px] mx-auto flex flex-col gap-4 md:gap-6">
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
                                                ? "border-2! border-green-600! bg-green-500! text-white! hover:bg-green-600!"
                                                : "border-2! border-transparent! bg-green-100! text-green-800! hover:bg-green-200!"
                                        }
                                        onClick={() => setPurchaseKind("work")}
                                    >
                                        작업 자재
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
                                        기타
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
                                    uppercase
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
                                        className={`rounded-2xl p-3 md:p-4 flex flex-col gap-3 ${
                                            row.urgent ? "bg-red-50" : "bg-gray-100"
                                        }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <Input
                                                value={row.material}
                                                placeholder="자재명"
                                                onFocus={() => setHistoryLineId(row.id)}
                                                onChange={(value) => {
                                                    updateLine(row.id, { material: value });
                                                    setHistoryLineId(row.id);
                                                    const nextQuery = value.trim();
                                                    setHistoryDismissedQuery((current) =>
                                                        current != null && current !== nextQuery ? null : current
                                                    );
                                                }}
                                                className="flex-1 min-w-0"
                                                inputClassName="border-transparent! bg-white focus:border-blue-500!"
                                            />
                                            <button
                                                type="button"
                                                aria-pressed={row.urgent}
                                                onClick={() => {
                                                    const nextUrgent = !row.urgent;
                                                    updateLine(row.id, { urgent: nextUrgent });
                                                    if (nextUrgent) {
                                                        showInfo("30만 원 미만이면 승인 없이 구매를 진행할 수 있습니다.");
                                                    }
                                                }}
                                                className={`h-12 shrink-0 whitespace-nowrap rounded-xl border px-3 text-sm font-medium ${
                                                    row.urgent
                                                        ? "border-red-500 bg-red-500 text-white"
                                                        : "border-gray-200 bg-white text-gray-500"
                                                }`}
                                            >
                                                긴급
                                            </button>
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
                                                    비용
                                                </label>
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
                                                                onClick={() =>
                                                                    setCurrencyMenuLineId((current) =>
                                                                        current === row.id ? null : row.id
                                                                    )
                                                                }
                                                            >
                                                                {CURRENCY_MARK[row.currency] ?? row.currency}
                                                            </button>
                                                        }
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
                                                    {currencyMenuLineId === row.id && (
                                                        <div
                                                            data-currency-menu="true"
                                                            className="absolute right-0 top-full z-30 mt-1 min-w-[7.5rem] overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-lg"
                                                        >
                                                            {EXPENSE_CURRENCY_OPTIONS.map(
                                                                (option) => (
                                                                    <button
                                                                        key={option.value}
                                                                        type="button"
                                                                        className={`block w-full px-3 py-2 text-left text-sm hover:bg-gray-50 ${
                                                                            row.currency === option.value
                                                                                ? "font-semibold text-gray-900"
                                                                                : "text-gray-700"
                                                                        }`}
                                                                        onMouseDown={(event) => event.preventDefault()}
                                                                        onClick={() => {
                                                                            updateLine(row.id, { currency: option.value });
                                                                            setCurrencyMenuLineId(null);
                                                                        }}
                                                                    >
                                                                        {`${CURRENCY_MARK[option.value] ?? ""} ${option.label}`}
                                                                    </button>
                                                                )
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <Input
                                                label="규격"
                                                value={row.spec}
                                                placeholder="규격"
                                                onChange={(value) => updateLine(row.id, { spec: value })}
                                                inputClassName="border-transparent! bg-white focus:border-blue-500!"
                                            />
                                            <Input
                                                label="재질/Grade"
                                                value={row.grade}
                                                placeholder="재질/Grade"
                                                onChange={(value) => updateLine(row.id, { grade: value })}
                                                inputClassName="border-transparent! bg-white focus:border-blue-500!"
                                            />
                                        </div>
                                        <Input
                                            label="비고"
                                            value={row.note}
                                            placeholder="용도, 특이사항 등"
                                            onChange={(value) => updateLine(row.id, { note: value })}
                                            inputClassName="border-transparent! bg-white focus:border-blue-500!"
                                        />
                                        <div className="flex flex-col gap-2">
                                                <span className="block text-sm font-medium text-gray-700">영수증</span>
                                                <label
                                                    className="relative flex h-12 cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-xl bg-white px-4 text-sm text-gray-500"
                                                    onMouseDown={(event) => {
                                                        const scroller = event.currentTarget.closest(
                                                            "[data-purchase-form-scroll='true']"
                                                        );
                                                        if (!(scroller instanceof HTMLElement)) return;
                                                        const top = scroller.scrollTop;
                                                        const restore = () => {
                                                            scroller.scrollTop = top;
                                                        };
                                                        requestAnimationFrame(restore);
                                                        window.setTimeout(restore, 0);
                                                        window.addEventListener("focus", restore, { once: true });
                                                    }}
                                                >
                                                    <IconUpload />
                                                    영수증 첨부
                                                    <input
                                                        type="file"
                                                        accept="image/*,.pdf"
                                                        multiple
                                                        className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
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
            {historyDesktopReopen &&
                createPortal(
                    <button
                        type="button"
                        onClick={() => setHistoryDismissedQuery(null)}
                        className="fixed z-30 flex h-10 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-sm font-medium text-gray-800 shadow-sm hover:bg-gray-50"
                        style={{ top: historyPanelTop + 16, right: 24 }}
                        aria-label="과거내역 펼치기"
                    >
                        <span className="truncate">과거내역</span>
                        <span className="text-xl leading-none text-gray-700">+</span>
                    </button>,
                    document.body
                )}
            {historyDesktopOpen &&
                createPortal(
                    <aside
                        className="fixed bottom-0 right-0 z-20 flex min-w-0 flex-col border-l border-gray-200 bg-gray-100"
                        style={{ top: historyPanelTop, left: historyPanelLeft ?? undefined }}
                    >
                        <div className="relative flex shrink-0 flex-nowrap items-center justify-between overflow-visible border-b border-gray-200 bg-white px-4 py-3">
                            <div className="min-w-0">
                                <h2 className="text-base font-bold text-gray-900">과거내역</h2>
                                <p className="truncate text-xs text-gray-500">{historyQuery}</p>
                            </div>
                            <div className="flex min-w-0 items-center">
                                <HistorySearchField
                                    value={historyFilter}
                                    open={historySearchOpen}
                                    onChange={setHistoryFilter}
                                    onOpenChange={setHistorySearchOpen}
                                    heightClassName="h-9"
                                />
                                <HistorySortControls
                                    sort={historySort}
                                    menu={historySortMenu}
                                    onToggleMenu={(next) =>
                                        setHistorySortMenu((current) => (current === next ? null : next))
                                    }
                                    onSelect={(next) => {
                                        setHistorySort(next);
                                        setHistorySortMenu(null);
                                    }}
                                    buttonClassName="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
                                />
                                <button
                                    type="button"
                                    onClick={() => setHistoryDismissedQuery(historyQuery)}
                                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
                                    aria-label="과거내역 닫기"
                                >
                                    <IconClose className="h-5 w-5" />
                                </button>
                            </div>
                        </div>
                        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                            {historyLoading ? (
                                <p className="py-8 text-center text-sm text-gray-500">불러오는 중...</p>
                            ) : historyError ? (
                                <p className="py-8 text-center text-sm text-red-500">{historyError}</p>
                            ) : historyMatches.length === 0 ? (
                                <p className="py-8 text-center text-sm text-gray-500">일치하는 구매내역이 없습니다.</p>
                            ) : (
                                <ul className="flex flex-col gap-2">
                                    {historyMatches.map((item) => (
                                        <li
                                            key={item.id}
                                            className={`flex items-stretch gap-3 rounded-xl border px-3 py-3 ${
                                                item.urgent ? "border-red-200 bg-red-50" : "border-gray-200 bg-white"
                                            }`}
                                        >
                                            <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-1.5">
                                                {item.urgent && (
                                                    <Chip color="red-500" variant="outline" size="sm" className="shrink-0">
                                                        긴급
                                                    </Chip>
                                                )}
                                                <p className="min-w-0 break-words text-sm font-medium text-gray-900">
                                                    {highlightText(item.materialName, historyFilter)}
                                                </p>
                                            </div>
                                            <p className="mt-1 break-words text-xs text-gray-600">
                                                {[item.vendor, item.amountLabel].filter(Boolean).length > 0
                                                    ? [item.vendor, item.amountLabel]
                                                          .filter(Boolean)
                                                          .map((part, index, parts) => (
                                                              <span key={`${item.id}-meta-${index}`}>
                                                                  {highlightText(part, historyFilter)}
                                                                  {index < parts.length - 1 ? " · " : ""}
                                                              </span>
                                                          ))
                                                    : "구매처 없음"}
                                            </p>
                                            <p className="mt-1 text-xs leading-4 text-gray-400">
                                                {item.createdAtLabel && (
                                                    <span className="whitespace-nowrap">
                                                        {highlightText(item.createdAtLabel, historyFilter)}
                                                    </span>
                                                )}
                                                {item.createdAtLabel && item.vessel && " · "}
                                                {item.vessel && <span>{highlightText(item.vessel, historyFilter)}</span>}
                                                {item.author && (
                                                    <span className="inline-block whitespace-nowrap">
                                                        {item.createdAtLabel || item.vessel ? " · " : ""}
                                                        {highlightText(item.author, historyFilter)}
                                                    </span>
                                                )}
                                            </p>
                                            </div>
                                            {item.receipts[0] && (
                                                <button
                                                    type="button"
                                                    onClick={() => setHistoryPreview({ receipts: item.receipts, index: 0 })}
                                                    className="h-16 w-16 shrink-0 self-center overflow-hidden rounded-lg border border-gray-200 bg-white"
                                                    aria-label="영수증 보기"
                                                >
                                                    {item.receipts[0].contentType.startsWith("image/") ? (
                                                        <img
                                                            src={item.receipts[0].url}
                                                            alt=""
                                                            className="h-full w-full object-cover"
                                                        />
                                                    ) : (
                                                        <span className="flex h-full w-full items-center justify-center text-[11px] font-medium text-gray-500">
                                                            PDF
                                                        </span>
                                                    )}
                                                </button>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </aside>,
                    document.body
                )}
            <SchedulePickModal
                isOpen={scheduleOpen}
                onClose={() => setScheduleOpen(false)}
                onSelect={applySchedule}
            />
            <ImagePreviewModal
                isOpen={historyPreview != null}
                onClose={() => setHistoryPreview(null)}
                imageSrc={historyPreview?.receipts[historyPreview.index]?.url ?? null}
                fileName={historyPreview?.receipts[historyPreview.index]?.fileName}
                fileType={historyPreview?.receipts[historyPreview.index]?.contentType}
                images={historyPreview?.receipts.map((receipt) => ({
                    src: receipt.url,
                    fileName: receipt.fileName,
                }))}
                currentIndex={historyPreview?.index ?? 0}
                onPrev={() =>
                    setHistoryPreview((current) =>
                        current
                            ? {
                                  ...current,
                                  index: (current.index - 1 + current.receipts.length) % current.receipts.length,
                              }
                            : current
                    )
                }
                onNext={() =>
                    setHistoryPreview((current) =>
                        current
                            ? { ...current, index: (current.index + 1) % current.receipts.length }
                            : current
                    )
                }
                zIndex={10050}
            />
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
