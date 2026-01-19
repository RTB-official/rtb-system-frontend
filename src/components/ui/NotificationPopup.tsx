import { useEffect, useRef } from "react";
import { Notification } from "../../lib/notificationApi";

interface NotificationItem {
    id: string;
    title: string;
    message: string;
    created_at?: string;
    meta?: string;
}

interface NotificationPopupProps {
    onClose: () => void;
    items?: NotificationItem[];
    anchorEl?: HTMLElement | null;
    onMarkAllAsRead?: () => void;
}

// 날짜 포맷팅 헬퍼
function formatNotificationDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "방금 전";
    if (diffMins < 60) return `${diffMins}분 전`;
    if (diffHours < 24) return `${diffHours}시간 전`;
    if (diffDays < 7) return `${diffDays}일 전`;

    // 7일 이상이면 날짜 표시
    return date.toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
}

export default function NotificationPopup({
    onClose,
    items = [],
    anchorEl,
    onMarkAllAsRead,
}: NotificationPopupProps) {
    const popupRef = useRef<HTMLDivElement>(null);

    // 바깥 클릭 닫기
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as Node;
            if (
                popupRef.current &&
                !popupRef.current.contains(target) &&
                (!anchorEl || !anchorEl.contains(target))
            ) {
                onClose();
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [onClose, anchorEl]);

    return (
        <div
            ref={popupRef}
            className="absolute left-[239px] top-0 -translate-y-4 -translate-x-[16px] w-[360px] bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-50 animate-in fade-in slide-in-from-left-4 duration-200"
        >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-50">
                <h4 className="text-[20px] font-bold text-[#1e293b]">알림</h4>
                {items.length > 0 && onMarkAllAsRead && (
                    <button
                        onClick={onMarkAllAsRead}
                        className="text-[14px] text-gray-400 hover:text-gray-600 font-medium transition-colors"
                    >
                        모두 읽음
                    </button>
                )}
            </div>

            {/* Notification List */}
            <div className="max-h-[480px] overflow-y-auto custom-scrollbar">
                {items.length === 0 ? (
                    <div className="px-5 pt-8 pb-16 text-center text-gray-400">
                        알림이 없습니다.
                    </div>
                ) : (
                    items.map((it) => (
                        <div
                            key={it.id}
                            className="flex flex-col gap-1 px-5 py-4 bg-white hover:bg-[#f0f7ff] transition-colors cursor-pointer relative group border-b border-gray-50 last:border-0"
                        >
                            <div className="flex items-start justify-between">
                                <p className="text-[14px] font-semibold text-[#475569]">
                                    {it.title}
                                </p>
                            </div>
                            <p className="text-[14px] text-[#64748b] leading-relaxed">
                                {it.message}
                            </p>
                            {(it.created_at || it.meta) && (
                                <p className="text-[13px] text-gray-400 mt-1">
                                    {it.meta ||
                                        (it.created_at &&
                                            formatNotificationDate(
                                                it.created_at
                                            ))}
                                </p>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
