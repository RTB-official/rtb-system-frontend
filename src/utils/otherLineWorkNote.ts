/** 출장업무일지 note에 저장되는 다른호선 작업 문구 */
export const OTHER_LINE_PREFIX = "다른호선에서 작업진행";

/** 보고서 작성/수정·인보이스 패널 공통 배지 스타일 (WorkLogEntryCard와 동일) */
export const OTHER_LINE_BADGE_CLASS =
    "inline-flex items-center px-3 py-1 rounded-full bg-violet-100 text-violet-800 text-[12px] font-semibold border border-violet-200 shadow-sm";

export function isOtherLineNoteLine(line: string) {
    const t = line.trim();
    return t === OTHER_LINE_PREFIX || t.startsWith(`${OTHER_LINE_PREFIX}(`);
}

/** 상세+note 합친 문자열에서 다른호선 문구를 배지용으로 분리 */
export function splitOtherLineNotesFromText(text: string): {
    plainText: string;
    otherLineBadges: string[];
} {
    const otherLineBadges: string[] = [];
    const plainLines: string[] = [];

    for (const line of (text || "").split("\n")) {
        if (isOtherLineNoteLine(line)) {
            otherLineBadges.push(line.trim());
        } else {
            plainLines.push(line);
        }
    }

    return {
        plainText: plainLines.join("\n").replace(/^\n+|\n+$/g, ""),
        otherLineBadges,
    };
}

export function getOtherLineNoteLine(note: string): string | null {
    for (const line of (note || "").split("\n")) {
        if (isOtherLineNoteLine(line)) return line.trim();
    }
    return null;
}

export function parseOtherLineName(note: string): string {
    const line = getOtherLineNoteLine(note);
    if (!line || line === OTHER_LINE_PREFIX) return "";
    const match = line.match(/^다른호선에서 작업진행\((.*)\)$/);
    return match?.[1]?.trim() ?? "";
}

/** 보고서 목록용: 복수호선(호선명) 배지 문구 */
export function formatMultiLineBadgeFromNotes(notes: Array<string | null | undefined>): string | null {
    const names: string[] = [];
    let found = false;

    for (const note of notes) {
        if (!note) continue;
        for (const line of note.split("\n")) {
            if (!isOtherLineNoteLine(line)) continue;
            found = true;
            const name = parseOtherLineName(line);
            if (name) names.push(name);
        }
    }

    if (!found) return null;

    const unique = Array.from(new Set(names));
    if (unique.length === 0) return "복수호선";
    return `복수호선(${unique.join(", ")})`;
}
