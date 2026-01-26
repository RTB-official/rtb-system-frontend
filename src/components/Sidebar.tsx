// src/components/Sidebar.tsx
import { useEffect, useState, useRef, startTransition } from "react";
import { useNavigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import NotificationPopup from "./ui/NotificationPopup";
import ActionMenu from "./common/ActionMenu";
import Button from "./common/Button";

// 모달 컴포넌트 lazy loading
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
import MainLink from "./sidebar/MainLink";
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

    // 권한 정보를 ref로 저장하여 깜빡임 방지
    const userPermissionsRef = useRef(userPermissions);
    useEffect(() => {
        // 권한이 한 번 설정되면 유지 (초기값이 false가 아닐 때만 업데이트)
        if (userPermissions.isCEO || userPermissions.isAdmin || userPermissions.isStaff) {
            userPermissionsRef.current = userPermissions;
        }
    }, [userPermissions]);

    useEffect(() => {
        const fetchRole = async () => {
            if (!currentUserId) return;

            const { data, error } = await supabase
                .from("profiles")
                .select("role")
                .eq("id", currentUserId)
                .single();

            if (error) {
                console.error("profiles role 조회 실패:", error);
                // ✅ 캐시가 admin이면 깜빡임 방지를 위해 false로 떨어뜨리지 않음
                return;
            }

            const nextIsAdmin = data?.role === "admin";
            setIsAdmin(nextIsAdmin);

            // ✅ 다음 라우트 이동/재마운트 시 즉시 반영되도록 캐시
            localStorage.setItem("profile_role", data?.role ?? "");
        };

        fetchRole();
    }, [currentUserId]);

    // 안정화된 권한 사용 (깜빡임 방지)
    const stablePermissions = userPermissionsRef.current.isCEO || userPermissionsRef.current.isAdmin || userPermissionsRef.current.isStaff
        ? userPermissionsRef.current
        : userPermissions;
        const permissionsReady =
        stablePermissions.isCEO || stablePermissions.isAdmin || stablePermissions.isStaff;

    // ✅ 휴가 관리는 "admin/ceo만" + 권한 준비된 뒤에만 표시
    const canShowVacation =
        permissionsReady && (stablePermissions.isCEO || stablePermissions.isAdmin || isAdmin);

    // 알림 관련
    const {
        showNotifications,
        setShowNotifications,
        notifications,
        unreadCount,
        notificationRef,
        refreshNotifications,
    } = useNotifications(currentUserId);

    // 메뉴 포커스 및 상태
    const [menuFocus, setMenuFocus] = useState<MenuFocus>(null);

    

    // 사용자 메뉴 상태
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const [resetPasswordModalOpen, setResetPasswordModalOpen] = useState(false);
    const [logoutConfirmModalOpen, setLogoutConfirmModalOpen] = useState(false);
    const usernameRef = useRef<HTMLDivElement>(null);

    // 라우트 감지
    const { isReportRoute, isExpenseRoute, isReportEditRoute, location: routeLocation } = useSidebarRoutes();

    // 이전 라우트 추적 (같은 서브메뉴 내 이동 감지)
    const prevReportRouteRef = useRef<boolean>(isReportRoute);
    const prevExpenseRouteRef = useRef<boolean>(isExpenseRoute);

    // 서브메뉴 상태 관리
    const {
        setReportOpen,
        reportOpenRef,
        setExpenseOpen,
        expenseOpenRef,
        stableReportOpen,
        stableExpenseOpen,
    } = useSidebarSubMenuState(isReportRoute, isExpenseRoute, prevReportRouteRef, prevExpenseRouteRef);

    // 메뉴 활성 상태
    const reportActive = isReportRoute || menuFocus === "REPORT";
    const canShowHome = stablePermissions.isCEO || stablePermissions.isAdmin || isAdmin;
    const expenseActive = isExpenseRoute || menuFocus === "EXPENSE";
    const settingsActive = routeLocation.pathname.startsWith("/settings");

    // 메뉴 아이템
    const { reportSubMenuItems, expenseSubMenuItems } = useSidebarMenuItems(
        stablePermissions,
        isReportEditRoute,
        routeLocation
    );

        // ✅ report 서브메뉴: 닫힐 때 items가 먼저 []로 바뀌면 애니메이션이 스킵될 수 있어 캐시 유지
        const [reportItemsForSubMenu, setReportItemsForSubMenu] = useState(reportSubMenuItems);

        useEffect(() => {
            if (reportSubMenuItems.length > 0) {
                setReportItemsForSubMenu(reportSubMenuItems);
            }
        }, [reportSubMenuItems]);


    // 라우트 변경에 따른 서브메뉴 상태 동기화
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

    // 메뉴 클릭 핸들러
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

    // ✅ 자연스러운 이동: 상태 정리 → (필요 시) 이동 → 사이드바 닫기
    const go = (to: string, focus: MenuFocus | null) => {
        handleMenuClick(focus);

        // 같은 경로면 navigate 생략 (불필요한 깜빡임 방지)
        if (routeLocation.pathname !== to) {
            startTransition(() => {
                navigate(to);
            });
        }

        // 모바일/드로어라면 즉시 닫기
        onClose?.();
    };


    // menuFocus가 있으면 다른 메뉴는 "강제로 비활성" 처리
    const shouldForceInactive = (_kind: "HOME" | "WORKLOAD" | "VACATION" | "MEMBERS") => {
        if (!menuFocus) return false;
        return true;
    };

    // 로그아웃 처리
    const handleLogoutClick = async () => {
        localStorage.removeItem("profile_role");
        await handleLogout();
        navigate("/login");
    };

    return (
        <aside className="w-[239px] h-full bg-gray-50 border-r border-gray-200 flex flex-col">
            <div className="flex flex-col gap-6 px-4 py-5 flex-1">
                {/* Logo & Close Button */}
                <div className="flex gap-2 items-center justify-between p-2">
                    <div className="flex gap-2.5 items-center">
                        <img
                            src="/images/RTBlogo.png"
                            alt="RTB 로고"
                            className="h-9 w-auto object-contain shrink-0"
                        />
                        <p className="font-medium text-[14px] text-gray-900 whitespace-nowrap">
                            RTB 통합 관리 시스템
                        </p>
                    </div>
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
                        <p className="font-semibold text-[16px] text-gray-900 leading-normal">
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

                    {/* 비밀번호 재설정 모달 */}
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
                                        showError("비밀번호 변경에 실패했습니다. 다시 시도해주세요.");
                                        return false;
                                    }

                                    showSuccess("비밀번호가 변경되었습니다.");
                                    return true;
                                }}
                            />
                        </Suspense>
                    )}

                    {/* 로그아웃 확인 모달 */}
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
                                <p className="font-medium text-[16px] leading-normal">알림</p>
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
    className="flex flex-col gap-2 flex-1 overflow-y-auto pr-1
               [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
>
                        {/* 대시보드 - 대표님, admin만 */}
                        {canShowHome && (
                            <MainLink
                                to={PATHS.dashboard}
                                icon={<IconHome />}
                                label="홈"
                                kind="HOME"
                                onClose={onClose}
                                shouldForceInactive={shouldForceInactive}
                                onMenuClick={() => handleMenuClick(null)}
                            />
                        )}




                        {/* 출장 보고서 */}
                        <MenuButton
                            icon={<IconReport />}
                            label="출장 보고서"
                            isActive={reportActive}
                            onClick={() => {
                                // 서브메뉴 열림/닫힘은 유지
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

                        {/* 워크로드 */}
                        <MainLink
                            to={PATHS.workload}
                            icon={<IconWorkload />}
                            label="워크로드"
                            kind="WORKLOAD"
                            onClose={onClose}
                            shouldForceInactive={shouldForceInactive}
                            onMenuClick={() => handleMenuClick(null)}
                        />

                        {/* 지출 관리 */}
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

                        {/* 하위메뉴 (닫힘 애니메이션을 위해 항상 렌더) */}
                        <SubMenu
                            isOpen={stableExpenseOpen && expenseSubMenuItems.length > 1}
                            items={expenseSubMenuItems.length > 1 ? expenseSubMenuItems : []}
                            focus="EXPENSE"
                            onClose={onClose}
                            onMenuClick={handleMenuClick}
                        />

                        {/* 휴가 관리 - 대표님, admin만 */}
                        {canShowVacation && (
                            <MainLink
                                to={PATHS.vacation}
                                icon={<IconVacation />}
                                label="휴가 관리"
                                kind="VACATION"
                                onClose={onClose}
                                shouldForceInactive={shouldForceInactive}
                                onMenuClick={() => handleMenuClick(null)}
                            />
                        )}

                        {/* 구성원 관리 */}
                        <MainLink
                            to={PATHS.members}
                            icon={<IconMembers />}
                            label="구성원 관리"
                            kind="MEMBERS"
                            onClose={onClose}
                            shouldForceInactive={shouldForceInactive}
                            onMenuClick={() => handleMenuClick(null)}
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
