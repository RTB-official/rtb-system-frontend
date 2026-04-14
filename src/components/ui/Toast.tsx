//Toast.tsx
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconCheckmark, IconError, IconInfo } from "../icons/Icons";
import useIsMobile from "../../hooks/useIsMobile";

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
  onClose: (id: string) => void;
  offset?: number;
}

const iconBgColors = {
  success: "bg-green-500",
  error: "bg-red-500",
  info: "bg-blue-500",
} as const;

function Toast({ toast, onClose, offset = 0 }: ToastProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [progress, setProgress] = useState(100);
  const [countdown, setCountdown] = useState<number | null>(null);
  const isMobile = useIsMobile();

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const enterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dismissedRef = useRef(false);

  const dismissNow = useCallback(() => {
    if (dismissedRef.current) {
      return;
    }
    dismissedRef.current = true;
    if (enterTimerRef.current != null) {
      clearTimeout(enterTimerRef.current);
      enterTimerRef.current = null;
    }
    if (progressIntervalRef.current != null) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    if (autoCloseTimerRef.current != null) {
      clearTimeout(autoCloseTimerRef.current);
      autoCloseTimerRef.current = null;
    }
    setIsVisible(false);
    window.setTimeout(() => onCloseRef.current(toast.id), 200);
  }, [toast.id]);

  const dismissNowRef = useRef(dismissNow);
  dismissNowRef.current = dismissNow;

  useEffect(() => {
    dismissedRef.current = false;
    const timer = setTimeout(() => setIsVisible(true), 10);
    enterTimerRef.current = timer;

    const duration = toast.duration || 3000;
    const startTime = Date.now();

    const progressInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);

      // 종료 카운트다운 계산 (초 단위)
      const remainingSeconds = Math.ceil((duration - elapsed) / 1000);
      setCountdown(remainingSeconds > 0 ? remainingSeconds : null);
    }, 100);
    progressIntervalRef.current = progressInterval;

    const autoCloseTimer = setTimeout(() => {
      dismissNowRef.current();
    }, duration);
    autoCloseTimerRef.current = autoCloseTimer;

    return () => {
      clearTimeout(timer);
      enterTimerRef.current = null;
      clearTimeout(autoCloseTimer);
      autoCloseTimerRef.current = null;
      clearInterval(progressInterval);
      progressIntervalRef.current = null;
    };
  }, [toast.id, toast.duration]);

  const progressBarColor =
    toast.type === "success" ? "bg-green-500" : toast.type === "error" ? "bg-red-500" : "bg-blue-500";

  // 모바일: 우측 상단 고정, 종료 카운트 표시
  if (isMobile) {
    return createPortal(
      <div
        data-app-toast="true"
        onMouseDown={(e) => e.stopPropagation()}
        className={`fixed right-4 z-[10001] transition-all duration-300 ease-out ${isVisible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-full"
          }`}
        style={{ top: `${Math.max(20, 20 + offset)}px`, maxWidth: 'calc(100vw - 32px)' }}
      >
        <div
          className="bg-gray-800/90 rounded-lg shadow-2xl w-fit max-w-[calc(100vw-32px)] px-4 py-3 flex items-center gap-3 relative overflow-hidden cursor-pointer"
          onClick={dismissNow}
        >
          {/* 진행 바 */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-700/50">
            <div
              className={`h-full transition-all duration-75 ease-linear ${progressBarColor}`}
              style={{ width: `${progress}%` }}
            />
          </div>

          {!toast.hideIcon && (
            <div
              className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${iconBgColors[toast.type || "info"]
                }`}
            >
              {toast.type === "success" && <IconCheckmark className="w-4 h-4 text-white block" />}
              {toast.type === "error" && <IconError className="w-4 h-4 text-white block" />}
              {(!toast.type || toast.type === "info") && <IconInfo className="w-4 h-4 text-white block" />}
            </div>
          )}

          <div className="min-w-0 flex-1">
            {toast.message?.trim() ? (
              <p className="text-[13px] font-regular text-white whitespace-pre-wrap line-clamp-2 leading-snug">
                {toast.message}
              </p>
            ) : null}
            {toast.imageUrl && (
              <div className={toast.message?.trim() ? "mt-1.5" : ""}>
                <div className="border border-white/10 rounded-lg overflow-hidden bg-black/20">
                  <img
                    src={toast.imageUrl}
                    alt={toast.imageAlt ?? "toast image"}
                    className="max-h-20 w-full object-contain"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 종료 카운트 표시 */}
          {countdown !== null && countdown > 0 && (
            <div className="shrink-0 text-white/70 text-[11px] font-medium">
              {countdown}초
            </div>
          )}
        </div>
      </div>,
      document.body
    );
  }

  // 데스크톱: 기존 우측 하강 스타일
  return createPortal(
    <div
      data-app-toast="true"
      onMouseDown={(e) => e.stopPropagation()}
      className={`fixed right-9 z-[10001] transition-all duration-300 ease-out ${isVisible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-full"
        }`}
      style={{ top: `${100 + offset}px` }}
    >
      <div
        className="bg-gray-800/90 rounded-lg shadow-2xl min-w-[260px] max-w-[520px] px-5 py-4 flex items-start gap-3 relative overflow-hidden cursor-pointer"
        onClick={dismissNow}
      >
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-700/50">
          <div
            className={`h-full transition-all duration-75 ease-linear ${progressBarColor}`}
            style={{ width: `${progress}%` }}
          />
        </div>

        {!toast.hideIcon && (
          <div
            className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${iconBgColors[toast.type || "info"]
              }`}
          >
            {toast.type === "success" && <IconCheckmark className="w-4 h-4 text-white" />}
            {toast.type === "error" && <IconError className="w-4 h-4 text-white" />}
            {(!toast.type || toast.type === "info") && <IconInfo className="w-4 h-4 text-white" />}
          </div>
        )}

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
