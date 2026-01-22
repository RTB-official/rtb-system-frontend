import { useLocation, matchPath } from "react-router-dom";
import { PATHS } from "../utils/paths";

/**
 * 사이드바 라우트 감지 및 매칭 로직
 */
export function useSidebarRoutes() {
    const location = useLocation();

    // 경로 매칭 함수
    const isMatch = (pattern: string) =>
        !!matchPath({ path: pattern, end: false }, location.pathname);

    // 보고서 수정 진입 감지
    const searchParams = new URLSearchParams(location.search);
    const isReportEditByQuery = isMatch(PATHS.reportCreate) && !!searchParams.get("id");
    const isReportEditByPath =
        !!matchPath({ path: "/report/edit/:id", end: false }, location.pathname) ||
        !!matchPath({ path: "/report/:id/edit", end: false }, location.pathname);
    const isReportEditRoute = isReportEditByQuery || isReportEditByPath;

    const isReportRoute =
        isMatch(PATHS.reportList) || isMatch(PATHS.reportCreate) || isReportEditRoute;
    const isExpenseRoute = isMatch(PATHS.expenseTeam) || isMatch(PATHS.expensePersonal);

    return {
        isReportRoute,
        isExpenseRoute,
        isReportEditRoute,
        location,
    };
}

