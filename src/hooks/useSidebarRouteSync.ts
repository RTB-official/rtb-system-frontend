//useSidebarRouteSync.ts
import { useEffect, useRef } from "react";

interface UseSidebarRouteSyncParams {
    pathname: string;
    isScheduleRoute: boolean;
    isReportRoute: boolean;
    isTbmRoute: boolean;
    isExpenseRoute: boolean;
    isInvoiceRoute: boolean;
    expenseSubMenuItems: Array<{ label: string; to: string }>;
    prevScheduleRouteRef: React.MutableRefObject<boolean>;
    prevReportRouteRef: React.MutableRefObject<boolean>;
    prevTbmRouteRef: React.MutableRefObject<boolean>;
    prevExpenseRouteRef: React.MutableRefObject<boolean>;
    prevInvoiceRouteRef: React.MutableRefObject<boolean>;
    scheduleOpenRef: React.RefObject<boolean>;
    reportOpenRef: React.RefObject<boolean>;
    tbmOpenRef: React.RefObject<boolean>;
    expenseOpenRef: React.RefObject<boolean>;
    invoiceOpenRef: React.RefObject<boolean>;
    setScheduleOpen: (value: boolean) => void;
    setReportOpen: (value: boolean) => void;
    setTbmOpen: (value: boolean) => void;
    setExpenseOpen: (value: boolean) => void;
    setInvoiceOpen: (value: boolean) => void;
    setMenuFocus: (
        focus: "SCHEDULE" | "REPORT" | "TBM" | "EXPENSE" | "INVOICE" | null
    ) => void;
    setShowNotifications: (value: boolean) => void;
}


/**
 * 라우트 변경에 따른 서브메뉴 상태 동기화
 */
export function useSidebarRouteSync({
    pathname,
    isScheduleRoute,
    isReportRoute,
    isTbmRoute,
    isExpenseRoute,
    isInvoiceRoute,
    expenseSubMenuItems,
    prevScheduleRouteRef,
    prevReportRouteRef,
    prevTbmRouteRef,
    prevExpenseRouteRef,
    prevInvoiceRouteRef,
    scheduleOpenRef,
    reportOpenRef,
    tbmOpenRef,
    expenseOpenRef,
    invoiceOpenRef,
    setScheduleOpen,
    setReportOpen,
    setTbmOpen,
    setExpenseOpen,
    setInvoiceOpen,
    setMenuFocus,
    setShowNotifications,
}: UseSidebarRouteSyncParams) {
    const prevPathRef = useRef<string>(pathname);
    useEffect(() => {
        const prevIsScheduleRoute = prevScheduleRouteRef.current;
        const prevIsReportRoute = prevReportRouteRef.current;
        const prevIsTbmRoute = prevTbmRouteRef.current;
        const prevIsExpenseRoute = prevExpenseRouteRef.current;
        const prevIsInvoiceRoute = prevInvoiceRouteRef.current;
        const currentScheduleOpen = scheduleOpenRef.current;
        const currentReportOpen = reportOpenRef.current;
        const currentTbmOpen = tbmOpenRef.current;
        const currentExpenseOpen = expenseOpenRef.current;
        const currentInvoiceOpen = invoiceOpenRef.current;

        // 일정 라우트 처리
        if (isScheduleRoute) {
            const isSameSubmenuNavigation = prevIsScheduleRoute && currentScheduleOpen;
            if (isSameSubmenuNavigation) {
                prevScheduleRouteRef.current = true;
            } else {
                setMenuFocus("SCHEDULE");
                if (!currentScheduleOpen) {
                    setScheduleOpen(true);
                }
                prevScheduleRouteRef.current = true;
            }
        } else {
            // 일정 라우트를 벗어나면 다른 브랜치 메뉴와 동일하게 닫음
            if (currentScheduleOpen) {
                setScheduleOpen(false);
            }
            prevScheduleRouteRef.current = false;
        }

        // 보고서 라우트 처리
        if (isReportRoute) {
            const isSameSubmenuNavigation = prevIsReportRoute && currentReportOpen;
            if (isSameSubmenuNavigation) {
                prevReportRouteRef.current = true;
            } else if (currentScheduleOpen) {
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
            } else if (currentScheduleOpen) {
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
                } else if (currentScheduleOpen) {
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

        if (isInvoiceRoute) {
            const isSameSubmenuNavigation = prevIsInvoiceRoute && currentInvoiceOpen;
            if (isSameSubmenuNavigation) {
                prevInvoiceRouteRef.current = true;
            } else if (currentScheduleOpen) {
                prevInvoiceRouteRef.current = true;
            } else {
                setMenuFocus("INVOICE");
                if (!currentInvoiceOpen) {
                    setInvoiceOpen(true);
                }
                prevInvoiceRouteRef.current = true;
            }
        } else {
            if (currentInvoiceOpen) {
                setInvoiceOpen(false);
            }
            prevInvoiceRouteRef.current = false;
        }

        // ✅ "진짜 페이지 전환(경로 변경)"일 때만 알림 닫기
        if (prevPathRef.current !== pathname) {
            setShowNotifications(false);
            prevPathRef.current = pathname;
        }
    }, [
        pathname,
        isScheduleRoute,
        isReportRoute,
        isTbmRoute,
        isExpenseRoute,
        isInvoiceRoute,
        expenseSubMenuItems.length,
        setShowNotifications,
        prevScheduleRouteRef,
        prevReportRouteRef,
        prevTbmRouteRef,
        prevExpenseRouteRef,
        prevInvoiceRouteRef,
        scheduleOpenRef,
        reportOpenRef,
        tbmOpenRef,
        expenseOpenRef,
        invoiceOpenRef,
        setScheduleOpen,
        setReportOpen,
        setTbmOpen,
        setExpenseOpen,
        setInvoiceOpen,
        setMenuFocus,
    ]);
}
