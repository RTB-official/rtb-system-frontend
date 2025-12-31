import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/common/Header";
import Table from "../../components/common/Table";

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
    submitted: "제출완료",
    pending: "임시저장",
    not_submitted: "미제출",
};

const STATUS_COLOR: Record<
    ReportStatus,
    { dot: string; bg: string; text: string; border: string }
> = {
    submitted: {
        dot: "bg-blue-500",
        bg: "bg-blue-50",
        text: "text-blue-700",
        border: "border-blue-100",
    },
    pending: {
        dot: "bg-emerald-500",
        bg: "bg-emerald-50",
        text: "text-emerald-700",
        border: "border-emerald-100",
    },
    not_submitted: {
        dot: "bg-gray-300",
        bg: "bg-gray-50",
        text: "text-gray-600",
        border: "border-gray-100",
    },
};

const MOCK_REPORTS: ReportItem[] = [
    {
        id: 1,
        title: "11월13일 K-2010A3 cylinder overhaul후 시운전",
        place: "S-OIL 온산",
        supervisor: "—",
        owner: "강민지",
        date: "2025.11.26",
        status: "pending",
    },
    {
        id: 2,
        title: "11월13일 K-2010A3 cylinder overhaul후 시운전",
        place: "S-OIL 온산",
        supervisor: "—",
        owner: "강민지",
        date: "2025.11.25",
        status: "submitted",
    },
    {
        id: 3,
        title: "11월13일 K-2010A3 cylinder overhaul후 시운전",
        place: "S-OIL 온산",
        supervisor: "—",
        owner: "강민지",
        date: "2025.11.24",
        status: "submitted",
    },
    {
        id: 4,
        title: "11월13일 K-2010A3 cylinder overhaul후 시운전",
        place: "S-OIL 온산",
        supervisor: "—",
        owner: "강민지",
        date: "2025.11.24",
        status: "pending",
    },
    {
        id: 5,
        title: "11월13일 K-2010A3 cylinder overhaul후 시운전",
        place: "S-OIL 온산",
        supervisor: "—",
        owner: "강민지",
        date: "2025.11.24",
        status: "submitted",
    },
    {
        id: 6,
        title: "11월13일 K-2010A3 cylinder overhaul후 시운전",
        place: "S-OIL 온산",
        supervisor: "—",
        owner: "강민지",
        date: "2025.11.24",
        status: "submitted",
    },
    {
        id: 7,
        title: "11월13일 K-2010A3 cylinder overhaul후 시운전",
        place: "S-OIL 온산",
        supervisor: "—",
        owner: "강민지",
        date: "2025.11.24",
        status: "submitted",
    },
    {
        id: 8,
        title: "11월13일 K-2010A3 cylinder overhaul후 시운전",
        place: "S-OIL 온산",
        supervisor: "—",
        owner: "강민지",
        date: "2025.11.24",
        status: "submitted",
    },
    {
        id: 9,
        title: "11월13일 K-2010A3 cylinder overhaul후 시운전",
        place: "S-OIL 온산",
        supervisor: "—",
        owner: "강민지",
        date: "2025.11.24",
        status: "submitted",
    },
    {
        id: 10,
        title: "11월13일 K-2010A3 cylinder overhaul후 시운전",
        place: "S-OIL 온산",
        supervisor: "—",
        owner: "강민지",
        date: "2025.11.24",
        status: "submitted",
    },
    {
        id: 11,
        title: "11월13일 K-2010A3 cylinder overhaul후 시운전",
        place: "S-OIL 온산",
        supervisor: "—",
        owner: "강민지",
        date: "2025.11.24",
        status: "submitted",
    },
    {
        id: 12,
        title: "11월26일~11월27일 SH8218 Replacement of guide tool for LGI Connector Pipe, Installation of blow off Valves Leakage test",
        place: "S-OIL 온산",
        supervisor: "—",
        owner: "강민지",
        date: "2025.11.24",
        status: "submitted",
    },
];

export default function ReportListPage() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [year, setYear] = useState("2025년");
    const [month, setMonth] = useState("11월");
    const [openMenuId, setOpenMenuId] = useState<number | null>(null);
    const navigate = useNavigate();

    const filtered = useMemo(() => {
        return MOCK_REPORTS.filter((r) => {
            const matchSearch =
                r.title.includes(search) ||
                r.owner.includes(search) ||
                r.place.includes(search);
            return matchSearch;
        });
    }, [search]);

    useEffect(() => {
        const handleClickOutside = () => setOpenMenuId(null);
        document.addEventListener("click", handleClickOutside);
        return () => document.removeEventListener("click", handleClickOutside);
    }, []);

    return (
        <div className="flex h-screen bg-[#f4f5f7] overflow-hidden">
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-20 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            <div
                className={`fixed lg:static inset-y-0 left-0 z-30 w-[239px] h-screen flex-shrink-0 transform transition-transform duration-300 ease-in-out ${
                    sidebarOpen
                        ? "translate-x-0"
                        : "-translate-x-full lg:translate-x-0"
                }`}
            >
                <Sidebar
                    onClose={() => setSidebarOpen(false)}
                    activeMenu="출장 보고서"
                />
            </div>

            <div className="flex-1 flex flex-col h-screen overflow-hidden w-full">
                <Header
                    title="출장 보고서"
                    onMenuClick={() => setSidebarOpen(true)}
                    rightContent={
                        <button
                            onClick={() => navigate("/reportcreate")}
                            className="px-4 py-2 rounded-lg bg-[#364153] text-white text-sm font-medium hover:bg-[#2d3445] transition-colors"
                        >
                            새 보고서 작성
                        </button>
                    }
                />

                <div className="flex-1 overflow-y-auto px-4 lg:px-12 py-6">
                    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4 lg:p-6 flex flex-col gap-4">
                        <div className="flex flex-wrap items-center gap-3 justify-between">
                            <div className="relative w-full max-w-md flex-1 min-w-[220px]">
                                <input
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="검색어를 입력해 주세요"
                                    className="w-full rounded-lg border border-gray-200 px-3 py-2 pl-9 text-[12.5px] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                                />
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
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
                                </span>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap justify-end">
                                <select
                                    value={year}
                                    onChange={(e) => setYear(e.target.value)}
                                    className="rounded-lg border border-gray-200 px-3 py-2 text-[12.5px] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white min-w-[110px]"
                                >
                                    <option>2025년</option>
                                    <option>2026년</option>
                                </select>
                                <select
                                    value={month}
                                    onChange={(e) => setMonth(e.target.value)}
                                    className="rounded-lg border border-gray-200 px-3 py-2 text-[12.5px] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white min-w-[160px]"
                                >
                                    <option>1월</option>
                                    <option>2월</option>
                                    <option>3월</option>
                                    <option>4월</option>
                                    <option>5월</option>
                                    <option>6월</option>
                                    <option>7월</option>
                                    <option>8월</option>
                                    <option>9월</option>
                                    <option>10월</option>
                                    <option>11월</option>
                                    <option>12월</option>
                                </select>
                            </div>
                        </div>

                        <Table
                            className="text-[12.5px]"
                            columns={[
                                {
                                    key: "owner",
                                    label: "작성자",
                                    width: "96px",
                                    render: (_, row: ReportItem) => (
                                        <div className="flex items-center gap-2">
                                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-orange-100 text-[11px] text-orange-600 font-semibold">
                                                {row.owner.slice(0, 2)}
                                            </span>
                                            <span className="text-gray-900">
                                                {row.owner}
                                            </span>
                                        </div>
                                    ),
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
                                    label: "참감독",
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
                                        const colors =
                                            STATUS_COLOR[row.status] ??
                                            STATUS_COLOR.pending;
                                        return (
                                            <span
                                                className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[12px] font-semibold border ${colors.bg} ${colors.text} ${colors.border}`}
                                            >
                                                <span
                                                    className={`h-2 w-2 rounded-full ${colors.dot}`}
                                                />
                                                {STATUS_LABEL[row.status]}
                                            </span>
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
                                            {openMenuId === row.id && (
                                                <div
                                                    onClick={(e) =>
                                                        e.stopPropagation()
                                                    }
                                                    className="absolute right-0 mt-2 w-44 rounded-lg border border-gray-200 bg-white shadow-lg ring-1 ring-black/5 overflow-hidden z-10"
                                                >
                                                    <button className="w-full px-4 py-3 text-left text-[13px] hover:bg-gray-50 text-gray-800 flex items-center gap-3">
                                                        <svg
                                                            width="16"
                                                            height="16"
                                                            viewBox="0 0 24 24"
                                                            fill="none"
                                                            stroke="currentColor"
                                                            strokeWidth="1.5"
                                                        >
                                                            <path d="M4 21v-3.5L17.5 4.5a2 2 0 012.8 0l0 0a2 2 0 010 2.8L7.5 20.5H4z" />
                                                        </svg>
                                                        수정
                                                    </button>
                                                    <button className="w-full px-4 py-3 text-left text-[13px] hover:bg-gray-50 text-gray-800 flex items-center gap-3">
                                                        <svg
                                                            width="16"
                                                            height="16"
                                                            viewBox="0 0 24 24"
                                                            fill="none"
                                                            stroke="currentColor"
                                                            strokeWidth="1.5"
                                                        >
                                                            <path d="M3 6h18" />
                                                            <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                                                            <path d="M10 11v6M14 11v6" />
                                                            <path d="M9 6V4h6v2" />
                                                        </svg>
                                                        삭제
                                                    </button>
                                                    <button className="w-full px-4 py-3 text-left text-[13px] bg-gray-50 hover:bg-gray-100 text-gray-800 flex items-center gap-3">
                                                        <svg
                                                            width="16"
                                                            height="16"
                                                            viewBox="0 0 24 24"
                                                            fill="none"
                                                            stroke="currentColor"
                                                            strokeWidth="1.5"
                                                        >
                                                            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                                                            <path d="M7 10l5 5 5-5" />
                                                            <path d="M12 15V3" />
                                                        </svg>
                                                        PDF 다운로드
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ),
                                },
                            ]}
                            data={filtered}
                            rowKey="id"
                            emptyText="결과가 없습니다."
                        />

                        <div className="flex items-center justify-center gap-2 text-[12.5px] text-gray-600">
                            <button className="px-2 py-1 rounded hover:bg-gray-100">
                                &lt;
                            </button>
                            <div className="flex items-center gap-1">
                                <button className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 font-medium text-gray-800">
                                    1
                                </button>
                                <button className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">
                                    2
                                </button>
                                <button className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">
                                    3
                                </button>
                            </div>
                            <button className="px-2 py-1 rounded hover:bg-gray-100">
                                &gt;
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
