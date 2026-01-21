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
      onClick={onClick}
      className={`w-full flex gap-6 items-center p-3 rounded-xl transition-colors duration-200 ease-in-out ${isActive
          ? "bg-gray-700 text-white"
          : "text-gray-900 hover:bg-gray-200"
        }`}
    >
      <div className="flex gap-3 items-center w-[162px]">
        {icon}
        <p className="font-medium text-[16px] leading-normal">{label}</p>
      </div>
    </button>
  );
}
