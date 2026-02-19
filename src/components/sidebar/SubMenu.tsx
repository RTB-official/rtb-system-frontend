// src/components/sidebar/SubMenu.tsx
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import SubLink from "./SubLink";

type MenuFocus = "REPORT" | "TBM" | "EXPENSE" | null;

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
  const [renderItems, setRenderItems] = useState(items);

  const measure = () => contentRef.current?.scrollHeight ?? 0;

  // ✅ 열려있는 상태에서 items가 바뀌어도 애니메이션 없이 자연스럽게(= maxHeight none 유지)
  useLayoutEffect(() => {
    if (!isOpen) return;

    // ✅ 열려있는 동안 items가 "빈 배열로 잠깐 바뀌는 프레임"이 생기면
    //    닫힘 애니메이션이 사라지므로, empty로는 renderItems를 덮어쓰지 않는다.
    if (items.length > 0) {
      setRenderItems(items);
    }

    // 열려있는 동안은 "none"이어서 높이 갱신이 애니메이션을 트리거하지 않음
    setMaxHeight("none");
  }, [items, isOpen]);

  // ✅ 열림/닫힘 토글에서만 애니메이션
  useEffect(() => {
    const prev = prevIsOpenRef.current;
    if (prev === isOpen) return;

    const el = contentRef.current;
    if (!el) {
      if (isOpen) {
        // 렌더 직후 ref가 아직 없을 수 있어, 즉시 표시로 처리
        setMaxHeight("none");
      }
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
      // ✅ 닫기 시작 시점: renderItems는 유지한 채로 높이 측정/애니메이션
      // (부모 items가 비어도 contentRef는 renderItems 기준으로 남아있게 됨)
      const h = measure();
      setMaxHeight(h);


      requestAnimationFrame(() => {
        // 강제 reflow로 전환 안정화
        el.getBoundingClientRect();

        // ✅ 한 프레임 더 보장해서 transition 스킵 방지
        requestAnimationFrame(() => {
          setMaxHeight(0);
        });
      });
    }


    prevIsOpenRef.current = isOpen;
  }, [isOpen]);


  // ✅ 시각 효과는 isOpen이 아니라 "실제 높이 상태" 기준으로 주면
  //    items가 바뀌는 상황에서도 닫힘 애니메이션이 안정적으로 보임
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
          // ✅ 열림 끝: 높이 free
          setMaxHeight("none");
        } else {
          // ✅ 닫힘 끝: 렌더 아이템 정리 (부모 items 반영)
          setRenderItems(items);
          // (원하면 완전 정리하려면 아래처럼도 가능)
          // setRenderItems([]);
        }
      }}
    >
      <div ref={contentRef} className="flex flex-col gap-1 py-1">
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
