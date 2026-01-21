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
        `flex items-center gap-2 px-3 py-2 rounded-lg transition-colors duration-200 ease-in-out text-left ${isActive
          ? "text-blue-600 font-medium"
          : "text-gray-500 hover:text-gray-900 hover:bg-gray-200"
        }`
      }
    >
      <span className="text-gray-400">ㄴ</span>
      <p className="text-[14px]">{label}</p>
    </NavLink>
  );
}
