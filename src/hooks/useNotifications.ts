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

    // 알림 데이터 로드 및 업데이트 (초기 로딩 지연)
    useEffect(() => {
        if (!userId) return;

        let intervalId: NodeJS.Timeout | null = null;

        // 초기 로딩 지연 (100ms) - 메인 콘텐츠 우선 로딩
        const timeoutId = setTimeout(() => {
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
            intervalId = setInterval(loadNotifications, 30000);
        }, 100);

        return () => {
            clearTimeout(timeoutId);
            if (intervalId) clearInterval(intervalId);
        };
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
