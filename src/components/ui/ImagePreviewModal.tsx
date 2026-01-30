import { useEffect } from "react";

interface ImagePreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    imageSrc: string | null;
    imageAlt?: string;
    fileName?: string;
    fileType?: string; // e.g. "image/jpeg", "application/pdf"
}

export default function ImagePreviewModal({
    isOpen,
    onClose,
    imageSrc,
    imageAlt = "Preview",
    fileName,
    fileType,
}: ImagePreviewModalProps) {
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => {
            document.body.style.overflow = "";
        };
    }, [isOpen]);

    if (!isOpen || !imageSrc) return null;

    const isPdf = fileType === "application/pdf" || imageSrc.toLowerCase().endsWith(".pdf");

    return (
        <div
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999] p-4"
            onClick={onClose}
        >
            {/* 닫기 버튼 */}
            <button
                onClick={onClose}
                className="absolute top-4 right-4 w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white transition-colors"
                aria-label="닫기"
            >
                <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <path
                        d="M19 6.41L17.59 5L12 10.59L6.41 5L5 6.41L10.59 12L5 17.59L6.41 19L12 13.41L17.59 19L19 17.59L13.41 12L19 6.41Z"
                        fill="currentColor"
                    />
                </svg>
            </button>

            {/* 컨텐츠 (클릭해도 닫히지 않음) */}
            <div
                className="max-w-[90vw] max-h-[90vh] flex flex-col items-center"
                onClick={(e) => e.stopPropagation()}
            >
                {isPdf ? (
                    <iframe
                        src={imageSrc}
                        title={fileName || imageAlt}
                        className="w-[85vw] h-[85vh] bg-white rounded-xl shadow-2xl"
                    />
                ) : (
                    <img
                        src={imageSrc}
                        alt={imageAlt}
                        className="max-w-full max-h-[85vh] rounded-xl shadow-2xl bg-white object-contain"
                    />
                )}

                {fileName && (
                    <p className="text-white text-center mt-3 text-[14px] truncate max-w-full">
                        {fileName}
                    </p>
                )}
            </div>
        </div>
    );
}
