import { useMemo, useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/common/Header";
import Button from "../../components/common/Button";
import VacationManagementSection from "../../components/sections/VacationManagementSection";
import VacationRequestModal from "../../components/ui/VacationRequestModal";
import VacationSkeleton from "../../components/common/VacationSkeleton";
import { IconPlus } from "../../components/icons/Icons";
import { useAuth } from "../../store/auth";
import { supabase } from "../../lib/supabase";
import {
    createVacation,
    updateVacation,
    deleteVacation,
    getVacations,
    getVacationStats,
    getVacationGrantHistory,
    getCurrentTotalAnnualLeave,
    statusToKorean,
    leaveTypeToKorean,
    formatVacationDate,
    type Vacation,
    type VacationStatus as ApiVacationStatus,
} from "../../lib/vacationApi";
import type { VacationGrantHistory } from "../../lib/vacationCalculator";

export type VacationStatus = "대기 중" | "승인 완료" | "반려";

export interface VacationRow {
    id: string;
    period: string;
    item: string;
    reason: string;
    status: VacationStatus;
    usedDays: number; // -1, -0.5
    remainDays: number; // 12, 13.5
}

export interface GrantExpireRow {
    id: string;
    monthLabel: string;
    granted?: number;
    expired?: number;
    used?: number;
    balance?: number;
}

export default function VacationPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [searchParams, setSearchParams] = useSearchParams();
    const [userPosition, setUserPosition] = useState<string | null>(null);
    const [userRole, setUserRole] = useState<string | null>(null);
    const [userDepartment, setUserDepartment] = useState<string | null>(null);

    // 사용자 권한 확인 및 리다이렉트
    useEffect(() => {
        const checkUserRole = async () => {
            if (!user?.id) return;
            
            const { data: profile } = await supabase
                .from("profiles")
                .select("position, role, department")
                .eq("id", user.id)
                .single();

            if (profile) {
                setUserPosition(profile.position);
                setUserRole(profile.role);
                setUserDepartment(profile.department);

                // 대표님인 경우 승인 페이지로 리다이렉트
                if (profile.position === "대표") {
                    navigate("/vacation/admin", { replace: true });
                }
            }
        };

        checkUserRole();
    }, [user?.id, navigate]);

    // 연도 필터 / 탭 상태
    const [year, setYear] = useState(() => {
        return String(new Date().getFullYear());
    });
    const [tab, setTab] = useState<"사용 내역" | "지급/소멸 내역">("사용 내역");
    const [page, setPage] = useState(1);

    const [modalOpen, setModalOpen] = useState(false);
    const [editingVacation, setEditingVacation] = useState<VacationRow | null>(null);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [vacations, setVacations] = useState<Vacation[]>([]);
    const [summary, setSummary] = useState({
        myAnnual: 0,
        granted: 0,
        used: 0,
        expired: 0,
    });
    const [grantHistory, setGrantHistory] = useState<VacationGrantHistory[]>([]);

    // URL 파라미터로 모달 열기 및 날짜 설정
    const [initialDate, setInitialDate] = useState<string | null>(null);
    
    useEffect(() => {
        if (searchParams.get("openModal") === "true") {
            setModalOpen(true);
            const dateParam = searchParams.get("date");
            if (dateParam) {
                setInitialDate(dateParam);
            }
            searchParams.delete("openModal");
            searchParams.delete("date");
            setSearchParams(searchParams, { replace: true });
        }
    }, [searchParams, setSearchParams]);

    // 휴가 목록 조회
    useEffect(() => {
        if (!user?.id) return;

        const fetchVacations = async () => {
            setLoading(true);
            try {
                const yearNum = parseInt(year);
                const data = await getVacations(user.id, { year: yearNum });
                setVacations(data);

                // 통계 조회
                const stats = await getVacationStats(user.id, yearNum);
                
                // 지급/소멸 내역 조회 (해당 연도만)
                const history = await getVacationGrantHistory(user.id, yearNum);
                setGrantHistory(history);
                
                // 지급 총합 계산 (해당 연도만)
                const totalGranted = history.reduce((sum, h) => sum + (h.granted || 0), 0);
                const totalExpired = Math.abs(history.reduce((sum, h) => sum + (h.expired || 0), 0));
                
                // 현재 날짜 기준 총 연차 계산 (연도 무관)
                const currentTotal = await getCurrentTotalAnnualLeave(user.id);
                
                setSummary({
                    myAnnual: currentTotal, // 항상 현재 날짜 기준 총 연차
                    granted: totalGranted || stats.total || 0, // 해당 연도 지급
                    used: stats.used, // 해당 연도 사용
                    expired: totalExpired, // 해당 연도 소멸
                });
            } catch (error) {
                console.error("휴가 목록 조회 실패:", error);
                alert("휴가 목록을 불러오는데 실패했습니다.");
            } finally {
                setLoading(false);
            }
        };

        fetchVacations();
    }, [user?.id, year]);

    // API 데이터를 VacationRow 형식으로 변환
    const rows: VacationRow[] = useMemo(() => {
        return vacations.map((vacation, index) => {
            const usedDays = vacation.leave_type === "FULL" ? -1 : -0.5;

            // 남은 연차 계산 (간단한 로직, 실제로는 누적 계산 필요)
            const approvedVacations = vacations
                .filter(
                    (v) =>
                        v.status === "approved" && vacations.indexOf(v) <= index
                )
                .reduce(
                    (sum, v) => sum + (v.leave_type === "FULL" ? 1 : 0.5),
                    0
                );
            const remainDays = summary.myAnnual - approvedVacations;

            return {
                id: vacation.id,
                period: formatVacationDate(vacation.date),
                item: leaveTypeToKorean(vacation.leave_type),
                reason: vacation.reason,
                status: statusToKorean(vacation.status) as VacationStatus,
                usedDays,
                remainDays: Math.max(0, remainDays),
            };
        });
    }, [vacations, summary.myAnnual]);

    // 지급/소멸 내역 변환
    const grantExpireRows = useMemo<GrantExpireRow[]>(() => {
        return grantHistory.map((h, index) => {
            const date = new Date(h.date);
            const month = date.getMonth() + 1;
            const day = date.getDate();
            
            return {
                id: `grant-${index}`,
                monthLabel: `${month}월 ${day}일`,
                granted: h.granted,
                expired: h.expired,
            };
        });
    }, [grantHistory]);

    // 간단 페이징(1페이지 10개 고정)
    const itemsPerPage = 10;
    const totalPages = Math.ceil(rows.length / itemsPerPage);
    const paginatedRows = rows.slice(
        (page - 1) * itemsPerPage,
        page * itemsPerPage
    );

    const handleRegister = () => {
        setEditingVacation(null);
        setModalOpen(true);
    };

    const handleEdit = (row: VacationRow) => {
        const vacation = vacations.find(v => v.id === row.id);
        if (vacation) {
            setEditingVacation(row);
            setModalOpen(true);
        }
    };

    const handleDelete = (row: VacationRow) => {
        setDeleteTargetId(row.id);
        setDeleteConfirmOpen(true);
    };

    const confirmDelete = async () => {
        if (!deleteTargetId || !user?.id) return;

        try {
            setLoading(true);
            await deleteVacation(deleteTargetId, user.id);
            alert("휴가가 삭제되었습니다.");
            setDeleteConfirmOpen(false);
            setDeleteTargetId(null);

            // 목록 새로고침
            const yearNum = parseInt(year);
            const data = await getVacations(user.id, { year: yearNum });
            setVacations(data);

            const stats = await getVacationStats(user.id, yearNum);
            
            // 지급/소멸 내역 조회
            const history = await getVacationGrantHistory(user.id, yearNum);
            setGrantHistory(history);
            
            // 지급 총합 계산
            const totalGranted = history.reduce((sum, h) => sum + (h.granted || 0), 0);
            const totalExpired = Math.abs(history.reduce((sum, h) => sum + (h.expired || 0), 0));
            
            setSummary({
                myAnnual: stats.total || 0,
                granted: totalGranted || stats.total || 0,
                used: stats.used,
                expired: totalExpired,
            });
        } catch (error: any) {
            console.error("휴가 삭제 실패:", error);
            alert(error.message || "휴가 삭제에 실패했습니다.");
        } finally {
            setLoading(false);
        }
    };

    const handleVacationSubmit = async (payload: {
        date: string;
        leaveType: "FULL" | "AM" | "PM";
        reason: string;
    }) => {
        if (!user?.id) {
            alert("로그인이 필요합니다.");
            return;
        }

        try {
            setLoading(true);
            
            if (editingVacation) {
                // 수정 모드
                await updateVacation(
                    editingVacation.id,
                    {
                        date: payload.date,
                        leave_type: payload.leaveType,
                        reason: payload.reason,
                    },
                    user.id
                );
                alert("휴가가 수정되었습니다.");
            } else {
                // 신청 모드
                await createVacation({
                    user_id: user.id,
                    date: payload.date,
                    leave_type: payload.leaveType,
                    reason: payload.reason,
                });
                alert("휴가 신청이 완료되었습니다.");
            }

            setModalOpen(false);
            setEditingVacation(null);

            // 목록 새로고침
            const yearNum = parseInt(year);
            const data = await getVacations(user.id, { year: yearNum });
            setVacations(data);

            const stats = await getVacationStats(user.id, yearNum);
            setSummary({
                myAnnual: stats.total || 15,
                granted: stats.total || 0,
                used: stats.used,
                expired: 0,
            });
        } catch (error: any) {
            console.error("휴가 처리 실패:", error);
            alert(error.message || (editingVacation ? "휴가 수정에 실패했습니다." : "휴가 신청에 실패했습니다."));
        } finally {
            setLoading(false);
        }
    };

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
                    title="휴가 관리"
                    onMenuClick={() => setSidebarOpen(true)}
                    rightContent={
                        <Button
                            variant="primary"
                            size="lg"
                            onClick={handleRegister}
                            icon={<IconPlus />}
                            disabled={loading || !user}
                        >
                            휴가 등록
                        </Button>
                    }
                />

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-9 py-6 md:py-9">
                    <div className="flex flex-col gap-4 md:gap-6 w-full">
                        {loading ? (
                            <VacationSkeleton />
                        ) : (
                            <>
                                <VacationManagementSection
                                    summary={summary}
                                    year={year}
                                    onYearChange={setYear}
                                    tab={tab}
                                    onTabChange={setTab}
                                    rows={paginatedRows}
                                    grantExpireRows={grantExpireRows}
                                    page={page}
                                    totalPages={totalPages}
                                    onPageChange={setPage}
                                    onEdit={handleEdit}
                                    onDelete={handleDelete}
                                />

                                <VacationRequestModal
                                    isOpen={modalOpen}
                                    onClose={() => {
                                        setModalOpen(false);
                                        setEditingVacation(null);
                                        setInitialDate(null);
                                    }}
                                    availableDays={summary.myAnnual}
                                    onSubmit={handleVacationSubmit}
                                    editingVacation={editingVacation ? vacations.find(v => v.id === editingVacation.id) || null : null}
                                    initialDate={initialDate}
                                />

                                {deleteConfirmOpen && (
                                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                                        <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4">
                                            <h3 className="text-lg font-semibold text-gray-900 mb-4">
                                                휴가 삭제
                                            </h3>
                                            <p className="text-gray-600 mb-6">
                                                정말로 이 휴가를 삭제하시겠습니까?
                                            </p>
                                            <div className="flex gap-3 justify-end">
                                                <Button
                                                    variant="outline"
                                                    size="lg"
                                                    onClick={() => {
                                                        setDeleteConfirmOpen(false);
                                                        setDeleteTargetId(null);
                                                    }}
                                                >
                                                    취소
                                                </Button>
                                                <Button
                                                    variant="primary"
                                                    size="lg"
                                                    onClick={confirmDelete}
                                                    disabled={loading}
                                                >
                                                    삭제
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
