//workloadPage.tsx
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/common/Header";
import PageContainer from "../../components/common/PageContainer";
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
import WorkloadChartSection from "./components/WorkloadChartSection";
import WorkloadReasonSection from "./components/WorkloadReasonSection";
import WorkloadTableSection from "./components/WorkloadTableSection";
import WorkloadXAxisTick from "./components/WorkloadXAxisTick";
import { useChartSize } from "./hooks/useChartSize";
import {
    TABLE_COLUMNS,
    Y_AXIS_INTERVAL,
} from "./workloadConstants";

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
    const [showLastMonth, setShowLastMonth] = useState(false);
    const { chartContainerRef, chartSize } = useChartSize(chartData.length);
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

    const CustomXAxisTick = useCallback(
        (props: any) => {
            const name = props?.payload?.value ?? "";
            return <WorkloadXAxisTick {...props} hasReason={namesWithReason.has(name)} />;
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

                {/* Content - 좌우 패딩은 PageContainer(모바일 16px) 적용 */}
                <main className="flex-1 overflow-auto pt-9 pb-20">
                    {loading ? (
                        <PageContainer><WorkloadSkeleton /></PageContainer>
                    ) : (
                        <PageContainer className="flex flex-col gap-6 w-full">
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
                            <WorkloadChartSection
                                chartData={chartData}
                                chartDataWithLastWork={chartDataWithLastWork}
                                chartContainerRef={chartContainerRef}
                                chartSize={chartSize}
                                showLastMonth={showLastMonth}
                                onToggleLastMonth={() => setShowLastMonth((v) => !v)}
                                onChartMouseMove={handleChartMouseMove}
                                onChartMouseLeave={() => setHoveredName(null)}
                                onChartClick={handleChartClick}
                                onBarClick={handleBarClick}
                                CustomXAxisTick={CustomXAxisTick}
                                maxYValue={maxYValue}
                                yAxisTicks={yAxisTicks}
                                averageWorkTime={averageWorkTime}
                            />

                            <WorkloadReasonSection
                                reasonTargetName={reasonTargetName}
                                selectedMonthNum={selectedMonthNum}
                                reasonText={reasonText}
                                reasonGovText={reasonGovText}
                                onReasonTextChange={setReasonText}
                                onReasonGovTextChange={setReasonGovText}
                                onSave={handleReasonSave}
                                onClose={handleReasonClose}
                            />

                            <WorkloadTableSection
                                columns={TABLE_COLUMNS}
                                tableData={tableData}
                                currentTableData={currentTableData}
                                totalPages={totalPages}
                                currentPage={currentPage}
                                onPageChange={setCurrentPage}
                                onRowClick={handleRowClick}
                            />
                        </PageContainer>
                    )}
                </main>
            </div>
        </div>
    );
}  
