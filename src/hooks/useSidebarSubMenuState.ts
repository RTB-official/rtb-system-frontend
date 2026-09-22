import { useRef, useMemo } from "react";
import { useSubMenuState } from "./useSubMenuState";

/**
 * 같은 섹션 내 이동 시 깜빡임만 막고, 닫힘/다시 열림은 즉시 반영
 */
function useStableSubMenuOpen(
    isOpen: boolean,
    isRoute: boolean,
    openRef: React.RefObject<boolean>,
    prevRouteRef: React.RefObject<boolean>
) {
    const stableOpenRef = useRef(isOpen);

    return useMemo(() => {
        if (!isOpen) {
            stableOpenRef.current = false;
            return false;
        }

        // 이미 열린 채로 같은 섹션 이동 → 열린 상태 유지
        if (stableOpenRef.current && prevRouteRef.current && isRoute && openRef.current) {
            return true;
        }

        stableOpenRef.current = true;
        return true;
    }, [isOpen, isRoute, openRef, prevRouteRef]);
}

/**
 * 사이드바 서브메뉴 상태 관리
 */
export function useSidebarSubMenuState(
    isScheduleRoute: boolean,
    isReportRoute: boolean,
    isTbmRoute: boolean,
    isExpenseRoute: boolean,
    isInvoiceRoute: boolean,
    prevScheduleRouteRef: React.RefObject<boolean>,
    prevReportRouteRef: React.RefObject<boolean>,
    prevTbmRouteRef: React.RefObject<boolean>,
    prevExpenseRouteRef: React.RefObject<boolean>,
    prevInvoiceRouteRef: React.RefObject<boolean>
) {
    const [scheduleOpen, setScheduleOpen, scheduleOpenRef] = useSubMenuState(
        "sidebarScheduleOpen",
        false
    );
    const [reportOpen, setReportOpen, reportOpenRef] = useSubMenuState("sidebarReportOpen", false);
    const [tbmOpen, setTbmOpen, tbmOpenRef] = useSubMenuState("sidebarTbmOpen", false);
    const [expenseOpen, setExpenseOpen, expenseOpenRef] = useSubMenuState("sidebarExpenseOpen", false);
    const [invoiceOpen, setInvoiceOpen, invoiceOpenRef] = useSubMenuState("sidebarInvoiceOpen", false);

    const stableScheduleOpen = useStableSubMenuOpen(
        scheduleOpen,
        isScheduleRoute,
        scheduleOpenRef,
        prevScheduleRouteRef
    );
    const stableReportOpen = useStableSubMenuOpen(
        reportOpen,
        isReportRoute,
        reportOpenRef,
        prevReportRouteRef
    );
    const stableTbmOpen = useStableSubMenuOpen(tbmOpen, isTbmRoute, tbmOpenRef, prevTbmRouteRef);
    const stableExpenseOpen = useStableSubMenuOpen(
        expenseOpen,
        isExpenseRoute,
        expenseOpenRef,
        prevExpenseRouteRef
    );
    const stableInvoiceOpen = useStableSubMenuOpen(
        invoiceOpen,
        isInvoiceRoute,
        invoiceOpenRef,
        prevInvoiceRouteRef
    );

    return {
        scheduleOpen,
        setScheduleOpen,
        scheduleOpenRef,
        reportOpen,
        setReportOpen,
        reportOpenRef,
        tbmOpen,
        setTbmOpen,
        tbmOpenRef,
        expenseOpen,
        setExpenseOpen,
        expenseOpenRef,
        invoiceOpen,
        setInvoiceOpen,
        invoiceOpenRef,
        stableScheduleOpen,
        stableReportOpen,
        stableTbmOpen,
        stableExpenseOpen,
        stableInvoiceOpen,
    };
}
