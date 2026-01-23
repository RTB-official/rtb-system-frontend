//notificationApi.ts
import { supabase } from "./supabase";

// ==================== 타입 정의 ====================

export interface Notification {
    id: string;
    user_id: string;
    title: string;
    message: string;
    type: "report" | "schedule" | "vacation" | "other";
    created_at: string;
    read_at: string | null;
}

export interface CreateNotificationInput {
    user_id: string;
    title: string;
    message: string;
    type: "report" | "schedule" | "vacation" | "other";
}

// ==================== 알림 생성 ====================

/**
 * 알림 생성 (단일 사용자)
 */
export async function createNotification(
    data: CreateNotificationInput
): Promise<Notification> {
    const { data: notification, error } = await supabase
        .from("notifications")
        .insert([data])
        .select()
        .single();

    if (error) {
        console.error("Error creating notification:", error);
        if (error.message?.includes("Could not find the table") || error.message?.includes("does not exist")) {
            console.error("❌ [알림] notifications 테이블이 존재하지 않습니다. scripts/create_notifications_table.sql을 실행해주세요.");
            throw new Error(`notifications 테이블이 존재하지 않습니다. 데이터베이스 관리자에게 문의하세요.`);
        }
        throw new Error(`알림 생성 실패: ${error.message}`);
    }

    return notification;
}

/**
 * 여러 사용자에게 알림 일괄 생성
 */
export async function createNotificationsForUsers(
    userIds: string[],
    title: string,
    message: string,
    type: "report" | "schedule" | "vacation" | "other"
): Promise<Notification[]> {
    // RLS 정책 문제로 인해 함수를 사용하거나, 하나씩 생성
    // 먼저 직접 INSERT 시도
    const notifications = userIds.map((user_id) => ({
        user_id,
        title,
        message,
        type,
    }));

    let data: Notification[] = [];
    let error: any = null;

    // 방법 1: 일괄 INSERT 시도
    const { data: insertData, error: insertError } = await supabase
        .from("notifications")
        .insert(notifications)
        .select();

    if (insertError) {
        console.warn("⚠️ [알림] 일괄 생성 실패, 개별 생성 시도:", insertError.message);
        
        // 방법 2: RLS 함수 사용 시도 (함수가 있는 경우)
        try {
            const functionResults = await Promise.allSettled(
                userIds.map(async (user_id) => {
                    try {
                        const { data: funcData, error: funcError } = await supabase.rpc(
                            'create_notification_for_user',
                            {
                                p_user_id: user_id,
                                p_title: title,
                                p_message: message,
                                p_type: type,
                            }
                        );
                        
                        if (funcError) {
                            console.error(`❌ [알림] 함수 호출 실패 (${user_id}):`, funcError);
                            throw funcError;
                        }
                        
                        // 함수가 JSON 객체를 직접 반환하므로 그대로 사용
                        if (!funcData) {
                            console.error(`❌ [알림] 함수가 null 반환 (${user_id})`);
                            throw new Error("함수가 null을 반환했습니다");
                        }
                        
                    // JSON 객체를 Notification 타입으로 변환
                    const notification: Notification = {
                        id: funcData.id,
                        user_id: funcData.user_id,
                        title: funcData.title,
                        message: funcData.message,
                        type: funcData.type,
                        read_at: funcData.read_at || null,
                        created_at: funcData.created_at,
                    };
                        
                        return notification;
                    } catch (err) {
                        console.error(`❌ [알림] 개별 함수 호출 실패 (${user_id}):`, err);
                        throw err;
                    }
                })
            );
            
            const successful = functionResults
                .filter((result): result is PromiseFulfilledResult<Notification> => 
                    result.status === 'fulfilled' && result.value !== null
                )
                .map(result => result.value);
            
            const failed = functionResults.filter(result => result.status === 'rejected');
            
            if (successful.length > 0) {
                return successful;
            }
        } catch (funcError) {
            console.error("알림 함수 생성 실패:", funcError);
        }
        
        // 방법 3: 개별 INSERT 시도
        const individualResults = await Promise.allSettled(
            userIds.map(async (user_id) => {
                const { data: indData, error: indError } = await supabase
                    .from("notifications")
                    .insert([{ user_id, title, message, type }])
                    .select()
                    .single();
                
                if (indError) {
                    throw indError;
                }
                return indData;
            })
        );
        
        const successful = individualResults
            .filter((result): result is PromiseFulfilledResult<Notification> => 
                result.status === 'fulfilled' && result.value !== null
            )
            .map(result => result.value);
        
        if (successful.length > 0) {
            return successful;
        }
        
        // 모든 방법 실패
        error = insertError;
    } else {
        data = insertData || [];
    }

    if (error) {
        console.error("Error creating notifications:", error);
        if (error.message?.includes("Could not find the table") || error.message?.includes("does not exist")) {
            console.error("❌ [알림] notifications 테이블이 존재하지 않습니다. scripts/create_notifications_table.sql을 실행해주세요.");
            throw new Error(`notifications 테이블이 존재하지 않습니다. 데이터베이스 관리자에게 문의하세요.`);
        }
        if (error.message?.includes("row-level security") || error.message?.includes("RLS")) {
            console.error("❌ [알림] RLS 정책 문제입니다. scripts/fix_notification_rls.sql을 실행해주세요.");
            throw new Error(`RLS 정책 문제: ${error.message}`);
        }
        throw new Error(`알림 생성 실패: ${error.message}`);
    }

    return data;
}

// ==================== 알림 조회 ====================

/**
 * 사용자의 알림 목록 조회 (2주 이내만, 자동 삭제된 것 제외)
 */
export async function getUserNotifications(
    userId: string
): Promise<Notification[]> {
    // 2주 = 14일 전까지의 알림만 조회
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    const twoWeeksAgoISO = twoWeeksAgo.toISOString();

    const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .gte("created_at", twoWeeksAgoISO)
        .order("created_at", { ascending: false })
        .limit(100);

    if (error) {
        console.error("Error fetching notifications:", error);
        if (error.message?.includes("Could not find the table") || error.message?.includes("does not exist")) {
            console.warn("⚠️ [알림] notifications 테이블이 존재하지 않습니다. scripts/create_notifications_table.sql을 실행해주세요.");
            // 테이블이 없으면 빈 배열 반환 (에러를 던지지 않음)
            return [];
        }
        throw new Error(`알림 조회 실패: ${error.message}`);
    }

    // 2주 지난 알림은 자동으로 삭제 (백그라운드 작업)
    await deleteOldNotifications(userId);

    return data || [];
}

/**
 * 2주 지난 알림 자동 삭제
 */
async function deleteOldNotifications(userId?: string): Promise<void> {
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    const twoWeeksAgoISO = twoWeeksAgo.toISOString();

    let query = supabase
        .from("notifications")
        .delete()
        .lt("created_at", twoWeeksAgoISO);

    if (userId) {
        query = query.eq("user_id", userId);
    }

    const { error } = await query;

    if (error) {
        console.error("Error deleting old notifications:", error);
        // 알림 삭제 실패는 치명적이지 않으므로 에러를 던지지 않음
    }
}

/**
 * 읽지 않은 알림 개수 조회
 */
export async function getUnreadNotificationCount(
    userId: string
): Promise<number> {
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    const twoWeeksAgoISO = twoWeeksAgo.toISOString();

    const { count, error } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .is("read_at", null)
        .gte("created_at", twoWeeksAgoISO);

    if (error) {
        console.error("Error counting unread notifications:", error);
        if (error.message?.includes("Could not find the table") || error.message?.includes("does not exist")) {
            console.warn("⚠️ [알림] notifications 테이블이 존재하지 않습니다. scripts/create_notifications_table.sql을 실행해주세요.");
            return 0;
        }
        return 0;
    }

    return count || 0;
}

// ==================== 알림 읽음 처리 ====================

/**
 * 알림을 읽음으로 표시
 */
export async function markNotificationAsRead(
    notificationId: string
): Promise<void> {
    const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", notificationId);

    if (error) {
        console.error("Error marking notification as read:", error);
        throw new Error(`알림 읽음 처리 실패: ${error.message}`);
    }
}

/**
 * 모든 알림을 읽음으로 표시
 */
export async function markAllNotificationsAsRead(
    userId: string
): Promise<void> {
    const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("user_id", userId)
        .is("read_at", null);

    if (error) {
        console.error("Error marking all notifications as read:", error);
        throw new Error(`모든 알림 읽음 처리 실패: ${error.message}`);
    }
}

// ==================== 공무팀 사용자 조회 ====================

/**
 * 공무팀 소속 사용자 ID 목록 조회
 */
export async function getGongmuTeamUserIds(): Promise<string[]> {
    const { data, error } = await supabase
        .from("profiles")
        .select("id")
        .eq("department", "공무팀");

    if (error) {
        console.error("Error fetching Gongmu team users:", error);
        throw new Error(`공무팀 사용자 조회 실패: ${error.message}`);
    }

    return data?.map((p) => p.id) || [];
}

// ==================== 대표님 사용자 ID 조회 ====================

/**
 * 대표님(admin) 사용자 ID 조회
 */
export async function getAdminUserIds(): Promise<string[]> {
    // role이 'admin'이거나 position이 '대표'인 사용자 조회
    const { data, error } = await supabase
        .from("profiles")
        .select("id")
        .or("role.eq.admin,position.eq.대표");

    if (error) {
        console.error("Error fetching admin users:", error);
        throw new Error(`대표님 사용자 조회 실패: ${error.message}`);
    }

    return data?.map((p) => p.id) || [];
}

