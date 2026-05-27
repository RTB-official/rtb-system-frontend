import { useEffect, useMemo, useState } from "react";
import BaseModal from "../ui/BaseModal";
import Input from "../common/Input";
import YearMonthSelector from "../common/YearMonthSelector";
import Avatar from "../common/Avatar";
import Chip from "../ui/Chip";
import {
    loadInvoiceReportListItems,
    type InvoiceReportListItem,
} from "../../lib/invoiceReportListItems";

const STATUS_LABEL: Record<
    InvoiceReportListItem["status"],
    { color: string; label: string }
> = {
    submitted: { color: "blue-500", label: "제출 완료" },
    pending: { color: "green-600", label: "임시저장" },
};

function MiniReportCard({
    item,
    action,
    onAction,
    highlight,
}: {
    item: InvoiceReportListItem;
    action: "add" | "remove";
    onAction: () => void;
    highlight?: boolean;
}) {
    const status = STATUS_LABEL[item.status];

    return (
        <div
            className={[
                "flex items-start gap-2 rounded-lg border px-3 py-2 transition-colors",
                highlight
                    ? "border-blue-400 bg-blue-50/70"
                    : "border-gray-200 bg-white",
            ].join(" ")}
        >
            <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-gray-900 line-clamp-2">
                    {item.title || "—"}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">
                    <span>{item.date}</span>
                    {item.place?.trim() ? (
                        <>
                            <span aria-hidden>·</span>
                            <span className="truncate max-w-[8rem]">
                                {item.place}
                            </span>
                        </>
                    ) : null}
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <Avatar
                        email={item.ownerEmail}
                        position={item.ownerPosition}
                        size={18}
                    />
                    <span className="text-xs text-gray-600">{item.owner}</span>
                    <Chip color={status.color} variant="solid" size="sm">
                        {status.label}
                    </Chip>
                </div>
            </div>
            <button
                type="button"
                onClick={onAction}
                className={[
                    "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-bold transition-colors",
                    action === "add"
                        ? "border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                        : "border-gray-200 bg-white text-gray-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600",
                ].join(" ")}
                aria-label={action === "add" ? "선택에 추가" : "선택에서 제거"}
                title={action === "add" ? "추가" : "제거"}
            >
                {action === "add" ? "+" : "×"}
            </button>
        </div>
    );
}

export default function InvoiceReportsPickerModal({
    isOpen,
    onClose,
    initialSelectedIds,
    onApply,
}: {
    isOpen: boolean;
    onClose: () => void;
    initialSelectedIds: number[];
    onApply: (selectedIds: number[]) => void;
}) {
    const [loading, setLoading] = useState(false);
    const [reports, setReports] = useState<InvoiceReportListItem[]>([]);
    const [search, setSearch] = useState("");
    const [year, setYear] = useState("년도 전체");
    const [month, setMonth] = useState("월 전체");
    const [selectedIds, setSelectedIds] = useState<number[]>(initialSelectedIds);

    useEffect(() => {
        if (!isOpen) {
            return;
        }
        setSelectedIds(initialSelectedIds);
        setSearch("");
        setYear("년도 전체");
        setMonth("월 전체");

        let cancelled = false;
        setLoading(true);
        void loadInvoiceReportListItems()
            .then((items) => {
                if (!cancelled) {
                    setReports(items);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setReports([]);
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [isOpen, initialSelectedIds]);

    const filteredAll = useMemo(() => {
        const q = search.trim().toLowerCase();
        return reports.filter((r) => {
            const matchSearch =
                q === "" ||
                r.title.toLowerCase().includes(q) ||
                r.owner.toLowerCase().includes(q) ||
                r.place.toLowerCase().includes(q);
            if (!matchSearch) {
                return false;
            }
            if (year !== "년도 전체") {
                const y = Number(year.replace("년", ""));
                if (new Date(r.createdAt).getFullYear() !== y) {
                    return false;
                }
            }
            if (month !== "월 전체") {
                const m = Number(month.replace("월", ""));
                if (new Date(r.createdAt).getMonth() + 1 !== m) {
                    return false;
                }
            }
            return true;
        });
    }, [reports, search, year, month]);

    const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);

    const availableReports = useMemo(
        () => filteredAll.filter((r) => !selectedIdSet.has(r.id)),
        [filteredAll, selectedIdSet]
    );

    const selectedReports = useMemo(() => {
        const byId = new Map(reports.map((r) => [r.id, r] as const));
        return selectedIds
            .map((id) => byId.get(id))
            .filter((r): r is InvoiceReportListItem => Boolean(r));
    }, [reports, selectedIds]);

    const addReport = (id: number) => {
        setSelectedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    };

    const removeReport = (id: number) => {
        setSelectedIds((prev) => prev.filter((x) => x !== id));
    };

    return (
        <BaseModal
            isOpen={isOpen}
            onClose={onClose}
            title="보고서 선택"
            maxWidth="max-w-5xl"
            footer={
                <>
                    <button
                        type="button"
                        className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-50"
                        onClick={onClose}
                    >
                        취소
                    </button>
                    <button
                        type="button"
                        className="rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:pointer-events-none disabled:opacity-50"
                        disabled={selectedIds.length === 0}
                        onClick={() => onApply(selectedIds)}
                    >
                        적용 ({selectedIds.length}건)
                    </button>
                </>
            }
        >
            <div className="mb-4 flex flex-wrap items-center gap-2">
                <Input
                    value={search}
                    onChange={setSearch}
                    placeholder="보고서 검색"
                    icon={
                        <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                        >
                            <circle cx="11" cy="11" r="7" />
                            <line x1="16.65" y1="16.65" x2="21" y2="21" />
                        </svg>
                    }
                    iconPosition="left"
                    className="min-w-[200px] flex-1"
                />
                <YearMonthSelector
                    year={year}
                    month={month}
                    onYearChange={setYear}
                    onMonthChange={setMonth}
                    yearOptions={[
                        { value: "년도 전체", label: "년도 전체" },
                        { value: "2025년", label: "2025년" },
                        { value: "2026년", label: "2026년" },
                    ]}
                    monthOptions={[
                        { value: "월 전체", label: "월 전체" },
                        { value: "1월", label: "1월" },
                        { value: "2월", label: "2월" },
                        { value: "3월", label: "3월" },
                        { value: "4월", label: "4월" },
                        { value: "5월", label: "5월" },
                        { value: "6월", label: "6월" },
                        { value: "7월", label: "7월" },
                        { value: "8월", label: "8월" },
                        { value: "9월", label: "9월" },
                        { value: "10월", label: "10월" },
                        { value: "11월", label: "11월" },
                        { value: "12월", label: "12월" },
                    ]}
                />
            </div>

            <div className="flex min-h-0 flex-col gap-4 md:h-[min(58vh,480px)] md:flex-row md:gap-0">
                <div className="flex min-h-0 min-w-0 flex-1 flex-col md:w-1/2 md:max-w-[50%] md:pr-4">
                    <h4 className="mb-2 shrink-0 text-xs font-semibold uppercase tracking-wide text-gray-600">
                        보고서 목록 ({availableReports.length})
                    </h4>
                    <div
                        className={[
                            "min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain rounded-lg border border-gray-200 bg-gray-50 p-3",
                            "max-h-[42vh] md:max-h-full",
                            "[scrollbar-gutter:stable]",
                        ].join(" ")}
                    >
                        {loading ? (
                            <p className="py-6 text-center text-sm text-gray-500">
                                불러오는 중…
                            </p>
                        ) : availableReports.length === 0 ? (
                            <p className="py-6 text-center text-sm text-gray-500">
                                {filteredAll.length === 0
                                    ? "조회된 보고서가 없습니다."
                                    : "추가할 보고서가 없습니다."}
                            </p>
                        ) : (
                            availableReports.map((item) => (
                                <MiniReportCard
                                    key={item.id}
                                    item={item}
                                    action="add"
                                    onAction={() => addReport(item.id)}
                                />
                            ))
                        )}
                    </div>
                </div>

                <div className="flex min-h-0 min-w-0 flex-1 flex-col border-t border-gray-200 pt-4 md:w-1/2 md:max-w-[50%] md:border-t-0 md:border-l md:pt-0 md:pl-4">
                    <h4 className="mb-2 shrink-0 text-xs font-semibold uppercase tracking-wide text-gray-600">
                        인보이스에 포함 ({selectedReports.length})
                    </h4>
                    <div
                        className={[
                            "min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain rounded-lg border border-blue-100 bg-blue-50/30 p-3",
                            "max-h-[42vh] md:max-h-full",
                            "[scrollbar-gutter:stable]",
                        ].join(" ")}
                    >
                        {selectedReports.length === 0 ? (
                            <p className="py-6 text-center text-sm text-gray-500">
                                좌측 목록에서 보고서를 추가해 주세요.
                            </p>
                        ) : (
                            selectedReports.map((item) => (
                                <MiniReportCard
                                    key={item.id}
                                    item={item}
                                    action="remove"
                                    onAction={() => removeReport(item.id)}
                                    highlight
                                />
                            ))
                        )}
                    </div>
                </div>
            </div>
        </BaseModal>
    );
}
