import { ORDER_PERSONS } from "../store/workReportStore";

export function valuesFromSchedule(value: string, options: readonly string[]): string[] {
    const parts = value
        .split(/[,、·/|\n\r]+/)
        .map((part) => part.trim())
        .filter(Boolean);
    if (parts.length === 0) return [];

    const optionKeys = options
        .map((option) => ({ option, key: option.replace(/\s+/g, "") }))
        .filter((item) => item.key.length > 0)
        .sort((a, b) => b.key.length - a.key.length);

    const result: string[] = [];
    const seen = new Set<string>();
    const push = (text: string) => {
        const key = text.replace(/\s+/g, "");
        if (!key || seen.has(key)) return;
        seen.add(key);
        result.push(text);
    };

    for (const part of parts) {
        let rest = part.replace(/\s+/g, "");
        let found = false;
        for (const item of optionKeys) {
            if (!rest.includes(item.key)) continue;
            rest = rest.replace(item.key, " ");
            push(item.option);
            found = true;
        }
        const leftovers = rest.split(/\s+/).map((token) => token.trim()).filter(Boolean);
        if (!found) {
            part.split(/\s+/).forEach((token) => push(token.trim()));
        } else {
            leftovers.forEach(push);
        }
    }

    return result;
}

function orderGroupFromCustomer(company: string): string {
    const normalized = company.replace(/\s+/g, "").toLowerCase();
    if (!normalized) return "";
    if (normalized.includes("prime")) return "PRIME";
    if (normalized.includes("mitsui")) return "MITSUI";
    if (normalized.includes("elu") || normalized.includes("leo")) return "ELU";
    return "";
}

function supervisorNamesFromContact(contact: string): string[] {
    return [
        ...new Set(
            contact
                .split(/[,、·/\n]+/)
                .map((name) => name.replace(/감독/g, "").trim())
                .filter(Boolean)
        ),
    ];
}

export function supervisorsFromCustomer(company: string, contact: string): { group: string; persons: string[] } {
    const persons = supervisorNamesFromContact(contact);
    const companyGroup = orderGroupFromCustomer(company);
    if (companyGroup) return { group: companyGroup, persons };
    const matchedGroup = (["ELU", "PRIME"] as const).find(
        (group) => persons.length > 0 && persons.every((name) => (ORDER_PERSONS[group] ?? []).includes(name))
    );
    if (matchedGroup) return { group: matchedGroup, persons };
    if (persons.length === 0 && !company.trim()) return { group: "", persons: [] };
    return { group: "OTHER", persons };
}
