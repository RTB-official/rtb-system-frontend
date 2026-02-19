// src/components/common/ActionMenu.tsx
import { useEffect, useRef } from "react";
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
    children,
    userDisplayName,
    userEmail,
}: ActionMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null);

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
        };
        return tailwindWidths[w] || 256;
    };

    const menuWidthPx = getWidthValue(width);
    const menuHeightPx = 220; // CalendarMenu 항목 3개 기준 예상 높이
    let top = 0;
    let left = 0;

    if (position) {
        top = position.y;
        left = position.x;
    } else if (anchorEl) {
        const rect = anchorEl.getBoundingClientRect();
        top = rect.bottom + 8;
        left = rect.right - menuWidthPx;

        if (placement === "right") {
            top = rect.top;
            left = rect.right + 12;
        } else if (placement === "bottom-left") {
            top = rect.bottom + 8;
            left = rect.left;
        }
    }

    // 화면 밖으로 나가는 것 방지 (가로)
    if (left < 12) left = 12;
    if (left + menuWidthPx > window.innerWidth - 12) {
        left = window.innerWidth - menuWidthPx - 12;
    }

    // 화면 밖으로 나가는 것 방지 (세로)
    if (top + menuHeightPx > window.innerHeight - 12) {
        top = window.innerHeight - menuHeightPx - 12;
    }
    if (top < 12) top = 12;

    return createPortal(
        <div
            ref={menuRef}
            className={`fixed ${width} rounded-2xl border border-gray-100 bg-white shadow-xl ring-1 ring-black/5 p-3 flex flex-col z-9999`}
            style={{
                top,
                left,
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
