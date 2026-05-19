import type { InvoiceDraftRow } from "../lib/invoiceDraftApi";
import type { WorkLogFullData } from "../lib/workLogApi";

const FALLBACK_VESSEL_LABEL = "기타";

/** 드래프트 payload·제목에서 호선 목록 추출 */
export function getInvoiceDraftVessels(draft: InvoiceDraftRow): string[] {
    const list = draft.payload?.workLogDataList as WorkLogFullData[] | undefined;
    if (Array.isArray(list)) {
        const vessels = new Set<string>();
        for (const item of list) {
            const vessel = item?.workLog?.vessel?.trim();
            if (vessel) {
                vessels.add(vessel);
            }
        }
        if (vessels.size > 0) {
            return [...vessels].sort((a, b) => a.localeCompare(b, "ko"));
        }
    }

    const fromTitle = parseVesselFromDraftTitle(draft.title);
    return fromTitle ? [fromTitle] : [FALLBACK_VESSEL_LABEL];
}

/** 목록 그룹 키용 대표 호선(첫 호선) */
export function getInvoiceDraftPrimaryVessel(draft: InvoiceDraftRow): string {
    return getInvoiceDraftVessels(draft)[0] ?? FALLBACK_VESSEL_LABEL;
}

function parseVesselFromDraftTitle(title: string | null | undefined): string | null {
    const trimmed = title?.trim();
    if (!trimmed) {
        return null;
    }

    const withoutPeriod = trimmed.replace(/^\d+월\d+일(?:~\d+일)?\s*/, "").trim();
    if (!withoutPeriod) {
        return null;
    }

    const hullMatch = withoutPeriod.match(/^(H\d+|OC[\w-]+)/i);
    if (hullMatch?.[1]) {
        return hullMatch[1];
    }

    const uppercaseWords: string[] = [];
    for (const word of withoutPeriod.split(/\s+/)) {
        if (!/^[A-Z0-9][A-Z0-9-]*$/i.test(word)) {
            break;
        }
        uppercaseWords.push(word);
        if (uppercaseWords.length >= 4) {
            break;
        }
    }
    if (uppercaseWords.length > 0) {
        return uppercaseWords.join(" ");
    }

    const first = withoutPeriod.split(/\s+/)[0];
    return first || null;
}

export type InvoiceDraftVesselGroup = {
    vessel: string;
    drafts: InvoiceDraftRow[];
    latestUpdatedAt: string;
};

export function doesInvoiceDraftVesselGroupMatchSearch(
    group: InvoiceDraftVesselGroup,
    query: string
): boolean {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
        return false;
    }

    return group.vessel.toLowerCase().includes(normalized);
}

export function groupInvoiceDraftsByVessel(
    drafts: InvoiceDraftRow[]
): InvoiceDraftVesselGroup[] {
    const map = new Map<string, InvoiceDraftRow[]>();

    for (const draft of drafts) {
        const vessel = getInvoiceDraftPrimaryVessel(draft);
        const bucket = map.get(vessel);
        if (bucket) {
            bucket.push(draft);
        } else {
            map.set(vessel, [draft]);
        }
    }

    return [...map.entries()]
        .map(([vessel, vesselDrafts]) => {
            const sorted = [...vesselDrafts].sort(
                (a, b) =>
                    new Date(b.updated_at).getTime() -
                    new Date(a.updated_at).getTime()
            );
            return {
                vessel,
                drafts: sorted,
                latestUpdatedAt: sorted[0]?.updated_at ?? "",
            };
        })
        .sort(
            (a, b) =>
                new Date(b.latestUpdatedAt).getTime() -
                new Date(a.latestUpdatedAt).getTime()
        );
}
