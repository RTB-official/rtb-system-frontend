import { useEffect, useState, useRef } from "react";
import {
    getUserNotifications,
    getUnreadNotificationCount,
    type Notification,
} from "../lib/notificationApi";

export function useNotifications(userId: string | null) {
    const [showNotifications, setShowNotifications] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const notificationRef = useRef<HTMLDivElement>(null);

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
