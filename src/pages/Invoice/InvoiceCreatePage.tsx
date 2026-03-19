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
    travelWeekdayDisplay?: string;
    travelWeekendDisplay?: string;
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

    const formatDateKey = (date: Date): string => {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
            2,
            "0"
        )}-${String(date.getDate()).padStart(2, "0")}`;
    };

    const getAdjustedTravelDateTimes = (
        entry: InvoiceTimesheetEntry
    ): Pick<InvoiceTimesheetEntry, "dateFrom" | "dateTo" | "timeFrom" | "timeTo"> => {
        const originalTimeFrom = entry.timeFrom || "";
        const originalTimeTo = entry.timeTo || "";

        if (
            entry.descType !== "이동" ||
            !entry.dateFrom ||
            !entry.dateTo ||
            !originalTimeFrom ||
            !originalTimeTo
        ) {
            return {
                dateFrom: entry.dateFrom,
                dateTo: entry.dateTo,
                timeFrom: entry.timeFrom,
                timeTo: entry.timeTo,
            };
        }

        const fixedHours = getHomeTravelHours(entry.location);
        if (!fixedHours) {
            return {
                dateFrom: entry.dateFrom,
                dateTo: entry.dateTo,
                timeFrom: entry.timeFrom,
                timeTo: entry.timeTo,
            };
        }

        const details = entry.details ?? "";
        const containsHome =
            details.includes("자택") ||
            entry.moveFrom === "자택" ||
            entry.moveTo === "자택";

        if (!containsHome) {
            return {
                dateFrom: entry.dateFrom,
                dateTo: entry.dateTo,
                timeFrom: entry.timeFrom,
                timeTo: entry.timeTo,
            };
        }

        const originalStart = toDateSafe(entry.dateFrom, originalTimeFrom);
        const originalEnd = toDateSafe(entry.dateTo, originalTimeTo);

        if (
            Number.isNaN(originalStart.getTime()) ||
            Number.isNaN(originalEnd.getTime()) ||
            originalEnd <= originalStart
        ) {
            return {
                dateFrom: entry.dateFrom,
                dateTo: entry.dateTo,
                timeFrom: entry.timeFrom,
                timeTo: entry.timeTo,
            };
        }

        const fromHome =
            entry.moveFrom === "자택" || details.trim().startsWith("자택→");
        const toHome =
            entry.moveTo === "자택" ||
            details.includes("→자택 이동.") ||
            details.endsWith("→자택");

        if (fromHome) {
            const adjustedStart = new Date(
                originalEnd.getTime() - fixedHours * 60 * 60 * 1000
            );
            return {
                dateFrom: formatDateKey(adjustedStart),
                dateTo: formatDateKey(originalEnd),
                timeFrom: formatTimeHHMM(adjustedStart),
                timeTo: formatTimeHHMM(originalEnd),
            };
        }

        const adjustedEnd = new Date(
            originalStart.getTime() + fixedHours * 60 * 60 * 1000
        );

        if (toHome) {
            return {
                dateFrom: formatDateKey(originalStart),
                dateTo: formatDateKey(adjustedEnd),
                timeFrom: formatTimeHHMM(originalStart),
                timeTo: formatTimeHHMM(adjustedEnd),
            };
        }

        return {
            dateFrom: formatDateKey(originalStart),
            dateTo: formatDateKey(adjustedEnd),
            timeFrom: formatTimeHHMM(originalStart),
            timeTo: formatTimeHHMM(adjustedEnd),
        };
    };

    const getTravelMergeKey = (entry: InvoiceTimesheetEntry): string => {
        return [
            entry.workLogId,
            entry.descType,
            entry.moveFrom ?? "",
            entry.moveTo ?? "",
            (entry.details ?? "").trim(),
            normalizeLocationName(entry.location),
            [...(entry.persons ?? [])].sort().join("|"),
        ].join("::");
    };

    const mergeContinuousTravelEntries = (
        entries: InvoiceTimesheetEntry[]
    ): InvoiceTimesheetEntry[] => {
        const sortedEntries = [...entries].sort((a, b) => {
            const aStart = getEntryStartTime(a) ?? Number.MAX_SAFE_INTEGER;
            const bStart = getEntryStartTime(b) ?? Number.MAX_SAFE_INTEGER;

            if (aStart !== bStart) {
                return aStart - bStart;
            }

            const aEnd = getEntryEndTime(a) ?? Number.MAX_SAFE_INTEGER;
            const bEnd = getEntryEndTime(b) ?? Number.MAX_SAFE_INTEGER;
            return aEnd - bEnd;
        });

        const merged: InvoiceTimesheetEntry[] = [];
        const latestMergedIndexByKey = new Map<string, number>();

        sortedEntries.forEach((entry) => {
            const mergeKey = getTravelMergeKey(entry);
            const lastMergedIndex = latestMergedIndexByKey.get(mergeKey);
            const lastEntry =
                lastMergedIndex !== undefined ? merged[lastMergedIndex] : null;
            const lastEnd = lastEntry ? getEntryEndTime(lastEntry) : null;
            const currentStart = getEntryStartTime(entry);

            if (
                lastEntry &&
                lastEntry.descType === "이동" &&
                entry.descType === "이동" &&
                lastEnd !== null &&
                currentStart !== null &&
                lastEnd === currentStart
            ) {
                lastEntry.dateTo = entry.dateTo;
                lastEntry.timeTo = entry.timeTo;
                return;
            }

            merged.push({ ...entry });
            latestMergedIndexByKey.set(mergeKey, merged.length - 1);
        });

        return merged;
    };

    const hasHomeInTravel = (entry: InvoiceTimesheetEntry): boolean => {
        const details = entry.details ?? "";
        return (
            details.includes("자택") ||
            entry.moveFrom === "자택" ||
            entry.moveTo === "자택"
        );
    };

    const getFinalDestination = (entry: InvoiceTimesheetEntry): string => {
        const moveTo = entry.moveTo?.trim();
        if (moveTo) {
            return moveTo;
        }

        const details = (entry.details ?? "").replace(/\s*이동\.?\s*$/, "").trim();
        if (!details.includes("→")) {
            return details;
        }

        return details.split("→").pop()?.trim() ?? "";
    };

    const normalizeLocationName = (value: string | null | undefined): string => {
        if (!value) return "";

        const normalized = value.trim();
        if (!normalized) return "";

        if (normalized === "HHI") return "HD중공업(해양)";
        if (normalized === "HMD") return "HD미포";
        if (normalized === "HSHI") return "HD삼호";

        return normalized;
    };

    const isDestinationWorkPlace = (entry: InvoiceTimesheetEntry): boolean => {
        const destination = normalizeLocationName(getFinalDestination(entry));
        const workPlace = normalizeLocationName(getPrimaryLocation(entry.location));

        if (!destination || !workPlace) {
            return false;
        }

        return destination === workPlace;
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

    const shiftDateByDays = (dateString: string, days: number): string => {
        const date = new Date(`${dateString}T00:00:00`);
        date.setDate(date.getDate() + days);

        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, "0");
        const dd = String(date.getDate()).padStart(2, "0");

        return `${yyyy}-${mm}-${dd}`;
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
                const rawEntries: InvoiceTimesheetEntry[] = validData.flatMap(data =>
                    data.entries.map(entry => ({
                        ...entry,
                        workLogId: data.workLog.id,
                        location: data.workLog.location,
                    }))
                );
                const allEntries = mergeContinuousTravelEntries(rawEntries);

                await loadHolidayDates(
                    allEntries.flatMap((entry) =>
                        enumerateDateRange(entry.dateFrom, entry.dateTo)
                    )
                );

                // 날짜별로 그룹화
                const entriesByDate = new Map<string, InvoiceTimesheetEntry[]>();
                allEntries.forEach(entry => {
                    if (!entry.dateFrom) return;
                    const adjustedEntry = {
                        ...entry,
                        ...getAdjustedTravelDateTimes(entry),
                    };
                    if (!adjustedEntry.dateFrom || !adjustedEntry.dateTo) return;
                    
                    // 날짜가 넘어가는 경우 분할
                    if (adjustedEntry.dateFrom === adjustedEntry.dateTo) {
                        const startTime = getEntryStartTime(adjustedEntry);
                        const endTime = getEntryEndTime(adjustedEntry);
                        if (
                            startTime === null ||
                            endTime === null ||
                            endTime <= startTime
                        ) {
                            return;
                        }

                        const date = adjustedEntry.dateFrom;
                        if (!entriesByDate.has(date)) {
                            entriesByDate.set(date, []);
                        }
                        entriesByDate.get(date)!.push({
                            ...adjustedEntry,
                        });
                    } else {
                        // 여러 날짜에 걸치는 경우 각 날짜별로 분할
                        const startDate = new Date(`${adjustedEntry.dateFrom}T00:00:00`);
                        const endDate = new Date(`${adjustedEntry.dateTo}T00:00:00`);
                        let currentDate = new Date(startDate);

                        while (currentDate <= endDate) {
                            const dateStr = formatDateKey(currentDate);
                            if (!entriesByDate.has(dateStr)) {
                                entriesByDate.set(dateStr, []);
                            }

                            let timeFrom = adjustedEntry.timeFrom || "00:00";
                            let timeTo = adjustedEntry.timeTo || "24:00";

                            if (
                                dateStr === adjustedEntry.dateFrom &&
                                dateStr !== adjustedEntry.dateTo
                            ) {
                                timeTo = "24:00";
                            } else if (
                                dateStr === adjustedEntry.dateTo &&
                                dateStr !== adjustedEntry.dateFrom
                            ) {
                                timeFrom = "00:00";
                            } else if (
                                dateStr !== adjustedEntry.dateFrom &&
                                dateStr !== adjustedEntry.dateTo
                            ) {
                                timeFrom = "00:00";
                                timeTo = "24:00";
                            }

                            const segmentedEntry: InvoiceTimesheetEntry = {
                                ...adjustedEntry,
                                dateFrom: dateStr,
                                dateTo: dateStr,
                                timeFrom,
                                timeTo,
                            };
                            const segmentStart = getEntryStartTime(segmentedEntry);
                            const segmentEnd = getEntryEndTime(segmentedEntry);

                            if (
                                segmentStart === null ||
                                segmentEnd === null ||
                                segmentEnd <= segmentStart
                            ) {
                                currentDate.setDate(currentDate.getDate() + 1);
                                continue;
                            }

                            entriesByDate.get(dateStr)!.push({
                                ...segmentedEntry,
                            });

                            currentDate.setDate(currentDate.getDate() + 1);
                        }
                    }
                });

                // 날짜별로 타임시트 행 생성
                const rows: TimesheetRow[] = [];
                const sortedDates = Array.from(entriesByDate.keys()).sort();
                const chronologicalEntries = Array.from(entriesByDate.values())
                    .flat()
                    .sort((a, b) => {
                        const aStart =
                            getEntryStartTime(a) ?? Number.MAX_SAFE_INTEGER;
                        const bStart =
                            getEntryStartTime(b) ?? Number.MAX_SAFE_INTEGER;
                        if (aStart !== bStart) return aStart - bStart;
                        const aEnd =
                            getEntryEndTime(a) ?? Number.MAX_SAFE_INTEGER;
                        const bEnd =
                            getEntryEndTime(b) ?? Number.MAX_SAFE_INTEGER;
                        return aEnd - bEnd;
                    });
                const workEntries = chronologicalEntries.filter(
                    (entry) => entry.descType === "작업"
                );
                const workDates = Array.from(
                    new Set(workEntries.map((entry) => entry.dateFrom))
                ).sort();
                const workPersonsByDate = new Map<string, Set<string>>();
                workDates.forEach((date) => {
                    const persons = new Set<string>();
                    (entriesByDate.get(date) ?? []).forEach((entry) => {
                        if (entry.descType !== "작업") return;
                        entry.persons?.forEach((person) => persons.add(person));
                    });
                    workPersonsByDate.set(date, persons);
                });
                const roundHours = (value: number): number =>
                    Math.round(value * 10) / 10;
                const formatHoursValue = (value: number): string => {
                    const rounded = roundHours(value);
                    return Number.isInteger(rounded)
                        ? String(rounded)
                        : String(rounded);
                };
                const buildTravelDisplay = (
                    moveHours: number,
                    waitingHours: number
                ): string => {
                    const roundedMove = roundHours(moveHours);
                    const roundedWaiting = roundHours(waitingHours);

                    if (roundedMove > 0 && roundedWaiting > 0) {
                        return `${formatHoursValue(roundedMove)}+${formatHoursValue(roundedWaiting)}`;
                    }

                    if (roundedMove > 0) {
                        return formatHoursValue(roundedMove);
                    }

                    if (roundedWaiting > 0) {
                        return formatHoursValue(roundedWaiting);
                    }

                    return "";
                };

                sortedDates.forEach((date) => {
                    const dayEntries = entriesByDate.get(date)!;
                    if (dayEntries.length === 0) return;

                    const sortedDayEntries = [...dayEntries].sort((a, b) => {
                        const aStart =
                            getEntryStartTime(a) ?? Number.MAX_SAFE_INTEGER;
                        const bStart =
                            getEntryStartTime(b) ?? Number.MAX_SAFE_INTEGER;
                        if (aStart !== bStart) return aStart - bStart;
                        const aEnd =
                            getEntryEndTime(a) ?? Number.MAX_SAFE_INTEGER;
                        const bEnd =
                            getEntryEndTime(b) ?? Number.MAX_SAFE_INTEGER;
                        return aEnd - bEnd;
                    });
                    const dayWorkEntries = sortedDayEntries.filter(
                        (entry) => entry.descType === "작업"
                    );
                    const isWeekendDay = isHoliday(date);

                    const buildSimpleRow = (): TimesheetRow => {
                        let weekdayNormal = 0;
                        let weekdayAfter = 0;
                        let weekendNormal = 0;
                        let weekendAfter = 0;
                        let travelWeekday = 0;
                        let travelWeekend = 0;
                        let moveTravelWeekday = 0;
                        let moveTravelWeekend = 0;
                        let waitingWeekday = 0;
                        let waitingWeekend = 0;
                        let totalHours = 0;
                        let earliest = "24:00";
                        let latest = "00:00";
                        const workers = new Set<string>();

                        sortedDayEntries.forEach((entry) => {
                            if (entry.timeFrom && entry.timeFrom < earliest) {
                                earliest = entry.timeFrom;
                            }
                            if (entry.timeTo && entry.timeTo > latest) {
                                latest = entry.timeTo;
                            }

                            if (entry.descType === "이동" || entry.descType === "대기") {
                                const travelHours =
                                    entry.descType === "이동"
                                        ? calculateTravelHours(entry)
                                        : classifyWorkingHours(entry).totalHours;
                                totalHours += travelHours;
                                if (isWeekendDay) {
                                    travelWeekend += travelHours;
                                    if (entry.descType === "이동") {
                                        moveTravelWeekend += travelHours;
                                    } else {
                                        waitingWeekend += travelHours;
                                    }
                                } else {
                                    travelWeekday += travelHours;
                                    if (entry.descType === "이동") {
                                        moveTravelWeekday += travelHours;
                                    } else {
                                        waitingWeekday += travelHours;
                                    }
                                }
                            } else {
                                const classified = classifyWorkingHours(entry);
                                totalHours += classified.totalHours;
                                if (isWeekendDay) {
                                    weekendNormal += classified.normalHours;
                                    weekendAfter += classified.afterHours;
                                } else {
                                    weekdayNormal += classified.normalHours;
                                    weekdayAfter += classified.afterHours;
                                }
                            }

                            entry.persons?.forEach((person) => workers.add(person));
                        });

                        return {
                            rowId: `${date}-main`,
                            date,
                            day: getDayOfWeek(date),
                            dateFormatted: formatDate(date),
                            timeFrom: earliest.split(":")[0],
                            timeTo: latest.split(":")[0],
                            totalHours: roundHours(totalHours),
                            weekdayNormal: roundHours(weekdayNormal),
                            weekdayAfter: roundHours(weekdayAfter),
                            weekendNormal: roundHours(weekendNormal),
                            weekendAfter: roundHours(weekendAfter),
                            travelWeekday: roundHours(travelWeekday),
                            travelWeekend: roundHours(travelWeekend),
                            travelWeekdayDisplay: buildTravelDisplay(
                                moveTravelWeekday,
                                waitingWeekday
                            ),
                            travelWeekendDisplay: buildTravelDisplay(
                                moveTravelWeekend,
                                waitingWeekend
                            ),
                            description: Array.from(workers).join(", "),
                        };
                    };

                    if (dayWorkEntries.length === 0) {
                        rows.push(buildSimpleRow());
                        return;
                    }

                    const firstWorkStart = Math.min(
                        ...dayWorkEntries
                            .map((entry) => getEntryStartTime(entry))
                            .filter((value): value is number => value !== null)
                    );
                    const lastWorkEnd = Math.max(
                        ...dayWorkEntries
                            .map((entry) => getEntryEndTime(entry))
                            .filter((value): value is number => value !== null)
                    );
                    const firstWorkTime = formatTimeHHMM(new Date(firstWorkStart));
                    const lastWorkTime = formatTimeHHMM(new Date(lastWorkEnd));

                    const currentWorkPersons = Array.from(
                        workPersonsByDate.get(date) ?? new Set<string>()
                    ).sort();
                    const previousDate = shiftDateByDays(date, -1);
                    const nextDate = shiftDateByDays(date, 1);
                    const previousWorkPersons =
                        workPersonsByDate.get(previousDate) ?? new Set<string>();
                    const nextWorkPersons =
                        workPersonsByDate.get(nextDate) ?? new Set<string>();
                    const hasNextCalendarWorkDate = workPersonsByDate.has(nextDate);

                    const getWorkingMetricsForEntries = (
                        entries: InvoiceTimesheetEntry[]
                    ) => {
                        let normal = 0;
                        let after = 0;

                        entries.forEach((entry) => {
                            if (entry.descType !== "작업") {
                                return;
                            }

                            const classified = classifyWorkingHours(entry);
                            normal += classified.normalHours;
                            after += classified.afterHours;
                        });

                        return {
                            normal: roundHours(normal),
                            after: roundHours(after),
                            total: roundHours(normal + after),
                        };
                    };

                    const getWaitingHoursForEntries = (
                        entries: InvoiceTimesheetEntry[]
                    ) => {
                        let total = 0;

                        entries.forEach((entry) => {
                            if (entry.descType !== "대기") {
                                return;
                            }

                            total += classifyWorkingHours(entry).totalHours;
                        });

                        return roundHours(total);
                    };

                    const getBlockSpanForEntries = (
                        entries: InvoiceTimesheetEntry[]
                    ) => {
                        let earliest: string | null = null;
                        let latest: string | null = null;

                        entries.forEach((entry) => {
                            if (
                                entry.timeFrom &&
                                (!earliest || entry.timeFrom < earliest)
                            ) {
                                earliest = entry.timeFrom;
                            }

                            if (
                                entry.timeTo &&
                                (!latest || entry.timeTo > latest)
                            ) {
                                latest = entry.timeTo;
                            }
                        });

                        return {
                            earliest: earliest ?? firstWorkTime,
                            latest: latest ?? lastWorkTime,
                        };
                    };

                    const summarizeTravelEntries = (
                        entries: InvoiceTimesheetEntry[],
                        fallbackLabel: string,
                        useFixedHomeHours: boolean
                    ) => {
                        if (entries.length === 0) {
                            return {
                                kind: "none",
                                hours: 0,
                                start: null as string | null,
                                end: null as string | null,
                                label: "",
                            };
                        }

                        const lastEntry = entries[entries.length - 1];
                        const fixedHours =
                            getHomeTravelHours(lastEntry.location) ?? 0;
                        const hasHome = entries.some((entry) =>
                            hasHomeInTravel(entry)
                        );
                        const earliest =
                            entries
                                .map((entry) => entry.timeFrom)
                                .filter((value): value is string => Boolean(value))
                                .sort()[0] ?? null;
                        const latest =
                            entries
                                .map((entry) => entry.timeTo)
                                .filter((value): value is string => Boolean(value))
                                .sort();
                        const latestValue =
                            latest.length > 0 ? latest[latest.length - 1] : null;

                        if (useFixedHomeHours && hasHome && fixedHours > 0) {
                            return {
                                kind: `${fallbackLabel}-home`,
                                hours: fixedHours,
                                start: earliest,
                                end: latestValue,
                                label: fallbackLabel,
                            };
                        }
                        const hours = entries.reduce(
                            (sum, entry) => sum + calculateRawTravelHours(entry),
                            0
                        );
                        const destination = getFinalDestination(lastEntry);

                        return {
                            kind: fallbackLabel,
                            hours: roundHours(hours),
                            start: earliest,
                            end: latestValue,
                            label: destination || "최종 철수",
                        };
                    };

                    const getPersonBlocks = (person: string) => {
                        const personEntries = sortedDayEntries.filter((entry) =>
                            (entry.persons ?? []).includes(person)
                        );
                        type PersonBlock = {
                            workEntries: InvoiceTimesheetEntry[];
                            beforeTravelEntries: InvoiceTimesheetEntry[];
                            afterTravelEntries: InvoiceTimesheetEntry[];
                        };
                        const blocks: PersonBlock[] = [];

                        let currentBlock: PersonBlock | null = null;
                        let interBlockTravelEntries: InvoiceTimesheetEntry[] = [];

                        personEntries.forEach((entry) => {
                            if (entry.descType === "이동") {
                                interBlockTravelEntries.push(entry);
                                return;
                            }

                            if (
                                currentBlock &&
                                interBlockTravelEntries.length === 0
                            ) {
                                currentBlock.workEntries.push(entry);
                                return;
                            }

                            let beforeTravelEntriesForNext =
                                interBlockTravelEntries.filter((travelEntry) =>
                                    isDestinationWorkPlace(travelEntry)
                                );

                            if (currentBlock) {
                                beforeTravelEntriesForNext =
                                    interBlockTravelEntries.filter((travelEntry) =>
                                        isDestinationWorkPlace(travelEntry)
                                    );
                                const currentAfterTravelEntries =
                                    interBlockTravelEntries.filter(
                                        (travelEntry) =>
                                            !isDestinationWorkPlace(travelEntry)
                                    );

                                currentBlock.afterTravelEntries =
                                    currentAfterTravelEntries;
                                blocks.push(currentBlock);
                            }

                            currentBlock = {
                                workEntries: [entry],
                                beforeTravelEntries: beforeTravelEntriesForNext,
                                afterTravelEntries: [],
                            };
                            interBlockTravelEntries = [];
                        });

                        if (currentBlock) {
                            const finalizedSource = currentBlock as PersonBlock;
                            const finalizedBlock = {
                                workEntries: finalizedSource.workEntries,
                                beforeTravelEntries:
                                    finalizedSource.beforeTravelEntries,
                                afterTravelEntries:
                                    interBlockTravelEntries.slice(),
                            };
                            blocks.push(finalizedBlock);
                        }

                        return blocks;
                    };

                    const getBeforeTravelSummary = (
                        person: string,
                        blockIndex: number,
                        beforeTravelEntries: InvoiceTimesheetEntry[],
                        blockStartTime: string
                    ) => {
                        if (beforeTravelEntries.length === 0) {
                            return {
                                kind: "none",
                                hours: 0,
                                start: null as string | null,
                                end: null as string | null,
                                label: "",
                            };
                        }

                        if (blockIndex === 0) {
                            if (!previousWorkPersons.has(person)) {
                                const fixedHours =
                                    getHomeTravelHours(
                                        beforeTravelEntries[0].location
                                    ) ?? 0;
                                const hasHome = beforeTravelEntries.some((entry) =>
                                    hasHomeInTravel(entry)
                                );

                                if (hasHome && fixedHours > 0) {
                                    return {
                                        kind: "initial-home",
                                        hours: fixedHours,
                                        start: shiftTimeByHours(
                                            date,
                                            blockStartTime,
                                            -fixedHours
                                        ),
                                        end: blockStartTime,
                                        label: "최초투입",
                                    };
                                }

                                return summarizeTravelEntries(
                                    beforeTravelEntries,
                                    "최초투입",
                                    false
                                );
                            }

                            return {
                                kind: "continued",
                                hours: 1,
                                start: shiftTimeByHours(date, blockStartTime, -1),
                                end: blockStartTime,
                                label: "작업지속",
                            };
                        }

                        return summarizeTravelEntries(
                            beforeTravelEntries,
                            "이동",
                            true
                        );
                    };

                    const getAfterTravelSummary = (
                        person: string,
                        blockIndex: number,
                        totalBlocks: number,
                        afterTravelEntries: InvoiceTimesheetEntry[],
                        blockEndTime: string
                    ) => {
                        if (afterTravelEntries.length === 0) {
                            return {
                                kind: "none",
                                hours: 0,
                                start: null as string | null,
                                end: null as string | null,
                                label: "",
                            };
                        }

                        if (blockIndex < totalBlocks - 1) {
                            return summarizeTravelEntries(
                                afterTravelEntries,
                                "이동",
                                true
                            );
                        }

                        if (hasNextCalendarWorkDate && nextWorkPersons.has(person)) {
                            const start = afterTravelEntries[0].timeFrom ?? blockEndTime;
                            return {
                                kind: "continued",
                                hours: 1,
                                start,
                                end: shiftTimeByHours(date, start, 1),
                                label: "작업지속",
                            };
                        }

                        return summarizeTravelEntries(
                            afterTravelEntries,
                            "최종 철수",
                            true
                        );
                    };

                    type PersonDayRow = {
                        person: string;
                        rowKey: string;
                        priority: number;
                        timeFrom: string;
                        timeTo: string;
                        totalHours: number;
                        weekdayNormal: number;
                        weekdayAfter: number;
                        weekendNormal: number;
                        weekendAfter: number;
                        travelWeekday: number;
                        travelWeekend: number;
                        travelWeekdayDisplay: string;
                        travelWeekendDisplay: string;
                        label: string;
                    };

                    const buildTravelOnlyRow = (
                        person: string,
                        entries: InvoiceTimesheetEntry[]
                    ): PersonDayRow | null => {
                        const moveEntries = entries.filter(
                            (entry) => entry.descType === "이동"
                        );
                        const travel = summarizeTravelEntries(
                            moveEntries,
                            "최종 철수",
                            true
                        );

                        if (
                            moveEntries.length === 0 ||
                            travel.hours <= 0 ||
                            !travel.start ||
                            !travel.end
                        ) {
                            return null;
                        }

                        return {
                            person,
                            rowKey: [
                                "travel-only",
                                travel.kind,
                                travel.hours,
                                travel.start,
                                travel.end,
                            ].join("|"),
                            priority: -1,
                            timeFrom: travel.start.split(":")[0],
                            timeTo: travel.end.split(":")[0],
                            totalHours: roundHours(travel.hours),
                            weekdayNormal: 0,
                            weekdayAfter: 0,
                            weekendNormal: 0,
                            weekendAfter: 0,
                            travelWeekday: isWeekendDay ? 0 : travel.hours,
                            travelWeekend: isWeekendDay ? travel.hours : 0,
                            travelWeekdayDisplay: isWeekendDay
                                ? ""
                                : buildTravelDisplay(travel.hours, 0),
                            travelWeekendDisplay: isWeekendDay
                                ? buildTravelDisplay(travel.hours, 0)
                                : "",
                            label: "",
                        };
                    };

                    const currentWorkPersonSet = new Set(currentWorkPersons);
                    const allDayPersons = Array.from(
                        new Set(
                            sortedDayEntries.flatMap((entry) => entry.persons ?? [])
                        )
                    ).sort();

                    const travelOnlyRows: PersonDayRow[] = allDayPersons.flatMap(
                        (person) => {
                            const personEntries = sortedDayEntries.filter((entry) =>
                                (entry.persons ?? []).includes(person)
                            );

                            if (!currentWorkPersonSet.has(person)) {
                                const row = buildTravelOnlyRow(person, personEntries);
                                return row ? [row] : [];
                            }

                            const firstNonMoveEntryStart = personEntries
                                .filter((entry) => entry.descType !== "이동")
                                .map((entry) => getEntryStartTime(entry))
                                .filter((value): value is number => value !== null)
                                .sort((a, b) => a - b)[0];

                            if (firstNonMoveEntryStart === undefined) {
                                return [];
                            }

                            const leadingTravelOnlyEntries = personEntries.filter(
                                (entry) =>
                                    entry.descType === "이동" &&
                                    !isDestinationWorkPlace(entry) &&
                                    (getEntryEndTime(entry) ?? Number.MAX_SAFE_INTEGER) <=
                                        firstNonMoveEntryStart
                            );

                            const row = buildTravelOnlyRow(
                                person,
                                leadingTravelOnlyEntries
                            );
                            return row ? [row] : [];
                        }
                    );

                    const personRows: PersonDayRow[] = [
                        ...travelOnlyRows,
                        ...currentWorkPersons.flatMap((person) => {
                            const blocks = getPersonBlocks(person);

                            return blocks.map((block, blockIndex) => {
                                const working = getWorkingMetricsForEntries(
                                    block.workEntries
                                );
                                const waitingHours = getWaitingHoursForEntries(
                                    block.workEntries
                                );
                                const blockSpan = getBlockSpanForEntries(
                                    block.workEntries
                                );
                                const beforeTravel = getBeforeTravelSummary(
                                    person,
                                    blockIndex,
                                    block.beforeTravelEntries,
                                    blockSpan.earliest
                                );
                                const afterTravel = getAfterTravelSummary(
                                    person,
                                    blockIndex,
                                    blocks.length,
                                    block.afterTravelEntries,
                                    blockSpan.latest
                                );
                                const travelHours = roundHours(
                                    beforeTravel.hours +
                                        afterTravel.hours +
                                        waitingHours
                                );
                                const moveTravelHours = roundHours(
                                    beforeTravel.hours + afterTravel.hours
                                );
                                const timeFrom =
                                    [
                                        beforeTravel.start,
                                        blockSpan.earliest,
                                        afterTravel.start,
                                    ]
                                        .filter(
                                            (value): value is string =>
                                                Boolean(value)
                                        )
                                        .sort()[0] ?? blockSpan.earliest;
                                const timeTo =
                                    (() => {
                                        const candidates = [
                                            blockSpan.latest,
                                            beforeTravel.end,
                                            afterTravel.end,
                                        ]
                                            .filter(
                                                (value): value is string =>
                                                    Boolean(value)
                                            )
                                            .sort();

                                        return candidates.length > 0
                                            ? candidates[candidates.length - 1]
                                            : blockSpan.latest;
                                    })();
                                const label =
                                    afterTravel.kind.startsWith("final")
                                        ? afterTravel.label
                                        : beforeTravel.kind.startsWith("initial")
                                          ? beforeTravel.label
                                          : "";
                                const priority =
                                    blockIndex === 0
                                        ? 0
                                        : afterTravel.kind.startsWith("final")
                                          ? 2
                                          : 1;

                                return {
                                    person,
                                    rowKey: [
                                        blockIndex,
                                        beforeTravel.kind,
                                        beforeTravel.hours,
                                        afterTravel.kind,
                                        afterTravel.hours,
                                        working.normal,
                                        working.after,
                                        timeFrom,
                                        timeTo,
                                    ].join("|"),
                                    priority,
                                    timeFrom: timeFrom.split(":")[0],
                                    timeTo: timeTo.split(":")[0],
                                    totalHours: roundHours(
                                        working.total + travelHours
                                    ),
                                    weekdayNormal: isWeekendDay
                                        ? 0
                                        : working.normal,
                                    weekdayAfter: isWeekendDay
                                        ? 0
                                        : working.after,
                                    weekendNormal: isWeekendDay
                                        ? working.normal
                                        : 0,
                                    weekendAfter: isWeekendDay
                                        ? working.after
                                        : 0,
                                    travelWeekday: isWeekendDay ? 0 : travelHours,
                                    travelWeekend: isWeekendDay ? travelHours : 0,
                                    travelWeekdayDisplay: isWeekendDay
                                        ? ""
                                        : buildTravelDisplay(
                                              moveTravelHours,
                                              waitingHours
                                          ),
                                    travelWeekendDisplay: isWeekendDay
                                        ? buildTravelDisplay(
                                              moveTravelHours,
                                              waitingHours
                                          )
                                        : "",
                                    label,
                                };
                            });
                        }),
                    ];

                    const groupedRows = new Map<
                        string,
                        {
                            row: PersonDayRow;
                            persons: string[];
                        }
                    >();
                    personRows.forEach((personRow) => {
                        if (!groupedRows.has(personRow.rowKey)) {
                            groupedRows.set(personRow.rowKey, {
                                row: personRow,
                                persons: [],
                            });
                        }
                        groupedRows.get(personRow.rowKey)!.persons.push(
                            personRow.person
                        );
                    });

                    const orderedRows = Array.from(groupedRows.values()).sort(
                        (a, b) => {
                            if (a.row.timeFrom !== b.row.timeFrom) {
                                return a.row.timeFrom.localeCompare(
                                    b.row.timeFrom
                                );
                            }
                            if (a.row.priority !== b.row.priority) {
                                return a.row.priority - b.row.priority;
                            }
                            if (a.persons.length !== b.persons.length) {
                                return b.persons.length - a.persons.length;
                            }
                            return a.row.timeTo.localeCompare(b.row.timeTo);
                        }
                    );

                    orderedRows.forEach((group, index) => {
                        const description = group.persons.join(", ");

                        rows.push({
                            rowId: `${date}-${index}`,
                            date,
                            day: getDayOfWeek(date),
                            dateFormatted: formatDate(date),
                            timeFrom: group.row.timeFrom,
                            timeTo: group.row.timeTo,
                            totalHours: group.row.totalHours,
                            weekdayNormal: group.row.weekdayNormal,
                            weekdayAfter: group.row.weekdayAfter,
                            weekendNormal: group.row.weekendNormal,
                            weekendAfter: group.row.weekendAfter,
                            travelWeekday: group.row.travelWeekday,
                            travelWeekend: group.row.travelWeekend,
                            travelWeekdayDisplay: group.row.travelWeekdayDisplay,
                            travelWeekendDisplay: group.row.travelWeekendDisplay,
                            description,
                            hideDayDate: index > 0,
                        });
                    });
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
                                                                {row.travelWeekdayDisplay ||
                                                                    (row.travelWeekday > 0
                                                                        ? row.travelWeekday
                                                                        : "")}
                                                            </td>
                                                            <td className="px-2 py-2 text-center border-r border-gray-300">
                                                                {row.travelWeekendDisplay ||
                                                                    (row.travelWeekend > 0
                                                                        ? row.travelWeekend
                                                                        : "")}
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

                                    {/* JOB DESCRIPTION 섹션 */}
                                    <div className="flex flex-col gap-4 bg-white border border-gray-200 rounded-xl p-6">
                                        <div className="grid grid-cols-4 gap-4">
                                            <div className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col">
                                                <div className="text-xs font-semibold text-gray-700 mb-2">SHIP NAME</div>
                                                <div className="text-sm text-gray-900">SH8300</div>
                                            </div>
                                            <div className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col">
                                                <div className="text-xs font-semibold text-gray-700 mb-2">Engineer Name and Title</div>
                                                <div className="text-sm text-gray-900">KT On / Skilled fitter</div>
                                            </div>
                                            <div className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col">
                                                <div className="text-xs font-semibold text-gray-700 mb-2">Work Order From</div>
                                                <div className="text-sm text-gray-900">Everllence ELU KOREA</div>
                                            </div>
                                            <div className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col">
                                                <div className="text-xs font-semibold text-gray-700 mb-2">Departure date &amp; time, from place</div>
                                                <div className="text-sm text-gray-900">04.Feb.2026, 06:00 from Busan</div>
                                            </div>
                                            <div className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col">
                                                <div className="text-xs font-semibold text-gray-700 mb-2">WORK PLACE</div>
                                                <div className="text-sm text-gray-900">HHI</div>
                                            </div>
                                            <div className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col">
                                                <div className="text-xs font-semibold text-gray-700 mb-2">Mechanic names and numbers</div>
                                                <div className="text-sm text-gray-900">DM Kim and 1 fitter (Total 2 fitters)</div>
                                            </div>
                                            <div className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col">
                                                <div className="text-xs font-semibold text-gray-700 mb-2">P.O No.</div>
                                                <div className="text-sm text-gray-900"></div>
                                            </div>
                                            <div className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col">
                                                <div className="text-xs font-semibold text-gray-700 mb-2">Return date &amp; time, to place</div>
                                                <div className="text-sm text-gray-900">04.Feb.2026, 19:00 to Busan</div>
                                            </div>
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
                                                                    {row.travelWeekdayDisplay ||
                                                                        (row.travelWeekday > 0
                                                                            ? row.travelWeekday
                                                                            : "")}
                                                                </td>
                                                                <td className="px-2 py-3 text-center border-r border-gray-300">
                                                                    {row.travelWeekendDisplay ||
                                                                        (row.travelWeekend > 0
                                                                            ? row.travelWeekend
                                                                            : "")}
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
