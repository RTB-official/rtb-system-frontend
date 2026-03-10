// src/components/sidebar/MenuButton.tsx
import React from "react";

interface MenuButtonProps {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
  showDot?: boolean;
}

export default function MenuButton({
  icon,
  label,
  isActive,
  onClick,
  showDot,
}: MenuButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "w-full flex gap-4 md:gap-6 items-center p-2 md:p-3 rounded-xl relative",
        "transition-all duration-300",
        "active:scale-[0.99]",
        isActive
          ? "bg-gray-700 text-white shadow-sm"
          : "text-gray-900 hover:bg-gray-200",
      ].join(" ")}
      style={{
        transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      <div className="flex gap-2 md:gap-3 items-center flex-1 min-w-0 relative">
        <div className="shrink-0 w-5 h-5 md:w-6 md:h-6 flex items-center justify-center">
          {icon}
        </div>
        <p className="font-medium text-[13px] md:text-[16px] relative truncate">
          {label}
          {showDot && (
            <span className="absolute -right-2 md:-right-2.5 w-1 h-1 md:w-1.5 md:h-1.5 bg-red-500 rounded-full" />
          )}
        </p>
      </div>
    </button>
  );
}