//workloadDetailPage.tsx
import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/common/Header";
import Table from "../../components/common/Table";
import YearMonthSelector from "../../components/common/YearMonthSelector";
import WorkloadDetailSkeleton from "../../components/common/WorkloadDetailSkeleton";
import Pagination from "../../components/common/Pagination";
import { IconArrowBack, IconChevronRight } from "../../components/icons/Icons";
import useIsMobile from "../../hooks/useIsMobile";
import { useUser } from "../../hooks/useUser";
import { supabase } from "../../lib/supabase";
import {
    getWorkerWorkloadDetail,
    formatHours,
    formatDetailDate,
    formatTimeRange,
    type WorkloadDetailEntry,
} from "../../lib/workloadDetailApi";
const IconWork = () => (
    <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
    >
        <path
            d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z"
            fill="currentColor"
        />
    </svg>
);
const IconDriveEta = () => (
    <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
    >
        <path
            d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"
            fill="currentColor"
        />
    </svg>
);
const IconSchedule = () => (
    <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
    >
        <path
            d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"
            fill="currentColor"
        />
    </svg>
);

export default function WorkloadDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const isMobile = useIsMobile();

    // 오늘 날짜 기준으로 기본값 설정
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;
    
    const [selectedYear, setSelectedYear] = useState(`${currentYear}년`);
    const [selectedMonth, setSelectedMonth] = useState(`${currentMonth}월`);
    const [currentPage, setCurrentPage] = useState(1);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [loading, setLoading] = useState(true);

    // ✅ useUser 훅으로 권한 정보 가져오기

    const { userPermissions, currentUserId } = useUser();
    const isStaff = userPermissions.isStaff;
    const isAdmin = userPermissions.isAdmin;
    const isCEO = userPermissions.isCEO;
    const [summary, setSummary] = useState<{
        name: string;
        totalWork: number;
        totalTravel: number;
        totalWait: number;
    } | null>(null);
    const [detailEntries, setDetailEntries] = useState<WorkloadDetailEntry[]>([]);

    const itemsPerPage = 10;


    const personName = id ? decodeURIComponent(id) : "";
    const [currentPersonName, setCurrentPersonName] = useState<string | null>(
        null
    );


    // 날짜별 내역 클릭 → 해당 출장보고서(ReportViewPage)로 이동
    const handleRowClick = (row: WorkloadDetailEntry) => {
        if (!row?.workLogId) return;
        navigate(`/report/${row.workLogId}`);
    };

    // 데이터 로드
    useEffect(() => {
        // personName이 아직 없으면(user 로딩 전) 조회 종료하지 말고 로딩 유지
        if (!personName) {
            setLoading(true);
            return;
        }

        const guardAccess = async () => {
            if (!isStaff || isAdmin || isCEO || !currentUserId) return true;
            try {
                const { data, error } = await supabase
                    .from("profiles")
                    .select("name")
                    .eq("id", currentUserId)
                    .single();
                if (!error && data?.name) {
                    setCurrentPersonName(data.name);
                    if (data.name !== personName) {
                        navigate("/workload", { replace: true });
                        return false;
                    }
                }
            } catch {
                // ignore
            }
            return true;
        };

        const loadData = async () => {
            setLoading(true);
            try {
                const canAccess = await guardAccess();
                if (!canAccess) return;

                const yearNum = parseInt(selectedYear.replace("년", ""));
                const monthNum = parseInt(selectedMonth.replace("월", ""));

                // ✅ 개인별 상세 데이터는 이 API를 사용해야 함
                const data = await getWorkerWorkloadDetail(personName, {
                    year: yearNum,
                    month: monthNum,
                });

                setSummary(data.summary);
                setDetailEntries(data.entries);
                setCurrentPage(1);
            } catch (error) {
                console.error("워크로드 상세 데이터 로드 실패:", error);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [personName, selectedYear, selectedMonth, isStaff, isAdmin, isCEO, currentUserId, navigate]);


    // 페이지네이션 계산
    const totalPages = useMemo(() => {
        return Math.ceil(detailEntries.length / itemsPerPage);
    }, [detailEntries.length]);

    const currentTableData = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        return detailEntries.slice(startIndex, endIndex);
    }, [detailEntries, currentPage, itemsPerPage]);

    return (
        <div className="flex h-screen bg-white font-pretendard">
            {/* 모바일 오버레이 */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <div
                className={`fixed lg:static inset-y-0 left-0 z-50 w-[260px] max-w-[88vw] lg:max-w-none lg:w-[239px] h-screen shrink-0 transform transition-transform duration-300 ease-in-out ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
            >
                <Sidebar onClose={() => setSidebarOpen(false)} />
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <Header
                    title={`${personName || "워크로드"} 워크로드`}

                    onMenuClick={() => setSidebarOpen(true)}
                    leftContent={
                        !isStaff && (
                            <button
                                onClick={() => navigate("/workload")}
                                className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
                                title="목록으로 돌아가기"
                            >
                                <IconArrowBack />
                            </button>
                        )
                    }
                />

                {/* Content */}
                <main className="flex-1 overflow-auto pt-6 pb-24 px-4 md:px-9">
                    {loading ? (
                        <WorkloadDetailSkeleton />
                    ) : (
                        <div className="flex flex-col gap-4 md:gap-6 w-full">
                            {/* 요약 카드 (Icon 기반) */}
                            {summary ? (
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
                                    {[
                                        {
                                            label: "총 작업시간",
                                            value: formatHours(summary.totalWork),
                                            color: "text-gray-900",
                                        },
                                        {
                                            label: "이동시간",
                                            value: formatHours(summary.totalTravel),
                                            color: "text-gray-900",
                                        },
                                        {
                                            label: "대기시간",
                                            value: formatHours(summary.totalWait),
                                            color: "text-gray-900",
                                        },
                                    ].map((card) => (
                                        <div
                                            key={card.label}
                                            className="bg-gray-50 rounded-2xl p-5"
                                        >
                                            <div className="flex items-center gap-2 text-gray-500 mb-2">
                                                {card.label === "총 작업시간" ? (
                                                    <IconWork />
                                                ) : card.label === "이동시간" ? (
                                                    <IconDriveEta />
                                                ) : (
                                                    <IconSchedule />
                                                )}
                                                <span className="text-sm">
                                                    {card.label}
                                                </span>
                                            </div>
                                            <div
                                                className={`mt-2 text-xl md:text-[26px] font-bold ${card.color}`}
                                            >
                                                {card.value}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : null}

                            {/* 조회 기간 */}
                            <div className="flex flex-wrap items-center gap-2 md:gap-4">
                                <h2 className="text-base md:text-[24px] font-semibold text-gray-900">
                                    조회 기간
                                </h2>
                                <YearMonthSelector
                                    year={selectedYear}
                                    month={selectedMonth}
                                    onYearChange={setSelectedYear}
                                    onMonthChange={setSelectedMonth}
                                />
                            </div>

                            {/* 날짜별 세부 분석 */}
                            <div className={isMobile ? "" : "rounded-2xl border border-gray-200 bg-white p-7"}>
                                <h2 className="text-base md:text-[22px] font-semibold text-gray-700 tracking-tight mb-3 md:mb-6">
                                    날짜별 세부 분석
                                </h2>

                                {detailEntries.length === 0 ? (
                                    <p className="py-8 text-center text-gray-500 text-sm">
                                        선택한 기간의 작업 내역이 없습니다.
                                    </p>
                                ) : isMobile ? (
                                    <>
                                        <ul className="flex flex-col gap-2">
                                            {currentTableData.map((row) => {
                                                const formattedDate = formatDetailDate(row.date);
                                                const date = new Date(row.date + "T00:00:00");
                                                const dayOfWeek = date.getDay();
                                                let dateColor = "text-gray-800";
                                                if (dayOfWeek === 0) dateColor = "text-red-600";
                                                else if (dayOfWeek === 6) dateColor = "text-blue-600";
                                                return (
                                                    <li key={row.id}>
                                                        <button
                                                            type="button"
                                                            className="w-full rounded-xl border border-gray-200 bg-white p-4 flex items-center justify-between gap-3 text-left active:bg-gray-50 transition-colors"
                                                            onClick={() => handleRowClick(row)}
                                                        >
                                                            <div className="min-w-0 flex-1">
                                                                <p className={`font-medium ${dateColor}`}>{formattedDate}</p>
                                                                <p className="text-sm text-gray-500 mt-0.5">
                                                                    {row.vesselName || "—"} · {formatTimeRange(row.timeFrom, row.timeTo)}
                                                                </p>
                                                                <p className="text-sm text-gray-600 mt-1">
                                                                    작업 {formatHours(row.workTime)} · 이동 {formatHours(row.travelTime)} · 대기 {formatHours(row.waitTime)}
                                                                </p>
                                                            </div>
                                                            <IconChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
                                                        </button>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                        {totalPages > 1 && (
                                            <Pagination
                                                currentPage={currentPage}
                                                totalPages={totalPages}
                                                onPageChange={setCurrentPage}
                                                className="py-4"
                                            />
                                        )}
                                    </>
                                ) : (
                                    <Table
                                        columns={[
                                            {
                                                key: "date",
                                                label: "날짜",
                                                render: (_value, row: WorkloadDetailEntry, index: number) => {
                                                    const prev = currentTableData[index - 1];
                                                    if (prev?.date === row.date) {
                                                        return <span className="text-transparent">-</span>;
                                                    }
                                                    const formattedDate = formatDetailDate(row.date);
                                                    const date = new Date(row.date + "T00:00:00");
                                                    const dayOfWeek = date.getDay();
                                                    let colorClass = "text-gray-800";
                                                    if (dayOfWeek === 0) colorClass = "text-red-600";
                                                    else if (dayOfWeek === 6) colorClass = "text-blue-600";
                                                    return (
                                                        <span className={`font-medium ${colorClass}`}>
                                                            {formattedDate}
                                                        </span>
                                                    );
                                                },
                                            },
                                            {
                                                key: "vesselName",
                                                label: "호선명",
                                                render: (value: string | null, row: WorkloadDetailEntry, index: number) => {
                                                    const prev = currentTableData[index - 1];
                                                    if (prev?.date === row.date) return <span className="text-transparent">-</span>;
                                                    return value || "";
                                                },
                                            },
                                            {
                                                key: "workTime",
                                                label: "작업시간",
                                                render: (_, row: WorkloadDetailEntry) => formatHours(row.workTime),
                                            },
                                            {
                                                key: "timeRange",
                                                label: "시간대",
                                                render: (_, row: WorkloadDetailEntry) =>
                                                    formatTimeRange(row.timeFrom, row.timeTo),
                                            },
                                            {
                                                key: "travelTime",
                                                label: "이동시간",
                                                render: (_, row: WorkloadDetailEntry) => formatHours(row.travelTime),
                                            },
                                            {
                                                key: "waitTime",
                                                label: "대기시간",
                                                render: (_, row: WorkloadDetailEntry) => formatHours(row.waitTime),
                                            },
                                        ]}
                                        data={currentTableData}
                                        rowKey="id"
                                        onRowClick={handleRowClick}
                                        emptyText="선택한 기간의 작업 내역이 없습니다."
                                        pagination={
                                            totalPages > 1
                                                ? { currentPage, totalPages, onPageChange: setCurrentPage }
                                                : undefined
                                        }
                                    />
                                )}
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}
