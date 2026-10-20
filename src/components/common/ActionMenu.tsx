// src/components/common/ActionMenu.tsx
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
    IconCheck,
    IconEdit,
    IconTrash,
    IconDownload,
    IconLock,
    IconLogout,
} from "../icons/Icons";

/** 액션 메뉴 내부에서 쓰는 아이콘+텍스트 버튼 한 줄 */
function ActionMenuButton({
    icon,
    children,
    onClick,
    variant = "default",
    className,
}: {
    icon: React.ReactNode;
    children: React.ReactNode;
    onClick: () => void;
    variant?: "default" | "danger";
    className?: string;
}) {
    const base = "w-full px-3 py-2.5 text-left text-[15px] flex items-center gap-3 rounded-lg transition-colors cursor-pointer";
    const styles =
        variant === "danger"
            ? "hover:bg-red-50 active:bg-red-100 text-red-600"
            : "hover:bg-gray-50 active:bg-gray-100 text-gray-800";
    const iconStyles = variant === "danger" ? "text-red-400" : "text-gray-500";
    return (
        <button
            type="button"
            className={[base, styles, className].filter(Boolean).join(" ")}
            onClick={onClick}
        >
            <div className={iconStyles}>{icon}</div>
            {children}
        </button>
    );
}

/** 액션 메뉴 내부 체크박스 한 줄 (체크 시 파란 박스 + 흰색 체크) */
export function ActionMenuCheckItem({
    checked,
    onToggle,
    children,
}: {
    checked: boolean;
    onToggle: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onToggle}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-[15px] text-gray-800 hover:bg-gray-50 rounded-lg"
        >
            {checked ? (
                <span className="w-4 h-4 rounded flex items-center justify-center shrink-0 bg-[rgb(81,162,255)]">
                    <IconCheck className="w-2.5 h-2.5 text-white" />
                </span>
            ) : (
                <span className="w-4 h-4 border border-gray-300 rounded shrink-0" />
            )}
            {children}
        </button>
    );
}

interface ActionMenuProps {
    isOpen: boolean;
    anchorEl: HTMLElement | null;
    position?: { x: number; y: number };
    onClose: () => void;
    onEdit?: () => void;
    onPdf?: () => void;
    pdfLabel?: string;
    showPdf?: boolean;
    onDelete?: () => void;
    onResetPassword?: () => void;
    onLogout?: () => void;
    onDownload?: () => void;
    downloadLabel?: string;
    showDelete?: boolean;
    headerContent?: React.ReactNode;
    showLogout?: boolean;
    placement?: "right" | "bottom-right" | "bottom-left";
    width?: string;
    /** Used only to keep the menu inside the viewport. */
    estimatedHeight?: number;
    children?: React.ReactNode;
    userDisplayName?: string;
    userEmail?: string;
}

export default function ActionMenu({
    isOpen,
    anchorEl,
    position,
    onClose,
    onEdit,
    onPdf,
    pdfLabel = "PDF",
    onDelete,
    showPdf,
    onResetPassword,
    onLogout,
    onDownload,
    downloadLabel = "PDF",
    showDelete = true,
    headerContent,
    showLogout = true,
    placement = "bottom-right",
    width = "w-64",
    estimatedHeight = 220,
    children,
    userDisplayName,
    userEmail,
}: ActionMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null);
    const [anchorTick, setAnchorTick] = useState(0);
    const [measuredHeight, setMeasuredHeight] = useState(0);

    useEffect(() => {
        if (!isOpen || !anchorEl) return;
        let frame = 0;
        const sync = () => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => setAnchorTick((value) => value + 1));
        };
        document.addEventListener("scroll", sync, true);
        document.addEventListener("scrollend", sync, true);
        window.addEventListener("resize", sync);
        return () => {
            cancelAnimationFrame(frame);
            document.removeEventListener("scroll", sync, true);
            document.removeEventListener("scrollend", sync, true);
            window.removeEventListener("resize", sync);
        };
    }, [isOpen, anchorEl]);

    useLayoutEffect(() => {
        if (!isOpen) {
            setMeasuredHeight(0);
            return;
        }
        const el = menuRef.current;
        if (!el) return;
        setMeasuredHeight(el.offsetHeight);
    }, [isOpen, children, anchorTick, width, estimatedHeight]);

    // 바깥 클릭 닫기
    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as Node;
            if (menuRef.current?.contains(target)) return;
            if (anchorEl?.contains(target)) return;
            onClose();
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () =>
            document.removeEventListener("mousedown", handleClickOutside);
    }, [isOpen, anchorEl, onClose]);

    // ESC 닫기
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen || (!anchorEl && !position)) return null;

    // width 값에서 숫자 추출 (w-64 -> 256px 등)
    const getWidthValue = (w: string) => {
        const match = w.match(/w-\[(\d+)px\]/);
        if (match) return parseInt(match[1]);
        const tailwindWidths: Record<string, number> = {
            "w-40": 160,
            "w-44": 176,
            "w-48": 192,
            "w-56": 224,
            "w-60": 240,
            "w-64": 256,
            "w-72": 288,
            "w-80": 320,
            "w-96": 384,
            "w-[560px]": 560,
            "w-[600px]": 600,
            "w-[640px]": 640,
        };
        return tailwindWidths[w] || 256;
    };

    const menuWidthPx = getWidthValue(width);
    /** 실측 높이가 있으면 그걸 쓰고, 없으면 추정값 */
    const menuHeightPx = measuredHeight > 0 ? measuredHeight : estimatedHeight;
    const viewPad = 12;
    const gap = 8;
    let top = 0;
    let left = 0;
    /** 앵커(또는 클릭) Y — 위로 열 때 메뉴 하단을 여기에 맞춤 */
    let pivotY = 0;
    let openAbove = false;
    let spaceBelow = Number.POSITIVE_INFINITY;
    let spaceAbove = Number.POSITIVE_INFINITY;

    /** 아래가 팝오버 높이보다 조금이라도 부족하면 위로. 위도 부족하면 더 넓은 쪽 */
    const shouldOpenAbove = (below: number, above: number) => {
        if (below >= menuHeightPx) return false;
        if (above >= menuHeightPx) return true;
        return above > below;
    };

    // 날짜 셀 등 앵커가 있으면 클릭 좌표보다 앵커를 우선해 가깝게 붙인다
    if (anchorEl) {
        void anchorTick;
        const rect = anchorEl.getBoundingClientRect();
        left = rect.right - menuWidthPx;
        pivotY = rect.top;

        if (placement === "right") {
            top = rect.top;
            left = rect.right + 12;
            pivotY = rect.top;
            spaceBelow = window.innerHeight - rect.top - viewPad;
            spaceAbove = rect.top - viewPad;
        } else if (placement === "bottom-left") {
            left = rect.left;
            spaceBelow = window.innerHeight - rect.bottom - gap - viewPad;
            spaceAbove = rect.top - gap - viewPad;
            openAbove = shouldOpenAbove(spaceBelow, spaceAbove);
            if (openAbove) {
                top = rect.top - gap - menuHeightPx;
                pivotY = rect.top;
            } else {
                top = rect.bottom + gap;
                pivotY = rect.bottom;
            }
        } else {
            // bottom-right (default)
            spaceBelow = window.innerHeight - rect.bottom - gap - viewPad;
            spaceAbove = rect.top - gap - viewPad;
            openAbove = shouldOpenAbove(spaceBelow, spaceAbove);
            if (openAbove) {
                top = rect.top - gap - menuHeightPx;
                pivotY = rect.top;
            } else {
                top = rect.bottom + gap;
                pivotY = rect.bottom;
            }
        }
    } else if (position) {
        left = position.x;
        pivotY = position.y;
        spaceBelow = window.innerHeight - position.y - gap - viewPad;
        spaceAbove = position.y - gap - viewPad;
        openAbove = shouldOpenAbove(spaceBelow, spaceAbove);
        if (openAbove) {
            top = position.y - gap - menuHeightPx;
        } else {
            top = position.y + gap;
        }
    }

    // 위로 연 뒤 실측 높이가 추정보다 작으면 메뉴를 앵커 쪽으로 내려 붙인다
    if (openAbove && measuredHeight > 0 && top + measuredHeight + gap < pivotY) {
        top = pivotY - gap - measuredHeight;
    }

    // 화면 밖으로 나가는 것 방지 (가로)
    if (left < viewPad) left = viewPad;
    if (left + menuWidthPx > window.innerWidth - viewPad) {
        left = window.innerWidth - menuWidthPx - viewPad;
    }

    // 세로: 위/아래 중 여유 있는 쪽에 전체 높이로 표시. 양쪽 다 부족할 때만 스크롤
    if (top < viewPad) top = viewPad;
    const availableHeight = openAbove
        ? Math.max(120, pivotY - gap - top)
        : Math.max(120, window.innerHeight - top - viewPad);
    const needsScroll = menuHeightPx > availableHeight + 1;
    const clampedMaxHeight = needsScroll ? availableHeight : undefined;

    return createPortal(
        <div
            ref={menuRef}
            className={`fixed ${width.startsWith("w-[") ? "" : width} rounded-2xl border border-gray-100 bg-white shadow-xl ring-1 ring-black/5 p-3 flex flex-col z-9999 ${
                needsScroll ? "overflow-y-auto overscroll-contain" : "overflow-visible"
            }`}
            style={{
                top,
                left,
                width: menuWidthPx,
                maxHeight: clampedMaxHeight,
            }}
        >
            {(userDisplayName || userEmail || headerContent) && (
                <>
                    <div
                        className={
                            userDisplayName || userEmail
                                ? "px-2 py-2 mb-1"
                                : "px-2 mb-1"
                        }
                    >
                        {userDisplayName && (
                            <p className="text-[16px] font-semibold text-gray-900 ">
                                {userDisplayName}
                            </p>
                        )}
                        {userEmail && (
                            <p className="text-sm text-gray-500">
                                {userEmail}
                            </p>
                        )}
                        {!userDisplayName && !userEmail && headerContent}
                    </div>
                    {(userDisplayName || userEmail) && (
                        <div className="h-px bg-gray-200 mx-2 mb-2" />
                    )}
                </>
            )}
            {children}
            {showPdf && onPdf && (
                <ActionMenuButton
                    icon={<IconDownload />}
                    onClick={() => {
                        onPdf();
                        onClose();
                    }}
                >
                    {pdfLabel}
                </ActionMenuButton>
            )}

            {onEdit && (
                <ActionMenuButton
                    icon={<IconEdit />}
                    onClick={() => {
                        onEdit();
                        onClose();
                    }}
                >
                    수정
                </ActionMenuButton>
            )}

            {onResetPassword && (
                <ActionMenuButton
                    icon={<IconLock />}
                    onClick={() => {
                        onResetPassword();
                        onClose();
                    }}
                    className="whitespace-nowrap"
                >
                    비밀번호 재설정
                </ActionMenuButton>
            )}
            {onDownload && (
                <ActionMenuButton
                    icon={<IconDownload />}
                    onClick={() => {
                        onDownload();
                        onClose();
                    }}
                >
                    {downloadLabel}
                </ActionMenuButton>
            )}
            {showDelete && onDelete && (
                <ActionMenuButton
                    icon={<IconTrash />}
                    variant="danger"
                    onClick={() => {
                        onDelete();
                        onClose();
                    }}
                >
                    삭제
                </ActionMenuButton>
            )}
            {showLogout && onLogout && (
                <ActionMenuButton
                    icon={<IconLogout />}
                    onClick={() => {
                        onLogout();
                        onClose();
                    }}
                >
                    로그아웃
                </ActionMenuButton>
            )}
        </div>,
        document.body
    );
}
