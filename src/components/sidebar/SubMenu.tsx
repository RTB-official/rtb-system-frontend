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

type Phase = "CLOSED" | "OPENING" | "OPEN" | "CLOSING";

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
  const [phase, setPhase] = useState<Phase>(isOpen ? "OPEN" : "CLOSED");
  const [maxH, setMaxH] = useState<number>(0);

  // 높이 측정 (필요할 때만)
  const measure = () => contentRef.current?.scrollHeight ?? 0;

  // open 상태가 바뀔 때만 애니메이션 "시퀀스"를 탄다
  useEffect(() => {
    const prevOpen = prevOpenRef.current;
    prevOpenRef.current = isOpen;

    // ✅ 같은 open 상태에서 라우트만 바뀌는 경우(= 하위메뉴 내부 이동)
    // -> 애니메이션 절대 재실행 안 함
    if (prevOpen === isOpen) return;

    if (isOpen) {
      // CLOSED -> OPENING
      setShouldRender(true);
      setPhase("OPENING");

      // 0에서 시작
      setMaxH(0);

      // 다음 프레임에 실제 높이로 확장
      requestAnimationFrame(() => {
        const h = measure();
        setMaxH(h);

        // 열림 애니메이션 끝나면 max-height 제한을 풀어 OPEN 상태로 고정
        window.setTimeout(() => {
          setPhase("OPEN");
        }, 220);
      });
    } else {
      // OPEN -> CLOSING
      const h = measure();
      setPhase("CLOSING");

      // 현재 높이를 명시하고
      setMaxH(h);

      // 다음 프레임에 0으로 닫기
      requestAnimationFrame(() => {
        setMaxH(0);

        window.setTimeout(() => {
          setPhase("CLOSED");
          setShouldRender(false);
        }, 220);
      });
    }
  }, [isOpen]);

  // OPEN 상태일 때는 max-height를 풀어둬서(=none) 내부 이동/리렌더 시 애니메이션 재발동 방지
  // (phase가 OPEN이면 스타일에서 maxHeight를 undefined로 처리)
  useLayoutEffect(() => {
    if (phase !== "OPEN") return;
    // OPEN으로 들어올 때 혹시라도 height가 변했으면, 그냥 즉시 반영(애니메이션 없이)
    // max-height를 쓰지 않으니 사실상 영향 없음. 안전장치 느낌.
  }, [phase, items]);

  if (!shouldRender) return null;

  const wrapStyle: React.CSSProperties =
    phase === "OPEN"
      ? {
          // ✅ 열린 상태는 제한을 풀어서 내부 이동에도 전환이 안 생김
          maxHeight: "none",
          overflow: "visible",
        }
      : {
          maxHeight: maxH,
          overflow: "hidden",
          transition: "max-height 220ms ease",
        };

  const innerClass =
    phase === "OPEN"
      ? "flex flex-col gap-1 opacity-100 translate-y-0"
      : [
          "flex flex-col gap-1",
          "transition-[opacity,transform] duration-150 ease-out",
          isOpen ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1 pointer-events-none",
        ].join(" ");

  return (
    <div className="ml-4 -my-1" style={wrapStyle}>
      <div ref={contentRef} className={innerClass}>
        {items.map((item) => (
          <SubLink
            key={item.to} // ✅ 라우트 이동 때 재마운트/깜빡임 최소화
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