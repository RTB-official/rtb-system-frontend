import { useEffect, useState } from "react";
import { fetchHolidayDateSet } from "../utils/holidayDates";

/**
 * 대상 날짜 목록에 대해 공휴일 Set을 로드합니다.
 * 인보이스 생성 페이지와 동일한 API·캘린더 키워드 방식을 사용합니다.
 */
export function useHolidayDateSet(targetDates: string[]): Set<string> {
    const [holidayDateSet, setHolidayDateSet] = useState<Set<string>>(
        () => new Set()
    );

    const targetKey = targetDates.length > 0 ? targetDates.slice().sort().join("|") : "";

    useEffect(() => {
        if (!targetKey) {
            setHolidayDateSet(new Set());
            return;
        }

        let cancelled = false;

        fetchHolidayDateSet(targetDates)
            .then((set) => {
                if (!cancelled) {
                    setHolidayDateSet(set);
                }
            })
            .catch((error) => {
                console.error("휴일 데이터 로드 실패:", error);
                if (!cancelled) {
                    setHolidayDateSet(new Set());
                }
            });

        return () => {
            cancelled = true;
        };
    }, [targetKey]);

    return holidayDateSet;
}
