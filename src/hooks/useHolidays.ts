import { useState, useEffect } from "react";

const HOLIDAY_API_KEY =
    "cac7adf961a1b55472fa90319e4cb89dde6c04242edcb3d3970ae9e09c931e98";
const HOLIDAY_API_ENDPOINT =
    "https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo";

/**
 * 공휴일 데이터를 가져오는 훅
 * 로딩을 차단하지 않고 백그라운드에서 로드합니다.
 */
export function useHolidays(year: number, month: number) {
    const [holidays, setHolidays] = useState<Record<string, string>>({});

    useEffect(() => {
        const fetchYearHolidays = async (
            targetYear: number,
            targetMonth: number
        ) => {
            try {
                const monthStr = String(targetMonth + 1).padStart(2, "0");
                const url = `${HOLIDAY_API_ENDPOINT}?serviceKey=${HOLIDAY_API_KEY}&solYear=${targetYear}&solMonth=${monthStr}&_type=json&numOfRows=100`;

                const response = await fetch(url);
                const data = await response.json();

                const items = data.response?.body?.items?.item;
                if (items) {
                    const itemList = Array.isArray(items) ? items : [items];
                    setHolidays((prev) => {
                        const newHolidays = { ...prev };
                        itemList.forEach((item: any) => {
                            const dateStr = String(item.locdate);
                            const formattedDate = `${dateStr.slice(
                                0,
                                4
                            )}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
                            newHolidays[formattedDate] = item.dateName;
                        });
                        return newHolidays;
                    });
                }
            } catch (error) {
                // 공휴일 실패는 무시 (로딩을 차단하지 않음)
            }
        };

        // 현재 월만 즉시 로드
        fetchYearHolidays(year, month);

        // 나머지 월은 완전히 백그라운드에서 로드 (로딩 차단 안 함)
        setTimeout(() => {
            const allMonths = Array.from({ length: 12 }, (_, i) => i).filter(
                (m) => m !== month
            );
            allMonths.forEach((m) => {
                setTimeout(() => {
                    const monthStr = String(m + 1).padStart(2, "0");
                    const url = `${HOLIDAY_API_ENDPOINT}?serviceKey=${HOLIDAY_API_KEY}&solYear=${year}&solMonth=${monthStr}&_type=json&numOfRows=100`;
                    fetch(url)
                        .then((res) => res.json())
                        .then((data) => {
                            const items = data.response?.body?.items?.item;
                            if (items) {
                                const itemList = Array.isArray(items)
                                    ? items
                                    : [items];
                                setHolidays((prev) => {
                                    const newHolidays = { ...prev };
                                    itemList.forEach((item: any) => {
                                        const dateStr = String(item.locdate);
                                        const formattedDate = `${dateStr.slice(
                                            0,
                                            4
                                        )}-${dateStr.slice(
                                            4,
                                            6
                                        )}-${dateStr.slice(6, 8)}`;
                                        newHolidays[formattedDate] =
                                            item.dateName;
                                    });
                                    return newHolidays;
                                });
                            }
                        })
                        .catch(() => {});
                }, Math.random() * 2000); // 랜덤 지연으로 서버 부하 분산
            });
        }, 1000);
    }, [year, month]);

    return holidays;
}

