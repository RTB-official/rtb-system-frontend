import { supabase } from "./supabase";

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
        .select("*")
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });

    if (userId) {
        query = query.eq("user_id", userId);
    }

    if (filters?.status) {
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
        .single();

    if (error) {
        console.error("Error updating vacation status:", error);
        throw new Error(`휴가 상태 변경 실패: ${error.message}`);
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
    year: number
): Promise<{
    total: number;
    used: number;
    pending: number;
    remaining: number;
}> {
    const vacations = await getVacations(userId, { year });

    const stats = vacations.reduce(
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
    try {
        const { data: balance } = await supabase
            .from("vacation_balances")
            .select("total_days")
            .eq("user_id", userId)
            .eq("year", year)
            .single();

        if (balance) {
            stats.total = balance.total_days;
            stats.remaining = stats.total - stats.used;
        }
    } catch (error) {
        // 잔액 테이블이 없거나 데이터가 없는 경우 무시
        console.warn("Vacation balance not found, using calculated values");
    }

    return stats;
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
