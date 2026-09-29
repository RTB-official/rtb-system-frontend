type NavigationGuard = (to: string) => boolean;

let guard: NavigationGuard | null = null;

/** 페이지 이탈 가드. true면 이동을 막고, false면 그대로 진행한다. */
export function setNavigationGuard(next: NavigationGuard | null) {
    guard = next;
}

export function runNavigationGuard(to: string): boolean {
    return guard?.(to) ?? false;
}
