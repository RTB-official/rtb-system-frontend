import { useMemo, useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/common/Header";
import Button from "../../components/common/Button";
import Table from "../../components/common/Table";
import {
    getVacations,
    updateVacationStatus,
    formatVacationDate,
    leaveTypeToKorean,
    statusToKorean,
    type Vacation,
    type VacationStatus,
} from "../../lib/vacationApi";
import { useAuth } from "../../store/auth";
import { supabase } from "../../lib/supabase";

// 전체 통계 인터페이스
interface OverallStats {
    totalEmployees: number;
    totalUsedDays: number;
    totalPendingDays: number;
    totalRemainingDays: number;
}

// 직원별 통계
interface EmployeeStats {
    userId: string;
    userName: string;
    usedDays: number;
    pendingDays: number;
    remainingDays: number;
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
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [year, setYear] = useState(() => String(new Date().getFullYear()));
    const [loading, setLoading] = useState(false);

    // 전체 통계
    const [overallStats, setOverallStats] = useState<OverallStats>({
        totalEmployees: 0,
        totalUsedDays: 0,
        totalPendingDays: 0,
        totalRemainingDays: 0,
    });

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
    const fetchEmployees = async (allVacations: Vacation[]): Promise<{ id: string; name: string }[]> => {
        try {
            // vacations 테이블에서 고유한 user_id 추출
            const userIds = new Set(allVacations.map(v => v.user_id));
            const employeeList: { id: string; name: string }[] = [];
            
            // 각 user_id에 대해 profiles 테이블에서 이름 가져오기
            for (const userId of Array.from(userIds)) {
                try {
                    const { data: profile } = await supabase
                        .from("profiles")
                        .select("id, name, email")
                        .eq("id", userId)
                        .single();
                    
                    if (profile) {
                        employeeList.push({
                            id: profile.id,
                            name: profile.name || profile.email || "알 수 없음",
                        });
                    } else {
                        employeeList.push({
                            id: userId,
                            name: `User ${userId.substring(0, 8)}`,
                        });
                    }
                } catch {
                    // 프로필이 없으면 기본값 사용
                    employeeList.push({
                        id: userId,
                        name: `User ${userId.substring(0, 8)}`,
                    });
                }
            }
            
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
                setEmployeeMap(employeeNameMap);

                // 직원별 통계 계산
                const statsMap = new Map<string, EmployeeStats>();
                
                employees.forEach(emp => {
                    statsMap.set(emp.id, {
                        userId: emp.id,
                        userName: emp.name,
                        usedDays: 0,
                        pendingDays: 0,
                        remainingDays: 15, // 기본 연차 15일
                    });
                });

                // 기존 통계에 없는 직원도 추가 (휴가 기록이 없는 직원)
                allVacations.forEach(vacation => {
                    if (!statsMap.has(vacation.user_id)) {
                        const name = employeeNameMap.get(vacation.user_id) || "알 수 없음";
                        statsMap.set(vacation.user_id, {
                            userId: vacation.user_id,
                            userName: name,
                            usedDays: 0,
                            pendingDays: 0,
                            remainingDays: 15,
                        });
                    }
                });

                allVacations.forEach(vacation => {
                    const days = vacation.leave_type === "FULL" ? 1 : 0.5;
                    const stats = statsMap.get(vacation.user_id);
                    
                    if (stats) {
                        if (vacation.status === "approved") {
                            stats.usedDays += days;
                        } else if (vacation.status === "pending") {
                            stats.pendingDays += days;
                        }
                        stats.remainingDays = 15 - stats.usedDays;
                    }
                });

                const employeeStatsList = Array.from(statsMap.values());
                setEmployeeStats(employeeStatsList);

                // 전체 통계 계산
                const totalUsed = employeeStatsList.reduce((sum, stat) => sum + stat.usedDays, 0);
                const totalPending = employeeStatsList.reduce((sum, stat) => sum + stat.pendingDays, 0);
                const totalRemaining = employeeStatsList.reduce((sum, stat) => sum + stat.remainingDays, 0);

                setOverallStats({
                    totalEmployees: employees.length,
                    totalUsedDays: totalUsed,
                    totalPendingDays: totalPending,
                    totalRemainingDays: totalRemaining,
                });

                // 대기 중인 휴가만 필터링
                const pending = allVacations.filter(v => v.status === "pending");
                setPendingVacations(pending);
            } catch (error) {
                console.error("데이터 로드 실패:", error);
                alert("데이터를 불러오는데 실패했습니다.");
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
            await updateVacationStatus(
                selectedVacation.id,
                approved ? "approved" : "rejected",
                user.id
            );

            alert(approved ? "휴가가 승인되었습니다." : "휴가가 반려되었습니다.");
            setDetailModalOpen(false);
            setSelectedVacation(null);

            // 목록 새로고침
            const yearNum = parseInt(year);
            const allVacations = await getVacations(undefined, { year: yearNum });
            const pending = allVacations.filter(v => v.status === "pending");
            setPendingVacations(pending);
        } catch (error: any) {
            console.error("처리 실패:", error);
            alert(error.message || "처리에 실패했습니다.");
        } finally {
            setLoading(false);
        }
    };

    // 통계 카드
    const statsCards = [
        {
            label: "전체 직원",
            value: `${overallStats.totalEmployees}명`,
            color: "text-gray-900",
        },
        {
            label: "전체 사용 일수",
            value: `${overallStats.totalUsedDays.toFixed(1)}일`,
            color: "text-blue-600",
        },
        {
            label: "대기 중",
            value: `${overallStats.totalPendingDays.toFixed(1)}일`,
            color: "text-yellow-600",
        },
        {
            label: "전체 잔여 일수",
            value: `${overallStats.totalRemainingDays.toFixed(1)}일`,
            color: "text-green-600",
        },
    ];

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
          ${
              sidebarOpen
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
                    <div className="flex flex-col gap-6 w-full">
                        {/* 통계 카드 */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            {statsCards.map((card) => (
                                <div
                                    key={card.label}
                                    className="bg-gray-50 rounded-2xl p-5"
                                >
                                    <div className="text-[13px] font-semibold text-gray-500">
                                        {card.label}
                                    </div>
                                    <div className={`mt-2 text-[26px] font-bold ${card.color}`}>
                                        {card.value}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* 연도 선택 */}
                        <div className="flex items-center gap-4">
                            <div className="text-[24px] font-semibold text-gray-900">
                                조회 기간
                            </div>
                            <select
                                value={year}
                                onChange={(e) => setYear(e.target.value)}
                                className="px-4 py-2 border border-gray-300 rounded-lg text-sm"
                            >
                                <option value="2025">2025년</option>
                                <option value="2024">2024년</option>
                                <option value="2023">2023년</option>
                            </select>
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
                                                        className={`border-b border-gray-100 transition-colors ${
                                                            isSelected
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

