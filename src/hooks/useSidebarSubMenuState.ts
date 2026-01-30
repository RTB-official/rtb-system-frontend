import { useRef, useMemo } from "react";
import { useSubMenuState } from "./useSubMenuState";

/**
 * 사이드바 서브메뉴 상태 관리 (같은 서브메뉴 내 이동 시 변경 방지)
 */
export function useSidebarSubMenuState(
    isReportRoute: boolean,
    isTbmRoute: boolean,
    isExpenseRoute: boolean,
    prevReportRouteRef: React.RefObject<boolean>,
    prevTbmRouteRef: React.RefObject<boolean>,
    prevExpenseRouteRef: React.RefObject<boolean>
) {
    const [reportOpen, setReportOpen, reportOpenRef] = useSubMenuState("sidebarReportOpen", false);
    const [tbmOpen, setTbmOpen, tbmOpenRef] = useSubMenuState("sidebarTbmOpen", false);
    const [expenseOpen, setExpenseOpen, expenseOpenRef] = useSubMenuState("sidebarExpenseOpen", false);

    // SubMenu에 전달할 안정화된 isOpen 값 (같은 서브메뉴 내 이동 시 변경 방지)
    const stableReportOpenRef = useRef<boolean>(reportOpen);
    const stableTbmOpenRef = useRef<boolean>(tbmOpen);
    const stableExpenseOpenRef = useRef<boolean>(expenseOpen);

    const stableReportOpen = useMemo(() => {
        const isSameSubmenuNavigation = prevReportRouteRef.current && isReportRoute && reportOpenRef.current;
        if (isSameSubmenuNavigation) {
            return stableReportOpenRef.current;
        }
        stableReportOpenRef.current = reportOpen;
        return reportOpen;
    }, [reportOpen, isReportRoute, prevReportRouteRef, reportOpenRef]);

    const stableExpenseOpen = useMemo(() => {
        const isSameSubmenuNavigation = prevExpenseRouteRef.current && isExpenseRoute && expenseOpenRef.current;
        if (isSameSubmenuNavigation) {
            return stableExpenseOpenRef.current;
        }
        stableExpenseOpenRef.current = expenseOpen;
        return expenseOpen;
    }, [expenseOpen, isExpenseRoute, prevExpenseRouteRef, expenseOpenRef]);

    const stableTbmOpen = useMemo(() => {
        const isSameSubmenuNavigation = prevTbmRouteRef.current && isTbmRoute && tbmOpenRef.current;
        if (isSameSubmenuNavigation) {
            return stableTbmOpenRef.current;
        }
        stableTbmOpenRef.current = tbmOpen;
        return tbmOpen;
    }, [tbmOpen, isTbmRoute, prevTbmRouteRef, tbmOpenRef]);

    return {
        reportOpen,
        setReportOpen,
        reportOpenRef,
        tbmOpen,
        setTbmOpen,
        tbmOpenRef,
        expenseOpen,
        setExpenseOpen,
        expenseOpenRef,
        stableReportOpen,
        stableTbmOpen,
        stableExpenseOpen,
    };
}

