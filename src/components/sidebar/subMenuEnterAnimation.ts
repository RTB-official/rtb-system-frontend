type MenuFocus = "SCHEDULE" | "REPORT" | "TBM" | "EXPENSE" | "INVOICE";

/** 같은 탭 브랜치 이동 시 재마운트 열림 애니메이션을 건너뛰기 위한 플래그 */
let skipEnterFor: MenuFocus | null = null;
let clearTimer: ReturnType<typeof setTimeout> | null = null;

export function markSubMenuSkipEnter(focus: MenuFocus) {
  skipEnterFor = focus;
  if (clearTimer) clearTimeout(clearTimer);
  // 다음 페이지 Sidebar 마운트(Strict Mode 포함)까지 유지 후 해제
  clearTimer = setTimeout(() => {
    if (skipEnterFor === focus) skipEnterFor = null;
    clearTimer = null;
  }, 500);
}

export function shouldSkipSubMenuEnter(focus: MenuFocus): boolean {
  return skipEnterFor === focus;
}
