// src/pages/Report/ReportListPage.tsx
import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/common/Header";
import Table from "../../components/common/Table";
import Tabs from "../../components/common/Tabs";
import Input from "../../components/common/Input";
import YearMonthSelector from "../../components/common/YearMonthSelector";
import Button from "../../components/common/Button";
import ActionMenu from "../../components/common/ActionMenu";
import Chip from "../../components/ui/Chip";
import ReportListSkeleton from "../../components/common/skeletons/ReportListSkeleton";
import { IconMore, IconMoreVertical, IconPlus, IconReport } from "../../components/icons/Icons";
import { deleteWorkLog } from "../../lib/workLogApi";
import {
    fetchReportList,
    parseReportListMonth,
    parseReportListYear,
    type ReportListItem,
    type ReportListStatus,
} from "../../lib/reportListApi";
import { useToast } from "../../components/ui/ToastProvider";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import Avatar from "../../components/common/Avatar";
import { supabase } from "../../lib/supabase";
import useIsMobile from "../../hooks/useIsMobile";

type ReportItem = ReportListItem;

const DEFAULT_YEAR = "년도 전체";
const DEFAULT_MONTH = "월 전체";
const DEFAULT_TAB = "work";
const ITEMS_PER_PAGE = 10;
const SEARCH_DEBOUNCE_MS = 500;

const parsePage = (value: string | null) => {
    const page = Number.parseInt(value || "", 10);
    return Number.isNaN(page) || page < 1 ? 1 : page;
};

export default function ReportListPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams, setSearchParams] = useSearchParams();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [search, setSearch] = useState(() => searchParams.get("search") ?? "");
    const [year, setYear] = useState(() => searchParams.get("year") || DEFAULT_YEAR);
    const [month, setMonth] = useState(() => searchParams.get("month") || DEFAULT_MONTH);
    const [openMenuId, setOpenMenuId] = useState<number | null>(null);
    const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
    const [currentPage, setCurrentPage] = useState(() => parsePage(searchParams.get("page")));
    const [debouncedSearch, setDebouncedSearch] = useState(() => searchParams.get("search") ?? "");
    const [reports, setReports] = useState<ReportItem[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [isStaffRole, setIsStaffRole] = useState(false);
    const [currentUserName, setCurrentUserName] = useState<string | null>(null);
    const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [loading, setLoading] = useState(true);
    // ✅ 탭 상태 추가 ("work" | "education")
    const [activeTab, setActiveTab] = useState<"work" | "education">(
        () => (searchParams.get("tab") === "education" ? "education" : "work")
    );

    const { showSuccess, showError } = useToast();
    const safetyToastOnceRef = useRef(false);
    const isFirstSearchDebounceRef = useRef(true);
    const isMobile = useIsMobile();
    const itemsPerPage = ITEMS_PER_PAGE;

    const navigateToReportView = (row: ReportItem) => {
        navigate(`/report/${row.id}`, {
            state: {
                isDraft: row.status === "pending",
                from: {
                    pathname: location.pathname,
                    search: location.search,
                },
            },
        });
    };

    // ✅ 안전문구/슬로건 토스트 (세션당 1회)
    useEffect(() => {
        if (safetyToastOnceRef.current) return;
        safetyToastOnceRef.current = true;

        // ✅ pending이 없으면 절대 안 띄움
        if (sessionStorage.getItem("rtb:safety_toast_pending") !== "1") return;

        const run = async () => {
            try {
                // ✅ 여기서 바로 소비
                sessionStorage.setItem("rtb:safety_toast_pending", "0");

                const { data: settings } = await supabase
                    .from("safe_settings")
                    .select("safe_phrase, slogan_path")
                    .eq("id", 1)
                    .single();

                if (settings?.slogan_path) {
                    const { data: signed } = await supabase.storage
                        .from("safe-slogans")
                        .createSignedUrl(settings.slogan_path, 60 * 60);

                    if (signed?.signedUrl) {
                        showSuccess({
                            message: "",
                            hideIcon: true,
                            imageUrl: signed.signedUrl,
                            imageAlt: "안전 슬로건",
                            duration: 6000,
                        });
                    }
                }

                showSuccess({
                    message: settings?.safe_phrase?.trim()
                        ? settings.safe_phrase
                        : "등록된 안전 문구가 없습니다.",
                    duration: 6000,
                });
            } catch (e) {
                console.error(e);
            }
        };

        run();
    }, [showSuccess]);


    const isRowOwner = (row: ReportItem) => {
        // 모든 가능한 조건을 확인하여 하나라도 일치하면 true 반환
        if (currentUserId && row.ownerId) {
            if (row.ownerId === currentUserId) return true;
        }
        if (currentUserEmail && row.ownerEmail) {
            if (
                row.ownerEmail.trim().toLowerCase() ===
                currentUserEmail.trim().toLowerCase()
            ) {
                return true;
            }
        }
        if (currentUserName && row.owner) {
            if (
                row.owner.trim().toLowerCase() === currentUserName.trim().toLowerCase()
            ) {
                return true;
            }
        }
        return false;
    };




    useEffect(() => {
        const loadCurrentUser = async () => {
            try {
                const { data: authData } = await supabase.auth.getUser();
                const user = authData?.user;
                setCurrentUserId(user?.id ?? null);
                setCurrentUserEmail(user?.email ?? null);

                if (!user) return;

                const { data: myProfile, error: myProfileError } = await supabase
                    .from("profiles")
                    .select("role, name")
                    .eq("id", user.id)
                    .single();

                if (myProfileError) {
                    console.error("내 프로필 조회 실패:", myProfileError);
                    return;
                }

                setIsStaffRole(myProfile?.role === "staff");
                setCurrentUserName(myProfile?.name?.trim() || null);
            } catch (e) {
                console.error("현재 사용자 조회 중 오류:", e);
            }
        };

        loadCurrentUser();
    }, []);

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
                search: debouncedSearch,
                year: parseReportListYear(year),
                month: parseReportListMonth(month),
                tab: activeTab,
            });
            setReports(result.items);
            setTotalCount(result.totalCount);
        } catch (error) {
            console.error("Error loading reports:", error);
            showError("보고서 목록을 불러오는 중 오류가 발생했습니다.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadReports();
    }, [currentPage, itemsPerPage, debouncedSearch, year, month, activeTab]);

    const isFilterActive = year !== DEFAULT_YEAR || month !== DEFAULT_MONTH;
    const hasActiveQuery =
        isFilterActive || debouncedSearch.trim() !== "" || activeTab === "education";
    const totalPages = Math.ceil(totalCount / itemsPerPage);

    const handleResetFilter = () => {
        setSearch("");
        setDebouncedSearch("");
        setYear(DEFAULT_YEAR);
        setMonth(DEFAULT_MONTH);
        setCurrentPage(1);
    };

    useEffect(() => {
        const nextParams = new URLSearchParams();

        if (search) nextParams.set("search", search);
        if (year !== DEFAULT_YEAR) nextParams.set("year", year);
        if (month !== DEFAULT_MONTH) nextParams.set("month", month);
        if (activeTab !== DEFAULT_TAB) nextParams.set("tab", activeTab);
        if (currentPage > 1) nextParams.set("page", String(currentPage));

        const nextQuery = nextParams.toString();
        const currentQuery = searchParams.toString();
        if (nextQuery !== currentQuery) {
            setSearchParams(nextParams, { replace: true });
        }
    }, [search, year, month, activeTab, currentPage, searchParams, setSearchParams]);

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
                    title="보고서 목록"
                    onMenuClick={() => setSidebarOpen(true)}
                    bottomContent={
                        <div className="px-4 md:px-6">
                            <Tabs
                                items={[
                                    { value: "work", label: "출장 보고서" },
                                    { value: "education", label: "교육 보고서" },
                                ]}
                                value={activeTab}
                                onChange={(value) => {
                                    setActiveTab(value as "work" | "education");
                                    setCurrentPage(1);
                                }}
                            />
                        </div>
                    }
                    rightContent={
                        !isMobile ? (
                            <Button
                                variant="primary"
                                size="lg"
                                onClick={() => navigate("/reportcreate")}
                                icon={<IconPlus />}
                            >
                                새 보고서 작성
                            </Button>
                        ) : undefined
                    }
                />

                <div className="flex-1 overflow-y-auto px-4 md:px-6 lg:px-12 pt-4 md:pt-6 pb-24 relative">
                    {isMobile ? (
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
                                <div className="flex items-center gap-2">
                                    <YearMonthSelector
                                        className="flex-1 min-w-0"
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
                                    {isFilterActive && (
                                        <button
                                            onClick={handleResetFilter}
                                            className="h-12 w-12 flex items-center justify-center border border-gray-200 rounded-xl bg-white hover:bg-gray-50 text-gray-600 shrink-0"
                                            aria-label="필터 초기화"
                                        >
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                                                <path d="M21 3v5h-5" />
                                                <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                                                <path d="M3 21v-5h5" />
                                            </svg>
                                        </button>
                                    )}
                                </div>
                            </div>
                            {loading ? (
                                <div className="flex flex-col items-center justify-center py-20 gap-4">
                                    <div className="w-10 h-10 border-2 border-gray-200 border-t-primary-500 rounded-full animate-spin" />
                                    <p className="text-sm text-gray-500">로딩 중...</p>
                                </div>
                            ) : totalCount === 0 ? (
                                <div className="py-10 text-center text-gray-500 text-sm flex flex-col items-center gap-3">
                                    <span>
                                        {hasActiveQuery
                                            ? "선택한 조건에 맞는 보고서가 없습니다."
                                            : "조회된 보고서가 없습니다."}
                                    </span>
                                    {hasActiveQuery && (
                                        <Button variant="outline" size="sm" onClick={handleResetFilter}>
                                            필터 초기화
                                        </Button>
                                    )}
                                </div>
                            ) : (
                                <ul className="flex flex-col gap-3 pb-2">
                                    {reports.map((row) => {
                                        const statusConfig: Record<ReportListStatus, { color: string; label: string }> = {
                                            submitted: { color: "blue-500", label: "제출 완료" },
                                            pending: { color: "green-600", label: "임시저장" },
                                            not_submitted: { color: "gray-400", label: "미제출" },
                                        };
                                        const { color, label } = statusConfig[row.status];
                                        const isOwner = isRowOwner(row);
                                        const canManageRow = !(isStaffRole && !isOwner);
                                        return (
                                            <li key={row.id}>
                                                <div
                                                    className="rounded-xl border border-gray-200 bg-white p-4 active:bg-gray-50 transition-colors flex items-start gap-3"
                                                    role="button"
                                                    tabIndex={0}
                                                    onClick={() => navigateToReportView(row)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === "Enter" || e.key === " ") {
                                                            e.preventDefault();
                                                            navigateToReportView(row);
                                                        }
                                                    }}
                                                >
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className="text-[13px] md:text-[16px] font-semibold text-gray-900 line-clamp-2 break-words">
                                                                {row.title || "—"}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-2 mt-1.5 text-[13px] text-gray-500">
                                                            <span>{row.date}</span>
                                                            {row.place?.trim() && (
                                                                <>
                                                                    <span aria-hidden>·</span>
                                                                    <span className="truncate">{row.place}</span>
                                                                </>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                                                            <Avatar
                                                                email={row.ownerEmail ?? null}
                                                                position={row.ownerPosition ?? null}
                                                                size={20}
                                                            />
                                                            <span className="text-[13px] text-gray-600">{row.owner}</span>
                                                            <Chip color={color} variant="solid" size="sm">
                                                                {label}
                                                            </Chip>
                                                        </div>
                                                    </div>
                                                    {canManageRow && (

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
                                                        <IconMoreVertical className="w-6 h-6" />
                                                    </button>

                                                    )}
                                                </div>
                                                {canManageRow && (

                                            <ActionMenu
                                                    isOpen={openMenuId === row.id}
                                                    anchorEl={menuAnchor}
                                                    onClose={() => {
                                                        setOpenMenuId(null);
                                                        setMenuAnchor(null);
                                                    }}
                                                    onEdit={() => navigate(`/report/${row.id}/edit`)}
                                                    onDelete={() => {
                                                        setDeleteTargetId(row.id);
                                                        setDeleteConfirmOpen(true);
                                                    }}
                                                    onDownload={() => {
                                                        const url = `/report/pdf?id=${row.id}&autoPrint=1`;
                                                        window.open(url, "report_pdf_window", [
                                                            "width=980",
                                                            "height=820",
                                                            "left=120",
                                                            "top=60",
                                                            "scrollbars=yes",
                                                            "resizable=yes",
                                                            "toolbar=yes",
                                                            "menubar=yes",
                                                            "location=yes",
                                                            "status=no",
                                                            "noopener=yes",
                                                            "noreferrer=yes",
                                                        ].join(","));
                                                    }}
                                                    width="w-44"
                                                >
                                                    <button
                                                        className="w-full px-3 py-2.5 text-left text-[15px] hover:bg-gray-50 active:bg-gray-100 text-gray-800 flex items-center gap-3 rounded-lg transition-colors cursor-pointer"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            navigateToReportView(row);
                                                        }}
                                                    >
                                                        <div className="w-5 flex justify-center text-gray-500">
                                                            <IconReport />
                                                        </div>
                                                        보고서 보기
                                                    </button>
                                                </ActionMenu>

                                            )}
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4">
                            <div className="mt-3">
                                <div className="flex flex-wrap items-center gap-3 justify-between">
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
                                        className="flex-1 min-w-[300px]"
                                    />
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
                                        {isFilterActive && (
                                            <button
                                                onClick={handleResetFilter}
                                                className="h-12 w-12 flex items-center justify-center border border-gray-200 rounded-xl bg-white hover:bg-gray-50 text-gray-600 hover:text-gray-900 transition-colors"
                                                aria-label="필터 초기화"
                                            >
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                                                    <path d="M21 3v5h-5" />
                                                    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                                                    <path d="M3 21v-5h5" />
                                                </svg>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {loading ? (
                                <ReportListSkeleton />
                            ) : (
                            <Table
                                className="text-[14px]"
                                emptyText="조회된 보고서가 없습니다."
                                columns={[
                                    {
                                        key: "owner",
                                        label: "작성자",
                                        width: "12%",
                                        render: (_, row: ReportItem) => {
                                            return (
                                                <div className="flex items-center gap-2">
                                                    <Avatar
                                                        email={
                                                            row.ownerEmail ||
                                                            null
                                                        }
                                                        size={24}
                                                        position={
                                                            row.ownerPosition ||
                                                            null
                                                        }
                                                    />
                                                    <span className="text-gray-900">
                                                        {row.owner}
                                                    </span>
                                                </div>
                                            );
                                        },
                                    },
                                    {
                                        key: "title",
                                        label: "제목",
                                        width: "36%",
                                    },
                                    {
                                        key: "place",
                                        label: "출장지",
                                        width: "12%",
                                        render: (value) => {
                                            if (
                                                value &&
                                                value.trim() &&
                                                value !== "—"
                                            ) {
                                                return (
                                                    <span className="text-gray-600">
                                                        {value}
                                                    </span>
                                                );
                                            }
                                            return "";
                                        },
                                    },
                                    {
                                        key: "supervisor",
                                        label: "참관감독",
                                        width: "12%",
                                        render: (value) => {
                                            if (
                                                value &&
                                                value.trim() &&
                                                value !== "—"
                                            ) {
                                                return (
                                                    <span className="text-gray-500">
                                                        {value}
                                                    </span>
                                                );
                                            }
                                            return "";
                                        },
                                    },
                                    {
                                        key: "date",
                                        label: "작성일",
                                        width: "12%",
                                        render: (value) => (
                                            <span className="text-gray-600">
                                                {value}
                                            </span>
                                        ),
                                    },
                                    {
                                        key: "status",
                                        label: "상태",
                                        width: "10%",
                                        render: (_, row: ReportItem) => {
                                            const statusConfig: Record<
                                                ReportListStatus,
                                                { color: string; label: string }
                                            > = {
                                                submitted: {
                                                    color: "blue-500",
                                                    label: "제출 완료",
                                                },
                                                pending: {
                                                    color: "green-600",
                                                    label: "임시저장",
                                                },
                                                not_submitted: {
                                                    color: "gray-400",
                                                    label: "미제출",
                                                },
                                            };

                                            const { color, label } =
                                                statusConfig[row.status];

                                            return (
                                                <Chip
                                                    color={color}
                                                    variant="solid"
                                                    size="md"
                                                >
                                                    {label}
                                                </Chip>
                                            );
                                        },
                                    },
                                    {
                                        key: "actions",
                                        label: "",
                                        width: "12%",
                                        align: "right",
                                        showEmptyIndicator: false,
                                        render: (_, row: ReportItem) => {
                                        const isOwner = isRowOwner(row);
                                        const canManageRow = !(isStaffRole && !isOwner);
                                        if (!canManageRow) {
                                            return null;
                                        }
                                        return (
                                            <div className="relative inline-flex">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setOpenMenuId(openMenuId === row.id ? null : row.id);
                                                        setMenuAnchor(openMenuId === row.id ? null : e.currentTarget);
                                                    }}
                                                    className="p-2 rounded hover:bg-gray-100 text-gray-600"
                                                    aria-label="행 메뉴"
                                                >
                                                    <IconMore className="w-[18px] h-[18px]" />
                                                </button>

                                                {/* ✅ ActionMenu 영역 클릭 시 row 클릭으로 버블링 방지 */}
                                                <div
                                                    onMouseDown={(e) => e.stopPropagation()}
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <ActionMenu
                                                        isOpen={openMenuId === row.id}
                                                        anchorEl={menuAnchor}
                                                        onClose={() => {
                                                            setOpenMenuId(null);
                                                            setMenuAnchor(null);
                                                        }}
                                                        onEdit={() => {
                                                            navigate(`/report/${row.id}/edit`);
                                                        }}
                                                        onDelete={() => {
                                                            setDeleteTargetId(row.id);
                                                            setDeleteConfirmOpen(true);
                                                        }}
                                                        onDownload={() => {
                                                            const url = `/report/pdf?id=${row.id}&autoPrint=1`;
                                                            window.open(url, "report_pdf_window", [
                                                                "width=980",
                                                                "height=820",
                                                                "left=120",
                                                                "top=60",
                                                                "scrollbars=yes",
                                                                "resizable=yes",
                                                                "toolbar=yes",
                                                                "menubar=yes",
                                                                "location=yes",
                                                                "status=no",
                                                                "noopener=yes",
                                                                "noreferrer=yes",
                                                            ].join(","));
                                                        }}
                                                        width="w-44"
                                                    >
                                                        {/* ✅ (제일 위) 보고서 보기 */}
                                                        <button
                                                            className="w-full px-3 py-2.5 text-left text-[15px] hover:bg-gray-50 active:bg-gray-100 text-gray-800 flex items-center gap-3 rounded-lg transition-colors cursor-pointer"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                navigateToReportView(row);
                                                            }}
                                                        >
                                                            <div className="w-5 flex justify-center text-gray-500">
                                                                <IconReport />
                                                            </div>
                                                            보고서 보기
                                                        </button>
                                                    </ActionMenu>
                                                </div>
                                            </div>
                                        );
                                        },

                                    },
                                ]}
                                data={reports}
                                rowKey="id"
                                onRowClick={(row: ReportItem) => {
                                    navigateToReportView(row);
                                }}
                                pagination={{
                                    currentPage,
                                    totalPages,
                                    onPageChange: setCurrentPage,
                                }}
                            />
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* 모바일 전용 FAB: 새 보고서 작성 */}
            {isMobile && (
                <div className="fixed bottom-6 right-4 z-10">
                    <Button
                        variant="primary"
                        size="lg"
                        onClick={() => navigate("/reportcreate")}
                        icon={<IconPlus />}
                        className="shadow-lg rounded-full h-14 px-5"
                    >
                        새 보고서 작성
                    </Button>
                </div>
            )}

            {/* 삭제 확인 다이얼로그 */}
            <ConfirmDialog
                isOpen={deleteConfirmOpen}
                onClose={() => {
                    setDeleteConfirmOpen(false);
                    setDeleteTargetId(null);
                }}
                onConfirm={async () => {
                    if (!deleteTargetId) return;
                    setIsDeleting(true);
                    try {
                        await deleteWorkLog(deleteTargetId);
                        await loadReports();
                        showSuccess("삭제되었습니다.");
                        setDeleteConfirmOpen(false);
                        setDeleteTargetId(null);
                    } catch (error: any) {
                        console.error("Error deleting report:", error);
                        showError(
                            `삭제 실패: ${error.message ||
                            "알 수 없는 오류가 발생했습니다."
                            }`
                        );
                    } finally {
                        setIsDeleting(false);
                    }
                }}
                title="삭제 확인"
                message="정말 삭제하시겠습니까?"
                confirmText="삭제"
                cancelText="취소"
                confirmVariant="danger"
                isLoading={isDeleting}
            />
        </div>
    );
}
