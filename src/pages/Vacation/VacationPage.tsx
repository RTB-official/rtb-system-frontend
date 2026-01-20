import { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/common/Header";
import Button from "../../components/common/Button";
import VacationManagementSection from "../../components/sections/VacationManagementSection";
import VacationRequestModal from "../../components/ui/VacationRequestModal";
import VacationSkeleton from "../../components/common/VacationSkeleton";
import { IconPlus } from "../../components/icons/Icons";
import { useAuth } from "../../store/auth";
import {
    createVacation,
    updateVacation,
    deleteVacation,
    getVacations,
    getVacationStats,
    statusToKorean,
    leaveTypeToKorean,
    formatVacationDate,
    type Vacation,
    type VacationStatus as ApiVacationStatus,
} from "../../lib/vacationApi";

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
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [searchParams, setSearchParams] = useSearchParams();

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

    // URL 파라미터로 모달 열기
    useEffect(() => {
        if (searchParams.get("openModal") === "true") {
            setModalOpen(true);
            searchParams.delete("openModal");
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
                setSummary({
                    myAnnual: stats.total || 15, // 기본값 15일
                    granted: stats.total || 0,
                    used: stats.used,
                    expired: 0, // 추후 구현
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

    // 지급/소멸 내역 (추후 구현)
    const grantExpireRows = useMemo<GrantExpireRow[]>(() => {
        return [];
    }, []);

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
            setSummary({
                myAnnual: stats.total || 15,
                granted: stats.total || 0,
                used: stats.used,
                expired: 0,
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
                                    }}
                                    availableDays={summary.myAnnual}
                                    onSubmit={handleVacationSubmit}
                                    editingVacation={editingVacation ? vacations.find(v => v.id === editingVacation.id) || null : null}
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
