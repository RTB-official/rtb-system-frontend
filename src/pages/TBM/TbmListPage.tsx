// src/pages/TBM/TbmListPage.tsx
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/common/Header";
import Table from "../../components/common/Table";
import Input from "../../components/common/Input";
import YearMonthSelector from "../../components/common/YearMonthSelector";
import Button from "../../components/common/Button";
import ActionMenu from "../../components/common/ActionMenu";
import { IconMore, IconPlus } from "../../components/icons/Icons";
import { useToast } from "../../components/ui/ToastProvider";
import { useUser } from "../../hooks/useUser";
import { deleteTbm } from "../../lib/tbmApi";
import {
    fetchTbmList,
    getTbmListStatusChip,
    parseTbmListMonth,
    parseTbmListYear,
    type TbmListItem,
} from "../../lib/tbmListApi";
import { generateTbmPdf } from "../../lib/pdfUtils";
import Chip from "../../components/ui/Chip";
import TbmListSkeleton from "../../components/common/skeletons/TbmListSkeleton";
import useIsMobile from "../../hooks/useIsMobile";

const DEFAULT_YEAR = "년도 전체";
const DEFAULT_MONTH = "월 전체";
const ITEMS_PER_PAGE = 10;
const SEARCH_DEBOUNCE_MS = 300;

const parsePage = (value: string | null) => {
    const page = Number.parseInt(value || "", 10);
    return Number.isNaN(page) || page < 1 ? 1 : page;
};

const searchParamsEqual = (a: URLSearchParams, b: URLSearchParams) => {
    if (a.size !== b.size) return false;
    for (const [key, val] of a.entries()) {
        if (b.get(key) !== val) return false;
    }
    return true;
};

export default function TbmListPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams, setSearchParams] = useSearchParams();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [search, setSearch] = useState(() => searchParams.get("search") ?? "");
    const [year, setYear] = useState(() => searchParams.get("year") || DEFAULT_YEAR);
    const [month, setMonth] = useState(() => searchParams.get("month") || DEFAULT_MONTH);
    const [inProgressOnly, setInProgressOnly] = useState(
        () => searchParams.get("inProgress") === "1"
    );
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
    const [currentPage, setCurrentPage] = useState(() => parsePage(searchParams.get("page")));
    const [debouncedSearch, setDebouncedSearch] = useState(() => searchParams.get("search") ?? "");
    const itemsPerPage = ITEMS_PER_PAGE;
    const { showError, showSuccess } = useToast();
    const [loading, setLoading] = useState(true);
    const [tbmList, setTbmList] = useState<TbmListItem[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const { currentUserId, userPermissions } = useUser();
    const isMobile = useIsMobile();
    const isFirstSearchDebounceRef = useRef(true);
    const handleDownloadPdf = async (tbmId: string) => {
        await generateTbmPdf({
            tbmId,
            onError: showError,
        });
    };

    const navigateToTbmDetail = (tbmId: string) => {
        navigate(`/tbm/${tbmId}`, {
            state: {
                from: {
                    pathname: location.pathname,
                    search: location.search,
                },
            },
        });
    };

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

    const loadTbmList = async () => {
        try {
            setLoading(true);
            const result = await fetchTbmList({
                page: currentPage,
                pageSize: itemsPerPage,
                search: debouncedSearch,
                year: parseTbmListYear(year),
                month: parseTbmListMonth(month),
                inProgressOnly,
            });
            setTbmList(result.items);
            setTotalCount(result.totalCount);
        } catch (e: unknown) {
            showError(
                e instanceof Error ? e.message : "TBM 목록을 불러오지 못했습니다."
            );
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadTbmList();
    }, [currentPage, itemsPerPage, debouncedSearch, year, month, inProgressOnly]);

    const handleDeleteTbm = async (tbmId: string) => {
        if (!window.confirm("\u0054\u0042\u004d\uC744 \uC0AD\uC81C\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?")) return;

        try {
            await deleteTbm(tbmId);
            await loadTbmList();
            showSuccess("\u0054\u0042\u004d\uC774 \uC0AD\uC81C\uB418\uC5C8\uC2B5\uB2C8\uB2E4.");
        } catch (e: unknown) {
            showError(
                e instanceof Error ? e.message : "\u0054\u0042\u004d \uC0AD\uC81C\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4."
            );
        } finally {
            setOpenMenuId(null);
            setMenuAnchor(null);
        }
    };

    const totalPages = Math.ceil(totalCount / itemsPerPage);

    useEffect(() => {
        const nextParams = new URLSearchParams();

        if (search) nextParams.set("search", search);
        if (year !== DEFAULT_YEAR) nextParams.set("year", year);
        if (month !== DEFAULT_MONTH) nextParams.set("month", month);
        if (inProgressOnly) nextParams.set("inProgress", "1");
        if (currentPage > 1) nextParams.set("page", String(currentPage));

        if (!searchParamsEqual(nextParams, searchParams)) {
            setSearchParams(nextParams, { replace: true });
        }
    }, [search, year, month, inProgressOnly, currentPage, searchParams, setSearchParams]);

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

    return (
        <div className="flex h-screen bg-white overflow-hidden">
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-20 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            <div
                className={`fixed lg:static inset-y-0 left-0 z-30 w-[260px] max-w-[88vw] lg:max-w-none lg:w-[239px] h-screen shrink-0 transform transition-transform duration-300 ease-in-out ${sidebarOpen
                    ? "translate-x-0"
                    : "-translate-x-full lg:translate-x-0"
                    }`}
            >
                <Sidebar onClose={() => setSidebarOpen(false)} />
            </div>

            <div className="flex-1 flex flex-col h-screen overflow-hidden w-full">
                <Header
                    title="TBM 목록"
                    onMenuClick={() => setSidebarOpen(true)}
                    rightContent={
                        !isMobile ? (
                            <Button
                                variant="primary"
                                size="lg"
                                onClick={() => navigate("/tbm/create")}
                                icon={<IconPlus />}
                            >
                                TBM 작성
                            </Button>
                        ) : undefined
                    }
                />

                <div className="flex-1 overflow-y-auto px-4 md:px-6 lg:px-12 pt-4 md:pt-6 pb-24 relative">
                    {loading ? (
                        <TbmListSkeleton />
                    ) : isMobile ? (
                        <div className="flex flex-col gap-4">
                            <div className="flex flex-col gap-3">
                                <Input
                                    value={search}
                                    onChange={setSearch}
                                    placeholder="검색어를 입력해 주세요"
                                    icon={
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <circle cx="11" cy="11" r="7" />
                                            <line x1="16.65" y1="16.65" x2="21" y2="21" />
                                        </svg>
                                    }
                                    iconPosition="left"
                                    className="w-full"
                                />
                                <div className="flex items-center gap-2 flex-wrap">
                                    <Button
                                        type="button"
                                        variant={inProgressOnly ? "primary" : "outline"}
                                        size="md"
                                        className="shrink-0"
                                        aria-pressed={inProgressOnly}
                                        onClick={() => {
                                            setInProgressOnly((v) => !v);
                                            setCurrentPage(1);
                                        }}
                                    >
                                        진행중인 TBM
                                    </Button>
                                    <YearMonthSelector
                                        className="flex-1 min-w-0"
                                        year={year}
                                        month={month}
                                        onYearChange={(val) => {
                                            setYear(val);
                                            setCurrentPage(1);
                                        }}
                                        onMonthChange={(val) => {
                                            setMonth(val);
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
                                </div>
                            </div>

                            {totalCount === 0 ? (
                                <div className="py-10 text-center text-gray-500 text-sm">결과가 없습니다.</div>
                            ) : (
                                <ul className="flex flex-col gap-3 pb-2">
                                    {tbmList.map((row) => {
                                        const statusChip = getTbmListStatusChip(
                                            row,
                                            currentUserId,
                                            userPermissions.isAdmin,
                                            userPermissions.isStaff
                                        );
                                        const dateText = row.tbm_date ? String(row.tbm_date).replace(/-/g, ".") + "." : "-";
                                        const hasLine = Boolean(row.line_name);
                                        return (
                                            <li key={row.id}>
                                                <div
                                                    className="rounded-xl border border-gray-200 bg-white p-4 active:bg-gray-50 transition-colors flex items-start gap-3"
                                                    role="button"
                                                    tabIndex={0}
                                                    onClick={() => navigateToTbmDetail(row.id)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === "Enter" || e.key === " ") {
                                                            e.preventDefault();
                                                            navigateToTbmDetail(row.id);
                                                        }
                                                    }}
                                                >
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            {/* 진행 상태 배지 → 제목 바로 앞 (staff는 본인 작성·참여 건만) */}
                                                            {statusChip ? (
                                                                <Chip
                                                                    color={statusChip.color}
                                                                    variant="solid"
                                                                    size="sm"
                                                                >
                                                                    {statusChip.label}
                                                                </Chip>
                                                            ) : null}
                                                            {/* 제목: 출장보고서 목록과 동일하게 폰트 크기 줄이고 두 줄까지 표시 */}
                                                            <span className="text-[13px] md:text-[16px] font-semibold text-gray-900 line-clamp-2 break-words">
                                                                {row.work_name || "-"}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-2 mt-1.5 text-[13px] text-gray-500">
                                                            <span>{hasLine ? `호선 ${row.line_name}` : dateText}</span>
                                                            <span aria-hidden>·</span>
                                                            <span className="truncate">{row.location || "-"}</span>
                                                        </div>
                                                        {hasLine && (
                                                            <div className="text-[12px] text-gray-400 mt-1">{dateText}</div>
                                                        )}
                                                    </div>
                                                    <button
                                                        type="button"
                                                        className="rounded-lg hover:bg-gray-100 text-gray-500 -mr-1 shrink-0"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setOpenMenuId(openMenuId === row.id ? null : row.id);
                                                            setMenuAnchor(openMenuId === row.id ? null : e.currentTarget);
                                                        }}
                                                        aria-label="메뉴"
                                                    >
                                                        <IconMore className="w-6 h-6" />
                                                    </button>
                                                </div>
                                                <ActionMenu
                                                    isOpen={openMenuId === row.id}
                                                    anchorEl={menuAnchor}
                                                    onClose={() => {
                                                        setOpenMenuId(null);
                                                        setMenuAnchor(null);
                                                    }}
                                                    onEdit={() => navigate(`/tbm/create?edit=${row.id}`)}
                                                    onPdf={() => handleDownloadPdf(row.id)}
                                                    pdfLabel="PDF 저장"
                                                    onDelete={() => handleDeleteTbm(row.id)}
                                                    showPdf
                                                    showDelete
                                                    showLogout={false}
                                                    width="w-44"
                                                />
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4">
                            <div className="bg-white p-0">
                                <div className="flex gap-3 items-center">
                                    <Input
                                        value={search}
                                        onChange={setSearch}
                                        placeholder="검색어를 입력해 주세요"
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
                                        className="min-w-[300px] flex-1"
                                    />
                                    <Button
                                        type="button"
                                        variant={inProgressOnly ? "primary" : "outline"}
                                        size="md"
                                        className="shrink-0"
                                        aria-pressed={inProgressOnly}
                                        onClick={() => {
                                            setInProgressOnly((v) => !v);
                                            setCurrentPage(1);
                                        }}
                                    >
                                        진행중인 TBM
                                    </Button>
                                    <YearMonthSelector
                                        className="shrink-0"
                                        year={year}
                                        month={month}
                                        onYearChange={(val) => {
                                            setYear(val);
                                            setCurrentPage(1);
                                        }}
                                        onMonthChange={(val) => {
                                            setMonth(val);
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
                                </div>
                            </div>

                            <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
                                <Table
                                    className="text-[14px] min-w-[600px]"
                                    columns={[
                                        {
                                            key: "tbm_date",
                                            label: "TBM 일시",
                                            width: "110px",
                                            render: (value) =>
                                                value
                                                    ? String(value).replace(/-/g, ".") + "."
                                                    : "-",
                                        },
                                        { key: "line_name", label: "호선명", width: "150px" },
                                        { key: "work_name", label: "작업명" },
                                        { key: "location", label: "장소", width: "150px" },
                                        {
                                            key: "created_by_name",
                                            label: "작성자",
                                            width: "90px",
                                        },
                                        {
                                            key: "status",
                                            label: "상태",
                                            width: "100px",
                                            align: "center",
                                            render: (_, row: TbmListItem) => {
                                                const statusChip = getTbmListStatusChip(
                                                    row,
                                                    currentUserId,
                                                    userPermissions.isAdmin,
                                                    userPermissions.isStaff
                                                );
                                                if (!statusChip) {
                                                    return null;
                                                }
                                                return (
                                                    <Chip
                                                        color={statusChip.color}
                                                        variant="solid"
                                                        size="md"
                                                    >
                                                        {statusChip.label}
                                                    </Chip>
                                                );
                                            },
                                        },
                                        {
                                            key: "actions",
                                            label: "",
                                            width: "60px",
                                            align: "right",
                                            render: (_, row: TbmListItem) => (
                                                <div className="relative inline-flex">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setOpenMenuId(
                                                                openMenuId === row.id
                                                                    ? null
                                                                    : row.id
                                                            );
                                                            setMenuAnchor(
                                                                openMenuId === row.id
                                                                    ? null
                                                                    : e.currentTarget
                                                            );
                                                        }}
                                                        className="p-2 rounded hover:bg-gray-100 text-gray-600"
                                                        aria-label="메뉴"
                                                    >
                                                        <IconMore className="w-[18px] h-[18px]" />
                                                    </button>

                                                    <div
                                                        onMouseDown={(e) =>
                                                            e.stopPropagation()
                                                        }
                                                        onClick={(e) =>
                                                            e.stopPropagation()
                                                        }
                                                    >
                                                        <ActionMenu
                                                            isOpen={
                                                                openMenuId === row.id
                                                            }
                                                            anchorEl={menuAnchor}
                                                            onClose={() => {
                                                                setOpenMenuId(null);
                                                                setMenuAnchor(null);
                                                            }}
                                                            onEdit={() => navigate(`/tbm/create?edit=${row.id}`)}
                                                            onPdf={() => handleDownloadPdf(row.id)}
                                                            pdfLabel="PDF 저장"
                                                            onDelete={() => handleDeleteTbm(row.id)}
                                                            showPdf
                                                            showDelete
                                                            showLogout={false}
                                                            width="w-44"
                                                        />
                                                    </div>
                                                </div>
                                            ),
                                        },
                                    ]}
                                    data={tbmList}
                                    rowKey="id"
                                    emptyText={"결과가 없습니다."}
                                    onRowClick={(row: TbmListItem) => navigateToTbmDetail(row.id)}
                                    pagination={{
                                        currentPage,
                                        totalPages,
                                        onPageChange: setCurrentPage,
                                    }}
                                />
                            </div>
                        </div>
                    )}
                </div>

                {isMobile && (
                    <div className="fixed bottom-6 right-4 z-10 lg:hidden">
                        <Button
                            variant="primary"
                            size="lg"
                            onClick={() => navigate("/tbm/create")}
                            icon={<IconPlus />}
                            className="shadow-lg rounded-full h-14 px-5"
                        >
                            TBM 작성
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
