//ToastProvider.tsx
import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import Toast, { ToastItem, ToastType } from "./Toast";
import useIsMobile from "../../hooks/useIsMobile";

type ToastInput =
  | string
  | {
    message: string;
    duration?: number;
    imageUrl?: string;
    imageAlt?: string;

    // ✅ 선택: 아이콘 숨김(슬로건 이미지 토스트용)
    hideIcon?: boolean;
  };

interface ToastContextType {
  showToast: (input: ToastInput, type?: ToastType, duration?: number) => void;
  showSuccess: (input: ToastInput) => void;
  showError: (input: ToastInput) => void;
  showInfo: (input: ToastInput) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

let useToastOutsideWarned = false;

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    if (import.meta.env?.DEV && !useToastOutsideWarned) {
      useToastOutsideWarned = true;
      console.warn("useToast used outside ToastProvider; falling back to no-op. Ensure ToastProvider wraps your app (e.g. in App.tsx).");
    }
    const noop = () => { };
    return {
      showToast: noop,
      showSuccess: noop,
      showError: noop,
      showInfo: noop,
    };
  }
  return context;
}

interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const isMobile = useIsMobile();

  const showToast = useCallback(
    (input: ToastInput, type: ToastType = "info", defaultDuration = 3000) => {
      const id = `toast-${Date.now()}-${Math.random()}`;

      const normalized =
        typeof input === "string"
          ? { message: input, duration: defaultDuration }
          : {
            message: input.message,
            duration: input.duration ?? defaultDuration,
            imageUrl: input.imageUrl,
            imageAlt: input.imageAlt,
            hideIcon: input.hideIcon,
          };

      const newToast: ToastItem = {
        id,
        message: normalized.message,
        type,
        duration: normalized.duration,
        imageUrl: (normalized as any).imageUrl,
        imageAlt: (normalized as any).imageAlt,
        hideIcon: (normalized as any).hideIcon,
      };

      setToasts((prev) => [...prev, newToast]);
    },
    []
  );

  const showSuccess = useCallback((input: ToastInput) => showToast(input, "success"), [showToast]);
  const showError = useCallback((input: ToastInput) => showToast(input, "error", 4000), [showToast]);
  const showInfo = useCallback((input: ToastInput) => showToast(input, "info", 5000), [showToast]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, showSuccess, showError, showInfo }}>
      {children}

      {/* 여러 토스트를 세로로 배치 (위에서 아래로) */}
      {toasts.map((toast, index) => (
        <Toast
          key={toast.id}
          toast={toast}
          onClose={removeToast}
          offset={toasts.slice(0, index).reduce((acc, t) => {
            // 모바일에서는 더 작은 간격, 데스크톱에서는 기존 간격 유지
            const estimatedHeight = isMobile 
              ? (t.imageUrl ? 120 : 60)
              : (t.imageUrl ? 200 : 80);
            const gap = isMobile ? 8 : 12;
            return acc + estimatedHeight + gap;
          }, 0)}
        />
      ))}
    </ToastContext.Provider>
  );
}
