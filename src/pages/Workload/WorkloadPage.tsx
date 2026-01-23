//workloadPage.tsx
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
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
import { useUser } from "../../hooks/useUser";
import {
    getWorkloadData,
    getWorkloadTargetProfiles,
    aggregatePersonWorkload,
    generateChartData,
    generateTableData,
    type WorkloadChartData,
    type WorkloadTableRow,
} from "../../lib/workloadApi";

// 워크로드 타입별 색상 및 라벨 상수
const WORKLOAD_TYPES = [
    { key: "작업", label: "작업", color: "#51a2ff", dataKey: "작업" },
    { key: "이동", label: "이동", color: "#fd9a00", dataKey: "이동" },
    { key: "대기", label: "대기", color: "#d1d5dc", dataKey: "대기" },
];

// 테이블 컬럼 정의
const TABLE_COLUMNS = [
    { key: "name", label: "이름" },
    { key: "work", label: "작업" },
    { key: "travel", label: "이동" },
    { key: "wait", label: "대기" },
    { key: "days", label: "일수" },
];

// 커스텀 툴팁
const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        const byKey = (key: string) =>
            payload.find((p: any) => p?.dataKey === key)?.value ?? 0;

        return (
            <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-lg">
                <p className="font-semibold text-sm text-gray-900 mb-2">{label}</p>
                <div className="flex flex-col gap-1.5">
                    {WORKLOAD_TYPES.map((type) => (
                        <div key={type.key} className="flex items-center gap-1.5">
                            <div
                                className="w-3.5 h-3.5 rounded"
                                style={{ backgroundColor: type.color }}
                            />
                            <span className="text-sm text-gray-600">
                                {type.label} {byKey(type.dataKey)}시간
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        );
    }
    return null;
};

// 차트 설정 상수
const CHART_MARGIN = { top: 20, right: 20, left: 0, bottom: 5 };
const BAR_RADIUS = 4;
const Y_AXIS_INTERVAL = 35;

// 커스텀 Bar Shape - 각 데이터 포인트에서 실제로 맨 위에 있는 Bar만 위쪽 radius 적용
const CustomBarShape = (props: any) => {
    const { fill, x, y, width, height, payload, dataKey } = props;
    const { 작업, 이동, 대기 } = payload as WorkloadChartData;

    // 실제로 맨 위에 있는 Bar인지 확인
    // Recharts 스택 순서: 작업(아래) -> 이동(중간) -> 대기(위)
    const isTopBar =
        (dataKey === "대기" && 대기 > 0) ||
        (dataKey === "이동" && 대기 === 0 && 이동 > 0) ||
        (dataKey === "작업" && 대기 === 0 && 이동 === 0 && 작업 > 0);

    if (isTopBar) {
        // 위쪽만 radius 적용 (path 사용)
        const path = `M ${x + BAR_RADIUS} ${y} 
                      L ${x + width - BAR_RADIUS} ${y} 
                      Q ${x + width} ${y} ${x + width} ${y + BAR_RADIUS} 
                      L ${x + width} ${y + height} 
                      L ${x} ${y + height} 
                      L ${x} ${y + BAR_RADIUS} 
                      Q ${x} ${y} ${x + BAR_RADIUS} ${y} Z`;
        return <path d={path} fill={fill} />;
    }

    return <rect x={x} y={y} width={width} height={height} fill={fill} />;
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
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const [chartSize, setChartSize] = useState({ width: 0, height: 300 });

    const itemsPerPage = 10;

    // ✅ useUser 훅으로 사용자 정보 및 권한 가져오기
    const { currentUser, currentUserId, userPermissions } = useUser();
    const userName = currentUser?.displayName || null;
    const isStaff = userPermissions.isStaff;

    // ✅ staff/공사팀이면 WorkloadPage 로딩 없이 즉시 본인 Detail로 이동
    useEffect(() => {
        if (isStaff && userName) {
            navigate(`/workload/detail/${encodeURIComponent(userName)}`, {
                replace: true,
            });
        }
    }, [isStaff, userName, navigate]);

    // 차트 컨테이너 크기 측정 (성능 최적화: 즉시 측정)
    useEffect(() => {
        if (!chartData.length) return;

        let resizeTimer: NodeJS.Timeout | null = null;
        let lastWidth = 0;

        const updateChartSize = () => {
            if (!chartContainerRef.current) return;

            const rect = chartContainerRef.current.getBoundingClientRect();
            const newWidth = Math.round(rect.width);

            // 크기가 실제로 변경된 경우에만 업데이트 (10px 이상 차이)
            if (newWidth > 0 && Math.abs(lastWidth - newWidth) >= 10) {
                lastWidth = newWidth;
                setChartSize({ width: newWidth, height: 300 });
            }
        };

        // 초기 크기 확인 (즉시 측정으로 로딩 속도 개선)
        if (chartContainerRef.current) {
            const rect = chartContainerRef.current.getBoundingClientRect();
            const width = Math.round(rect.width);
            if (width > 0) {
                lastWidth = width;
                setChartSize({ width, height: 300 });
            } else {
                // 크기가 0이면 약간 지연 후 재시도
                const timeout = setTimeout(() => {
                    updateChartSize();
                }, 100);
                return () => clearTimeout(timeout);
            }
        }

        // resize 이벤트에 debounce 적용 (500ms로 증가하여 성능 개선)
        const handleResize = () => {
            if (resizeTimer) clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                updateChartSize();
                resizeTimer = null;
            }, 500);
        };

        window.addEventListener('resize', handleResize, { passive: true });

        return () => {
            window.removeEventListener('resize', handleResize);
            if (resizeTimer) clearTimeout(resizeTimer);
        };
    }, [chartData.length]);

    // 행 클릭 핸들러 (메모이제이션)
    const handleRowClick = useCallback(
        (row: WorkloadTableRow) => {
            if (isStaff && row.id !== currentUserId) {
                return;
            }
            navigate(`/workload/detail/${encodeURIComponent(row.name)}`);
        },
        [isStaff, currentUserId, navigate]
    );

    // 데이터 로드
    useEffect(() => {
        if (isStaff) return; // ✅ staff는 목록 화면 로딩 자체를 하지 않음

        const loadData = async () => {
            setLoading(true);
            try {
                const yearNum = parseInt(selectedYear.replace("년", ""));
                const monthNum = parseInt(selectedMonth.replace("월", ""));

                // ✅ API 호출 병렬 처리로 성능 개선
                const [entries, profilesResult] = await Promise.allSettled([
                    getWorkloadData({
                        year: yearNum,
                        month: monthNum,
                    }),
                    getWorkloadTargetProfiles(),
                ]);

                // entries 처리
                if (entries.status === "rejected") {
                    // 워크로드 데이터 로드 실패
                    throw entries.reason;
                }

                // profiles 처리 (실패해도 워크로드는 계속 표시)
                let profiles: Awaited<ReturnType<typeof getWorkloadTargetProfiles>> = [];
                if (profilesResult.status === "fulfilled") {
                    profiles = profilesResult.value;
                } else {
                    // 워크로드 대상자(profiles) 조회 실패 - fallback 처리
                    profiles = []; // ✅ 대상자 필터 없이 전체 집계
                }

                // ✅ 인원별 집계
                const summaries = aggregatePersonWorkload(
                    entries.value,
                    profiles
                );

                // 차트 및 테이블 데이터 생성 (즉시 업데이트로 로딩 속도 개선)
                const newChartData = generateChartData(summaries);
                const newTableData = generateTableData(summaries);

                // 즉시 상태 업데이트 (setTimeout 제거로 로딩 속도 개선)
                setChartData(newChartData);
                setTableData(newTableData);
                setCurrentPage(1);
            } catch (error) {
                // 워크로드 데이터 로드 실패
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [selectedYear, selectedMonth, isStaff]);



    // 페이지네이션 계산
    const totalPages = useMemo(() => {
        return Math.ceil(tableData.length / itemsPerPage);
    }, [tableData.length]);

    const currentTableData = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        return tableData.slice(startIndex, endIndex);
    }, [tableData, currentPage, itemsPerPage]);

    // Y축 최대값 및 ticks 계산 (차트용)
    const { maxYValue, yAxisTicks } = useMemo(() => {
        if (chartData.length === 0) {
            return {
                maxYValue: 140,
                yAxisTicks: Array.from(
                    { length: 140 / Y_AXIS_INTERVAL + 1 },
                    (_, i) => i * Y_AXIS_INTERVAL
                ),
            };
        }
        const max = Math.max(
            ...chartData.map((d) => d.작업 + d.이동 + d.대기)
        );
        const maxY = Math.ceil(max / Y_AXIS_INTERVAL) * Y_AXIS_INTERVAL;
        return {
            maxYValue: maxY,
            yAxisTicks: Array.from(
                { length: maxY / Y_AXIS_INTERVAL + 1 },
                (_, i) => i * Y_AXIS_INTERVAL
            ),
        };
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
        transform ${sidebarOpen ? "translate-x-0" : "-translate-x-full"
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
                                        {WORKLOAD_TYPES.map((type) => (
                                            <div
                                                key={type.key}
                                                className="flex items-center gap-1.5"
                                            >
                                                <div
                                                    className="w-4 h-4 rounded"
                                                    style={{ backgroundColor: type.color }}
                                                />
                                                <span className="text-[13px] text-gray-500">
                                                    {type.label}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {chartData.length === 0 ? (
                                    <div className="h-[300px] flex items-center justify-center">
                                        <div className="text-gray-500">
                                            데이터가 없습니다.
                                        </div>
                                    </div>
                                ) : (
                                    <div
                                        ref={chartContainerRef}
                                        className="w-full"
                                        style={{
                                            height: '300px',
                                            minHeight: '300px',
                                            position: 'relative',
                                            width: '100%'
                                        }}
                                    >
                                        {chartSize.width > 0 ? (
                                            <ResponsiveContainer
                                                width={chartSize.width}
                                                height={300}
                                            >
                                                <BarChart
                                                    data={chartData}
                                                    margin={CHART_MARGIN}
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
                                                        ticks={yAxisTicks}
                                                    />
                                                    <Tooltip
                                                        content={<CustomTooltip />}
                                                        cursor={{
                                                            fill: "rgba(0,0,0,0.05)",
                                                        }}
                                                    />
                                                    {WORKLOAD_TYPES.map((type) => (
                                                        <Bar
                                                            key={type.key}
                                                            dataKey={type.dataKey}
                                                            stackId="a"
                                                            fill={type.color}
                                                            shape={CustomBarShape}
                                                        />
                                                    ))}
                                                </BarChart>
                                            </ResponsiveContainer>
                                        ) : (
                                            <div className="h-[300px] w-full bg-gray-100 rounded-xl animate-pulse" />
                                        )}
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

                                {tableData.length === 0 ? (
                                    <div className="py-8 text-center text-gray-500">
                                        데이터가 없습니다.
                                    </div>
                                ) : (
                                    <Table
                                        columns={TABLE_COLUMNS}
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
