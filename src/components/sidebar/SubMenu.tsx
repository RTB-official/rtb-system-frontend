// src/components/sidebar/SubMenu.tsx
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import SubLink from "./SubLink";
import { shouldSkipSubMenuEnter } from "./subMenuEnterAnimation";

type MenuFocus = "SCHEDULE" | "REPORT" | "TBM" | "EXPENSE" | "INVOICE" | null;

interface SubMenuProps {
  isOpen: boolean;
  items: Array<{ label: string; to: string }>;
  focus: Exclude<MenuFocus, null>;
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
  const contentRef = useRef<HTMLDivElement>(null);

  // 같은 탭 브랜치 이동(재마운트)만 열림 애니메이션 생략. 그 외에는 항상 애니메이션.
  const [skipEnter] = useState(() => isOpen && shouldSkipSubMenuEnter(focus));

  const prevIsOpenRef = useRef(skipEnter);
  const [maxHeight, setMaxHeight] = useState<number | "none">(skipEnter ? "none" : 0);
  const [renderItems, setRenderItems] = useState(items);

  const measure = () => contentRef.current?.scrollHeight ?? 0;

  useLayoutEffect(() => {
    if (!isOpen) return;

    if (items.length > 0) {
      setRenderItems(items);
    }

    // 이미 열린 뒤 items만 바뀐 경우에만 높이 free (열림 직후 애니메이션은 useEffect에 맡김)
    if (prevIsOpenRef.current) {
      setMaxHeight("none");
    }
  }, [items, isOpen]);

  useEffect(() => {
    const prev = prevIsOpenRef.current;
    if (prev === isOpen) return;

    const el = contentRef.current;
    if (!el) {
      if (isOpen) setMaxHeight("none");
      prevIsOpenRef.current = isOpen;
      return;
    }

    if (isOpen) {
      setMaxHeight(0);
      requestAnimationFrame(() => {
        setMaxHeight(measure());
      });
    } else {
      const h = measure();
      setMaxHeight(h);
      requestAnimationFrame(() => {
        el.getBoundingClientRect();
        requestAnimationFrame(() => {
          setMaxHeight(0);
        });
      });
    }

    prevIsOpenRef.current = isOpen;
  }, [isOpen]);

  const visualOpen = maxHeight === "none" || (typeof maxHeight === "number" && maxHeight > 0);

  const wrapStyle: React.CSSProperties = {
    maxHeight: maxHeight === "none" ? "none" : `${maxHeight}px`,
    overflow: "hidden",
    transition:
      "max-height 260ms cubic-bezier(0.4, 0, 0.2, 1), opacity 260ms ease, transform 260ms ease",
    opacity: visualOpen ? 1 : 0,
    transform: visualOpen ? "translateY(0px)" : "translateY(-4px)",
    pointerEvents: isOpen ? "auto" : "none",
    willChange: "max-height, opacity, transform",
  };

  return (
    <div
      className="ml-3"
      style={wrapStyle}
      onTransitionEnd={(e) => {
        if (e.propertyName !== "max-height") return;
        if (isOpen) {
          setMaxHeight("none");
        } else {
          setRenderItems(items);
        }
      }}
    >
      <div ref={contentRef} className="flex flex-col gap-0.5 md:gap-1 py-0.5 md:py-1">
        {renderItems.map((item) => (
          <SubLink
            key={item.to}
            to={item.to}
            label={item.label}
            focus={focus}
            onClose={onClose}
            onMenuClick={onMenuClick}
          />
        ))}
      </div>
    </div>
  );
}
