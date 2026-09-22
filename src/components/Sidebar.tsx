// src/components/Sidebar.tsx
import { useEffect, useState, useRef, startTransition } from "react";
import { useNavigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import NotificationPopup from "./ui/NotificationPopup";
import ActionMenu from "./common/ActionMenu";
import Button from "./common/Button";

const ResetPasswordModal = lazy(() => import("./modals/ResetPasswordModal"));
const BaseModal = lazy(() => import("./ui/BaseModal"));
import { supabase } from "../lib/supabase";
import Avatar from "./common/Avatar";
import { markAllNotificationsAsRead } from "../lib/notificationApi";
import {
    IconHome,
    IconReport,
    IconShieldCheck,
    IconWorkload,
    IconCard,
    IconVacation,
    IconMembers,
    IconCar,
    IconNotifications,
    IconCalendar,
    IconClose,
    IconSettings,
    IconBoard,
    IconInvoice,
} from "./icons/Icons";
import { useUser } from "../hooks/useUser";
import { useNotifications } from "../hooks/useNotifications";
import { useToast } from "./ui/ToastProvider";
import { useSidebarRoutes } from "../hooks/useSidebarRoutes";
import { useSidebarMenuItems } from "../hooks/useSidebarMenuItems";
import { useSidebarSubMenuState } from "../hooks/useSidebarSubMenuState";
import { useSidebarRouteSync } from "../hooks/useSidebarRouteSync";
import { PATHS } from "../utils/paths";
import MenuButton from "./sidebar/MenuButton";
import SubMenu from "./sidebar/SubMenu";
import { markSubMenuSkipEnter } from "./sidebar/subMenuEnterAnimation";
import { useMenuNotifications } from "../hooks/useMenuNotifications";

interface SidebarProps {
    onClose?: () => void;
    /** 데스크탑에서도 닫기 버튼 표시 여부 */
    showCloseOnDesktop?: boolean;
}

type MenuFocus = "SCHEDULE" | "REPORT" | "TBM" | "EXPENSE" | "INVOICE" | null;






export default function Sidebar({ onClose, showCloseOnDesktop = false }: SidebarProps) {
    const navigate = useNavigate();
    const { showSuccess, showError } = useToast();

    // 사용자 정보 및 권한
    const { currentUser, currentUserId, sidebarLoginId, userPermissions, handleLogout } =
        useUser();


    const [isAdmin, setIsAdmin] = useState<boolean>(() => {
        return localStorage.getItem("profile_role") === "admin";
    });

    const [profileName, setProfileName] = useState<string>(() => {
        return localStorage.getItem("profile_name") ?? "";
    });



    // 권한 정보를 ref로 보관해서 재렌더 이슈 방지
    const userPermissionsRef = useRef(userPermissions);
    useEffect(() => {
        // 권한 정보가 완전히 세팅되면 업데이트 (초기값 false만 방지)
        if (userPermissions.isCEO || userPermissions.isAdmin || userPermissions.isStaff) {
            userPermissionsRef.current = userPermissions;
        }
    }, [userPermissions]);

    useEffect(() => {
        const fetchRole = async () => {
            if (!currentUserId) return;

            const { data, error } = await supabase
                .from("profiles")
                .select("role, name")
                .eq("id", currentUserId)
                .single();

            if (error) {
                console.error("profiles role 조회 실패:", error);
                // 캐시가 admin이면 깜박임 방지를 위해 false로 덮지 않음
                return;
            }

            const nextIsAdmin = data?.role === "admin";
            setIsAdmin(nextIsAdmin);

            const nextProfileName = data?.name ?? "";
            setProfileName(nextProfileName);
            localStorage.setItem("profile_name", nextProfileName);

            // 새로고침/라우팅 시 즉시 반영되도록 캐시
            localStorage.setItem("profile_role", data?.role ?? "");
        };

        fetchRole();
    }, [currentUserId]);

    const stablePermissions = userPermissionsRef.current.isCEO || userPermissionsRef.current.isAdmin || userPermissionsRef.current.isStaff
        ? userPermissionsRef.current
        : userPermissions;
    const permissionsReady =
        stablePermissions.isCEO || stablePermissions.isAdmin || stablePermissions.isStaff;

    const canShowVacation =
        permissionsReady && (stablePermissions.isCEO || stablePermissions.isAdmin || isAdmin);
    const canShowVehicles =
        permissionsReady &&
        (stablePermissions.isAdmin ||
            stablePermissions.isStaff ||
            stablePermissions.isCEO ||
            isAdmin);
    const canShowInvoiceMenu =
        permissionsReady && (stablePermissions.isAdmin || isAdmin);

    const {
        showNotifications,
        setShowNotifications,
        notifications,
        unreadCount,
        notificationRef,
        refreshNotifications,
    } = useNotifications(currentUserId);

    const [menuFocus, setMenuFocus] = useState<MenuFocus>(null);
    /** 브랜치→무브랜치 이동 시, 라우트 변경 전에 목적지 선택 효과를 켜기 위한 경로 */
    const [pendingActivePath, setPendingActivePath] = useState<string | null>(null);


    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const [resetPasswordModalOpen, setResetPasswordModalOpen] = useState(false);
    const [logoutConfirmModalOpen, setLogoutConfirmModalOpen] = useState(false);
    const usernameRef = useRef<HTMLDivElement>(null);

    const menuNotis = useMenuNotifications();

    const {
        isScheduleRoute,
        isReportRoute,
        isTbmRoute,
        isExpenseRoute,
        isInvoiceRoute,
        isReportEditRoute,
        location: routeLocation,
    } = useSidebarRoutes();

    const prevScheduleRouteRef = useRef<boolean>(isScheduleRoute);
    const prevReportRouteRef = useRef<boolean>(isReportRoute);
    const prevTbmRouteRef = useRef<boolean>(isTbmRoute);
    const prevExpenseRouteRef = useRef<boolean>(isExpenseRoute);
    const prevInvoiceRouteRef = useRef<boolean>(isInvoiceRoute);

    const {
        setScheduleOpen,
        scheduleOpenRef,
        setReportOpen,
        reportOpenRef,
        setTbmOpen,
        tbmOpenRef,
        setExpenseOpen,
        expenseOpenRef,
        setInvoiceOpen,
        invoiceOpenRef,
        stableScheduleOpen,
        stableReportOpen,
        stableTbmOpen,
        stableExpenseOpen,
        stableInvoiceOpen,
    } = useSidebarSubMenuState(
        isScheduleRoute,
        isReportRoute,
        isTbmRoute,
        isExpenseRoute,
        isInvoiceRoute,
        prevScheduleRouteRef,
        prevReportRouteRef,
        prevTbmRouteRef,
        prevExpenseRouteRef,
        prevInvoiceRouteRef
    );

    // 다른 메뉴에 포커스가 있으면 현재 라우트여도 선택 효과를 주지 않음
    // pendingActivePath가 있으면(닫힘 애니 중) 목적지 탭만 선택
    const isPathActive = (match: (path: string) => boolean) => {
        if (pendingActivePath) return match(pendingActivePath);
        return !menuFocus && match(routeLocation.pathname);
    };

    const scheduleActive = menuFocus === "SCHEDULE" || (!menuFocus && !pendingActivePath && isScheduleRoute);
    const reportActive = menuFocus === "REPORT" || (!menuFocus && !pendingActivePath && isReportRoute);
    const tbmActive = menuFocus === "TBM" || (!menuFocus && !pendingActivePath && isTbmRoute);
    const invoiceActive = menuFocus === "INVOICE" || (!menuFocus && !pendingActivePath && isInvoiceRoute);
    const canShowHome = stablePermissions.isCEO || stablePermissions.isAdmin || isAdmin;
    const canShowSchedule = ["mw.park", "brian.ko"].includes(
        (sidebarLoginId || currentUser?.email?.split("@")[0] || "").toLowerCase()
    );
    const expenseActive = menuFocus === "EXPENSE" || (!menuFocus && !pendingActivePath && isExpenseRoute);
    const settingsActive = isPathActive((p) => p.startsWith("/settings"));
    const boardActive = isPathActive((p) => p.startsWith("/board"));
    const homeActive = isPathActive((p) => p === PATHS.dashboard);
    const workloadActive = isPathActive((p) => p.startsWith(PATHS.workload));
    const vehiclesActive = isPathActive((p) => p.startsWith(PATHS.vehicles));
    const vacationActive = isPathActive((p) => p.startsWith(PATHS.vacation));
    const membersActive = isPathActive((p) => p.startsWith(PATHS.members));

    const {
        scheduleSubMenuItems,
        reportSubMenuItems,
        tbmSubMenuItems,
        expenseSubMenuItems,
        invoiceSubMenuItems,
    } = useSidebarMenuItems(stablePermissions, isReportEditRoute, routeLocation);

    const [scheduleItemsForSubMenu, setScheduleItemsForSubMenu] = useState(scheduleSubMenuItems);
    const [reportItemsForSubMenu, setReportItemsForSubMenu] = useState(reportSubMenuItems);
    const [tbmItemsForSubMenu, setTbmItemsForSubMenu] = useState(tbmSubMenuItems);

    useEffect(() => {
        if (scheduleSubMenuItems.length > 0) {
            setScheduleItemsForSubMenu(scheduleSubMenuItems);
        }
    }, [scheduleSubMenuItems]);

    useEffect(() => {
        if (reportSubMenuItems.length > 0) {
            setReportItemsForSubMenu(reportSubMenuItems);
        }
    }, [reportSubMenuItems]);

    useEffect(() => {
        if (tbmSubMenuItems.length > 0) {
            setTbmItemsForSubMenu(tbmSubMenuItems);
        }
    }, [tbmSubMenuItems]);

    useSidebarRouteSync({
        pathname: routeLocation.pathname,
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
    });
    const submenuCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const SUBMENU_CLOSE_MS = 280;

    useEffect(() => {
        return () => {
            if (submenuCloseTimerRef.current) {
                clearTimeout(submenuCloseTimerRef.current);
            }
        };
    }, []);

    const openFocusOnly = (focus: MenuFocus) => {
        if (focus === "SCHEDULE") setScheduleOpen(true);
        if (focus === "REPORT") setReportOpen(true);
        if (focus === "TBM") setTbmOpen(true);
        if (focus === "INVOICE") setInvoiceOpen(true);
        if (focus === "EXPENSE" && expenseSubMenuItems.length > 1) setExpenseOpen(true);
    };

    const handleMenuClick = (focus: MenuFocus | null) => {
        if (focus) {
            // 같은 탭 브랜치 이동 시 페이지 재마운트 전 open 상태를 유지
            setMenuFocus(focus);
            openFocusOnly(focus);
        } else {
            setMenuFocus(null);
            setScheduleOpen(false);
            setReportOpen(false);
            setTbmOpen(false);
            setExpenseOpen(false);
            setInvoiceOpen(false);
        }
        setShowNotifications(false);
    };

    const closeAllExcept = (focus: MenuFocus | null) => {
        if (focus !== "SCHEDULE") setScheduleOpen(false);
        if (focus !== "REPORT") setReportOpen(false);
        if (focus !== "TBM") setTbmOpen(false);
        if (focus !== "EXPENSE") setExpenseOpen(false);
        if (focus !== "INVOICE") setInvoiceOpen(false);
    };

    const isFocusAlreadyOpen = (focus: MenuFocus) => {
        if (focus === "SCHEDULE") return !!scheduleOpenRef.current;
        if (focus === "REPORT") return !!reportOpenRef.current;
        if (focus === "TBM") return !!tbmOpenRef.current;
        if (focus === "EXPENSE") return !!expenseOpenRef.current;
        if (focus === "INVOICE") return !!invoiceOpenRef.current;
        return false;
    };

    const go = (to: string, focus: MenuFocus | null) => {
        const willNavigate = routeLocation.pathname !== to;
        const closingSomething =
            (!!scheduleOpenRef.current && focus !== "SCHEDULE") ||
            (!!reportOpenRef.current && focus !== "REPORT") ||
            (!!tbmOpenRef.current && focus !== "TBM") ||
            (!!expenseOpenRef.current && focus !== "EXPENSE") ||
            (!!invoiceOpenRef.current && focus !== "INVOICE");

        if (submenuCloseTimerRef.current) {
            clearTimeout(submenuCloseTimerRef.current);
            submenuCloseTimerRef.current = null;
        }

        const navigateNow = () => {
            submenuCloseTimerRef.current = null;
            if (willNavigate) {
                startTransition(() => {
                    navigate(to);
                });
            }
            onClose?.();
        };

        // from 브랜치 닫힘 + to 브랜치 열림을 동시에 시작 (닫힘 애니 후 이동)
        if (closingSomething && willNavigate) {
            closeAllExcept(focus);
            setShowNotifications(false);

            if (focus) {
                setPendingActivePath(null);
                openFocusOnly(focus);
                setMenuFocus(focus);
                // 재마운트 시 to 브랜치 열림 애니 재실행 방지
                markSubMenuSkipEnter(focus);
            } else {
                // 목적지 선택 효과를 닫힘 애니와 동시에 켜기
                setMenuFocus(null);
                setPendingActivePath(to);
            }

            submenuCloseTimerRef.current = setTimeout(navigateNow, SUBMENU_CLOSE_MS);
            return;
        }

        if (focus) {
            // 이미 열린 같은 탭 내 이동만 재마운트 열림 애니메이션 생략
            if (isFocusAlreadyOpen(focus)) {
                markSubMenuSkipEnter(focus);
            }
            setPendingActivePath(null);
            closeAllExcept(focus);
            openFocusOnly(focus);
            setMenuFocus(focus);
        } else {
            setMenuFocus(null);
            setPendingActivePath(null);
            closeAllExcept(null);
        }
        setShowNotifications(false);
        navigateNow();
    };


    const handleLogoutClick = async () => {
        localStorage.removeItem("profile_role");
        localStorage.removeItem("profile_name");
        await handleLogout();
        navigate("/login");
    };

    return (
        <aside className="w-[220px] md:w-[240px] max-w-[88vw] lg:max-w-none lg:w-[239px] h-full bg-gray-50 border-r border-gray-200 flex flex-col shadow-xl lg:shadow-none">
            <div className="flex flex-col gap-2 md:gap-3 px-3 md:px-4 py-3 md:py-5 flex-1 min-h-0">
                {/* Logo & Close Button */}
                <div className="flex gap-1.5 md:gap-2 items-center justify-between p-1.5 md:p-2">
                    <button
                        type="button"
                        onClick={() => {
                            setUserMenuOpen(false);
                            // RoleLanding과 동일: admin/CEO → 홈, 그 외 → 보고서
                            if (canShowHome) {
                                go(PATHS.dashboard, null);
                            } else {
                                go(PATHS.report, "REPORT");
                            }
                        }}
                        className="flex gap-2 md:gap-2.5 items-center text-left hover:opacity-80 transition-opacity"
                    >
                        <img
                            src="/images/RTBlogo.png"
                            alt="RTB 로고"
                            className="h-7 md:h-9 w-auto object-contain shrink-0"
                        />
                        <p className="font-medium text-[11px] md:text-[14px] text-gray-900 whitespace-nowrap">
                            RTB 통합 관리 시스템
                        </p>
                    </button>
                    {onClose && (
                        <button
                            onClick={onClose}
                            className={showCloseOnDesktop ? "p-1 hover:bg-gray-200 rounded-lg transition-colors text-gray-900" : "lg:hidden p-1 hover:bg-gray-200 rounded-lg transition-colors text-gray-900"}
                        >
                            <IconClose className="w-4 h-4 md:w-5 md:h-5" />
                        </button>
                    )}
                </div>

                {/* User Section */}
                <div className="flex flex-col gap-2 md:gap-3 flex-1 min-h-0">
                    <div className="flex gap-1 items-center p-1.5 md:p-2">
                        <div
                            ref={usernameRef}
                            className="flex gap-2 md:gap-3 items-center flex-1 min-w-0 cursor-pointer hover:bg-gray-200 rounded-xl transition-colors py-0.5 px-1 -ml-1"
                            onClick={() => {
                                setUserMenuOpen(!userMenuOpen);
                                setShowNotifications(false);
                            }}
                        >
                            <div className="w-6 h-6 md:w-7 md:h-7 shrink-0">
                                <Avatar email={currentUser?.email} size={24} position={currentUser?.position} />
                            </div>
                            <p className="font-semibold text-[13px] md:text-[16px] text-gray-900 truncate">
                                {sidebarLoginId || currentUser?.email?.split("@")[0] || ""}
                            </p>
                        </div>

                        {/* 알림 종 아이콘 (유저명 우측) */}
                        <div className="relative shrink-0" ref={notificationRef}>
                            <button
                                type="button"
                                aria-label="알림"
                                onMouseDown={(e) => e.stopPropagation()}
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowNotifications((v) => !v);
                                    setUserMenuOpen(false);
                                }}
                                className={`relative p-1.5 rounded-lg transition-colors text-gray-900 ${
                                    showNotifications ? "bg-gray-100" : "hover:bg-gray-200"
                                }`}
                            >
                                <IconNotifications className="w-5 h-5 md:w-6 md:h-6" />
                                {unreadCount > 0 && (
                                    <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center bg-red-500 text-white text-[9px] md:text-[10px] min-w-[16px] h-4 md:min-w-[18px] md:h-[18px] px-0.5 rounded-full font-bold leading-none">
                                        {unreadCount > 99 ? "99+" : unreadCount}
                                    </span>
                                )}
                            </button>

                            {showNotifications && (
                                <NotificationPopup
                                    onClose={() => setShowNotifications(false)}
                                    anchorEl={notificationRef.current}
                                    items={notifications.map((n) => ({
                                        id: n.id,
                                        title: n.title,
                                        message: n.message,
                                        type: n.type,
                                        created_at: n.created_at,
                                        read_at: n.read_at,
                                        meta: n.meta ?? undefined,
                                    }))}
                                    onNotificationRead={async () => {
                                        await refreshNotifications();
                                    }}
                                    onMarkAllAsRead={async () => {
                                        if (currentUserId) {
                                            try {
                                                await markAllNotificationsAsRead(currentUserId);
                                                await refreshNotifications();
                                            } catch (error) {
                                                console.error("모두 읽음 처리 실패:", error);
                                            }
                                        }
                                    }}
                                    triggerMenuToast={menuNotis.triggerToast}
                                />
                            )}
                        </div>
                    </div>

                    {/* 사용자 액션 메뉴 */}
                    <ActionMenu
                        isOpen={userMenuOpen}
                        anchorEl={usernameRef.current}
                        onClose={() => setUserMenuOpen(false)}
                        onResetPassword={() => {
                            setResetPasswordModalOpen(true);
                            setUserMenuOpen(false);
                        }}
                        onLogout={() => {
                            setUserMenuOpen(false);
                            setLogoutConfirmModalOpen(true);
                        }}
                        showLogout={true}
                        showDelete={false}
                        placement="right"
                        width="w-60"
                        userDisplayName={
                            currentUser?.email ? currentUser.email.split("@")[0] : undefined
                        }
                        userEmail={currentUser?.email}
                    />

                    {resetPasswordModalOpen && (
                        <Suspense fallback={null}>
                            <ResetPasswordModal
                                isOpen={resetPasswordModalOpen}
                                onClose={() => setResetPasswordModalOpen(false)}
                                onSubmit={async (payload) => {
                                    const { error } = await supabase.auth.updateUser({
                                        password: payload.newPassword,
                                    });

                                    if (error) {
                                        console.error("비밀번호 변경 실패:", error.message);
                                        showError("비밀번호 변경에 실패했습니다. 다시 시도해 주세요.");
                                        return false;
                                    }

                                    showSuccess("비밀번호가 변경되었습니다.");
                                    return true;
                                }}
                            />
                        </Suspense>
                    )}
                    {logoutConfirmModalOpen && (
                        <Suspense fallback={null}>
                            <BaseModal
                                isOpen={logoutConfirmModalOpen}
                                onClose={() => setLogoutConfirmModalOpen(false)}
                                title="로그아웃"
                                footer={
                                    <div className="flex gap-3 w-full">
                                        <Button
                                            variant="outline"
                                            size="lg"
                                            fullWidth
                                            onClick={() => setLogoutConfirmModalOpen(false)}
                                        >
                                            취소
                                        </Button>
                                        <Button
                                            variant="primary"
                                            size="lg"
                                            fullWidth
                                            onClick={handleLogoutClick}
                                        >
                                            로그아웃
                                        </Button>
                                    </div>
                                }
                            >
                                <p className="text-center text-lg font-medium text-gray-800">
                                    정말 로그아웃 하시겠습니까?
                                </p>
                            </BaseModal>
                        </Suspense>
                    )}

                    {canShowSchedule && (
                        <div className="-pb-1">
                            <MenuButton
                                icon={<IconCalendar className="w-5 h-5 md:w-6 md:h-6" />}
                                label="일정"
                                isActive={scheduleActive}
                                onClick={() => {
                                    setUserMenuOpen(false);
                                    go(PATHS.scheduleList, "SCHEDULE");
                                }}
                            />
                            <SubMenu
                                isOpen={stableScheduleOpen}
                                items={scheduleItemsForSubMenu}
                                focus="SCHEDULE"
                                onClose={onClose}
                                onMenuClick={handleMenuClick}
                            />
                        </div>
                    )}

                    <MenuButton
                        icon={<IconBoard className="w-5 h-5 md:w-6 md:h-6" />}
                        label="게시판"
                        isActive={boardActive}
                        onClick={() => go(PATHS.board, null)}
                    />

                    <div className="h-px bg-gray-200 rounded-full my-1 md:my-0" />

                    <nav
                        className="flex flex-col gap-1.5 md:gap-2 flex-1 overflow-y-auto min-h-0
                        [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                    >
                        {canShowHome && (
                            <MenuButton
                                icon={<IconHome className="w-5 h-5 md:w-6 md:h-6" />}
                                label="홈"
                                isActive={homeActive}
                                onClick={() => go(PATHS.dashboard, null)}
                            />
                        )}




                        <div className="-pb-1">
                            <MenuButton
                                icon={<IconReport className="w-5 h-5 md:w-6 md:h-6" />}
                                label="보고서"
                                isActive={reportActive}
                                onClick={() => {
                                    go(PATHS.reportList, "REPORT");
                                }}
                            />


                            <SubMenu
                                isOpen={stableReportOpen}
                                items={reportItemsForSubMenu}
                                focus="REPORT"
                                onClose={onClose}
                                onMenuClick={handleMenuClick}
                            />
                        </div>

                        {canShowInvoiceMenu && (
                            <div className="-pb-1">
                                <MenuButton
                                    icon={<IconInvoice className="w-5 h-5 md:w-6 md:h-6" />}
                                    label="인보이스"
                                    isActive={invoiceActive}
                                    onClick={() => {
                                        go(PATHS.invoice, "INVOICE");
                                    }}
                                />
                                <SubMenu
                                    isOpen={stableInvoiceOpen}
                                    items={invoiceSubMenuItems}
                                    focus="INVOICE"
                                    onClose={onClose}
                                    onMenuClick={handleMenuClick}
                                />
                            </div>
                        )}

                        <div className="-pb-1">
                            <MenuButton
                                icon={
                                    <span
                                        style={
                                            tbmActive
                                                ? ({ ["--tbm-check-color" as any]: "#111111" } as React.CSSProperties)
                                                : undefined
                                        }
                                    >
                                        <IconShieldCheck className="w-5 h-5 md:w-6 md:h-6" />
                                    </span>
                                }
                                label="TBM"
                                isActive={tbmActive}
                                onClick={() => {
                                    go(PATHS.tbmList, "TBM");
                                }}
                            />

                            <SubMenu
                                isOpen={stableTbmOpen}
                                items={tbmItemsForSubMenu}
                                focus="TBM"
                                onClose={onClose}
                                onMenuClick={handleMenuClick}
                            />
                        </div>

                        <MenuButton
                            icon={<IconWorkload className="w-5 h-5 md:w-6 md:h-6" />}
                            label="워크로드"
                            isActive={workloadActive}
                            onClick={() =>
                                go(
                                    stablePermissions.isStaff && profileName
                                        ? `/workload/detail/${encodeURIComponent(profileName)}`
                                        : PATHS.workload,
                                    null
                                )
                            }
                        />

                        <div className="-pb-1">

                            <MenuButton
                                icon={<IconCard className="w-5 h-5 md:w-6 md:h-6" />}
                                label="지출"
                                isActive={expenseActive}
                                onClick={() => {
                                    if (expenseSubMenuItems.length === 1) {
                                        go(expenseSubMenuItems[0].to, "EXPENSE");
                                    } else if (expenseSubMenuItems.length > 1) {
                                        go(PATHS.expensePersonal, "EXPENSE");
                                    }
                                }}
                            />
                            <SubMenu
                                isOpen={stableExpenseOpen && expenseSubMenuItems.length > 1}
                                items={expenseSubMenuItems.length > 1 ? expenseSubMenuItems : []}
                                focus="EXPENSE"
                                onClose={onClose}
                                onMenuClick={handleMenuClick}
                            />
                        </div>
                        {canShowVehicles && (
                            <MenuButton
                                icon={<IconCar className="w-5 h-5 md:w-6 md:h-6" />}
                                label="차량"
                                isActive={vehiclesActive}
                                onClick={() => {
                                    if (menuNotis.vehicles) menuNotis.triggerToast("vehicles");
                                    go(PATHS.vehicles, null);
                                }}
                                showDot={menuNotis.vehicles}
                            />
                        )}
                        {canShowVacation && (
                            <MenuButton
                                icon={<IconVacation className="w-5 h-5 md:w-6 md:h-6" />}
                                label="휴가"
                                isActive={vacationActive}
                                onClick={() => {
                                    if (menuNotis.vacation) menuNotis.triggerToast("vacation");
                                    go(PATHS.vacation, null);
                                }}
                                showDot={menuNotis.vacation}
                            />
                        )}
                        <MenuButton
                            icon={<IconMembers className="w-5 h-5 md:w-6 md:h-6" />}
                            label="구성원"
                            isActive={membersActive}
                            onClick={() => {
                                if (menuNotis.members) menuNotis.triggerToast("members");
                                go(PATHS.members, null);
                            }}
                            showDot={menuNotis.members}
                        />
                    </nav>

                    <div className="flex-none mt-auto">
                        <div className="h-px bg-gray-200 rounded-full mt-1.5 md:mt-2 mb-2 md:mb-3" />
                        <div className={isAdmin ? "" : "invisible pointer-events-none"}>
                            <MenuButton
                                icon={<IconSettings className="w-5 h-5 md:w-6 md:h-6" />}
                                label="설정"
                                isActive={settingsActive}
                                onClick={() => {
                                    go("/settings", null);
                                }}
                            />
                        </div>
                    </div>

                </div>
            </div>
        </aside>
    );
}
