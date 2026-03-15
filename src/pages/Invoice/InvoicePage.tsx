import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import PageContainer from "../../components/common/PageContainer";
import Header from "../../components/common/Header";
import Sidebar from "../../components/Sidebar";
import Table from "../../components/common/Table";
import Input from "../../components/common/Input";
import YearMonthSelector from "../../components/common/YearMonthSelector";
import Button from "../../components/common/Button";
import Avatar from "../../components/common/Avatar";
import Chip from "../../components/ui/Chip";
import { IconInvoice } from "../../components/icons/Icons";
import { useToast } from "../../components/ui/ToastProvider";
import { getWorkLogs, type WorkLog } from "../../lib/workLogApi";
import { supabase } from "../../lib/supabase";
import { PATHS } from "../../utils/paths";

type ReportStatus = "submitted" | "pending" | "not_submitted";

interface InvoiceReportItem {
    id: number;
    title: string;
    place: string;
    supervisor: string;
    owner: string;
    ownerEmail?: string | null;
    ownerPosition?: string | null;
    date: string;
    createdAt: string;
    status: ReportStatus;
}

function formatDate(dateString: string) {
    const d = new Date(dateString);
    if (Number.isNaN(d.getTime())) return "";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}.${m}.${day}.`;
}

// 기간 표기용 (한국어)
function formatKoreanDate(dateString: string) {
    const d = new Date(dateString);
    const month = d.getMonth() + 1;
    const day = d.getDate();
    return { month, day };
}

function formatKoreanPeriod(start?: string, end?: string) {
    if (!start && !end) return "";
    if (start && !end) {
        const s = formatKoreanDate(start);
        return `${s.month}월${s.day}일`;
    }
    if (!start && end) {
        const e = formatKoreanDate(end);
        return `${e.month}월${e.day}일`;
    }

    const s = formatKoreanDate(start as string);
    const e = formatKoreanDate(end as string);
    if (s.month === e.month) {
        if (s.day === e.day) return `${s.month}월${s.day}일`;
        return `${s.month}월${s.day}일~${e.day}일`;
    }
    return `${s.month}월${s.day}일~${e.month}월${e.day}일`;
}

export default function InvoicePage() {
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [year, setYear] = useState<string>("년도 전체");
    const [month, setMonth] = useState<string>("월 전체");
    const [reports, setReports] = useState<InvoiceReportItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 30;

    const { showError } = useToast();

    const loadReports = async () => {
        setLoading(true);
        try {
            const workLogs = await getWorkLogs();

            const baseItems: InvoiceReportItem[] = workLogs.map((w: WorkLog) => ({
                id: w.id,
                title: w.subject || "(제목 없음)",
                place: w.location || "",
                supervisor: w.order_person || "",
                owner: w.author || "(작성자 없음)",
                date: formatDate(w.created_at),
                createdAt: w.created_at,
                status: w.is_draft ? "pending" : "submitted",
            }));

            // WorkLog id 목록
            const workLogIds = workLogs.map((w) => w.id).filter(Boolean);

            // workLogId -> { start, end } 기간 맵 (entries.dateFrom/dateTo 기반)
            const periodMap = new Map<number, { start?: string; end?: string }>();

            // 작성자 이름 목록 수집
            const ownerNames = Array.from(
                new Set(baseItems.map((i) => i.owner).filter(Boolean))
            );
            let profileMap = new Map<
                string,
                { email: string | null; position: string | null }
            >();

            // entries와 profiles를 병렬로 조회
            if (workLogIds.length > 0) {
                const [entriesResult, profilesResult] = await Promise.allSettled([
                    supabase
                        .from("work_log_entries_with_hours")
                        .select("work_log_id, date_from, date_to")
                        .in("work_log_id", workLogIds),
                    ownerNames.length > 0
                        ? supabase
                            .from("profiles")
                            .select("name, email, position")
                            .in("name", ownerNames)
                        : Promise.resolve({ data: [], error: null }),
                ]);

                // entries 처리
                if (entriesResult.status === "fulfilled") {
                    const { data: entries, error: entriesError } = entriesResult.value;
                    if (entriesError) {
                        console.error("기간(entries) 조회 실패:", entriesError);
                    } else if (entries) {
                        entries.forEach((e: any) => {
                            const id = Number(e.work_log_id);
                            if (!id) return;

                            const s = e.date_from ? String(e.date_from) : "";
                            const t = e.date_to ? String(e.date_to) : "";

                            const prev = periodMap.get(id);

                            // start = 최소 dateFrom, end = 최대 dateTo
                            const nextStart =
                                !prev?.start || (s && s < prev.start) ? (s || prev?.start) : prev.start;
                            const nextEnd =
                                !prev?.end || (t && t > prev.end) ? (t || prev?.end) : prev.end;

                            periodMap.set(id, { start: nextStart, end: nextEnd });
                        });
                    }
                } else {
                    console.error("기간(entries) 조회 실패:", entriesResult.reason);
                }

                // profiles 처리
                if (profilesResult.status === "fulfilled") {
                    const { data: profiles, error: profilesError } = profilesResult.value;
                    if (profilesError) {
                        console.error("프로필 조회 실패:", profilesError);
                    } else if (profiles) {
                        profiles.forEach((profile: any) => {
                            profileMap.set(profile.name, {
                                email: profile.email || null,
                                position: profile.position || null,
                            });
                        });
                    }
                } else {
                    console.error("프로필 조회 실패:", profilesResult.reason);
                }
            }

            // 제목을 "기간 / 호선(vessel) / 출장목적(subject)"으로 재조합
            const reportsWithTitle = baseItems.map((item) => {
                const wl = workLogs.find((w) => w.id === item.id) as any;

                const vessel = wl?.vessel?.trim() ? wl.vessel.trim() : "";
                const purpose = wl?.subject?.trim() ? wl.subject.trim() : "";

                const p = periodMap.get(item.id);
                const period = formatKoreanPeriod(p?.start, p?.end);

                const parts = [period, vessel, purpose].filter(Boolean);
                const combinedTitle = parts.length ? parts.join(" ") : "(제목 없음)";

                return {
                    ...item,
                    title: combinedTitle,
                };
            });

            // 프로필 정보 추가
            const itemsWithProfile = reportsWithTitle.map((item) => {
                const profile = profileMap.get(item.owner);
                return {
                    ...item,
                    ownerEmail: profile?.email ?? null,
                    ownerPosition: profile?.position ?? null,
                };
            });

            setReports(itemsWithProfile);
        } catch (e) {
            console.error("인보이스용 보고서 목록 로드 실패:", e);
            showError("보고서 목록을 불러오는 중 오류가 발생했습니다.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadReports();
    }, []);

    const isFilterActive = year !== "년도 전체" || month !== "월 전체" || search.trim() !== "";

    const handleResetFilter = () => {
        setYear("년도 전체");
        setMonth("월 전체");
        setSearch("");
    };

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return reports.filter((r) => {
            const matchSearch =
                q === "" ||
                r.title.toLowerCase().includes(q) ||
                r.owner.toLowerCase().includes(q) ||
                r.place.toLowerCase().includes(q);

            if (!matchSearch) return false;

            if (year !== "년도 전체") {
                const y = Number(year.replace("년", ""));
                const d = new Date(r.createdAt);
                if (d.getFullYear() !== y) return false;
            }

            if (month !== "월 전체") {
                const m = Number(month.replace("월", ""));
                const d = new Date(r.createdAt);
                if (d.getMonth() + 1 !== m) return false;
            }

            return true;
        });
    }, [reports, search, year, month]);

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

    const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;

    const currentData = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        return filtered.slice(startIndex, endIndex);
    }, [filtered, currentPage, itemsPerPage]);

    return (
        <div className="flex h-screen bg-[#f9fafb] overflow-hidden">
            {/* Sidebar */}
            <div
                className={`fixed lg:static inset-y-0 left-0 z-30 w-[260px] max-w-[88vw] lg:max-w-none lg:w-[239px] h-screen shrink-0 transform transition-transform duration-300 ease-in-out ${
                    sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
                }`}
            >
                <Sidebar onClose={() => setSidebarOpen(false)} />
            </div>

            {/* Main */}
            <div className="flex-1 flex flex-col h-screen overflow-hidden w-full">
                <Header
                    title="인보이스"
                    onMenuClick={() => setSidebarOpen(true)}
                    rightContent={
                        hasSelection ? (
                            <Button
                                variant="primary"
                                size="lg"
                                icon={<IconInvoice />}
                                onClick={() => {
                                    navigate(PATHS.invoiceCreate);
                                }}
                            >
                                인보이스 생성
                            </Button>
                        ) : undefined
                    }
                />

                <PageContainer className="flex-1 overflow-y-auto pt-0 pb-24">
                    <div className="space-y-4">
                        {/* 검색 & 필터 (상단 고정) */}
                        <div className="flex flex-wrap items-center gap-3 justify-between sticky top-0 z-10 bg-white border-b border-gray-200 pb-4 pt-4 -mx-4 md:-mx-6 lg:-mx-9 px-4 md:px-6 lg:px-9">
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
                            <div className="flex items-center gap-2 flex-wrap justify-end">
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
                                {isFilterActive && (
                                    <button
                                        onClick={handleResetFilter}
                                        className="h-11 w-11 flex items-center justify-center border border-gray-200 rounded-xl bg-white hover:bg-gray-50 text-gray-600 hover:text-gray-900 transition-colors"
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

                        {/* 테이블 */}
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
                                                render: (_: any, row: InvoiceReportItem) => (
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
                                                    value?.trim ? (
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
                                    data={currentData}
                                    rowKey="id"
                                    rowClassName={(row: any) =>
                                        selectedIds.has(row.id)
                                            ? "!bg-blue-100 hover:!bg-blue-200"
                                            : ""
                                    }
                                    onRowClick={(row: InvoiceReportItem) => toggleSelect(row)}
                                    pagination={{
                                        currentPage,
                                        totalPages,
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
