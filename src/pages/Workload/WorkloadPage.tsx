//workloadPage.tsx
import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from "recharts";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/common/Header";
import Table from "../../components/common/Table";
import YearMonthSelector from "../../components/common/YearMonthSelector";
import WorkloadSkeleton from "../../components/common/WorkloadSkeleton";
import { supabase } from "../../lib/supabase";
import {
    getWorkloadData,
    getWorkloadTargetProfiles,
    aggregatePersonWorkload,
    generateChartData,
    generateTableData,
    type WorkloadChartData,
    type WorkloadTableRow,
} from "../../lib/workloadApi";


// 커스텀 툴팁
const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        const byKey = (key: string) =>
            payload.find((p: any) => p?.dataKey === key)?.value ?? 0;

        return (
            <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-lg">
                <p className="font-semibold text-sm text-gray-900 mb-2">{label}</p>
                <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-1.5">
                        <div className="w-3.5 h-3.5 rounded bg-[#51a2ff]" />
                        <span className="text-sm text-gray-600">
                            작업 {byKey("작업")}시간
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-3.5 h-3.5 rounded bg-[#fd9a00]" />
                        <span className="text-sm text-gray-600">
                            이동 {byKey("이동")}시간
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-3.5 h-3.5 rounded bg-gray-300" />
                        <span className="text-sm text-gray-600">
                            대기 {byKey("대기")}시간
                        </span>
                    </div>
                </div>
            </div>
        );
    }
    return null;
};


export default function WorkloadPage() {
    const navigate = useNavigate();

    // 오늘 날짜 기준으로 기본값 설정
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1; // 0-based이므로 +1

    const [selectedYear, setSelectedYear] = useState(`${currentYear}년`);
    const [selectedMonth, setSelectedMonth] = useState(`${currentMonth}월`);
    const [currentPage, setCurrentPage] = useState(1);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [chartData, setChartData] = useState<WorkloadChartData[]>([]);
    const [tableData, setTableData] = useState<WorkloadTableRow[]>([]);
    const [userRole, setUserRole] = useState<string | null>(null);
    const [userDepartment, setUserDepartment] = useState<string | null>(null);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [userName, setUserName] = useState<string | null>(null);

    const itemsPerPage = 10;

    // 사용자 정보 로드
    useEffect(() => {
        const fetchUserInfo = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setCurrentUserId(user.id);
                const { data: profile } = await supabase
                    .from("profiles")
                    .select("role, department, name")
                    .eq("id", user.id)
                    .single();
                if (profile) {
                    setUserRole(profile.role);
                    setUserDepartment(profile.department);
                    setUserName(profile.name);
                }
            }
        };
        fetchUserInfo();
    }, []);

    // 행 클릭 핸들러
    const handleRowClick = (row: WorkloadTableRow) => {
        const isStaff = userRole === "staff" || userDepartment === "공사팀";
        // 공사팀(스태프)인 경우 본인 ID와 일치하는 경우만 상세 페이지로 이동
        // (이미 자동 리다이렉트되므로 이 핸들러는 사실상 사용되지 않지만, 안전장치로 유지)
        if (isStaff && row.id !== currentUserId) {
            return;
        }
        navigate(`/workload/detail/${encodeURIComponent(row.name)}`);
    };

    // 데이터 로드
    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                const yearNum = parseInt(selectedYear.replace("년", ""));
                const monthNum = parseInt(selectedMonth.replace("월", ""));

                const entries = await getWorkloadData({
                    year: yearNum,
                    month: monthNum,
                });

                // ✅ 공사팀/공무팀 대상자 조회 (실패해도 워크로드는 계속 표시)
                let profiles: Awaited<ReturnType<typeof getWorkloadTargetProfiles>> = [];
                try {
                    profiles = await getWorkloadTargetProfiles();
                } catch (e) {
                    console.error("워크로드 대상자(profiles) 조회 실패 - fallback 처리:", e);
                    profiles = []; // ✅ 대상자 필터 없이 전체 집계
                }

                // ✅ 인원별 집계
                const summaries = aggregatePersonWorkload(entries, profiles);



                // 차트 데이터 생성
                const chart = generateChartData(summaries);
                setChartData(chart);

                // 테이블 데이터 생성
                const table = generateTableData(summaries);
                setTableData(table);

                // 페이지 초기화
                setCurrentPage(1);
            } catch (error) {
                console.error("워크로드 데이터 로드 실패:", error);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [selectedYear, selectedMonth]);

    // 공사팀(스태프)인 경우 본인 상세 페이지로 자동 리다이렉트
    useEffect(() => {
        const isStaff = userRole === "staff" || userDepartment === "공사팀";
        if (isStaff && userName && tableData.length > 0 && !loading) {
            // 본인 데이터 찾기
            const ownData = tableData.find(row => row.id === currentUserId || row.name === userName);
            if (ownData) {
                navigate(`/workload/detail/${encodeURIComponent(ownData.name)}`, { replace: true });
            }
        }
    }, [userRole, userDepartment, userName, tableData, currentUserId, loading, navigate]);

    // 페이지네이션 계산
    const totalPages = useMemo(() => {
        return Math.ceil(tableData.length / itemsPerPage);
    }, [tableData.length]);

    const currentTableData = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        return tableData.slice(startIndex, endIndex);
    }, [tableData, currentPage, itemsPerPage]);

    // Y축 최대값 계산 (차트용)
    const maxYValue = useMemo(() => {
        if (chartData.length === 0) return 140;
        const max = Math.max(...chartData.map((d) => d.작업 + d.이동 + d.대기));
        return Math.ceil(max / 35) * 35; // 35의 배수로 올림
    }, [chartData]);

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
                className={`
        fixed lg:static inset-y-0 left-0 z-50
        transform ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0
        transition-transform duration-300 ease-in-out
      `}
            >
                <Sidebar onClose={() => setSidebarOpen(false)} />
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <Header
                    title="워크로드"
                    onMenuClick={() => setSidebarOpen(true)}
                />

                {/* Content */}
                <main className="flex-1 overflow-auto pt-9 pb-20 px-9">
                    {loading ? (
                        <WorkloadSkeleton />
                    ) : (
                        <div className="flex flex-col gap-6 w-full">
                            {/* 조회 기간 */}
                            <div className="flex flex-wrap items-center gap-4">
                                <h2 className="text-[24px] font-semibold text-gray-900">
                                    조회 기간
                                </h2>
                                <YearMonthSelector
                                    year={selectedYear}
                                    month={selectedMonth}
                                    onYearChange={setSelectedYear}
                                    onMonthChange={setSelectedMonth}
                                />
                            </div>

                            {/* 인원별 작업시간 차트 */}
                            <div className="bg-white border border-gray-200 rounded-2xl p-7">
                                <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                                    <h2 className="text-[22px] font-semibold text-gray-700 tracking-tight">
                                        인원별 작업시간
                                    </h2>
                                    <div className="flex items-center gap-5">
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-4 h-4 rounded bg-[#51a2ff]" />
                                            <span className="text-[13px] text-gray-500">
                                                작업
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-4 h-4 rounded bg-[#fd9a00]" />
                                            <span className="text-[13px] text-gray-500">
                                                이동
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-4 h-4 rounded bg-gray-300" />
                                            <span className="text-[13px] text-gray-500">
                                                대기
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {loading ? (
                                    <div className="h-[300px] flex items-center justify-center">
                                        <div className="text-gray-500">
                                            데이터 로딩 중...
                                        </div>
                                    </div>
                                ) : chartData.length === 0 ? (
                                    <div className="h-[300px] flex items-center justify-center">
                                        <div className="text-gray-500">
                                            데이터가 없습니다.
                                        </div>
                                    </div>
                                ) : (
                                    <div className="h-[300px] w-full">
                                        <ResponsiveContainer
                                            width="100%"
                                            height="100%"
                                        >
                                            <BarChart
                                                data={chartData}
                                                margin={{
                                                    top: 20,
                                                    right: 20,
                                                    left: 0,
                                                    bottom: 5,
                                                }}
                                            >
                                                <CartesianGrid
                                                    strokeDasharray="3 3"
                                                    vertical={false}
                                                    stroke="#e5e7eb"
                                                />
                                                <XAxis
                                                    dataKey="name"
                                                    tick={{
                                                        fontSize: 12,
                                                        fill: "#6a7282",
                                                    }}
                                                    axisLine={false}
                                                    tickLine={false}
                                                />
                                                <YAxis
                                                    tick={{
                                                        fontSize: 14,
                                                        fill: "#99a1af",
                                                    }}
                                                    axisLine={false}
                                                    tickLine={false}
                                                    domain={[0, maxYValue]}
                                                    ticks={Array.from(
                                                        {
                                                            length:
                                                                maxYValue / 35 +
                                                                1,
                                                        },
                                                        (_, i) => i * 35
                                                    )}
                                                />
                                                <Tooltip
                                                    content={<CustomTooltip />}
                                                    cursor={{
                                                        fill: "rgba(0,0,0,0.05)",
                                                    }}
                                                />
                                                <Bar
                                                    dataKey="작업"
                                                    stackId="a"
                                                    fill="#51a2ff"
                                                    radius={[4, 4, 0, 0]}
                                                />
                                                <Bar
                                                    dataKey="이동"
                                                    stackId="a"
                                                    fill="#fd9a00"
                                                    radius={[0, 0, 0, 0]}
                                                />
                                                <Bar
                                                    dataKey="대기"
                                                    stackId="a"
                                                    fill="#d1d5dc"
                                                    radius={[0, 0, 4, 4]}
                                                />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                )}
                            </div>

                            {/* 상세 데이터 테이블 */}
                            <div className="bg-white border border-gray-200 rounded-2xl p-7">
                                <h2 className="text-lg font-semibold text-gray-800 mb-1">
                                    상세 데이터
                                </h2>
                                <p className="text-sm text-gray-500 mb-4">
                                    클릭하여 상세 내역을 확인하세요
                                </p>

                                {loading ? (
                                    <div className="py-8 text-center text-gray-500">
                                        데이터 로딩 중...
                                    </div>
                                ) : tableData.length === 0 ? (
                                    <div className="py-8 text-center text-gray-500">
                                        데이터가 없습니다.
                                    </div>
                                ) : (
                                    <Table
                                        columns={[
                                            {
                                                key: "name",
                                                label: "이름",
                                            },
                                            {
                                                key: "work",
                                                label: "작업",
                                            },
                                            {
                                                key: "travel",
                                                label: "이동",
                                            },
                                            {
                                                key: "wait",
                                                label: "대기",
                                            },
                                            {
                                                key: "days",
                                                label: "일수",
                                            },
                                        ]}
                                        data={currentTableData}
                                        rowKey="id"
                                        onRowClick={handleRowClick}
                                        pagination={
                                            totalPages > 1
                                                ? {
                                                      currentPage,
                                                      totalPages,
                                                      onPageChange:
                                                          setCurrentPage,
                                                  }
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
