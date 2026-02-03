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

// 날짜 표시 포맷터
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
    onNotificationRead,
}: NotificationPopupProps) {
    const popupRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();

    const parseMeta = (meta?: any) => {
        if (!meta) return null;

        // 1) 이미 object(jsonb)로 들어오는 경우
        if (typeof meta === "object") return meta;

        // 2) string인 경우 JSON 파싱
        if (typeof meta === "string") {
            let v: any = meta;

            // ✅ 혹시 이중으로 stringify 된 경우까지 2번 정도 풀어줌
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

    const resolveNotificationRoute = (item: NotificationItem) => {
        const meta = parseMeta(item.meta);
        const metaRoute =
            meta?.route ||
            meta?.path ||
            (meta?.tbm_id ? `/tbm/${meta.tbm_id}` : null) ||
            (meta?.tbmId ? `/tbm/${meta.tbmId}` : null);

        if (metaRoute) return metaRoute;

        if (meta?.kind === "passport_expiry_within_1y") {
            return "/members";
        }

        if (meta?.kind === "member_passport_expiry") {
            return "/members";
        }

                // 🚗 차량 검사기간 임박 알림
                if (
                    meta?.kind === "vehicle_inspection_due" ||
                    /차량|검사/i.test(`${item.title ?? ""} ${item.message ?? ""}`)
                ) {
                    return "/vehicles";
                }

        const title = `${item.title ?? ""} ${item.message ?? ""}`;
        if (/tbm/i.test(title)) return "/tbm";
        if (/여권|passport/i.test(title)) return "/members";

        switch (item.type) {
            case "schedule":
                return "/dashboard";
            case "report":
                return "/report";
            case "vacation":
                return "/vacation";
            case "other":
            default:
                return null;
        }
    };


    // 알림 클릭 핸들러
    const handleNotificationClick = async (item: NotificationItem) => {
        // 읽지 않은 알림이면 읽음 처리
        if (!item.read_at) {
            try {
                await markNotificationAsRead(item.id);
                onNotificationRead?.(item.id);
            } catch (error) {
                console.error("알림 읽음 처리 실패:", error);
            }
        }

        // ✅ meta가 있으면 meta 기준으로 우선 이동 (모든 알림 공통)
        const route = resolveNotificationRoute(item);
        if (route) {
            navigate(route);
        }


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
            <div className="max-h-[380px] overflow-y-auto overflow-x-hidden custom-scrollbar">
                {items.length === 0 ? (
                    <div className="px-5 pt-8 pb-16 text-center text-gray-400">
                        알림이 없습니다.
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
