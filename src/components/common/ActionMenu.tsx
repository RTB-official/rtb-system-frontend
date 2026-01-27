// src/components/common/ActionMenu.tsx
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
    IconEdit,
    IconTrash,
    IconDownload,
    IconLock,
    IconLogout,
} from "../icons/Icons";

interface ActionMenuProps {
    isOpen: boolean;
    anchorEl: HTMLElement | null;
    position?: { x: number; y: number };
    onClose: () => void;
    onEdit?: () => void;
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
    onDelete,
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
                    <div className="px-2 py-2 mb-1">
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
                    <div className="h-px bg-gray-200 mx-2 mb-2" />
                </>
            )}
            {children}
            {onEdit && (
                <button
                    className="w-full px-3 py-2.5 text-left text-[15px] hover:bg-gray-50 active:bg-gray-100 text-gray-800 flex items-center gap-3 rounded-lg transition-colors cursor-pointer"
                    onClick={() => {
                        onEdit();
                        onClose();
                    }}
                >
                    <div className="text-gray-500">
                        <IconEdit />
                    </div>
                    수정
                </button>
            )}
            {onResetPassword && (
                <button
                    className="w-full px-3 py-2.5 text-left text-[15px] hover:bg-gray-50 active:bg-gray-100 text-gray-800 flex items-center gap-3 rounded-lg transition-colors cursor-pointer"
                    onClick={() => {
                        onResetPassword();
                        onClose();
                    }}
                >
                    <div className="text-gray-500">
                        <IconLock />
                    </div>
                    비밀번호 재설정
                </button>
            )}
            {onDownload && (
                <button
                    className="w-full px-3 py-2.5 text-left text-[15px] hover:bg-gray-50 active:bg-gray-100 text-gray-800 flex items-center gap-3 rounded-lg transition-colors cursor-pointer"
                    onClick={() => {
                        onDownload();
                        onClose();
                    }}
                >
                    <div className="text-gray-500">
                        <IconDownload />
                    </div>
                    {downloadLabel}
                </button>
            )}
            {showDelete && onDelete && (
                <button
                    className="w-full px-3 py-2.5 text-left text-[15px] hover:bg-red-50 active:bg-red-100 text-red-600 flex items-center gap-3 rounded-lg transition-colors cursor-pointer"
                    onClick={() => {
                        onDelete();
                        onClose();
                    }}
                >
                    <div className="text-red-400">
                        <IconTrash />
                    </div>
                    삭제
                </button>
            )}
            {showLogout && onLogout && (
                <button
                    className="w-full px-3 py-2.5 text-left text-[15px] hover:bg-gray-50 active:bg-gray-100 text-gray-800 flex items-center gap-3 rounded-lg cursor-pointer"
                    onClick={() => {
                        onLogout();
                        onClose();
                    }}
                >
                    <div className="text-gray-500">
                        <IconLogout />
                    </div>
                    로그아웃
                </button>
            )}
        </div>,
        document.body
    );
}
