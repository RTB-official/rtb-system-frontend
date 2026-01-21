import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface UseCalendarWheelNavigationOptions {
    onPrevMonth: () => void;
    onNextMonth: () => void;
    sensitivity?: number;
    threshold?: number;
    previewDistance?: number;
    inertiaDelay?: number;
    animationDuration?: number;
}

interface UseCalendarWheelNavigationResult {
    handleWheel: (event: React.WheelEvent) => void;
    wheelRef: React.RefObject<HTMLDivElement>;
    motionStyle: React.CSSProperties;
    isTransitioning: boolean;
}

export function useCalendarWheelNavigation({
    onPrevMonth,
    onNextMonth,
    sensitivity = 0.32,
    threshold = 120,
    previewDistance = 180,
    inertiaDelay = 140,
    animationDuration = 260,
}: UseCalendarWheelNavigationOptions): UseCalendarWheelNavigationResult {
    const [offset, setOffset] = useState(0);
    const offsetRef = useRef(0);
    const [isTransitioning, setIsTransitioning] = useState(false);
    const isTransitioningRef = useRef(false);

    const inertiaTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
        null
    );
    const inertiaFrameRef = useRef<number | null>(null);

    const clamp = useCallback(
        (value: number) =>
            Math.max(-previewDistance, Math.min(previewDistance, value)),
        [previewDistance]
    );

    const clearInertia = useCallback(() => {
        if (inertiaTimeoutRef.current) {
            clearTimeout(inertiaTimeoutRef.current);
            inertiaTimeoutRef.current = null;
        }
        if (inertiaFrameRef.current) {
            cancelAnimationFrame(inertiaFrameRef.current);
            inertiaFrameRef.current = null;
        }
    }, []);

    const startInertia = useCallback(() => {
        clearInertia();
        inertiaFrameRef.current = requestAnimationFrame(function step() {
            if (isTransitioningRef.current) {
                inertiaFrameRef.current = null;
                return;
            }

            offsetRef.current *= 0.78;

            if (Math.abs(offsetRef.current) < 0.75) {
                offsetRef.current = 0;
                setOffset(0);
                inertiaFrameRef.current = null;
                return;
            }

            setOffset(offsetRef.current);
            inertiaFrameRef.current = requestAnimationFrame(step);
        });
    }, [clearInertia]);

    const scheduleInertia = useCallback(() => {
        if (isTransitioningRef.current) return;
        if (inertiaTimeoutRef.current) {
            clearTimeout(inertiaTimeoutRef.current);
        }
        inertiaTimeoutRef.current = setTimeout(() => {
            startInertia();
        }, inertiaDelay);
    }, [inertiaDelay, startInertia]);

    const triggerMonthChange = useCallback(
        (direction: "next" | "prev") => {
            clearInertia();
            isTransitioningRef.current = true;
            setIsTransitioning(true);

            const exitOffset =
                direction === "next" ? previewDistance : -previewDistance;
            const enterOffset =
                direction === "next"
                    ? -previewDistance * 0.4
                    : previewDistance * 0.4;
            const halfDuration = animationDuration * 0.55;
            const settleDuration = animationDuration * 0.45;

            offsetRef.current = exitOffset;
            setOffset(exitOffset);

            const completeTransition = () => {
                offsetRef.current = 0;
                setOffset(0);
                setTimeout(() => {
                    isTransitioningRef.current = false;
                    setIsTransitioning(false);
                }, settleDuration);
            };

            setTimeout(() => {
                if (direction === "next") {
                    onNextMonth();
                } else {
                    onPrevMonth();
                }

                offsetRef.current = enterOffset;
                setOffset(enterOffset);

                requestAnimationFrame(completeTransition);
            }, halfDuration);
        },
        [
            animationDuration,
            clearInertia,
            onNextMonth,
            onPrevMonth,
            previewDistance,
        ]
    );

    const wheelRef = useRef<HTMLDivElement>(null);

    const handleWheel = useCallback(
        (event: WheelEvent) => {
            event.preventDefault();
            if (isTransitioningRef.current) return;

            const nextValue = clamp(
                offsetRef.current + event.deltaY * sensitivity
            );
            offsetRef.current = nextValue;
            setOffset(nextValue);

            if (Math.abs(nextValue) >= threshold) {
                triggerMonthChange(nextValue > 0 ? "next" : "prev");
                return;
            }

            scheduleInertia();
        },
        [clamp, sensitivity, threshold, triggerMonthChange, scheduleInertia]
    );

    // 직접 이벤트 리스너 등록 (passive: false로 설정)
    useEffect(() => {
        const element = wheelRef.current;
        if (!element) return;

        element.addEventListener("wheel", handleWheel, { passive: false });

        return () => {
            element.removeEventListener("wheel", handleWheel);
            clearInertia();
        };
    }, [handleWheel, clearInertia]);

    const motionStyle = useMemo(() => {
        const normalized = Math.min(1, Math.abs(offset) / previewDistance);
        const scale = 1 - normalized * 0.008;
        const opacity = 1 - normalized * 0.1;

        return {
            transform: `translateY(${-offset}px) scale(${scale})`,
            opacity,
        };
    }, [offset, previewDistance]);

    return {
        handleWheel: handleWheel as unknown as (event: React.WheelEvent) => void, // 타입 호환성을 위한 캐스팅
        wheelRef,
        motionStyle,
        isTransitioning,
    };
}

export default useCalendarWheelNavigation;
