/**
 * 자정 분할로 나뉜 출장 보고서(work_log) 엔트리 간 연동:
 * - 같은 splitGroupId(저장 시 부여) 또는 자정 경계(24:00↔다음날 00:00)로 연결된 엔트리를 한 그룹으로 본다.
 * - 상세(details), 참여 인원(persons), 유형(descType)만 동시에 반영하고
 *   날짜/시간 필드는 각 세그먼트별로 유지한다.
 */

const HOUR_MS = 60 * 60 * 1000;

export type WorkLogSplitChainEntry = {
    id?: number;
    dateFrom: string;
    timeFrom?: string;
    dateTo: string;
    timeTo?: string;
    descType: string;
    details?: string;
    persons?: string[];
    splitGroupId?: string | null;
};

const LINKED_KEYS = ["descType", "details", "persons"] as const;
type LinkedKey = (typeof LINKED_KEYS)[number];

function parseStartMs(e: Pick<WorkLogSplitChainEntry, "dateFrom" | "timeFrom">): number | null {
    const tf = (e.timeFrom ?? "00:00").trim();
    const ms = new Date(`${e.dateFrom}T${tf}`).getTime();
    return Number.isFinite(ms) ? ms : null;
}

function parseEndMs(e: WorkLogSplitChainEntry): number | null {
    const tt = (e.timeTo ?? "").trim();
    if (tt === "24:00") {
        const dayStart = new Date(`${e.dateTo}T00:00:00`).getTime();
        return Number.isFinite(dayStart) ? dayStart + 24 * HOUR_MS : null;
    }
    const ms = new Date(`${e.dateTo}T${tt}`).getTime();
    return Number.isFinite(ms) ? ms : null;
}

function pickLinkedPatch<T extends WorkLogSplitChainEntry>(patch: Partial<T>): Partial<T> {
    const out: Partial<T> = {};
    for (const k of LINKED_KEYS) {
        if (k in patch && (patch as Partial<Record<LinkedKey, unknown>>)[k] !== undefined) {
            const v = (patch as Partial<Record<LinkedKey, unknown>>)[k];
            if (k === "persons" && Array.isArray(v)) {
                (out as { persons?: string[] }).persons = [...v];
            } else {
                (out as Record<string, unknown>)[k] = v;
            }
        }
    }
    return out;
}

function hasLinkedKeysInPatch<T extends WorkLogSplitChainEntry>(patch: Partial<T>): boolean {
    return LINKED_KEYS.some(
        (k) => k in patch && (patch as Partial<Record<LinkedKey, unknown>>)[k] !== undefined
    );
}

/** end(A) === start(B) 인 엔트리 쌍을 간선으로 하는 연결 요소 (splitGroupId 없을 때 보조). */
function boundaryChainMemberIds(
    entries: WorkLogSplitChainEntry[],
    startId: number
): number[] {
    const withIds = entries.filter(
        (e): e is WorkLogSplitChainEntry & { id: number } =>
            typeof e.id === "number" && Number.isFinite(e.id) && e.id > 0
    );
    if (withIds.length === 0) {
        return [startId];
    }

    const neighbors = new Map<number, Set<number>>();
    const addEdge = (a: number, b: number) => {
        if (a === b) return;
        if (!neighbors.has(a)) neighbors.set(a, new Set());
        if (!neighbors.has(b)) neighbors.set(b, new Set());
        neighbors.get(a)!.add(b);
        neighbors.get(b)!.add(a);
    };

    for (let i = 0; i < withIds.length; i++) {
        for (let j = 0; j < withIds.length; j++) {
            if (i === j) continue;
            const a = withIds[i];
            const b = withIds[j];
            const endA = parseEndMs(a);
            const startB = parseStartMs(b);
            const endB = parseEndMs(b);
            const startA = parseStartMs(a);
            if (endA !== null && startB !== null && endA === startB) {
                addEdge(a.id, b.id);
            }
            if (endB !== null && startA !== null && endB === startA) {
                addEdge(a.id, b.id);
            }
        }
    }

    const seen = new Set<number>();
    const stack = [startId];
    seen.add(startId);
    while (stack.length > 0) {
        const id = stack.pop()!;
        for (const nb of neighbors.get(id) ?? []) {
            if (!seen.has(nb)) {
                seen.add(nb);
                stack.push(nb);
            }
        }
    }
    return [...seen];
}

/**
 * 주어진 엔트리와 같은 자정 분할 체인에 속한 엔트리 id 목록(본인 포함).
 * `splitGroupId`가 있으면 우선한다.
 */
export function getWorkLogSplitChainMemberIds(
    entries: WorkLogSplitChainEntry[],
    anchorEntryId: number
): number[] {
    const anchor = entries.find((e) => e.id === anchorEntryId);
    if (!anchor) {
        return [anchorEntryId];
    }

    const gid = anchor.splitGroupId?.trim();
    if (gid) {
        const ids = entries
            .filter((e) => typeof e.id === "number" && e.id > 0 && (e.splitGroupId?.trim() ?? "") === gid)
            .map((e) => e.id!);
        return ids.length > 0 ? ids : [anchorEntryId];
    }

    return boundaryChainMemberIds(entries, anchorEntryId);
}

/**
 * 작성/수정 화면에서 엔트리 하나를 수정할 때 호출.
 * - patch에 descType / details / persons 가 있으면 같은 체인의 다른 세그먼트에도 동일하게 반영
 * - dateFrom, timeFrom, dateTo, timeTo 등 시간 관련 키는 `changedEntryId` 행에만 적용
 */
export function propagateWorkLogSplitChainPatch<T extends WorkLogSplitChainEntry>(
    entries: T[],
    changedEntryId: number,
    patch: Partial<T>
): T[] {
    const linkedPatch = pickLinkedPatch(patch);
    const hasLinked = hasLinkedKeysInPatch(patch);

    if (!hasLinked) {
        return entries.map((e) => (e.id === changedEntryId ? { ...e, ...patch } : e));
    }

    const memberIds = new Set(getWorkLogSplitChainMemberIds(entries, changedEntryId));

    return entries.map((e) => {
        if (!e.id || !memberIds.has(e.id)) {
            return e;
        }
        if (e.id === changedEntryId) {
            return { ...e, ...patch };
        }
        return { ...e, ...linkedPatch };
    });
}
