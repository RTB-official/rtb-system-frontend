import { supabase } from "./supabase";

export async function fetchWorkLogEditorIds(workLogId: number): Promise<string[]> {
    const { data, error } = await supabase
        .from("work_log_editors")
        .select("user_id")
        .eq("work_log_id", workLogId);

    if (error) {
        throw new Error(error.message || "수정 권한을 불러오지 못했습니다.");
    }

    return (data ?? [])
        .map((row) => row.user_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0);
}

/** 현재 로그인 계정이 수정 권한을 받은 보고서 id 전체 */
export async function fetchAllMyEditableWorkLogIds(): Promise<Set<number>> {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id;
    if (!userId) return new Set();

    const { data, error } = await supabase
        .from("work_log_editors")
        .select("work_log_id")
        .eq("user_id", userId);

    if (error) {
        throw new Error(error.message || "수정 권한을 확인하지 못했습니다.");
    }

    return new Set(
        (data ?? [])
            .map((row) => Number(row.work_log_id))
            .filter((id) => Number.isFinite(id))
    );
}

/** 현재 로그인 계정이 수정 권한을 받은 보고서 id */
export async function fetchMyEditableWorkLogIds(workLogIds: number[]): Promise<Set<number>> {
    const ids = workLogIds.filter((id) => Number.isFinite(id));
    if (ids.length === 0) return new Set();

    const { data: authData } = await supabase.auth.getUser();
    const userId = authData.user?.id;
    if (!userId) return new Set();

    const { data, error } = await supabase
        .from("work_log_editors")
        .select("work_log_id")
        .eq("user_id", userId)
        .in("work_log_id", ids);

    if (error) {
        throw new Error(error.message || "수정 권한을 확인하지 못했습니다.");
    }

    return new Set(
        (data ?? [])
            .map((row) => Number(row.work_log_id))
            .filter((id) => Number.isFinite(id))
    );
}

const EDITOR_ROLE_ORDER: Record<string, number> = {
    "대표": 1,
    "감사": 2,
    "부장": 3,
    "차장": 4,
    "과장": 5,
    "대리": 6,
    "주임": 7,
    "사원": 8,
    "인턴": 9,
};

/** 수정 권한을 받은 사람 이름. 직급순, 같은 직급은 이름순. 공무팀은 뒤에 둔다. */
export async function fetchWorkLogEditorNames(workLogId: number): Promise<string[]> {
    const { data, error } = await supabase.rpc("get_work_log_editor_names", {
        p_work_log_id: workLogId,
    });

    if (error) {
        throw new Error(error.message || "수정 권한 명단을 불러오지 못했습니다.");
    }

    const people = (data ?? [])
        .map((row) => ({
            name: String(row.editor_name ?? "").trim(),
            position: String(row.job_position ?? ""),
            department: String(row.department ?? ""),
        }))
        .filter((person) => person.name.length > 0);

    people.sort((a, b) => {
        const groupA = a.department === "공무팀" ? 1 : 0;
        const groupB = b.department === "공무팀" ? 1 : 0;
        if (groupA !== groupB) return groupA - groupB;
        const orderA = EDITOR_ROLE_ORDER[a.position] ?? 999;
        const orderB = EDITOR_ROLE_ORDER[b.position] ?? 999;
        if (orderA !== orderB) return orderA - orderB;
        return a.name.localeCompare(b.name, "ko");
    });

    return people.map((person) => person.name);
}

/** 보고서별 수정 권한 인원 수. 해당 보고서를 볼 수 있는 계정만 건수를 받는다. */
export async function fetchWorkLogEditorCounts(
    workLogIds: number[]
): Promise<Map<number, number>> {
    const ids = [...new Set(workLogIds.filter((id) => Number.isFinite(id)))];
    const counts = new Map<number, number>();
    if (ids.length === 0) return counts;

    const { data, error } = await supabase.rpc("get_work_log_editor_counts", {
        p_ids: ids,
    });

    if (error) {
        throw new Error(error.message || "수정 권한 인원을 확인하지 못했습니다.");
    }

    for (const row of data ?? []) {
        const workLogId = Number(row.work_log_id);
        const editorCount = Number(row.editor_count);
        if (!Number.isFinite(workLogId) || !Number.isFinite(editorCount) || editorCount <= 0) {
            continue;
        }
        counts.set(workLogId, editorCount);
    }

    return counts;
}

export async function saveWorkLogEditors(workLogId: number, userIds: string[]): Promise<void> {
    const nextIds = [...new Set(userIds.filter((id) => id.trim() !== ""))];

    const { data: existing, error: selectError } = await supabase
        .from("work_log_editors")
        .select("user_id")
        .eq("work_log_id", workLogId);

    if (selectError) {
        throw new Error(selectError.message || "수정 권한을 저장하지 못했습니다.");
    }

    const existingIds = new Set(
        (existing ?? [])
            .map((row) => row.user_id)
            .filter((id): id is string => typeof id === "string")
    );
    const nextIdSet = new Set(nextIds);
    const toDelete = [...existingIds].filter((id) => !nextIdSet.has(id));
    const toInsert = nextIds.filter((id) => !existingIds.has(id));

    if (toDelete.length > 0) {
        const { error } = await supabase
            .from("work_log_editors")
            .delete()
            .eq("work_log_id", workLogId)
            .in("user_id", toDelete);
        if (error) {
            throw new Error(error.message || "수정 권한을 저장하지 못했습니다.");
        }
    }

    if (toInsert.length > 0) {
        const { data: authData } = await supabase.auth.getUser();
        const grantedBy = authData.user?.id ?? null;
        const { error } = await supabase.from("work_log_editors").insert(
            toInsert.map((userId) => ({
                work_log_id: workLogId,
                user_id: userId,
                granted_by: grantedBy,
            }))
        );
        if (error) {
            throw new Error(error.message || "수정 권한을 저장하지 못했습니다.");
        }
    }
}
