import SubLink from "./SubLink";

type MenuFocus = "REPORT" | "EXPENSE" | null;

interface SubMenuProps {
  isOpen: boolean;
  items: Array<{ label: string; to: string }>;
  focus: MenuFocus;
  onClose?: () => void;
  onMenuClick?: (focus: MenuFocus) => void;
}

export default function SubMenu({
  isOpen,
  items,
  focus,
  onClose,
  onMenuClick,
}: SubMenuProps) {
  return (
    <div
      className={`ml-4 flex flex-col ${isOpen ? "gap-1" : "gap-0"
        } overflow-hidden transition-all duration-300 ease-in-out ${isOpen
          ? "max-h-96 opacity-100 -my-1 translate-y-0"
          : "max-h-0 opacity-0 -my-1 -translate-y-2"
        }`}
    >
      {items.map((item) => (
        <SubLink
          key={item.label}
          to={item.to}
          label={item.label}
          focus={focus}
          onClose={onClose}
          onMenuClick={onMenuClick}
        />
      ))}
    </div>
  );
}
