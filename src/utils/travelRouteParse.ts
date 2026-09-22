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
