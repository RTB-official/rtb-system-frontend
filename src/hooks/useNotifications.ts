//useNotifications.ts
import { useEffect, useState, useRef } from "react";
import {
    getUserNotifications,
    getUnreadNotificationCount,
    type Notification,
} from "../lib/notificationApi";

export function useNotifications(userId: string | null) {
    const [showNotifications, setShowNotifications] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState<number>(() => {
        // 새로고침 시 깜빡임 방지를 위해 localStorage에서 초기값 읽기
        const cached = localStorage.getItem("sidebarUnreadCount");
        const n = cached ? Number(cached) : 0;
        return Number.isFinite(n) ? n : 0;
    });
    const notificationRef = useRef<HTMLDivElement>(null);

    // ✅ 바깥 클릭 시 알림 닫기 (capture 제거 + composedPath로 안정화)
    useEffect(() => {
        if (!showNotifications) return;

        const handlePointerDown = (e: PointerEvent) => {
            const root = notificationRef.current;
            if (!root) return;

            const path = (e.composedPath?.() ?? []) as EventTarget[];
            const clickedInside = path.includes(root);

            if (!clickedInside) {
                setShowNotifications(false);
            }
        };

        // ✅ capture=false (기본) : 버튼/팝업 이벤트 처리 후 판단 → 즉시 닫힘 방지에 유리
        document.addEventListener("pointerdown", handlePointerDown);
        return () => {
            document.removeEventListener("pointerdown", handlePointerDown);
        };
    }, [showNotifications]);


    // 알림 데이터 로드 및 업데이트
    useEffect(() => {
        if (!userId) return;

        const loadNotifications = async () => {
            try {
                const [notificationList, count] = await Promise.all([
                    getUserNotifications(userId),
                    getUnreadNotificationCount(userId),
                ]);
                setNotifications(notificationList);
                setUnreadCount(count);
                // localStorage에 저장하여 새로고침 시 깜빡임 방지
                localStorage.setItem("sidebarUnreadCount", String(count));
            } catch (error) {
                console.error("알림 로드 실패:", error);
            }
        };

        loadNotifications();

        // 30초마다 알림 업데이트
        const interval = setInterval(loadNotifications, 30000);

        return () => clearInterval(interval);
    }, [userId]);

    const refreshNotifications = async () => {
        if (!userId) return;
        try {
            const [notificationList, count] = await Promise.all([
                getUserNotifications(userId),
                getUnreadNotificationCount(userId),
            ]);
            setNotifications(notificationList);
            setUnreadCount(count);
            // localStorage에 저장하여 새로고침 시 깜빡임 방지
            localStorage.setItem("sidebarUnreadCount", String(count));
        } catch (error) {
            console.error("알림 업데이트 실패:", error);
        }
    };

    return {
        showNotifications,
        setShowNotifications,
        notifications,
        unreadCount,
        notificationRef,
        refreshNotifications,
    };
}
