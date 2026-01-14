import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import Toast, { ToastItem, ToastType } from "./Toast";

interface ToastContextType {
    showToast: (message: string, type?: ToastType, duration?: number) => void;
    showSuccess: (message: string) => void;
    showError: (message: string) => void;
    showInfo: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error("useToast must be used within ToastProvider");
    }
    return context;
}

interface ToastProviderProps {
    children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
    const [toasts, setToasts] = useState<ToastItem[]>([]);

    const showToast = useCallback(
        (message: string, type: ToastType = "info", duration = 3000) => {
            const id = `toast-${Date.now()}-${Math.random()}`;
            const newToast: ToastItem = { id, message, type, duration };
            setToasts((prev) => [...prev, newToast]);
        },
        []
    );

    const showSuccess = useCallback(
        (message: string) => showToast(message, "success"),
        [showToast]
    );

    const showError = useCallback(
        (message: string) => showToast(message, "error", 4000),
        [showToast]
    );

    const showInfo = useCallback(
        (message: string) => showToast(message, "info"),
        [showToast]
    );

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
                    onClose={() => removeToast(toast.id)}
                    offset={index * 80}
                />
            ))}
        </ToastContext.Provider>
    );
}

