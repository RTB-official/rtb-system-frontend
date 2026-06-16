import { supabase } from "./supabase";
import { mergeWorkLogPeriodBounds } from "../utils/invoiceReportDisplayTitle";

const SUPABASE_PAGE_SIZE = 1000;
/** PostgREST `.in()` 목록이 너무 길어지지 않도록 분할 */
const WORK_LOG_ID_CHUNK = 150;

type EntryPeriodRow = {
    work_log_id: number;
    date_from?: string | null;
    date_to?: string | null;
};

async function fetchPeriodPage(
    workLogIds: number[],
    from: number
): Promise<EntryPeriodRow[]> {
    const { data, error } = await supabase
        .from("work_log_entries_with_hours")
        .select("work_log_id, date_from, date_to")
        .in("work_log_id", workLogIds)
        .order("work_log_id", { ascending: true })
        .order("date_from", { ascending: true })
        .range(from, from + SUPABASE_PAGE_SIZE - 1);

    if (error) {
        console.error("work_log_entries_with_hours 기간 조회 실패:", error);
        return [];
    }

    return (data ?? []) as EntryPeriodRow[];
}

async function fetchPeriodMapForIdChunk(
    workLogIds: number[]
): Promise<Map<number, { start?: string; end?: string }>> {
    const periodMap = new Map<number, { start?: string; end?: string }>();
    let from = 0;

    while (true) {
        const page = await fetchPeriodPage(workLogIds, from);
        for (const e of page) {
            const id = Number(e.work_log_id);
            if (!id) continue;
            periodMap.set(
                id,
                mergeWorkLogPeriodBounds(
                    periodMap.get(id),
                    e.date_from,
                    e.date_to
                )
            );
        }

        if (page.length < SUPABASE_PAGE_SIZE) {
            break;
        }
        from += SUPABASE_PAGE_SIZE;
    }

    return periodMap;
}

/**
 * 보고서 목록 제목용: work_log별 최소·최대 일자.
 * `.in()` + `.range()`로 1000행 제한을 넘기며, RLS는 목록·staff 필터와 동일한 뷰를 사용한다.
 */
export async function fetchWorkLogEntryPeriodMap(
    workLogIds: readonly number[]
): Promise<Map<number, { start?: string; end?: string }>> {
    const merged = new Map<number, { start?: string; end?: string }>();
    const ids = [
        ...new Set(workLogIds.filter((id) => Number.isFinite(id) && id > 0)),
    ];
    if (ids.length === 0) {
        return merged;
    }

    for (let offset = 0; offset < ids.length; offset += WORK_LOG_ID_CHUNK) {
        const chunk = ids.slice(offset, offset + WORK_LOG_ID_CHUNK);
        const chunkMap = await fetchPeriodMapForIdChunk(chunk);
        chunkMap.forEach((bounds, id) => {
            merged.set(
                id,
                mergeWorkLogPeriodBounds(merged.get(id), bounds.start, bounds.end)
            );
        });
    }

    return merged;
}
