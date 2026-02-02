//NotificationPopup.tsx
import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { markNotificationAsRead } from "../../lib/notificationApi";

interface NotificationItem {
    id: string;
    title: string;
    message: string;
    type: "report" | "schedule" | "vacation" | "other";
    created_at?: string;
    read_at?: string | null;
    meta?: any;
}

interface NotificationPopupProps {
    onClose: () => void;
    items?: NotificationItem[];
    anchorEl?: HTMLElement | null;
    onMarkAllAsRead?: () => void;
    onNotificationRead?: (id: string) => void;
}

// Format notification date.
function formatNotificationDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "\uBC29\uAE08 \uC804";
    if (diffMins < 60) return `${diffMins}\uBD84 \uC804`;
    if (diffHours < 24) return `${diffHours}\uC2DC\uAC04 \uC804`;
    if (diffDays < 7) return `${diffDays}\uC77C \uC804`;

    // Show date for 7+ days.
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
    onNotificationRead,
}: NotificationPopupProps) {
    const popupRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();

    const parseMeta = (meta?: any) => {
        if (!meta) return null;

        // 1) meta object (jsonb)
        if (typeof meta === "object") return meta;

        // 2) string -> JSON parse
        if (typeof meta === "string") {
            let v: any = meta;

            // Handle double-stringify up to 2 times.
            for (let i = 0; i < 2; i++) {
                try {
                    v = JSON.parse(v);
                    if (typeof v === "object") return v;
                } catch {
                    break;
                }
            }
        }

        return null;
    };

    // Notification click handler
    const handleNotificationClick = async (item: NotificationItem) => {
        // Mark as read if unread
        if (!item.read_at) {
            try {
                await markNotificationAsRead(item.id);
                onNotificationRead?.(item.id);
            } catch (error) {
                console.error("Failed to mark notification as read:", error);
            }
        }

        // Navigate by meta first (common for all notifications)
        const meta = parseMeta(item.meta);
        if (meta?.route) {
            navigate(meta.route);
        } else if (meta?.tbm_id) {
            navigate(`/tbm/${meta.tbm_id}`);
        } else if (meta?.kind === "passport_expiry_within_1y") {
            navigate("/members");
        } else {
            const text = `${item.title ?? ""} ${item.message ?? ""}`;
            if (/tbm/i.test(text)) {
                navigate("/tbm");
            } else if (text.includes("\uC5EC\uAD8C")) {
                navigate("/members");
            } else {
            // Fallback by type
            switch (item.type) {
                case "schedule":
                    navigate("/dashboard");
                    break;
                case "report":
                    navigate("/report");
                    break;
                case "vacation":
                    navigate("/Vacation");
                    break;
                case "other":
                default:
                    break;
            }
            }
        }

        // Close notification popup
        onClose();
    };

    return (
        <div
            ref={popupRef}
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute left-[239px] top-0 -translate-y-4 -translate-x-[16px] w-[360px] bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-x-hidden overflow-y-hidden z-50 animate-in fade-in slide-in-from-left-4 duration-200 pb-4"
        >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-50">
                <h4 className="text-[20px] font-bold text-[#1e293b]">{"\uC54C\uB9BC"}</h4>
                {items.length > 0 && onMarkAllAsRead && (
                    <button
                        onClick={onMarkAllAsRead}
                        className="text-[14px] text-gray-400 hover:text-gray-600 font-medium transition-colors"
                    >
                        {"\uBAA8\uB450 \uC77D\uC74C"}
                    </button>
                )}
            </div>

            {/* Notification List */}
            <div className="max-h-[380px] overflow-y-auto overflow-x-hidden custom-scrollbar">
                {items.length === 0 ? (
                    <div className="px-5 pt-8 pb-16 text-center text-gray-400">
                        {"\uC54C\uB9BC\uC774 \uC5C6\uC2B5\uB2C8\uB2E4."}
                    </div>
                ) : (
                    items.map((it) => {
                        const isRead = !!it.read_at;
                        return (
                            <div
                                key={it.id}
                                onClick={() => handleNotificationClick(it)}
                                className={`flex flex-col gap-1 px-5 py-4 transition-colors cursor-pointer relative group border-b border-gray-50 last:border-0 ${
                                    isRead
                                        ? "bg-white hover:bg-gray-50"
                                        : "bg-blue-50 hover:bg-gray-100"
                                }`}
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <p
                                        className={`text-[14px] leading-relaxed ${
                                            isRead
                                                ? "font-medium text-[#475569]"
                                                : "font-semibold text-[#1e293b]"
                                        }`}
                                    >
                                        {it.title}
                                    </p>
                                    {!isRead && (
                                        <div className="shrink-0 w-2 h-2 rounded-full bg-blue-400 mt-1.5"></div>
                                    )}
                                </div>
                                <p
                                    className={`text-[14px] leading-relaxed ${
                                        isRead
                                            ? "text-[#64748b]"
                                            : "text-[#475569]"
                                    }`}
                                >
                                    {it.message}
                                </p>
                                {it.created_at && (
                                    <p className="text-[13px] text-gray-400 mt-0.5">
                                        {formatNotificationDate(it.created_at)}
                                    </p>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
