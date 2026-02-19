import { useEffect, useRef, useState } from "react";

export function useChartSize(dataLength: number) {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const [chartSize, setChartSize] = useState({ width: 0, height: 300 });

    useEffect(() => {
        if (!dataLength) return;

        let resizeTimer: NodeJS.Timeout | null = null;
        let lastWidth = 0;

        const updateChartSize = () => {
            if (!chartContainerRef.current) return;

            const rect = chartContainerRef.current.getBoundingClientRect();
            const newWidth = Math.round(rect.width);

            if (newWidth > 0 && Math.abs(lastWidth - newWidth) >= 10) {
                lastWidth = newWidth;
                setChartSize({ width: newWidth, height: 300 });
            }
        };

        if (chartContainerRef.current) {
            const rect = chartContainerRef.current.getBoundingClientRect();
            const width = Math.round(rect.width);
            if (width > 0) {
                lastWidth = width;
                setChartSize({ width, height: 300 });
            } else {
                const timeout = setTimeout(() => {
                    updateChartSize();
                }, 100);
                return () => clearTimeout(timeout);
            }
        }

        const handleResize = () => {
            if (resizeTimer) clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                updateChartSize();
                resizeTimer = null;
            }, 500);
        };

        window.addEventListener("resize", handleResize, { passive: true });

        return () => {
            window.removeEventListener("resize", handleResize);
            if (resizeTimer) clearTimeout(resizeTimer);
        };
    }, [dataLength]);

    return { chartContainerRef, chartSize };
}
