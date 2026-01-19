// src/components/Sidebar.tsx
import { useEffect, useMemo, useState, useRef } from "react";
import { NavLink, useLocation, matchPath, useNavigate } from "react-router-dom";
import NotificationPopup from "./ui/NotificationPopup";
import ActionMenu from "./common/ActionMenu";
import ResetPasswordModal from "./modals/ResetPasswordModal";
import BaseModal from "./ui/BaseModal";
import Button from "./common/Button";
import { supabase } from "../lib/supabase";
import Avatar from "./common/Avatar";
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

interface SidebarProps {
    onClose?: () => void;
}

type MenuFocus = "REPORT" | "EXPENSE" | null;

export default function Sidebar({ onClose }: SidebarProps) {
    const location = useLocation();
    const navigate = useNavigate();

    const handleLogout = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) {
            console.error("로그아웃 실패:", error.message);
            return;
        }
        localStorage.removeItem("sidebarLoginId");
        localStorage.removeItem("sidebarEmail");
        localStorage.removeItem("sidebarPosition");
        navigate("/login");
    };


    // ✅ 프로젝트 라우터와 100% 동일해야 함 (대/소문자 포함)
    const PATHS = useMemo(
        () => ({
            dashboard: "/dashboard",
            reportList: "/report",
            reportCreate: "/reportcreate",
            workload: "/workload",

            expenseTeam: "/expense/member",
            expensePersonal: "/expense", // Changed to /expense
            // expensePersonal: "/expense/personal", // Original

            vacation: "/Vacation",
            members: "/members",
        }),
        []
    );

    const isMatch = (pattern: string) =>
        !!matchPath({ path: pattern, end: false }, location.pathname);
    
    // ✅ 보고서 수정 진입 감지:
    // 1) /reportcreate?id=123 같은 쿼리 방식
    const searchParams = new URLSearchParams(location.search);
    const isReportEditByQuery =
        isMatch(PATHS.reportCreate) && !!searchParams.get("id");
    
    // 2) 혹시 쓰는 경우를 대비한 path param 방식도 유지
    const isReportEditByPath =
        !!matchPath({ path: "/report/edit/:id", end: false }, location.pathname) ||
        !!matchPath({ path: "/report/:id/edit", end: false }, location.pathname);
    
    const isReportEditRoute = isReportEditByQuery || isReportEditByPath;
    
    const isReportRoute =
        isMatch(PATHS.reportList) || isMatch(PATHS.reportCreate) || isReportEditRoute;
    
    
    const isExpenseRoute =
        isMatch(PATHS.expenseTeam) || isMatch(PATHS.expensePersonal);

    // ✅ "펼침/선택"만 해도 강조되게 하는 포커스 상태
    const [menuFocus, setMenuFocus] = useState<MenuFocus>(null);

    // ✅ 서브메뉴 open
    const [reportOpen, setReportOpen] = useState(isReportRoute);
    const [expenseOpen, setExpenseOpen] = useState(isExpenseRoute);

    // ✅ notification 브랜치 기능 이식: 알림 패널 토글
    const [showNotifications, setShowNotifications] = useState(false);

    // 사용자 메뉴 상태
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const [resetPasswordModalOpen, setResetPasswordModalOpen] = useState(false);
    const [logoutConfirmModalOpen, setLogoutConfirmModalOpen] = useState(false);
    const usernameRef = useRef<HTMLDivElement>(null);
    const notificationRef = useRef<HTMLDivElement>(null);
    const [sidebarLoginId, setSidebarLoginId] = useState<string>(() => {
        return localStorage.getItem("sidebarLoginId") || "";
    });

    const [currentUser, setCurrentUser] = useState<{
        displayName: string;
        email: string;
        position?: string | null;
    } | null>(() => {
        const cachedEmail = localStorage.getItem("sidebarEmail") || "";
        const cachedId = localStorage.getItem("sidebarLoginId") || "";
        const cachedPosition = localStorage.getItem("sidebarPosition") || "";
        if (!cachedEmail && !cachedId) return null;

        return {
            displayName: cachedId || "",
            email: cachedEmail,
            position: cachedPosition || null,
        };
    });



    useEffect(() => {
        const fetchUser = async () => {
            const {
                data: { user },
                error: authError,
            } = await supabase.auth.getUser();

            if (authError || !user) {
                console.error("유저 세션 없음:", authError?.message);
                setCurrentUser(null);
                return;
            }

            const sessionEmail = (user.email ?? "").toString();
            const sessionId = sessionEmail ? sessionEmail.split("@")[0] : "";

            // ✅ 새로고침 직후에도 즉시 동일하게 보이도록 캐시
            if (sessionEmail) localStorage.setItem("sidebarEmail", sessionEmail);
            if (sessionId) {
                setSidebarLoginId(sessionId);
                localStorage.setItem("sidebarLoginId", sessionId);
            }

            // ✅ DB 조회 전에 먼저 렌더링 값 확보 (깜빡임 방지)
            // ✅ 직급은 캐시(sidebarPosition)를 먼저 넣어 Avatar 색 깜빡임 제거
            const cachedPosition = localStorage.getItem("sidebarPosition") || "";

            setCurrentUser({
                displayName: sessionId || "사용자",
                email: sessionEmail,
                position: cachedPosition || null,
            });


            const { data, error } = await supabase
                .from("profiles")
                .select("name, email, username, position")
                .eq("id", user.id)
                .single();

                if (error) {
                    console.error("유저 정보 조회 실패:", error.message);
    
                    const email = (user.email ?? "").toString();
                    const id = email ? email.split("@")[0] : "";
    
                    const cachedPosition = localStorage.getItem("sidebarPosition") || "";

                    setCurrentUser({
                        displayName: user.email ?? "사용자",
                        email,
                        position: cachedPosition || null,
                    });
    
                    if (id) {
                        setSidebarLoginId(id);
                        localStorage.setItem("sidebarLoginId", id);
                    }
                    return;
                }

                const email = (data.email ?? user.email ?? "").toString();
                if (email) localStorage.setItem("sidebarEmail", email);
                const id = email ? email.split("@")[0] : "";

                const pos = (data?.position ?? "").toString();
                if (pos) localStorage.setItem("sidebarPosition", pos);
                else localStorage.removeItem("sidebarPosition");
            

                setCurrentUser({
                    displayName: data?.username ?? data?.name ?? (user.email ?? "사용자"),
                    email,
                    position: data?.position ?? null,
                });
    

            if (id) {
                setSidebarLoginId(id);
                localStorage.setItem("sidebarLoginId", id);
            }

        };

        fetchUser();
    }, []);


    // 라우트 변경 시: 해당 라우트의 메뉴는 자동으로 열림 + 포커스 자동 정렬
    useEffect(() => {
        if (isReportRoute) {
            setReportOpen(true);
            setMenuFocus("REPORT");
        }
        if (isExpenseRoute) {
            setExpenseOpen(true);
            setMenuFocus("EXPENSE");
        }

        if (!isReportRoute) setReportOpen(false);
        if (!isExpenseRoute) setExpenseOpen(false);

        // 라우트 이동 시 알림 팝업은 닫아두는 게 UX 안전
        setShowNotifications(false);
    }, [location.pathname, isReportRoute, isExpenseRoute]); // eslint-disable-line react-hooks/exhaustive-deps

    // ✅ menuFocus가 있으면 다른 메뉴는 "강제로 비활성" 처리(워크로드 강조 잔상 제거)
    const shouldForceInactive = (
        _kind: "DASH" | "WORKLOAD" | "VACATION" | "MEMBERS"
    ) => {
        if (!menuFocus) return false;
        // report/expense 포커스일 때는 다른 링크의 isActive를 무시
        return true;
    };

    const MainLink = ({
        to,
        icon,
        label,
        kind,
        onClick,
    }: {
        to: string;
        icon: React.ReactNode;
        label: string;
        kind: "HOME" | "WORKLOAD" | "VACATION" | "MEMBERS";
        onClick?: () => void;
    }) => (
        <NavLink
            to={to}
            end={false}
            onClick={() => {
                setMenuFocus(null); // 다른 메뉴 클릭하면 포커스 해제
                setReportOpen(false);
                setExpenseOpen(false);
                setShowNotifications(false);
                onClick?.();

                // 모바일에서는 네비 후 사이드바 닫기(원래 props 유지)
                onClose?.();
            }}
            className={({ isActive }) => {
                const forcedInactive = shouldForceInactive(kind);
                const active = forcedInactive ? false : isActive;

                return `flex gap-6 items-center p-3 rounded-xl transition-colors ${
                    active
                        ? "bg-gray-700 text-white"
                        : "text-gray-900 hover:bg-gray-200"
                }`;
            }}
        >
            <div className="flex gap-3 items-center w-[162px]">
                {icon}
                <p className="font-medium text-[16px] leading-normal">
                    {label}
                </p>
            </div>
        </NavLink>
    );

    const SubLink = ({
        to,
        label,
        focus,
    }: {
        to: string;
        label: string;
        focus: MenuFocus;
    }) => (
        <NavLink
            to={to}
            end={true}
            onClick={() => {
                setMenuFocus(focus);
                setShowNotifications(false);
                // 모바일에서는 네비 후 사이드바 닫기
                onClose?.();
            }}
            className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-left ${
                    isActive
                        ? "text-blue-600 font-medium"
                        : "text-gray-500 hover:text-gray-900 hover:bg-gray-200"
                }`
            }
        >
            <span className="text-gray-400">ㄴ</span>
            <p className="text-[14px]">{label}</p>
        </NavLink>
    );

    const reportActive = isReportRoute || menuFocus === "REPORT";
    const expenseActive = isExpenseRoute || menuFocus === "EXPENSE";

    const reportSubMenuItems = [
        { label: "보고서 목록", to: PATHS.reportList },
        {
            // ✅ 수정 화면일 때 라벨 변경
            label: isReportEditRoute ? "보고서 작성(수정)" : "보고서 작성",
            // ✅ 쿼리스트링까지 포함해야 NavLink 활성(파란색)이 정확히 잡힘
            to: isReportEditRoute
                ? `${location.pathname}${location.search}`
                : PATHS.reportCreate,
        },
    ];

    const expenseSubMenuItems = [
        { label: "개인 지출 기록", to: PATHS.expensePersonal },
        { label: "구성원 지출 관리", to: PATHS.expenseTeam },
    ];

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
                            currentUser?.email
                                ? currentUser.email.split("@")[0]
                                : undefined
                        }
                        userEmail={currentUser?.email}

                    />

                    {/* 비밀번호 재설정 모달 */}
                    <ResetPasswordModal
                        isOpen={resetPasswordModalOpen}
                        onClose={() => setResetPasswordModalOpen(false)}
                        onSubmit={async (payload) => {
                            const { error } = await supabase.auth.updateUser({
                                password: payload.newPassword,
                            });

                            if (error) {
                                console.error("비밀번호 변경 실패:", error.message);
                                alert("비밀번호 변경에 실패했습니다. 다시 시도해주세요.");
                                return false;
                            }

                            alert("비밀번호가 변경되었습니다.");
                            return true;
                        }}
                    />


                    {/* 로그아웃 확인 모달 */}
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
                                    onClick={() =>
                                        setLogoutConfirmModalOpen(false)
                                    }
                                >
                                    취소
                                </Button>
                                <Button
                                    variant="primary"
                                    size="lg"
                                    fullWidth
                                    onClick={async () => {
                                        setLogoutConfirmModalOpen(false);
                                        await handleLogout();
                                    }}
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

                    {/* Notifications */}
                    <div className="relative" ref={notificationRef}>
                        <button
                            onClick={() => {
                                setShowNotifications(!showNotifications);
                                setUserMenuOpen(false);
                            }}
                            className={`flex gap-6 items-center p-3 rounded-xl transition-colors w-full text-left ${
                                showNotifications
                                    ? "bg-gray-100"
                                    : "text-gray-900 hover:bg-gray-200"
                            }`}
                        >
                            <div className="flex gap-3 items-center w-[162px]">
                                <IconNotifications />
                                <p className="font-medium text-[16px] leading-normal">
                                    알림
                                </p>
                            </div>
                            <div className="ml-auto">
                                <span className="inline-flex items-center justify-center bg-red-500 text-white text-[12px] w-6 h-6 rounded-full font-bold">
                                    8
                                </span>
                            </div>
                        </button>

                        {showNotifications && (
                            <NotificationPopup
                                onClose={() => setShowNotifications(false)}
                                anchorEl={notificationRef.current}
                            />
                        )}
                    </div>

                    <div className="h-px bg-gray-200 rounded-full" />

                    <nav className="flex flex-col gap-2">
                        {/* 대시보드 */}
                        <MainLink
                            to={PATHS.dashboard}
                            icon={<IconHome />}
                            label="홈"
                            kind="HOME"
                        />

                        {/* 출장 보고서 (헤더 버튼) */}
                        <button
                            onClick={() => {
                                setShowNotifications(false);
                                setMenuFocus("REPORT");
                                setReportOpen(true);
                                setExpenseOpen(false);
                                navigate(PATHS.reportList);
                            }}
                            className={`flex gap-6 items-center p-3 rounded-xl transition-colors ${
                                reportActive
                                    ? "bg-gray-700 text-white"
                                    : "text-gray-900 hover:bg-gray-200"
                            }`}
                        >
                            <div className="flex gap-3 items-center w-[162px]">
                                <IconReport />
                                <p className="font-medium text-[16px] leading-normal">
                                    출장 보고서
                                </p>
                            </div>
                        </button>

                        {reportOpen && (
                            <div className="ml-4 mt-1 flex flex-col gap-1">
                                {reportSubMenuItems.map((s) => (
                                    <SubLink
                                        key={s.label}
                                        to={s.to}
                                        label={s.label}
                                        focus="REPORT"
                                    />
                                ))}
                            </div>
                        )}

                        {/* 워크로드 */}
                        <MainLink
                            to={PATHS.workload}
                            icon={<IconWorkload />}
                            label="워크로드"
                            kind="WORKLOAD"
                        />

                        {/* 지출 관리 (헤더 버튼) */}
                        <button
                            onClick={() => {
                                setShowNotifications(false);
                                setMenuFocus("EXPENSE");
                                setExpenseOpen(true);
                                setReportOpen(false);
                                navigate(PATHS.expensePersonal);
                            }}
                            className={`w-full flex gap-6 items-center p-3 rounded-xl transition-colors ${
                                expenseActive
                                    ? "bg-gray-700 text-white"
                                    : "text-gray-900 hover:bg-gray-200"
                            }`}
                        >
                            <div className="flex gap-3 items-center w-[162px]">
                                <IconCard />
                                <p className="font-medium text-[16px] leading-normal">
                                    지출 관리
                                </p>
                            </div>
                        </button>

                        {expenseOpen && (
                            <div className="ml-4 mt-1 flex flex-col gap-1">
                                {expenseSubMenuItems.map((s) => (
                                    <SubLink
                                        key={s.label}
                                        to={s.to}
                                        label={s.label}
                                        focus="EXPENSE"
                                    />
                                ))}
                            </div>
                        )}

                        {/* 휴가 관리 */}
                        <MainLink
                            to={PATHS.vacation}
                            icon={<IconVacation />}
                            label="휴가 관리"
                            kind="VACATION"
                        />

                        {/* 구성원 관리 */}
                        <MainLink
                            to={PATHS.members}
                            icon={<IconMembers />}
                            label="구성원 관리"
                            kind="MEMBERS"
                        />
                    </nav>
                </div>
            </div>
        </aside>
    );
}
