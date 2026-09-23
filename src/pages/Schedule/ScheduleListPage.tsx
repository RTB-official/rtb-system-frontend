// src/pages/Schedule/ScheduleListPage.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/common/Header";
import PageContainer from "../../components/common/PageContainer";
import Input from "../../components/common/Input";
import DatePicker from "../../components/ui/DatePicker";
import ScheduleSheetTable, {
    highlightSearchMatches,
} from "../../components/schedule/ScheduleSheetTable";
import { IconClose, IconSearch } from "../../components/icons/Icons";
import { useToast } from "../../components/ui/ToastProvider";
import {
    fetchScheduleDistinctDates,
    fetchScheduleVersionSheetsByDates,
    type ScheduleVersionSheet,
} from "../../lib/scheduleApi";

const INITIAL_DAY_LIMIT = 10;
const LOAD_MORE_DAYS = 20;

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

export default function ScheduleListPage() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
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
    const { showError } = useToast();
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
                    title="일정 목록"
                    onMenuClick={() => setSidebarOpen(true)}
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
                                            <h2 className="text-sm md:text-base font-semibold tracking-tight text-gray-900">
                                                {highlightSearchMatches(
                                                    sheet.versionKey,
                                                    searchQuery
                                                )}
                                            </h2>
                                            <ScheduleSheetTable
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
        </div>
    );
}
