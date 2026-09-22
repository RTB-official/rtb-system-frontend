import { ROLE_ORDER } from "../pages/Members/constants";

export type PersonSortMeta = {
    position?: string | null;
    joinDate?: string | null;
};

/** 직급 높은 순 → 같은 직급이면 입사일 빠른 순 → 이름순 */
export function sortPeopleByRoleAndJoinDate(
    people: string[],
    metaByName: Map<string, PersonSortMeta> | Record<string, PersonSortMeta>
): string[] {
    const get = (name: string): PersonSortMeta => {
        if (metaByName instanceof Map) {
            return metaByName.get(name) ?? {};
        }
        return metaByName[name] ?? {};
    };

    return [...people].sort((a, b) => {
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
