import { useEffect } from "react";

export interface ImagePreviewItem {
    src: string;
    fileName?: string;
}

interface ImagePreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    imageSrc: string | null;
    imageAlt?: string;
    fileName?: string;
    fileType?: string; // e.g. "image/jpeg", "application/pdf"
    /** 여러 장일 때 갤러리 모드: 이미지 목록과 현재 인덱스 */
    images?: ImagePreviewItem[];
    currentIndex?: number;
    onPrev?: () => void;
    onNext?: () => void;
}

export default function ImagePreviewModal({
    isOpen,
    onClose,
    imageSrc,
    imageAlt = "Preview",
    fileName,
    fileType,
    images,
    currentIndex = 0,
    onPrev,
    onNext,
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

    const isGallery = images && images.length > 1;

    useEffect(() => {
        if (!isOpen) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
            if (!isGallery) return;
            if (e.key === "ArrowLeft") {
                e.preventDefault();
                onPrev?.();
            }
            if (e.key === "ArrowRight") {
                e.preventDefault();
                onNext?.();
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [isOpen, isGallery, onClose, onPrev, onNext]);

    const currentSrc = isGallery && images[currentIndex] ? images[currentIndex].src : imageSrc;
    const currentFileName = isGallery && images[currentIndex] ? images[currentIndex].fileName : fileName;

    if (!isOpen || !currentSrc) return null;

    const isPdf = fileType === "application/pdf" || currentSrc.toLowerCase().endsWith(".pdf");

    return (
        <div
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999] p-4"
            onClick={onClose}
        >
            {/* 닫기 버튼 */}
            <button
                onClick={onClose}
                className="absolute top-4 right-4 w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white transition-colors z-10"
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

            {/* 컨텐츠: 갤러리일 때 [이전] [이미지] [다음], 아니면 이미지만 */}
            <div
                className="w-full max-w-[95vw] max-h-[90vh] flex flex-col items-center justify-center relative min-h-0"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-center gap-2 sm:gap-3 w-full min-w-0 flex-1">
                    {isGallery && onPrev && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onPrev();
                            }}
                            className="shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors"
                            aria-label="이전 이미지"
                        >
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                                <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" fill="currentColor" />
                            </svg>
                        </button>
                    )}
                    {isPdf ? (
                        <iframe
                            src={currentSrc}
                            title={currentFileName || imageAlt}
                            className="w-[85vw] h-[85vh] bg-white rounded-xl shadow-2xl max-w-[80vw] min-h-0"
                        />
                    ) : (
                        <div className="flex-1 min-w-0 min-h-0 flex items-center justify-center">
                            <img
                                key={currentSrc}
                                src={currentSrc}
                                alt={imageAlt}
                                className="max-w-full max-h-[75vh] sm:max-h-[85vh] w-auto h-auto rounded-xl shadow-2xl bg-black/20 object-contain"
                            />
                        </div>
                    )}
                    {isGallery && onNext && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onNext();
                            }}
                            className="shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors"
                            aria-label="다음 이미지"
                        >
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                                <path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z" fill="currentColor" />
                            </svg>
                        </button>
                    )}
                </div>

                {(currentFileName || (isGallery && images && images.length > 0)) && (
                    <p className="text-white text-center mt-3 text-[14px] truncate max-w-full">
                        {currentFileName && <span>{currentFileName}</span>}
                        {isGallery && images && images.length > 0 && (
                            <span className={currentFileName ? "ml-1.5 text-white/70" : "text-white/70"}>
                                ({currentIndex + 1} / {images.length})
                            </span>
                        )}
                    </p>
                )}
            </div>
        </div>
    );
}
