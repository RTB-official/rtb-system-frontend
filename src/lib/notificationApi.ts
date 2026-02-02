//notificationApi.ts
import { supabase } from "./supabase";

// ==================== 타입 정의 ====================

export interface Notification {
    id: string;
    user_id: string;
    title: string;
    message: string;
    type: "report" | "schedule" | "vacation" | "other";
    meta?: string | null;
    created_at: string;
    read_at: string | null;
}

export interface CreateNotificationInput {
    user_id: string;
    title: string;
    message: string;
    type: "report" | "schedule" | "vacation" | "other";
    meta?: string;
}

// ==================== 알림 생성 ====================

/**
 * 알림 생성 (단일 사용자)
 */
export async function createNotification(
    data: CreateNotificationInput
): Promise<Notification> {
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
    const {
        data: { session },
    } = await supabase.auth.getSession();
    const accessToken = session?.access_token;

    const headers: Record<string, string> = {};
    if (anonKey) {
        headers["apikey"] = anonKey;
    }
    if (accessToken) {
        headers["Authorization"] = `Bearer ${accessToken}`;
    }

    const { data: result, error } = await supabase.functions.invoke(
        "create-notifications",
        {
            body: {
                userIds: [data.user_id],
                title: data.title,
                message: data.message,
                type: data.type,
                meta: data.meta ?? null,
            },
            headers: Object.keys(headers).length > 0 ? headers : undefined,
        }
    );

    if (error) {
        console.error("Error creating notification:", error);
        throw new Error(`알림 생성 실패: ${error.message}`);
    }

    const created = result?.data?.[0];
    if (!created) {
        throw new Error("알림 생성 실패: 응답 데이터 없음");
    }

    return created as Notification;
}

/**
 * 여러 사용자에게 알림 일괄 생성
 */
export async function createNotificationsForUsers(
    userIds: string[],
    title: string,
    message: string,
    type: "report" | "schedule" | "vacation" | "other",
    meta?: string
): Promise<Notification[]> {
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
    const {
        data: { session },
    } = await supabase.auth.getSession();
    const accessToken = session?.access_token;

    const headers: Record<string, string> = {};
    if (anonKey) {
        headers["apikey"] = anonKey;
    }
    if (accessToken) {
        headers["Authorization"] = `Bearer ${accessToken}`;
    }

    const { data: result, error } = await supabase.functions.invoke(
        "create-notifications",
        {
            body: {
                userIds,
                title,
                message,
                type,
                meta: meta ?? null,
            },
            headers: Object.keys(headers).length > 0 ? headers : undefined,
        }
    );

    if (error) {
        console.error("Error creating notifications:", error);
        throw new Error(`알림 생성 실패: ${error.message}`);
    }

    return (result?.data || []) as Notification[];
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
