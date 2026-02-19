//useSidebarRouteSync.ts
import { useEffect, useRef } from "react";
import { UserPermissions } from "./useUser";

interface UseSidebarRouteSyncParams {
    pathname: string;
    isReportRoute: boolean;
    isTbmRoute: boolean;
    isExpenseRoute: boolean;
    expenseSubMenuItems: Array<{ label: string; to: string }>;
    prevReportRouteRef: React.MutableRefObject<boolean>;
    prevTbmRouteRef: React.MutableRefObject<boolean>;
    prevExpenseRouteRef: React.MutableRefObject<boolean>;
    reportOpenRef: React.RefObject<boolean>;
    tbmOpenRef: React.RefObject<boolean>;
    expenseOpenRef: React.RefObject<boolean>;
    setReportOpen: (value: boolean) => void;
    setTbmOpen: (value: boolean) => void;
    setExpenseOpen: (value: boolean) => void;
    setMenuFocus: (focus: "REPORT" | "TBM" | "EXPENSE" | null) => void;
    setShowNotifications: (value: boolean) => void;
}


/**
 * 라우트 변경에 따른 서브메뉴 상태 동기화
 */
export function useSidebarRouteSync({
    pathname,
    isReportRoute,
    isTbmRoute,
    isExpenseRoute,
    expenseSubMenuItems,
    prevReportRouteRef,
    prevTbmRouteRef,
    prevExpenseRouteRef,
    reportOpenRef,
    tbmOpenRef,
    expenseOpenRef,
    setReportOpen,
    setTbmOpen,
    setExpenseOpen,
    setMenuFocus,
    setShowNotifications,
}: UseSidebarRouteSyncParams) {
    const prevPathRef = useRef<string>(pathname);
    useEffect(() => {
        const prevIsReportRoute = prevReportRouteRef.current;
        const prevIsTbmRoute = prevTbmRouteRef.current;
        const prevIsExpenseRoute = prevExpenseRouteRef.current;
        const currentReportOpen = reportOpenRef.current;
        const currentTbmOpen = tbmOpenRef.current;
        const currentExpenseOpen = expenseOpenRef.current;

        // 보고서 라우트 처리
        if (isReportRoute) {
            const isSameSubmenuNavigation = prevIsReportRoute && currentReportOpen;
            if (isSameSubmenuNavigation) {
                prevReportRouteRef.current = true;
            } else {
                setMenuFocus("REPORT");
                if (!currentReportOpen) {
                    setReportOpen(true);
                }
                prevReportRouteRef.current = true;
            }
        } else {
            if (currentReportOpen) {
                setReportOpen(false);
            }
            prevReportRouteRef.current = false;
        }

        // TBM 라우트 처리
        if (isTbmRoute) {
            const isSameSubmenuNavigation = prevIsTbmRoute && currentTbmOpen;
            if (isSameSubmenuNavigation) {
                prevTbmRouteRef.current = true;
            } else {
                setMenuFocus("TBM");
                if (!currentTbmOpen) {
                    setTbmOpen(true);
                }
                prevTbmRouteRef.current = true;
            }
        } else {
            if (currentTbmOpen) {
                setTbmOpen(false);
            }
            prevTbmRouteRef.current = false;
        }

        // 지출 라우트 처리
        if (isExpenseRoute) {
            if (expenseSubMenuItems.length > 1) {
                const isSameSubmenuNavigation = prevIsExpenseRoute && currentExpenseOpen;
                if (isSameSubmenuNavigation) {
                    prevExpenseRouteRef.current = true;
                } else {
                    setMenuFocus("EXPENSE");
                    if (!currentExpenseOpen) {
                        setExpenseOpen(true);
                    }
                    prevExpenseRouteRef.current = true;
                }
            } else {
                if (currentExpenseOpen) {
                    setExpenseOpen(false);
                }
                prevExpenseRouteRef.current = true;
            }
        } else {
            if (currentExpenseOpen) {
                setExpenseOpen(false);
            }
            prevExpenseRouteRef.current = false;
        }

        // ✅ "진짜 페이지 전환(경로 변경)"일 때만 알림 닫기
        if (prevPathRef.current !== pathname) {
            setShowNotifications(false);
            prevPathRef.current = pathname;
        }
    }, [
        pathname,
        isReportRoute,
        isTbmRoute,
        isExpenseRoute,
        expenseSubMenuItems.length,
        setShowNotifications,
        prevReportRouteRef,
        prevTbmRouteRef,
        prevExpenseRouteRef,
        reportOpenRef,
        tbmOpenRef,
        expenseOpenRef,
        setReportOpen,
        setTbmOpen,
        setExpenseOpen,
        setMenuFocus,
    ]);
}

