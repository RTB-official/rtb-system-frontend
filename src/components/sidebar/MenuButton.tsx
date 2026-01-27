// src/components/sidebar/MenuButton.tsx
import React from "react";

interface MenuButtonProps {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
}

export default function MenuButton({
  icon,
  label,
  isActive,
  onClick,
}: MenuButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "w-full flex gap-6 items-center p-3 rounded-xl",
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
      <div className="flex gap-3 items-center w-[162px]">
        {icon}
        <p className="font-medium text-[16px]">{label}</p>
      </div>
    </button>
  );
}