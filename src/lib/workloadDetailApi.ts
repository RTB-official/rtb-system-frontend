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

    const descType = entry.desc_type;
    const noLunch = entry.lunch_worked ?? false;

    if (entry.date_from === entry.date_to) {
        const hours = calculateHours(
            entry.date_from,
            tf,
            entry.date_to,
            tt,
            descType,
            noLunch
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
    const firstDayHours = calculateHours(
        entry.date_from,
        tf,
        entry.date_from,
        "24:00",
        descType,
        noLunch
    );
    if (firstDayHours > 0) {
        segments.push({
            date: entry.date_from,
            timeFrom: tf,
            timeTo: "24:00",
            hours: firstDayHours,
        });
    }

    // middle full days
    let cursor = addDays(entry.date_from, 1);
    while (cursor < entry.date_to) {
        const fullDayHours = calculateHours(
            cursor,
            "00:00",
            cursor,
            "24:00",
            descType,
            noLunch
        );
        if (fullDayHours > 0) {
            segments.push({
                date: cursor,
                timeFrom: "00:00",
                timeTo: "24:00",
                hours: fullDayHours,
            });
        }
        cursor = addDays(cursor, 1);
    }

    // last day: 00:00 ~ time_to
    const lastDayHours = calculateHours(
        entry.date_to,
        "00:00",
        entry.date_to,
        tt,
        descType,
        noLunch
    );
    if (lastDayHours > 0) {
        segments.push({
            date: entry.date_to,
            timeFrom: "00:00",
            timeTo: tt,
            hours: lastDayHours,
        });
    }

    return segments;
}

type TimedSegment = {
    timeFrom: string;
    timeTo: string;
    workLogId?: number;
};

function assignSegmentToWorkIndex(
    workSegments: TimedSegment[],
    seg: TimedSegment
): number | null {
    if (workSegments.length === 0) return null;

    const sameLogIndices =
        seg.workLogId != null
            ? workSegments
                  .map((w, i) => ({ w, i }))
                  .filter(({ w }) => w.workLogId === seg.workLogId)
                  .map(({ i }) => i)
            : [];
    const candidateIndices =
        sameLogIndices.length > 0
            ? sameLogIndices
            : workSegments.map((_, i) => i);

    const segStart = timeToMinutes(seg.timeFrom);
    const segEnd = timeToMinutes(seg.timeTo);
    const workRanges = candidateIndices.map((i) => ({
        index: i,
        start: timeToMinutes(workSegments[i].timeFrom),
        end: timeToMinutes(workSegments[i].timeTo),
    }));

    // exact boundary match: pre-work travel -> attach to upcoming work
    for (const w of workRanges) {
        if (segEnd === w.start) return w.index;
    }

    // exact boundary match: post-work travel -> attach to finished work
    for (const w of workRanges) {
        if (segStart === w.end) return w.index;
    }

    // overlap with a work segment
    for (const w of workRanges) {
        if (segStart < w.end && segEnd > w.start) return w.index;
    }

    // before first work
    if (segEnd <= workRanges[0].start) return workRanges[0].index;

    // after last work
    const last = workRanges[workRanges.length - 1];
    if (segStart >= last.end) return last.index;

    // between works -> attach to previous work segment
    for (let i = 0; i < workRanges.length - 1; i++) {
        const current = workRanges[i];
        const next = workRanges[i + 1];
        if (segStart >= current.end && segEnd <= next.start) {
            return current.index;
        }
    }

    return last.index;
}

/**
 * "24:00" 같은 시간을 Date로 안전하게 변환(24시는 다음날 00시로 처리)
 */
function toDateSafe(date: string, time: string): Date {
    if (!date || !time) return new Date("Invalid");
    const [hhStr, mmStr] = time.split(":");
    const hh = Number(hhStr);
    const mm = Number(mmStr ?? "0");

    // 24:00 → 다음날 00:00
    if (hh === 24) {
        const d = new Date(`${date}T00:00:00`);
        d.setDate(d.getDate() + 1);
        d.setHours(0, mm, 0, 0);
        return d;
    }

    return new Date(`${date}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00`);
}

/**
 * 두 시간 사이의 차이를 시간 단위로 계산 (점심시간 차감 포함)
 */
function calculateHours(
    dateFrom: string | null,
    timeFrom: string | null,
    dateTo: string | null,
    timeTo: string | null,
    descType?: string,
    noLunch?: boolean
): number {
    if (!dateFrom || !dateTo) return 0;
    if (!timeFrom || !timeTo) return 0;

    const start = toDateSafe(dateFrom, timeFrom);
    const end = toDateSafe(dateTo, timeTo);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
    if (end <= start) return 0;

    const totalMinutes = Math.floor((end.getTime() - start.getTime()) / 60000);

    // ✅ 작업과 대기가 아니면 점심 규칙 적용 X
    if (descType !== "작업" && descType !== "대기") {
        return totalMinutes / 60;
    }

    // ✅ 대기는 무조건 점심시간 차감
    // ✅ 작업: "점심 안 먹음"이면 전체 시간 카운트
    if (descType === "작업" && noLunch) {
        return totalMinutes / 60;
    }

    // ✅ 점심시간(12:00~13:00) 겹치는 분만큼 제외 (날짜跨越 대응)
    let lunchOverlapMinutes = 0;

    // 시작 날짜 00:00 기준으로 day loop
    const cur = new Date(`${dateFrom}T00:00:00`);
    const last = new Date(`${dateTo}T00:00:00`);

    while (cur <= last) {
        const yyyy = cur.getFullYear();
        const mm = String(cur.getMonth() + 1).padStart(2, "0");
        const dd = String(cur.getDate()).padStart(2, "0");
        const d = `${yyyy}-${mm}-${dd}`;

        const lunchStart = new Date(`${d}T12:00:00`);
        const lunchEnd = new Date(`${d}T13:00:00`);

        // 겹침 계산: [start, end] ∩ [lunchStart, lunchEnd]
        const overlapStart = start > lunchStart ? start : lunchStart;
        const overlapEnd = end < lunchEnd ? end : lunchEnd;

        if (overlapEnd > overlapStart) {
            lunchOverlapMinutes += Math.floor(
                (overlapEnd.getTime() - overlapStart.getTime()) / 60000
            );
        }

        // 다음날
        cur.setDate(cur.getDate() + 1);
    }

    const result = totalMinutes - lunchOverlapMinutes;
    return (result < 0 ? 0 : result) / 60;
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
    isDraft: boolean;
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

    type DaySegmentMeta = {
        timeFrom: string;
        timeTo: string;
        hours: number;
        vesselName: string | null;
        workLogId: number;
        isDraft: boolean;
    };

    // 날짜별로 그룹화 및 집계 (세그먼트마다 보고서/호선 메타 유지)
    const dateMap = new Map<
        string,
        {
            workSegments: DaySegmentMeta[];
            travelSegments: DaySegmentMeta[];
            waitSegments: DaySegmentMeta[];
        }
    >();

    const ensureDay = (dateKey: string) => {
        if (!dateMap.has(dateKey)) {
            dateMap.set(dateKey, {
                workSegments: [],
                travelSegments: [],
                waitSegments: [],
            });
        }
        return dateMap.get(dateKey)!;
    };

    for (const entry of workerEntries) {
        if (!entry.date_from) continue;

        const segments = splitEntryByDate(entry);
        if (segments.length === 0) continue;

        const meta = {
            vesselName: entry.vessel,
            workLogId: entry.work_log_id,
            isDraft: !!entry.is_draft,
        };

        for (const seg of segments) {
            const segData = ensureDay(seg.date);
            const timed = {
                timeFrom: seg.timeFrom,
                timeTo: seg.timeTo,
                hours: seg.hours,
                ...meta,
            };

            if (entry.desc_type === "작업") {
                segData.workSegments.push(timed);
            } else if (entry.desc_type === "이동") {
                segData.travelSegments.push(timed);
            } else if (entry.desc_type === "대기") {
                segData.waitSegments.push(timed);
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
                // 작업 없이 이동/대기만 있는 날: 보고서별로 행 분리
                const byLog = new Map<
                    number,
                    {
                        vesselName: string | null;
                        isDraft: boolean;
                        travelTime: number;
                        waitTime: number;
                    }
                >();

                for (const t of data.travelSegments) {
                    const cur = byLog.get(t.workLogId) ?? {
                        vesselName: t.vesselName,
                        isDraft: t.isDraft,
                        travelTime: 0,
                        waitTime: 0,
                    };
                    cur.travelTime += t.hours;
                    byLog.set(t.workLogId, cur);
                }
                for (const w of data.waitSegments) {
                    const cur = byLog.get(w.workLogId) ?? {
                        vesselName: w.vesselName,
                        isDraft: w.isDraft,
                        travelTime: 0,
                        waitTime: 0,
                    };
                    cur.waitTime += w.hours;
                    byLog.set(w.workLogId, cur);
                }

                return Array.from(byLog.entries()).map(
                    ([workLogId, row], index) => ({
                        id: `${personName}-${date}-${workLogId}-${index}`,
                        date,
                        vesselName: row.vesselName,
                        workTime: 0,
                        timeFrom: null,
                        timeTo: null,
                        travelTime: row.travelTime,
                        waitTime: row.waitTime,
                        workLogId,
                        isDraft: row.isDraft,
                    })
                );
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
                id: `${personName}-${date}-${seg.workLogId}-${index}`,
                date,
                vesselName: seg.vesselName,
                workTime: seg.hours,
                timeFrom: seg.timeFrom,
                timeTo: seg.timeTo,
                travelTime: travelByIndex[index] || 0,
                waitTime: waitByIndex[index] || 0,
                workLogId: seg.workLogId,
                isDraft: seg.isDraft,
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
