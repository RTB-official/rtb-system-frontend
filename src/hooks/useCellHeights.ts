import { useEffect, useState, useRef, useCallback } from "react";

/**
 * 캘린더 셀 높이 측정 Hook
 */
export function useCellHeights(
    cellRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>,
    weeks: { date: Date; inMonth: boolean }[][]
) {
    const [cellHeights, setCellHeights] = useState<Record<string, number>>({});

    // 셀 높이 변경 핸들러 (useCallback으로 메모이제이션)
    const handleCellHeightChange = useCallback((dateKey: string, height: number) => {
        setCellHeights((prev) => {
            // 높이가 실제로 변경되었을 때만 업데이트
            if (prev[dateKey] === height) {
                return prev;
            }
            return {
                ...prev,
                [dateKey]: height,
            };
        });
    }, []);

    // 셀 높이 측정을 위한 ResizeObserver
    useEffect(() => {
        const observer = new ResizeObserver((entries) => {
            const newHeights: Record<string, number> = {};
            for (let entry of entries) {
                if (entry.target instanceof HTMLElement) {
                    const dateKey = entry.target.dataset.dateKey;
                    if (dateKey) {
                        newHeights[dateKey] = entry.contentRect.height;
                    }
                }
            }
            if (Object.keys(newHeights).length > 0) {
                setCellHeights((prev) => ({
                    ...prev,
                    ...newHeights,
                }));
            }
        });

        // 셀 refs가 설정될 때까지 대기 후 관찰 시작
        const setupObserver = () => {
            let observedCount = 0;
            const refs = cellRefs.current;
            
            // 모든 셀 관찰
            for (const dateKey in refs) {
                const cell = refs[dateKey];
                if (cell) {
                    observer.observe(cell);
                    observedCount++;
                }
            }
            
            // 셀이 없으면 다음 틱에 다시 시도 (최대 10번)
            if (observedCount === 0) {
                let retryCount = 0;
                const retryInterval = setInterval(() => {
                    retryCount++;
                    const refs = cellRefs.current;
                    let count = 0;
                    for (const dateKey in refs) {
                        const cell = refs[dateKey];
                        if (cell) {
                            observer.observe(cell);
                            count++;
                        }
                    }
                    if (count > 0 || retryCount >= 10) {
                        clearInterval(retryInterval);
                    }
                }, 100);
            }
        };

        // 다음 틱에 실행하여 DOM이 완전히 렌더링된 후 관찰 시작
        setTimeout(setupObserver, 0);

        return () => {
            observer.disconnect();
        };
    }, [weeks, cellRefs]);

    return { cellHeights, handleCellHeightChange };
}

