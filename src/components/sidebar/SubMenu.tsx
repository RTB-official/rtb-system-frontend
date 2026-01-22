// src/components/sidebar/SubMenu.tsx
import { useEffect, useRef, useState } from "react";
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
  const prevOpenRef = useRef<boolean>(isOpen);
  const [shouldRender, setShouldRender] = useState<boolean>(isOpen);
  const [maxH, setMaxH] = useState<number>(0);
  const [isAnimating, setIsAnimating] = useState<boolean>(false);

  // 높이 측정
  const measure = () => contentRef.current?.scrollHeight ?? 0;

  // 초기 렌더링 시 높이 설정
  useEffect(() => {
    if (isOpen && shouldRender && !isAnimating) {
      const h = measure();
      if (h > 0 && maxH === 0) {
        setMaxH(h);
      }
    }
  }, []);

  // isOpen 상태가 변경될 때만 애니메이션 실행
  useEffect(() => {
    const prevOpen = prevOpenRef.current;

    // 같은 상태면 높이만 업데이트 (같은 서브메뉴 내 이동)
    if (prevOpen === isOpen) {
      if (isOpen && shouldRender && !isAnimating) {
        requestAnimationFrame(() => {
          const h = measure();
          if (h > 0 && h !== maxH) {
            setMaxH(h);
          }
        });
      }
      return;
    }

    // 상태 변경 감지 - prevOpenRef를 먼저 업데이트하지 않고 애니메이션 실행
    const wasOpen = prevOpen;
    const isNowOpen = isOpen;

    // 열림/닫힘 상태 변경 시 애니메이션 실행
    if (isNowOpen && !wasOpen) {
      // 열림: 애니메이션 실행
      setShouldRender(true);
      setIsAnimating(true);
      setMaxH(0);

      requestAnimationFrame(() => {
        const h = measure();
        if (h > 0) {
          setMaxH(h);
        }

        setTimeout(() => {
          setIsAnimating(false);
          prevOpenRef.current = isOpen;
        }, 300);
      });
    } else if (!isNowOpen && wasOpen) {
      // 닫힘: 애니메이션 실행 (다른 메뉴로 이동할 때 포함)
      const h = measure();
      if (h > 0) {
        setIsAnimating(true);
        setMaxH(h);

        // 더 부드러운 닫힘을 위해 약간의 지연 후 애니메이션 시작
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setMaxH(0);

            setTimeout(() => {
              setShouldRender(false);
              setIsAnimating(false);
              prevOpenRef.current = isOpen;
            }, 600);
          });
        });
      } else {
        // 높이가 0이면 즉시 닫기
        setShouldRender(false);
        prevOpenRef.current = isOpen;
      }
    } else {
      // 예상치 못한 경우
      prevOpenRef.current = isOpen;
    }
  }, [isOpen, shouldRender, isAnimating, maxH]);

  // 열려있을 때 높이 동기화 (내부 항목 변경 시) - 애니메이션 없이
  // items가 변경되어도 isOpen이 true로 유지되면 애니메이션 없이 높이만 업데이트
  useEffect(() => {
    if (isOpen && shouldRender && !isAnimating && prevOpenRef.current === isOpen) {
      // requestAnimationFrame을 사용하여 부드럽게 업데이트
      requestAnimationFrame(() => {
        const h = measure();
        if (h > 0 && h !== maxH) {
          // 높이가 변경되었을 때만 업데이트 (애니메이션 없이)
          setMaxH(h);
        }
      });
    }
  }, [items, isOpen, shouldRender, isAnimating, maxH]);

  if (!shouldRender) return null;

  const wrapStyle: React.CSSProperties = isAnimating
    ? {
      maxHeight: maxH,
      overflow: "hidden",
      transition: "max-height 600ms cubic-bezier(0.4, 0, 0.2, 1)",
    }
    : maxH > 0
      ? {
        maxHeight: maxH,
        overflow: "visible",
        transition: "none", // 애니메이션 없이 즉시 적용
      }
      : {
        maxHeight: "none",
        overflow: "visible",
      };

  return (
    <div className="ml-3" style={wrapStyle}>
      <div ref={contentRef} className="flex flex-col gap-1">
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