// src/pages/Schedule/ScheduleListPage.tsx
import { useSidebarOpen } from "../../hooks/useSidebarOpen";
import { useUser } from "../../hooks/useUser";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/common/Header";
import PageContainer from "../../components/common/PageContainer";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import DatePicker from "../../components/ui/DatePicker";
import ScheduleSheetTable, {
    highlightSearchMatches,
} from "../../components/schedule/ScheduleSheetTable";
import { IconClose, IconCopy, IconDownload, IconSearch, IconTrash } from "../../components/icons/Icons";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import { useToast } from "../../components/ui/ToastProvider";
import { domToBlob } from "modern-screenshot";
import {
    deleteScheduleVersionAndRepack,
    fetchScheduleDistinctDates,
    fetchScheduleVersionSheetsByDates,
    type ScheduleVersionSheet,
} from "../../lib/scheduleApi";

const INITIAL_DAY_LIMIT = 10;
const LOAD_MORE_DAYS = 20;

function scheduleImageFileName(versionKey: string): string {
    const safe = versionKey.replace(/[\\/:*?"<>|]/g, "_").trim();
    return `${safe || "schedule"}.png`;
}

async function captureScheduleTableBlob(root: HTMLElement): Promise<Blob> {
    const table = root.querySelector("table");
    if (!(table instanceof HTMLElement)) {
        throw new Error("표를 찾지 못했습니다.");
    }

    const width = Math.ceil(table.scrollWidth);
    const height = Math.ceil(table.scrollHeight);
    const blob = await domToBlob(table, {
        scale: 2,
        backgroundColor: "#ffffff",
        width,
        height,
        type: "image/png",
    });
    if (!blob) throw new Error("이미지 생성에 실패했습니다.");
    return blob.type === "image/png"
        ? blob
        : new Blob([await blob.arrayBuffer()], { type: "image/png" });
}

async function downloadScheduleTableImage(
    root: HTMLElement,
    versionKey: string
): Promise<void> {
    const blob = await captureScheduleTableBlob(root);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = scheduleImageFileName(versionKey);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

type CopyScheduleImageResult = "copied" | "shared" | "downloaded";

function clipboardItemAcceptsPromise(): boolean {
    if (typeof ClipboardItem === "undefined") return false;
    try {
        new ClipboardItem({
            "image/png": Promise.resolve(new Blob([], { type: "image/png" })),
        });
        return true;
    } catch (err) {
        return !(err instanceof TypeError);
    }
}

function isShareAbort(err: unknown): boolean {
    return err instanceof DOMException && err.name === "AbortError";
}

async function copyImageBySelection(blob: Blob): Promise<void> {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.alt = "";
    img.src = url;

    const container = document.createElement("div");
    container.contentEditable = "true";
    container.setAttribute("aria-hidden", "true");
    container.style.position = "fixed";
    container.style.left = "-10000px";
    container.style.top = "0";
    container.style.opacity = "0";
    container.appendChild(img);
    document.body.appendChild(container);

    try {
        await img.decode();
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNode(img);
        selection?.removeAllRanges();
        selection?.addRange(range);
        container.focus({ preventScroll: true });
        const copied = document.execCommand("copy");
        selection?.removeAllRanges();
        if (!copied) throw new Error("클립보드 복사에 실패했습니다.");
    } finally {
        container.remove();
        URL.revokeObjectURL(url);
    }
}

async function shareScheduleTableImage(
    blob: Blob,
    versionKey: string
): Promise<boolean> {
    if (typeof navigator.share !== "function") return false;
    const file = new File([blob], scheduleImageFileName(versionKey), {
        type: "image/png",
    });
    if (
        typeof navigator.canShare === "function" &&
        !navigator.canShare({ files: [file] })
    ) {
        return false;
    }
    await navigator.share({ files: [file], title: versionKey });
    return true;
}

function downloadBlobAsPng(blob: Blob, versionKey: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = scheduleImageFileName(versionKey);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

/**
 * 모바일은 await/setState 뒤에 clipboard.write 하면 사용자 제스처가 끊겨 거절된다.
 * 클릭과 같은 틱에서 Promise ClipboardItem write를 먼저 걸고, 실패 시 공유→저장으로 폴백한다.
 */
function beginCopyScheduleTableImage(
    root: HTMLElement,
    versionKey: string
): Promise<CopyScheduleImageResult> {
    if (!window.isSecureContext) {
        return Promise.reject(
            new Error("보안 연결(HTTPS)에서만 이미지를 복사할 수 있습니다.")
        );
    }

    window.focus();
    const blobPromise = captureScheduleTableBlob(root);
    const canClipboardWrite =
        typeof navigator.clipboard?.write === "function" &&
        typeof ClipboardItem !== "undefined";

    let clipboardWrite: Promise<void> | null = null;
    if (canClipboardWrite && clipboardItemAcceptsPromise()) {
        try {
            clipboardWrite = navigator.clipboard.write([
                new ClipboardItem({ "image/png": blobPromise }),
            ]);
        } catch {
            clipboardWrite = null;
        }
    }

    return (async () => {
        if (clipboardWrite) {
            try {
                await clipboardWrite;
                return "copied";
            } catch {
                // 모바일 브라우저는 이미지 클립보드를 막는 경우가 많음 → 폴백
            }
        }

        const blob = await blobPromise;

        if (canClipboardWrite) {
            try {
                await navigator.clipboard.write([
                    new ClipboardItem({ "image/png": blob }),
                ]);
                return "copied";
            } catch {
                // fall through
            }
        }

        try {
            await copyImageBySelection(blob);
            return "copied";
        } catch {
            // fall through
        }

        try {
            if (await shareScheduleTableImage(blob, versionKey)) {
                return "shared";
            }
        } catch (err) {
            if (isShareAbort(err)) {
                throw new Error("공유가 취소되었습니다.");
            }
        }

        downloadBlobAsPng(blob, versionKey);
        return "downloaded";
    })();
}

function sheetMatchesSearch(
    sheet: ScheduleVersionSheet,
    query: string,
    dateFrom: string,
    dateTo: string
): boolean {
    if (dateFrom && sheet.scheduleDate < dateFrom) return false;
    if (dateTo && sheet.scheduleDate > dateTo) return false;

    const q = query.trim().toLowerCase();
    if (!q) return true;

    if (sheet.versionKey.toLowerCase().includes(q)) return true;
    if (sheet.versionLabel.toLowerCase().includes(q)) return true;

    return sheet.rows.some((row) =>
        [
            row.customerCompany,
            row.customerContact,
            row.shipName,
            row.engineType,
            row.workLocation,
            row.period,
            row.workItem,
            row.manpower,
            row.teamMember,
            row.car,
            row.yardPic,
            row.remark,
        ].some((v) => v.toLowerCase().includes(q))
    );
}

/** Drop a version and renumber that date's remaining sheets to A, B, C… */
function sheetsAfterVersionDelete(
    sheets: ScheduleVersionSheet[],
    deletedId: string
): ScheduleVersionSheet[] {
    const deleted = sheets.find((sheet) => sheet.id === deletedId);
    if (!deleted) return sheets.filter((sheet) => sheet.id !== deletedId);

    const remaining = sheets
        .filter(
            (sheet) =>
                sheet.scheduleDate === deleted.scheduleDate && sheet.id !== deletedId
        )
        .sort((a, b) => {
            const byLabel = a.versionLabel.localeCompare(b.versionLabel);
            if (byLabel !== 0) return byLabel;
            const byCreated = a.createdAt.localeCompare(b.createdAt);
            if (byCreated !== 0) return byCreated;
            return a.id.localeCompare(b.id);
        });

    const relabeled = new Map(
        remaining.map((sheet, index) => {
            const versionLabel = String.fromCharCode(65 + index);
            return [
                sheet.id,
                {
                    ...sheet,
                    versionLabel,
                    versionKey: `${sheet.scheduleDate}${versionLabel}`,
                },
            ] as const;
        })
    );

    return sheets
        .filter((sheet) => sheet.id !== deletedId)
        .map((sheet) => relabeled.get(sheet.id) ?? sheet);
}

export default function ScheduleListPage() {
    const [sidebarOpen, setSidebarOpen] = useSidebarOpen();
    useEffect(() => {
        setSidebarOpen(false);
    }, [setSidebarOpen]);
    const { userPermissions } = useUser();
    const [allDates, setAllDates] = useState<string[]>([]);
    const [dayLimit, setDayLimit] = useState(INITIAL_DAY_LIMIT);
    const [sheets, setSheets] = useState<ScheduleVersionSheet[]>([]);
    const [datesLoading, setDatesLoading] = useState(true);
    const [sheetsLoading, setSheetsLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const { showError, showSuccess } = useToast();
    const [sheetImageBusy, setSheetImageBusy] = useState<{
        id: string;
        action: "download" | "copy";
    } | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<ScheduleVersionSheet | null>(null);
    const [deletingSheetId, setDeletingSheetId] = useState<string | null>(null);
    const tableRootRefs = useRef(new Map<string, HTMLDivElement>());
    const searchButtonRef = useRef<HTMLButtonElement>(null);
    const searchPopoverRef = useRef<HTMLDivElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const loadMoreLockRef = useRef(false);
    const loadedDayLimitRef = useRef(0);
    const maxYear = new Date().getFullYear() + 1;

    const hasMoreDays = dayLimit < allDates.length;
    const initialLoading = datesLoading || (sheetsLoading && sheets.length === 0);

    // Distinct dates (newest first), refreshed when date-range filter changes
    useEffect(() => {
        let cancelled = false;
        void (async () => {
            setDatesLoading(true);
            setDayLimit(INITIAL_DAY_LIMIT);
            loadedDayLimitRef.current = 0;
            setSheets([]);
            try {
                const dates = await fetchScheduleDistinctDates({
                    dateFrom: dateFrom || undefined,
                    dateTo: dateTo || undefined,
                });
                if (!cancelled) setAllDates(dates);
            } catch (err) {
                console.error(err);
                if (!cancelled) {
                    setAllDates([]);
                    showError(
                        err instanceof Error
                            ? err.message
                            : "일정 목록을 불러오지 못했습니다."
                    );
                }
            } finally {
                if (!cancelled) setDatesLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [dateFrom, dateTo, showError]);

    // Sheet bodies for visible date window
    useEffect(() => {
        if (datesLoading) return;

        const datesToLoad = allDates.slice(0, dayLimit);
        if (datesToLoad.length === 0) {
            setSheets([]);
            setSheetsLoading(false);
            setLoadingMore(false);
            loadMoreLockRef.current = false;
            loadedDayLimitRef.current = 0;
            return;
        }

        const isLoadMore = dayLimit > loadedDayLimitRef.current && loadedDayLimitRef.current > 0;
        let cancelled = false;

        if (isLoadMore) setLoadingMore(true);
        else setSheetsLoading(true);

        void (async () => {
            try {
                const data = await fetchScheduleVersionSheetsByDates(datesToLoad);
                if (cancelled) return;
                setSheets(data);
                loadedDayLimitRef.current = dayLimit;
            } catch (err) {
                console.error(err);
                if (!cancelled) {
                    showError(
                        err instanceof Error
                            ? err.message
                            : "일정 목록을 불러오지 못했습니다."
                    );
                }
            } finally {
                if (!cancelled) {
                    setSheetsLoading(false);
                    setLoadingMore(false);
                    loadMoreLockRef.current = false;
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [allDates, dayLimit, datesLoading, showError]);

    const loadMore = useCallback(() => {
        if (loadMoreLockRef.current || loadingMore || datesLoading || !hasMoreDays) {
            return;
        }
        loadMoreLockRef.current = true;
        setDayLimit((prev) => Math.min(prev + LOAD_MORE_DAYS, allDates.length));
    }, [allDates.length, datesLoading, hasMoreDays, loadingMore]);

    useEffect(() => {
        if (!searchOpen) return;

        const onPointerDown = (e: MouseEvent) => {
            const target = e.target as Node | null;
            if (!target) return;
            if (searchPopoverRef.current?.contains(target)) return;
            if (searchButtonRef.current?.contains(target)) return;
            const el = target instanceof Element ? target : null;
            if (el?.closest("[data-datepicker-popup]")) return;
            setSearchOpen(false);
        };

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") setSearchOpen(false);
        };

        document.addEventListener("mousedown", onPointerDown);
        document.addEventListener("keydown", onKeyDown);
        return () => {
            document.removeEventListener("mousedown", onPointerDown);
            document.removeEventListener("keydown", onKeyDown);
        };
    }, [searchOpen]);

    const filteredSheets = useMemo(
        () =>
            sheets.filter((sheet) =>
                sheetMatchesSearch(sheet, searchQuery, dateFrom, dateTo)
            ),
        [sheets, searchQuery, dateFrom, dateTo]
    );

    const hasActiveFilter =
        searchQuery.trim() !== "" || dateFrom !== "" || dateTo !== "";

    const runSheetImageAction = async (
        sheet: ScheduleVersionSheet,
        action: "download" | "copy"
    ) => {
        const root = tableRootRefs.current.get(sheet.id);
        if (!root || sheetImageBusy) return;

        if (action === "copy") {
            // setState보다 먼저 write를 시작해 모바일 사용자 제스처를 유지한다.
            const copyPromise = beginCopyScheduleTableImage(
                root,
                sheet.versionKey
            );
            setSheetImageBusy({ id: sheet.id, action });
            try {
                const result = await copyPromise;
                if (result === "copied") {
                    showSuccess("일정 표 이미지를 클립보드에 복사했습니다.");
                } else if (result === "shared") {
                    showSuccess("일정 표 이미지를 공유했습니다.");
                } else {
                    showSuccess(
                        "이 기기에서는 클립보드 복사를 지원하지 않아 이미지로 저장했습니다."
                    );
                }
            } catch (err) {
                console.error(err);
                showError(
                    err instanceof Error
                        ? err.message
                        : "클립보드 복사에 실패했습니다."
                );
            } finally {
                setSheetImageBusy(null);
            }
            return;
        }

        setSheetImageBusy({ id: sheet.id, action });
        try {
            await downloadScheduleTableImage(root, sheet.versionKey);
            showSuccess("일정 표를 이미지로 저장했습니다.");
        } catch (err) {
            console.error(err);
            showError(
                err instanceof Error
                    ? err.message
                    : "이미지 저장에 실패했습니다."
            );
        } finally {
            setSheetImageBusy(null);
        }
    };

    const handleConfirmDelete = async () => {
        if (!deleteTarget || deletingSheetId) return;
        const sheet = deleteTarget;
        setDeletingSheetId(sheet.id);
        try {
            await deleteScheduleVersionAndRepack(sheet.id);
            let dateRemoved = false;
            setSheets((current) => {
                const next = sheetsAfterVersionDelete(current, sheet.id);
                dateRemoved = !next.some(
                    (item) => item.scheduleDate === sheet.scheduleDate
                );
                return next;
            });
            if (dateRemoved) {
                setAllDates((dates) =>
                    dates.filter((date) => date !== sheet.scheduleDate)
                );
            }
            setDeleteTarget(null);
            showSuccess("일정을 삭제했습니다.");
        } catch (err) {
            console.error(err);
            showError(
                err instanceof Error ? err.message : "일정 삭제에 실패했습니다."
            );
        } finally {
            setDeletingSheetId(null);
        }
    };

    const handleScroll = () => {
        const el = scrollRef.current;
        if (!el || initialLoading || loadingMore || !hasMoreDays) return;
        const remaining = el.scrollHeight - el.scrollTop - el.clientHeight;
        if (remaining < 480) loadMore();
    };

    return (
        <div className="flex h-screen bg-gray-50 overflow-hidden">
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40"
                    onClick={() => setSidebarOpen(false)}
                />
            )}
            <div
                className={`fixed inset-y-0 left-0 z-50 w-[260px] max-w-[88vw] lg:max-w-none lg:w-[239px] h-screen shrink-0 transform transition-transform duration-300 ease-in-out ${
                    sidebarOpen ? "translate-x-0" : "-translate-x-full"
                }`}
                onClick={(e) => e.stopPropagation()}
            >
                <Sidebar onClose={() => setSidebarOpen(false)} showCloseOnDesktop />
            </div>

            <div className="flex-1 flex flex-col h-screen overflow-hidden w-full">
                <Header
                    title="일정 목록"
                    onMenuClick={() => setSidebarOpen(!sidebarOpen)}
                    showMenuOnDesktop
                    rightContent={
                        <button
                            ref={searchButtonRef}
                            type="button"
                            onClick={() => setSearchOpen((open) => !open)}
                            className={[
                                "flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 transition-colors hover:bg-gray-100",
                                searchOpen ? "bg-gray-100" : null,
                            ]
                                .filter(Boolean)
                                .join(" ")}
                            title="검색"
                            aria-label="검색"
                            aria-expanded={searchOpen}
                            aria-haspopup="dialog"
                        >
                            <IconSearch />
                        </button>
                    }
                />

                {searchOpen ? (
                    <div
                        ref={searchPopoverRef}
                        role="dialog"
                        aria-label="일정 검색"
                        className="fixed right-4 top-16 z-[100] w-[min(22rem,calc(100vw-2rem))] overflow-visible rounded-xl border border-gray-200 bg-white shadow-[0_10px_40px_-10px_rgba(15,23,42,0.18),0_2px_8px_-4px_rgba(15,23,42,0.08)] md:top-20"
                    >
                        <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50/80 px-3 py-2.5 sm:px-4 sm:py-3">
                            <p className="min-w-0 flex-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                검색
                            </p>
                            <button
                                type="button"
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-800 transition-colors hover:bg-gray-100"
                                onClick={() => setSearchOpen(false)}
                                aria-label="닫기"
                                title="닫기"
                            >
                                <IconClose className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="flex flex-col gap-3 p-3 sm:p-4">
                            <Input
                                label="검색어"
                                placeholder=" "
                                value={searchQuery}
                                onChange={setSearchQuery}
                            />
                            <div className="grid grid-cols-2 gap-3">
                                <DatePicker
                                    label="시작일"
                                    value={dateFrom}
                                    onChange={setDateFrom}
                                    placeholder="부터"
                                    maxYear={maxYear}
                                    displayFormat="iso"
                                    inputClassName="!text-sm !px-3"
                                />
                                <DatePicker
                                    label="종료일"
                                    value={dateTo}
                                    onChange={setDateTo}
                                    placeholder="까지"
                                    maxYear={maxYear}
                                    displayFormat="iso"
                                    inputClassName="!text-sm !px-3"
                                />
                            </div>
                        </div>
                    </div>
                ) : null}

                <div
                    ref={scrollRef}
                    className="flex-1 overflow-y-auto pt-4 pb-24"
                    onScroll={handleScroll}
                >
                    <PageContainer className="pt-2 flex flex-col gap-8">
                        {initialLoading ? (
                            <div className="py-16 text-center text-gray-500 text-sm">
                                불러오는 중…
                            </div>
                        ) : filteredSheets.length === 0 ? (
                            <div className="py-16 text-center text-gray-500 text-sm">
                                {hasActiveFilter
                                    ? "검색 조건에 맞는 일정이 없습니다."
                                    : "등록된 일정이 없습니다."}
                            </div>
                        ) : (
                            filteredSheets.map((sheet, index) => {
                                const prevDate =
                                    index > 0
                                        ? filteredSheets[index - 1]?.scheduleDate
                                        : null;
                                const showDateDivider =
                                    prevDate != null &&
                                    prevDate !== sheet.scheduleDate;

                                return (
                                    <div key={sheet.id} className="flex flex-col gap-8">
                                        {showDateDivider ? (
                                            <div
                                                className="flex items-center gap-3"
                                                role="separator"
                                                aria-label={`${prevDate} / ${sheet.scheduleDate}`}
                                            >
                                                <div className="h-px flex-1 bg-gray-300" />
                                                <span className="shrink-0 text-xs font-medium tracking-wide text-gray-500">
                                                    {sheet.scheduleDate}
                                                </span>
                                                <div className="h-px flex-1 bg-gray-300" />
                                            </div>
                                        ) : null}
                                        <section
                                            className="flex flex-col gap-2"
                                            aria-label={sheet.versionKey}
                                        >
                                            <div className="flex items-center justify-between gap-3">
                                                <h2 className="min-w-0 text-sm md:text-base font-semibold tracking-tight text-gray-900">
                                                    {highlightSearchMatches(
                                                        sheet.versionKey,
                                                        searchQuery
                                                    )}
                                                </h2>
                                                <div className="flex shrink-0 items-center gap-1">
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        className="border-0 text-gray-700! hover:text-gray-900!"
                                                        icon={
                                                            <IconCopy className="h-5 w-5" />
                                                        }
                                                        loading={
                                                            sheetImageBusy?.id === sheet.id &&
                                                            sheetImageBusy.action === "copy"
                                                        }
                                                        disabled={
                                                            sheetImageBusy != null ||
                                                            deletingSheetId != null
                                                        }
                                                        onClick={() =>
                                                            void runSheetImageAction(sheet, "copy")
                                                        }
                                                        title="표를 이미지로 복사"
                                                        aria-label={`${sheet.versionKey} 표를 이미지로 복사`}
                                                    />
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        className="border-0 text-gray-700! hover:text-gray-900!"
                                                        icon={
                                                            <IconDownload className="h-5 w-5" />
                                                        }
                                                        loading={
                                                            sheetImageBusy?.id === sheet.id &&
                                                            sheetImageBusy.action === "download"
                                                        }
                                                        disabled={
                                                            sheetImageBusy != null ||
                                                            deletingSheetId != null
                                                        }
                                                        onClick={() =>
                                                            void runSheetImageAction(
                                                                sheet,
                                                                "download"
                                                            )
                                                        }
                                                        title="표를 이미지로 저장"
                                                        aria-label={`${sheet.versionKey} 표를 이미지로 저장`}
                                                    />
                                                    {userPermissions.isAdmin ? (
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            className="border-0 text-gray-700! hover:text-red-600!"
                                                            icon={
                                                                <IconTrash className="h-5 w-5" />
                                                            }
                                                            loading={deletingSheetId === sheet.id}
                                                            disabled={
                                                                sheetImageBusy != null ||
                                                                deletingSheetId != null
                                                            }
                                                            onClick={() => setDeleteTarget(sheet)}
                                                            title="일정 삭제"
                                                            aria-label={`${sheet.versionKey} 일정 삭제`}
                                                        />
                                                    ) : null}
                                                </div>
                                            </div>
                                            <ScheduleSheetTable
                                                rootRef={(node) => {
                                                    if (node) {
                                                        tableRootRefs.current.set(sheet.id, node);
                                                    } else {
                                                        tableRootRefs.current.delete(sheet.id);
                                                    }
                                                }}
                                                rows={sheet.rows}
                                                highlightQuery={searchQuery}
                                            />
                                        </section>
                                    </div>
                                );
                            })
                        )}
                        {loadingMore ? (
                            <div className="py-4 text-center text-gray-500 text-sm">
                                더 불러오는 중…
                            </div>
                        ) : null}
                    </PageContainer>
                </div>
            </div>
            <ConfirmDialog
                isOpen={deleteTarget != null}
                onClose={() => {
                    if (deletingSheetId) return;
                    setDeleteTarget(null);
                }}
                onConfirm={() => void handleConfirmDelete()}
                title="일정 삭제"
                message={
                    deleteTarget
                        ? `${deleteTarget.versionKey} 일정을 삭제하시겠습니까?`
                        : "이 일정을 삭제하시겠습니까?"
                }
                confirmText="삭제"
                cancelText="취소"
                isLoading={deletingSheetId != null}
            />
        </div>
    );
}
