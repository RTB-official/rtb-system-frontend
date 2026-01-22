import { NavLink } from "react-router-dom";

type MenuFocus = "REPORT" | "EXPENSE" | null;

interface SubLinkProps {
  to: string;
  label: string;
  focus: MenuFocus;
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
        onMenuClick?.(focus);
        onClose?.();
      }}
      className={({ isActive }) =>
        `flex items-center py-2 transition-all duration-300 ${isActive
          ? "text-gray-800 font-semibold"
          : "text-gray-500 hover:text-gray-600 hover:font-semibold"
        }`
      }
      style={{
        transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      <p className="text-[14px]">ㄴ {label}</p>
    </NavLink>
  );
}
