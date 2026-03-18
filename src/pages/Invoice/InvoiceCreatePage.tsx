// src/pages/Invoice/InvoiceCreatePage.tsx
import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/common/Header";
import { getWorkLogById, type WorkLogFullData } from "../../lib/workLogApi";
import { getCalendarEvents } from "../../lib/dashboardApi";
import { useToast } from "../../components/ui/ToastProvider";

interface TimesheetRow {
    rowId: string;
    date: string; // YYYY-MM-DD
    day: string; // 요일 (Mon, Tue, etc.)
    dateFormatted: string; // DD.MMM 형식
    timeFrom: string; // HH 형식
    timeTo: string; // HH 형식
    totalHours: number;
    weekdayNormal: number;
    weekdayAfter: number;
    weekendNormal: number;
    weekendAfter: number;
    travelWeekday: number;
    travelWeekend: number;
    description: string;
    hideDayDate?: boolean;
}

type WorkLogEntryItem = WorkLogFullData["entries"][number];

type InvoiceTimesheetEntry = WorkLogEntryItem & {
    workLogId: number;
    location: string | null;
};

const HOLIDAY_API_KEY =
    "cac7adf961a1b55472fa90319e4cb89dde6c04242edcb3d3970ae9e09c931e98";
const HOLIDAY_API_ENDPOINT =
    "https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo";

export default function InvoiceCreatePage() {
    const [searchParams] = useSearchParams();
    const workLogIdsParam =
        searchParams.get("workLogIds") ?? searchParams.get("workLogId");
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [workLogDataList, setWorkLogDataList] = useState<WorkLogFullData[]>([]);
    const [timesheetRows, setTimesheetRows] = useState<TimesheetRow[]>([]);
    const [holidayDateSet, setHolidayDateSet] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(false);
    const { showError } = useToast();

    const toDateSafe = (date: string, time: string): Date => {
        const [hhStr, mmStr] = time.split(":");
        const hh = Number(hhStr);
        const mm = Number(mmStr ?? "0");

        if (hh === 24) {
            const nextDay = new Date(`${date}T00:00:00`);
            nextDay.setDate(nextDay.getDate() + 1);
            nextDay.setHours(0, mm, 0, 0);
            return nextDay;
        }

        return new Date(
            `${date}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00`
        );
    };

    const formatTimeHHMM = (date: Date): string => {
        return `${String(date.getHours()).padStart(2, "0")}:${String(
            date.getMinutes()
        ).padStart(2, "0")}`;
    };

    const shiftTimeByHours = (
        date: string,
        time: string,
        hours: number
    ): string => {
        const shifted = toDateSafe(date, time);
        shifted.setMinutes(shifted.getMinutes() + hours * 60);
        return formatTimeHHMM(shifted);
    };

    const getPrimaryLocation = (location: string | null): string => {
        return location?.split(",")[0].trim() ?? "";
    };

    const getHomeTravelHours = (location: string | null): number | null => {
        const primaryLocation = getPrimaryLocation(location);

        if (
            primaryLocation === "HD중공업(해양)" ||
            primaryLocation === "HD미포" ||
            primaryLocation === "HHI" ||
            primaryLocation === "HMD"
        ) {
            return 2;
        }

        if (primaryLocation === "HD삼호" || primaryLocation === "HSHI") {
            return 4;
        }

        if (
            ["PNC", "PNIT", "HPNT", "BNCT", "HJNC"].includes(primaryLocation)
        ) {
            return 1;
        }

        return null;
    };

    const getAdjustedTravelTimes = (
        entry: InvoiceTimesheetEntry
    ): Pick<InvoiceTimesheetEntry, "timeFrom" | "timeTo"> => {
        const originalTimeFrom = entry.timeFrom || "";
        const originalTimeTo = entry.timeTo || "";

        if (
            entry.descType !== "이동" ||
            !entry.dateFrom ||
            !entry.dateTo ||
            !originalTimeFrom ||
            !originalTimeTo
        ) {
            return { timeFrom: entry.timeFrom, timeTo: entry.timeTo };
        }

        const fixedHours = getHomeTravelHours(entry.location);
        if (!fixedHours) {
            return { timeFrom: entry.timeFrom, timeTo: entry.timeTo };
        }

        const details = entry.details ?? "";
        const containsHome =
            details.includes("자택") ||
            entry.moveFrom === "자택" ||
            entry.moveTo === "자택";

        if (!containsHome) {
            return { timeFrom: entry.timeFrom, timeTo: entry.timeTo };
        }

        const fromHome =
            entry.moveFrom === "자택" || details.trim().startsWith("자택→");
        const toHome =
            entry.moveTo === "자택" ||
            details.includes("→자택 이동.") ||
            details.endsWith("→자택");

        if (fromHome) {
            return {
                timeFrom: shiftTimeByHours(entry.dateTo, originalTimeTo, -fixedHours),
                timeTo: originalTimeTo,
            };
        }

        if (toHome) {
            return {
                timeFrom: originalTimeFrom,
                timeTo: shiftTimeByHours(entry.dateFrom, originalTimeFrom, fixedHours),
            };
        }

        return {
            timeFrom: originalTimeFrom,
            timeTo: shiftTimeByHours(entry.dateFrom, originalTimeFrom, fixedHours),
        };
    };

    const hasHomeInTravel = (entry: InvoiceTimesheetEntry): boolean => {
        const details = entry.details ?? "";
        return (
            details.includes("자택") ||
            entry.moveFrom === "자택" ||
            entry.moveTo === "자택"
        );
    };

    const isFromHomeTravel = (entry: InvoiceTimesheetEntry): boolean => {
        const details = entry.details ?? "";
        return (
            entry.moveFrom === "자택" || details.trim().startsWith("자택→")
        );
    };

    const isFromAccommodationTravel = (
        entry: InvoiceTimesheetEntry
    ): boolean => {
        const details = entry.details ?? "";
        const moveFrom = entry.moveFrom ?? "";

        return (
            entry.descType === "이동" &&
            !isFromHomeTravel(entry) &&
            (moveFrom.includes("숙소") ||
                details.trim().startsWith("숙소→") ||
                details.includes("숙소→"))
        );
    };

    const getEntryKey = (entry: InvoiceTimesheetEntry): string => {
        return [
            entry.workLogId,
            entry.id ?? "",
            entry.dateFrom,
            entry.dateTo,
            entry.timeFrom ?? "",
            entry.timeTo ?? "",
            entry.descType,
            entry.details ?? "",
            (entry.persons ?? []).join(","),
        ].join("|");
    };

    const getEntryStartTime = (entry: InvoiceTimesheetEntry): number | null => {
        if (!entry.dateFrom || !entry.timeFrom) {
            return null;
        }

        const time = toDateSafe(entry.dateFrom, entry.timeFrom).getTime();
        return Number.isNaN(time) ? null : time;
    };

    const getEntryEndTime = (entry: InvoiceTimesheetEntry): number | null => {
        if (!entry.dateTo || !entry.timeTo) {
            return null;
        }

        const time = toDateSafe(entry.dateTo, entry.timeTo).getTime();
        return Number.isNaN(time) ? null : time;
    };

    const calculateRawTravelHours = (entry: InvoiceTimesheetEntry): number => {
        if (
            entry.descType !== "이동" ||
            !entry.dateFrom ||
            !entry.dateTo ||
            !entry.timeFrom ||
            !entry.timeTo
        ) {
            return 0;
        }

        const start = toDateSafe(entry.dateFrom, entry.timeFrom);
        const end = toDateSafe(entry.dateTo, entry.timeTo);

        if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
            return 0;
        }

        return Math.floor((end.getTime() - start.getTime()) / 60000) / 60;
    };

    const calculateTravelHours = (entry: InvoiceTimesheetEntry): number => {
        if (
            entry.descType !== "이동" ||
            !entry.dateFrom ||
            !entry.dateTo ||
            !entry.timeFrom ||
            !entry.timeTo
        ) {
            return 0;
        }

        const fixedHours = getHomeTravelHours(entry.location);
        if (fixedHours && hasHomeInTravel(entry)) {
            return fixedHours;
        }

        const start = toDateSafe(entry.dateFrom, entry.timeFrom);
        const end = toDateSafe(entry.dateTo, entry.timeTo);

        if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
            return 0;
        }

        return (
            Math.floor((end.getTime() - start.getTime()) / 60000) / 60
        );
    };

    const getOverlapMinutes = (
        rangeStart: Date,
        rangeEnd: Date,
        targetStart: Date,
        targetEnd: Date
    ): number => {
        const overlapStart = rangeStart > targetStart ? rangeStart : targetStart;
        const overlapEnd = rangeEnd < targetEnd ? rangeEnd : targetEnd;

        if (overlapEnd <= overlapStart) {
            return 0;
        }

        return Math.floor((overlapEnd.getTime() - overlapStart.getTime()) / 60000);
    };

    const classifyWorkingHours = (
        entry: InvoiceTimesheetEntry
    ): { normalHours: number; afterHours: number; totalHours: number } => {
        if (
            !entry.dateFrom ||
            !entry.dateTo ||
            !entry.timeFrom ||
            !entry.timeTo
        ) {
            return { normalHours: 0, afterHours: 0, totalHours: 0 };
        }

        const start = toDateSafe(entry.dateFrom, entry.timeFrom);
        const end = toDateSafe(entry.dateTo, entry.timeTo);
        if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
            return { normalHours: 0, afterHours: 0, totalHours: 0 };
        }

        const totalMinutes = Math.floor((end.getTime() - start.getTime()) / 60000);

        if (entry.descType === "이동") {
            const travelHours = totalMinutes / 60;
            return {
                normalHours: 0,
                afterHours: 0,
                totalHours: travelHours,
            };
        }

        const normalStart = new Date(`${entry.dateFrom}T08:00:00`);
        const normalEnd = new Date(`${entry.dateFrom}T17:00:00`);
        const lunchStart = new Date(`${entry.dateFrom}T12:00:00`);
        const lunchEnd = new Date(`${entry.dateFrom}T13:00:00`);

        const rawNormalMinutes = getOverlapMinutes(
            start,
            end,
            normalStart,
            normalEnd
        );
        let normalMinutes = rawNormalMinutes;

        const shouldDeductLunch =
            entry.descType === "대기" || (entry.descType === "작업" && !entry.lunch_worked);

        if (shouldDeductLunch) {
            normalMinutes -= getOverlapMinutes(start, end, lunchStart, lunchEnd);
        }

        normalMinutes = Math.max(0, normalMinutes);
        const afterMinutes = Math.max(0, totalMinutes - rawNormalMinutes);

        return {
            normalHours: normalMinutes / 60,
            afterHours: afterMinutes / 60,
            totalHours: (normalMinutes + afterMinutes) / 60,
        };
    };

    // 요일 계산 함수
    const getDayOfWeek = (dateString: string): string => {
        const date = new Date(`${dateString}T00:00:00`);
        const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        return days[date.getDay()];
    };

    // 날짜 포맷팅 함수 (DD.MMM)
    const formatDate = (dateString: string): string => {
        const date = new Date(`${dateString}T00:00:00`);
        const day = String(date.getDate()).padStart(2, "0");
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const month = months[date.getMonth()];
        return `${day}.${month}`;
    };

    // 주말/공휴일 체크 함수
    const isWeekend = (dateString: string): boolean => {
        const date = new Date(`${dateString}T00:00:00`);
        const day = date.getDay();
        return day === 0 || day === 6; // 일요일 또는 토요일
    };

    const enumerateDateRange = (startDate: string, endDate: string): string[] => {
        const dates: string[] = [];
        const start = new Date(`${startDate}T00:00:00`);
        const end = new Date(`${endDate}T00:00:00`);

        if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
            return dates;
        }

        const cursor = new Date(start);
        while (cursor <= end) {
            const yyyy = cursor.getFullYear();
            const mm = String(cursor.getMonth() + 1).padStart(2, "0");
            const dd = String(cursor.getDate()).padStart(2, "0");
            dates.push(`${yyyy}-${mm}-${dd}`);
            cursor.setDate(cursor.getDate() + 1);
        }

        return dates;
    };

    const fetchPublicHolidays = async (
        year: number,
        monthZeroBased: number
    ): Promise<string[]> => {
        const monthStr = String(monthZeroBased + 1).padStart(2, "0");
        const url = `${HOLIDAY_API_ENDPOINT}?serviceKey=${HOLIDAY_API_KEY}&solYear=${year}&solMonth=${monthStr}&_type=json&numOfRows=100`;
        const response = await fetch(url);
        const data = await response.json();
        const items = data.response?.body?.items?.item;

        if (!items) return [];

        const itemList = Array.isArray(items) ? items : [items];
        return itemList.map((item: { locdate: string | number }) => {
            const dateStr = String(item.locdate);
            return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(
                6,
                8
            )}`;
        });
    };

    const loadHolidayDates = async (targetDates: string[]) => {
        if (targetDates.length === 0) {
            setHolidayDateSet(new Set());
            return;
        }

        const uniqueDates = Array.from(new Set(targetDates));
        const yearMonthPairs = Array.from(
            new Set(uniqueDates.map((date) => date.slice(0, 7)))
        );
        const years = Array.from(
            new Set(uniqueDates.map((date) => Number(date.slice(0, 4))))
        );

        try {
            const publicHolidayResults = await Promise.all(
                yearMonthPairs.map(async (pair) => {
                    const [year, month] = pair.split("-").map(Number);
                    return fetchPublicHolidays(year, month - 1);
                })
            );

            const calendarEventsResults = await Promise.all(
                years.map((year) => getCalendarEvents({ year }))
            );

            const holidayKeywords = [
                "휴일",
                "공휴일",
                "대체공휴일",
                "임시공휴일",
                "선거",
            ];

            const merged = new Set<string>();

            publicHolidayResults.flat().forEach((date) => merged.add(date));

            calendarEventsResults.flat().forEach((event) => {
                const title = event.title?.trim() ?? "";
                const isHolidayLikeEvent = holidayKeywords.some((keyword) =>
                    title.includes(keyword)
                );

                if (!isHolidayLikeEvent) return;

                enumerateDateRange(event.start_date, event.end_date).forEach((date) =>
                    merged.add(date)
                );
            });

            setHolidayDateSet(merged);
        } catch (error) {
            console.error("휴일 데이터 로드 실패:", error);
            setHolidayDateSet(new Set());
        }
    };

    const isHoliday = (dateString: string): boolean => {
        return isWeekend(dateString) || holidayDateSet.has(dateString);
    };


    // 보고서 데이터 로드 (다중 선택 지원)
    useEffect(() => {
        const loadWorkLogData = async () => {
            if (!workLogIdsParam) {
                return;
            }

            const workLogIds = workLogIdsParam.split(",").map(id => Number(id.trim())).filter(id => !isNaN(id));
            if (workLogIds.length === 0) {
                return;
            }

            setLoading(true);
            try {
                const dataPromises = workLogIds.map(id => getWorkLogById(id));
                const results = await Promise.all(dataPromises);

                const validData: WorkLogFullData[] = [];
                for (const data of results) {
                    if (!data) {
                        showError("일부 보고서를 찾을 수 없습니다.");
                        continue;
                    }

                    if (data.workLog.order_group !== "ELU") {
                        showError("ELU 보고서만 인보이스를 생성할 수 있습니다.");
                        continue;
                    }

                    validData.push(data);
                }

                if (validData.length === 0) {
                    showError("유효한 보고서가 없습니다.");
                    return;
                }

                setWorkLogDataList(validData);

                // 타임시트 데이터 계산
                const allEntries: InvoiceTimesheetEntry[] = validData.flatMap(data =>
                    data.entries.map(entry => ({
                        ...entry,
                        workLogId: data.workLog.id,
                        location: data.workLog.location,
                    }))
                );

                await loadHolidayDates(
                    allEntries.flatMap((entry) =>
                        enumerateDateRange(entry.dateFrom, entry.dateTo)
                    )
                );

                // 날짜별로 그룹화
                const entriesByDate = new Map<string, InvoiceTimesheetEntry[]>();
                allEntries.forEach(entry => {
                    if (!entry.dateFrom) return;
                    
                    // 날짜가 넘어가는 경우 분할
                    if (entry.dateFrom === entry.dateTo) {
                        const date = entry.dateFrom;
                        if (!entriesByDate.has(date)) {
                            entriesByDate.set(date, []);
                        }
                        const adjustedTimes = getAdjustedTravelTimes(entry);
                        entriesByDate.get(date)!.push({
                            ...entry,
                            ...adjustedTimes,
                        });
                    } else {
                        // 여러 날짜에 걸치는 경우 각 날짜별로 분할
                        const startDate = new Date(`${entry.dateFrom}T00:00:00`);
                        const endDate = new Date(`${entry.dateTo}T00:00:00`);
                        let currentDate = new Date(startDate);

                        while (currentDate <= endDate) {
                            const dateStr = currentDate.toISOString().split('T')[0];
                            if (!entriesByDate.has(dateStr)) {
                                entriesByDate.set(dateStr, []);
                            }

                            let timeFrom = entry.timeFrom || "00:00";
                            let timeTo = entry.timeTo || "24:00";

                            if (dateStr === entry.dateFrom && dateStr !== entry.dateTo) {
                                timeTo = "24:00";
                            } else if (dateStr === entry.dateTo && dateStr !== entry.dateFrom) {
                                timeFrom = "00:00";
                            } else if (dateStr !== entry.dateFrom && dateStr !== entry.dateTo) {
                                timeFrom = "00:00";
                                timeTo = "24:00";
                            }

                            const segmentedEntry: InvoiceTimesheetEntry = {
                                ...entry,
                                dateFrom: dateStr,
                                dateTo: dateStr,
                                timeFrom,
                                timeTo,
                            };

                            const adjustedTimes = getAdjustedTravelTimes(
                                segmentedEntry
                            );

                            entriesByDate.get(dateStr)!.push({
                                ...segmentedEntry,
                                ...adjustedTimes,
                            });

                            currentDate.setDate(currentDate.getDate() + 1);
                        }
                    }
                });

                // 날짜별로 타임시트 행 생성
                const rows: TimesheetRow[] = [];
                const sortedDates = Array.from(entriesByDate.keys()).sort();
                const chronologicalEntries = Array.from(
                    entriesByDate.values()
                )
                    .flat()
                    .sort((a, b) => {
                        const aStart = getEntryStartTime(a) ?? Number.MAX_SAFE_INTEGER;
                        const bStart = getEntryStartTime(b) ?? Number.MAX_SAFE_INTEGER;
                        if (aStart !== bStart) return aStart - bStart;
                        const aEnd = getEntryEndTime(a) ?? Number.MAX_SAFE_INTEGER;
                        const bEnd = getEntryEndTime(b) ?? Number.MAX_SAFE_INTEGER;
                        return aEnd - bEnd;
                    });
                const chronologicalIndexByKey = new Map<string, number>();
                chronologicalEntries.forEach((entry, index) => {
                    chronologicalIndexByKey.set(getEntryKey(entry), index);
                });

                sortedDates.forEach(date => {
                    const dayEntries = entriesByDate.get(date)!;
                    if (dayEntries.length === 0) return;
                    const supplementalRows: TimesheetRow[] = [];

                    // 가장 이른 시작 시간과 가장 늦은 종료 시간 찾기
                    let earliestTime = "24:00";
                    let latestTime = "00:00";

                    dayEntries.forEach(entry => {
                        if (entry.timeFrom && entry.timeFrom < earliestTime) {
                            earliestTime = entry.timeFrom;
                        }
                        if (entry.timeTo && entry.timeTo > latestTime) {
                            latestTime = entry.timeTo;
                        }
                    });

                    const timeFromHour = earliestTime.split(":")[0];
                    const timeToHour = latestTime.split(":")[0];

                    // 시간 분류 계산
                    let weekdayNormal = 0;
                    let weekdayAfter = 0;
                    let weekendNormal = 0;
                    let weekendAfter = 0;
                    let travelWeekday = 0;
                    let travelWeekend = 0;
                    let totalHours = 0;

                    const isWeekendDay = isHoliday(date);
                    const sortedDayEntries = [...dayEntries].sort((a, b) => {
                        const aStart = a.timeFrom
                            ? toDateSafe(a.dateFrom, a.timeFrom).getTime()
                            : Number.MAX_SAFE_INTEGER;
                        const bStart = b.timeFrom
                            ? toDateSafe(b.dateFrom, b.timeFrom).getTime()
                            : Number.MAX_SAFE_INTEGER;
                        return aStart - bStart;
                    });

                    const firstWorkEntry = sortedDayEntries.find(
                        (entry) => entry.descType === "작업"
                    );
                    const firstWorkStartTime = firstWorkEntry?.timeFrom
                        ? toDateSafe(firstWorkEntry.dateFrom, firstWorkEntry.timeFrom).getTime()
                        : null;
                    const firstWorkPersons = new Set(firstWorkEntry?.persons ?? []);

                    const entriesBeforeFirstWork =
                        firstWorkStartTime === null
                            ? []
                            : sortedDayEntries.filter((entry) => {
                                  const entryStartTime = getEntryStartTime(entry);
                                  return (
                                      entryStartTime !== null &&
                                      entryStartTime < firstWorkStartTime
                                  );
                              });

                    const homeTravelBeforeFirstWork = entriesBeforeFirstWork.filter(
                        (entry) =>
                            entry.descType === "이동" &&
                            isFromHomeTravel(entry) &&
                            getHomeTravelHours(entry.location) !== null
                    );
                    const accommodationTravelBeforeFirstWork =
                        entriesBeforeFirstWork.filter(isFromAccommodationTravel);

                    const preWorkTravelPersons = new Set<string>();
                    [
                        ...homeTravelBeforeFirstWork,
                        ...accommodationTravelBeforeFirstWork,
                    ].forEach((entry) => {
                        entry.persons?.forEach((person) =>
                            preWorkTravelPersons.add(person)
                        );
                    });

                    const mixedDepartureEntries = [
                        ...homeTravelBeforeFirstWork,
                        ...accommodationTravelBeforeFirstWork,
                    ];
                    const mixedDepartureStartTimes = mixedDepartureEntries
                        .map((entry) => getEntryStartTime(entry))
                        .filter((time): time is number => time !== null);
                    const earliestMixedDepartureStart =
                        mixedDepartureStartTimes.length > 0
                            ? Math.min(...mixedDepartureStartTimes)
                            : null;

                    const involvedWorkLogIds = new Set(
                        mixedDepartureEntries.map((entry) => entry.workLogId)
                    );

                    const isReportFirstStartedTravel =
                        earliestMixedDepartureStart !== null &&
                        involvedWorkLogIds.size > 0 &&
                        Array.from(involvedWorkLogIds).every((workLogId) =>
                            !allEntries.some((entry) => {
                                if (entry.workLogId !== workLogId) return false;
                                const entryStartTime = getEntryStartTime(entry);
                                return (
                                    entryStartTime !== null &&
                                    entryStartTime < earliestMixedDepartureStart
                                );
                            })
                        );

                    const shouldSplitMixedDepartureRows =
                        firstWorkEntry !== undefined &&
                        firstWorkPersons.size > 0 &&
                        homeTravelBeforeFirstWork.length > 0 &&
                        accommodationTravelBeforeFirstWork.length > 0 &&
                        preWorkTravelPersons.size > 0 &&
                        Array.from(preWorkTravelPersons).every((person) =>
                            firstWorkPersons.has(person)
                        ) &&
                        isReportFirstStartedTravel;

                    const splitHomeTravelKeys = new Set(
                        shouldSplitMixedDepartureRows
                            ? homeTravelBeforeFirstWork.map((entry) =>
                                  getEntryKey(entry)
                              )
                            : []
                    );

                    const splitAccommodationTravelKeys = new Set(
                        shouldSplitMixedDepartureRows
                            ? accommodationTravelBeforeFirstWork.map((entry) =>
                                  getEntryKey(entry)
                              )
                            : []
                    );

                    const getSharedMorningTravelForPersons = (
                        targetPersons: string[]
                    ): {
                        hours: number;
                        earliest: string | null;
                        latest: string | null;
                    } => {
                        const targetSet = new Set(targetPersons);
                        let hours = 0;
                        let earliest: string | null = null;
                        let latest: string | null = null;

                        entriesBeforeFirstWork.forEach((candidate) => {
                            if (candidate.descType !== "이동") return;
                            const hasIntersection = (candidate.persons ?? []).some(
                                (person) => targetSet.has(person)
                            );
                            if (!hasIntersection) return;

                            const candidateHours = calculateTravelHours(candidate);
                            if (candidateHours <= 0) return;

                            hours += candidateHours;
                            if (
                                candidate.timeFrom &&
                                (!earliest || candidate.timeFrom < earliest)
                            ) {
                                earliest = candidate.timeFrom;
                            }
                            if (
                                candidate.timeTo &&
                                (!latest || candidate.timeTo > latest)
                            ) {
                                latest = candidate.timeTo;
                            }
                        });

                        return { hours, earliest, latest };
                    };

                    const getWorkingHoursForPersons = (
                        targetPersons: string[]
                    ): {
                        normal: number;
                        after: number;
                        total: number;
                        earliest: string | null;
                        latest: string | null;
                    } => {
                        const targetSet = new Set(targetPersons);
                        let normal = 0;
                        let after = 0;
                        let earliest: string | null = null;
                        let latest: string | null = null;

                        dayEntries.forEach((candidate) => {
                            if (
                                candidate.descType === "이동" ||
                                !(candidate.persons ?? []).some((person) =>
                                    targetSet.has(person)
                                )
                            ) {
                                return;
                            }

                            const classified = classifyWorkingHours(candidate);
                            normal += classified.normalHours;
                            after += classified.afterHours;

                            if (
                                candidate.timeFrom &&
                                (!earliest || candidate.timeFrom < earliest)
                            ) {
                                earliest = candidate.timeFrom;
                            }

                            if (
                                candidate.timeTo &&
                                (!latest || candidate.timeTo > latest)
                            ) {
                                latest = candidate.timeTo;
                            }
                        });

                        return {
                            normal,
                            after,
                            total: normal + after,
                            earliest,
                            latest,
                        };
                    };

                    const groupedHomeDepartureKeys = new Set<string>();
                    if (
                        firstWorkEntry &&
                        firstWorkPersons.size > 0 &&
                        !shouldSplitMixedDepartureRows
                    ) {
                        const homeDepartureCandidates = sortedDayEntries.filter((entry) => {
                            if (
                                entry.descType !== "이동" ||
                                !entry.timeFrom ||
                                !entry.timeTo ||
                                !isFromHomeTravel(entry)
                            ) {
                                return false;
                            }

                            const fixedHours = getHomeTravelHours(entry.location);
                            if (!fixedHours) {
                                return false;
                            }

                            const entryStart = toDateSafe(
                                entry.dateFrom,
                                entry.timeFrom
                            ).getTime();

                            return (
                                firstWorkStartTime !== null &&
                                entryStart <= firstWorkStartTime
                            );
                        });

                        const homeDeparturePersons = new Set<string>();
                        homeDepartureCandidates.forEach((entry) => {
                            entry.persons?.forEach((person) =>
                                homeDeparturePersons.add(person)
                            );
                        });

                        const shouldMergeHomeDeparture =
                            homeDepartureCandidates.length > 1 &&
                            homeDeparturePersons.size > 0 &&
                            Array.from(homeDeparturePersons).every((person) =>
                                firstWorkPersons.has(person)
                            );

                        if (shouldMergeHomeDeparture) {
                            homeDepartureCandidates.forEach((entry) => {
                                groupedHomeDepartureKeys.add(
                                    [
                                        entry.workLogId,
                                        entry.dateFrom,
                                        getPrimaryLocation(entry.location),
                                    ].join("|")
                                );
                            });
                        }
                    }

                    const countedHomeDepartureKeys = new Set<string>();
                    let countedSplitHomeTravel = false;
                    const countedContinuedTravelGroupKeys = new Set<string>();
                    const mainRowOverridePersons = new Set<string>();
                    const mainRowExcludedTravelKeys = new Set<string>();

                    sortedDayEntries.forEach((entry, index) => {
                        if (!entry.timeFrom || !entry.timeTo) return;

                        if (entry.descType === "이동") {
                            const entryKey = getEntryKey(entry);

                            if (splitAccommodationTravelKeys.has(entryKey)) {
                                return;
                            }

                            if (splitHomeTravelKeys.has(entryKey)) {
                                if (!countedSplitHomeTravel) {
                                    const fixedHours =
                                        getHomeTravelHours(entry.location) ?? 0;

                                    countedSplitHomeTravel = true;
                                    totalHours += fixedHours;
                                    if (isWeekendDay) {
                                        travelWeekend += fixedHours;
                                    } else {
                                        travelWeekday += fixedHours;
                                    }
                                }
                                return;
                            }
                            const chronologicalIndex =
                                chronologicalIndexByKey.get(entryKey);

                            const previousWorkEntry =
                                chronologicalIndex === undefined
                                    ? undefined
                                    : [...chronologicalEntries.slice(0, chronologicalIndex)]
                                          .reverse()
                                          .find(
                                              (candidate) =>
                                                  candidate.descType === "작업"
                                          );
                            const nextWorkEntry =
                                chronologicalIndex === undefined
                                    ? undefined
                                    : chronologicalEntries
                                          .slice(chronologicalIndex + 1)
                                          .find(
                                              (candidate) =>
                                                  candidate.descType === "작업"
                                          );

                            const previousWorkPersons = new Set(
                                previousWorkEntry?.persons ?? []
                            );
                            const nextWorkPersons = new Set(
                                nextWorkEntry?.persons ?? []
                            );
                            const continuedWorkGroup = Array.from(
                                previousWorkPersons
                            ).filter((person) => nextWorkPersons.has(person));
                            const entryPersons = entry.persons ?? [];
                            const continuingPersons = entryPersons.filter((person) =>
                                continuedWorkGroup.includes(person)
                            );
                            const separatedPersons = entryPersons.filter(
                                (person) => !continuedWorkGroup.includes(person)
                            );
                            const fixedHomeHours =
                                getHomeTravelHours(entry.location) ?? 0;
                            const continuedGroupKey =
                                previousWorkEntry && nextWorkEntry && continuedWorkGroup.length > 0
                                    ? [
                                          date,
                                          getEntryKey(previousWorkEntry),
                                          getEntryKey(nextWorkEntry),
                                          [...continuedWorkGroup].sort().join(","),
                                      ].join("|")
                                    : null;
                            const canSplitContinuedTravel =
                                continuingPersons.length > 0 &&
                                (separatedPersons.length === 0 ||
                                    (hasHomeInTravel(entry) && fixedHomeHours > 0));

                            if (canSplitContinuedTravel) {
                                if (
                                    continuedGroupKey &&
                                    !countedContinuedTravelGroupKeys.has(
                                        continuedGroupKey
                                    )
                                ) {
                                    countedContinuedTravelGroupKeys.add(
                                        continuedGroupKey
                                    );
                                    totalHours += 1;
                                    if (isWeekendDay) {
                                        travelWeekend += 1;
                                    } else {
                                        travelWeekday += 1;
                                    }
                                }

                                continuingPersons.forEach((person) =>
                                    mainRowOverridePersons.add(person)
                                );
                                mainRowExcludedTravelKeys.add(entryKey);

                                if (
                                    separatedPersons.length > 0 &&
                                    hasHomeInTravel(entry) &&
                                    fixedHomeHours > 0
                                ) {
                                    const sharedMorning =
                                        getSharedMorningTravelForPersons(
                                            separatedPersons
                                        );
                                    const separatedWorking =
                                        getWorkingHoursForPersons(separatedPersons);
                                    const fixedTravelEnd = shiftTimeByHours(
                                        entry.dateFrom,
                                        entry.timeFrom,
                                        fixedHomeHours
                                    );
                                    const supplementalTimeFrom = [
                                        sharedMorning.earliest,
                                        separatedWorking.earliest,
                                        entry.timeFrom,
                                    ]
                                        .filter((value): value is string => Boolean(value))
                                        .sort()[0] ?? entry.timeFrom;
                                    const supplementalTimeTo = [
                                        separatedWorking.latest,
                                        fixedTravelEnd,
                                    ]
                                        .filter((value): value is string => Boolean(value))
                                        .sort()
                                        .at(-1) ?? fixedTravelEnd;
                                    const supplementalHours =
                                        sharedMorning.hours +
                                        fixedHomeHours +
                                        separatedWorking.total;

                                    supplementalRows.push({
                                        rowId: `${date}-${entryKey}-continued-home`,
                                        date,
                                        day: getDayOfWeek(date),
                                        dateFormatted: formatDate(date),
                                        timeFrom: supplementalTimeFrom.split(":")[0],
                                        timeTo: supplementalTimeTo.split(":")[0],
                                        totalHours:
                                            Math.round(supplementalHours * 10) / 10,
                                        weekdayNormal: isWeekendDay
                                            ? 0
                                            : Math.round(
                                                  separatedWorking.normal * 10
                                              ) / 10,
                                        weekdayAfter: isWeekendDay
                                            ? 0
                                            : Math.round(
                                                  separatedWorking.after * 10
                                              ) / 10,
                                        weekendNormal: isWeekendDay
                                            ? Math.round(
                                                  separatedWorking.normal * 10
                                              ) / 10
                                            : 0,
                                        weekendAfter: isWeekendDay
                                            ? Math.round(
                                                  separatedWorking.after * 10
                                              ) / 10
                                            : 0,
                                        travelWeekday: isWeekendDay
                                            ? 0
                                            : Math.round(supplementalHours * 10) /
                                                  10 -
                                              Math.round(
                                                  separatedWorking.total * 10
                                              ) /
                                                  10,
                                        travelWeekend: isWeekendDay
                                            ? Math.round(supplementalHours * 10) /
                                                  10 -
                                              Math.round(
                                                  separatedWorking.total * 10
                                              ) /
                                                  10
                                            : 0,
                                        description: `${separatedPersons.join(", ")} (자택 이동)`,
                                        hideDayDate: true,
                                    });
                                }

                                return;
                            }

                            let travelHours = calculateTravelHours(entry);
                            const groupKey = [
                                entry.workLogId,
                                entry.dateFrom,
                                getPrimaryLocation(entry.location),
                            ].join("|");

                            if (
                                travelHours > 0 &&
                                isFromHomeTravel(entry) &&
                                groupedHomeDepartureKeys.has(groupKey)
                            ) {
                                if (countedHomeDepartureKeys.has(groupKey)) {
                                    travelHours = 0;
                                } else {
                                    countedHomeDepartureKeys.add(groupKey);
                                }
                            }

                            totalHours += travelHours;
                            if (isWeekendDay) {
                                travelWeekend += travelHours;
                            } else {
                                travelWeekday += travelHours;
                            }
                        } else {
                            const {
                                totalHours: classifiedTotal,
                                normalHours,
                                afterHours,
                            } = classifyWorkingHours(entry);

                            totalHours += classifiedTotal;
                            if (isWeekendDay) {
                                weekendNormal += normalHours;
                                weekendAfter += afterHours;
                            } else {
                                weekdayNormal += normalHours;
                                weekdayAfter += afterHours;
                            }
                        }
                    });

                    // 설명 생성 (작업자 정보)
                    const workers = new Set<string>();
                    dayEntries.forEach(entry => {
                        entry.persons?.forEach(person => workers.add(person));
                    });
                    const workerList = Array.from(workers);
                    const description =
                        mainRowOverridePersons.size > 0
                            ? Array.from(mainRowOverridePersons).join(", ")
                            : workerList.length > 0
                              ? workerList.join(", ")
                              : "";

                    let mainRowTimeTo = timeToHour;
                    if (mainRowExcludedTravelKeys.size > 0) {
                        const mainLatestCandidates: string[] = [];

                        sortedDayEntries.forEach((entry) => {
                            if (!entry.timeFrom || !entry.timeTo) return;
                            const entryKey = getEntryKey(entry);

                            if (splitAccommodationTravelKeys.has(entryKey)) {
                                return;
                            }

                            if (mainRowExcludedTravelKeys.has(entryKey)) {
                                mainLatestCandidates.push(
                                    shiftTimeByHours(
                                        entry.dateFrom,
                                        entry.timeFrom,
                                        1
                                    )
                                );
                                return;
                            }

                            mainLatestCandidates.push(entry.timeTo);
                        });

                        const resolvedMainTimeTo =
                            mainLatestCandidates.sort().at(-1) ?? latestTime;
                        mainRowTimeTo = resolvedMainTimeTo.split(":")[0];
                    }

                    rows.push({
                        rowId: `${date}-main`,
                        date,
                        day: getDayOfWeek(date),
                        dateFormatted: formatDate(date),
                        timeFrom: timeFromHour,
                        timeTo: mainRowTimeTo,
                        totalHours: Math.round(totalHours * 10) / 10,
                        weekdayNormal: Math.round(weekdayNormal * 10) / 10,
                        weekdayAfter: Math.round(weekdayAfter * 10) / 10,
                        weekendNormal: Math.round(weekendNormal * 10) / 10,
                        weekendAfter: Math.round(weekendAfter * 10) / 10,
                        travelWeekday: Math.round(travelWeekday * 10) / 10,
                        travelWeekend: Math.round(travelWeekend * 10) / 10,
                        description,
                    });

                    supplementalRows.forEach((row) => rows.push(row));

                    if (shouldSplitMixedDepartureRows) {
                        let accommodationTravelHours = 0;
                        let accommodationEarliest: string | null = null;
                        let accommodationLatest: string | null = null;
                        const accommodationPersons = new Set<string>();

                        accommodationTravelBeforeFirstWork.forEach((entry) => {
                            const travelHours = calculateRawTravelHours(entry);
                            if (travelHours <= 0) return;

                            accommodationTravelHours += travelHours;

                            if (
                                entry.timeFrom &&
                                (!accommodationEarliest ||
                                    entry.timeFrom < accommodationEarliest)
                            ) {
                                accommodationEarliest = entry.timeFrom;
                            }

                            if (
                                entry.timeTo &&
                                (!accommodationLatest ||
                                    entry.timeTo > accommodationLatest)
                            ) {
                                accommodationLatest = entry.timeTo;
                            }

                            entry.persons?.forEach((person) =>
                                accommodationPersons.add(person)
                            );
                        });

                        if (accommodationTravelHours > 0) {
                            rows.push({
                                rowId: `${date}-accommodation`,
                                date,
                                day: getDayOfWeek(date),
                                dateFormatted: formatDate(date),
                                timeFrom: (accommodationEarliest ?? "").split(":")[0],
                                timeTo: (accommodationLatest ?? "").split(":")[0],
                                totalHours:
                                    Math.round(accommodationTravelHours * 10) / 10,
                                weekdayNormal: 0,
                                weekdayAfter: 0,
                                weekendNormal: 0,
                                weekendAfter: 0,
                                travelWeekday: isWeekendDay
                                    ? 0
                                    : Math.round(accommodationTravelHours * 10) / 10,
                                travelWeekend: isWeekendDay
                                    ? Math.round(accommodationTravelHours * 10) / 10
                                    : 0,
                                description:
                                    accommodationPersons.size > 0
                                        ? `${Array.from(accommodationPersons).join(", ")} (숙소 출발 이동)`
                                        : "숙소 출발 이동",
                                hideDayDate: true,
                            });
                        }
                    }
                });

                setTimesheetRows(rows);
            } catch (error) {
                console.error("보고서 데이터 로드 실패:", error);
                showError("보고서 데이터를 불러오는 중 오류가 발생했습니다.");
            } finally {
                setLoading(false);
            }
        };

        loadWorkLogData();
    }, [workLogIdsParam, showError]);

    const handleMenuClick = () => {
        setSidebarOpen(!sidebarOpen);
    };

    const handleSidebarClose = () => {
        setSidebarOpen(false);
    };

    // 출장지 매핑 함수
    const mapWorkPlace = (location: string | null): string => {
        if (!location) return "";
        
        // 첫 번째 출장지 추출
        const firstLocation = location.split(",")[0].trim();
        
        // 매핑 규칙 적용
        if (firstLocation === "HD중공업(해양)") {
            return "HHI";
        } else if (firstLocation === "HD미포") {
            return "HMD";
        } else if (firstLocation === "HD삼호") {
            return "HSHI";
        }
        
        // 나머지는 원본 값 그대로 반환
        return firstLocation;
    };

    return (
        <div className="flex h-screen bg-white overflow-hidden font-pretendard">
            {/* Overlay - 사이드바가 열려있을 때만 표시 */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40"
                    onClick={handleSidebarClose}
                />
            )}

            {/* Sidebar - 접기/펼치기 가능 (데스크탑에서도 접기 가능) */}
            <div
                className={`
                    fixed inset-y-0 left-0 z-50
                    w-[260px] max-w-[88vw] lg:max-w-none lg:w-[239px] h-screen shrink-0
                    transform transition-transform duration-300 ease-in-out
                    ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
                `}
                onClick={(e) => e.stopPropagation()}
            >
                <Sidebar onClose={handleSidebarClose} showCloseOnDesktop={true} />
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <Header
                    title="인보이스 생성"
                    onMenuClick={handleMenuClick}
                    showMenuOnDesktop={true}
                />
                
                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
                    {loading ? (
                        <div className="flex items-center justify-center h-64">
                            <div className="text-gray-500">로딩 중...</div>
                        </div>
                    ) : workLogDataList.length === 0 ? (
                        <div className="flex items-center justify-center h-64">
                            <div className="text-gray-500">보고서를 선택해주세요.</div>
                        </div>
                    ) : (
                        <div className="max-w-full mx-auto">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* 좌측: R&D TIMESHEET 및 JOB DESCRIPTION 섹션 */}
                                <div className="flex flex-col gap-6">
                                    {/* R&D TIMESHEET 섹션 */}
                                    <div className="flex flex-col gap-6 bg-white border border-gray-200 rounded-xl p-6">
                                        {/* R&D TIMESHEET 제목 - 크고 굵게 */}
                                        <h2 className="text-3xl font-bold text-black mb-2">R&D TIMESHEET</h2>
                                    
                                    {/* Job Information Table */}
                                    <div className="flex flex-col gap-4 mb-6">
                                        <div className="border border-gray-300 rounded overflow-hidden">
                                            <table className="w-full text-sm border-collapse">
                                                <thead className="bg-gray-100">
                                                    <tr>
                                                        <th className="px-4 py-3 text-left font-semibold text-gray-900 border-b border-gray-300">SHIP NAME</th>
                                                        <th className="px-4 py-3 text-left font-semibold text-gray-900 border-b border-l border-gray-300">WORK PLACE</th>
                                                        <th className="px-4 py-3 text-left font-semibold text-gray-900 border-b border-l border-gray-300">Work order from</th>
                                                        <th className="px-4 py-3 text-left font-semibold text-gray-900 border-b border-l border-gray-300">P O No.</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    <tr>
                                                        <td className="px-4 py-2 text-gray-900 border-b border-gray-300">
                                                            {workLogDataList[0]?.workLog.vessel || ""}
                                                        </td>
                                                        <td className="px-4 py-2 text-gray-900 border-b border-l border-gray-300">
                                                            {mapWorkPlace(workLogDataList[0]?.workLog.location || null)}
                                                        </td>
                                                        <td className="px-4 py-2 text-gray-900 border-b border-l border-gray-300">
                                                            Everlience ELU KOREA
                                                        </td>
                                                        <td className="px-4 py-2 text-gray-900 border-b border-l border-gray-300"></td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                
                                {/* Hours Logging Table */}
                                <div className="flex flex-col gap-4">
                                    <div className="border border-gray-300 rounded overflow-hidden">
                                        <table className="w-full table-fixed text-[11px] min-w-full border-collapse">
                                            <colgroup>
                                                <col className="w-[56px]" />
                                                <col className="w-[68px]" />
                                                <col className="w-[52px]" />
                                                <col className="w-[52px]" />
                                                <col className="w-[56px]" />
                                                <col className="w-[74px]" />
                                                <col className="w-[74px]" />
                                                <col className="w-[74px]" />
                                                <col className="w-[82px]" />
                                                <col className="w-[66px]" />
                                                <col className="w-[76px]" />
                                                <col className="w-[58px]" />
                                            </colgroup>
                                            <thead className="bg-gray-100">
                                                {/* 1행: Indication of date & time / Total Hours / Split of Hours / Mark Sea-going */}
                                                <tr>
                                                    <th colSpan={4} className="px-1 py-2 text-center font-semibold text-gray-900 border-b border-r border-gray-300">
                                                        Indication of date &amp; time
                                                    </th>
                                                    <th rowSpan={3} className="px-1 py-2 text-center font-semibold text-gray-900 border-b border-r border-gray-300 leading-tight">
                                                        Total
                                                        <br />
                                                        Hours
                                                    </th>
                                                    <th colSpan={6} className="px-1 py-2 text-center font-semibold text-gray-900 border-b border-r border-gray-300">
                                                        Split of Hours
                                                    </th>
                                                    <th rowSpan={3} className="px-1 py-2 text-center font-semibold text-gray-900 border-b border-gray-300 leading-tight">
                                                        Mark Sea-going<br />Vessel (x)
                                                    </th>
                                                </tr>
                                                {/* 2행: Year/Day/Date/Time From/Time To + 상위 그룹 헤더 */}
                                                <tr>
                                                    <th className="px-1 py-2 text-center font-medium text-gray-700 border-b border-r border-gray-300">
                                                        Year
                                                    </th>
                                                    <th className="px-1 py-2 text-center font-medium text-gray-900 bg-white border-b border-r border-gray-300">
                                                        2026
                                                    </th>
                                                    <th rowSpan={2} className="px-1 py-2 text-center font-medium text-gray-700 border-b border-r border-gray-300 leading-tight">
                                                        Time
                                                        <br />
                                                        From
                                                    </th>
                                                    <th rowSpan={2} className="px-1 py-2 text-center font-medium text-gray-700 border-b border-r border-gray-300 leading-tight">
                                                        Time
                                                        <br />
                                                        To
                                                    </th>
                                                    <th colSpan={2} className="px-1 py-1 text-center font-medium text-gray-700 border-b border-r border-gray-300 leading-tight">
                                                        Weekdays
                                                        <br />
                                                        (with in normal working
                                                        <br />
                                                        hours,
                                                        <br />
                                                        08:00 to 17:00)
                                                    </th>
                                                    <th colSpan={2} className="px-1 py-1 text-center font-medium text-gray-700 border-b border-r border-gray-300 leading-tight">
                                                        Saturday, Sunday, and
                                                        <br />
                                                        local holidays
                                                    </th>
                                                    <th colSpan={2} className="px-1 py-1 text-center font-medium text-gray-700 border-b border-r border-gray-300 leading-tight">
                                                        Travel
                                                        <br />
                                                        Hours**
                                                    </th>
                                                </tr>
                                                {/* 3행: Day/Date 하위 헤더 + Split of Hours 하위 라벨 */}
                                                <tr>
                                                    <th className="px-1 py-1 text-center font-medium text-gray-700 border-b border-r border-gray-300">
                                                        Day
                                                    </th>
                                                    <th className="px-1 py-1 text-center font-medium text-gray-700 border-b border-r border-gray-300">
                                                        Date
                                                    </th>
                                                    <th className="px-1 py-1 text-center font-medium text-gray-700 border-b border-r border-gray-300 leading-tight">
                                                        Normal
                                                        <br />
                                                        Working
                                                    </th>
                                                    <th className="px-1 py-1 text-center font-medium text-gray-700 border-b border-r border-gray-300 leading-tight">
                                                        After Normal
                                                        <br />
                                                        Working
                                                    </th>
                                                    <th className="px-1 py-1 text-center font-medium text-gray-700 border-b border-r border-gray-300 leading-tight">
                                                        Normal
                                                        <br />
                                                        Working
                                                    </th>
                                                    <th className="px-1 py-1 text-center font-medium text-gray-700 border-b border-r border-gray-300 leading-tight">
                                                        After Normal
                                                        <br />
                                                        Working
                                                    </th>
                                                    <th className="px-1 py-1 text-center font-medium text-gray-700 border-b border-r border-gray-300">
                                                        Weekday
                                                    </th>
                                                    <th className="px-1 py-1 text-center font-medium text-gray-700 border-b border-r border-gray-300 leading-tight">
                                                        Weekend
                                                        <br />
                                                        / Holiday
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {timesheetRows.map((row) => (
                                                    <React.Fragment key={row.rowId}>
                                                        <tr className="border-b border-gray-300">
                                                            <td rowSpan={2} className="px-2 py-2 text-center border-r border-gray-300">{row.hideDayDate ? "" : row.day}</td>
                                                            <td rowSpan={2} className="px-2 py-2 text-center border-r border-gray-300">{row.hideDayDate ? "" : row.dateFormatted}</td>
                                                            <td rowSpan={2} className="px-2 py-2 text-center border-r border-gray-300">{row.timeFrom}</td>
                                                            <td rowSpan={2} className="px-2 py-2 text-center border-r border-gray-300">{row.timeTo}</td>
                                                            <td rowSpan={2} className="px-2 py-2 text-center border-r border-gray-300 font-bold">{row.totalHours}</td>
                                                            <td className="px-2 py-2 text-center border-r border-gray-300">
                                                                {row.weekdayNormal > 0 ? row.weekdayNormal : ""}
                                                            </td>
                                                            <td className="px-2 py-2 text-center border-r border-gray-300">
                                                                {row.weekdayAfter > 0 ? row.weekdayAfter : ""}
                                                            </td>
                                                            <td className="px-2 py-2 text-center border-r border-gray-300">
                                                                {row.weekendNormal > 0 ? row.weekendNormal : ""}
                                                            </td>
                                                            <td className="px-2 py-2 text-center border-r border-gray-300">
                                                                {row.weekendAfter > 0 ? row.weekendAfter : ""}
                                                            </td>
                                                            <td className="px-2 py-2 text-center border-r border-gray-300">
                                                                {row.travelWeekday > 0 ? row.travelWeekday : ""}
                                                            </td>
                                                            <td className="px-2 py-2 text-center border-r border-gray-300">
                                                                {row.travelWeekend > 0 ? row.travelWeekend : ""}
                                                            </td>
                                                            <td className="px-2 py-2 text-center"></td>
                                                        </tr>
                                                        <tr className="border-b border-gray-300">
                                                            <td colSpan={7} className="px-2 py-1 text-left text-xs text-gray-600">
                                                                {row.description}
                                                            </td>
                                                        </tr>
                                                    </React.Fragment>
                                                ))}
                                                {/* Total Row */}
                                                {timesheetRows.length > 0 && (
                                                    <tr className="bg-gray-100 font-semibold">
                                                        <td colSpan={4} className="px-2 py-2 text-center border-r border-gray-300">Total</td>
                                                        <td className="px-2 py-2 text-center border-r border-gray-300 font-bold">
                                                            {Math.round(timesheetRows.reduce((sum, row) => sum + row.totalHours, 0) * 10) / 10}
                                                        </td>
                                                        <td className="px-2 py-2 text-center border-r border-gray-300 font-bold">
                                                            {Math.round(timesheetRows.reduce((sum, row) => sum + row.weekdayNormal, 0) * 10) / 10}
                                                        </td>
                                                        <td className="px-2 py-2 text-center border-r border-gray-300 font-bold">
                                                            {Math.round(timesheetRows.reduce((sum, row) => sum + row.weekdayAfter, 0) * 10) / 10}
                                                        </td>
                                                        <td className="px-2 py-2 text-center border-r border-gray-300 font-bold">
                                                            {Math.round(timesheetRows.reduce((sum, row) => sum + row.weekendNormal, 0) * 10) / 10}
                                                        </td>
                                                        <td className="px-2 py-2 text-center border-r border-gray-300 font-bold">
                                                            {Math.round(timesheetRows.reduce((sum, row) => sum + row.weekendAfter, 0) * 10) / 10}
                                                        </td>
                                                        <td className="px-2 py-2 text-center border-r border-gray-300 font-bold">
                                                            {Math.round(timesheetRows.reduce((sum, row) => sum + row.travelWeekday, 0) * 10) / 10}
                                                        </td>
                                                        <td className="px-2 py-2 text-center border-r border-gray-300 font-bold">
                                                            {Math.round(timesheetRows.reduce((sum, row) => sum + row.travelWeekend, 0) * 10) / 10}
                                                        </td>
                                                        <td className="px-2 py-2 text-center font-bold">0</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                                </div>

                                {/* JOB DESCRIPTION 섹션 */}
                                <div className="flex flex-col gap-4 bg-white border border-gray-200 rounded-xl p-6">
                                    <h2 className="text-3xl font-bold text-black mb-2">JOB DESCRIPTION</h2>
                                    <div className="grid grid-cols-4 gap-4">
                                        {/* Row 1 - Card 1: SHIP NAME */}
                                        <div className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col">
                                            <div className="text-xs font-semibold text-gray-700 mb-2">SHIP NAME</div>
                                            <div className="text-sm text-gray-900">SH8300</div>
                                        </div>
                                        {/* Row 1 - Card 2: Engineer Name and Title */}
                                        <div className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col">
                                            <div className="text-xs font-semibold text-gray-700 mb-2">Engineer Name and Title</div>
                                            <div className="text-sm text-gray-900">KT On / Skilled fitter</div>
                                        </div>
                                        {/* Row 1 - Card 3: Work Order From */}
                                        <div className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col">
                                            <div className="text-xs font-semibold text-gray-700 mb-2">Work Order From</div>
                                            <div className="text-sm text-gray-900">Everllence ELU KOREA</div>
                                        </div>
                                        {/* Row 1 - Card 4: Departure date & time, from place */}
                                        <div className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col">
                                            <div className="text-xs font-semibold text-gray-700 mb-2">Departure date & time, from place</div>
                                            <div className="text-sm text-gray-900">04.Feb.2026, 06:00 from Busan</div>
                                        </div>
                                        {/* Row 2 - Card 5: WORK PLACE */}
                                        <div className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col">
                                            <div className="text-xs font-semibold text-gray-700 mb-2">WORK PLACE</div>
                                            <div className="text-sm text-gray-900">HHI</div>
                                        </div>
                                        {/* Row 2 - Card 6: Mechanic names and numbers */}
                                        <div className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col">
                                            <div className="text-xs font-semibold text-gray-700 mb-2">Mechanic names and numbers</div>
                                            <div className="text-sm text-gray-900">DM Kim and 1 fitter (Total 2 fitters)</div>
                                        </div>
                                        {/* Row 2 - Card 7: P.O No. */}
                                        <div className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col">
                                            <div className="text-xs font-semibold text-gray-700 mb-2">P.O No.</div>
                                            <div className="text-sm text-gray-900"></div>
                                        </div>
                                        {/* Row 2 - Card 8: Return date & time, to place */}
                                        <div className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col">
                                            <div className="text-xs font-semibold text-gray-700 mb-2">Return date & time, to place</div>
                                            <div className="text-sm text-gray-900">04.Feb.2026, 19:00 to Busan</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 우측: INVOICE 및 NORMAL TIMESHEET 섹션 */}
                            <div className="flex flex-col gap-6">
                                {/* INVOICE 섹션 */}
                                <div className="flex flex-col gap-6 bg-white border border-gray-200 rounded-xl p-6">
                                    {/* INVOICE 제목 - 크고 굵게 */}
                                    <h2 className="text-3xl font-bold text-black mb-2">INVOICE</h2>
                                    
                                    {/* Top Information Sections - 3 columns */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        {/* Invoice to (Left Column) */}
                                        <div className="flex flex-col gap-3">
                                            <h3 className="text-sm font-semibold text-gray-900">Invoice to</h3>
                                            <div className="text-sm text-gray-900">Everllence</div>
                                            <div className="text-sm text-gray-900">2-Stroke Business, Operation / Engineering</div>
                                            <div className="text-sm text-gray-900">Teglholmsgade 41</div>
                                            <div className="text-sm text-gray-900">2450 Copenhagen SV, Denmark</div>
                                        </div>

                                        {/* Job Information (Middle Column) */}
                                        <div className="flex flex-col gap-3">
                                            <h3 className="text-sm font-semibold text-gray-900">Job information</h3>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm text-gray-700">Hull no.</span>
                                                <span className="text-sm text-gray-900">SH8300</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm text-gray-700">Engine type:</span>
                                                <span className="text-sm text-gray-900">7G95ME-GI</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm text-gray-700">Work Period & Place:</span>
                                                <span className="text-sm text-gray-900">04.Feb.2026 at HHI</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm text-gray-700">Work Item:</span>
                                                <span className="text-sm text-gray-900">Replacement of PIV Atomizer</span>
                                            </div>
                                        </div>

                                        {/* Invoice Numbers & Dates (Right Column) */}
                                        <div className="flex flex-col gap-3">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm text-gray-700">P.O No:</span>
                                                <span className="text-sm text-gray-900"></span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm text-gray-700">INVOICE No:</span>
                                                <span className="text-sm text-gray-900">R12602061</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm text-gray-700">Date:</span>
                                                <span className="text-sm text-gray-900">10.Feb.2026</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm text-gray-700">Validity:</span>
                                                <span className="text-sm text-gray-900">14 days</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm text-gray-700">Currency unit:</span>
                                                <span className="text-sm text-gray-900">EUR</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Line Items Table */}
                                    <div className="flex flex-col gap-4 mt-4">
                                        <div className="border border-gray-300 rounded overflow-hidden">
                                            <table className="w-full text-sm border-collapse">
                                                <thead className="bg-gray-100">
                                                    <tr>
                                                        <th className="px-4 py-3 text-left font-semibold text-gray-900 border-b border-gray-300">Description</th>
                                                        <th className="px-4 py-3 text-center font-semibold text-gray-900 border-b border-gray-300 border-l border-gray-300 w-20">Q'ty</th>
                                                        <th className="px-4 py-3 text-center font-semibold text-gray-900 border-b border-gray-300 border-l border-gray-300 w-24">Unit</th>
                                                        <th className="px-4 py-3 text-right font-semibold text-gray-900 border-b border-gray-300 border-l border-gray-300 w-32">Unit price</th>
                                                        <th className="px-4 py-3 text-right font-semibold text-gray-900 border-b border-gray-300 border-l border-gray-300 w-32">Total</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {/* 1. MANPOWER */}
                                                    <tr>
                                                        <td className="px-4 py-2 text-gray-900 font-semibold border-b border-gray-300">1. MANPOWER</td>
                                                        <td className="px-4 py-2 text-center border-b border-gray-300 border-l border-gray-300"></td>
                                                        <td className="px-4 py-2 text-center border-b border-gray-300 border-l border-gray-300"></td>
                                                        <td className="px-4 py-2 text-right border-b border-gray-300 border-l border-gray-300"></td>
                                                        <td className="px-4 py-2 text-right border-b border-gray-300 border-l border-gray-300"></td>
                                                    </tr>
                                                    {/* 1.1 Skilled Fitter (KT On) */}
                                                    <tr>
                                                        <td className="px-4 py-2 text-gray-900 pl-8 border-b border-gray-300">1.1 Skilled Fitter (KT On)</td>
                                                        <td className="px-4 py-2 text-center border-b border-gray-300 border-l border-gray-300">1</td>
                                                        <td className="px-4 py-2 text-center border-b border-gray-300 border-l border-gray-300">MAN</td>
                                                        <td className="px-4 py-2 text-right border-b border-gray-300 border-l border-gray-300"></td>
                                                        <td className="px-4 py-2 text-right border-b border-gray-300 border-l border-gray-300"></td>
                                                    </tr>
                                                    {/* : Weekday/ Normal Working Hours */}
                                                    <tr>
                                                        <td className="px-4 py-2 text-gray-900 pl-12 border-b border-gray-300">: Weekday/ Normal Working Hours</td>
                                                        <td className="px-4 py-2 text-center border-b border-gray-300 border-l border-gray-300">8</td>
                                                        <td className="px-4 py-2 text-center border-b border-gray-300 border-l border-gray-300">hours</td>
                                                        <td className="px-4 py-2 text-right border-b border-gray-300 border-l border-gray-300">55,200</td>
                                                        <td className="px-4 py-2 text-right border-b border-gray-300 border-l border-gray-300">441,600</td>
                                                    </tr>
                                                    {/* : Weekday/ Waiting & Travel Hours */}
                                                    <tr>
                                                        <td className="px-4 py-2 text-gray-900 pl-12 border-b border-gray-300">: Weekday/ Waiting & Travel Hours</td>
                                                        <td className="px-4 py-2 text-center border-b border-gray-300 border-l border-gray-300">4</td>
                                                        <td className="px-4 py-2 text-center border-b border-gray-300 border-l border-gray-300">hours</td>
                                                        <td className="px-4 py-2 text-right border-b border-gray-300 border-l border-gray-300">39,100</td>
                                                        <td className="px-4 py-2 text-right border-b border-gray-300 border-l border-gray-300">156,400</td>
                                                    </tr>
                                                    {/* 1.2 Fitters (DM Kim, JH Lee) */}
                                                    <tr>
                                                        <td className="px-4 py-2 text-gray-900 pl-8 border-b border-gray-300">1.2 Fitters (DM Kim, JH Lee)</td>
                                                        <td className="px-4 py-2 text-center border-b border-gray-300 border-l border-gray-300">2</td>
                                                        <td className="px-4 py-2 text-center border-b border-gray-300 border-l border-gray-300">MEN</td>
                                                        <td className="px-4 py-2 text-right border-b border-gray-300 border-l border-gray-300"></td>
                                                        <td className="px-4 py-2 text-right border-b border-gray-300 border-l border-gray-300"></td>
                                                    </tr>
                                                    {/* : Weekday/ Normal Working Hours */}
                                                    <tr>
                                                        <td className="px-4 py-2 text-gray-900 pl-12 border-b border-gray-300">: Weekday/ Normal Working Hours</td>
                                                        <td className="px-4 py-2 text-center border-b border-gray-300 border-l border-gray-300">16</td>
                                                        <td className="px-4 py-2 text-center border-b border-gray-300 border-l border-gray-300">hours</td>
                                                        <td className="px-4 py-2 text-right border-b border-gray-300 border-l border-gray-300">42,600</td>
                                                        <td className="px-4 py-2 text-right border-b border-gray-300 border-l border-gray-300">681,600</td>
                                                    </tr>
                                                    {/* : Weekday/ Waiting & Travel Hours */}
                                                    <tr>
                                                        <td className="px-4 py-2 text-gray-900 pl-12 border-b border-gray-300">: Weekday/ Waiting & Travel Hours</td>
                                                        <td className="px-4 py-2 text-center border-b border-gray-300 border-l border-gray-300">8</td>
                                                        <td className="px-4 py-2 text-center border-b border-gray-300 border-l border-gray-300">hours</td>
                                                        <td className="px-4 py-2 text-right border-b border-gray-300 border-l border-gray-300">31,100</td>
                                                        <td className="px-4 py-2 text-right border-b border-gray-300 border-l border-gray-300">248,800</td>
                                                    </tr>
                                                    {/* 2. Daily Allowance */}
                                                    <tr>
                                                        <td className="px-4 py-2 text-gray-900 font-semibold border-b border-gray-300">2. Daily Allowance</td>
                                                        <td className="px-4 py-2 text-center border-b border-gray-300 border-l border-gray-300"></td>
                                                        <td className="px-4 py-2 text-center border-b border-gray-300 border-l border-gray-300"></td>
                                                        <td className="px-4 py-2 text-right border-b border-gray-300 border-l border-gray-300"></td>
                                                        <td className="px-4 py-2 text-right border-b border-gray-300 border-l border-gray-300"></td>
                                                    </tr>
                                                    {/* : 1 Skilled fitter and 2 fitters */}
                                                    <tr>
                                                        <td className="px-4 py-2 text-gray-900 pl-8 border-b border-gray-300">: 1 Skilled fitter and 2 fitters</td>
                                                        <td className="px-4 py-2 text-center border-b border-gray-300 border-l border-gray-300">9</td>
                                                        <td className="px-4 py-2 text-center border-b border-gray-300 border-l border-gray-300">Meals</td>
                                                        <td className="px-4 py-2 text-right border-b border-gray-300 border-l border-gray-300">15,000</td>
                                                        <td className="px-4 py-2 text-right border-b border-gray-300 border-l border-gray-300">135,000</td>
                                                    </tr>
                                                    {/* 3. Transportation (KRW 500/km) */}
                                                    <tr>
                                                        <td className="px-4 py-2 text-gray-900 font-semibold border-b border-gray-300">3. Transportation (KRW 500/km)</td>
                                                        <td className="px-4 py-2 text-center border-b border-gray-300 border-l border-gray-300"></td>
                                                        <td className="px-4 py-2 text-center border-b border-gray-300 border-l border-gray-300"></td>
                                                        <td className="px-4 py-2 text-right border-b border-gray-300 border-l border-gray-300"></td>
                                                        <td className="px-4 py-2 text-right border-b border-gray-300 border-l border-gray-300"></td>
                                                    </tr>
                                                    {/* : 1 (Round) x 200km x 1car: 200km */}
                                                    <tr>
                                                        <td className="px-4 py-2 text-gray-900 pl-8 border-b border-gray-300">: 1 (Round) x 200km x 1car: 200km</td>
                                                        <td className="px-4 py-2 text-center border-b border-gray-300 border-l border-gray-300">200</td>
                                                        <td className="px-4 py-2 text-center border-b border-gray-300 border-l border-gray-300">Km</td>
                                                        <td className="px-4 py-2 text-right border-b border-gray-300 border-l border-gray-300">500</td>
                                                        <td className="px-4 py-2 text-right border-b border-gray-300 border-l border-gray-300">100,000</td>
                                                    </tr>
                                                    {/* * Mileage: RTB to HHI(Round): 200km */}
                                                    <tr>
                                                        <td className="px-4 py-2 text-gray-900 pl-8 border-b border-gray-300 italic">* Mileage: RTB to HHI(Round): 200km</td>
                                                        <td className="px-4 py-2 text-center border-b border-gray-300 border-l border-gray-300"></td>
                                                        <td className="px-4 py-2 text-center border-b border-gray-300 border-l border-gray-300"></td>
                                                        <td className="px-4 py-2 text-right border-b border-gray-300 border-l border-gray-300"></td>
                                                        <td className="px-4 py-2 text-right border-b border-gray-300 border-l border-gray-300"></td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>

                                {/* NORMAL TIMESHEET 섹션 */}
                                <div className="flex flex-col gap-6 bg-white border border-gray-200 rounded-xl p-6">
                                    {/* NORMAL TIMESHEET 제목 - 크고 굵게 */}
                                    <h2 className="text-3xl font-bold text-black mb-2">NORMAL TIMESHEET</h2>
                                    
                                    {/* Hours Logging Table */}
                                    <div className="flex flex-col gap-4">
                                        <div className="border border-gray-300 rounded overflow-hidden">
                                            <table className="w-full table-fixed text-[11px] min-w-full border-collapse">
                                                <colgroup>
                                                    <col className="w-[56px]" />
                                                    <col className="w-[68px]" />
                                                    <col className="w-[52px]" />
                                                    <col className="w-[52px]" />
                                                    <col className="w-[56px]" />
                                                    <col className="w-[74px]" />
                                                    <col className="w-[74px]" />
                                                    <col className="w-[74px]" />
                                                    <col className="w-[82px]" />
                                                    <col className="w-[66px]" />
                                                    <col className="w-[76px]" />
                                                    <col className="w-[58px]" />
                                                </colgroup>
                                                <thead className="bg-gray-100">
                                                    {/* 1행: Indication of date & time / Total Hours / Split of Hours / Mark Sea-going */}
                                                    <tr>
                                                        <th colSpan={4} className="px-1 py-2 text-center font-semibold text-gray-900 border-b border-r border-gray-300">
                                                            Indication of date &amp; time
                                                        </th>
                                                        <th rowSpan={3} className="px-1 py-2 text-center font-semibold text-gray-900 border-b border-r border-gray-300 leading-tight">
                                                            Total
                                                            <br />
                                                            Hours
                                                        </th>
                                                        <th colSpan={6} className="px-1 py-2 text-center font-semibold text-gray-900 border-b border-r border-gray-300">
                                                            Split of Hours
                                                        </th>
                                                        <th rowSpan={3} className="px-1 py-2 text-center font-semibold text-gray-900 border-b border-gray-300 leading-tight">
                                                            Mark Sea-going<br />Vessel (x)
                                                        </th>
                                                    </tr>
                                                    {/* 2행: Year/Day/Date/Time From/Time To + 상위 그룹 헤더 */}
                                                    <tr>
                                                        <th className="px-1 py-2 text-center font-medium text-gray-700 border-b border-r border-gray-300">
                                                            Year
                                                        </th>
                                                        <th className="px-1 py-2 text-center font-medium text-gray-900 bg-white border-b border-r border-gray-300">
                                                            {timesheetRows.length > 0 ? timesheetRows[0].date.split("-")[0] : new Date().getFullYear()}
                                                        </th>
                                                        <th rowSpan={2} className="px-1 py-2 text-center font-medium text-gray-700 border-b border-r border-gray-300 leading-tight">
                                                            Time
                                                            <br />
                                                            From
                                                        </th>
                                                        <th rowSpan={2} className="px-1 py-2 text-center font-medium text-gray-700 border-b border-r border-gray-300 leading-tight">
                                                            Time
                                                            <br />
                                                            To
                                                        </th>
                                                        <th colSpan={2} className="px-1 py-1 text-center font-medium text-gray-700 border-b border-r border-gray-300 leading-tight">
                                                            Weekdays
                                                            <br />
                                                            (with in normal working
                                                            <br />
                                                            hours,
                                                            <br />
                                                            08:00 to 17:00)
                                                        </th>
                                                        <th colSpan={2} className="px-1 py-1 text-center font-medium text-gray-700 border-b border-r border-gray-300 leading-tight">
                                                            Saturday, Sunday, and
                                                            <br />
                                                            local holidays
                                                        </th>
                                                        <th colSpan={2} className="px-1 py-1 text-center font-medium text-gray-700 border-b border-r border-gray-300 leading-tight">
                                                            Travel
                                                            <br />
                                                            Hours**
                                                        </th>
                                                    </tr>
                                                    {/* 3행: Day/Date 하위 헤더 + Split of Hours 하위 라벨 */}
                                                    <tr>
                                                        <th className="px-1 py-1 text-center font-medium text-gray-700 border-b border-r border-gray-300">
                                                            Day
                                                        </th>
                                                        <th className="px-1 py-1 text-center font-medium text-gray-700 border-b border-r border-gray-300">
                                                            Date
                                                        </th>
                                                        <th className="px-1 py-1 text-center font-medium text-gray-700 border-b border-r border-gray-300 leading-tight">
                                                            Normal
                                                            <br />
                                                            Working
                                                        </th>
                                                        <th className="px-1 py-1 text-center font-medium text-gray-700 border-b border-r border-gray-300 leading-tight">
                                                            After Normal
                                                            <br />
                                                            Working
                                                        </th>
                                                        <th className="px-1 py-1 text-center font-medium text-gray-700 border-b border-r border-gray-300 leading-tight">
                                                            Normal
                                                            <br />
                                                            Working
                                                        </th>
                                                        <th className="px-1 py-1 text-center font-medium text-gray-700 border-b border-r border-gray-300 leading-tight">
                                                            After Normal
                                                            <br />
                                                            Working
                                                        </th>
                                                        <th className="px-1 py-1 text-center font-medium text-gray-700 border-b border-r border-gray-300">
                                                            Weekday
                                                        </th>
                                                        <th className="px-1 py-1 text-center font-medium text-gray-700 border-b border-r border-gray-300 leading-tight">
                                                            Weekend
                                                            <br />
                                                            / Holiday
                                                        </th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {timesheetRows.map((row) => (
                                                            <tr key={row.rowId} className="border-b border-gray-300">
                                                                <td className="px-2 py-3 text-center border-r border-gray-300">{row.hideDayDate ? "" : row.day}</td>
                                                                <td className="px-2 py-3 text-center border-r border-gray-300">{row.hideDayDate ? "" : row.dateFormatted}</td>
                                                                <td className="px-2 py-3 text-center border-r border-gray-300">{row.timeFrom}</td>
                                                                <td className="px-2 py-3 text-center border-r border-gray-300">{row.timeTo}</td>
                                                                <td className="px-2 py-3 text-center border-r border-gray-300 font-bold">{row.totalHours}</td>
                                                                <td className="px-2 py-3 text-center border-r border-gray-300">
                                                                    {row.weekdayNormal > 0 ? row.weekdayNormal : ""}
                                                                </td>
                                                                <td className="px-2 py-3 text-center border-r border-gray-300">
                                                                    {row.weekdayAfter > 0 ? row.weekdayAfter : ""}
                                                                </td>
                                                                <td className="px-2 py-3 text-center border-r border-gray-300">
                                                                    {row.weekendNormal > 0 ? row.weekendNormal : ""}
                                                                </td>
                                                                <td className="px-2 py-3 text-center border-r border-gray-300">
                                                                    {row.weekendAfter > 0 ? row.weekendAfter : ""}
                                                                </td>
                                                                <td className="px-2 py-3 text-center border-r border-gray-300">
                                                                    {row.travelWeekday > 0 ? row.travelWeekday : ""}
                                                                </td>
                                                                <td className="px-2 py-3 text-center border-r border-gray-300">
                                                                    {row.travelWeekend > 0 ? row.travelWeekend : ""}
                                                                </td>
                                                                <td className="px-2 py-3 text-center"></td>
                                                            </tr>
                                                    ))}
                                                    {/* Total Row */}
                                                    {timesheetRows.length > 0 && (
                                                        <tr className="bg-gray-100 font-semibold">
                                                            <td colSpan={4} className="px-2 py-2 text-center border-r border-gray-300">Total</td>
                                                            <td className="px-2 py-2 text-center border-r border-gray-300 font-bold">
                                                                {Math.round(timesheetRows.reduce((sum, row) => sum + row.totalHours, 0) * 10) / 10}
                                                            </td>
                                                            <td className="px-2 py-2 text-center border-r border-gray-300 font-bold">
                                                                {Math.round(timesheetRows.reduce((sum, row) => sum + row.weekdayNormal, 0) * 10) / 10}
                                                            </td>
                                                            <td className="px-2 py-2 text-center border-r border-gray-300 font-bold">
                                                                {Math.round(timesheetRows.reduce((sum, row) => sum + row.weekdayAfter, 0) * 10) / 10}
                                                            </td>
                                                            <td className="px-2 py-2 text-center border-r border-gray-300 font-bold">
                                                                {Math.round(timesheetRows.reduce((sum, row) => sum + row.weekendNormal, 0) * 10) / 10}
                                                            </td>
                                                            <td className="px-2 py-2 text-center border-r border-gray-300 font-bold">
                                                                {Math.round(timesheetRows.reduce((sum, row) => sum + row.weekendAfter, 0) * 10) / 10}
                                                            </td>
                                                            <td className="px-2 py-2 text-center border-r border-gray-300 font-bold">
                                                                {Math.round(timesheetRows.reduce((sum, row) => sum + row.travelWeekday, 0) * 10) / 10}
                                                            </td>
                                                            <td className="px-2 py-2 text-center border-r border-gray-300 font-bold">
                                                                {Math.round(timesheetRows.reduce((sum, row) => sum + row.travelWeekend, 0) * 10) / 10}
                                                            </td>
                                                            <td className="px-2 py-2 text-center font-bold">0</td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
