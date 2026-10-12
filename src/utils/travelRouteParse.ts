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

export type MoveEndpointBadge = {
    direction: "departure" | "arrival";
    target: "home" | "lodging";
};

/**
 * 자택/숙소 배지는 DB의 move_from, move_to만 본다.
 * 도착지가 자택·숙소면 도착, 출발지면 출발. 자택이 숙소보다 우선한다.
 */
export function resolveMoveEndpointBadge(
    moveFrom?: string | null,
    moveTo?: string | null
): MoveEndpointBadge | null {
    const from = (moveFrom ?? "").trim();
    const to = (moveTo ?? "").trim();
    if (to === "자택") {
        return { direction: "arrival", target: "home" };
    }
    if (from === "자택") {
        return { direction: "departure", target: "home" };
    }
    if (to === "숙소") {
        return { direction: "arrival", target: "lodging" };
    }
    if (from === "숙소") {
        return { direction: "departure", target: "lodging" };
    }
    return null;
}

/** 자택↔강동동 공장 구간은 실제 소요와 관계없이 이 시간으로 보고 청구에서 뺀다. */
export const GANGDONG_HOME_LEG_HOURS = 1;

/** 집이 멀어 자택↔강동동 공장 시간이 기본값과 다른 인원 */
const GANGDONG_HOME_LEG_HOURS_BY_PERSON: Record<string, number> = {
    우상윤: 2,
};

export function getGangdongHomeLegHours(person?: string | null): number {
    const name = (person ?? "").trim();
    return GANGDONG_HOME_LEG_HOURS_BY_PERSON[name] ?? GANGDONG_HOME_LEG_HOURS;
}

type MoveRoute = {
    moveFrom?: string | null;
    moveTo?: string | null;
    moveVia?: string | null;
};

/**
 * 자택과 강동동 공장을 바로 잇는 이동(방향 무관). 청구 0시간.
 * 경유지가 강동동 공장이면 From/To가 공장으로 잘못 들어가 있어도 경유 이동으로 본다.
 */
export function isGangdongHomeLeg(route: MoveRoute): boolean {
    if ((route.moveVia ?? "").trim() === GANGDONG_FACTORY) {
        return false;
    }
    const from = (route.moveFrom ?? "").trim();
    const to = (route.moveTo ?? "").trim();
    return (
        (from === "자택" && to === GANGDONG_FACTORY) ||
        (from === GANGDONG_FACTORY && to === "자택")
    );
}

/**
 * 강동동 공장을 경유해 자택에서 출발하거나 자택으로 돌아오는 이동.
 * 자택 쪽 끝에서 자택↔강동동 공장 시간을 빼고 청구한다.
 */
export function getGangdongViaHomeDirection(
    route: MoveRoute
): "departure" | "arrival" | null {
    if ((route.moveVia ?? "").trim() !== GANGDONG_FACTORY) {
        return null;
    }
    const from = (route.moveFrom ?? "").trim();
    const to = (route.moveTo ?? "").trim();
    if (from === "자택" && to !== "자택") {
        return "departure";
    }
    if (to === "자택" && from !== "자택") {
        return "arrival";
    }
    return null;
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
