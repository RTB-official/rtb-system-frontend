import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import PageContainer from "../../components/common/PageContainer";
import Header from "../../components/common/Header";
import Sidebar from "../../components/Sidebar";
import Table from "../../components/common/Table";
import Input from "../../components/common/Input";
import YearMonthSelector from "../../components/common/YearMonthSelector";
import Button from "../../components/common/Button";
import Avatar from "../../components/common/Avatar";
import { IconInvoice } from "../../components/icons/Icons";
import { useToast } from "../../components/ui/ToastProvider";
import {
    fetchReportList,
    parseReportListMonth,
    parseReportListYear,
    type ReportListItem,
} from "../../lib/reportListApi";
import { PATHS } from "../../utils/paths";

type InvoiceReportItem = ReportListItem;

const DEFAULT_YEAR = "년도 전체";
const DEFAULT_MONTH = "월 전체";
const ITEMS_PER_PAGE = 30;
const SEARCH_DEBOUNCE_MS = 300;

export default function InvoicePage() {
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [year, setYear] = useState<string>(DEFAULT_YEAR);
    const [month, setMonth] = useState<string>(DEFAULT_MONTH);
    const [reports, setReports] = useState<InvoiceReportItem[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [selectAllLoading, setSelectAllLoading] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = ITEMS_PER_PAGE;

    const { showError } = useToast();
    const isFirstSearchDebounceRef = useRef(true);

    const listQuery = useMemo(
        () => ({
            search: debouncedSearch,
            year: parseReportListYear(year),
            month: parseReportListMonth(month),
            tab: "work" as const,
        }),
        [debouncedSearch, year, month]
    );

    useEffect(() => {
        const timer = window.setTimeout(() => {
            setDebouncedSearch(search);
            if (!isFirstSearchDebounceRef.current) {
                setCurrentPage(1);
            }
            isFirstSearchDebounceRef.current = false;
        }, SEARCH_DEBOUNCE_MS);

        return () => window.clearTimeout(timer);
    }, [search]);

    const loadReports = async () => {
        setLoading(true);
        try {
            const result = await fetchReportList({
                page: currentPage,
                pageSize: itemsPerPage,
                ...listQuery,
            });
            setReports(result.items);
            setTotalCount(result.totalCount);
        } catch (e) {
            console.error("인보이스용 보고서 목록 로드 실패:", e);
            showError("보고서 목록을 불러오는 중 오류가 발생했습니다.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadReports();
    }, [currentPage, itemsPerPage, listQuery]);

    const isFilterActive =
        year !== DEFAULT_YEAR ||
        month !== DEFAULT_MONTH ||
        debouncedSearch.trim() !== "";

    const handleResetFilter = () => {
        setYear(DEFAULT_YEAR);
        setMonth(DEFAULT_MONTH);
        setSearch("");
        setCurrentPage(1);
    };

    const totalPages = Math.ceil(totalCount / itemsPerPage) || 0;

    useEffect(() => {
        if (loading) return;

        if (totalPages === 0 && currentPage !== 1) {
            setCurrentPage(1);
            return;
        }
        if (totalPages > 0 && currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, loading, totalPages]);

    const fetchAllMatchingIds = async (): Promise<number[]> => {
        if (totalCount === 0) return [];

        const result = await fetchReportList({
            page: 1,
            pageSize: totalCount,
            ...listQuery,
        });
        return result.items.map((r) => r.id);
    };

    const allFilteredSelected =
        totalCount > 0 && selectedIds.size === totalCount;

    const handleToggleSelectAllFiltered = async () => {
        if (totalCount === 0 || selectAllLoading) return;

        if (allFilteredSelected) {
            setSelectAllLoading(true);
            try {
                const ids = await fetchAllMatchingIds();
                setSelectedIds((prev) => {
                    const next = new Set(prev);
                    ids.forEach((id) => next.delete(id));
                    return next;
                });
            } catch (e) {
                console.error("전체 해제용 목록 조회 실패:", e);
                showError("선택 해제 중 오류가 발생했습니다.");
            } finally {
                setSelectAllLoading(false);
            }
            return;
        }

        setSelectAllLoading(true);
        try {
            const ids = await fetchAllMatchingIds();
            setSelectedIds(new Set(ids));
        } catch (e) {
            console.error("전체 선택용 목록 조회 실패:", e);
            showError("전체 선택 중 오류가 발생했습니다.");
        } finally {
            setSelectAllLoading(false);
        }
    };

    const toggleSelect = (row: InvoiceReportItem) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(row.id)) {
                next.delete(row.id);
            } else {
                next.add(row.id);
            }
            return next;
        });
    };

    const hasSelection = selectedIds.size > 0;

    return (
        <div className="flex h-screen bg-[#f9fafb] overflow-hidden">
            <div
                className={`fixed lg:static inset-y-0 left-0 z-30 w-[260px] max-w-[88vw] lg:max-w-none lg:w-[239px] h-screen shrink-0 transform transition-transform duration-300 ease-in-out ${
                    sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
                }`}
            >
                <Sidebar onClose={() => setSidebarOpen(false)} />
            </div>

            <div className="flex-1 flex flex-col h-screen overflow-hidden w-full">
                <Header
                    title="보고서"
                    onMenuClick={() => setSidebarOpen(true)}
                    rightContent={
                        hasSelection ? (
                            <Button
                                variant="primary"
                                size="lg"
                                icon={<IconInvoice />}
                                onClick={() => {
                                    const selectedIdsArray = Array.from(selectedIds);
                                    if (selectedIdsArray.length > 0) {
                                        const idsParam = selectedIdsArray.join(",");
                                        navigate(`${PATHS.invoiceCreate}?workLogIds=${idsParam}`);
                                    } else {
                                        navigate(PATHS.invoiceCreate);
                                    }
                                }}
                            >
                                인보이스 생성
                            </Button>
                        ) : undefined
                    }
                />

                <PageContainer className="flex-1 overflow-y-auto pt-0 pb-24">
                    <div className="space-y-4">
                        <div className="flex flex-wrap items-center gap-3 justify-between sticky top-0 z-10 bg-white border-b border-gray-200 pb-4 pt-4 -mx-4 md:-mx-6 lg:-mx-9 px-4 md:px-6 lg:px-9">
                            <div className="flex flex-1 min-w-0 flex-wrap items-center gap-3">
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
                                    className="flex-1 min-w-[260px]"
                                />
                            </div>
                            <div className="flex items-center gap-2 flex-wrap justify-end">
                                <YearMonthSelector
                                    year={year}
                                    month={month}
                                    onYearChange={(value) => {
                                        setYear(value);
                                        setCurrentPage(1);
                                    }}
                                    onMonthChange={(value) => {
                                        setMonth(value);
                                        setCurrentPage(1);
                                    }}
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
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="lg"
                                    className="min-w-[5.75rem] shrink-0 rounded-xl px-4"
                                    onClick={handleToggleSelectAllFiltered}
                                    disabled={
                                        loading ||
                                        selectAllLoading ||
                                        totalCount === 0
                                    }
                                    aria-pressed={allFilteredSelected}
                                >
                                    {selectAllLoading
                                        ? "처리 중..."
                                        : allFilteredSelected
                                          ? "전체 해제"
                                          : "전체 선택"}
                                </Button>
                                {isFilterActive && (
                                    <button
                                        onClick={handleResetFilter}
                                        className="h-12 w-12 flex items-center justify-center border border-gray-200 rounded-xl bg-white hover:bg-gray-50 text-gray-600 hover:text-gray-900 transition-colors"
                                        aria-label="필터 초기화"
                                    >
                                        <svg
                                            width="16"
                                            height="16"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        >
                                            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                                            <path d="M21 3v5h-5" />
                                            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                                            <path d="M3 21v-5h5" />
                                        </svg>
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="bg-white border border-gray-200 rounded-2xl p-0 md:p-0 shadow-sm mt-4">
                            {loading ? (
                                <div className="py-10 text-center text-gray-500 text-sm">
                                    로딩 중...
                                </div>
                            ) : (
                                <Table
                                    className="text-[14px]"
                                    emptyText="조회된 보고서가 없습니다."
                                    columns={[
                                        {
                                            key: "owner",
                                            label: "작성자",
                                            width: "14%",
                                            render: (_: unknown, row: InvoiceReportItem) => (
                                                <div className="flex items-center gap-2">
                                                    <Avatar
                                                        email={row.ownerEmail ?? null}
                                                        position={row.ownerPosition ?? null}
                                                        size={24}
                                                    />
                                                    <span className="text-gray-900">
                                                        {row.owner}
                                                    </span>
                                                </div>
                                            ),
                                        },
                                        {
                                            key: "title",
                                            label: "제목",
                                            width: "44%",
                                        },
                                        {
                                            key: "place",
                                            label: "출장지",
                                            width: "14%",
                                            render: (value: string) =>
                                                value?.trim() ? (
                                                    <span className="text-gray-600">
                                                        {value}
                                                    </span>
                                                ) : (
                                                    ""
                                                ),
                                        },
                                        {
                                            key: "supervisor",
                                            label: "참관감독",
                                            width: "14%",
                                            render: (value: string) =>
                                                value?.trim() ? (
                                                    <span className="text-gray-500">
                                                        {value}
                                                    </span>
                                                ) : (
                                                    ""
                                                ),
                                        },
                                        {
                                            key: "date",
                                            label: "작성일",
                                            width: "14%",
                                            render: (value: string) => (
                                                <span className="text-gray-600">
                                                    {value}
                                                </span>
                                            ),
                                        },
                                    ]}
                                    data={reports}
                                    rowKey="id"
                                    rowClassName={(row: InvoiceReportItem) =>
                                        selectedIds.has(row.id)
                                            ? "!bg-blue-100 hover:!bg-blue-200"
                                            : ""
                                    }
                                    onRowClick={(row: InvoiceReportItem) =>
                                        toggleSelect(row)
                                    }
                                    pagination={{
                                        currentPage,
                                        totalPages: Math.max(1, totalPages),
                                        onPageChange: setCurrentPage,
                                    }}
                                />
                            )}
                        </div>
                    </div>
                </PageContainer>
            </div>
        </div>
    );
}
