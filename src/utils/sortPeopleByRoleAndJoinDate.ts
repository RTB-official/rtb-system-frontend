import { ROLE_ORDER } from "../pages/Members/constants";

export type PersonSortMeta = {
    position?: string | null;
    joinDate?: string | null;
};

export type SortPeopleOptions = {
    /** 이 목록에 있는 이름은 직급·입사일보다 먼저 (배열 순서 유지) */
    priorityFirst?: readonly string[];
};

/** 직급 높은 순 → 같은 직급이면 입사일 빠른 순 → 이름순 */
export function sortPeopleByRoleAndJoinDate(
    people: string[],
    metaByName: Map<string, PersonSortMeta> | Record<string, PersonSortMeta>,
    options?: SortPeopleOptions
): string[] {
    const get = (name: string): PersonSortMeta => {
        if (metaByName instanceof Map) {
            return metaByName.get(name) ?? {};
        }
        return metaByName[name] ?? {};
    };

    const priorityIndex = new Map(
        (options?.priorityFirst ?? []).map((name, index) => [name, index])
    );

    return [...people].sort((a, b) => {
        const pa = priorityIndex.has(a) ? priorityIndex.get(a)! : Number.POSITIVE_INFINITY;
        const pb = priorityIndex.has(b) ? priorityIndex.get(b)! : Number.POSITIVE_INFINITY;
        if (pa !== pb) return pa - pb;

        const ma = get(a);
        const mb = get(b);
        const orderA = ROLE_ORDER[ma.position ?? ""] ?? 999;
        const orderB = ROLE_ORDER[mb.position ?? ""] ?? 999;
        if (orderA !== orderB) {
            return orderA - orderB;
        }
        const ja = ma.joinDate ?? "9999-99-99";
        const jb = mb.joinDate ?? "9999-99-99";
        if (ja !== jb) {
            return ja.localeCompare(jb);
        }
        return a.localeCompare(b, "ko");
    });
}
