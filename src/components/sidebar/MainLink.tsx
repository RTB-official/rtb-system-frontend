import { NavLink } from "react-router-dom";

interface MainLinkProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  kind: "HOME" | "WORKLOAD" | "VACATION" | "MEMBERS";
  onClick?: () => void;
  onClose?: () => void;
  shouldForceInactive?: (kind: "HOME" | "WORKLOAD" | "VACATION" | "MEMBERS") => boolean;
  onMenuClick?: () => void;
}

export default function MainLink({
  to,
  icon,
  label,
  kind,
  onClick,
  onClose,
  shouldForceInactive,
  onMenuClick,
}: MainLinkProps) {
  return (
    <NavLink
      to={to}
      end={false}
      onClick={() => {
        onMenuClick?.();
        onClick?.();
        onClose?.();
      }}
      className={({ isActive }) => {
        const forcedInactive = shouldForceInactive?.(kind) || false;
        const active = forcedInactive ? false : isActive;

        return `flex gap-6 items-center p-3 rounded-xl transition-all duration-300 ${active
            ? "bg-gray-700 text-white"
            : "text-gray-900 hover:bg-gray-200"
          }`;
      }}
      style={{
        transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      <div className="flex gap-3 items-center w-[162px]">
        {icon}
        <p className="font-medium text-[16px] leading-normal">{label}</p>
      </div>
    </NavLink>
  );
}
