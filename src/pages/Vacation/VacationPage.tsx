// VacationPage.tsx
import { useMemo, useState, useEffect, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/common/Header";
import Button from "../../components/common/Button";
import VacationManagementSection from "../../components/sections/VacationManagementSection";
import VacationRequestModal from "../../components/ui/VacationRequestModal";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import VacationSkeleton from "../../components/common/VacationSkeleton";
import { IconPlus } from "../../components/icons/Icons";
import { useAuth } from "../../store/auth";
import { supabase } from "../../lib/supabase";
import {
    createVacation,
    updateVacation,
    deleteVacation,
    getVacations,
    getVacationGrantHistory,
    statusToKorean,
    leaveTypeToKorean,
    formatVacationDate,
    formatVacationDays,
    type Vacation,
    type VacationStatus as ApiVacationStatus,
} from "../../lib/vacationApi";
import type { VacationGrantHistoryEntry } from "../../lib/vacationSpecialGrants";
import { useToast } from "../../components/ui/ToastProvider";
import useIsMobile from "../../hooks/useIsMobile";

export type VacationStatus = "승인 대기" | "승인 완료" | "반려됨";

// 날짜 포맷팅 함수 (2028년 1월 23일 (금) 형식)
function formatDateWithWeekday(dateString: string): string {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
    const weekday = weekdays[date.getDay()];
    return `${year}년 ${month}월 ${day}일 (${weekday})`;
}

export interface VacationRow {
    id: string;
    period: string;
    item: string;
    reason: string;
    status: VacationStatus;
    usedDays: number; // -1, -0.5
    remainDays: number; // 12, 13.5
    date: string; // YYYY-MM-DD (날짜 체크용)
}

export interface GrantExpireRow {
    id: string;
    monthLabel: string;
    granted?: number;
    grantedLabel?: string;
    expired?: number;
    used?: number;
    balance?: number;
}

interface SummaryGrantItem {
    days: number;
    expired: boolean;
    note?: string;
}

interface VacationSummary {
    myAnnual: number;
    granted: number;
    used: number;
    expired: number;
    grantItems: SummaryGrantItem[];
}

const VACATION_TIMELINE_START_YEAR = 2025;

type VacationBalanceEvent = {
    date: string;
    createdAt: string;
    order: number;
    delta: number;
    kind: "grant" | "expire" | "vacation";
    vacationId?: string;
    status?: ApiVacationStatus;
};

type VacationGrantBucket = {
    date: string;
    original: number;
    remaining: number;
    used: number;
    expired: number;
    sequence: number;
};

function sumBucketBalance(buckets: VacationGrantBucket[]) {
    return buckets.reduce((sum, bucket) => sum + bucket.remaining, 0);
}

function consumeFromBuckets(
    buckets: VacationGrantBucket[],
    amount: number,
    predicate: (bucket: VacationGrantBucket) => boolean,
    reason: "used" | "expired"
) {
    let remainingToConsume = amount;

    for (const bucket of buckets) {
        if (remainingToConsume <= 0) break;
        if (!predicate(bucket) || bucket.remaining <= 0) continue;

        const consumed = Math.min(bucket.remaining, remainingToConsume);
        bucket.remaining -= consumed;
        if (reason === "used") {
            bucket.used += consumed;
        } else {
            bucket.expired += consumed;
        }
        remainingToConsume -= consumed;
    }

    return amount - remainingToConsume;
}

function getVacationDayCount(vacation: Pick<Vacation, "leave_type">) {
    return vacation.leave_type === "FULL" ? 1 : 0.5;
}

function buildVacationBalanceSnapshot({
    vacations,
    grantHistories,
    selectedYear,
}: {
    vacations: Vacation[];
    grantHistories: VacationGrantHistoryEntry[];
    selectedYear: number;
}) {
    const events: VacationBalanceEvent[] = [];
    const selectedYearStart = `${selectedYear}-01-01`;
    const selectedYearEnd = `${selectedYear}-12-31`;
    const grantEventKeys = new Set<string>();
    const expireEventKeys = new Set<string>();
    let bucketSequence = 0;

    grantHistories.forEach((history) => {
        if (history.granted) {
            const grantKey = `grant:${history.date}:${history.granted}`;
            if (!grantEventKeys.has(grantKey)) {
                grantEventKeys.add(grantKey);
                events.push({
                    date: history.date,
                    createdAt: history.date,
                    order: 0,
                    delta: history.granted,
                    kind: "grant",
                });
            }
        }

        if (history.expired) {
            const expireKey = `expire:${history.date}:${history.expired}`;
            if (!expireEventKeys.has(expireKey)) {
                expireEventKeys.add(expireKey);
                events.push({
                    date: history.date,
                    createdAt: history.date,
                    order: 1,
                    delta: history.expired,
                    kind: "expire",
                });
            }
        }
    });

    vacations
        .filter((vacation) => vacation.date >= `${VACATION_TIMELINE_START_YEAR}-01-01`)
        .forEach((vacation) => {
            const affectsBalance =
                vacation.status === "approved" || vacation.status === "pending";

            events.push({
                date: vacation.date,
                createdAt: vacation.created_at,
                order: 2,
                delta: affectsBalance ? -getVacationDayCount(vacation) : 0,
                kind: "vacation",
                vacationId: vacation.id,
                status: vacation.status,
            });
        });

    events.sort((a, b) => {
        const dateDiff =
            new Date(a.date).getTime() - new Date(b.date).getTime();
        if (dateDiff !== 0) return dateDiff;

        if (a.order !== b.order) return a.order - b.order;

        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    let balance = 0;
    let yearUsed = 0;
    let yearPending = 0;
    let yearExpired = 0;
    const remainMap = new Map<string, number>();
    const buckets: VacationGrantBucket[] = [];

    events.forEach((event) => {
        if (event.kind === "grant" && event.delta > 0) {
            buckets.push({
                date: event.date,
                original: event.delta,
                remaining: event.delta,
                used: 0,
                expired: 0,
                sequence: bucketSequence++,
            });
        }

        if (event.kind === "expire" && event.delta < 0) {
            const expiryAmount = Math.abs(event.delta);
            const isYearEndExpiry = event.date.endsWith("-12-31");
            const expiryYear = event.date.slice(0, 4);
            const expiredAmount = consumeFromBuckets(
                buckets,
                expiryAmount,
                (bucket) =>
                    isYearEndExpiry
                        ? bucket.date.startsWith(`${expiryYear}-`)
                        : bucket.date < event.date,
                "expired"
            );

            if (event.date >= selectedYearStart && event.date <= selectedYearEnd) {
                yearExpired += expiredAmount;
            }
        }

        if (event.kind === "vacation" && event.delta < 0) {
            consumeFromBuckets(
                buckets,
                Math.abs(event.delta),
                () => true,
                "used"
            );
        }

        balance = Math.max(0, sumBucketBalance(buckets));

        if (event.vacationId) {
            remainMap.set(event.vacationId, balance);

            if (
                event.date >= selectedYearStart &&
                event.date <= selectedYearEnd &&
                event.delta < 0
            ) {
                const usedDays = Math.abs(event.delta);

                if (event.status === "approved") {
                    yearUsed += usedDays;
                } else if (event.status === "pending") {
                    yearPending += usedDays;
                }
            }
        }
    });

    return {
        remainMap,
        endingBalance: balance,
        yearUsed,
        yearPending,
        yearExpired,
        grantBuckets: buckets.map((bucket) => ({ ...bucket })),
    };
}

function buildSelectedYearSummary({
    selectedYearHistory,
    yearlyVacations,
    endingBalance,
    fallbackUsed,
    fallbackExpired,
    grantBuckets,
    selectedYear,
    joinDate,
}: {
    selectedYearHistory: VacationGrantHistoryEntry[];
    yearlyVacations: Vacation[];
    endingBalance: number;
    fallbackUsed: number;
    fallbackExpired: number;
    grantBuckets: VacationGrantBucket[];
    selectedYear: number;
    joinDate?: string | null;
}): VacationSummary {
    const grantEntries = selectedYearHistory
        .filter((history) => (history.granted || 0) > 0)
        .map((history) => ({
            date: history.date,
            days: history.granted || 0,
            note: history.note,
        }));

    if (grantEntries.length === 0) {
        return {
            myAnnual: endingBalance,
            granted: 0,
            used: fallbackUsed,
            expired: fallbackExpired,
            grantItems: [],
        };
    }

    if (joinDate) {
        const anniversaryDate = new Date(joinDate);
        anniversaryDate.setHours(0, 0, 0, 0);
        anniversaryDate.setFullYear(anniversaryDate.getFullYear() + 1);
        const anniversaryDateStr = `${anniversaryDate.getFullYear()}-${String(
            anniversaryDate.getMonth() + 1
        ).padStart(2, "0")}-${String(anniversaryDate.getDate()).padStart(2, "0")}`;
        const currentDate = new Date();
        currentDate.setHours(0, 0, 0, 0);

        const usedInSelectedYear = yearlyVacations
            .filter(
                (vacation) =>
                    vacation.status !== "rejected"
            )
            .reduce((sum, vacation) => sum + getVacationDayCount(vacation), 0);

        const preAnniversaryGranted = grantEntries
            .filter((entry) => entry.date < anniversaryDateStr)
            .reduce((sum, entry) => sum + entry.days, 0);

        const postAnniversaryEntries = grantEntries.filter(
            (entry) => entry.date >= anniversaryDateStr
        );
        const postAnniversaryGranted = postAnniversaryEntries.reduce(
            (sum, entry) => sum + entry.days,
            0
        );

        const usedAfterAnniversary = yearlyVacations
            .filter(
                (vacation) =>
                    vacation.date >= anniversaryDateStr &&
                    vacation.status !== "rejected"
            )
            .reduce((sum, vacation) => sum + getVacationDayCount(vacation), 0);

        if (
            selectedYear < anniversaryDate.getFullYear() &&
            preAnniversaryGranted > 0 &&
            currentDate >= anniversaryDate
        ) {
            return {
                myAnnual: 0,
                granted: preAnniversaryGranted,
                used: usedInSelectedYear,
                expired: preAnniversaryGranted,
                grantItems: [
                    {
                        days: preAnniversaryGranted,
                        expired: true,
                    },
                ],
            };
        }

        if (
            selectedYear === anniversaryDate.getFullYear() &&
            preAnniversaryGranted > 0 &&
            postAnniversaryGranted > 0
        ) {
            return {
                myAnnual: endingBalance,
                granted: preAnniversaryGranted + postAnniversaryGranted,
                used: usedAfterAnniversary,
                expired: preAnniversaryGranted,
                grantItems: [
                    {
                        days: preAnniversaryGranted,
                        expired: true,
                    },
                    ...(() => {
                        const items: SummaryGrantItem[] = [];
                        const regularPostGranted = postAnniversaryEntries
                            .filter((entry) => !entry.note)
                            .reduce((sum, entry) => sum + entry.days, 0);

                        if (regularPostGranted > 0) {
                            items.push({
                                days: regularPostGranted,
                                expired: false,
                            });
                        }

                        postAnniversaryEntries
                            .filter((entry) => !!entry.note)
                            .forEach((entry) => {
                                items.push({
                                    days: entry.days,
                                    expired: false,
                                    note: entry.note,
                                });
                            });

                        return items;
                    })(),
                ],
            };
        }
    }

    const matchingBuckets = grantBuckets
        .filter((bucket) => bucket.date.startsWith(`${selectedYear}-`))
        .sort((a, b) => {
            const dateDiff = a.date.localeCompare(b.date);
            if (dateDiff !== 0) return dateDiff;
            return a.sequence - b.sequence;
        });

    let bucketIndex = 0;
    const grantBatches: Array<{
        totalGranted: number;
        used: number;
        remaining: number;
        expiredAmount: number;
        note?: string;
    }> = [];

    grantEntries.forEach((entry, entryIndex) => {
        const matchingBucketOffset = matchingBuckets
            .slice(bucketIndex)
            .findIndex(
                (bucket) => bucket.date === entry.date && bucket.original === entry.days
            );
        const matchingBucket =
            matchingBucketOffset >= 0
                ? matchingBuckets[bucketIndex + matchingBucketOffset]
                : undefined;

        if (!matchingBucket) {
            grantBatches.push({
                totalGranted: entry.days,
                used: 0,
                remaining: 0,
                expiredAmount: 0,
                note: entry.note,
            });
            return;
        }

        bucketIndex = bucketIndex + matchingBucketOffset + 1;

        const shouldMergeWithPrevious =
            entry.days === 1 &&
            entryIndex > 0 &&
            grantEntries[entryIndex - 1]?.days === 1;

        if (shouldMergeWithPrevious) {
            const lastBatch = grantBatches[grantBatches.length - 1];
            lastBatch.totalGranted += matchingBucket.original;
            lastBatch.used += matchingBucket.used;
            lastBatch.remaining += matchingBucket.remaining;
            lastBatch.expiredAmount += matchingBucket.expired;
            return;
        }

        grantBatches.push({
            totalGranted: matchingBucket.original,
            used: matchingBucket.used,
            remaining: matchingBucket.remaining,
            expiredAmount: matchingBucket.expired,
            note: entry.note,
        });
    });

    const activeBatches = grantBatches.filter((batch) => batch.expiredAmount === 0);
    const expiredBatches = grantBatches.filter((batch) => batch.expiredAmount > 0);

    const activeRemaining = activeBatches.reduce(
        (sum, batch) => sum + batch.remaining,
        0
    );
    const activeUsed = activeBatches.reduce((sum, batch) => sum + batch.used, 0);
    const expiredGranted = expiredBatches.reduce(
        (sum, batch) => sum + batch.totalGranted,
        0
    );
    const grantItems = grantBatches.map((batch) => ({
        days: batch.totalGranted,
        expired: batch.expiredAmount > 0,
        note: batch.note,
    }));

    return {
        myAnnual: activeRemaining || (expiredBatches.length > 0 ? 0 : endingBalance),
        granted: grantBatches.reduce((sum, batch) => sum + batch.totalGranted, 0),
        used: activeUsed || (activeBatches.length > 0 ? 0 : fallbackUsed),
        expired: expiredGranted || fallbackExpired,
        grantItems,
    };
}

export default function VacationPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { showSuccess, showError } = useToast();
    const isMobile = useIsMobile();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [searchParams, setSearchParams] = useSearchParams();
    const [userJoinDate, setUserJoinDate] = useState<string | null>(null);

    // 사용자 권한 확인 및 리다이렉트
    useEffect(() => {
        const checkUserRole = async () => {
            if (!user?.id) return;

            const { data: profile } = await supabase
                .from("profiles")
                .select("position, role, department, join_date")
                .eq("id", user.id)
                .single();

            if (profile) {
                setUserJoinDate(profile.join_date ?? null);
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
    const [summary, setSummary] = useState<VacationSummary>({
        myAnnual: 0,
        granted: 0,
        used: 0,
        expired: 0,
        grantItems: [],
    });
    const [grantHistory, setGrantHistory] = useState<VacationGrantHistoryEntry[]>([]);
    const [allGrantHistories, setAllGrantHistories] = useState<VacationGrantHistoryEntry[]>([]);
    const [allVacations, setAllVacations] = useState<Vacation[]>([]);

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

    const loadVacationData = useCallback(
        async (yearNum: number) => {
            if (!user?.id) return;

            const historyYears = Array.from(
                { length: yearNum - VACATION_TIMELINE_START_YEAR + 1 },
                (_, index) => VACATION_TIMELINE_START_YEAR + index
            );

            const [yearlyVacations, timelineVacations, selectedYearHistory, allHistories] =
                await Promise.all([
                    getVacations(user.id, { year: yearNum }),
                    getVacations(user.id),
                    getVacationGrantHistory(user.id, yearNum),
                    Promise.all(
                        historyYears.map((targetYear) =>
                            getVacationGrantHistory(user.id, targetYear)
                        )
                    ),
                ]);

            const flattenedHistory = allHistories.flat();
            const balanceSnapshot = buildVacationBalanceSnapshot({
                vacations: timelineVacations,
                grantHistories: flattenedHistory,
                selectedYear: yearNum,
            });

            const totalExpired = Math.abs(
                selectedYearHistory.reduce(
                    (sum, history) => sum + (history.expired || 0),
                    0
                )
            );

            setVacations(yearlyVacations);
            setAllVacations(timelineVacations);
            setGrantHistory(selectedYearHistory);
            setAllGrantHistories(flattenedHistory);
            setSummary(
                buildSelectedYearSummary({
                    selectedYearHistory,
                    yearlyVacations,
                    endingBalance: balanceSnapshot.endingBalance,
                    fallbackUsed: balanceSnapshot.yearUsed + balanceSnapshot.yearPending,
                    fallbackExpired: balanceSnapshot.yearExpired || totalExpired,
                    grantBuckets: balanceSnapshot.grantBuckets,
                    selectedYear: yearNum,
                    joinDate: userJoinDate,
                })
            );
        },
        [user?.id, userJoinDate]
    );

    // 휴가 목록 조회 (병렬 처리로 최적화)
    useEffect(() => {
        if (!user?.id) return;

        const fetchVacations = async () => {
            setLoading(true);
            try {
                await loadVacationData(parseInt(year, 10));
            } catch (error) {
                console.error("휴가 목록 조회 실패:", error);
                showError("휴가 목록을 불러오는데 실패했습니다.");
            } finally {
                setLoading(false);
            }
        };

        fetchVacations();
    }, [loadVacationData, showError, user?.id, year]);

    // 삭제 확인 메시지 생성
    const deleteConfirmMessage = useMemo(() => {
        const targetVacation = deleteTargetId
            ? vacations.find(v => v.id === deleteTargetId)
            : null;

        if (!targetVacation) {
            return "정말 이 휴가를 취소하시겠습니까?";
        }

        const vacationDate = formatDateWithWeekday(targetVacation.date);
        return `${vacationDate} 휴가를 취소하시겠습니까?`;
    }, [deleteTargetId, vacations]);

    // API 데이터를 VacationRow 형식으로 변환
    const rows: VacationRow[] = useMemo(() => {
        const balanceSnapshot = buildVacationBalanceSnapshot({
            vacations: allVacations,
            grantHistories: allGrantHistories,
            selectedYear: parseInt(year, 10),
        });

        return vacations.map((vacation) => {
            const usedDays = -getVacationDayCount(vacation);
            const remainDays =
                balanceSnapshot.remainMap.get(vacation.id) ?? summary.myAnnual;

            return {
                id: vacation.id,
                period: formatVacationDate(vacation.date),
                item: leaveTypeToKorean(vacation.leave_type),
                reason: vacation.reason,
                status: statusToKorean(vacation.status) as VacationStatus,
                usedDays,
                remainDays,
                date: vacation.date,
            };
        });
    }, [allGrantHistories, allVacations, summary.myAnnual, vacations, year]);

    // 지급/소멸 내역 변환
    const grantExpireRows = useMemo<GrantExpireRow[]>(() => {
        const selectedYear = parseInt(year, 10);
        return grantHistory
            .map((h, index) => {
                const date = new Date(h.date);
                const displayYear = date.getFullYear();
                const month = date.getMonth() + 1;
                const day = date.getDate();

                return {
                    id: `grant-${index}`,
                    monthLabel:
                        displayYear !== selectedYear
                            ? `${displayYear}년 ${month}월 ${day}일`
                            : `${month}월 ${day}일`,
                    granted: h.granted,
                    grantedLabel:
                        h.granted != null && h.note
                            ? `${formatVacationDays(h.granted)}(${h.note})`
                            : undefined,
                    expired: h.expired,
                };
            })
            .reverse();
    }, [grantHistory, year]);

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
            showSuccess("휴가가 삭제되었습니다.");
            setDeleteConfirmOpen(false);
            setDeleteTargetId(null);

            // 목록 새로고침
            await loadVacationData(parseInt(year, 10));
        } catch (error: any) {
            console.error("휴가 삭제 실패:", error);
            showError(error.message || "휴가 삭제에 실패했습니다.");
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
            showError("로그인이 필요합니다.");
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
                showSuccess("휴가가 수정되었습니다.");
            } else {
                // 신청 모드
                await createVacation({
                    user_id: user.id,
                    date: payload.date,
                    leave_type: payload.leaveType,
                    reason: payload.reason,
                });
                showSuccess("휴가 신청이 완료되었습니다.");
            }

            setModalOpen(false);
            setEditingVacation(null);

            // 목록 새로고침
            await loadVacationData(parseInt(year, 10));
        } catch (error: any) {
            console.error("휴가 처리 실패:", error);
            showError(error.message || (editingVacation ? "휴가 수정에 실패했습니다." : "휴가 신청에 실패했습니다."));
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
                    title="휴가 관리"
                    onMenuClick={() => setSidebarOpen(true)}
                    rightContent={
                        <Button
                            variant="primary"
                            size={isMobile ? "md" : "lg"}
                            onClick={handleRegister}
                            icon={isMobile ? undefined : <IconPlus />}
                            disabled={loading || !user}
                        >
                            휴가 등록
                        </Button>
                    }
                />

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-4 md:px-9 py-6 md:py-9">
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

                                <ConfirmDialog
                                    isOpen={deleteConfirmOpen}
                                    onClose={() => {
                                        setDeleteConfirmOpen(false);
                                        setDeleteTargetId(null);
                                    }}
                                    onConfirm={confirmDelete}
                                    title="휴가를 취소할까요?"
                                    message={deleteConfirmMessage}
                                    confirmText="네, 취소할게요"
                                    cancelText="아니요"
                                    confirmVariant="primary"
                                    isLoading={loading}
                                />
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
