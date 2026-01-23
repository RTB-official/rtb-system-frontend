// src/components/sidebar/SubMenu.tsx
import { useEffect, useLayoutEffect, useRef, useState } from "react";
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
  const contentRef = useRef<HTMLDivElement>(null);
  const prevIsOpenRef = useRef<boolean>(isOpen);

  // maxHeight는 number(px) 또는 "none"으로 관리
  const [maxHeight, setMaxHeight] = useState<number | "none">(isOpen ? "none" : 0);

  const measure = () => contentRef.current?.scrollHeight ?? 0;

  // ✅ 열려있는 상태에서 items가 바뀌어도 애니메이션 없이 자연스럽게(= maxHeight none 유지)
  useLayoutEffect(() => {
    if (!isOpen) return;
    // 열려있는 동안은 "none"이어서 높이 갱신이 애니메이션을 트리거하지 않음
    setMaxHeight("none");
  }, [items, isOpen]);

  // ✅ 열림/닫힘 토글에서만 애니메이션
  useEffect(() => {
    const prev = prevIsOpenRef.current;
    if (prev === isOpen) return;

    const el = contentRef.current;
    if (!el) {
      prevIsOpenRef.current = isOpen;
      return;
    }

    if (isOpen) {
      // ✅ 열기 애니메이션
      setMaxHeight(0);
      requestAnimationFrame(() => {
        const h = measure();
        setMaxHeight(h);
      });
    } else {
      // ✅ 닫기도 애니메이션 (none -> 0 점프 방지 위해 px로 고정 후 0으로)
      const h = measure();
      setMaxHeight(h);

      requestAnimationFrame(() => {
        // 강제 reflow로 전환 안정화
        el.getBoundingClientRect();
        setMaxHeight(0);
      });
    }

    prevIsOpenRef.current = isOpen;
  }, [isOpen]);


  const wrapStyle: React.CSSProperties = {
    maxHeight: maxHeight === "none" ? "none" : `${maxHeight}px`,
    overflow: "hidden",
    transition:
      "max-height 260ms cubic-bezier(0.4, 0, 0.2, 1), opacity 160ms ease",
    opacity: isOpen ? 1 : 0,
    pointerEvents: isOpen ? "auto" : "none",
    willChange: "max-height",
  };

  return (
    <div
      className="ml-3"
      style={wrapStyle}
      onTransitionEnd={(e) => {
        // max-height transition이 끝났을 때만 처리
        if (e.propertyName !== "max-height") return;

        // 열림 애니메이션이 끝났으면 maxHeight를 none으로 풀어줘서
        // 같은 하위메뉴 내 이동(items 변경)에서 애니메이션이 생기지 않게 함
        if (isOpen) {
          setMaxHeight("none");
        }
      }}
    >
      <div ref={contentRef} className="flex flex-col gap-1 py-1">
        {items.map((item) => (
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
