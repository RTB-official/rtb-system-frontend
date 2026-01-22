//workloadApi.ts
import { supabase } from "./supabase";

type ProfileDeptRow = {
    name: string | null;
    department: string | null;
};

// ✅ 워크로드 대상 인원(공사팀/공무팀) 조회
export async function getWorkloadTargetProfiles(): Promise<
    { name: string; department: "공사팀" | "공무팀" }[]
> {
    const { data, error } = await supabase
        .from("profiles")
        .select("name, department")
        .in("department", ["공사팀", "공무팀"]);

    if (error) {
        console.error("profiles 조회 실패:", error);
        throw new Error(`profiles 조회 실패: ${error.message}`);
    }

    return (data as ProfileDeptRow[] | null | undefined)
        ? (data as ProfileDeptRow[])
              .filter((x) => !!x.name && (x.department === "공사팀" || x.department === "공무팀"))
              .map((x) => ({ name: x.name!.trim(), department: x.department as "공사팀" | "공무팀" }))
        : [];
}


// ==================== 타입 정의 ====================

export interface WorkloadEntry {
    id: number;
    work_log_id: number;
    date_from: string | null;
    time_from: string | null;
    date_to: string | null;
    time_to: string | null;
    desc_type: string; // "작업" | "이동" | "대기"
    person_name: string;
    vessel: string | null;
    subject: string | null;
    work_hours: number | null;
}

export interface PersonWorkloadSummary {
    personName: string;
    workHours: number; // 작업 시간 (시간 단위)
    travelHours: number; // 이동 시간 (시간 단위)
    waitHours: number; // 대기 시간 (시간 단위)
    totalDays: number; // 작업 일수
    workLogIds: Set<number>; // 참여한 출장보고서 ID 목록
}

export interface WorkloadTableRow {
    id: string; // personName 기반 고유 ID
    name: string;
    work: string; // "93시간" 형식
    travel: string; // "21시간 30분" 형식
    wait: string; // "0시간" 형식
    days: string; // "11일" 형식
}

export interface WorkloadChartData {
    name: string;
    작업: number; // 시간 단위
    이동: number; // 시간 단위
    대기: number; // 시간 단위
}

/**
 * 시간 문자열을 분 단위로 변환
 * @param timeStr "HH:mm" 형식의 시간 문자열
 * @returns 분 단위 숫자
 */

function normalizeTimeHHMM(timeStr: string | null | undefined): string | null {
    if (!timeStr) return null;
    // "08:00:00" -> "08:00", "08:00" -> "08:00"
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
 * @param dateFrom 시작 날짜 (YYYY-MM-DD)
 * @param timeFrom 시작 시간 (HH:mm)
 * @param dateTo 종료 날짜 (YYYY-MM-DD)
 * @param timeTo 종료 시간 (HH:mm)
 * @returns 시간 단위 (소수점 포함)
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
 * 시간을 "X시간" 형식으로 포맷팅 (분 없이)
 */
function formatHoursOnly(hours: number): string {
    if (hours === 0) return "0시간";
    return `${Math.round(hours)}시간`;
}

/**
 * 워크로드 데이터 조회 (년/월 필터링)
 */
export async function getWorkloadData(filters?: {
    year?: number;
    month?: number;
}): Promise<WorkloadEntry[]> {
    try {
        // 1. 출장보고서 조회 (제출된 것만, is_draft = false)
        // 필터링은 작업 일정(date_from, date_to) 기준으로 하므로 모든 제출된 보고서 조회
        const { data: workLogs, error: workLogsError } = await supabase
            .from("work_logs")
            .select("id, vessel, subject")
            .eq("is_draft", false);

        if (workLogsError) {
            console.error("Error fetching work logs:", workLogsError);
            throw new Error(`출장 보고서 조회 실패: ${workLogsError.message}`);
        }

        if (!workLogs || workLogs.length === 0) {
            return [];
        }

        const workLogIds = workLogs.map((log) => log.id);
        const workLogMap = new Map(
            workLogs.map((log) => [log.id, { vessel: log.vessel, subject: log.subject }])
        );

        // 2. 업무 일지 조회 (모든 entry 조회 후 필터링)
        const { data: entries, error: entriesError } = await supabase
        .from("work_log_entries_with_hours")
        .select("id, work_log_id, date_from, time_from, date_to, time_to, desc_type, work_hours")
        .in("work_log_id", workLogIds)
        .order("date_from", { ascending: true })
        .order("time_from", { ascending: true });
    

        if (entriesError) {
            console.error("Error fetching work log entries:", entriesError);
            throw new Error(`업무 일지 조회 실패: ${entriesError.message}`);
        }

        if (!entries || entries.length === 0) {
            return [];
        }

        // 3. 작업 일정 기준으로 필터링 (date_from, date_to 기준)
        let filteredEntries = entries;
        if (filters?.year && filters?.month !== undefined) {
            // 특정 월: 해당 월과 겹치는 모든 entry 필터링
            const year = filters.year;
            const month = filters.month; // month는 1~12
            const filterStartDate = `${year}-${String(month).padStart(2, "0")}-01`;
            const lastDay = new Date(year, month, 0).getDate(); // month=1이면 1월 마지막날 OK
            const filterEndDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;            
            
            filteredEntries = entries.filter((entry) => {
                if (!entry.date_from || !entry.date_to) return false;
                // entry가 필터 기간과 겹치는지 확인
                // entry 시작일이 필터 종료일 이전이고, entry 종료일이 필터 시작일 이후인 경우
                return entry.date_from <= filterEndDate && entry.date_to >= filterStartDate;
            });
        } else if (filters?.year) {
            // 특정 년도: 해당 년도와 겹치는 모든 entry 필터링
            const year = filters.year;
            const filterStartDate = `${year}-01-01`;
            const filterEndDate = `${year}-12-31`;
            
            filteredEntries = entries.filter((entry) => {
                if (!entry.date_from || !entry.date_to) return false;
                return entry.date_from <= filterEndDate && entry.date_to >= filterStartDate;
            });
        }

        if (filteredEntries.length === 0) {
            return [];
        }

        const entryIds = filteredEntries.map((e) => e.id);

        // 3. 참여자 조회
        const { data: entryPersons, error: entryPersonsError } = await supabase
            .from("work_log_entry_persons")
            .select("entry_id, person_name")
            .in("entry_id", entryIds);

        if (entryPersonsError) {
            console.error("Error fetching entry persons:", entryPersonsError);
            throw new Error(`참여자 조회 실패: ${entryPersonsError.message}`);
        }

        // 4. 데이터 조합
        const personMap = new Map<number, string[]>();
        if (entryPersons) {
            for (const ep of entryPersons) {
                if (!personMap.has(ep.entry_id)) {
                    personMap.set(ep.entry_id, []);
                }
                personMap.get(ep.entry_id)!.push(ep.person_name);
            }
        }

        const workloadEntries: WorkloadEntry[] = [];
        for (const entry of filteredEntries) {
            const persons = personMap.get(entry.id) || [];
            const workLogInfo = workLogMap.get(entry.work_log_id);

            for (const personName of persons) {
                workloadEntries.push({
                    id: entry.id,
                    work_log_id: entry.work_log_id,
                    date_from: entry.date_from,
                    time_from: entry.time_from,
                    date_to: entry.date_to,
                    time_to: entry.time_to,
                    desc_type: entry.desc_type,
                    person_name: personName,
                    vessel: workLogInfo?.vessel || null,
                    subject: workLogInfo?.subject || null,
                    work_hours: (entry as any).work_hours ?? null,
                });
                
            }
        }

        return workloadEntries;
    } catch (error) {
        console.error("Error in getWorkloadData:", error);
        throw error;
    }
}

/**
 * 인원별 작업시간 집계
 */
export function aggregatePersonWorkload(
    entries: WorkloadEntry[],
    profiles?: { name: string; department: "공사팀" | "공무팀" }[]
): PersonWorkloadSummary[] {
    const personMap = new Map<string, PersonWorkloadSummary>();

    for (const entry of entries) {
        const personName = entry.person_name;
        
        if (!personMap.has(personName)) {
            personMap.set(personName, {
                personName,
                workHours: 0,
                travelHours: 0,
                waitHours: 0,
                totalDays: 0,
                workLogIds: new Set(),
            });
        }

        const summary = personMap.get(personName)!;
        const hours =
        (entry.work_hours ?? 0) ||
        calculateHours(entry.date_from, entry.time_from, entry.date_to, entry.time_to);
    

        // desc_type에 따라 분류
        if (entry.desc_type === "작업") {
            summary.workHours += hours;
        } else if (entry.desc_type === "이동") {
            summary.travelHours += hours;
        } else if (entry.desc_type === "대기") {
            summary.waitHours += hours;
        }

        // 출장보고서 ID 추가
        summary.workLogIds.add(entry.work_log_id);

        // 작업 일수 계산 (날짜 기준)
        if (entry.date_from) {
            // 날짜별로 집계하기 위해 날짜를 키로 사용
            // 실제로는 work_log_id별로 날짜 범위를 계산해야 하지만,
            // 간단하게 각 entry의 날짜를 카운트
            // 더 정확한 계산을 위해서는 work_log별로 날짜 범위를 계산해야 함
        }
    }

    // 작업 일수 계산 (work_log_id별로 날짜 범위 계산)
    for (const summary of personMap.values()) {
        const workLogIds = Array.from(summary.workLogIds);
        const dateSet = new Set<string>();

        for (const workLogId of workLogIds) {
            const workLogEntries = entries.filter(
                (e) => e.work_log_id === workLogId && e.person_name === summary.personName
            );

            for (const entry of workLogEntries) {
                if (entry.date_from) {
                    dateSet.add(entry.date_from);
                }
                if (entry.date_to && entry.date_to !== entry.date_from) {
                    dateSet.add(entry.date_to);
                }
            }
        }

        summary.totalDays = dateSet.size;
    }

    // ✅ profiles(공사팀/공무팀) 기준으로 워크로드 표시 대상 결정
    if (profiles && profiles.length) {
        const resultMap = new Map<string, PersonWorkloadSummary>();

        // 이름별 기존 집계 맵(personMap)을 조회해서 규칙 적용
        for (const p of profiles) {
            const name = p.name;
            const dept = p.department;

            const existing =
                personMap.get(name) ??
                ({
                    personName: name,
                    workHours: 0,
                    travelHours: 0,
                    waitHours: 0,
                    totalDays: 0,
                    workLogIds: new Set<number>(),
                } as PersonWorkloadSummary);

            // ✅ 공사팀: 무조건 표시 (0시간이어도)
            if (dept === "공사팀") {
                resultMap.set(name, existing);
                continue;
            }

            // ✅ 공무팀: 작업/이동 시간이 있을 때만 표시
            if (dept === "공무팀") {
                if (existing.workHours > 0 || existing.travelHours > 0) {
                    resultMap.set(name, existing);
                }
                continue;
            }
        }

        // ✅ 작업시간(workHours) 내림차순 정렬
        return Array.from(resultMap.values()).sort(
            (a, b) => b.workHours - a.workHours
        );
    }

    // profiles 미사용 시 기존 동작 유지
    // ✅ 작업시간 기준 내림차순 정렬
    return Array.from(personMap.values()).sort(
        (a, b) => b.workHours - a.workHours
    );

}

/**
 * 차트 데이터 생성
 */
export function generateChartData(
    summaries: PersonWorkloadSummary[]
): WorkloadChartData[] {
    return summaries.map((summary) => ({
        name: summary.personName,
        작업: Math.round(summary.workHours * 10) / 10, // 소수점 첫째자리까지
        이동: Math.round(summary.travelHours * 10) / 10,
        대기: Math.round(summary.waitHours * 10) / 10,
    }));
}

/**
 * 테이블 데이터 생성
 */
export function generateTableData(
    summaries: PersonWorkloadSummary[]
): WorkloadTableRow[] {
    return summaries.map((summary, index) => ({
        id: `${summary.personName}-${index}`,
        name: summary.personName,
        work: formatHours(summary.workHours),
        travel: formatHours(summary.travelHours),
        wait: formatHours(summary.waitHours),
        days: `${summary.totalDays}일`,
    }));
}

