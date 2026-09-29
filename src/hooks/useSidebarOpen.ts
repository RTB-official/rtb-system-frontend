import { useCallback, useSyncExternalStore } from "react";

let sidebarOpen = false;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

function getSnapshot() {
    return sidebarOpen;
}

function setSidebarOpenState(next: boolean) {
    if (sidebarOpen === next) return;
    sidebarOpen = next;
    listeners.forEach((listener) => listener());
}

/** 페이지를 바꿔도 유지되는 모바일 사이드바 열림 상태 */
export function useSidebarOpen(): [boolean, (open: boolean) => void] {
    const open = useSyncExternalStore(subscribe, getSnapshot, () => false);
    const setOpen = useCallback((next: boolean) => {
        setSidebarOpenState(next);
    }, []);
    return [open, setOpen];
}
