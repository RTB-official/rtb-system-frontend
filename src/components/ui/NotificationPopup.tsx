//NotificationPopup.tsx
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { markNotificationAsRead } from "../../lib/notificationApi";
import useIsMobile from "../../hooks/useIsMobile";
import { IconClose } from "../icons/Icons";

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
    triggerMenuToast?: (type: "vehicles" | "members" | "vacation") => Promise<void> | void;
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
    triggerMenuToast,
}: NotificationPopupProps) {
    const popupRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();
    const isMobile = useIsMobile();

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

        // 📌 새 게시글 알림 → 게시판으로 이동 (meta 있으면 meta 기준, 없으면 제목/메시지로 판별)
        if (meta?.kind === "board_post" && meta?.postId) {
            return "/board";
        }
        if (meta?.postId && item.title === "새 게시글") {
            return "/board";
        }
        const titleAndMessage = `${item.title ?? ""} ${item.message ?? ""}`;
        if (item.title === "새 게시글" || /새 글을 올렸습니다/.test(titleAndMessage)) {
            return "/board";
        }

        const title = titleAndMessage;
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

    const resolveMenuType = (
        item: NotificationItem
    ): "vehicles" | "members" | "vacation" | null => {
        const meta = parseMeta(item.meta);
        const title = `${item.title ?? ""} ${item.message ?? ""}`;

        // 🚗 차량
        if (
            meta?.kind === "vehicle_inspection_due" ||
            /차량|검사/i.test(title)
        ) {
            return "vehicles";
        }

        // 🛂 구성원(여권)
        if (
            meta?.kind === "passport_expiry_within_1y" ||
            meta?.kind === "member_passport_expiry" ||
            /여권|passport/i.test(title)
        ) {
            return "members";
        }

        // 🏖️ 휴가
        if (item.type === "vacation" || /휴가/i.test(title)) {
            return "vacation";
        }

        return null;
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

        // ✅ 알림 팝업으로 들어가도 토스트 띄우고 점 제거
        const menuType = resolveMenuType(item);
        if (menuType) {
            await triggerMenuToast?.(menuType);
        }

        onClose();
    };


    const content = (
        <>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-50 shrink-0">
                <h4 className="text-[20px] font-bold text-[#1e293b]">알림</h4>
                <div className="flex items-center gap-2">
                    {items.length > 0 && onMarkAllAsRead && (
                        <button
                            onClick={onMarkAllAsRead}
                            className="text-[14px] text-gray-400 hover:text-gray-600 font-medium transition-colors"
                        >
                            모두 읽음
                        </button>
                    )}
                    {isMobile && (
                        <button
                            onClick={onClose}
                            className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
                            aria-label="닫기"
                        >
                            <IconClose className="w-6 h-6" />
                        </button>
                    )}
                </div>
            </div>

            {/* Notification List */}
            <div className={isMobile ? "flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar min-h-0" : "max-h-[380px] overflow-y-auto overflow-x-hidden custom-scrollbar"}>
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
                                className={`flex flex-col gap-1 px-5 py-4 transition-colors cursor-pointer relative group border-b border-gray-50 last:border-0 ${isRead
                                    ? "bg-white hover:bg-gray-50"
                                    : "bg-blue-50 hover:bg-gray-100"
                                    }`}
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <p
                                        className={`text-[14px] leading-relaxed ${isRead
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
                                    className={`text-[14px] leading-relaxed ${isRead
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
        </>
    );

    // 모바일: 전체 화면 레이어로 표시 (잘림 방지, 좌우 16px 패딩)
    if (isMobile) {
        return createPortal(
            <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4" role="dialog" aria-modal="true">
                <div className="absolute inset-0 bg-black/35" onClick={onClose} aria-hidden />
                <div className="relative flex flex-col w-full max-h-[85vh] rounded-2xl bg-white shadow-2xl overflow-hidden animate-in fade-in duration-200">
                    <div ref={popupRef} className="flex flex-col min-h-0 flex-1" onMouseDown={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
                        {content}
                    </div>
                </div>
            </div>,
            document.body
        );
    }

    // 데스크톱: 기존 위치(사이드바 오른쪽) 팝업
    return (
        <div
            ref={popupRef}
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute left-[239px] top-0 -translate-y-4 -translate-x-[16px] w-[360px] bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-x-hidden overflow-y-hidden z-50 animate-in fade-in slide-in-from-left-4 duration-200 pb-4"
        >
            {content}
        </div>
    );
}
