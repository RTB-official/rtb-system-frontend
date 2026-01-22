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
    timeFrom: string; // HH:mm
    timeTo: string; // HH:mm
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
    const allEntries = await getWorkloadData(filters);

    // 해당 작업자의 데이터만 필터링
    const workerEntries = allEntries.filter(
        (entry) => entry.person_name === personName
    );

    // 날짜별로 그룹화 및 집계
    const dateMap = new Map<string, {
        vesselName: string | null;
        workTime: number;
        travelTime: number;
        waitTime: number;
        timeFrom: string;
        timeTo: string;
        workLogId: number;
    }>();

    for (const entry of workerEntries) {
        if (!entry.date_from) continue;

        const dateKey = entry.date_from;
        
        if (!dateMap.has(dateKey)) {
            dateMap.set(dateKey, {
                vesselName: entry.vessel,
                workTime: 0,
                travelTime: 0,
                waitTime: 0,
                timeFrom: entry.time_from || "00:00",
                timeTo: entry.time_to || "00:00",
                workLogId: entry.work_log_id,
            });
        }

        const dayData = dateMap.get(dateKey)!;
        const hours =
        ((entry as any).work_hours ?? 0) ||
        calculateHours(entry.date_from, entry.time_from, entry.date_to, entry.time_to);

        if (entry.desc_type === "작업") {
            dayData.workTime += hours;
        } else if (entry.desc_type === "이동") {
            dayData.travelTime += hours;
        } else if (entry.desc_type === "대기") {
            dayData.waitTime += hours;
        }

        // 시간 범위 업데이트 (가장 이른 시작 시간과 가장 늦은 종료 시간)
        if (entry.time_from) {
            const currentFrom = dayData.timeFrom;
            const entryFrom = entry.time_from;
            if (entryFrom < currentFrom) {
                dayData.timeFrom = entryFrom;
            }
        }
        if (entry.time_to) {
            const currentTo = dayData.timeTo;
            const entryTo = entry.time_to;
            if (entryTo > currentTo) {
                dayData.timeTo = entryTo;
            }
        }
    }

    // 날짜별 상세 데이터 생성
    const entries: WorkloadDetailEntry[] = Array.from(dateMap.entries())
        .map(([date, data], index) => ({
            id: `${personName}-${date}-${index}`,
            date,
            vesselName: data.vesselName,
            workTime: data.workTime,
            timeFrom: data.timeFrom,
            timeTo: data.timeTo,
            travelTime: data.travelTime,
            waitTime: data.waitTime,
            workLogId: data.workLogId,
        }))
        .sort((a, b) => a.date.localeCompare(b.date)); // 날짜 순 정렬

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
export function formatTimeRange(timeFrom: string, timeTo: string): string {
    return `${timeFrom}-${timeTo}`;
}

