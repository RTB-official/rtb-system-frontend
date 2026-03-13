//workloadApi.ts
import { supabase } from "./supabase";

type ProfileDeptRow = {
    name: string | null;
    department: string | null;
};

// ✅ 워크로드 대상 인원(공사팀/공무팀) 조회 (캐싱으로 성능 개선)
let profilesCache: { name: string; department: "공사팀" | "공무팀" }[] | null = null;
let profilesCacheTime: number = 0;
const PROFILES_CACHE_DURATION = 5 * 60 * 1000; // 5분

export async function getWorkloadTargetProfiles(): Promise<
    { name: string; department: "공사팀" | "공무팀" }[]
> {
    // 캐시가 있고 유효하면 캐시 반환
    const now = Date.now();
    if (profilesCache && (now - profilesCacheTime) < PROFILES_CACHE_DURATION) {
        return profilesCache;
    }

    const { data, error } = await supabase
        .from("profiles")
        .select("name, department")
        .in("department", ["공사팀", "공무팀"]);

    if (error) {
        // 에러 발생 시 캐시가 있으면 캐시 반환
        if (profilesCache) {
            return profilesCache;
        }
        throw new Error(`profiles 조회 실패: ${error.message}`);
    }

    const result = (data as ProfileDeptRow[] | null | undefined)
        ? (data as ProfileDeptRow[])
              .filter((x) => !!x.name && (x.department === "공사팀" || x.department === "공무팀"))
              .map((x) => ({ name: x.name!.trim(), department: x.department as "공사팀" | "공무팀" }))
        : [];

    // 캐시 업데이트
    profilesCache = result;
    profilesCacheTime = now;

    return result;
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
    lunch_worked?: boolean; // 점심 안 먹고 작업진행 여부
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
 * @param dateFrom 시작 날짜 (YYYY-MM-DD)
 * @param timeFrom 시작 시간 (HH:mm)
 * @param dateTo 종료 날짜 (YYYY-MM-DD)
 * @param timeTo 종료 시간 (HH:mm)
 * @param descType 작업 유형 ("작업" | "이동" | "대기")
 * @param noLunch 점심 안 먹고 작업진행 여부
 * @returns 시간 단위 (소수점 포함)
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
    includeDrafts?: boolean;
}): Promise<WorkloadEntry[]> {
    try {
        // 1. 출장보고서 조회 (제출된 것만, is_draft = false)
        // 필터링은 작업 일정(date_from, date_to) 기준으로 하므로 모든 제출된 보고서 조회
        let workLogsQuery = supabase
            .from("work_logs")
            .select("id, vessel, subject");
        if (!filters?.includeDrafts) {
            workLogsQuery = workLogsQuery.eq("is_draft", false);
        }

        const { data: workLogs, error: workLogsError } = await workLogsQuery;

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
        .select("id, work_log_id, date_from, time_from, date_to, time_to, desc_type, work_hours, lunch_worked")
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
                    lunch_worked: (entry as any).lunch_worked ?? false,
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
        // ✅ 점심시간 차감을 확실히 적용하기 위해 항상 calculateHours로 계산
        // (work_hours는 DB 뷰에서 계산된 값이라 점심시간 차감이 안 되어 있을 수 있음)
        const hours = calculateHours(
            entry.date_from,
            entry.time_from,
            entry.date_to,
            entry.time_to,
            entry.desc_type,
            entry.lunch_worked ?? false
        );

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

    // 작업 일수 계산 (work_log_id별로 날짜 범위 계산) - 최적화
    // entries를 person_name과 work_log_id로 그룹화하여 필터링 최소화
    const entriesByPersonAndLog = new Map<string, WorkloadEntry[]>();
    for (const entry of entries) {
        const key = `${entry.person_name}_${entry.work_log_id}`;
        if (!entriesByPersonAndLog.has(key)) {
            entriesByPersonAndLog.set(key, []);
        }
        entriesByPersonAndLog.get(key)!.push(entry);
    }

    for (const summary of personMap.values()) {
        const workLogIds = Array.from(summary.workLogIds);
        const dateSet = new Set<string>();

        for (const workLogId of workLogIds) {
            const key = `${summary.personName}_${workLogId}`;
            const workLogEntries = entriesByPersonAndLog.get(key) || [];

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
        const profileNameSet = new Set(profiles.map(p => p.name));

        // 1. profiles에 있는 인원 처리 (공사팀/공무팀 규칙 적용)
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

            // ✅ 공무팀: includeCivil 옵션이 있으면 포함, 없으면 제외
            if (dept === "공무팀") {
                // includeCivil 옵션은 함수 시그니처에 추가하지 않고, 
                // 테이블용 summaries는 별도로 처리 (WorkloadPage에서)
                continue;
            }
        }

        // 2. ✅ profiles에 없지만 실제 워크로드 데이터에 있는 인원도 포함 (삭제된 계정 포함)
        // 이렇게 하면 계정을 삭제해도 워크로드에 기록이 남아있으면 표시됨
        // 단, 작업/이동/대기 시간 합계가 1시간 이상인 경우만 표시 (0시간인 달은 제외)
        for (const [personName, summary] of personMap.entries()) {
            if (!profileNameSet.has(personName)) {
                // 삭제된 계정: 작업/이동/대기 시간 합계가 1시간 이상인 경우만 표시
                const totalHours = summary.workHours + summary.travelHours + summary.waitHours;
                if (totalHours >= 1) {
                    resultMap.set(personName, summary);
                }
            }
        }

        // ✅ 작업시간(workHours) 내림차순 정렬
        return Array.from(resultMap.values()).sort(
            (a, b) => b.workHours - a.workHours
        );
    }

    // profiles 미사용 시: 작업/이동/대기 시간 합계가 1시간 이상인 인원만 표시
    // ✅ 작업시간 기준 내림차순 정렬
    return Array.from(personMap.values())
        .filter((summary) => {
            const totalHours = summary.workHours + summary.travelHours + summary.waitHours;
            return totalHours >= 1;
        })
        .sort((a, b) => b.workHours - a.workHours);

}

/**
 * 차트 데이터 생성
 * 정렬: 작업시간순 → 작업시간 같으면 이동시간순 → 이동시간도 같으면 대기시간순
 */
export function generateChartData(
    summaries: PersonWorkloadSummary[]
): WorkloadChartData[] {
    // 정렬: 작업시간순 → 이동시간순 → 대기시간순 (모두 내림차순)
    const sorted = [...summaries].sort((a, b) => {
        // 1. 작업시간 비교
        if (b.workHours !== a.workHours) {
            return b.workHours - a.workHours;
        }
        // 2. 작업시간이 같으면 이동시간 비교
        if (b.travelHours !== a.travelHours) {
            return b.travelHours - a.travelHours;
        }
        // 3. 이동시간도 같으면 대기시간 비교
        return b.waitHours - a.waitHours;
    });

    return sorted.map((summary) => ({
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
