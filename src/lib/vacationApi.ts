import { supabase } from "./supabase";
import {
    getAdminUserIds,
    getGongmuTeamUserIds,
    createNotificationsForUsers,
} from "./notificationApi";
import { 
    calculateAnnualLeave, 
    getVacationGrantHistory as calculateGrantHistory, 
    type VacationGrantHistory,
    updateVacationBalances
} from "./vacationCalculator";

// ==================== 타입 정의 ====================

export type LeaveType = "FULL" | "AM" | "PM";
export type VacationStatus = "pending" | "approved" | "rejected";

export interface Vacation {
    id: string;
    user_id: string;
    date: string; // YYYY-MM-DD
    leave_type: LeaveType;
    reason: string;
    status: VacationStatus;
    created_at: string;
    updated_at: string;
    created_by?: string;
    updated_by?: string;
}

export interface CreateVacationInput {
    user_id: string;
    date: string; // YYYY-MM-DD
    leave_type: LeaveType;
    reason: string;
}

export interface UpdateVacationInput {
    date?: string;
    leave_type?: LeaveType;
    reason?: string;
    status?: VacationStatus;
}

export interface VacationBalance {
    id: string;
    user_id: string;
    total_days: number;
    used_days: number;
    remaining_days: number;
    year: number;
    created_at: string;
    updated_at: string;
}

// ==================== 휴가 신청 ====================

/**
 * 휴가 신청 (등록)
 */
export async function createVacation(
    data: CreateVacationInput
): Promise<Vacation> {
    const { data: vacation, error } = await supabase
        .from("vacations")
        .insert([
            {
                ...data,
                created_by: data.user_id,
                status: "pending",
            },
        ])
        .select()
        .single();

    if (error) {
        console.error("Error creating vacation:", error);
        throw new Error(`휴가 신청 실패: ${error.message}`);
    }

    // 휴가 등록 시 공무팀 전체에 알림 생성 (본인 제외)
    try {
        const gongmuUserIds = await getGongmuTeamUserIds();
        
        // 본인 제외
        const targetUserIds = gongmuUserIds.filter(id => id !== data.user_id);
        
        if (targetUserIds.length > 0) {
            // 사용자 이름 가져오기
            const { data: profile } = await supabase
                .from("profiles")
                .select("name")
                .eq("id", data.user_id)
                .single();

            const userName = profile?.name || "사용자";

            await createNotificationsForUsers(
                targetUserIds,
                "휴가 신청",
                `${userName}님이 휴가를 신청했습니다.`,
                "vacation"
            );
        }
    } catch (notificationError: any) {
        // 알림 생성 실패는 휴가 신청을 막지 않음
        console.error("알림 생성 실패:", notificationError?.message || notificationError);
    }

    return vacation;
}

// ==================== 휴가 조회 ====================

/**
 * 사용자의 휴가 목록 조회
 */
export async function getVacations(
    userId?: string,
    filters?: {
        status?: VacationStatus;
        year?: number;
        month?: number;
    }
): Promise<Vacation[]> {
    let query = supabase
        .from("vacations")
        .select("id, user_id, date, leave_type, reason, status, created_at, updated_at, created_by, updated_by")
        .order("date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1000); // 성능을 위해 제한

    if (userId) {
        query = query.eq("user_id", userId);
    }

    // status 필터가 명시적으로 전달된 경우에만 필터링
    // 필터가 없으면 모든 상태(pending, approved, rejected)를 가져옴
    if (filters?.status !== undefined) {
        query = query.eq("status", filters.status);
    }

    if (filters?.year) {
        // 정확한 연도 필터링을 위해 GTE/LTE 사용
        const startDate = `${filters.year}-01-01`;
        const endDate = `${filters.year}-12-31`;
        query = query.gte("date", startDate).lte("date", endDate);
    }

    if (filters?.month !== undefined && filters?.year) {
        const startDate = `${filters.year}-${String(filters.month + 1).padStart(
            2,
            "0"
        )}-01`;
        const endDate = `${filters.year}-${String(filters.month + 1).padStart(
            2,
            "0"
        )}-31`;
        query = query.gte("date", startDate).lte("date", endDate);
    }

    const { data, error } = await query;

    if (error) {
        console.error("Error fetching vacations:", error);
        throw new Error(`휴가 조회 실패: ${error.message}`);
    }

    return data || [];
}

/**
 * 특정 휴가 조회
 */
export async function getVacationById(id: string): Promise<Vacation | null> {
    const { data, error } = await supabase
        .from("vacations")
        .select("*")
        .eq("id", id)
        .single();

    if (error) {
        if (error.code === "PGRST116") {
            // 레코드를 찾을 수 없음
            return null;
        }
        console.error("Error fetching vacation:", error);
        throw new Error(`휴가 조회 실패: ${error.message}`);
    }

    return data;
}

// ==================== 휴가 수정 ====================

/**
 * 휴가 수정 (사용자 본인이 대기 중인 휴가만 수정 가능)
 */
export async function updateVacation(
    id: string,
    updates: UpdateVacationInput,
    userId: string
): Promise<Vacation> {
    const { data: vacation, error } = await supabase
        .from("vacations")
        .update({
            ...updates,
            updated_by: userId,
        })
        .eq("id", id)
        .eq("user_id", userId) // 본인의 휴가만 수정 가능
        .select()
        .single();

    if (error) {
        console.error("Error updating vacation:", error);
        throw new Error(`휴가 수정 실패: ${error.message}`);
    }

    return vacation;
}

/**
 * 휴가 승인/반려 (관리자 기능 - 추후 구현)
 */
export async function updateVacationStatus(
    id: string,
    status: "approved" | "rejected",
    updatedBy: string
): Promise<Vacation> {
    const { data: vacation, error } = await supabase
        .from("vacations")
        .update({
            status,
            updated_by: updatedBy,
        })
        .eq("id", id)
        .select()
        .maybeSingle();

    if (error) {
        console.error("Error updating vacation status:", error);
        throw new Error(`휴가 상태 변경 실패: ${error.message}`);
    }
    if (!vacation) {
        throw new Error("휴가 상태 변경 실패: 권한이 없거나 대상 휴가를 찾을 수 없습니다.");
    }

    return vacation;
}

// ==================== 휴가 삭제 ====================

/**
 * 휴가 삭제 (사용자 본인이 대기 중인 휴가만 삭제 가능)
 */
export async function deleteVacation(
    id: string,
    userId: string
): Promise<void> {
    const { error } = await supabase
        .from("vacations")
        .delete()
        .eq("id", id)
        .eq("user_id", userId); // 본인의 휴가만 삭제 가능

    if (error) {
        console.error("Error deleting vacation:", error);
        throw new Error(`휴가 삭제 실패: ${error.message}`);
    }
}

// ==================== 휴가 통계 ====================

/**
 * 사용자의 연도별 휴가 통계 조회
 */
export async function getVacationStats(
    userId: string,
    year: number,
    vacations?: Vacation[] // 이미 가져온 휴가 데이터가 있으면 재사용
): Promise<{
    total: number;
    used: number;
    pending: number;
    remaining: number;
}> {
    const vacationData = vacations || await getVacations(userId, { year });

    const currentDate = new Date();
    const { data: profile } = await supabase
        .from("profiles")
        .select("join_date")
        .eq("id", userId)
        .single();

    const stats = vacationData.reduce(
        (acc, vacation) => {
            const days = vacation.leave_type === "FULL" ? 1 : 0.5;

            if (vacation.status === "approved") {
                acc.used += days;
            } else if (vacation.status === "pending") {
                acc.pending += days;
            }

            return acc;
        },
        { total: 0, used: 0, pending: 0, remaining: 0 }
    );

    // 연차 잔액 조회 (있다면)
    // 406 에러나 RLS 정책 문제를 방지하기 위해 maybeSingle 사용
    const { data: balance, error: balanceError } = await supabase
        .from("vacation_balances")
        .select("total_days")
        .eq("user_id", userId)
        .eq("year", year)
        .maybeSingle();

    // 406 에러나 다른 에러 발생 시 fallback 처리 (에러를 조용히 처리)
    if (balanceError || !balance) {
        // 잔액 테이블에 없거나 접근 불가능하면 입사일 기준으로 계산
        if (profile?.join_date) {
            stats.total = calculateAnnualLeave(
                profile.join_date,
                year,
                currentDate
            );
            stats.remaining = stats.total - stats.used;
        } else {
            stats.total = 0;
            stats.remaining = stats.total - stats.used;
        }
    } else {
        stats.total = balance.total_days;
        stats.remaining = stats.total - stats.used;
    }

    // 1년 미만 근로자: 현재 연도 표기에 전년도 지급분 합산
    if (profile?.join_date) {
        const join = new Date(profile.join_date);
        join.setHours(0, 0, 0, 0);
        const yearStart = new Date(year, 0, 1);
        yearStart.setHours(0, 0, 0, 0);
        const yearsOfServiceAtYearStart =
            (yearStart.getTime() - join.getTime()) / (1000 * 60 * 60 * 24) / 365;

        if (yearsOfServiceAtYearStart < 1) {
            const prevYearHistory = calculateGrantHistory(
                profile.join_date,
                year - 1,
                currentDate
            );
            const prevGranted = prevYearHistory.reduce(
                (sum, h) => sum + (h.granted || 0),
                0
            );
            const prevExpired = Math.abs(
                prevYearHistory.reduce((sum, h) => sum + (h.expired || 0), 0)
            );
            const carryOverDays = Math.max(0, prevGranted - prevExpired);
            if (carryOverDays > 0) {
                stats.total += carryOverDays;
                stats.remaining += carryOverDays;
            }
        }
    }

    return stats;
}

/**
 * 사용자의 연도별 연차 지급/소멸 내역 조회
 */
export async function getVacationGrantHistory(
    userId: string,
    year: number
): Promise<VacationGrantHistory[]> {
    // 프로필에서 입사일 가져오기
    const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("join_date")
        .eq("id", userId)
        .single();
    
    if (profileError || !profile?.join_date) {
        console.warn("프로필 조회 실패 또는 입사일 없음:", profileError);
        return [];
    }
    
    // 지급/소멸 내역 계산
    return calculateGrantHistory(profile.join_date, year);
}

/**
 * 모든 직원의 연차를 특정 연도부터 현재 연도까지 계산하고 업데이트
 * @param startYear 시작 연도 (기본값: 2025)
 */
export async function calculateAllEmployeesVacation(startYear: number = 2025): Promise<void> {
    const currentYear = new Date().getFullYear();
    
    console.log(`모든 직원의 연차 계산 시작: ${startYear}년 ~ ${currentYear}년`);
    
    // 각 연도별로 모든 직원의 연차 계산
    for (let year = startYear; year <= currentYear; year++) {
        console.log(`${year}년 연차 계산 중...`);
        try {
            await updateVacationBalances(undefined, year);
            console.log(`${year}년 연차 계산 완료`);
        } catch (error) {
            console.error(`${year}년 연차 계산 실패:`, error);
            throw error;
        }
    }
    
    console.log(`모든 연차 계산 완료: ${startYear}년 ~ ${currentYear}년`);
}

/**
 * 사용자의 현재 날짜 기준 총 연차 계산 (연도 무관)
 */
export async function getCurrentTotalAnnualLeave(userId: string): Promise<number> {
    // 프로필에서 입사일 가져오기
    const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("join_date")
        .eq("id", userId)
        .single();
    
    if (profileError || !profile?.join_date) {
        console.warn("프로필 조회 실패 또는 입사일 없음:", profileError);
        return 0;
    }
    
    const currentDate = new Date();
    
    // 입사일부터 현재까지 지급받은 모든 연차 내역 가져오기
    const join = new Date(profile.join_date);
    const joinYear = join.getFullYear();
    const currentYear = currentDate.getFullYear();
    
    // 2025년부터만 계산 (2024년 이전 연차는 모두 소멸 처리)
    const startYear = Math.max(joinYear, 2025);
    
    // 모든 연도의 지급 내역을 합산
    let totalGranted = 0;
    for (let year = startYear; year <= currentYear; year++) {
        const history = calculateGrantHistory(profile.join_date, year, currentDate);
        const yearGranted = history.reduce((sum, h) => sum + (h.granted || 0), 0);
        const yearExpired = Math.abs(history.reduce((sum, h) => sum + (h.expired || 0), 0));
        totalGranted += yearGranted - yearExpired;
    }
    
    // 사용한 연차 차감
    const { data: vacations } = await supabase
        .from("vacations")
        .select("leave_type, status")
        .eq("user_id", userId)
        .eq("status", "approved");
    
    if (vacations) {
        const usedDays = vacations.reduce((sum, v) => {
            return sum + (v.leave_type === "FULL" ? 1 : 0.5);
        }, 0);
        totalGranted -= usedDays;
    }
    
    return Math.max(0, totalGranted);
}

// ==================== 유틸리티 함수 ====================

/**
 * 상태를 한국어로 변환
 */
export function statusToKorean(status: VacationStatus): string {
    const mapping = {
        pending: "대기 중",
        approved: "승인 완료",
        rejected: "반려",
    };
    return mapping[status];
}

/**
 * 휴가 유형을 한국어로 변환
 */
export function leaveTypeToKorean(leaveType: LeaveType): string {
    const mapping = {
        FULL: "연차",
        AM: "오전 반차",
        PM: "오후 반차",
    };
    return mapping[leaveType];
}

/**
 * 날짜 포맷팅 (YYYY-MM-DD -> YYYY. MM. DD.(요일))
 */
export function formatVacationDate(dateString: string): string {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
    const weekday = weekdays[date.getDay()];

    return `${year}. ${month}. ${day}.(${weekday})`;
}
