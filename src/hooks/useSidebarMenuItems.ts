import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { PATHS } from "../utils/paths";
import { UserPermissions } from "./useUser";

interface MenuItem {
    label: string;
    to: string;
}

/**
 * 사이드바 메뉴 아이템 생성 로직
 */
export function useSidebarMenuItems(
    stablePermissions: UserPermissions,
    isReportEditRoute: boolean,
    location: ReturnType<typeof useLocation>
) {
    const reportSubMenuItems = useMemo<MenuItem[]>(
        () => [
            { label: "보고서 목록", to: PATHS.reportList },
            {
                label: isReportEditRoute ? "보고서 작성(수정)" : "보고서 작성",
                to: isReportEditRoute ? `${location.pathname}${location.search}` : PATHS.reportCreate,
            },
        ],
        [isReportEditRoute, location.pathname, location.search]
    );

    const tbmSubMenuItems = useMemo<MenuItem[]>(
        () => [
            { label: "TBM 목록", to: PATHS.tbmList },
            { label: "TBM 작성", to: PATHS.tbmCreate },
        ],
        []
    );

    // 권한별 지출관리 서브메뉴 (role 기준: admin/staff, CEO는 admin과 동일)
    const expenseSubMenuItems = useMemo<MenuItem[]>(() => {
        if (stablePermissions.isCEO || stablePermissions.isAdmin) {
            return [
                { label: "개인 지출 기록", to: PATHS.expensePersonal },
                { label: "구성원 지출 관리", to: PATHS.expenseTeam },
            ];
        }
        if (stablePermissions.isStaff) {
            return [{ label: "개인 지출 기록", to: PATHS.expensePersonal }];
        }
        return [];
    }, [stablePermissions.isCEO, stablePermissions.isAdmin, stablePermissions.isStaff]);

    return {
        reportSubMenuItems,
        tbmSubMenuItems,
        expenseSubMenuItems,
    };
}
