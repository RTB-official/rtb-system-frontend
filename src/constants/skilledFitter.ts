/** 인보이스·타임시트에서 Skilled fitter로 분류되는 인원(InvoiceCreatePage와 동일). */
export const SKILLED_FITTER_KOREAN_NAMES = [
    "김춘근",
    "안재훈",
    "온권태",
    "이효익",
    "정상민",
] as const;

export const SKILLED_FITTER_NAME_SET = new Set<string>(SKILLED_FITTER_KOREAN_NAMES);

type EntryWithDateAndRemark = {
    dateFrom: string;
    descType?: string;
    persons?: string[];
};

const isSkilledFitterRemarkCheckDescType = (descType: string | undefined) => {
    const t = (descType ?? "").trim();
    return t === "작업" || t === "대기";
};

/**
 * 해당 날짜에 구분이 "작업" 또는 "대기"인 행이 하나라도 있으면 스킬드 핏터 비고 검사 대상.
 * `requiredSkilledFittersInRemarks`에 지정된 인원(Engineer Name and Title과 동일) 중
 * 그날 어떤 행의 비고(persons)에도 한 명도 없으면 그 날짜 키(YYYY-MM-DD)를 담는다.
 * 배열이 비면(지정 없음) 스킬드 핏터 5명 중 아무도 비고에 없을 때만 누락으로 본다.
 */
export function getDatesMissingSkilledFitterRemark(
    entries: readonly EntryWithDateAndRemark[],
    requiredSkilledFittersInRemarks: readonly string[] = []
): Set<string> {
    const byDate = new Map<string, EntryWithDateAndRemark[]>();
    for (const entry of entries) {
        const dateKey = entry.dateFrom;
        if (!dateKey) continue;
        const list = byDate.get(dateKey);
        if (list) {
            list.push(entry);
        } else {
            byDate.set(dateKey, [entry]);
        }
    }

    const missing = new Set<string>();
    for (const [dateKey, dayEntries] of byDate) {
        const dayNeedsSkilledFitterCheck = dayEntries.some((e) =>
            isSkilledFitterRemarkCheckDescType(e.descType)
        );
        if (!dayNeedsSkilledFitterCheck) {
            continue;
        }

        const personsThatDay = new Set<string>();
        for (const e of dayEntries) {
            for (const p of e.persons ?? []) {
                if (p) personsThatDay.add(p);
            }
        }

        const required = requiredSkilledFittersInRemarks.filter(Boolean);
        const isMissing =
            required.length > 0
                ? required.every((name) => !personsThatDay.has(name))
                : !Array.from(SKILLED_FITTER_NAME_SET).some((name) =>
                      personsThatDay.has(name)
                  );

        if (isMissing) {
            missing.add(dateKey);
        }
    }

    return missing;
}
