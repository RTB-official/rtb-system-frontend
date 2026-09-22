// src/pages/Schedule/ScheduleCreatePage.tsx
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/common/Header";
import PageContainer from "../../components/common/PageContainer";
import { IconPlus, IconSave, IconTrash } from "../../components/icons/Icons";
import { useToast } from "../../components/ui/ToastProvider";
import {
    SCHEDULE_CELL_BORDER,
    SCHEDULE_COLUMNS,
    SCHEDULE_LABEL_BG,
    SCHEDULE_TITLE_BG,
    type ScheduleFieldKey,
    type ScheduleSheetRow,
} from "../../components/schedule/scheduleTableShared";
import { fetchNextScheduleVersion, saveScheduleVersion } from "../../lib/scheduleApi";
import { parseScheduleExcelFile } from "../../utils/parseScheduleExcel";

const COPY = {
    pageTitle: "\uC77C\uC815 \uB4F1\uB85D",
    save: "\uC800\uC7A5",
    excelImport: "\uC5D1\uC140 \uBD88\uB7EC\uC624\uAE30",
    addRow: "\uD589 \uCD94\uAC00",
    deleteRow: "\uD589 \uC0AD\uC81C",
    excelLoaded: (n: number) =>
        `\uC5D1\uC140\uC5D0\uC11C ${n}\uAC74\uC744 \uBD88\uB7EC\uC654\uC2B5\uB2C8\uB2E4.`,
    excelLoadFailed: "\uC5D1\uC140 \uBD88\uB7EC\uC624\uAE30\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.",
    saveSuccess: (key: string, n: number) =>
        `${key}\uC5D0 ${n}\uAC74\uC744 \uC800\uC7A5\uD588\uC2B5\uB2C8\uB2E4.`,
    saveFailed: "\uC77C\uC815 \uC800\uC7A5\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.",
} as const;


export type ScheduleRow = ScheduleSheetRow;

/** Column widths (sum 100%) — shared with list page */
const COLUMNS = SCHEDULE_COLUMNS;

type FieldKey = ScheduleFieldKey;

/** Editable column order (left → right), excluding No. */
const EDITABLE_FIELDS: FieldKey[] = [
    "customerCompany",
    "customerContact",
    "shipName",
    "engineType",
    "workLocation",
    "period",
    "workItem",
    "manpower",
    "teamMember",
    "car",
    "yardPic",
    "remark",
];

function createEmptyRow(): ScheduleRow {
    return {
        id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        customerCompany: "",
        customerContact: "",
        shipName: "",
        engineType: "",
        workLocation: "",
        period: "",
        workItem: "",
        manpower: "",
        teamMember: "",
        car: "",
        yardPic: "",
        remark: "",
    };
}

const TITLE_BG = SCHEDULE_TITLE_BG;
const LABEL_BG = SCHEDULE_LABEL_BG;
const CELL_BORDER = SCHEDULE_CELL_BORDER;

/** Latin lowercase → uppercase; numbers and special characters are kept as entered. */
function normalizeUppercaseField(value: string): string {
    return value.toUpperCase();
}

function shouldMoveFromCell(
    e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
    multiline: boolean
): boolean {
    const el = e.currentTarget;
    const pos = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    if (pos !== end) return false;
    const value = el.value;

    if (multiline && el instanceof HTMLTextAreaElement) {
        if (e.key === "ArrowUp") return !value.slice(0, pos).includes("\n");
        if (e.key === "ArrowDown") return !value.slice(pos).includes("\n");
        if (e.key === "ArrowLeft") return pos === 0 || value.charAt(pos - 1) === "\n";
        if (e.key === "ArrowRight") {
            return pos === value.length || value.charAt(pos) === "\n";
        }
        return false;
    }

    if (e.key === "ArrowUp" || e.key === "ArrowDown") return true;
    if (e.key === "ArrowLeft") return pos === 0;
    if (e.key === "ArrowRight") return pos === value.length;
    return false;
}

function CellInput({
    value,
    onChange,
    multiline,
    uppercaseLettersOnly,
    focusKey,
    onArrowNavigate,
}: {
    value: string;
    onChange: (v: string) => void;
    multiline?: boolean;
    uppercaseLettersOnly?: boolean;
    focusKey: string;
    onArrowNavigate: (
        e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
        direction: "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight"
    ) => void;
}) {
    const applyChange = (raw: string) => {
        onChange(uppercaseLettersOnly ? normalizeUppercaseField(raw) : raw);
    };
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fieldClass =
        "w-full bg-transparent text-[11px] md:text-[12px] text-gray-900 text-center outline-none resize-none leading-snug";

    useLayoutEffect(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = "auto";
        el.style.height = `${el.scrollHeight}px`;
    }, [value]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        if (
            e.key !== "ArrowUp" &&
            e.key !== "ArrowDown" &&
            e.key !== "ArrowLeft" &&
            e.key !== "ArrowRight"
        ) {
            return;
        }
        if (!shouldMoveFromCell(e, multiline === true)) return;
        e.preventDefault();
        onArrowNavigate(e, e.key);
    };

    return (
        <div className="flex min-h-[72px] w-full items-center justify-center px-1 py-1">
            {multiline ? (
                <textarea
                    ref={textareaRef}
                    data-schedule-focus={focusKey}
                    value={value}
                    onChange={(e) => applyChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={1}
                    spellCheck={false}
                    className={`${fieldClass} overflow-hidden whitespace-pre-wrap break-words`}
                />
            ) : (
                <input
                    type="text"
                    data-schedule-focus={focusKey}
                    value={value}
                    onChange={(e) => applyChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    spellCheck={false}
                    className={fieldClass}
                />
            )}
        </div>
    );
}

export default function ScheduleCreatePage() {
    const { showSuccess, showError } = useToast();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [rows, setRows] = useState<ScheduleRow[]>(() =>
        Array.from({ length: 3 }, () => createEmptyRow())
    );
    const [excelImporting, setExcelImporting] = useState(false);
    const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
    const [trashOffsetTop, setTrashOffsetTop] = useState<number | null>(null);
    const [versionKey, setVersionKey] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const excelFileInputRef = useRef<HTMLInputElement>(null);
    const tableAreaRef = useRef<HTMLDivElement>(null);

    const refreshVersionKey = async () => {
        const next = await fetchNextScheduleVersion();
        setVersionKey(next.versionKey);
        return next;
    };

    useEffect(() => {
        let cancelled = false;
        void (async () => {
            try {
                const next = await fetchNextScheduleVersion();
                if (!cancelled) setVersionKey(next.versionKey);
            } catch (err) {
                console.error(err);
                if (!cancelled) {
                    setVersionKey(null);
                    showError("일정 버전 정보를 불러오지 못했습니다.");
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [showError]);

    const handleSave = async () => {
        if (saving) return;
        setSaving(true);
        try {
            const saved = await saveScheduleVersion({ rows });
            showSuccess(COPY.saveSuccess(saved.versionKey, saved.rowCount));
            await refreshVersionKey();
        } catch (err) {
            console.error(err);
            showError(err instanceof Error ? err.message : COPY.saveFailed);
            try {
                await refreshVersionKey();
            } catch {
                /* ignore refresh error after save failure */
            }
        } finally {
            setSaving(false);
        }
    };

    const updateCell = (id: string, key: FieldKey, value: string) => {
        setRows((prev) => prev.map((row) => (row.id === id ? { ...row, [key]: value } : row)));
    };

    const focusScheduleCell = (rowIndex: number, fieldKey: FieldKey) => {
        const row = rows[rowIndex];
        if (!row || !tableAreaRef.current) return;
        const focusKey = `${row.id}__${fieldKey}`;
        const el = tableAreaRef.current.querySelector<HTMLInputElement | HTMLTextAreaElement>(
            `[data-schedule-focus="${CSS.escape(focusKey)}"]`
        );
        if (!el) return;
        el.focus();
        const len = el.value.length;
        el.setSelectionRange(len, len);
        el.scrollIntoView({ block: "nearest", inline: "nearest" });
    };

    const handleArrowNavigate = (
        rowIndex: number,
        fieldKey: FieldKey,
        direction: "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight"
    ) => {
        const fieldIndex = EDITABLE_FIELDS.indexOf(fieldKey);
        if (fieldIndex < 0) return;

        let nextRow = rowIndex;
        let nextFieldIndex = fieldIndex;

        if (direction === "ArrowUp") nextRow -= 1;
        else if (direction === "ArrowDown") nextRow += 1;
        else if (direction === "ArrowLeft") nextFieldIndex -= 1;
        else if (direction === "ArrowRight") nextFieldIndex += 1;

        if (nextFieldIndex < 0 || nextFieldIndex >= EDITABLE_FIELDS.length) return;
        if (nextRow < 0 || nextRow >= rows.length) return;

        focusScheduleCell(nextRow, EDITABLE_FIELDS[nextFieldIndex]!);
    };

    const addRow = () => {
        setRows((prev) => [...prev, createEmptyRow()]);
    };

    const deleteRow = (id: string) => {
        setRows((prev) => prev.filter((row) => row.id !== id));
        setSelectedRowId((prev) => (prev === id ? null : prev));
    };

    const updateTrashPosition = () => {
        if (!selectedRowId || !tableAreaRef.current) {
            setTrashOffsetTop(null);
            return;
        }
        const rowEl = tableAreaRef.current.querySelector(
            `[data-schedule-row-id="${CSS.escape(selectedRowId)}"]`
        ) as HTMLElement | null;
        if (!rowEl) {
            setTrashOffsetTop(null);
            return;
        }
        const areaRect = tableAreaRef.current.getBoundingClientRect();
        const rowRect = rowEl.getBoundingClientRect();
        setTrashOffsetTop(rowRect.top - areaRect.top + rowRect.height / 2);
    };

    useLayoutEffect(() => {
        updateTrashPosition();
    }, [selectedRowId, rows]);

    useEffect(() => {
        if (!selectedRowId) return;

        const handlePointerDown = (e: PointerEvent) => {
            const target = e.target as HTMLElement | null;
            if (!target) return;
            const inSelectedRow = target.closest(
                `[data-schedule-row-id="${CSS.escape(selectedRowId)}"]`
            );
            const inTrash = target.closest("[data-schedule-row-trash]");
            if (!inSelectedRow && !inTrash) {
                setSelectedRowId(null);
            }
        };

        const handleReposition = () => updateTrashPosition();
        const scrollRoot = tableAreaRef.current?.closest(".overflow-auto");

        document.addEventListener("pointerdown", handlePointerDown);
        scrollRoot?.addEventListener("scroll", handleReposition, { passive: true });
        window.addEventListener("resize", handleReposition);

        return () => {
            document.removeEventListener("pointerdown", handlePointerDown);
            scrollRoot?.removeEventListener("scroll", handleReposition);
            window.removeEventListener("resize", handleReposition);
        };
    }, [selectedRowId, rows]);

    const handleExcelImportClick = () => {
        if (excelImporting) return;
        excelFileInputRef.current?.click();
    };

    const handleExcelFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;

        setExcelImporting(true);
        try {
            const parsed = await parseScheduleExcelFile(file);
            setRows(parsed);
            setSelectedRowId(null);
            showSuccess(COPY.excelLoaded(parsed.length));
        } catch (err) {
            console.error(err);
            showError(err instanceof Error ? err.message : COPY.excelLoadFailed);
        } finally {
            setExcelImporting(false);
        }
    };

    return (
        <div className="flex h-screen bg-gray-50 overflow-hidden">
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-20 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}
            <div
                className={`fixed lg:static inset-y-0 left-0 z-30 w-[260px] max-w-[88vw] lg:max-w-none lg:w-[239px] h-screen shrink-0 transform transition-transform duration-300 ease-in-out ${
                    sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
                }`}
            >
                <Sidebar onClose={() => setSidebarOpen(false)} />
            </div>

            <div className="flex-1 flex flex-col h-screen overflow-hidden w-full">
                <Header
                    title={COPY.pageTitle}
                    onMenuClick={() => setSidebarOpen(true)}
                    rightContent={
                        <div className="flex items-center gap-1.5 md:gap-2">
                            <button
                                type="button"
                                onClick={() => void handleSave()}
                                disabled={saving}
                                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 transition-colors hover:bg-gray-100 disabled:pointer-events-none disabled:opacity-50"
                                title={COPY.save}
                                aria-label={COPY.save}
                                aria-busy={saving}
                            >
                                {saving ? (
                                    <span className="text-sm font-bold">…</span>
                                ) : (
                                    <IconSave />
                                )}
                            </button>
                            <input
                                ref={excelFileInputRef}
                                type="file"
                                accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                                className="hidden"
                                onChange={handleExcelFileChange}
                            />
                            <button
                                type="button"
                                onClick={handleExcelImportClick}
                                disabled={excelImporting}
                                className="h-12 min-w-[3rem] shrink-0 rounded-full border border-gray-200 bg-white px-2.5 text-xs font-bold tracking-tight text-gray-700 transition-colors hover:bg-gray-100 disabled:pointer-events-none disabled:opacity-50"
                                aria-busy={excelImporting}
                                aria-label={COPY.excelImport}
                                title={COPY.excelImport}
                            >
                                {excelImporting ? "..." : "EXL"}
                            </button>
                        </div>
                    }
                />

                <div className="flex-1 overflow-auto pt-4 pb-24">
                    <PageContainer className="pt-2 flex flex-col gap-4">
                        <div className="text-sm md:text-base font-semibold tracking-tight text-gray-900">
                            {versionKey ?? "…"}
                        </div>
                        <div ref={tableAreaRef} className="relative w-full">
                            {selectedRowId && trashOffsetTop != null && (
                                <button
                                    type="button"
                                    data-schedule-row-trash=""
                                    className="absolute left-0 z-10 inline-flex h-8 w-8 -translate-x-[calc(100%+4px)] -translate-y-1/2 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-200 hover:text-red-600"
                                    style={{ top: trashOffsetTop }}
                                    aria-label={COPY.deleteRow}
                                    title={COPY.deleteRow}
                                    onClick={() => deleteRow(selectedRowId)}
                                >
                                    <IconTrash className="h-5 w-5" />
                                </button>
                            )}
                            <div className="w-full overflow-x-auto rounded-sm bg-white shadow-sm">
                            <table className="w-full border-collapse min-w-[1280px] table-fixed">
                                <colgroup>
                                    {COLUMNS.map((col) => (
                                        <col key={col.key} style={{ width: col.width }} />
                                    ))}
                                </colgroup>
                                <thead>
                                    <tr>
                                        <th
                                            colSpan={COLUMNS.length}
                                            className={`${CELL_BORDER} py-2.5 px-2 text-center text-[14px] md:text-[15px] font-bold text-gray-900`}
                                            style={{ backgroundColor: TITLE_BG }}
                                        >
                                            Confirmed service work
                                        </th>
                                    </tr>
                                    <tr>
                                        <th
                                            className={`${CELL_BORDER} py-2 px-1 text-center text-[11px] md:text-[12px] font-bold text-gray-900`}
                                            style={{ backgroundColor: LABEL_BG }}
                                        >
                                            No.
                                        </th>
                                        <th
                                            colSpan={2}
                                            className={`${CELL_BORDER} py-2 px-1 text-center text-[11px] md:text-[12px] font-bold text-gray-900`}
                                            style={{ backgroundColor: LABEL_BG }}
                                        >
                                            Customer
                                        </th>
                                        {COLUMNS.filter(
                                            (col) =>
                                                col.key !== "no" &&
                                                col.key !== "customerCompany" &&
                                                col.key !== "customerContact"
                                        ).map((col) => (
                                            <th
                                                key={col.key}
                                                className={`${CELL_BORDER} py-2 px-1 text-center text-[11px] md:text-[12px] font-bold text-gray-900 whitespace-pre-line leading-tight`}
                                                style={{ backgroundColor: LABEL_BG }}
                                            >
                                                {col.label}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((row, index) => {
                                        const isSelected = selectedRowId === row.id;
                                        const selectedBg = isSelected ? "bg-gray-100" : "bg-white";
                                        const cellNav = (fieldKey: FieldKey) => ({
                                            focusKey: `${row.id}__${fieldKey}`,
                                            onArrowNavigate: (
                                                _e: React.KeyboardEvent<
                                                    HTMLInputElement | HTMLTextAreaElement
                                                >,
                                                direction:
                                                    | "ArrowUp"
                                                    | "ArrowDown"
                                                    | "ArrowLeft"
                                                    | "ArrowRight"
                                            ) => handleArrowNavigate(index, fieldKey, direction),
                                        });
                                        return (
                                        <tr
                                            key={row.id}
                                            data-schedule-row-id={row.id}
                                            className={selectedBg}
                                        >
                                            <td
                                                className={`${CELL_BORDER} min-h-[72px] p-0 text-center align-middle text-[11px] md:text-[12px] text-gray-900 font-medium transition-colors cursor-pointer ${
                                                    isSelected ? "bg-gray-100" : "hover:bg-blue-50"
                                                }`}
                                                onClick={() =>
                                                    setSelectedRowId(isSelected ? null : row.id)
                                                }
                                            >
                                                <div className="flex min-h-[72px] w-full items-center justify-center px-1">
                                                    <span>{index + 1}</span>
                                                </div>
                                            </td>
                                            <td className={`${CELL_BORDER} min-h-[72px] p-0 align-middle ${selectedBg}`}>
                                                <CellInput
                                                    value={row.customerCompany}
                                                    onChange={(v) =>
                                                        updateCell(row.id, "customerCompany", v)
                                                    }
                                                    multiline
                                                    {...cellNav("customerCompany")}
                                                />
                                            </td>
                                            <td className={`${CELL_BORDER} min-h-[72px] p-0 align-middle ${selectedBg}`}>
                                                <CellInput
                                                    value={row.customerContact}
                                                    onChange={(v) =>
                                                        updateCell(row.id, "customerContact", v)
                                                    }
                                                    multiline
                                                    {...cellNav("customerContact")}
                                                />
                                            </td>
                                            <td className={`${CELL_BORDER} min-h-[72px] p-0 align-middle ${selectedBg}`}>
                                                <CellInput
                                                    value={row.shipName}
                                                    onChange={(v) => updateCell(row.id, "shipName", v)}
                                                    uppercaseLettersOnly
                                                    {...cellNav("shipName")}
                                                />
                                            </td>
                                            <td className={`${CELL_BORDER} min-h-[72px] p-0 align-middle ${selectedBg}`}>
                                                <CellInput
                                                    value={row.engineType}
                                                    onChange={(v) => updateCell(row.id, "engineType", v)}
                                                    uppercaseLettersOnly
                                                    {...cellNav("engineType")}
                                                />
                                            </td>
                                            <td className={`${CELL_BORDER} min-h-[72px] p-0 align-middle ${selectedBg}`}>
                                                <CellInput
                                                    value={row.workLocation}
                                                    onChange={(v) =>
                                                        updateCell(row.id, "workLocation", v)
                                                    }
                                                    {...cellNav("workLocation")}
                                                />
                                            </td>
                                            <td className={`${CELL_BORDER} min-h-[72px] p-0 align-middle ${selectedBg}`}>
                                                <CellInput
                                                    value={row.period}
                                                    onChange={(v) => updateCell(row.id, "period", v)}
                                                    multiline
                                                    {...cellNav("period")}
                                                />
                                            </td>
                                            <td className={`${CELL_BORDER} min-h-[72px] p-0 align-middle ${selectedBg}`}>
                                                <CellInput
                                                    value={row.workItem}
                                                    onChange={(v) => updateCell(row.id, "workItem", v)}
                                                    multiline
                                                    {...cellNav("workItem")}
                                                />
                                            </td>
                                            <td className={`${CELL_BORDER} min-h-[72px] p-0 align-middle ${selectedBg}`}>
                                                <CellInput
                                                    value={row.manpower}
                                                    onChange={(v) => updateCell(row.id, "manpower", v)}
                                                    {...cellNav("manpower")}
                                                />
                                            </td>
                                            <td className={`${CELL_BORDER} min-h-[72px] p-0 align-middle ${selectedBg}`}>
                                                <CellInput
                                                    value={row.teamMember}
                                                    onChange={(v) =>
                                                        updateCell(row.id, "teamMember", v)
                                                    }
                                                    multiline
                                                    {...cellNav("teamMember")}
                                                />
                                            </td>
                                            <td className={`${CELL_BORDER} min-h-[72px] p-0 align-middle ${selectedBg}`}>
                                                <CellInput
                                                    value={row.car}
                                                    onChange={(v) => updateCell(row.id, "car", v)}
                                                    multiline
                                                    {...cellNav("car")}
                                                />
                                            </td>
                                            <td className={`${CELL_BORDER} min-h-[72px] p-0 align-middle ${selectedBg}`}>
                                                <CellInput
                                                    value={row.yardPic}
                                                    onChange={(v) => updateCell(row.id, "yardPic", v)}
                                                    {...cellNav("yardPic")}
                                                />
                                            </td>
                                            <td className={`${CELL_BORDER} min-h-[72px] p-0 align-middle ${selectedBg}`}>
                                                <CellInput
                                                    value={row.remark}
                                                    onChange={(v) => updateCell(row.id, "remark", v)}
                                                    multiline
                                                    {...cellNav("remark")}
                                                />
                                            </td>
                                        </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            </div>
                        </div>

                        <div className="flex justify-center pt-1">
                            <button
                                type="button"
                                onClick={addRow}
                                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 transition-colors hover:bg-gray-100"
                                aria-label={COPY.addRow}
                                title={COPY.addRow}
                            >
                                <IconPlus className="h-6 w-6" />
                            </button>
                        </div>
                    </PageContainer>
                </div>
            </div>
        </div>
    );
}
