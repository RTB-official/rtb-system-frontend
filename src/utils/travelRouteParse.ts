/** 이동 엔트리에서 경유로 쓰는 고정 장소 */
export const GANGDONG_FACTORY = "강동동 공장";

/** details 안의 이동 경로 화살표: DB/입력에 `→`와 `->`가 혼재한다. */
const TRAVEL_ARROW_SPLIT_RE = /\s*(?:→|->)\s*/;
const TRAVEL_ARROW_TEST_RE = /→|->/;

/** `… 이동.` 접미를 제거한 경로 본문 */
export function stripTravelDetailsSuffix(details: string): string {
    return (details ?? "").replace(/\s*이동\.?\s*$/u, "").trim();
}

/**
 * 이동 details에서 출발지·도착지를 뽑는다.
 * 화살표가 없으면 null (호출측에서 moveFrom/moveTo 또는 전체 문자열로 처리).
 */
export function parseTravelRoutePlaces(details: string): {
    origin: string;
    destination: string;
} | null {
    const cleaned = stripTravelDetailsSuffix(details);
    if (!cleaned || !TRAVEL_ARROW_TEST_RE.test(cleaned)) {
        return null;
    }

    const parts = cleaned
        .split(TRAVEL_ARROW_SPLIT_RE)
        .map((part) => part.trim())
        .filter(Boolean);

    if (parts.length < 2) {
        return null;
    }

    return {
        origin: parts[0],
        destination: parts[parts.length - 1],
    };
}

/** 상세 문장 한가운데 `→강동동 공장→`가 있으면 경유지로 본다. */
export function gangdongViaFromDetails(details?: string | null): string | undefined {
    const text = details ?? "";
    if (
        text.includes(`→${GANGDONG_FACTORY}→`) ||
        text.includes(`->${GANGDONG_FACTORY}->`)
    ) {
        return GANGDONG_FACTORY;
    }
    return undefined;
}
