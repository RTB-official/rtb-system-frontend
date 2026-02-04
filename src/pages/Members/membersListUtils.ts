import type { Member, MemberSection } from "./types";
import { ROLE_ORDER } from "./constants";

/** 탭 필터 + 직급 순 정렬 + 로그인한 본인 항상 최상단 */
export function getFilteredMembers(
    members: Member[],
    activeTab: "ALL" | "ADMIN" | "STAFF",
    myUserId: string | null,
): Member[] {
    let filtered = members;
    if (activeTab === "ADMIN")
        filtered = filtered.filter((m) => m.team === "공무팀");
    else if (activeTab === "STAFF")
        filtered = filtered.filter((m) => m.team === "공사팀");
    return [...filtered].sort((a, b) => {
        if (myUserId) {
            if (a.id === myUserId && b.id !== myUserId) return -1;
            if (a.id !== myUserId && b.id === myUserId) return 1;
        }
        const orderA = ROLE_ORDER[a.role] ?? 999;
        const orderB = ROLE_ORDER[b.role] ?? 999;
        if (orderA !== orderB) return orderA - orderB;
        return a.joinDate.localeCompare(b.joinDate);
    });
}

/** 직급별 섹션 (대표 → … 순). 로그인한 본인이 있으면 "내 계정" 섹션을 맨 위에 둠 */
export function getMembersByRole(
    filteredMembers: Member[],
    myUserId: string | null,
): MemberSection[] {
    const order = [...Object.entries(ROLE_ORDER)].sort((a, b) => a[1] - b[1]);
    const byRole = new Map<string, Member[]>();
    for (const m of filteredMembers) {
        const r = m.role || "—";
        if (!byRole.has(r)) byRole.set(r, []);
        byRole.get(r)!.push(m);
    }
    const sections: MemberSection[] = [];
    const added = new Set<string>();
    for (const [role] of order) {
        const list = byRole.get(role);
        if (list?.length) {
            sections.push({ role, members: list });
            added.add(role);
        }
    }
    for (const [role, list] of byRole) {
        if (!added.has(role) && list.length) {
            sections.push({
                role: role === "—" ? role : role || "—",
                members: list,
            });
        }
    }
    if (!myUserId) return sections;
    const me = filteredMembers.find((m) => m.id === myUserId);
    if (!me) return sections;
    const rest = sections
        .map((s) => ({
            role: s.role,
            members: s.members.filter((m) => m.id !== myUserId),
        }))
        .filter((s) => s.members.length > 0);
    return [{ role: "내 계정", members: [me] }, ...rest];
}
