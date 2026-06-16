import { supabase } from "./supabase";

const PAGE_SIZE = 1000;
const IN_CHUNK = 150;

function chunk<T>(items: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
        out.push(items.slice(i, i + size));
    }
    return out;
}

/**
 * staff 보고서 목록: 본인 이름으로 참여한 work_log id
 * - work_log_persons (보고서 전체 작업자)
 * - work_log_entry_persons (일정별 참여자)
 */
export async function fetchStaffParticipatedWorkLogIds(
    profileName: string
): Promise<Set<number>> {
    const name = profileName.trim();
    const ids = new Set<number>();
    if (!name) {
        return ids;
    }

    let from = 0;
    while (true) {
        const { data, error } = await supabase
            .from("work_log_persons")
            .select("work_log_id")
            .eq("person_name", name)
            .range(from, from + PAGE_SIZE - 1);

        if (error) {
            console.error("work_log_persons 참여 조회 실패:", error);
            break;
        }

        const page = data ?? [];
        for (const row of page) {
            const id = Number(row.work_log_id);
            if (id) ids.add(id);
        }
        if (page.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
    }

    const entryIds: number[] = [];
    from = 0;
    while (true) {
        const { data, error } = await supabase
            .from("work_log_entry_persons")
            .select("entry_id")
            .eq("person_name", name)
            .range(from, from + PAGE_SIZE - 1);

        if (error) {
            console.error("work_log_entry_persons 참여 조회 실패:", error);
            break;
        }

        const page = data ?? [];
        for (const row of page) {
            const id = Number(row.entry_id);
            if (id) entryIds.push(id);
        }
        if (page.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
    }

    for (const idChunk of chunk([...new Set(entryIds)], IN_CHUNK)) {
        const { data, error } = await supabase
            .from("work_log_entries")
            .select("work_log_id")
            .in("id", idChunk);

        if (error) {
            console.error("work_log_entries 매핑 조회 실패:", error);
            continue;
        }

        for (const row of data ?? []) {
            const wlId = Number(row.work_log_id);
            if (wlId) ids.add(wlId);
        }
    }

    return ids;
}
