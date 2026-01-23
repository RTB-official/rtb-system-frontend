import { useMemo, useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/common/Header";
import Button from "../../components/common/Button";
import Table from "../../components/common/Table";
import AdminVacationSkeleton from "../../components/common/AdminVacationSkeleton";
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
    const { showSuccess, showError } = useToast();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [year, setYear] = useState(() => String(new Date().getFullYear()));
    const [loading, setLoading] = useState(false);

    // 직원별 통계
    const [employeeStats, setEmployeeStats] = useState<EmployeeStats[]>([]);

    // 직원 이름 매핑
    const [employeeMap, setEmployeeMap] = useState<Map<string, string>>(new Map());

    // 선택된 직원 ID (필터링용)
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);

    // 휴가 신청 목록
    const [pendingVacations, setPendingVacations] = useState<Vacation[]>([]);
    const [selectedVacation, setSelectedVacation] = useState<Vacation | null>(null);
    const [detailModalOpen, setDetailModalOpen] = useState(false);
    const [page, setPage] = useState(1);
    const itemsPerPage = 10;

    // 직원 목록 가져오기 (vacations 테이블에서 user_id 추출 후 profiles에서 이름 조회)
    const fetchEmployees = async (allVacations: Vacation[]): Promise<{ id: string; name: string; joinDate?: string }[]> => {
        try {
            // vacations 테이블에서 고유한 user_id 추출
            const userIds = Array.from(new Set(allVacations.map(v => v.user_id).filter(Boolean)));

            if (userIds.length === 0) {
                return [];
            }

            // ✅ 배치 조회로 변경: 모든 프로필을 한 번에 조회
            const { data: profiles, error } = await supabase
                .from("profiles")
                .select("id, name, email, join_date")
                .in("id", userIds);

            if (error) {
                console.error("직원 목록 조회 실패:", error);
                // 에러 발생 시 기본값으로 반환
                return userIds.map(id => ({
                    id,
                    name: `User ${id.substring(0, 8)}`,
                }));
            }

            // 프로필 맵 생성
            const profileMap = new Map<string, { name: string; email: string | null; join_date: string | null }>();
            (profiles || []).forEach(profile => {
                if (profile.id) {
                    profileMap.set(profile.id, {
                        name: profile.name || "",
                        email: profile.email,
                        join_date: profile.join_date,
                    });
                }
            });

            // 직원 목록 생성
            const employeeList: { id: string; name: string; joinDate?: string }[] = userIds.map(userId => {
                const profile = profileMap.get(userId);
                if (profile) {
                    return {
                        id: userId,
                        name: profile.name || profile.email || "알 수 없음",
                        joinDate: profile.join_date || undefined,
                    };
                }
                return {
                    id: userId,
                    name: `User ${userId.substring(0, 8)}`,
                };
            });

            return employeeList.sort((a, b) => a.name.localeCompare(b.name));
        } catch (error) {
            console.error("직원 목록 조회 실패:", error);
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

                // 직원 목록 가져오기 (vacations에서 user_id 추출)
                const employees = await fetchEmployees(allVacations);
                const employeeNameMap = new Map(employees.map(emp => [emp.id, emp.name]));
                const employeeJoinDateMap = new Map(employees.map(emp => [emp.id, emp.joinDate]));
                setEmployeeMap(employeeNameMap);

                // 직원별 통계 계산
                const statsMap = new Map<string, EmployeeStats>();

                // ✅ 모든 직원의 연차를 병렬로 계산
                const allEmployeeIds = new Set([
                    ...employees.map(emp => emp.id),
                    ...allVacations.map(v => v.user_id).filter(Boolean),
                ]);

                // 병렬로 모든 직원의 연차 계산
                const annualLeavePromises = Array.from(allEmployeeIds).map(async (empId) => {
                    const emp = employees.find(e => e.id === empId);
                    const joinDate = emp?.joinDate || employeeJoinDateMap.get(empId);
                    let totalDays = 15; // 기본값

                    if (joinDate) {
                        // 현재 날짜 기준으로 모든 연도의 지급받은 연차 합산 (사용한 것 제외하지 않음)
                        try {
                            totalDays = await getCurrentTotalAnnualLeave(empId);
                            // getCurrentTotalAnnualLeave는 승인된 휴가를 차감하므로, 
                            // 지급받은 총 연차를 구하려면 승인된 휴가를 다시 더해야 함
                            const approvedVacations = allVacations.filter(
                                v => v.user_id === empId && v.status === "approved"
                            );
                            const usedDays = approvedVacations.reduce(
                                (sum, v) => sum + (v.leave_type === "FULL" ? 1 : 0.5),
                                0
                            );
                            totalDays = totalDays + usedDays; // 지급받은 총 연차
                        } catch (error) {
                            console.error(`직원 ${empId} 연차 계산 실패:`, error);
                            // 실패 시 해당 연도만 계산
                            totalDays = calculateAnnualLeave(joinDate, yearNum);
                        }
                    }

                    return { empId, totalDays };
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

                // 기존 통계에 없는 직원도 추가 (휴가 기록이 없는 직원)
                for (const vacation of allVacations) {
                    if (!statsMap.has(vacation.user_id)) {
                        const name = employeeNameMap.get(vacation.user_id) || "알 수 없음";
                        const joinDate = employeeJoinDateMap.get(vacation.user_id);
                        let totalDays = 15;

                        if (joinDate) {
                            try {
                                totalDays = await getCurrentTotalAnnualLeave(vacation.user_id);
                                // 지급받은 총 연차 계산
                                const approvedVacations = allVacations.filter(
                                    v => v.user_id === vacation.user_id && v.status === "approved"
                                );
                                const usedDays = approvedVacations.reduce(
                                    (sum, v) => sum + (v.leave_type === "FULL" ? 1 : 0.5),
                                    0
                                );
                                totalDays = totalDays + usedDays;
                            } catch (error) {
                                console.error(`직원 ${vacation.user_id} 연차 계산 실패:`, error);
                                totalDays = calculateAnnualLeave(joinDate, yearNum);
                            }
                        }

                        statsMap.set(vacation.user_id, {
                            userId: vacation.user_id,
                            userName: name,
                            usedDays: 0,
                            pendingDays: 0,
                            remainingDays: totalDays,
                            totalDays: totalDays,
                        });
                    }
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

    // 휴가 신청 목록을 테이블 행 형식으로 변환 (선택된 직원 필터링)
    const requestRows: VacationRequestRow[] = useMemo(() => {
        const filtered = selectedEmployeeId
            ? pendingVacations.filter(v => v.user_id === selectedEmployeeId)
            : pendingVacations;

        return filtered.map(vacation => ({
            id: vacation.id,
            employeeName: employeeMap.get(vacation.user_id) || "알 수 없음",
            period: formatVacationDate(vacation.date),
            item: leaveTypeToKorean(vacation.leave_type),
            reason: vacation.reason,
            status: statusToKorean(vacation.status),
            createdAt: new Date(vacation.created_at).toLocaleDateString("ko-KR"),
            vacation,
        }));
    }, [pendingVacations, employeeMap, selectedEmployeeId]);

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

            // 직원 목록 가져오기
            const employees = await fetchEmployees(allVacations);
            const employeeNameMap = new Map(employees.map(emp => [emp.id, emp.name]));
            const employeeJoinDateMap = new Map(employees.map(emp => [emp.id, emp.joinDate]));
            setEmployeeMap(employeeNameMap);

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

    // 모든 직원의 연차 계산 (2025년부터)
    const handleCalculateAllVacations = async () => {
        if (!confirm("모든 직원의 연차를 2025년부터 현재 연도까지 계산하시겠습니까?\n이 작업은 시간이 걸릴 수 있습니다.")) {
            return;
        }

        try {
            setLoading(true);
            await calculateAllEmployeesVacation(2025);
            showSuccess("모든 직원의 연차 계산이 완료되었습니다.");
            // 데이터 새로고침
            const yearNum = parseInt(year);
            const allVacations = await getVacations(undefined, { year: yearNum });
            const employees = await fetchEmployees(allVacations);
            const employeeNameMap = new Map(employees.map(emp => [emp.id, emp.name]));
            const employeeJoinDateMap = new Map(employees.map(emp => [emp.id, emp.joinDate]));
            setEmployeeMap(employeeNameMap);

            // 통계 재계산
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
                    const joinDate = employeeJoinDateMap.get(vacation.user_id);
                    const totalDays = joinDate
                        ? calculateAnnualLeave(joinDate, yearNum)
                        : 15;
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
          w-[239px] h-screen shrink-0
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
                <div className="flex-1 overflow-y-auto px-9 py-6 md:py-9">
                    {loading ? (
                        <AdminVacationSkeleton />
                    ) : (
                        <div className="flex flex-col gap-6 w-full">
                            {/* 연도 선택 */}
                            <div className="flex items-center gap-4">
                                <div className="text-[24px] font-semibold text-gray-900">
                                    조회 기간
                                </div>
                                <Select
                                    options={[
                                        { value: "2026", label: "2026년" },
                                        { value: "2025", label: "2025년" },
                                        { value: "2024", label: "2024년" },
                                        { value: "2023", label: "2023년" },
                                    ]}
                                    value={year}
                                    onChange={setYear}
                                />
                            </div>

                            {/* 직원별 통계 테이블 */}
                            <div>
                                <h2 className="text-[20px] font-semibold text-gray-900 mb-4">
                                    직원별 휴가 사용 현황
                                </h2>
                                <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                                    <table className="w-full text-[14px]">
                                        <thead className="bg-gray-100 border-b border-gray-200">
                                            <tr>
                                                <th className="px-4 py-3 text-left font-semibold text-gray-600">
                                                    직원명
                                                </th>
                                                <th className="px-4 py-3 text-right font-semibold text-gray-600">
                                                    사용 일수
                                                </th>
                                                <th className="px-4 py-3 text-right font-semibold text-gray-600">
                                                    대기 중
                                                </th>
                                                <th className="px-4 py-3 text-right font-semibold text-gray-600">
                                                    잔여 일수
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {employeeStats.length === 0 ? (
                                                <tr>
                                                    <td colSpan={4} className="px-4 py-10 text-center text-gray-500">
                                                        데이터가 없습니다.
                                                    </td>
                                                </tr>
                                            ) : (
                                                employeeStats.map((stat) => {
                                                    const isSelected = selectedEmployeeId === stat.userId;
                                                    return (
                                                        <tr
                                                            key={stat.userId}
                                                            className={`border-b border-gray-100 transition-colors ${isSelected
                                                                ? "bg-blue-50 hover:bg-blue-100"
                                                                : "hover:bg-gray-50"
                                                                }`}
                                                        >
                                                            <td
                                                                className="px-4 py-3 cursor-pointer font-medium text-blue-600 hover:text-blue-700"
                                                                onClick={() => {
                                                                    setSelectedEmployeeId(isSelected ? null : stat.userId);
                                                                    setPage(1); // 필터 변경 시 첫 페이지로
                                                                }}
                                                            >
                                                                {stat.userName}
                                                            </td>
                                                            <td className="px-4 py-3 text-right">{stat.usedDays.toFixed(1)}일</td>
                                                            <td className="px-4 py-3 text-right text-yellow-600">
                                                                {stat.pendingDays > 0 ? `${stat.pendingDays.toFixed(1)}일` : "-"}
                                                            </td>
                                                            <td className="px-4 py-3 text-right">{stat.remainingDays.toFixed(1)}일</td>
                                                        </tr>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* 휴가 신청 목록 */}
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-[20px] font-semibold text-gray-900">
                                        휴가 신청 내역
                                        {selectedEmployeeId && (
                                            <span className="ml-2 text-sm font-normal text-blue-600">
                                                ({employeeMap.get(selectedEmployeeId) || "선택된 직원"})
                                            </span>
                                        )}
                                    </h2>
                                    {selectedEmployeeId && (
                                        <button
                                            onClick={() => {
                                                setSelectedEmployeeId(null);
                                                setPage(1); // 필터 해제 시 첫 페이지로
                                            }}
                                            className="text-sm text-gray-500 hover:text-gray-700 underline"
                                        >
                                            필터 해제
                                        </button>
                                    )}
                                </div>
                                <Table
                                    columns={[
                                        {
                                            key: "employeeName",
                                            label: "직원명",
                                            width: "15%",
                                        },
                                        {
                                            key: "period",
                                            label: "기간",
                                            width: "20%",
                                        },
                                        {
                                            key: "item",
                                            label: "항목",
                                            width: "12%",
                                        },
                                        {
                                            key: "reason",
                                            label: "사유",
                                            width: "30%",
                                        },
                                        {
                                            key: "createdAt",
                                            label: "신청일",
                                            width: "13%",
                                        },
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
                                    pagination={{
                                        currentPage: page,
                                        totalPages,
                                        onPageChange: setPage,
                                    }}
                                />
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

                        <div className="flex gap-3">
                            <Button
                                variant="secondary"
                                size="md"
                                fullWidth
                                onClick={() => {
                                    setDetailModalOpen(false);
                                    setSelectedVacation(null);
                                }}
                            >
                                닫기
                            </Button>
                            <Button
                                variant="secondary"
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
        </div>
    );
}

