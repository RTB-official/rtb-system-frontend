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
    IconWorkload,
    IconCard,
    IconVacation,
    IconMembers,
    IconCar,
    IconNotifications,
    IconClose,
    IconSettings,
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

interface SidebarProps {
    onClose?: () => void;
}

type MenuFocus = "REPORT" | "EXPENSE" | null;






export default function Sidebar({ onClose }: SidebarProps) {
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

    const {
        showNotifications,
        setShowNotifications,
        notifications,
        unreadCount,
        notificationRef,
        refreshNotifications,
    } = useNotifications(currentUserId);

    const [menuFocus, setMenuFocus] = useState<MenuFocus>(null);


    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const [resetPasswordModalOpen, setResetPasswordModalOpen] = useState(false);
    const [logoutConfirmModalOpen, setLogoutConfirmModalOpen] = useState(false);
    const usernameRef = useRef<HTMLDivElement>(null);

    const { isReportRoute, isExpenseRoute, isReportEditRoute, location: routeLocation } = useSidebarRoutes();

    const prevReportRouteRef = useRef<boolean>(isReportRoute);
    const prevExpenseRouteRef = useRef<boolean>(isExpenseRoute);

    const {
        setReportOpen,
        reportOpenRef,
        setExpenseOpen,
        expenseOpenRef,
        stableReportOpen,
        stableExpenseOpen,
    } = useSidebarSubMenuState(isReportRoute, isExpenseRoute, prevReportRouteRef, prevExpenseRouteRef);

    const reportActive = isReportRoute || menuFocus === "REPORT";
    const canShowHome = stablePermissions.isCEO || stablePermissions.isAdmin || isAdmin;
    const expenseActive = isExpenseRoute || menuFocus === "EXPENSE";
    const settingsActive = routeLocation.pathname.startsWith("/settings");

    const { reportSubMenuItems, expenseSubMenuItems } = useSidebarMenuItems(
        stablePermissions,
        isReportEditRoute,
        routeLocation
    );

    const [reportItemsForSubMenu, setReportItemsForSubMenu] = useState(reportSubMenuItems);

    useEffect(() => {
        if (reportSubMenuItems.length > 0) {
            setReportItemsForSubMenu(reportSubMenuItems);
        }
    }, [reportSubMenuItems]);

    useSidebarRouteSync({
        pathname: routeLocation.pathname,
        isReportRoute,
        isExpenseRoute,
        expenseSubMenuItems,
        prevReportRouteRef,
        prevExpenseRouteRef,
        reportOpenRef,
        expenseOpenRef,
        setReportOpen,
        setExpenseOpen,
        setMenuFocus,
        setShowNotifications,
    });
    const handleMenuClick = (focus: MenuFocus | null) => {
        if (focus) {
            setMenuFocus(focus);
        } else {
            setMenuFocus(null);
            setReportOpen(false);
            setExpenseOpen(false);
        }
        setShowNotifications(false);
    };

    const go = (to: string, focus: MenuFocus | null) => {
        handleMenuClick(focus);
        if (routeLocation.pathname !== to) {
            startTransition(() => {
                navigate(to);
            });
        }
        onClose?.();
    };


    const shouldForceInactive = (_kind: "HOME" | "WORKLOAD" | "VACATION" | "MEMBERS" | "VEHICLES") => {
        if (!menuFocus) return false;
        return true;
    };
    const handleLogoutClick = async () => {
        localStorage.removeItem("profile_role");
        localStorage.removeItem("profile_name");
        await handleLogout();
        navigate("/login");
    };

    return (
        <aside className="w-[239px] h-full bg-gray-50 border-r border-gray-200 flex flex-col">
            <div className="flex flex-col gap-6 px-4 py-5 flex-1">
                {/* Logo & Close Button */}
                <div className="flex gap-2 items-center justify-between p-2">
                    <button
                        type="button"
                        onClick={() => navigate("/")}
                        className="flex gap-2.5 items-center text-left hover:opacity-80 transition-opacity"
                    >
                        <img
                            src="/images/RTBlogo.png"
                            alt="RTB 로고"
                            className="h-9 w-auto object-contain shrink-0"
                        />
                        <p className="font-medium text-[14px] text-gray-900 whitespace-nowrap">
                            RTB 통합 관리 시스템
                        </p>
                    </button>
                    <button
                        onClick={onClose}
                        className="lg:hidden p-1 hover:bg-gray-200 rounded-lg transition-colors text-gray-900"
                    >
                        <IconClose />
                    </button>
                </div>

                {/* User Section */}
                <div className="flex flex-col gap-3 flex-1">
                    <div
                        ref={usernameRef}
                        className="flex gap-3 items-center p-2 cursor-pointer hover:bg-gray-200 rounded-xl transition-colors"
                        onClick={() => {
                            setUserMenuOpen(!userMenuOpen);
                            setShowNotifications(false);
                        }}
                    >
                        <Avatar email={currentUser?.email} size={28} position={currentUser?.position} />
                        <p className="font-semibold text-[16px] text-gray-900">
                            {sidebarLoginId || currentUser?.email?.split("@")[0] || ""}
                        </p>
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

                    {/* Notifications */}
                    <div className="relative" ref={notificationRef}>
                        <button
                            onMouseDown={(e) => e.stopPropagation()}
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowNotifications((v) => !v);
                                setUserMenuOpen(false);
                            }}

                            className={`flex gap-6 items-center p-3 rounded-xl transition-colors w-full text-left ${showNotifications ? "bg-gray-100" : "text-gray-900 hover:bg-gray-200"
                                }`}
                        >

                            <div className="flex gap-3 items-center w-[162px]">
                                <IconNotifications />
                                <p className="font-medium text-[16px]">알림</p>
                            </div>
                            {unreadCount > 0 && (
                                <div className="ml-auto">
                                    <span className="inline-flex items-center justify-center bg-red-500 text-white text-[12px] w-6 h-6 rounded-full font-bold">
                                        {unreadCount > 99 ? "99+" : unreadCount}
                                    </span>
                                </div>
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
                            />
                        )}
                    </div>

                    <div className="h-px bg-gray-200 rounded-full" />

                    <nav
                        className="flex flex-col gap-2 flex-1 overflow-y-auto
                        [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                    >
                        {canShowHome && (
                            <MenuButton
                                icon={<IconHome />}
                                label="홈"
                                isActive={routeLocation.pathname === PATHS.dashboard && !menuFocus}
                                onClick={() => go(PATHS.dashboard, null)}
                            />
                        )}




                        <div className="-pb-1">
                            <MenuButton
                                icon={<IconReport />}
                                label="출장 보고서"
                                isActive={reportActive}
                                onClick={() => {
                                    setExpenseOpen(false);
                                    if (!reportOpenRef.current) {
                                        setReportOpen(true);
                                    }
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

                        <MenuButton
                            icon={<IconWorkload />}
                            label="워크로드"
                            isActive={routeLocation.pathname.startsWith(PATHS.workload) && !menuFocus}
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
                                icon={<IconCard />}
                                label="지출 관리"
                                isActive={expenseActive}
                                onClick={() => {
                                    setReportOpen(false);

                                    if (expenseSubMenuItems.length === 1) {
                                        setExpenseOpen(false);
                                        go(expenseSubMenuItems[0].to, "EXPENSE");
                                    } else if (expenseSubMenuItems.length > 1) {
                                        if (!expenseOpenRef.current) {
                                            setExpenseOpen(true);
                                        }
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
                                icon={<IconCar />}
                                label="차량 관리"
                                isActive={routeLocation.pathname.startsWith(PATHS.vehicles) && !menuFocus}
                                onClick={() => go(PATHS.vehicles, null)}
                            />
                        )}
                        {canShowVacation && (
                            <MenuButton
                                icon={<IconVacation />}
                                label="휴가 관리"
                                isActive={routeLocation.pathname.startsWith(PATHS.vacation) && !menuFocus}
                                onClick={() => go(PATHS.vacation, null)}
                            />
                        )}
                        <MenuButton
                            icon={<IconMembers />}
                            label="구성원 관리"
                            isActive={routeLocation.pathname.startsWith(PATHS.members) && !menuFocus}
                            onClick={() => go(PATHS.members, null)}
                        />
                    </nav>

                    <div className="h-px bg-gray-200 rounded-full mt-2" />

                    <div className="mt-auto">
                        <div className={isAdmin ? "" : "invisible pointer-events-none"}>
                            <MenuButton
                                icon={<IconSettings />}
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
