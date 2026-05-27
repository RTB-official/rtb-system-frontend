import { supabase } from "./supabase";
import { mergeWorkLogPeriodBounds } from "../utils/invoiceReportDisplayTitle";

const SUPABASE_PAGE_SIZE = 1000;
const PER_WORK_LOG_CONCURRENCY = 20;

type EntryPeriodRow = {
    date_from?: string | null;
    date_to?: string | null;
};

async function fetchPeriodBoundsForWorkLog(
    workLogId: number
): Promise<{ start?: string; end?: string }> {
    let bounds: { start?: string; end?: string } | undefined;
    let from = 0;

    while (true) {
        const { data, error } = await supabase
            .from("work_log_entries")
            .select("date_from, date_to")
            .eq("work_log_id", workLogId)
            .order("date_from", { ascending: true })
            .range(from, from + SUPABASE_PAGE_SIZE - 1);

        if (error) {
            console.error(
                `work_log_entries 기간 조회 실패 (work_log_id=${workLogId}):`,
                error
            );
            break;
        }

        const page = (data ?? []) as EntryPeriodRow[];
        for (const e of page) {
            bounds = mergeWorkLogPeriodBounds(
                bounds,
                e.date_from,
                e.date_to
            );
        }

        if (page.length < SUPABASE_PAGE_SIZE) {
            break;
        }
        from += SUPABASE_PAGE_SIZE;
    }

    return bounds ?? {};
}

/**
 * 보고서 목록 제목용: work_log별 최소·최대 일자.
 * 여러 보고서를 한 번에 `.in()` 하면 1000행 페이지에 일부 보고서 엔트리가 누락될 수 있어
 * 보고서 단위로 조회한다.
 */
export async function fetchWorkLogEntryPeriodMap(
    workLogIds: readonly number[]
): Promise<Map<number, { start?: string; end?: string }>> {
    const periodMap = new Map<number, { start?: string; end?: string }>();
    const ids = [
        ...new Set(workLogIds.filter((id) => Number.isFinite(id) && id > 0)),
    ];
    if (ids.length === 0) {
        return periodMap;
    }

    for (let offset = 0; offset < ids.length; offset += PER_WORK_LOG_CONCURRENCY) {
        const chunk = ids.slice(offset, offset + PER_WORK_LOG_CONCURRENCY);
        const boundsList = await Promise.all(
            chunk.map((id) => fetchPeriodBoundsForWorkLog(id))
        );
        chunk.forEach((id, index) => {
            const bounds = boundsList[index];
            if (bounds.start || bounds.end) {
                periodMap.set(id, bounds);
            }
        });
    }

    return periodMap;
}
