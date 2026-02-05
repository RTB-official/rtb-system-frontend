// AdminVacationPage.tsx
import { useMemo, useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/common/Header";
import Button from "../../components/common/Button";
import Table from "../../components/common/Table";
import AdminVacationSkeleton from "../../components/common/skeletons/AdminVacationSkeleton";
import Select from "../../components/common/Select";
import {
    getVacations,
    updateVacationStatus,
    formatVacationDate,
    leaveTypeToKorean,
    statusToKorean,
    calculateAllEmployeesVacation,
    getCurrentTotalAnnualLeave,
    type Vacation,
} from "../../lib/vacationApi";
import { useAuth } from "../../store/auth";
import { supabase } from "../../lib/supabase";
import { calculateAnnualLeave } from "../../lib/vacationCalculator";
import { useToast } from "../../components/ui/ToastProvider";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import useIsMobile from "../../hooks/useIsMobile";
import { IconChevronLeft, IconChevronRight } from "../../components/icons/Icons";
import Avatar from "../../components/common/Avatar";
import { ROLE_ORDER } from "../Members/constants";

// 직원별 통계
interface EmployeeStats {
    userId: string;
    userName: string;
    usedDays: number;
    pendingDays: number;
    remainingDays: number;
    totalDays: number;
}

// 휴가 신청 행 데이터
interface VacationRequestRow {
    id: string;
    employeeName: string;
    period: string;
    item: string;
    reason: string;
    status: string;
    createdAt: string;
    vacation: Vacation;
}

export default function AdminVacationPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { showSuccess, showError } = useToast();
    const isMobile = useIsMobile();
    const employeeIdFromParams = searchParams.get("employee");
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [year, setYear] = useState(() => String(new Date().getFullYear()));
    const [loading, setLoading] = useState(false);
    const [calculateConfirmOpen, setCalculateConfirmOpen] = useState(false);

    // 직원별 통계
    const [employeeStats, setEmployeeStats] = useState<EmployeeStats[]>([]);

    // 직원 이름 매핑
    const [employeeMap, setEmployeeMap] = useState<Map<string, string>>(new Map());
    // 직원 프로필 (Avatar용: email, position)
    const [employeeProfiles, setEmployeeProfiles] = useState<Map<string, { email: string | null; position: string | null }>>(new Map());

    // 선택된 직원 ID (필터링용)
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);

    // 휴가 신청 목록
    const [pendingVacations, setPendingVacations] = useState<Vacation[]>([]);
    const [selectedVacation, setSelectedVacation] = useState<Vacation | null>(null);
    const [detailModalOpen, setDetailModalOpen] = useState(false);
    const [page, setPage] = useState(1);
    const itemsPerPage = 10;

    // 직원별 휴가 신청 내역 상세 모달 (구성원 지출관리 포맷)
    const [vacationDetailEmployeeId, setVacationDetailEmployeeId] = useState<string | null>(null);
    const [employeeVacationHistory, setEmployeeVacationHistory] = useState<Vacation[]>([]);
    const [employeeHistoryLoading, setEmployeeHistoryLoading] = useState(false);

    // 어드민(공무팀) 프로필만 조회 (공사팀 제외)
    const fetchAllProfiles = async (): Promise<{ id: string; name: string; joinDate?: string; email: string | null; position: string | null }[]> => {
        try {
            const { data: profiles, error } = await supabase
                .from("profiles")
                .select("id, name, email, join_date, position")
                .eq("role", "admin");

            if (error) {
                console.error("어드민 프로필 조회 실패:", error);
                return [];
            }

            const list = (profiles || [])
                .map((p: { id: string; name?: string; email?: string | null; join_date?: string | null; position?: string | null }) => ({
                    id: p.id,
                    name: p.name || (p.email as string) || "알 수 없음",
                    joinDate: p.join_date || undefined,
                    email: p.email ?? null,
                    position: p.position ?? null,
                }))
                .filter((emp) => emp.name !== "김영");
            return list.sort((a, b) => {
                const orderA = ROLE_ORDER[a.position ?? ""] ?? 999;
                const orderB = ROLE_ORDER[b.position ?? ""] ?? 999;
                if (orderA !== orderB) return orderA - orderB;
                return a.name.localeCompare(b.name);
            });
        } catch (error) {
            console.error("전체 프로필 조회 실패:", error);
            return [];
        }
    };

    // 전체 휴가 데이터 로드
    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                const yearNum = parseInt(year);

                // 모든 직원의 휴가 조회
                const allVacations = await getVacations(undefined, { year: yearNum });

                const employees = await fetchAllProfiles();
                const employeeNameMap = new Map(employees.map(emp => [emp.id, emp.name]));
                const profileMap = new Map(employees.map(emp => [emp.id, { email: emp.email, position: emp.position }]));
                setEmployeeMap(employeeNameMap);
                setEmployeeProfiles(profileMap);

                // 직원별 통계 계산
                const statsMap = new Map<string, EmployeeStats>();

                const annualLeavePromises = employees.map(async (emp) => {
                    let totalDays = 15;
                    if (emp.joinDate) {
                        try {
                            totalDays = await getCurrentTotalAnnualLeave(emp.id);
                            const approvedVacations = allVacations.filter(
                                v => v.user_id === emp.id && v.status === "approved"
                            );
                            const usedDays = approvedVacations.reduce(
                                (sum, v) => sum + (v.leave_type === "FULL" ? 1 : 0.5),
                                0
                            );
                            totalDays = totalDays + usedDays;
                        } catch (error) {
                            console.error(`직원 ${emp.id} 연차 계산 실패:`, error);
                            totalDays = calculateAnnualLeave(emp.joinDate!, yearNum);
                        }
                    }
                    return { empId: emp.id, totalDays };
                });

                // 모든 연차 계산 완료 대기
                const annualLeaveResults = await Promise.all(annualLeavePromises);
                const annualLeaveMap = new Map(annualLeaveResults.map(r => [r.empId, r.totalDays]));

                // 통계 초기화
                for (const emp of employees) {
                    const totalDays = annualLeaveMap.get(emp.id) || 15;
                    statsMap.set(emp.id, {
                        userId: emp.id,
                        userName: emp.name,
                        usedDays: 0,
                        pendingDays: 0,
                        remainingDays: totalDays,
                        totalDays: totalDays,
                    });
                }

                allVacations.forEach(vacation => {
                    const days = vacation.leave_type === "FULL" ? 1 : 0.5;
                    const stats = statsMap.get(vacation.user_id);

                    if (stats) {
                        if (vacation.status === "approved") {
                            stats.usedDays += days;
                        } else if (vacation.status === "pending") {
                            stats.pendingDays += days;
                        }
                    }
                });

                // 모든 직원의 잔여일수 재계산 (사용한 것과 대기 중인 것을 모두 차감)
                statsMap.forEach((stats) => {
                    stats.remainingDays = Math.max(0, stats.totalDays - stats.usedDays - stats.pendingDays);
                });

                const employeeStatsList = Array.from(statsMap.values());
                setEmployeeStats(employeeStatsList);

                // 대기 중인 휴가만 필터링
                const pending = allVacations.filter(v => v.status === "pending");
                setPendingVacations(pending);
            } catch (error) {
                console.error("데이터 로드 실패:", error);
                showError("데이터를 불러오는데 실패했습니다.");
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [year]);

    // 모바일: URL 쿼리(employee)와 상세 직원 동기화
    useEffect(() => {
        if (!isMobile) return;
        if (employeeIdFromParams) {
            setVacationDetailEmployeeId(employeeIdFromParams);
            setSelectedEmployeeId(employeeIdFromParams);
        } else {
            setVacationDetailEmployeeId(null);
        }
    }, [isMobile, employeeIdFromParams]);

    // 직원별 휴가 신청 내역 로드 (상세 모달/드롭다운/모바일 페이지용)
    useEffect(() => {
        if (!vacationDetailEmployeeId || !year) return;
        const yearNum = parseInt(year);
        setEmployeeHistoryLoading(true);
        getVacations(vacationDetailEmployeeId, { year: yearNum })
            .then((list) => setEmployeeVacationHistory(list))
            .catch(() => setEmployeeVacationHistory([]))
            .finally(() => setEmployeeHistoryLoading(false));
    }, [vacationDetailEmployeeId, year]);

    // 휴가 신청 목록: 대기 중인 건만, 신청한 순(최신 먼저)
    const requestRows: VacationRequestRow[] = useMemo(() => {
        const sorted = [...pendingVacations].sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        return sorted.map(vacation => ({
            id: vacation.id,
            employeeName: employeeMap.get(vacation.user_id) || "알 수 없음",
            period: formatVacationDate(vacation.date),
            item: leaveTypeToKorean(vacation.leave_type),
            reason: vacation.reason,
            status: statusToKorean(vacation.status),
            createdAt: new Date(vacation.created_at).toLocaleDateString("ko-KR"),
            vacation,
        }));
    }, [pendingVacations, employeeMap]);

    // 페이징
    const totalPages = Math.ceil(requestRows.length / itemsPerPage);
    const paginatedRows = requestRows.slice(
        (page - 1) * itemsPerPage,
        page * itemsPerPage
    );

    // 휴가 상세보기
    const handleRowClick = (row: VacationRequestRow) => {
        setSelectedVacation(row.vacation);
        setDetailModalOpen(true);
    };

    // 승인/반려 처리
    const handleApproveReject = async (approved: boolean) => {
        if (!selectedVacation || !user?.id) return;

        try {
            setLoading(true);

            // 휴가 상태 업데이트
            await updateVacationStatus(
                selectedVacation.id,
                approved ? "approved" : "rejected",
                user.id
            );

            // 즉시 목록에서 제거 (UI 즉시 반영)
            const updatedPending = pendingVacations.filter(v => v.id !== selectedVacation.id);
            setPendingVacations(updatedPending);

            // 모달 닫기
            setDetailModalOpen(false);
            setSelectedVacation(null);

            showSuccess(approved ? "휴가가 승인되었습니다." : "휴가가 반려되었습니다.");

            // 백그라운드에서 전체 데이터 다시 로드 (통계 업데이트)
            const yearNum = parseInt(year);

            // 잠시 대기 후 DB에서 최신 데이터 조회 (업데이트 반영 시간 확보)
            await new Promise(resolve => setTimeout(resolve, 300));

            // 모든 직원의 휴가 조회
            const allVacations = await getVacations(undefined, { year: yearNum });

            // 대기 중인 휴가만 필터링 (최신 데이터로 업데이트)
            const pending = allVacations.filter(v => v.status === "pending");
            setPendingVacations(pending);

            const employees = await fetchAllProfiles();
            const employeeNameMap = new Map(employees.map(emp => [emp.id, emp.name]));
            setEmployeeMap(employeeNameMap);
            setEmployeeProfiles(new Map(employees.map(emp => [emp.id, { email: emp.email, position: emp.position }])));

            // 직원별 통계 재계산
            const statsMap = new Map<string, EmployeeStats>();

            for (const emp of employees) {
                const joinDate = emp.joinDate;
                let totalDays = 15; // 기본값

                if (joinDate) {
                    try {
                        totalDays = await getCurrentTotalAnnualLeave(emp.id);
                        // 지급받은 총 연차 계산
                        const approvedVacations = allVacations.filter(
                            v => v.user_id === emp.id && v.status === "approved"
                        );
                        const usedDays = approvedVacations.reduce(
                            (sum, v) => sum + (v.leave_type === "FULL" ? 1 : 0.5),
                            0
                        );
                        totalDays = totalDays + usedDays;
                    } catch (error) {
                        console.error(`직원 ${emp.id} 연차 계산 실패:`, error);
                        totalDays = calculateAnnualLeave(joinDate, yearNum);
                    }
                }

                // 해당 직원의 휴가 통계 계산
                const empVacations = allVacations.filter(v => v.user_id === emp.id);
                const usedDays = empVacations
                    .filter(v => v.status === "approved")
                    .reduce((sum, v) => sum + (v.leave_type === "FULL" ? 1 : 0.5), 0);
                const pendingDays = empVacations
                    .filter(v => v.status === "pending")
                    .reduce((sum, v) => sum + (v.leave_type === "FULL" ? 1 : 0.5), 0);

                statsMap.set(emp.id, {
                    userId: emp.id,
                    userName: emp.name,
                    usedDays,
                    pendingDays,
                    remainingDays: Math.max(0, totalDays - usedDays - pendingDays),
                    totalDays,
                });
            }

            setEmployeeStats(Array.from(statsMap.values()));
        } catch (error: any) {
            console.error("처리 실패:", error);
            showError(error.message || "처리에 실패했습니다.");

            // 에러 발생 시 목록 다시 조회
            if (user?.id) {
                const yearNum = parseInt(year);
                const allVacations = await getVacations(undefined, { year: yearNum });
                const pending = allVacations.filter(v => v.status === "pending");
                setPendingVacations(pending);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleCalculateAllVacations = () => {
        setCalculateConfirmOpen(true);
    };

    const confirmCalculateAllVacations = async () => {
        setCalculateConfirmOpen(false);

        try {
            setLoading(true);
            await calculateAllEmployeesVacation(2025);
            showSuccess("모든 직원의 연차 계산이 완료되었습니다.");
            // 데이터 새로고침
            const yearNum = parseInt(year);
            const allVacations = await getVacations(undefined, { year: yearNum });
            const employees = await fetchAllProfiles();
            const employeeNameMap = new Map(employees.map(emp => [emp.id, emp.name]));
            setEmployeeMap(employeeNameMap);
            setEmployeeProfiles(new Map(employees.map(emp => [emp.id, { email: emp.email, position: emp.position }])));

            const statsMap = new Map<string, EmployeeStats>();
            employees.forEach(emp => {
                const joinDate = emp.joinDate;
                const totalDays = joinDate
                    ? calculateAnnualLeave(joinDate, yearNum)
                    : 15;
                statsMap.set(emp.id, {
                    userId: emp.id,
                    userName: emp.name,
                    usedDays: 0,
                    pendingDays: 0,
                    remainingDays: totalDays,
                    totalDays: totalDays,
                });
            });

            allVacations.forEach(vacation => {
                if (!statsMap.has(vacation.user_id)) {
                    const name = employeeNameMap.get(vacation.user_id) || "알 수 없음";
                    const totalDays = 15;
                    statsMap.set(vacation.user_id, {
                        userId: vacation.user_id,
                        userName: name,
                        usedDays: 0,
                        pendingDays: 0,
                        remainingDays: totalDays,
                        totalDays: totalDays,
                    });
                }

                const stats = statsMap.get(vacation.user_id)!;
                const days = vacation.leave_type === "FULL" ? 1 : 0.5;

                if (vacation.status === "approved") {
                    stats.usedDays += days;
                } else if (vacation.status === "pending") {
                    stats.pendingDays += days;
                }
                stats.remainingDays = stats.totalDays - stats.usedDays - stats.pendingDays;
            });

            setEmployeeStats(Array.from(statsMap.values()));

            const pending = allVacations.filter(v => v.status === "pending");
            setPendingVacations(pending);
        } catch (error: any) {
            console.error("연차 계산 실패:", error);
            showError(error.message || "연차 계산에 실패했습니다.");
        } finally {
            setLoading(false);
        }
    };

    // 통계 카드

    return (
        <div className="flex h-screen bg-white overflow-hidden">
            {/* Mobile Overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-20 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <div
                className={`
          fixed lg:static inset-y-0 left-0 z-30
          w-[260px] max-w-[88vw] lg:max-w-none lg:w-[239px] h-screen shrink-0
          transform transition-transform duration-300 ease-in-out
          ${sidebarOpen
                        ? "translate-x-0"
                        : "-translate-x-full lg:translate-x-0"
                    }
        `}
            >
                <Sidebar onClose={() => setSidebarOpen(false)} />
            </div>

            {/* Main */}
            <div className="flex-1 flex flex-col h-screen overflow-hidden w-full">
                <Header
                    title="휴가 관리 (대표)"
                    onMenuClick={() => setSidebarOpen(true)}
                />

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-4 md:px-9 py-6 md:py-9">
                    {loading ? (
                        <AdminVacationSkeleton />
                    ) : isMobile && employeeIdFromParams ? (
                        /* 모바일: 직원 휴가 상세 새 페이지 */
                        <div className="flex flex-col">
                            <button
                                type="button"
                                onClick={() => navigate("/vacation/admin")}
                                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 py-2 -ml-1"
                            >
                                <IconChevronLeft className="w-5 h-5" />
                                <span className="text-sm font-medium">목록으로</span>
                            </button>
                            <div className="mb-3">
                                <p className="text-sm text-gray-500">{year}년</p>
                                <h2 className="text-xl font-semibold text-gray-800 mt-0.5">
                                    {employeeMap.get(employeeIdFromParams) ?? ""}님의 휴가 신청 내역
                                </h2>
                            </div>
                            {employeeHistoryLoading ? (
                                <div className="flex flex-col items-center justify-center py-20 gap-4">
                                    <div className="w-10 h-10 border-2 border-gray-200 border-t-gray-800 rounded-full animate-spin" />
                                    <p className="text-sm text-gray-500">로딩 중...</p>
                                </div>
                            ) : employeeVacationHistory.length === 0 ? (
                                <p className="text-gray-500 text-sm py-8 text-center rounded-2xl border border-dashed border-gray-200 bg-gray-50">
                                    해당 기간 휴가 신청 내역이 없습니다.
                                </p>
                            ) : (
                                <ul className="flex flex-col gap-2">
                                    {employeeVacationHistory.map((v) => {
                                        const label = statusToKorean(v.status);
                                        const statusBg = v.status === "approved" ? "bg-green-50 text-green-700" : v.status === "rejected" ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-600";
                                        return (
                                            <li key={v.id} className="rounded-xl border border-gray-200 p-4 flex flex-col gap-2">
                                                <div className="flex items-center justify-between flex-wrap gap-2">
                                                    <span className="text-sm text-gray-500">{new Date(v.created_at).toLocaleDateString("ko-KR")}</span>
                                                    <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-[12px] font-medium ${statusBg}`}>{label}</span>
                                                </div>
                                                <p className="font-medium text-gray-900">{formatVacationDate(v.date)} · {leaveTypeToKorean(v.leave_type)}</p>
                                                {v.reason && <p className="text-sm text-gray-700">{v.reason}</p>}
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2 w-full">
                            {/* 조회 기간 (한 줄) */}
                            <div className="flex flex-wrap items-center gap-4">
                                <span className="text-[24px] font-semibold text-gray-900 shrink-0">조회 기간</span>
                                <Select
                                    options={[
                                        { value: "2026", label: "2026년" },
                                        { value: "2025", label: "2025년" },
                                        { value: "2024", label: "2024년" },
                                        { value: "2023", label: "2023년" },
                                    ]}
                                    value={year}
                                    onChange={setYear}
                                    className="w-auto min-w-[100px]"
                                />
                            </div>

                            {/* 휴가 신청 내역 (들어온 신청이 있을 때만 표시) */}
                            {pendingVacations.length > 0 && (
                                <div>
                                    <div className="my-3">
                                        <h2 className="text-[20px] font-semibold text-gray-900 flex items-center gap-2">
                                            <span className="relative inline-block">
                                                휴가 신청 내역
                                                <span className="absolute left-full ml-[1px] w-1.5 h-1.5 bg-red-500 rounded-full" aria-hidden />
                                            </span>
                                        </h2>
                                    </div>
                                    {isMobile ? (
                                        <>
                                        <ul className="flex flex-col gap-2">
                                            {paginatedRows.map((row) => (
                                                <li key={row.id}>
                                                    <button
                                                        type="button"
                                                        className="w-full rounded-xl border border-gray-200 p-4 flex items-center gap-3 text-left active:bg-gray-50 transition-colors"
                                                        onClick={() => handleRowClick(row)}
                                                    >
                                                        <div className="flex-1 min-w-0 flex flex-col gap-1">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <span className="font-medium text-gray-900">{row.employeeName}</span>
                                                                <span className="inline-flex items-center justify-center px-2 py-0.5 rounded text-[12px] font-medium text-blue-600 bg-blue-50">
                                                                    {row.status}
                                                                </span>
                                                            </div>
                                                            <span className="text-sm text-gray-500">{row.period} · {row.item}</span>
                                                            {row.reason && <p className="text-sm text-gray-700 truncate">{row.reason}</p>}
                                                        </div>
                                                        <IconChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                        {totalPages > 1 && (
                                            <div className="flex items-center justify-center gap-2 mt-4">
                                                <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>이전</Button>
                                                <span className="text-sm text-gray-600">{page} / {totalPages}</span>
                                                <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>다음</Button>
                                            </div>
                                        )}
                                        </>
                                    ) : (
                                    <div className="overflow-x-auto">
                                        <Table
                                            columns={[
                                                { key: "employeeName", label: "직원명", width: "15%" },
                                                { key: "period", label: "기간", width: "20%" },
                                                { key: "item", label: "항목", width: "12%" },
                                                { key: "reason", label: "사유", width: "30%" },
                                                { key: "createdAt", label: "신청일", width: "13%" },
                                                {
                                                    key: "status",
                                                    label: "상태",
                                                    width: "10%",
                                                    render: (_value, row: VacationRequestRow) => (
                                                        <span className="inline-flex items-center justify-center px-2 py-1 rounded text-[12px] font-medium text-blue-600 bg-blue-50">
                                                            {row.status}
                                                        </span>
                                                    ),
                                                },
                                            ]}
                                            data={paginatedRows}
                                            rowKey="id"
                                            onRowClick={(row: VacationRequestRow) => handleRowClick(row)}
                                            className="cursor-pointer"
                                            emptyText="휴가 신청 내역이 없습니다."
                                            pagination={totalPages > 1 ? {
                                                currentPage: page,
                                                totalPages,
                                                onPageChange: setPage,
                                            } : undefined}
                                        />
                                    </div>
                                    )}
                                </div>
                            )}

                            {/* 직원별 휴가 사용 현황: 모바일 카드 리스트 / 웹 테이블+드롭다운 */}
                            <div className="md:mt-0">
                                <h2 className="text-[20px] font-semibold text-gray-900 my-3">
                                    직원별 휴가 사용 현황
                                </h2>
                                {!isMobile && (
                                    <p className="text-sm text-gray-500 mb-5">
                                        클릭하여 상세 내역을 확인하세요
                                    </p>
                                )}
                                {isMobile ? (
                                    <ul className="flex flex-col gap-2 pb-4">
                                        {employeeStats.length === 0 ? (
                                            <p className="py-8 text-center text-gray-500 text-sm">
                                                직원이 없습니다.
                                            </p>
                                        ) : (
                                            employeeStats.map((row) => {
                                                const profile = employeeProfiles.get(row.userId);
                                                return (
                                                <li key={row.userId}>
                                                    <button
                                                        type="button"
                                                        className="w-full rounded-xl border border-gray-200 p-4 flex items-center gap-3 text-left active:bg-gray-50 transition-colors"
                                                        onClick={() => navigate(`/vacation/admin?employee=${row.userId}`)}
                                                    >
                                                        <Avatar
                                                            email={profile?.email ?? null}
                                                            size={40}
                                                            position={profile?.position ?? null}
                                                        />
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-medium text-gray-900 truncate">{row.userName}</p>
                                                            <p className="text-sm text-gray-500 mt-0.5">
                                                                사용 {Number(row.usedDays).toFixed(1)}일 · 대기 {Number(row.pendingDays).toFixed(1)}일 · 잔여 {Number(row.remainingDays).toFixed(1)}일
                                                            </p>
                                                        </div>
                                                    </button>
                                                </li>
                                                );
                                            })
                                        )}
                                    </ul>
                                ) : (
                                <div className="overflow-x-auto">
                                    <Table<EmployeeStats>
                                    columns={[
                                        {
                                            key: "userName",
                                            label: "직원명",
                                            align: "left",
                                            headerClassName: "px-4 py-3 text-left font-semibold text-gray-600",
                                            cellClassName: "px-4 py-3 text-left",
                                            render: (_, row) => {
                                                const profile = employeeProfiles.get(row.userId);
                                                return (
                                                    <div className="flex items-center gap-2">
                                                        <Avatar
                                                            email={profile?.email ?? null}
                                                            size={24}
                                                            position={profile?.position ?? null}
                                                        />
                                                        <span className="font-medium text-gray-900">{row.userName}</span>
                                                    </div>
                                                );
                                            },
                                        },
                                        {
                                            key: "usedDays",
                                            label: "사용 일수",
                                            align: "left",
                                            headerClassName: "px-4 py-3 text-left font-semibold text-gray-600",
                                            cellClassName: "px-4 py-3 text-left",
                                            render: (value) => {
                                                if (value === null || value === undefined) return null;
                                                return `${Number(value).toFixed(1)}일`;
                                            },
                                        },
                                        {
                                            key: "pendingDays",
                                            label: "대기 중",
                                            align: "left",
                                            headerClassName: "px-4 py-3 text-left font-semibold text-gray-600",
                                            cellClassName: "px-4 py-3 text-left text-yellow-600",
                                            render: (value) => {
                                                if (value === null || value === undefined) return null;
                                                return `${Number(value).toFixed(1)}일`;
                                            },
                                        },
                                        {
                                            key: "remainingDays",
                                            label: "잔여 일수",
                                            align: "left",
                                            headerClassName: "px-4 py-3 text-left font-semibold text-gray-600",
                                            cellClassName: "px-4 py-3 text-left",
                                            render: (value) => {
                                                if (value === null || value === undefined) return null;
                                                return `${Number(value).toFixed(1)}일`;
                                            },
                                        },
                                    ]}
                                    data={employeeStats}
                                    rowKey={(row) => row.userId}
                                    rowClassName={(row) =>
                                        selectedEmployeeId === row.userId
                                            ? "bg-blue-50 hover:bg-blue-50"
                                            : "hover:bg-blue-50"
                                    }
                                    expandedRowKeys={vacationDetailEmployeeId ? [vacationDetailEmployeeId] : []}
                                    onRowClick={(row) => {
                                        setVacationDetailEmployeeId((prev) => (prev === row.userId ? null : row.userId));
                                        setSelectedEmployeeId(row.userId);
                                        setPage(1);
                                    }}
                                    expandableRowRender={(row) => {
                                        if (row.userId !== vacationDetailEmployeeId) return null;
                                        return (
                                            <div className="p-6 bg-gray-50">
                                                <div className="mb-2">
                                                    <p className="text-sm text-gray-500">{year}년</p>
                                                    <h3 className="text-lg font-semibold text-gray-800 mt-0.5">
                                                        {employeeMap.get(row.userId) ?? ""}님의 휴가 신청 내역
                                                    </h3>
                                                </div>
                                                {employeeHistoryLoading ? (
                                                    <div className="flex flex-col items-center justify-center py-12 gap-4">
                                                        <div className="w-8 h-8 border-2 border-gray-200 border-t-gray-800 rounded-full animate-spin" />
                                                        <p className="text-sm text-gray-500">로딩 중...</p>
                                                    </div>
                                                ) : employeeVacationHistory.length === 0 ? (
                                                    <p className="text-gray-500 text-sm py-6 text-center rounded-xl border border-dashed border-gray-200 bg-white">
                                                        해당 기간 휴가 신청 내역이 없습니다.
                                                    </p>
                                                ) : (
                                                    <div className="overflow-x-auto rounded-xl bg-white -mt-px">
                                                        <Table
                                                            columns={[
                                                                { key: "created_at", label: "신청일", width: "18%", render: (_: unknown, v: Vacation) => new Date(v.created_at).toLocaleDateString("ko-KR") },
                                                                { key: "date", label: "기간", width: "22%", render: (_: unknown, v: Vacation) => formatVacationDate(v.date) },
                                                                { key: "leave_type", label: "항목", width: "14%", render: (_: unknown, v: Vacation) => leaveTypeToKorean(v.leave_type) },
                                                                { key: "reason", label: "사유", width: "32%" },
                                                                {
                                                                    key: "status",
                                                                    label: "상태",
                                                                    width: "14%",
                                                                    render: (_: unknown, v: Vacation) => {
                                                                        const label = statusToKorean(v.status);
                                                                        const bg = v.status === "approved" ? "bg-green-50 text-green-700" : v.status === "rejected" ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-600";
                                                                        return <span className={`inline-flex items-center justify-center px-2 py-1 rounded text-[12px] font-medium ${bg}`}>{label}</span>;
                                                                    },
                                                                },
                                                            ]}
                                                            data={employeeVacationHistory}
                                                            rowKey="id"
                                                            className="border-0"
                                                            emptyText="해당 기간 휴가 신청 내역이 없습니다."
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    }}
                                    emptyText="사용한 휴가가 없습니다."
                                />
                                </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* 상세보기/승인 모달 */}
            {detailModalOpen && selectedVacation && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl p-6 max-w-md w-full">
                        <h3 className="text-[20px] font-semibold text-gray-900 mb-4">
                            휴가 신청 상세
                        </h3>

                        <div className="space-y-3 mb-6">
                            <div>
                                <div className="text-sm text-gray-500">직원명</div>
                                <div className="text-base font-medium text-gray-900">
                                    {employeeMap.get(selectedVacation.user_id) || "알 수 없음"}
                                </div>
                            </div>
                            <div>
                                <div className="text-sm text-gray-500">기간</div>
                                <div className="text-base font-medium text-gray-900">
                                    {formatVacationDate(selectedVacation.date)}
                                </div>
                            </div>
                            <div>
                                <div className="text-sm text-gray-500">항목</div>
                                <div className="text-base font-medium text-gray-900">
                                    {leaveTypeToKorean(selectedVacation.leave_type)}
                                </div>
                            </div>
                            <div>
                                <div className="text-sm text-gray-500">사유</div>
                                <div className="text-base text-gray-900">
                                    {selectedVacation.reason}
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <Button
                                variant="danger"
                                size="md"
                                fullWidth
                                onClick={() => handleApproveReject(false)}
                                disabled={loading}
                            >
                                반려
                            </Button>
                            <Button
                                variant="primary"
                                size="md"
                                fullWidth
                                onClick={() => handleApproveReject(true)}
                                disabled={loading}
                            >
                                승인
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmDialog
                isOpen={calculateConfirmOpen}
                onClose={() => setCalculateConfirmOpen(false)}
                onConfirm={confirmCalculateAllVacations}
                title="연차 일괄 계산"
                message={"모든 직원의 연차를 2025년부터 현재 연도까지 계산하시겠습니까?\n이 작업은 시간이 걸릴 수 있습니다."}
                confirmText="계산 시작"
                cancelText="취소"
            />
        </div>
    );
}
