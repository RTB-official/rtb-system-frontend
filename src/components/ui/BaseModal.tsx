import { useEffect, ReactNode } from "react";
import { createPortal } from "react-dom";

interface BaseModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: ReactNode;
    children: ReactNode;
    footer?: ReactNode;
    maxWidth?: string;
    className?: string;
    showCloseButton?: boolean;
}

function IconClose() {
    return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path
                d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41Z"
                fill="currentColor"
            />
        </svg>
    );
}

export default function BaseModal({
    isOpen,
    onClose,
    title,
    children,
    footer,
    maxWidth = "max-w-[440px]",
    className = "",
    showCloseButton = true,
}: BaseModalProps) {
    // 모달 열릴 때 바디 스크롤 잠금
    useEffect(() => {
        if (!isOpen) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = prev;
        };
    }, [isOpen]);

    // ESC 닫기
    useEffect(() => {
        if (!isOpen) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                onClose();
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return createPortal(
        <div
            className="fixed inset-0 z-[10000] flex items-center justify-center"
            aria-modal="true"
            role="dialog"
        >
            {/* Overlay */}
            <div className="absolute inset-0 bg-black/35" onClick={onClose} />

            {/* Modal - 모바일에서 좌우 16px 패딩 */}
            <div className="absolute inset-0 flex items-center justify-center p-4 sm:p-0">
                <div
                    className={`w-full ${maxWidth} bg-white p-5 gap-3 rounded-2xl shadow-xl flex flex-col overflow-hidden max-h-[90vh] sm:max-h-none ${className}`}
                >
                    {/* Header */}
                    <div className={`flex items-center ${showCloseButton ? 'justify-between' : 'justify-start'}`}>
                        <h2 className="text-[22px] font-semibold text-gray-900">
                            {title}
                        </h2>
                        {showCloseButton && (
                            <button
                                onClick={onClose}
                                className="w-9 h-9 rounded-full hover:bg-gray-100 text-gray-700 flex items-center justify-center transition-colors"
                                aria-label="close"
                            >
                                <IconClose />
                            </button>
                        )}
                    </div>

                    {/* Body */}
                    <div className="pb-4 flex-1 overflow-y-auto">
                        {children}
                    </div>

                    {/* Footer */}
                    {footer && (
                        <div className="flex justify-center gap-2">
                            {footer}
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
}
