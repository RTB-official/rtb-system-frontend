import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/common/Header";
import Table from "../../components/common/Table";
import Input from "../../components/common/Input";
import YearMonthSelector from "../../components/common/YearMonthSelector";
import Button from "../../components/common/Button";
import ActionMenu from "../../components/common/ActionMenu";
import Chip from "../../components/ui/Chip";

type ReportStatus = "submitted" | "pending" | "not_submitted";

interface ReportItem {
    id: number;
    title: string;
    place: string;
    supervisor: string;
    owner: string;
    date: string;
    status: ReportStatus;
}

const STATUS_LABEL: Record<ReportStatus, string> = {
    submitted: "제출 완료",
    pending: "임시저장",
    not_submitted: "미제출",
};

const MOCK_REPORTS: ReportItem[] = [
    {
        id: 1,
        title: "11월13일 K-2010A3 cylinder overhaul후 시운전",
        place: "S-OIL 온산",
        supervisor: "—",
        owner: "MK 강민지",
        date: "2025.11.26.",
        status: "pending",
    },
    {
        id: 2,
        title: "11월13일 K-2010A3 cylinder overhaul후 시운전",
        place: "S-OIL 온산",
        supervisor: "—",
        owner: "MK 강민지",
        date: "2025.11.25.",
        status: "submitted",
    },
    {
        id: 3,
        title: "11월13일 K-2010A3 cylinder overhaul후 시운전",
        place: "S-OIL 온산",
        supervisor: "—",
        owner: "MK 강민지",
        date: "2025.11.24.",
        status: "submitted",
    },
    {
        id: 4,
        title: "11월13일 K-2010A3 cylinder overhaul후 시운전",
        place: "S-OIL 온산",
        supervisor: "—",
        owner: "MK 강민지",
        date: "2025.11.24.",
        status: "pending",
    },
    {
        id: 5,
        title: "11월13일 K-2010A3 cylinder overhaul후 시운전",
        place: "S-OIL 온산",
        supervisor: "—",
        owner: "MK 강민지",
        date: "2025.11.24.",
        status: "submitted",
    },
    {
        id: 6,
        title: "11월13일 K-2010A3 cylinder overhaul후 시운전",
        place: "S-OIL 온산",
        supervisor: "—",
        owner: "MK 강민지",
        date: "2025.11.24.",
        status: "submitted",
    },
    {
        id: 7,
        title: "11월13일 K-2010A3 cylinder overhaul후 시운전",
        place: "S-OIL 온산",
        supervisor: "—",
        owner: "MK 강민지",
        date: "2025.11.24.",
        status: "submitted",
    },
    {
        id: 8,
        title: "11월13일 K-2010A3 cylinder overhaul후 시운전",
        place: "S-OIL 온산",
        supervisor: "—",
        owner: "MK 강민지",
        date: "2025.11.24.",
        status: "submitted",
    },
    {
        id: 9,
        title: "11월13일 K-2010A3 cylinder overhaul후 시운전",
        place: "S-OIL 온산",
        supervisor: "—",
        owner: "MK 강민지",
        date: "2025.11.24.",
        status: "submitted",
    },
    {
        id: 10,
        title: "11월13일 K-2010A3 cylinder overhaul후 시운전",
        place: "S-OIL 온산",
        supervisor: "—",
        owner: "MK 강민지",
        date: "2025.11.24.",
        status: "submitted",
    },
    {
        id: 11,
        title: "11월13일 K-2010A3 cylinder overhaul후 시운전",
        place: "S-OIL 온산",
        supervisor: "—",
        owner: "MK 강민지",
        date: "2025.11.24.",
        status: "submitted",
    },
    {
        id: 12,
        title: "11월26일~11월27일 SH8218 Replacement of guide tool for LGI Connector Pipe, Installation of blow off Valves Leakage test",
        place: "S-OIL 온산",
        supervisor: "—",
        owner: "MK 강민지",
        date: "2025.11.24.",
        status: "submitted",
    },
];

export default function ReportListPage() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [year, setYear] = useState("년도 전체");
    const [month, setMonth] = useState("월 전체");
    const [openMenuId, setOpenMenuId] = useState<number | null>(null);
    const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    const navigate = useNavigate();

    const isFilterActive = year !== "년도 전체" || month !== "월 전체";

    const handleResetFilter = () => {
        setYear("년도 전체");
        setMonth("월 전체");
        setCurrentPage(1);
    };

    const filtered = useMemo(() => {
        return MOCK_REPORTS.filter((r) => {
            const matchSearch =
                r.title.includes(search) ||
                r.owner.includes(search) ||
                r.place.includes(search);

            // 년도 필터링 (날짜 형식: "2025.11.24.")
            const matchYear =
                year === "년도 전체" ||
                r.date.startsWith(year.replace("년", ""));

            // 월 필터링 (날짜 형식: "2025.11.24.")
            let matchMonth = true;
            if (month !== "월 전체") {
                const monthNum = month.replace("월", "");
                // "2025.11.24." 형식에서 월 추출 (두 번째 숫자)
                const dateParts = r.date.split(".");
                matchMonth = dateParts.length > 1 && dateParts[1] === monthNum;
            }

            return matchSearch && matchYear && matchMonth;
        });
    }, [search, year, month]);

    const totalPages = Math.ceil(filtered.length / itemsPerPage);
    const currentData = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        return filtered.slice(startIndex, endIndex);
    }, [filtered, currentPage, itemsPerPage]);

    return (
        <div className="flex h-screen bg-white overflow-hidden">
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-20 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            <div
                className={`fixed lg:static inset-y-0 left-0 z-30 w-[239px] h-screen shrink-0 transform transition-transform duration-300 ease-in-out ${
                    sidebarOpen
                        ? "translate-x-0"
                        : "-translate-x-full lg:translate-x-0"
                }`}
            >
                <Sidebar onClose={() => setSidebarOpen(false)} />
            </div>

            <div className="flex-1 flex flex-col h-screen overflow-hidden w-full">
                <Header
                    title="출장 보고서"
                    onMenuClick={() => setSidebarOpen(true)}
                    rightContent={
                        <Button
                            variant="primary"
                            size="md"
                            onClick={() => navigate("/reportcreate")}
                            icon={
                                <svg
                                    width="16"
                                    height="16"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    xmlns="http://www.w3.org/2000/svg"
                                >
                                    <path
                                        d="M12 5V19M5 12H19"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                    />
                                </svg>
                            }
                        >
                            새 보고서 작성
                        </Button>
                    }
                />

                <div className="flex-1 overflow-y-auto px-4 lg:px-12 pt-6 pb-24">
                    <div className="flex flex-col gap-4">
                        {/* 검색 및 필터 섹션 */}
                        <div className="bg-white border border-gray-200 rounded-2xl p-4 lg:p-6">
                            <div className="flex flex-wrap items-center gap-3 justify-between">
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
                                            <line
                                                x1="16.65"
                                                y1="16.65"
                                                x2="21"
                                                y2="21"
                                            />
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
                                            {
                                                value: "년도 전체",
                                                label: "년도 전체",
                                            },
                                            {
                                                value: "2025년",
                                                label: "2025년",
                                            },
                                            {
                                                value: "2026년",
                                                label: "2026년",
                                            },
                                        ]}
                                        monthOptions={[
                                            {
                                                value: "월 전체",
                                                label: "월 전체",
                                            },
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
                        </div>

                        {/* 테이블 섹션 */}
                        <Table
                            className="text-[14px]"
                            columns={[
                                {
                                    key: "owner",
                                    label: "작성자",
                                    width: "96px",
                                    render: (_, row: ReportItem) => {
                                        // "MK 강민지" 형식에서 "MK" 추출
                                        const initials =
                                            row.owner.split(" ")[0] ||
                                            row.owner.slice(0, 2);
                                        return (
                                            <div className="flex items-center gap-2">
                                                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-orange-100 text-[11px] text-orange-600 font-semibold">
                                                    {initials}
                                                </span>
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
                                    width: "45%",
                                },
                                {
                                    key: "place",
                                    label: "출장지",
                                    width: "112px",
                                    render: (value) => (
                                        <span className="text-gray-600">
                                            {value}
                                        </span>
                                    ),
                                },
                                {
                                    key: "supervisor",
                                    label: "참관감독",
                                    width: "96px",
                                    render: (value) => (
                                        <span className="text-gray-500">
                                            {value}
                                        </span>
                                    ),
                                },
                                {
                                    key: "date",
                                    label: "작성일",
                                    width: "112px",
                                    render: (value) => (
                                        <span className="text-gray-600">
                                            {value}
                                        </span>
                                    ),
                                },
                                {
                                    key: "status",
                                    label: "상태",
                                    width: "112px",
                                    render: (_, row: ReportItem) => {
                                        const statusVariantMap: Record<
                                            ReportStatus,
                                            | "submitted"
                                            | "pending"
                                            | "not_submitted"
                                        > = {
                                            submitted: "submitted",
                                            pending: "pending",
                                            not_submitted: "not_submitted",
                                        };
                                        return (
                                            <Chip
                                                variant={
                                                    statusVariantMap[row.status]
                                                }
                                                size="sm"
                                            >
                                                {STATUS_LABEL[row.status]}
                                            </Chip>
                                        );
                                    },
                                },
                                {
                                    key: "actions",
                                    label: "",
                                    width: "40px",
                                    align: "right",
                                    render: (_, row: ReportItem) => (
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
                                                aria-label="행 메뉴"
                                            >
                                                <svg
                                                    width="18"
                                                    height="18"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="2"
                                                >
                                                    <circle
                                                        cx="6"
                                                        cy="12"
                                                        r="1.3"
                                                    />
                                                    <circle
                                                        cx="12"
                                                        cy="12"
                                                        r="1.3"
                                                    />
                                                    <circle
                                                        cx="18"
                                                        cy="12"
                                                        r="1.3"
                                                    />
                                                </svg>
                                            </button>
                                            <ActionMenu
                                                isOpen={openMenuId === row.id}
                                                anchorEl={menuAnchor}
                                                onClose={() => {
                                                    setOpenMenuId(null);
                                                    setMenuAnchor(null);
                                                }}
                                                onEdit={() => {
                                                    console.log(
                                                        "수정:",
                                                        row.id
                                                    );
                                                    alert(`수정: ${row.id}`);
                                                }}
                                                onDelete={() => {
                                                    if (
                                                        confirm(
                                                            "정말 삭제하시겠습니까?"
                                                        )
                                                    ) {
                                                        console.log(
                                                            "삭제:",
                                                            row.id
                                                        );
                                                        alert(
                                                            `삭제 완료: ${row.id}`
                                                        );
                                                    }
                                                }}
                                                onDownload={() => {
                                                    console.log(
                                                        "PDF 다운로드:",
                                                        row.id
                                                    );
                                                    alert(
                                                        `PDF 다운로드: ${row.id}`
                                                    );
                                                }}
                                                width="w-44"
                                            />
                                        </div>
                                    ),
                                },
                            ]}
                            data={currentData}
                            rowKey="id"
                            emptyText="결과가 없습니다."
                            pagination={{
                                currentPage,
                                totalPages,
                                onPageChange: setCurrentPage,
                            }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
