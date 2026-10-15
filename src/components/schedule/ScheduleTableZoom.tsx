import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useRef,
    type ReactNode,
    type Ref,
} from "react";
import useIsMobile from "../../hooks/useIsMobile";

/** Natural sheet width; must match the table's `min-w-[1280px]`. */
const SHEET_WIDTH = 1280;
/** Max zoom relative to the natural (100%) sheet size. */
const MAX_SCALE = 2;
const LOCKED_VIEWPORT =
    "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no";

function touchDistance(touches: TouchList): number {
    return Math.hypot(
        touches[0].clientX - touches[1].clientX,
        touches[0].clientY - touches[1].clientY
    );
}

function touchCenter(touches: TouchList): { x: number; y: number } {
    return {
        x: (touches[0].clientX + touches[1].clientX) / 2,
        y: (touches[0].clientY + touches[1].clientY) / 2,
    };
}

let pageZoomLockCount = 0;
let originalViewport: string | null = null;

const preventPagePinch = (event: TouchEvent) => {
    if (event.touches.length > 1) event.preventDefault();
};
const preventGesture = (event: Event) => event.preventDefault();

/**
 * Disables browser page pinch-zoom while any schedule table is mounted, so
 * two-finger gestures only zoom the table. Ref-counted for multiple tables.
 * iOS Safari ignores `user-scalable=no`, hence the touch/gesture listeners.
 */
function lockPageZoom(): () => void {
    pageZoomLockCount += 1;
    if (pageZoomLockCount === 1) {
        const meta = document.querySelector<HTMLMetaElement>(
            'meta[name="viewport"]'
        );
        if (meta) {
            originalViewport = meta.content;
            meta.content = LOCKED_VIEWPORT;
        }
        document.addEventListener("touchmove", preventPagePinch, { passive: false });
        document.addEventListener("gesturestart", preventGesture);
        document.addEventListener("gesturechange", preventGesture);
    }

    return () => {
        pageZoomLockCount -= 1;
        if (pageZoomLockCount > 0) return;
        const meta = document.querySelector<HTMLMetaElement>(
            'meta[name="viewport"]'
        );
        if (meta && originalViewport != null) meta.content = originalViewport;
        originalViewport = null;
        document.removeEventListener("touchmove", preventPagePinch);
        document.removeEventListener("gesturestart", preventGesture);
        document.removeEventListener("gesturechange", preventGesture);
    };
}

type Gesture =
    | {
          kind: "pinch";
          startDistance: number;
          startScale: number;
          /** Pinch focus in natural sheet coordinates. */
          contentX: number;
          contentY: number;
      }
    | { kind: "pan"; lastX: number; lastY: number };

type ScheduleTableZoomProps = {
    children: ReactNode;
    /** Frame element that image capture reads the table from (list page). */
    scrollerRef?: Ref<HTMLDivElement>;
};

/**
 * Mobile-only photo-viewer style frame for the wide schedule sheet: the whole
 * sheet is fitted to the screen width, two fingers (or trackpad ctrl+wheel)
 * zoom around the pinch center, and one finger pans while zoomed in.
 * Transforms are written to the DOM directly to avoid re-rendering the table.
 */
export default function ScheduleTableZoom({
    children,
    scrollerRef,
}: ScheduleTableZoomProps) {
    const isMobile = useIsMobile();
    const frameRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef({ scale: 0, fit: 0, x: 0, y: 0 });

    const setFrameNode = useCallback(
        (node: HTMLDivElement | null) => {
            frameRef.current = node;
            if (!scrollerRef) return;
            if (typeof scrollerRef === "function") scrollerRef(node);
            else scrollerRef.current = node;
        },
        [scrollerRef]
    );

    useEffect(() => {
        if (!isMobile) return;
        return lockPageZoom();
    }, [isMobile]);

    useLayoutEffect(() => {
        const frame = frameRef.current;
        const content = contentRef.current;
        if (!isMobile || !frame || !content) return;

        const view = viewRef.current;
        const isZoomed = () => view.scale > view.fit + 0.001;

        const render = () => {
            const minX = Math.min(0, frame.clientWidth - SHEET_WIDTH * view.scale);
            const minY = Math.min(
                0,
                frame.clientHeight - content.offsetHeight * view.scale
            );
            view.x = Math.min(0, Math.max(minX, view.x));
            view.y = Math.min(0, Math.max(minY, view.y));
            content.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.scale})`;
            frame.style.touchAction = isZoomed() ? "none" : "pan-y";
        };

        const layout = () => {
            const table = content.querySelector("table");
            if (!table || frame.clientWidth === 0) return;
            const wasFitted = !isZoomed();
            view.fit = Math.min(1, frame.clientWidth / SHEET_WIDTH);
            if (wasFitted || view.scale < view.fit) view.scale = view.fit;
            // Table layout height ignores the scale transform, so the frame must
            // be the fitted height. Otherwise a tall blank gap pushes the + button
            // and the next sheet far below the visible table.
            frame.style.height = `${Math.ceil(table.offsetHeight * view.fit)}px`;
            render();
        };

        const zoomAround = (
            contentX: number,
            contentY: number,
            scale: number,
            clientX: number,
            clientY: number
        ) => {
            const rect = frame.getBoundingClientRect();
            view.scale = Math.min(MAX_SCALE, Math.max(view.fit, scale));
            view.x = clientX - rect.left - contentX * view.scale;
            view.y = clientY - rect.top - contentY * view.scale;
            render();
        };

        const toContent = (clientX: number, clientY: number) => {
            const rect = frame.getBoundingClientRect();
            return {
                x: (clientX - rect.left - view.x) / view.scale,
                y: (clientY - rect.top - view.y) / view.scale,
            };
        };

        const isInFrame = (target: EventTarget | null) =>
            target instanceof Node && frame.contains(target);

        let gesture: Gesture | null = null;
        let rafId = 0;
        let pendingTouches: TouchList | null = null;

        const startPinch = (touches: TouchList) => {
            const center = touchCenter(touches);
            const point = toContent(center.x, center.y);
            gesture = {
                kind: "pinch",
                startDistance: touchDistance(touches),
                startScale: view.scale,
                contentX: point.x,
                contentY: point.y,
            };
        };

        const startPan = (touch: Touch) => {
            gesture = { kind: "pan", lastX: touch.clientX, lastY: touch.clientY };
        };

        const flush = () => {
            rafId = 0;
            const touches = pendingTouches;
            pendingTouches = null;
            if (!gesture || !touches) return;

            if (gesture.kind === "pinch" && touches.length >= 2) {
                const center = touchCenter(touches);
                zoomAround(
                    gesture.contentX,
                    gesture.contentY,
                    gesture.startScale *
                        (touchDistance(touches) / gesture.startDistance),
                    center.x,
                    center.y
                );
            } else if (gesture.kind === "pan" && touches.length === 1) {
                const touch = touches[0];
                view.x += touch.clientX - gesture.lastX;
                view.y += touch.clientY - gesture.lastY;
                gesture.lastX = touch.clientX;
                gesture.lastY = touch.clientY;
                render();
            }
        };

        const onTouchStart = (event: TouchEvent) => {
            const touches = event.touches;
            if (touches.length === 2) {
                if (!Array.from(touches).some((t) => isInFrame(t.target))) return;
                event.preventDefault();
                startPinch(touches);
            } else if (touches.length === 1 && isZoomed() && isInFrame(touches[0].target)) {
                startPan(touches[0]);
            }
        };

        const onTouchMove = (event: TouchEvent) => {
            if (!gesture) return;
            event.preventDefault();
            pendingTouches = event.touches;
            if (!rafId) rafId = requestAnimationFrame(flush);
        };

        const onTouchEnd = (event: TouchEvent) => {
            if (!gesture) return;
            if (event.touches.length === 1 && isZoomed()) startPan(event.touches[0]);
            else if (event.touches.length === 0) gesture = null;
        };

        const onWheel = (event: WheelEvent) => {
            if (!isInFrame(event.target)) return;
            if (event.ctrlKey) {
                event.preventDefault();
                const point = toContent(event.clientX, event.clientY);
                zoomAround(
                    point.x,
                    point.y,
                    view.scale * Math.exp(-event.deltaY * 0.01),
                    event.clientX,
                    event.clientY
                );
            } else if (isZoomed()) {
                event.preventDefault();
                view.x -= event.deltaX;
                view.y -= event.deltaY;
                render();
            }
        };

        const resetNativeScroll = () => {
            frame.scrollLeft = 0;
            frame.scrollTop = 0;
        };

        view.scale = 0;
        view.fit = 0;
        view.x = 0;
        view.y = 0;
        layout();

        const table = content.querySelector("table");
        const observer = new ResizeObserver(layout);
        if (table) observer.observe(table);
        window.addEventListener("resize", layout);
        frame.addEventListener("scroll", resetNativeScroll);
        document.addEventListener("touchstart", onTouchStart, { passive: false });
        document.addEventListener("touchmove", onTouchMove, { passive: false });
        document.addEventListener("touchend", onTouchEnd);
        document.addEventListener("touchcancel", onTouchEnd);
        document.addEventListener("wheel", onWheel, { passive: false });
        return () => {
            if (rafId) cancelAnimationFrame(rafId);
            observer.disconnect();
            window.removeEventListener("resize", layout);
            frame.removeEventListener("scroll", resetNativeScroll);
            document.removeEventListener("touchstart", onTouchStart);
            document.removeEventListener("touchmove", onTouchMove);
            document.removeEventListener("touchend", onTouchEnd);
            document.removeEventListener("touchcancel", onTouchEnd);
            document.removeEventListener("wheel", onWheel);
            // Height and pan/zoom are written straight to the DOM. Clear them
            // when leaving mobile, or the desktop table stays at the shrunk size.
            frame.style.height = "";
            frame.style.touchAction = "";
            content.style.transform = "";
            view.scale = 0;
            view.fit = 0;
            view.x = 0;
            view.y = 0;
        };
    }, [isMobile]);

    if (!isMobile) {
        return (
            <div
                ref={setFrameNode}
                className="w-full overflow-x-auto rounded-sm bg-white shadow-sm"
            >
                {children}
            </div>
        );
    }

    return (
        <div
            ref={setFrameNode}
            className="relative w-full overflow-hidden rounded-sm bg-white shadow-sm"
        >
            <div
                ref={contentRef}
                data-schedule-zoom=""
                className="absolute left-0 top-0 origin-top-left"
                style={{ width: SHEET_WIDTH }}
            >
                {children}
            </div>
        </div>
    );
}
