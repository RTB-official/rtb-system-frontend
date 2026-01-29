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
    Line,
    ReferenceLine,
    Scatter,
} from "recharts";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/common/Header";
import Table from "../../components/common/Table";
import YearMonthSelector from "../../components/common/YearMonthSelector";
import WorkloadSkeleton from "../../components/common/WorkloadSkeleton";
import { useUser } from "../../hooks/useUser";
import Toast, { type ToastItem } from "../../components/ui/Toast";
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
const CustomTooltip = ({ active, payload, label, showLastMonth }: any) => {
    if (active && payload && payload.length) {
        const byKey = (key: string) =>
            payload.find((p: any) => p?.dataKey === key)?.value ?? 0;

        const lastWork = byKey("lastWork");

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

                    {/* ✅ 지난달 데이터 ON일 때만 툴팁에 표시 */}
                    {showLastMonth && (
                        <div className="flex items-center gap-1.5 mt-1 pt-2 border-t border-gray-100">
                            <div
                                className="w-3.5 h-3.5 rounded"
                                style={{ backgroundColor: "#d1d5db" }}
                            />
                            <span className="text-sm text-gray-600">
                                지난달 작업 {lastWork}시간
                            </span>
                        </div>
                    )}
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
const X_AXIS_HEIGHT = 30; // ✅ 두 레이어 0기준 맞추기용
const Y_AXIS_WIDTH = 40; // ✅ 두 레이어 차트 Y축 폭 고정(정렬용)

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
    // ✅ Toast
    const [toasts, setToasts] = useState<ToastItem[]>([]);

    const pushToast = useCallback((partial: Omit<ToastItem, "id">) => {
        const id =
            (typeof crypto !== "undefined" && "randomUUID" in crypto && (crypto as any).randomUUID?.()) ||
            `${Date.now()}-${Math.random()}`;

        setToasts((prev) => [...prev, { id, ...partial }]);
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    // ✅ Toast onClose 함수 참조 고정(리렌더/호버에도 타이머 초기화 방지)
    const toastCloseHandlersRef = useRef<Map<string, () => void>>(new Map());

    const getToastOnClose = useCallback(
        (id: string) => {
            const existing = toastCloseHandlersRef.current.get(id);
            if (existing) return existing;

            const fn = () => {
                removeToast(id);
                toastCloseHandlersRef.current.delete(id);
            };

            toastCloseHandlersRef.current.set(id, fn);
            return fn;
        },
        [removeToast]
    );

        // ✅ 막대 클릭 시 사유 섹션 대상(이름) & 입력값
        const [reasonTargetName, setReasonTargetName] = useState<string | null>(null);
        const [reasonText, setReasonText] = useState("");
        const [reasonGovText, setReasonGovText] = useState(""); // ✅ 공무팀 사유
                // ✅ 사람별 사유 저장(임시: 페이지 내 상태)
                const [reasonByName, setReasonByName] = useState<Record<string, string>>({});
                const [reasonGovByName, setReasonGovByName] = useState<Record<string, string>>({}); // ✅ 공무팀 사유 저장
        
            // ✅ 차트에서 현재 호버(툴팁) 중인 이름
            const [hoveredName, setHoveredName] = useState<string | null>(null);

            // ✅ 막대(스택 어느 구간이든) 클릭하면 해당 인원 선택 + 저장된 사유 로딩
            const handleBarClick = useCallback(
                (barData: any) => {
                    const name = barData?.payload?.name;
                    if (!name) return;

                    setReasonTargetName(name);
                    setReasonText(reasonByName[name] ?? "");
                    setReasonGovText(reasonGovByName[name] ?? "");
                },
                [reasonByName, reasonGovByName]
            );
                        // ✅ 차트 호버(툴팁 활성) 시 activePayload에서 이름 추적
                        const handleChartMouseMove = useCallback((state: any) => {
                            // ✅ 막대 위 빈공간에서도 activeLabel이 들어오는 경우가 많음
                            const nameFromLabel = state?.activeLabel ?? null;
                            const nameFromPayload = state?.activePayload?.[0]?.payload?.name ?? null;

                            setHoveredName(nameFromLabel ?? nameFromPayload);
                        }, []);
            
                        // ✅ 막대/빈공간 포함(해당 X구간) 클릭 시 사유 열기
                        const handleChartClick = useCallback(
                            (state: any) => {
                                // ✅ 클릭 시점에도 activeLabel/activePayload에서 이름 확보
                                const name =
                                    state?.activeLabel ??
                                    state?.activePayload?.[0]?.payload?.name ??
                                    hoveredName;

                                if (!name) return;

                                setReasonTargetName(name);
                                setReasonText(reasonByName[name] ?? "");
                                setReasonGovText(reasonGovByName[name] ?? "");
                            },
                            [hoveredName, reasonByName, reasonGovByName]
                        );
            
            // ✅ 닫기
            const handleReasonClose = useCallback(() => {
                setReasonTargetName(null);
                setReasonText("");
                setReasonGovText("");
            }, []);

             // ✅ 저장(DB: 월별 upsert / 둘 다 empty면 delete)
             const handleReasonSave = useCallback(async () => {
                if (!reasonTargetName) return;

                const yearNum = parseInt(selectedYear.replace("년", ""));
                const monthNum = parseInt(selectedMonth.replace("월", ""));

                const personal = reasonText.trim();
                const gov = reasonGovText.trim();

                // ✅ 둘 다 비어있으면 → DELETE
                if (!personal && !gov) {
                    const { error } = await supabase
                        .from("workload_reasons")
                        .delete()
                        .eq("person_name", reasonTargetName)
                        .eq("year", yearNum)
                        .eq("month", monthNum);

                    if (error) {
                        pushToast({
                            type: "error",
                            message: "삭제에 실패했습니다.",
                            duration: 3000,
                        });
                        return;
                    }

                    pushToast({
                        type: "success",
                        message: "사유가 없어 삭제되었습니다.",
                        duration: 2000,
                    });


                    // ✅ 프론트 상태에서도 제거
                    setReasonByName((prev) => {
                        const next = { ...prev };
                        delete next[reasonTargetName];
                        return next;
                    });

                    setReasonGovByName((prev) => {
                        const next = { ...prev };
                        delete next[reasonTargetName];
                        return next;
                    });

                    return;
                }

                // ✅ 하나라도 있으면 → UPSERT
                const { error } = await supabase
                    .from("workload_reasons")
                    .upsert(
                        [
                            {
                                person_name: reasonTargetName,
                                year: yearNum,
                                month: monthNum,
                                personal_reason: personal,
                                gov_reason: gov,
                                updated_at: new Date().toISOString(),
                            },
                        ],
                        { onConflict: "person_name,year,month" }
                    );

                    if (error) {
                        pushToast({
                            type: "error",
                            message: "저장에 실패했습니다.",
                            duration: 3000,
                        });
                        return;
                    }
    
                    pushToast({
                        type: "success",
                        message: "저장되었습니다.",
                        duration: 2000,
                    });

                // ✅ 프론트 상태 반영
                setReasonByName((prev) => ({
                    ...prev,
                    [reasonTargetName]: personal,
                }));

                setReasonGovByName((prev) => ({
                    ...prev,
                    [reasonTargetName]: gov,
                }));
            }, [reasonTargetName, reasonText, reasonGovText, pushToast]);



    

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
    const [lastMonthChartData, setLastMonthChartData] = useState<WorkloadChartData[]>([]);
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const [showLastMonth, setShowLastMonth] = useState(false);
    const [chartSize, setChartSize] = useState({ width: 0, height: 300 });
    const selectedYearNum = useMemo(
        () => parseInt(selectedYear.replace("년", "")),
        [selectedYear]
    );
    const selectedMonthNum = useMemo(
        () => parseInt(selectedMonth.replace("월", "")),
        [selectedMonth]
    );


        // ✅ 사유가 작성된 사람(name) Set (개인/공무팀 둘 중 하나라도 있으면)
        const namesWithReason = useMemo(() => {
            const set = new Set<string>();
    
            Object.entries(reasonByName).forEach(([name, text]) => {
                if ((text ?? "").trim()) set.add(name);
            });
    
            Object.entries(reasonGovByName).forEach(([name, text]) => {
                if ((text ?? "").trim()) set.add(name);
            });
    
            return set;
        }, [reasonByName, reasonGovByName]);
    
        // ✅ X축 이름 + 말풍선 아이콘
        const CustomXAxisTick = useCallback(
            (props: any) => {
                const { x, y, payload } = props;
                const name = payload?.value ?? "";
                const hasReason = namesWithReason.has(name);
    
                return (
                    <g transform={`translate(${x},${y})`}>
                        <text
                            x={0}
                            y={0}
                            dy={14}
                            textAnchor="middle"
                            fill="#6a7282"
                            fontSize={12}
                        >
                            {name}
                        </text>
    
                        {hasReason && (
                            // 말풍선 아이콘 (이름 오른쪽)
                            <g transform="translate(22, 2)">
                                <svg
                                    width="14"
                                    height="14"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                >
                                    <path
                                        d="M21 12c0 4.418-4.03 8-9 8-1.05 0-2.06-.16-3-.46L3 21l1.62-4.06C3.61 15.65 3 13.9 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                                        stroke="#9CA3AF"
                                        strokeWidth="1.8"
                                        strokeLinejoin="round"
                                    />
                                    <path
                                        d="M8 12h8M8 9h6M8 15h5"
                                        stroke="#9CA3AF"
                                        strokeWidth="1.8"
                                        strokeLinecap="round"
                                    />
                                </svg>
                            </g>
                        )}
                    </g>
                );
            },
            [namesWithReason]
        );
    
    
    // 이번달 차트 데이터에 지난달 작업값(lastWork) 합치기 (라인용)
const chartDataWithLastWork = useMemo(() => {
    const lastMap = new Map(lastMonthChartData.map((d) => [d.name, d.작업 ?? null]));
    return chartData.map((d) => ({
        ...d,
        lastWork: lastMap.get(d.name) ?? null,
    }));
}, [chartData, lastMonthChartData]);
// 지난달 점 표시용 데이터 (지난달 '작업시간' 위치에 점)
const lastMonthDotData = useMemo(() => {
    return lastMonthChartData.map((d) => ({
        name: d.name,
        midY: d.작업 ?? 0, // ✅ 지난달 작업시간(예: 50)이 그대로 y값이 됨
    }));
}, [lastMonthChartData]);



    const itemsPerPage = 10;

    // ✅ useUser 훅으로 사용자 정보 및 권한 가져오기
    const { currentUser, currentUserId, userPermissions } = useUser();
    const userName = currentUser?.displayName || null;
    const isStaff = userPermissions.isStaff;
    const [staffPersonName, setStaffPersonName] = useState<string | null>(null);

    // ✅ staff/공사팀이면 WorkloadPage 로딩 없이 즉시 본인 Detail로 이동
    useEffect(() => {
        if (!isStaff || !currentUserId) return;

        const loadProfileName = async () => {
            try {
                const { data, error } = await supabase
                    .from("profiles")
                    .select("name")
                    .eq("id", currentUserId)
                    .single();
                if (!error && data?.name) {
                    setStaffPersonName(data.name);
                } else {
                    setStaffPersonName(userName);
                }
            } catch {
                setStaffPersonName(userName);
            }
        };

        loadProfileName();
    }, [isStaff, currentUserId, userName]);

    useEffect(() => {
        if (isStaff && staffPersonName) {
            navigate(`/workload/detail/${encodeURIComponent(staffPersonName)}`, {
                replace: true,
            });
        }
    }, [isStaff, staffPersonName, navigate]);

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
                const yearNum = selectedYearNum;
                const monthNum = selectedMonthNum;

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

                // ✅ 인원별 집계(전체: 테이블용 그대로 유지)
                const summaries = aggregatePersonWorkload(
                    entries.value,
                    profiles
                );

                // ✅ 차트는 "공사팀"만 포함 (공무팀 전원 제외)
                const getTeamText = (p: any) =>
                    String(
                        p?.team ??
                        p?.team_name ??
                        p?.department ??
                        p?.dept ??
                        p?.group ??
                        p?.group_name ??
                        ""
                    );

                const chartProfiles = profiles.filter((p: any) => {
                    const team = getTeamText(p);
                    const isCivil = team.includes("공무");
                    const isConstruction = team.includes("공사");
                    return isConstruction && !isCivil;
                });

                const chartSummaries = aggregatePersonWorkload(
                    entries.value,
                    chartProfiles
                );

                // ✅ 차트/테이블 데이터 생성
                const newChartData = generateChartData(chartSummaries);
                const newTableData = generateTableData(summaries);

                // ✅ 해당 월(year/month) 사유 로드
                try {
                    const { data: reasonRows, error: reasonErr } = await supabase
                        .from("workload_reasons")
                        .select("person_name, personal_reason, gov_reason")
                        .eq("year", yearNum)
                        .eq("month", monthNum);

                    if (!reasonErr && reasonRows) {
                        const personalMap: Record<string, string> = {};
                        const govMap: Record<string, string> = {};

                        reasonRows.forEach((r: any) => {
                            if (r?.person_name) {
                                personalMap[r.person_name] = r.personal_reason ?? "";
                                govMap[r.person_name] = r.gov_reason ?? "";
                            }
                        });

                        setReasonByName(personalMap);
                        setReasonGovByName(govMap);
                    } else {
                        // 로드 실패 시 기존값 유지/비움 처리 원하면 여기서 처리
                    }
                } catch {
                    // 무시 (워크로드는 계속 표시)
                }


// ✅ 지난달 데이터 (처음부터 미리 로딩)
let prevYear = yearNum;
let prevMonth = monthNum - 1;
if (prevMonth === 0) {
    prevMonth = 12;
    prevYear = yearNum - 1;
}

const [prevEntries, prevProfilesResult] = await Promise.allSettled([
    getWorkloadData({ year: prevYear, month: prevMonth }),
    getWorkloadTargetProfiles(),
]);

if (prevEntries.status === "fulfilled") {
    let prevProfiles: Awaited<ReturnType<typeof getWorkloadTargetProfiles>> = [];
    if (prevProfilesResult.status === "fulfilled") {
        prevProfiles = prevProfilesResult.value;
    }

    const prevSummaries = aggregatePersonWorkload(prevEntries.value, prevProfiles);
    const prevChart = generateChartData(prevSummaries);

    // ✅ X축(이름) 순서 맞추기: 이번달 차트 순서 기준으로 지난달을 정렬/누락은 0으로 채움
    const prevMap = new Map(prevChart.map((d) => [d.name, d]));
    const alignedPrev = newChartData.map((d) => {
        const found = prevMap.get(d.name);
        return found ?? { name: d.name, 작업: 0, 이동: 0, 대기: 0 };
    });

    setLastMonthChartData(alignedPrev);
} else {
    setLastMonthChartData([]);
}


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


// 순수 작업시간 평균 계산
const averageWorkTime = useMemo(() => {
    if (chartData.length === 0) return 0;
    const total = chartData.reduce((sum, d) => sum + d.작업, 0);
    return Math.round(total / chartData.length);
}, [chartData]);

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
        0,
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

            {/* ✅ Toasts */}
            {toasts.map((t, idx) => (
                <Toast
                    key={t.id}
                    toast={t}
                    offset={idx * 90}
                    onClose={getToastOnClose(t.id)}
                />
            ))}

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

        <div className="flex items-center gap-4">
            {/* 지난달 데이터 토글 버튼 (UI만) */}
            <button
                type="button"
                onClick={() => setShowLastMonth((v) => !v)}
                className={`px-3 py-1.5 rounded-lg text-[13px] font-medium border transition
                    ${showLastMonth
                        ? "bg-red-50 border-red-200 text-red-600"
                        : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}
            >
                지난달 데이터 {showLastMonth ? "ON" : "OFF"}
            </button>

            {/* 범례 */}
            <div className="flex items-center gap-5">
                {WORKLOAD_TYPES.map((type) => (
                    <div key={type.key} className="flex items-center gap-1.5">
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
    </div>

    {chartData.length === 0 ? (
        <div className="h-[300px] flex items-center justify-center">
            <div className="text-gray-500">데이터가 없습니다.</div>
        </div>
    ) : (
        <div
            ref={chartContainerRef}
            className="w-full"
            style={{
                height: "300px",
                minHeight: "300px",
                position: "relative",
                width: "100%",
            }}
        >
{chartSize.width > 0 ? (
    <div className="relative w-full h-[300px]">
        {/* ✅ 이번달 레이어 (아래) */}
        <div className="absolute inset-0">
            <ResponsiveContainer width="100%" height={300}>
            <BarChart
                data={chartDataWithLastWork}
                margin={CHART_MARGIN}
                onMouseMove={handleChartMouseMove}
                onMouseLeave={() => setHoveredName(null)}
                onClick={handleChartClick}
            >
                    <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="#e5e7eb"
                    />
                    <XAxis
                        height={X_AXIS_HEIGHT}
                        dataKey="name"
                        tick={CustomXAxisTick}
                        axisLine={false}
                        tickLine={false}
                    />

                    <YAxis
                        width={Y_AXIS_WIDTH}
                        tick={{ fontSize: 14, fill: "#99a1af" }}
                        axisLine={false}
                        tickLine={false}
                        domain={[0, maxYValue]}
                        ticks={yAxisTicks}
                    />
                    <Tooltip
                        content={<CustomTooltip showLastMonth={showLastMonth} />}
                        cursor={{ fill: "rgba(0,0,0,0.05)" }}
                    />
                    {WORKLOAD_TYPES.map((type) => (
                        <Bar
                            key={type.key}
                            dataKey={type.dataKey}
                            stackId="a"
                            fill={type.color}
                            shape={CustomBarShape}
                            onClick={handleBarClick}   // ✅ 막대 클릭
                            cursor="pointer"           // ✅ 포인터
                        />
                    ))}

{/* 순수 작업시간 평균선 */}
<Line
    type="monotone"
    dataKey={() => averageWorkTime}
    stroke="#ef4444"
    strokeWidth={1}
    strokeDasharray="6 6"
    dot={false}
    activeDot={false}          // ✅ hover 시 빨간 원 제거
    isAnimationActive={false}
/>

{/* 평균선 AVG 라벨 */}
<ReferenceLine
    y={averageWorkTime}
    stroke="transparent"
    label={{
        value: `AVG=${averageWorkTime}`,
        position: "insideRight",
        offset: 10,
        dy: -8,                 // ✅ 위로 이동 (겹침 해결)
        fill: "#ef4444",
        fontSize: 12,
        fontWeight: 600,
    }}
/>
{/* ✅ 지난달 데이터 점 표시 (이번달 막대의 중간 높이) */}
{showLastMonth && (
    <Line
        type="linear"
        dataKey="lastWork"
        stroke="#d1d5db"          // ✅ 연한 회색
        strokeWidth={2}
        dot={{ r: 4, fill: "#d1d5db" }}   // ✅ 연한 회색
        activeDot={{ r: 5 }}
        connectNulls={false}
        isAnimationActive={false}
    />
)}
                </BarChart>
            </ResponsiveContainer>
        </div>



    </div>
) : (
    <div className="h-[300px] w-full bg-gray-100 rounded-xl animate-pulse" />
)}



        </div>
    )}
</div>

                            {/* ✅ 사유 섹션 (막대 클릭 시 표시) */}
                            <div
                                className={[
                                    "bg-white border border-gray-200 rounded-2xl px-7 overflow-hidden",
                                    "transition-all duration-300 ease-out",
                                    reasonTargetName
                                        ? "max-h-[260px] opacity-100 translate-y-0 py-6"
                                        : "max-h-0 opacity-0 -translate-y-2 py-0 border-transparent",
                                ].join(" ")}
                            >
                                {reasonTargetName && (
                                    <>
                                        <div className="flex items-center justify-between gap-3 mb-3">
                                        <h2 className="text-lg font-semibold text-gray-800">
                                                {reasonTargetName} 사유 ({selectedMonthNum}월)
                                            </h2>


                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={handleReasonSave}
                                                    className="px-3 py-1.5 rounded-lg text-[13px] font-semibold bg-gray-900 text-white hover:bg-gray-800 transition"
                                                >
                                                    저장
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={handleReasonClose}
                                                    className="px-3 py-1.5 rounded-lg text-[13px] font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition"
                                                >
                                                    닫기
                                                </button>
                                            </div>
                                            </div>

<div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                                            {/* 왼쪽: 개인 사유 */}
                                            <div className="flex flex-col gap-2">
                                                <div className="text-sm font-semibold text-gray-700">
                                                    개인 사유
                                                </div>
                                                <textarea
                                                    value={reasonText}
                                                    onChange={(e) => setReasonText(e.target.value)}
                                                    placeholder="개인 사유를 입력하세요."
                                                    className="w-full h-[140px] resize-none rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200"
                                                />
                                            </div>

                                            {/* 오른쪽: 공무팀 사유 */}
                                            <div className="flex flex-col gap-2">
                                                <div className="text-sm font-semibold text-gray-700">
                                                    공무팀 사유
                                                </div>
                                                <textarea
                                                    value={reasonGovText}
                                                    onChange={(e) => setReasonGovText(e.target.value)}
                                                    placeholder="공무팀 사유를 입력하세요."
                                                    className="w-full h-[140px] resize-none rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200"
                                                />
                                            </div>
                                        </div>


                                    </>
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


