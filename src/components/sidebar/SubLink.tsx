import { NavLink } from "react-router-dom";
import { markSubMenuSkipEnter } from "./subMenuEnterAnimation";

type MenuFocus = "SCHEDULE" | "REPORT" | "TBM" | "EXPENSE" | "INVOICE" | null;

interface SubLinkProps {
  to: string;
  label: string;
  focus: Exclude<MenuFocus, null>;
  onClose?: () => void;
  onMenuClick?: (focus: MenuFocus) => void;
}

export default function SubLink({
  to,
  label,
  focus,
  onClose,
  onMenuClick,
}: SubLinkProps) {
  return (
    <NavLink
      to={to}
      end={true}
      onClick={() => {
        // 같은 탭 브랜치 이동 → 재마운트 시 열림 애니메이션 생략
        markSubMenuSkipEnter(focus);
        onMenuClick?.(focus);
        onClose?.();
      }}
      className={({ isActive }) =>
        `flex items-center py-1.5 md:py-2 transition-all duration-300 ${
          isActive
            ? "text-gray-800 font-semibold"
            : "text-gray-500 hover:text-gray-600 hover:font-semibold"
        }`
      }
      style={{
        transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      <p className="text-[12px] md:text-[14px]">ㄴ {label}</p>
    </NavLink>
  );
}
