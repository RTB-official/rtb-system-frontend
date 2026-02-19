//workloadDetailApi.ts
import { getWorkloadData, type WorkloadEntry } from "./workloadApi";

/**
 * 시간 문자열을 분 단위로 변환
 */
function normalizeTimeHHMM(timeStr: string | null | undefined): string | null {
    if (!timeStr) return null;
    return timeStr.slice(0, 5);
}

function timeToMinutes(timeStr: string | null | undefined): number {
    const t = normalizeTimeHHMM(timeStr);
    if (!t) return 0;
    const [hours, minutes] = t.split(":").map(Number);
    return (hours || 0) * 60 + (minutes || 0);
}

function addDays(dateStr: string, days: number): string {
    const d = new Date(`${dateStr}T00:00:00`);
    d.setDate(d.getDate() + days);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

function splitEntryByDate(entry: WorkloadEntry): Array<{
    date: string;
    timeFrom: string;
    timeTo: string;
    hours: number;
}> {
    if (!entry.date_from || !entry.date_to) return [];
    const tf = normalizeTimeHHMM(entry.time_from);
    const tt = normalizeTimeHHMM(entry.time_to);
    if (!tf || !tt) return [];

    if (entry.date_from === entry.date_to) {
        const hours = calculateHours(
            entry.date_from,
            tf,
            entry.date_to,
            tt
        );
        if (hours <= 0) return [];
        return [
            {
                date: entry.date_from,
                timeFrom: tf,
                timeTo: tt,
                hours,
            },
        ];
    }

    const segments: Array<{
        date: string;
        timeFrom: string;
        timeTo: string;
        hours: number;
    }> = [];

    // first day: time_from ~ 24:00
    const fromMinutes = timeToMinutes(tf);
    const minutesToEnd = 24 * 60 - fromMinutes;
    if (minutesToEnd > 0) {
        segments.push({
            date: entry.date_from,
            timeFrom: tf,
            timeTo: "24:00",
            hours: minutesToEnd / 60,
        });
    }

    // middle full days
    let cursor = addDays(entry.date_from, 1);
    while (cursor < entry.date_to) {
        segments.push({
            date: cursor,
            timeFrom: "00:00",
            timeTo: "24:00",
            hours: 24,
        });
        cursor = addDays(cursor, 1);
    }

    // last day: 00:00 ~ time_to
    const toMinutes = timeToMinutes(tt);
    if (toMinutes > 0) {
        segments.push({
            date: entry.date_to,
            timeFrom: "00:00",
            timeTo: tt,
            hours: toMinutes / 60,
        });
    }

    return segments;
}

function assignSegmentToWorkIndex(
    workSegments: Array<{ timeFrom: string; timeTo: string }>,
    seg: { timeFrom: string; timeTo: string }
): number | null {
    if (workSegments.length === 0) return null;

    const segStart = timeToMinutes(seg.timeFrom);
    const segEnd = timeToMinutes(seg.timeTo);
    const workRanges = workSegments.map((w) => ({
        start: timeToMinutes(w.timeFrom),
        end: timeToMinutes(w.timeTo),
    }));

    // exact boundary match: pre-work travel -> attach to upcoming work
    for (let i = 0; i < workRanges.length; i++) {
        const w = workRanges[i];
        if (segEnd === w.start) return i;
    }

    // exact boundary match: post-work travel -> attach to finished work
    for (let i = 0; i < workRanges.length; i++) {
        const w = workRanges[i];
        if (segStart === w.end) return i;
    }

    // overlap with a work segment
    for (let i = 0; i < workRanges.length; i++) {
        const w = workRanges[i];
        if (segStart < w.end && segEnd > w.start) return i;
    }

    // before first work
    if (segEnd <= workRanges[0].start) return 0;

    // after last work
    const lastIdx = workRanges.length - 1;
    if (segStart >= workRanges[lastIdx].end) return lastIdx;

    // between works -> attach to previous work segment
    for (let i = 0; i < workRanges.length - 1; i++) {
        const current = workRanges[i];
        const next = workRanges[i + 1];
        if (segStart >= current.end && segEnd <= next.start) {
            return i;
        }
    }

    return lastIdx;
}

/**
 * 두 시간 사이의 차이를 시간 단위로 계산
 */
function calculateHours(
    dateFrom: string | null,
    timeFrom: string | null,
    dateTo: string | null,
    timeTo: string | null
): number {
    if (!dateFrom || !dateTo) return 0;
    if (!timeFrom || !timeTo) return 0;

    const fromMinutes = timeToMinutes(timeFrom);
    const toMinutes = timeToMinutes(timeTo);

    // 날짜가 같은 경우
    if (dateFrom === dateTo) {
        const diffMinutes = toMinutes - fromMinutes;
        return diffMinutes / 60;
    }

    // 날짜가 다른 경우 (다음 날로 넘어가는 경우)
    const tf = normalizeTimeHHMM(timeFrom);
    const tt = normalizeTimeHHMM(timeTo);
    if (!tf || !tt) return 0;
    
    const fromDate = new Date(`${dateFrom}T${tf}:00`);
    const toDate = new Date(`${dateTo}T${tt}:00`);
    const diffMs = toDate.getTime() - fromDate.getTime();
    return diffMs / (1000 * 60 * 60);
}

/**
 * 시간을 "X시간 Y분" 형식으로 포맷팅
 */
function formatHours(hours: number): string {
    if (hours === 0) return "0시간";
    const wholeHours = Math.floor(hours);
    const minutes = Math.round((hours - wholeHours) * 60);
    
    if (minutes === 0) {
        return `${wholeHours}시간`;
    }
    return `${wholeHours}시간 ${minutes}분`;
}

/**
 * 작업자별 상세 워크로드 데이터 타입
 */
export interface WorkloadDetailEntry {
    id: string;
    date: string; // YYYY-MM-DD
    vesselName: string | null;
    workTime: number; // 시간 단위
    timeFrom: string | null; // HH:mm
    timeTo: string | null; // HH:mm
    travelTime: number; // 시간 단위
    waitTime: number; // 시간 단위
    workLogId: number;
}

export interface WorkerWorkloadSummary {
    name: string;
    totalWork: number; // 시간 단위
    totalTravel: number; // 시간 단위
    totalWait: number; // 시간 단위
}

/**
 * 특정 작업자의 상세 워크로드 데이터 조회
 */
export async function getWorkerWorkloadDetail(
    personName: string,
    filters?: {
        year?: number;
        month?: number;
    }
): Promise<{
    summary: WorkerWorkloadSummary;
    entries: WorkloadDetailEntry[];
}> {
    // 모든 워크로드 데이터 조회
    const allEntries = await getWorkloadData({ ...filters, includeDrafts: true });

    // 해당 작업자의 데이터만 필터링
    const workerEntries = allEntries.filter(
        (entry) => entry.person_name === personName
    );

    // 날짜별로 그룹화 및 집계
    const dateMap = new Map<string, {
        vesselName: string | null;
        travelTime: number;
        waitTime: number;
        workSegments: Array<{
            timeFrom: string;
            timeTo: string;
            hours: number;
        }>;
        travelSegments: Array<{
            timeFrom: string;
            timeTo: string;
            hours: number;
        }>;
        waitSegments: Array<{
            timeFrom: string;
            timeTo: string;
            hours: number;
        }>;
        workLogId: number;
    }>();

    for (const entry of workerEntries) {
        if (!entry.date_from) continue;

        const dateKey = entry.date_from;
        
        if (!dateMap.has(dateKey)) {
            dateMap.set(dateKey, {
                vesselName: entry.vessel,
                travelTime: 0,
                waitTime: 0,
                workSegments: [],
                travelSegments: [],
                waitSegments: [],
                workLogId: entry.work_log_id,
            });
        }

        const dayData = dateMap.get(dateKey)!;

        const segments = splitEntryByDate(entry);
        if (segments.length === 0) continue;

        for (const seg of segments) {
            const segDate = seg.date;
            if (!dateMap.has(segDate)) {
                dateMap.set(segDate, {
                    vesselName: entry.vessel,
                    travelTime: 0,
                    waitTime: 0,
                    workSegments: [],
                    travelSegments: [],
                    waitSegments: [],
                    workLogId: entry.work_log_id,
                });
            }

            const segData = dateMap.get(segDate)!;

            if (entry.desc_type === "작업") {
                segData.workSegments.push({
                    timeFrom: seg.timeFrom,
                    timeTo: seg.timeTo,
                    hours: seg.hours,
                });
            } else if (entry.desc_type === "이동") {
                segData.travelSegments.push({
                    timeFrom: seg.timeFrom,
                    timeTo: seg.timeTo,
                    hours: seg.hours,
                });
            } else if (entry.desc_type === "대기") {
                segData.waitSegments.push({
                    timeFrom: seg.timeFrom,
                    timeTo: seg.timeTo,
                    hours: seg.hours,
                });
            }
        }
    }

    // 날짜별 상세 데이터 생성
    const entries: WorkloadDetailEntry[] = Array.from(dateMap.entries())
        .flatMap(([date, data]) => {
            const workSegments = data.workSegments.sort((a, b) =>
                a.timeFrom.localeCompare(b.timeFrom)
            );

            if (workSegments.length === 0) {
                const travelTotal = data.travelSegments.reduce(
                    (sum, s) => sum + s.hours,
                    0
                );
                const waitTotal = data.waitSegments.reduce(
                    (sum, s) => sum + s.hours,
                    0
                );
                return [
                    {
                        id: `${personName}-${date}-0`,
                        date,
                        vesselName: data.vesselName,
                        workTime: 0,
                        timeFrom: null,
                        timeTo: null,
                        travelTime: travelTotal,
                        waitTime: waitTotal,
                        workLogId: data.workLogId,
                    },
                ];
            }

            const travelByIndex = new Array(workSegments.length).fill(0);
            for (const t of data.travelSegments) {
                const idx = assignSegmentToWorkIndex(workSegments, t);
                if (idx !== null) travelByIndex[idx] += t.hours;
            }

            const waitByIndex = new Array(workSegments.length).fill(0);
            for (const w of data.waitSegments) {
                const idx = assignSegmentToWorkIndex(workSegments, w);
                if (idx !== null) waitByIndex[idx] += w.hours;
            }

            return workSegments.map((seg, index) => ({
                id: `${personName}-${date}-${index}`,
                date,
                vesselName: data.vesselName,
                workTime: seg.hours,
                timeFrom: seg.timeFrom,
                timeTo: seg.timeTo,
                travelTime: travelByIndex[index] || 0,
                waitTime: waitByIndex[index] || 0,
                workLogId: data.workLogId,
            }));
        })
        .sort((a, b) => {
            if (a.date !== b.date) return a.date.localeCompare(b.date);
            const aFrom = a.timeFrom ?? "00:00";
            const bFrom = b.timeFrom ?? "00:00";
            return aFrom.localeCompare(bFrom);
        }); // 날짜/시간 순 정렬

    // 전체 집계
    const summary: WorkerWorkloadSummary = {
        name: personName,
        totalWork: entries.reduce((sum, e) => sum + e.workTime, 0),
        totalTravel: entries.reduce((sum, e) => sum + e.travelTime, 0),
        totalWait: entries.reduce((sum, e) => sum + e.waitTime, 0),
    };

    return { summary, entries };
}

/**
 * 시간을 "X시간 Y분" 형식으로 포맷팅
 */
export { formatHours };

/**
 * 날짜 포맷팅 (YYYY-MM-DD -> YYYY. MM. DD.(요일))
 */
export function formatDetailDate(dateStr: string): string {
    const date = new Date(dateStr + "T00:00:00");
    const days = ["일", "월", "화", "수", "목", "금", "토"];
    const dayOfWeek = date.getDay();
    const dayLabel = days[dayOfWeek];
    
    return `${date.getFullYear()}. ${date.getMonth() + 1}. ${date.getDate()}.(${dayLabel})`;
}

/**
 * 시간 범위 포맷팅
 */
export function formatTimeRange(
    timeFrom: string | null,
    timeTo: string | null
): string {
    const from = normalizeTimeHHMM(timeFrom);
    const to = normalizeTimeHHMM(timeTo);
    if (!from && !to) return "-";
    if (!from) return `-${to}`;
    if (!to) return `${from}-`;
    return `${from}-${to}`;
}
