/**
 * 터치 기기에서 sticky :hover(첫 탭=hover, 둘째=클릭)를 막기 위해
 * html.no-hover 클래스를 토글한다. CSS @custom-variant hover가 이를 본다.
 */
export function installTouchHoverGuard() {
    if (typeof window === "undefined") return;

    const root = document.documentElement;
    const coarse =
        window.matchMedia("(pointer: coarse)").matches ||
        window.matchMedia("(hover: none)").matches;
    if (coarse) {
        root.classList.add("no-hover");
    }

    const onTouchStart = () => {
        root.classList.add("no-hover");
    };

    const onMouseMove = (event: MouseEvent) => {
        // 실제 마우스 이동만 인정 (터치 후 합성 mousemove 제외)
        if (event.movementX === 0 && event.movementY === 0) return;
        if (event.sourceCapabilities?.firesTouchEvents) return;
        root.classList.remove("no-hover");
    };

    window.addEventListener("touchstart", onTouchStart, {
        capture: true,
        passive: true,
    });
    window.addEventListener("mousemove", onMouseMove, { passive: true });
}
