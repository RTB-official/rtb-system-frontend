import { useEffect, useRef } from "react";

interface ActionMenuProps {
    isOpen: boolean;
    anchorEl: HTMLElement | null;
    onClose: () => void;
    onEdit: () => void;
    onDelete: () => void;
    onResetPassword?: () => void;
    onDownload?: () => void;
    downloadLabel?: string;
}

const IconEdit = () => (
    <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
    >
        <path d="M4 21v-3.5L17.5 4.5a2 2 0 012.8 0l0 0a2 2 0 010 2.8L7.5 20.5H4z" />
    </svg>
);

const IconTrash = () => (
    <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
    >
        <path d="M3 6h18" />
        <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
        <path d="M10 11v6M14 11v6" />
        <path d="M9 6V4h6v2" />
    </svg>
);

const IconDownload = () => (
    <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
    >
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
        <path d="M7 10l5 5 5-5" />
        <path d="M12 15V3" />
    </svg>
);

const IconLock = () => (
    <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
    >
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0110 0v4" />
    </svg>
);

export default function ActionMenu({
    isOpen,
    anchorEl,
    onClose,
    onEdit,
    onDelete,
    onResetPassword,
    onDownload,
    downloadLabel = "PDF 다운로드",
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

    if (!isOpen || !anchorEl) return null;

    const rect = anchorEl.getBoundingClientRect();
    const top = rect.bottom + 8;
    const left = rect.right - 176; // 메뉴 폭 기준으로 오른쪽 정렬

    return (
        <div className="fixed inset-0 z-[60]">
            <div
                ref={menuRef}
                className="fixed w-44 rounded-xl border border-gray-200 bg-white shadow-lg ring-1 ring-black/5 overflow-hidden"
                style={{ top, left }}
            >
                <button
                    className="w-full px-4 py-3 text-left text-[13px] hover:bg-gray-50 text-gray-800 flex items-center gap-3"
                    onClick={() => {
                        onEdit();
                        onClose();
                    }}
                >
                    <IconEdit />
                    수정
                </button>
                {onResetPassword && (
                    <button
                        className="w-full px-4 py-3 text-left text-[13px] hover:bg-gray-50 text-gray-800 flex items-center gap-3"
                        onClick={() => {
                            onResetPassword();
                            onClose();
                        }}
                    >
                        <IconLock />
                        비밀번호 재설정
                    </button>
                )}
                <button
                    className="w-full px-4 py-3 text-left text-[13px] hover:bg-gray-50 text-gray-800 flex items-center gap-3"
                    onClick={() => {
                        onDelete();
                        onClose();
                    }}
                >
                    <IconTrash />
                    삭제
                </button>
                {onDownload && (
                    <button
                        className="w-full px-4 py-3 text-left text-[13px] bg-gray-50 hover:bg-gray-100 text-gray-800 flex items-center gap-3"
                        onClick={() => {
                            onDownload();
                            onClose();
                        }}
                    >
                        <IconDownload />
                        {downloadLabel}
                    </button>
                )}
            </div>
        </div>
    );
}
