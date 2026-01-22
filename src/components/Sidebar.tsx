// src/components/Sidebar.tsx
import { useEffect, useState, useRef } from "react";
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

    // 권한 정보를 ref로 저장하여 깜빡임 방지
    const userPermissionsRef = useRef(userPermissions);
    useEffect(() => {
        // 권한이 한 번 설정되면 유지 (초기값이 false가 아닐 때만 업데이트)
        if (userPermissions.isCEO || userPermissions.isAdmin || userPermissions.isStaff) {
            userPermissionsRef.current = userPermissions;
        }
    }, [userPermissions]);

    // 안정화된 권한 사용 (깜빡임 방지)
    const stablePermissions = userPermissionsRef.current.isCEO || userPermissionsRef.current.isAdmin || userPermissionsRef.current.isStaff
        ? userPermissionsRef.current
        : userPermissions;

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
    const expenseActive = isExpenseRoute || menuFocus === "EXPENSE";

    // 메뉴 아이템
    const { reportSubMenuItems, expenseSubMenuItems } = useSidebarMenuItems(
        stablePermissions,
        isReportEditRoute,
        routeLocation
    );


    // 라우트 변경에 따른 서브메뉴 상태 동기화
    useSidebarRouteSync({
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

    // menuFocus가 있으면 다른 메뉴는 "강제로 비활성" 처리
    const shouldForceInactive = (_kind: "HOME" | "WORKLOAD" | "VACATION" | "MEMBERS") => {
        if (!menuFocus) return false;
        return true;
    };

    // 로그아웃 처리
    const handleLogoutClick = async () => {
        await handleLogout();
        navigate("/login");
    };

    return (
        <aside className="w-[239px] h-full bg-gray-50 border-r border-gray-200 flex flex-col">
            <div className="flex flex-col gap-6 px-4 py-5">
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
                <div className="flex flex-col gap-3">
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
                            onClick={() => {
                                setShowNotifications(!showNotifications);
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

                    <nav className="flex flex-col gap-2">
                        {/* 대시보드 - 대표님, admin만 */}
                        {(stablePermissions.isCEO || stablePermissions.isAdmin) && (
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
                                handleMenuClick("REPORT");
                                setExpenseOpen(false);
                                // 이미 열려있고 같은 서브메뉴 내 이동이면 상태 변경하지 않음
                                if (!reportOpenRef.current) {
                                    setReportOpen(true);
                                }
                                navigate(PATHS.reportList);
                            }}
                        />

                        <SubMenu
                            isOpen={stableReportOpen}
                            items={reportSubMenuItems}
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
                                handleMenuClick("EXPENSE");
                                setReportOpen(false);

                                if (expenseSubMenuItems.length === 1) {
                                    navigate(expenseSubMenuItems[0].to);
                                    setExpenseOpen(false);
                                } else if (expenseSubMenuItems.length > 1) {
                                    // 이미 열려있고 같은 서브메뉴 내 이동이면 상태 변경하지 않음
                                    if (!expenseOpenRef.current) {
                                        setExpenseOpen(true);
                                    }
                                    navigate(PATHS.expensePersonal);
                                }
                            }}
                        />

                        {/* 하위메뉴 */}
                        {expenseSubMenuItems.length > 1 && (
                            <SubMenu
                                isOpen={stableExpenseOpen}
                                items={expenseSubMenuItems}
                                focus="EXPENSE"
                                onClose={onClose}
                                onMenuClick={handleMenuClick}
                            />
                        )}

                        {/* 휴가 관리 - 대표님, admin만 (staff 제외) */}
                        {(stablePermissions.isCEO || !stablePermissions.isStaff) && (
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
                </div>
            </div>
        </aside>
    );
}
