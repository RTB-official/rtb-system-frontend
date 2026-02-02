import { supabase } from "./supabase";
import { compressImageFile } from "./imageUtils";

// ==================== 타입 정의 ====================

export interface PersonalExpense {
    id: number;
    user_id: string;
    expense_date: string; // YYYY-MM-DD
    expense_type: string;
    detail: string | null;
    amount: number;
    receipt_path: string | null;
    is_submitted: boolean;
    created_at: string;
}

export interface PersonalMileage {
    id: number;
    user_id: string;
    m_date: string; // YYYY-MM-DD
    distance_km: number;
    from_text: string;
    to_text: string;
    detail: string | null;
    amount_won: number;
    is_submitted: boolean;
    created_at: string;
    updated_at: string;
}

export interface CreateExpenseInput {
    user_id: string;
    expense_date: string; // YYYY-MM-DD
    expense_type: string;
    detail?: string;
    amount: number;
    receipt_path?: string;
}

export interface CreateMileageInput {
    user_id: string;
    m_date: string; // YYYY-MM-DD
    distance_km: number;
    from_text: string;
    to_text: string;
    detail?: string;
    amount_won: number;
}

export interface UpdateExpenseInput {
    expense_date?: string;
    expense_type?: string;
    detail?: string;
    amount?: number;
    receipt_path?: string;
    is_submitted?: boolean;
}

export interface UpdateMileageInput {
    m_date?: string;
    distance_km?: number;
    from_text?: string;
    to_text?: string;
    detail?: string;
    amount_won?: number;
    is_submitted?: boolean;
}

// ==================== 개인 지출 (카드/현금) ====================

/**
 * 개인 지출 등록
 */
export async function createPersonalExpense(
    data: CreateExpenseInput
): Promise<PersonalExpense> {
    const { data: expense, error } = await supabase
        .from("personal_expenses")
        .insert([data])
        .select()
        .single();

    if (error) {
        console.error("Error creating personal expense:", error);
        throw new Error(`지출 등록 실패: ${error.message}`);
    }

    return expense;
}

/**
 * 개인 지출 목록 조회
 */
export async function getPersonalExpenses(
    userId: string,
    filters?: {
        year?: number;
        month?: number;
    }
): Promise<PersonalExpense[]> {
    let query = supabase
        .from("personal_expenses")
        .select("*")
        .eq("user_id", userId)
        .order("expense_date", { ascending: false })
        .order("created_at", { ascending: false });

    if (filters?.year) {
        const startDate = `${filters.year}-01-01`;
        const endDate = `${filters.year}-12-31`;
        query = query
            .gte("expense_date", startDate)
            .lte("expense_date", endDate);
    }

    if (filters?.month !== undefined && filters?.year) {
        const startDate = `${filters.year}-${String(filters.month + 1).padStart(
            2,
            "0"
        )}-01`;
        const lastDay = new Date(
            filters.year,
            filters.month + 1,
            0
        ).getDate();
        const endDate = `${filters.year}-${String(filters.month + 1).padStart(
            2,
            "0"
        )}-${String(lastDay).padStart(2, "0")}`;
        query = query
            .gte("expense_date", startDate)
            .lte("expense_date", endDate);
    }

    const { data, error } = await query;

    if (error) {
        console.error("Error fetching personal expenses:", error);
        throw new Error(`지출 조회 실패: ${error.message}`);
    }

    return data || [];
}

/**
 * 개인 지출 수정
 */
export async function updatePersonalExpense(
    id: number,
    userId: string,
    updates: UpdateExpenseInput
): Promise<PersonalExpense> {
    const { data: expense, error } = await supabase
        .from("personal_expenses")
        .update(updates)
        .eq("id", id)
        .eq("user_id", userId)
        .select()
        .single();

    if (error) {
        console.error("Error updating personal expense:", error);
        throw new Error(`지출 수정 실패: ${error.message}`);
    }

    return expense;
}

/**
 * 개인 지출 삭제
 */
export async function deletePersonalExpense(
    id: number,
    userId: string
): Promise<void> {
    const { error } = await supabase
        .from("personal_expenses")
        .delete()
        .eq("id", id)
        .eq("user_id", userId);

    if (error) {
        console.error("Error deleting personal expense:", error);
        throw new Error(`지출 삭제 실패: ${error.message}`);
    }
}

// ==================== 개인 마일리지 ====================

/**
 * 개인 마일리지 등록
 */
export async function createPersonalMileage(
    data: CreateMileageInput
): Promise<PersonalMileage> {
    const { data: mileage, error } = await supabase
        .from("personal_mileage")
        .insert([data])
        .select()
        .single();

    if (error) {
        console.error("Error creating personal mileage:", error);
        throw new Error(`마일리지 등록 실패: ${error.message}`);
    }

    return mileage;
}

/**
 * 개인 마일리지 목록 조회
 */
export async function getPersonalMileages(
    userId: string,
    filters?: {
        year?: number;
        month?: number;
    }
): Promise<PersonalMileage[]> {
    let query = supabase
        .from("personal_mileage")
        .select("*")
        .eq("user_id", userId)
        .order("m_date", { ascending: false })
        .order("created_at", { ascending: false });

    if (filters?.year) {
        const startDate = `${filters.year}-01-01`;
        const endDate = `${filters.year}-12-31`;
        query = query.gte("m_date", startDate).lte("m_date", endDate);
    }

    if (filters?.month !== undefined && filters?.year) {
        const startDate = `${filters.year}-${String(filters.month + 1).padStart(
            2,
            "0"
        )}-01`;
        const lastDay = new Date(
            filters.year,
            filters.month + 1,
            0
        ).getDate();
        const endDate = `${filters.year}-${String(filters.month + 1).padStart(
            2,
            "0"
        )}-${String(lastDay).padStart(2, "0")}`;
        query = query.gte("m_date", startDate).lte("m_date", endDate);
    }

    const { data, error } = await query;

    if (error) {
        console.error("Error fetching personal mileages:", error);
        throw new Error(`마일리지 조회 실패: ${error.message}`);
    }

    return data || [];
}

/**
 * 개인 마일리지 수정
 */
export async function updatePersonalMileage(
    id: number,
    userId: string,
    updates: UpdateMileageInput
): Promise<PersonalMileage> {
    const { data: mileage, error } = await supabase
        .from("personal_mileage")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("user_id", userId)
        .select()
        .single();

    if (error) {
        console.error("Error updating personal mileage:", error);
        throw new Error(`마일리지 수정 실패: ${error.message}`);
    }

    return mileage;
}

/**
 * 개인 마일리지 삭제
 */
export async function deletePersonalMileage(
    id: number,
    userId: string
): Promise<void> {
    const { error } = await supabase
        .from("personal_mileage")
        .delete()
        .eq("id", id)
        .eq("user_id", userId);

    if (error) {
        console.error("Error deleting personal mileage:", error);
        throw new Error(`마일리지 삭제 실패: ${error.message}`);
    }
}

// ==================== 통계 ====================

/**
 * 개인 지출 통계 조회
 */
export async function getPersonalExpenseStats(
    userId: string,
    year?: number,
    month?: number
): Promise<{
    totalAmount: number;
    count: number;
    byType: Record<string, number>;
}> {
    let query = supabase
        .from("personal_expenses")
        .select("amount, expense_type")
        .eq("user_id", userId);

    if (year) {
        const startDate = `${year}-01-01`;
        const endDate = `${year}-12-31`;
        query = query
            .gte("expense_date", startDate)
            .lte("expense_date", endDate);
    }

    if (month !== undefined && year) {
        const startDate = `${year}-${String(month + 1).padStart(2, "0")}-01`;
        const endDate = `${year}-${String(month + 1).padStart(2, "0")}-31`;
        query = query
            .gte("expense_date", startDate)
            .lte("expense_date", endDate);
    }

    const { data, error } = await query;

    if (error) {
        console.error("Error fetching expense stats:", error);
        throw new Error(`지출 통계 조회 실패: ${error.message}`);
    }

    const expenses = data || [];
    const totalAmount = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const byType: Record<string, number> = {};

    expenses.forEach((e) => {
        const type = e.expense_type || "기타";
        byType[type] = (byType[type] || 0) + (e.amount || 0);
    });

    return {
        totalAmount,
        count: expenses.length,
        byType,
    };
}

/**
 * 개인 마일리지 통계 조회
 */
export async function getPersonalMileageStats(
    userId: string,
    year?: number,
    month?: number
): Promise<{
    totalDistance: number;
    totalAmount: number;
    count: number;
}> {
    let query = supabase
        .from("personal_mileage")
        .select("distance_km, amount_won")
        .eq("user_id", userId);

    if (year) {
        const startDate = `${year}-01-01`;
        const endDate = `${year}-12-31`;
        query = query.gte("m_date", startDate).lte("m_date", endDate);
    }

    if (month !== undefined && year) {
        const startDate = `${year}-${String(month + 1).padStart(2, "0")}-01`;
        const endDate = `${year}-${String(month + 1).padStart(2, "0")}-31`;
        query = query.gte("m_date", startDate).lte("m_date", endDate);
    }

    const { data, error } = await query;

    if (error) {
        console.error("Error fetching mileage stats:", error);
        throw new Error(`마일리지 통계 조회 실패: ${error.message}`);
    }

    const mileages = data || [];
    const totalDistance = mileages.reduce(
        (sum, m) => sum + Number(m.distance_km || 0),
        0
    );
    const totalAmount = mileages.reduce(
        (sum, m) => sum + (m.amount_won || 0),
        0
    );

    return {
        totalDistance,
        totalAmount,
        count: mileages.length,
    };
}

// ==================== 모든 사용자 지출 집계 (관리자용) ====================

export interface UserProfile {
    id: string;
    name: string;
    username: string | null;
    email: string | null;
}

export interface EmployeeExpenseSummary {
    id: string; // user_id
    name: string;
    initials: string;
    mileage: number; // 마일리지 총액
    distance: number; // 총 거리 (km)
    cardExpense: number; // 카드 지출 총액
    total: number; // 합계
    count: number; // 총 건수
}

export interface EmployeeMileageDetail {
    id: number;
    date: string;
    dateRaw?: string; // 원본 날짜 (YYYY-MM-DD 형식)
    route: string;
    distance: number;
    amount: number;
    details: string;
}

export interface EmployeeCardExpenseDetail {
    id: number;
    date: string;
    dateRaw?: string; // 원본 날짜 (YYYY-MM-DD 형식)
    merchant: string;
    amount: number;
    category: string;
    details: string;
    receipt_path?: string | null;
}

/**
 * 모든 사용자 목록 조회
 * profiles 테이블의 RLS 정책 무한 재귀 문제로 인해
 * 전체 조회를 건너뛰고 personal_expenses/personal_mileage에서 user_id 추출 후 개별 조회
 */
export async function getAllUsers(): Promise<UserProfile[]> {
    // profiles 테이블 전체 조회는 RLS 정책 무한 재귀 문제로 인해 건너뜀
    // 바로 personal_expenses와 personal_mileage에서 고유한 user_id 추출

    const [expensesResult, mileagesResult] = await Promise.all([
        supabase.from("personal_expenses").select("user_id").limit(1000),
        supabase.from("personal_mileage").select("user_id").limit(1000),
    ]);

    const userIds = new Set<string>();

    if (expensesResult.data) {
        expensesResult.data.forEach((row) => {
            if (row.user_id) userIds.add(row.user_id);
        });
    }

    if (mileagesResult.data) {
        mileagesResult.data.forEach((row) => {
            if (row.user_id) userIds.add(row.user_id);
        });
    }

    // 각 user_id에 대해 profiles 테이블에서 name 가져오기 시도
    // RLS 정책 문제가 있을 수 있지만, 개별 조회는 작동할 수 있음
    const users: UserProfile[] = [];
    
    for (const userId of Array.from(userIds)) {
        try {
            // profiles 테이블에서 개별 조회 시도
            const { data: profileData, error: profileError } = await supabase
                .from("profiles")
                .select("id, name, username, email")
                .eq("id", userId)
                .single();
            
            if (!profileError && profileData) {
                // profiles에서 성공적으로 데이터를 가져온 경우
                const name = profileData.name?.trim();
                users.push({
                    id: profileData.id,
                    name: name || profileData.username || `User ${userId.substring(0, 8)}`,
                    username: profileData.username || userId.substring(0, 8),
                    email: profileData.email || null,
                });
            } else {
                // profiles에서 정보를 가져오지 못한 경우 (RLS 정책 문제 등)
                console.warn(`profiles 조회 실패 (user_id: ${userId}):`, profileError?.message);
                users.push({
                    id: userId,
                    name: `User ${userId.substring(0, 8)}`,
                    username: userId.substring(0, 8),
                    email: null,
                });
            }
        } catch (e) {
            // 에러 발생 시 기본값 사용
            console.warn(`profiles 조회 중 에러 (user_id: ${userId}):`, e);
            users.push({
                id: userId,
                name: `User ${userId.substring(0, 8)}`,
                username: userId.substring(0, 8),
                email: null,
            });
        }
    }

    return users.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * 모든 사용자의 지출 집계 조회 (관리자용)
 */
export async function getAllUsersExpenseSummary(filters?: {
    year?: number;
    month?: number;
    userId?: string;
}): Promise<EmployeeExpenseSummary[]> {
    // 1. 사용자 목록 조회
    const users = await getAllUsers();

    // 2. 모든 사용자의 마일리지 및 지출 데이터 조회
    let mileageQuery = supabase
        .from("personal_mileage")
        .select("user_id, distance_km, amount_won, m_date");

    let expenseQuery = supabase
        .from("personal_expenses")
        .select("user_id, amount, expense_date");

    if (filters?.year) {
        const startDate = `${filters.year}-01-01`;
        const endDate = `${filters.year}-12-31`;
        mileageQuery = mileageQuery
            .gte("m_date", startDate)
            .lte("m_date", endDate);
        expenseQuery = expenseQuery
            .gte("expense_date", startDate)
            .lte("expense_date", endDate);
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
        mileageQuery = mileageQuery
            .gte("m_date", startDate)
            .lte("m_date", endDate);
        expenseQuery = expenseQuery
            .gte("expense_date", startDate)
            .lte("expense_date", endDate);
    }

    if (filters?.userId) {
        mileageQuery = mileageQuery.eq("user_id", filters.userId);
        expenseQuery = expenseQuery.eq("user_id", filters.userId);
    }

    const [mileageResult, expenseResult] = await Promise.all([
        mileageQuery,
        expenseQuery,
    ]);

    if (mileageResult.error) {
        console.error("Error fetching mileages:", mileageResult.error);
        throw new Error(`마일리지 조회 실패: ${mileageResult.error.message}`);
    }

    if (expenseResult.error) {
        console.error("Error fetching expenses:", expenseResult.error);
        throw new Error(`지출 조회 실패: ${expenseResult.error.message}`);
    }

    const mileages = mileageResult.data || [];
    const expenses = expenseResult.data || [];

    // 3. 사용자별 집계
    const summaryMap = new Map<
        string,
        {
            mileage: number;
            distance: number;
            cardExpense: number;
            count: number;
        }
    >();

    // 마일리지 집계
    mileages.forEach((m) => {
        const userId = m.user_id;
        if (!summaryMap.has(userId)) {
            summaryMap.set(userId, {
                mileage: 0,
                distance: 0,
                cardExpense: 0,
                count: 0,
            });
        }
        const summary = summaryMap.get(userId)!;
        summary.mileage += m.amount_won || 0;
        summary.distance += Number(m.distance_km || 0);
        summary.count += 1;
    });

    // 카드 지출 집계
    expenses.forEach((e) => {
        const userId = e.user_id;
        if (!summaryMap.has(userId)) {
            summaryMap.set(userId, {
                mileage: 0,
                distance: 0,
                cardExpense: 0,
                count: 0,
            });
        }
        const summary = summaryMap.get(userId)!;
        summary.cardExpense += e.amount || 0;
        summary.count += 1;
    });

    // 4. 결과 배열 생성
    const results: EmployeeExpenseSummary[] = users
        .map((user) => {
            const summary = summaryMap.get(user.id) || {
                mileage: 0,
                distance: 0,
                cardExpense: 0,
                count: 0,
            };

            // 이니셜 추출 (영문 대문자 2-3자)
            const initials =
                user.name
                    .split(" ")
                    .filter((word) => /^[A-Z]{2,3}$/.test(word))
                    .join("") || user.name.slice(0, 2).toUpperCase();

            // 이름에서 이니셜 제거
            const nameWithoutInitials = user.name.replace(/^[A-Z]{2,3} /, "");

            return {
                id: user.id,
                name: user.name,
                initials,
                mileage: summary.mileage,
                distance: Math.round(summary.distance * 10) / 10, // 소수점 첫째자리까지
                cardExpense: summary.cardExpense,
                total: summary.mileage + summary.cardExpense,
                count: summary.count,
            };
        })
        .filter((item) => item.count > 0); // 데이터가 있는 사용자만 반환

    // 집계 기준으로 정렬 (합계 내림차순)
    return results.sort((a, b) => b.total - a.total);
}

/**
 * 특정 사용자의 마일리지 상세 내역 조회
 */
export async function getUserMileageDetails(
    userId: string,
    filters?: {
        year?: number;
        month?: number;
    }
): Promise<EmployeeMileageDetail[]> {
    let query = supabase
        .from("personal_mileage")
        .select(
            "id, m_date, from_text, to_text, distance_km, amount_won, detail"
        )
        .eq("user_id", userId)
        .order("m_date", { ascending: false })
        .order("created_at", { ascending: false });

    if (filters?.year) {
        const startDate = `${filters.year}-01-01`;
        const endDate = `${filters.year}-12-31`;
        query = query.gte("m_date", startDate).lte("m_date", endDate);
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
        query = query.gte("m_date", startDate).lte("m_date", endDate);
    }

    const { data, error } = await query;

    if (error) {
        console.error("Error fetching mileage details:", error);
        throw new Error(`마일리지 상세 조회 실패: ${error.message}`);
    }

    return (data || []).map((m) => ({
        id: m.id,
        date: formatMileageDate(m.m_date),
        dateRaw: m.m_date, // 원본 날짜 추가
        route: `${m.from_text} → ${m.to_text}`,
        distance: Number(m.distance_km || 0),
        amount: m.amount_won || 0,
        details: m.detail || "",
    }));
}

/**
 * 특정 사용자의 카드 지출 상세 내역 조회
 */
export async function getUserCardExpenseDetails(
    userId: string,
    filters?: {
        year?: number;
        month?: number;
    }
): Promise<EmployeeCardExpenseDetail[]> {
    let query = supabase
        .from("personal_expenses")
        .select("id, expense_date, expense_type, amount, detail, receipt_path")
        .eq("user_id", userId)
        .order("expense_date", { ascending: false })
        .order("created_at", { ascending: false });

    if (filters?.year) {
        const startDate = `${filters.year}-01-01`;
        const endDate = `${filters.year}-12-31`;
        query = query
            .gte("expense_date", startDate)
            .lte("expense_date", endDate);
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
        query = query
            .gte("expense_date", startDate)
            .lte("expense_date", endDate);
    }

    const { data, error } = await query;

    if (error) {
        console.error("Error fetching expense details:", error);
        throw new Error(`카드 지출 상세 조회 실패: ${error.message}`);
    }

    return (data || []).map((e) => ({
        id: e.id,
        date: formatExpenseDate(e.expense_date),
        dateRaw: e.expense_date, // 원본 날짜 추가
        merchant: "N/A", // 가맹점 정보는 현재 스키마에 없음
        amount: e.amount || 0,
        category: e.expense_type || "기타",
        details: e.detail || "",
        receipt_path: e.receipt_path || null,
    }));
}

// ==================== 영수증 업로드 ====================

/**
 * 개인 지출 영수증 파일 업로드 (이미지 자동 압축)
 */
export async function uploadPersonalExpenseReceipt(
    file: File,
    userId: string
): Promise<string> {
    // 이미지 파일인 경우 강제 압축
    let fileToUpload = file;
    if (file.type.startsWith("image/")) {
        try {
            const originalSizeMB = file.size / (1024 * 1024);
            
            // 1MB 이상인 경우에만 압축 (작은 파일은 그대로)
            if (originalSizeMB >= 1) {
                fileToUpload = await compressImageFile(file, {
                    maxWidth: 1200, // 해상도 낮춤
                    maxHeight: 1200,
                    quality: 0.6, // 품질 낮춤
                    maxSizeKB: 300, // 최대 300KB로 압축
                });
                
                const compressedSizeMB = fileToUpload.size / (1024 * 1024);
                console.log(
                    `이미지 압축 완료: ${originalSizeMB.toFixed(2)}MB → ${compressedSizeMB.toFixed(2)}MB (${((fileToUpload.size / file.size) * 100).toFixed(1)}%)`
                );
                
                // 압축이 제대로 안 된 경우 (원본보다 크거나 거의 비슷한 경우) 에러
                if (fileToUpload.size >= file.size * 0.9) {
                    throw new Error("압축 효과가 없습니다. 원본 파일이 너무 큽니다.");
                }
            } else {
                // 1MB 미만이지만 500KB 이상이면 압축
                const originalSizeKB = file.size / 1024;
                if (originalSizeKB > 500) {
                    fileToUpload = await compressImageFile(file, {
                        maxWidth: 1200,
                        maxHeight: 1200,
                        quality: 0.7,
                        maxSizeKB: 300,
                    });
                    console.log(
                        `이미지 압축 완료: ${(file.size / 1024).toFixed(2)}KB → ${(fileToUpload.size / 1024).toFixed(2)}KB`
                    );
                }
            }
        } catch (error: any) {
            console.error("이미지 압축 실패:", error);
            throw new Error(`이미지 압축 실패: ${error.message || "압축할 수 없습니다."}`);
        }
    }

    const fileExt = fileToUpload.name.split(".").pop();
    const fileName = `${userId}_${Date.now()}.${fileExt}`;
    const filePath = `personal-expenses/${fileName}`;

    const { error: uploadError } = await supabase.storage
        .from("personal-expense-receipts")
        .upload(filePath, fileToUpload);

    if (uploadError) {
        console.error("Error uploading receipt file:", uploadError);
        throw new Error(`영수증 업로드 실패: ${uploadError.message}`);
    }

    return filePath;
}

/**
 * 개인 지출 영수증 public URL 가져오기
 */
export function getPersonalExpenseReceiptUrl(receiptPath: string): string {
    const { data } = supabase.storage
        .from("personal-expense-receipts")
        .getPublicUrl(receiptPath);

    return data.publicUrl;
}

// ==================== 유틸리티 함수 ====================

/**
 * 마일리지 날짜 포맷팅 (YYYY-MM-DD -> "MM월 DD일 (요일)")
 */
function formatMileageDate(dateString: string): string {
    const date = new Date(dateString);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
    const weekday = weekdays[date.getDay()];

    return `${month}월 ${day}일 (${weekday})`;
}

/**
 * 카드 지출 날짜 포맷팅 (YYYY-MM-DD -> "MM월 DD일 (요일)")
 */
function formatExpenseDate(dateString: string): string {
    const date = new Date(dateString);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
    const weekday = weekdays[date.getDay()];

    return `${month}월 ${day}일 (${weekday})`;
}
