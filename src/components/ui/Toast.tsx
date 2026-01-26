//Toast.tsx
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { IconCheckmark, IconError, IconInfo } from "../icons/Icons";

export type ToastType = "success" | "error" | "info";

export interface ToastItem {
  id: string;
  message: string;
  type?: ToastType;
  duration?: number;

  imageUrl?: string;
  imageAlt?: string;

  // ✅ 아이콘 숨김(슬로건 이미지 전용)
  hideIcon?: boolean;
}

interface ToastProps {
  toast: ToastItem;
  onClose: () => void;
  offset?: number;
}

function Toast({ toast, onClose, offset = 0 }: ToastProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    // 애니메이션을 위한 약간의 지연
    const timer = setTimeout(() => setIsVisible(true), 10);

    // 자동 닫기 및 진행 바
    const duration = toast.duration || 3000;
    const startTime = Date.now();

    const progressInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
    }, 16);

    const autoCloseTimer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 200);
    }, duration);

    return () => {
      clearTimeout(timer);
      clearTimeout(autoCloseTimer);
      clearInterval(progressInterval);
    };
  }, [toast.duration, onClose]);

  const iconBgColors = {
    success: "bg-green-500",
    error: "bg-red-500",
    info: "bg-blue-500",
  };

  return createPortal(
    <div
      className={`fixed right-9 z-[10001] transition-all duration-300 ease-out ${
        isVisible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-full"
      }`}
      style={{ top: `${100 + offset}px` }}
    >
      <div className="bg-gray-800/90 rounded-lg shadow-2xl min-w-[260px] max-w-[520px] px-5 py-4 flex items-start gap-3 relative overflow-hidden">
        {/* 진행 바 (배경) */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-700/50">
          <div
            className={`h-full transition-all duration-75 ease-linear ${
              toast.type === "success"
                ? "bg-green-500"
                : toast.type === "error"
                ? "bg-red-500"
                : "bg-blue-500"
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* 아이콘 (옵션: 슬로건 토스트에서는 숨김) */}
        {!toast.hideIcon && (
          <div
            className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
              iconBgColors[toast.type || "info"]
            }`}
          >
            {toast.type === "success" && <IconCheckmark className="w-4 h-4 text-white" />}
            {toast.type === "error" && <IconError className="w-4 h-4 text-white" />}
            {(!toast.type || toast.type === "info") && <IconInfo className="w-4 h-4 text-white" />}
          </div>
        )}

        {/* 메시지 + (선택) 이미지 */}
        <div className="flex-1 min-w-0">
          {toast.message?.trim() ? (
            <p className="text-[15px] font-regular text-white whitespace-pre-wrap">
              {toast.message}
            </p>
          ) : null}

          {toast.imageUrl && (
            <div className={toast.message?.trim() ? "mt-2" : ""}>
              <div className="border border-white/10 rounded-lg overflow-hidden bg-black/20">
                <img
                  src={toast.imageUrl}
                  alt={toast.imageAlt ?? "toast image"}
                  className="w-full max-h-[160px] object-contain"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

export default Toast;
