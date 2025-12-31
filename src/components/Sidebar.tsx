import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";

// 아이콘 컴포넌트들
const IconHome = () => (
    <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
    >
        <path
            d="M10 20V14H14V20H19V12H22L12 3L2 12H5V20H10Z"
            fill="currentColor"
        />
    </svg>
);

const IconDescription = () => (
<<<<<<< HEAD
    <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
    >
        <path
            d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2ZM16 18H8V16H16V18ZM16 14H8V12H16V14ZM13 9V3.5L18.5 9H13Z"
            fill="currentColor"
        />
    </svg>
);

const IconAssessment = () => (
    <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
    >
        <path
            d="M19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3ZM9 17H7V10H9V17ZM13 17H11V7H13V17ZM17 17H15V13H17V17Z"
            fill="currentColor"
        />
    </svg>
);

const IconPayment = () => (
    <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
    >
        <path
            d="M20 4H4C2.89 4 2.01 4.89 2.01 6L2 18C2 19.11 2.89 20 4 20H20C21.11 20 22 19.11 22 18V6C22 4.89 21.11 4 20 4ZM20 18H4V12H20V18ZM20 8H4V6H20V8Z"
            fill="currentColor"
        />
    </svg>
);

const IconBeachAccess = () => (
    <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
    >
        <path
            d="M21 16V14L13 9V3.5C13 2.67 12.33 2 11.5 2C10.67 2 10 2.67 10 3.5V9L2 14V16L10 13.5V19L8 20.5V22L11.5 21L15 22V20.5L13 19V13.5L21 16Z"
            fill="currentColor"
        />
    </svg>
);

const IconPeople = () => (
    <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
    >
        <path
            d="M16 11C17.66 11 18.99 9.66 18.99 8C18.99 6.34 17.66 5 16 5C14.34 5 13 6.34 13 8C13 9.66 14.34 11 16 11ZM8 11C9.66 11 10.99 9.66 10.99 8C10.99 6.34 9.66 5 8 5C6.34 5 5 6.34 5 8C5 9.66 6.34 11 8 11ZM8 13C5.67 13 1 14.17 1 16.5V19H15V16.5C15 14.17 10.33 13 8 13ZM16 13C15.71 13 15.38 13.02 15.03 13.05C16.19 13.89 17 15.02 17 16.5V19H23V16.5C23 14.17 18.33 13 16 13Z"
            fill="currentColor"
        />
    </svg>
);

const IconNotifications = () => (
    <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
    >
        <path
            d="M12 22C13.1 22 14 21.1 14 20H10C10 21.1 10.9 22 12 22ZM18 16V11C18 7.93 16.37 5.36 13.5 4.68V4C13.5 3.17 12.83 2.5 12 2.5C11.17 2.5 10.5 3.17 10.5 4V4.68C7.64 5.36 6 7.92 6 11V16L4 18V19H20V18L18 16Z"
            fill="currentColor"
        />
    </svg>
);

const IconClose = () => (
    <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
    >
        <path
            d="M19 6.41L17.59 5L12 10.59L6.41 5L5 6.41L10.59 12L5 17.59L6.41 19L12 13.41L17.59 19L19 17.59L13.41 12L19 6.41Z"
            fill="currentColor"
        />
    </svg>
);

const IconSubdirectory = () => (
    <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
    >
        <path d="M19 15L13 21V18H4V10H6V16H13V13L19 15Z" fill="currentColor" />
    </svg>
);

interface SidebarProps {
    onClose?: () => void;
    activeMenu?: string;
    activeSubMenu?: string;
}

export default function Sidebar({
    onClose,
    activeMenu = "출장 보고서",
    activeSubMenu,
}: SidebarProps) {
    const [activeItem, setActiveItem] = useState(activeMenu);
    const [expenseOpen, setExpenseOpen] = useState(activeMenu === "지출 관리");
    const [reportOpen, setReportOpen] = useState(activeMenu === "출장 보고서");
    const [activeSubItem, setActiveSubItem] = useState(activeSubMenu || "");
    const [reportActiveSubItem, setReportActiveSubItem] = useState("");
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        if (activeMenu === "지출 관리") {
            setExpenseOpen(true);
        }
    }, [activeMenu]);

    const mainMenuItems = [
        { icon: <IconHome />, label: "대시보드" },
        { icon: <IconDescription />, label: "출장 보고서" },
        { icon: <IconAssessment />, label: "워크로드" },
    ];

    const expenseSubMenuItems = [
        { label: "개인 지출", path: "/expense" },
        { label: "구성원 지출 관리", path: "/expense/member" },
    ];
    const reportSubMenuItems = [
        { label: "보고서 작성", path: "/reportcreate" },
        { label: "보고서 목록", path: "/report" },
    ];

    const routeMap: Record<string, string> = {
        대시보드: "/dashboard",
        "출장 보고서": "/report",
        워크로드: "/workload",
        "지출 관리": "/reportcreate",
        "휴가 관리": "/Vacation",
        "구성원 관리": "/members",
    };

    // inverse map: path -> label (first match)
    const getLabelFromPath = (path: string) => {
        const entry = Object.entries(routeMap).find(([, p]) =>
            path.startsWith(p)
        );
        return entry ? entry[0] : "";
    };

    // Sync active item with current route so hover/active state reflects navigation
    useEffect(() => {
        const label = getLabelFromPath(location.pathname);
        if (label) {
            setActiveItem(label);
            setExpenseOpen(label === "지출 관리");
        }
    }, [location.pathname]);
    // Ensure /expense route highlights appropriate submenu under 지출 관리
    useEffect(() => {
        if (location.pathname.startsWith("/expense/member")) {
            setActiveItem("지출 관리");
            setExpenseOpen(true);
            setReportOpen(false);
            setActiveSubItem("구성원 지출 관리");
        } else if (location.pathname.startsWith("/expense")) {
            setActiveItem("지출 관리");
            setExpenseOpen(true);
            setReportOpen(false);
            setActiveSubItem("개인 지출");
        }
    }, [location.pathname]);

    // Ensure /report routes highlight subitems under 출장 보고서
    useEffect(() => {
        if (location.pathname.startsWith("/reportcreate")) {
            setActiveItem("출장 보고서");
            setReportOpen(true);
            setExpenseOpen(false);
            setReportActiveSubItem("보고서 작성");
        } else if (location.pathname.startsWith("/report")) {
            setActiveItem("출장 보고서");
            setReportOpen(true);
            setExpenseOpen(false);
            setReportActiveSubItem("보고서 목록");
        }
    }, [location.pathname]);

    const bottomMenuItems = [
        { icon: <IconBeachAccess />, label: "휴가 관리" },
        { icon: <IconPeople />, label: "구성원 관리" },
    ];

    return (
        <aside className="w-[239px] h-full bg-[#f9fafb] border-r border-[#e5e7eb] flex flex-col">
            <div className="flex flex-col gap-6 px-4 py-5">
                {/* Logo & Close Button */}
                <div className="flex gap-2 items-center justify-between p-2">
                    <div className="flex gap-2 items-center">
                        <img
                            src="/images/RTBlogo.png"
                            alt="RTB 로고"
                            className="h-10 w-auto object-contain flex-shrink-0"
                        />
                        <p className="font-semibold text-[13px] text-[#101828] leading-[1.5] whitespace-nowrap">
                            RTB 통합 관리 시스템
                        </p>
                    </div>
                    {/* 모바일 닫기 버튼 */}
                    <button
                        onClick={onClose}
                        className="lg:hidden p-1 hover:bg-[#e5e7eb] rounded-lg transition-colors text-[#101828]"
                    >
                        <IconClose />
                    </button>
                </div>

                {/* User Section */}
                <div className="flex flex-col gap-3">
                    <div className="flex gap-2 items-center p-2">
                        <div className="w-7 h-7 rounded-full bg-[#101828]" />
                        <p className="font-semibold text-[16px] text-[#101828] leading-[1.5]">
                            user name
                        </p>
                    </div>

                    {/* Notifications */}
                    <div className="flex gap-6 items-center p-3">
                        <div className="flex gap-3 items-center w-[162px] text-[#101828]">
                            <IconNotifications />
                            <p className="font-medium text-[16px] leading-[1.5]">
                                알림
                            </p>
                        </div>
                    </div>
                </div>

                {/* Divider */}
                <div className="h-px bg-[#e5e7eb] rounded-full" />

                {/* Menu Items */}
                <nav className="flex flex-col gap-2">
                    {/* Main Menu Items */}
                    {mainMenuItems.map((item) => (
                        <div key={item.label}>
                            <button
                                onClick={() => {
                                    // 출장 보고서 클릭 시 첫 번째 하위 메뉴(보고서 작성)로 이동
                                    if (item.label === "출장 보고서") {
                                        setReportOpen(true);
                                        setActiveItem("출장 보고서");
                                        setExpenseOpen(false);
                                        setReportActiveSubItem("보고서 작성");
                                        navigate("/reportcreate");
                                        return;
                                    }
                                    setActiveItem(item.label);
                                    setExpenseOpen(false);
                                    const path = routeMap[item.label];
                                    if (path) navigate(path);
                                }}
                                className={`flex gap-6 items-center p-3 rounded-xl transition-colors ${
                                    activeItem === item.label &&
                                    activeMenu !== "지출 관리"
                                        ? "bg-[#364153] text-white"
                                        : "text-[#101828] hover:bg-[#e5e7eb]"
                                }`}
                            >
                                <div className="flex gap-3 items-center w-[162px]">
                                    {item.icon}
                                    <p className="font-medium text-[16px] leading-[1.5]">
                                        {item.label}
                                    </p>
                                </div>
                            </button>
                            {/* Report submenu directly under '출장 보고서' */}
                            {item.label === "출장 보고서" && reportOpen && (
                                <div className="ml-4 mt-1 flex flex-col gap-1">
                                    {reportSubMenuItems.map((subItem) => (
                                        <button
                                            key={subItem.label}
                                            onClick={() => {
                                                setReportActiveSubItem(
                                                    subItem.label
                                                );
                                                setActiveItem("출장 보고서");
                                                setExpenseOpen(false);
                                                if (subItem.path)
                                                    navigate(subItem.path);
                                            }}
                                            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-left ${
                                                reportActiveSubItem ===
                                                subItem.label
                                                    ? "text-blue-600 font-medium"
                                                    : "text-[#6a7282] hover:text-[#101828] hover:bg-[#e5e7eb]"
                                            }`}
                                        >
                                            <span className="text-gray-400">
                                                ㄴ
                                            </span>
                                            <p className="text-[14px]">
                                                {subItem.label}
                                            </p>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}

                    {/* 지출 관리 with Dropdown */}
                    <div>
                        <button
                            onClick={() => {
                                setExpenseOpen(true);
                                setReportOpen(false);
                                setActiveItem("지출 관리");
                                setActiveSubItem("개인 지출");
                                navigate("/expense");
                            }}
                            className={`w-full flex gap-6 items-center p-3 rounded-xl transition-colors ${
                                activeMenu === "지출 관리"
                                    ? "bg-[#364153] text-white"
                                    : "text-[#101828] hover:bg-[#e5e7eb]"
                            }`}
                        >
                            <div className="flex gap-3 items-center w-[162px]">
                                <IconPayment />
                                <p className="font-medium text-[16px] leading-[1.5]">
                                    지출 관리
                                </p>
                            </div>
                        </button>

                        {/* Submenu */}
                        {expenseOpen && (
                            <div className="ml-4 mt-1 flex flex-col gap-1">
                                {expenseSubMenuItems.map((subItem) => (
                                    <button
                                        key={subItem.label}
                                        onClick={() => {
                                            setActiveSubItem(subItem.label);
                                            setActiveItem("지출 관리");
                                            setReportOpen(false);
                                            if (subItem.path) {
                                                navigate(subItem.path);
                                            }
                                        }}
                                        className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-left ${
                                            activeSubItem === subItem.label
                                                ? "text-blue-600 font-medium"
                                                : "text-[#6a7282] hover:text-[#101828] hover:bg-[#e5e7eb]"
                                        }`}
                                    >
                                        <span className="text-gray-400">
                                            ㄴ
                                        </span>
                                        <p className="text-[14px]">
                                            {subItem.label}
                                        </p>
                                    </button>
                                ))}
                            </div>
                        )}
                        {/* report submenu removed from here - rendered inline under main menu item */}
                    </div>

                    {/* Bottom Menu Items */}
                    {bottomMenuItems.map((item) => (
                        <button
                            key={item.label}
                            onClick={() => {
                                setActiveItem(item.label);
                                setExpenseOpen(false);
                                setActiveSubItem("");
                                setReportActiveSubItem("");
                                const path = routeMap[item.label];
                                if (path) navigate(path);
                            }}
                            className={`flex gap-6 items-center p-3 rounded-xl transition-colors ${
                                activeItem === item.label &&
                                activeMenu !== "지출 관리"
                                    ? "bg-[#364153] text-white"
                                    : "text-[#101828] hover:bg-[#e5e7eb]"
                            }`}
                        >
                            <div className="flex gap-3 items-center w-[162px]">
                                {item.icon}
                                <p className="font-medium text-[16px] leading-[1.5]">
                                    {item.label}
                                </p>
                            </div>
                        </button>
                    ))}
                </nav>
            </div>
        </aside>
    );
=======
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2ZM16 18H8V16H16V18ZM16 14H8V12H16V14ZM13 9V3.5L18.5 9H13Z"
      fill="currentColor"
    />
  </svg>
);

const IconAssessment = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3ZM9 17H7V10H9V17ZM13 17H11V7H13V17ZM17 17H15V13H17V17Z"
      fill="currentColor"
    />
  </svg>
);

const IconPayment = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M20 4H4C2.89 4 2.01 4.89 2.01 6L2 18C2 19.11 2.89 20 4 20H20C21.11 20 22 19.11 22 18V6C22 4.89 21.11 4 20 4ZM20 18H4V12H20V18ZM20 8H4V6H20V8Z"
      fill="currentColor"
    />
  </svg>
);

const IconBeachAccess = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M21 16V14L13 9V3.5C13 2.67 12.33 2 11.5 2C10.67 2 10 2.67 10 3.5V9L2 14V16L10 13.5V19L8 20.5V22L11.5 21L15 22V20.5L13 19V13.5L21 16Z"
      fill="currentColor"
    />
  </svg>
);

const IconPeople = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M16 11C17.66 11 18.99 9.66 18.99 8C18.99 6.34 17.66 5 16 5C14.34 5 13 6.34 13 8C13 9.66 14.34 11 16 11ZM8 11C9.66 11 10.99 9.66 10.99 8C10.99 6.34 9.66 5 8 5C6.34 5 5 6.34 5 8C5 9.66 6.34 11 8 11ZM8 13C5.67 13 1 14.17 1 16.5V19H15V16.5C15 14.17 10.33 13 8 13ZM16 13C15.71 13 15.38 13.02 15.03 13.05C16.19 13.89 17 15.02 17 16.5V19H23V16.5C23 14.17 18.33 13 16 13Z"
      fill="currentColor"
    />
  </svg>
);

const IconNotifications = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M12 22C13.1 22 14 21.1 14 20H10C10 21.1 10.9 22 12 22ZM18 16V11C18 7.93 16.37 5.36 13.5 4.68V4C13.5 3.17 12.83 2.5 12 2.5C11.17 2.5 10.5 3.17 10.5 4V4.68C7.64 5.36 6 7.92 6 11V16L4 18V19H20V18L18 16Z"
      fill="currentColor"
    />
  </svg>
);

const IconClose = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M19 6.41L17.59 5L12 10.59L6.41 5L5 6.41L10.59 12L5 17.59L6.41 19L12 13.41L17.59 19L19 17.59L13.41 12L19 6.41Z"
      fill="currentColor"
    />
  </svg>
);

interface SidebarProps {
  onClose?: () => void;
}

type MenuFocus = "REPORT" | "EXPENSE" | null;

export default function Sidebar({ onClose }: SidebarProps) {
  const location = useLocation();

  // ✅ 프로젝트 라우터와 100% 동일해야 함 (대/소문자 포함)
  const PATHS = useMemo(
    () => ({
      dashboard: "/dashboard",
      reportList: "/report",
      reportCreate: "/reportcreate",
      workload: "/workload",
  
      expenseTeam: "/expense/team",
      expensePersonal: "/expense/personal",
  
      vacation: "/Vacation", // 기존이 대문자면 유지
      members: "/members",
    }),
    []
  );

  const isMatch = (pattern: string) => !!matchPath({ path: pattern, end: false }, location.pathname);

  const isReportRoute = isMatch(PATHS.reportList) || isMatch(PATHS.reportCreate);
  const isExpenseRoute = isMatch(PATHS.expenseTeam) || isMatch(PATHS.expensePersonal);

  // ✅ “펼침/선택”만 해도 강조되게 하는 포커스 상태
  const [menuFocus, setMenuFocus] = useState<MenuFocus>(null);

  // ✅ 서브메뉴 open
  const [reportOpen, setReportOpen] = useState(isReportRoute);
  const [expenseOpen, setExpenseOpen] = useState(isExpenseRoute);

  // ✅ notification 브랜치 기능 이식: 알림 패널 토글
  const [showNotifications, setShowNotifications] = useState(false);

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
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // ✅ menuFocus가 있으면 다른 메뉴는 “강제로 비활성” 처리(워크로드 강조 잔상 제거)
  const shouldForceInactive = (_kind: "DASH" | "WORKLOAD" | "VACATION" | "MEMBERS") => {
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
    kind: "DASH" | "WORKLOAD" | "VACATION" | "MEMBERS";
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
          active ? "bg-[#364153] text-white" : "text-[#101828] hover:bg-[#e5e7eb]"
        }`;
      }}
    >
      <div className="flex gap-3 items-center w-[162px]">
        {icon}
        <p className="font-medium text-[16px] leading-[1.5]">{label}</p>
      </div>
    </NavLink>
  );

  const SubLink = ({ to, label, focus }: { to: string; label: string; focus: MenuFocus }) => (
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
          isActive ? "text-blue-600 font-medium" : "text-[#6a7282] hover:text-[#101828] hover:bg-[#e5e7eb]"
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
    { label: "보고서 작성", to: PATHS.reportCreate },
    { label: "보고서 목록", to: PATHS.reportList },
  ];

  const expenseSubMenuItems = [
    { label: "구성원 지출 관리", to: PATHS.expenseTeam },
    { label: "개인 지출", to: PATHS.expensePersonal },
  ];
  

  return (
    <aside className="w-[239px] h-full bg-[#f9fafb] border-r border-[#e5e7eb] flex flex-col">
      <div className="flex flex-col gap-6 px-4 py-5">
        {/* Logo & Close Button */}
        <div className="flex gap-2 items-center justify-between p-2">
          <div className="flex gap-2 items-center">
            <img src="/images/RTBlogo.png" alt="RTB 로고" className="h-10 w-auto object-contain flex-shrink-0" />
            <p className="font-semibold text-[13px] text-[#101828] leading-[1.5] whitespace-nowrap">RTB 통합 관리 시스템</p>
          </div>
          <button onClick={onClose} className="lg:hidden p-1 hover:bg-[#e5e7eb] rounded-lg transition-colors text-[#101828]">
            <IconClose />
          </button>
        </div>

        {/* User Section */}
        <div className="flex flex-col gap-3">
          <div className="flex gap-2 items-center p-2">
            <div className="w-7 h-7 rounded-full bg-[#101828]" />
            <p className="font-semibold text-[16px] text-[#101828] leading-[1.5]">user name</p>
          </div>

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications((v) => !v)}
              className={`flex gap-6 items-center p-3 rounded-lg transition-colors w-full text-left ${
                showNotifications ? "bg-[#f1f5f9]" : "text-[#101828] hover:bg-[#e5e7eb]"
              }`}
            >
              <div className="flex gap-3 items-center w-[162px]">
                <IconNotifications />
                <p className="font-medium text-[16px] leading-[1.5]">알림</p>
              </div>
              <div className="ml-auto">
                <span className="inline-flex items-center justify-center bg-[#ff3b30] text-white text-[12px] w-6 h-6 rounded-full">
                  8
                </span>
              </div>
            </button>

            {showNotifications && (
              <div className="absolute left-[239px] top-0 -translate-y-2 -translate-x-[16px] z-50">
                <div className="w-[360px] bg-white rounded-xl shadow-lg border border-[#e6eef5] p-3">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-[16px] font-semibold text-[#101828]">알림</h4>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowNotifications(false)}
                        className="text-sm text-[#6b7280] hover:text-[#101828]"
                      >
                        모두 읽음
                      </button>
                      <button onClick={() => setShowNotifications(false)} className="p-1 rounded hover:bg-[#f3f4f6]">
                        <IconClose />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 max-h-[320px] overflow-auto pr-1">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex flex-col gap-1 bg-[#fbfdff] rounded-lg p-3 border border-[#eef4f8]">
                        <div className="flex items-start justify-between">
                          <p className="text-[13px] font-medium text-[#0f1724]">캡션</p>
                        </div>
                        <p className="text-[13px] text-[#475569]">알림의 내용이 들어갑니다. 내용이 길어지면 다음 줄로 넘어가요.</p>
                        <p className="text-[12px] text-[#9aa4b2]">날짜 또는 부가 정보</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="h-px bg-[#e5e7eb] rounded-full" />

        <nav className="flex flex-col gap-2">
          {/* 대시보드 */}
          <MainLink to={PATHS.dashboard} icon={<IconHome />} label="대시보드" kind="DASH" />

          {/* 출장 보고서 (헤더 버튼) */}
          <button
            onClick={() => {
              setShowNotifications(false);
              setMenuFocus("REPORT");
              setReportOpen((prev) => !prev);
              setExpenseOpen(false);
            }}
            className={`flex gap-6 items-center p-3 rounded-xl transition-colors ${
              reportActive ? "bg-[#364153] text-white" : "text-[#101828] hover:bg-[#e5e7eb]"
            }`}
          >
            <div className="flex gap-3 items-center w-[162px]">
              <IconDescription />
              <p className="font-medium text-[16px] leading-[1.5]">출장 보고서</p>
            </div>
          </button>

          {reportOpen && (
            <div className="ml-4 mt-1 flex flex-col gap-1">
              {reportSubMenuItems.map((s) => (
                <SubLink key={s.label} to={s.to} label={s.label} focus="REPORT" />
              ))}
            </div>
          )}

          {/* 워크로드 */}
          <MainLink to={PATHS.workload} icon={<IconAssessment />} label="워크로드" kind="WORKLOAD" />

          {/* 지출 관리 (헤더 버튼) */}
          <button
            onClick={() => {
              setShowNotifications(false);
              setMenuFocus("EXPENSE");
              setExpenseOpen((prev) => !prev);
              setReportOpen(false);
            }}
            className={`w-full flex gap-6 items-center p-3 rounded-xl transition-colors ${
              expenseActive ? "bg-[#364153] text-white" : "text-[#101828] hover:bg-[#e5e7eb]"
            }`}
          >
            <div className="flex gap-3 items-center w-[162px]">
              <IconPayment />
              <p className="font-medium text-[16px] leading-[1.5]">지출 관리</p>
            </div>
          </button>

          {expenseOpen && (
            <div className="ml-4 mt-1 flex flex-col gap-1">
              {expenseSubMenuItems.map((s) => (
                <SubLink key={s.label} to={s.to} label={s.label} focus="EXPENSE" />
              ))}
            </div>
          )}

          {/* 휴가 관리 */}
          <MainLink to={PATHS.vacation} icon={<IconBeachAccess />} label="휴가 관리" kind="VACATION" />

          {/* 구성원 관리 */}
          <MainLink to={PATHS.members} icon={<IconPeople />} label="구성원 관리" kind="MEMBERS" />
        </nav>
      </div>
    </aside>
  );
>>>>>>> origin/main
}
