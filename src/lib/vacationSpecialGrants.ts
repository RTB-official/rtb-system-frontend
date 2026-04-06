import type { VacationGrantHistory } from "./vacationCalculator";

export interface VacationGrantHistoryEntry extends VacationGrantHistory {
    grantKind?: "regular" | "special";
    note?: string;
}

type SpecialGrantRule = {
    accountKey: string;
    date: string;
    days: number;
    note: string;
};

type SpecialGrantUser = {
    email?: string | null;
    name?: string | null;
};

const SPECIAL_GRANT_RULES: SpecialGrantRule[] = [
    {
        accountKey: "jay.kim",
        date: "2026-04-06",
        days: 0.5,
        note: "특별지급",
    },
];

function matchesAccountKey(value: string | null | undefined, accountKey: string) {
    if (!value) return false;
    return value.toLowerCase().includes(accountKey.toLowerCase());
}

export function getSpecialVacationGrantHistory(
    user: SpecialGrantUser,
    year: number
): VacationGrantHistoryEntry[] {
    return SPECIAL_GRANT_RULES.filter(
        (rule) =>
            rule.date.startsWith(`${year}-`) &&
            (matchesAccountKey(user.email, rule.accountKey) ||
                matchesAccountKey(user.name, rule.accountKey))
    ).map((rule) => ({
        date: rule.date,
        granted: rule.days,
        grantKind: "special",
        note: rule.note,
    }));
}

export function mergeVacationGrantHistory(
    baseHistory: VacationGrantHistory[],
    user: SpecialGrantUser,
    year: number
): VacationGrantHistoryEntry[] {
    const merged = [
        ...baseHistory.map((entry) => ({
            ...entry,
            grantKind: "regular" as const,
        })),
        ...getSpecialVacationGrantHistory(user, year),
    ];

    return merged.sort((a, b) => {
        const byDate = a.date.localeCompare(b.date);
        if (byDate !== 0) return byDate;
        const order = (entry: VacationGrantHistoryEntry) =>
            entry.expired != null ? 0 : entry.grantKind === "special" ? 2 : 1;
        return order(a) - order(b);
    });
}
