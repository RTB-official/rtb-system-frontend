/** 인보이스 보고서 목록 테이블 제목과 동일 규칙: 기간 + 호선 + 출장목적 */

/** DB·뷰 값(YYYY-MM-DD 또는 ISO)을 달력 일자 키로 통일 */
export function normalizeCalendarDateKey(
    raw?: string | null
): string | undefined {
    const t = raw?.trim();
    if (!t) {
        return undefined;
    }
    const match = /^(\d{4}-\d{2}-\d{2})/.exec(t);
    return match ? match[1] : undefined;
}

function formatKoreanDate(dateString: string) {
    const dayKey = normalizeCalendarDateKey(dateString);
    if (dayKey) {
        const [, month, day] = dayKey.split("-").map(Number);
        return { month, day };
    }
    const d = new Date(dateString);
    if (Number.isNaN(d.getTime())) {
        return { month: 0, day: 0 };
    }
    return { month: d.getMonth() + 1, day: d.getDate() };
}

/** date_from·date_to 각각을 시작·종료 후보에 넣어 최소·최대 일자를 구한다 */
export function mergeWorkLogPeriodBounds(
    prev: { start?: string; end?: string } | undefined,
    dateFrom?: string | null,
    dateTo?: string | null
): { start?: string; end?: string } {
    let start = prev?.start;
    let end = prev?.end;
    for (const raw of [dateFrom, dateTo]) {
        const day = normalizeCalendarDateKey(raw);
        if (!day) {
            continue;
        }
        if (!start || day < start) {
            start = day;
        }
        if (!end || day > end) {
            end = day;
        }
    }
    return { start, end };
}

export function formatKoreanPeriod(start?: string, end?: string) {
    if (!start && !end) return "";
    if (start && !end) {
        const s = formatKoreanDate(start);
        return `${s.month}월${s.day}일`;
    }
    if (!start && end) {
        const e = formatKoreanDate(end);
        return `${e.month}월${e.day}일`;
    }

    const s = formatKoreanDate(start as string);
    const e = formatKoreanDate(end as string);
    if (s.month === e.month) {
        if (s.day === e.day) return `${s.month}월${s.day}일`;
        return `${s.month}월${s.day}일~${e.day}일`;
    }
    return `${s.month}월${s.day}일~${e.month}월${e.day}일`;
}

export function aggregateWorkLogEntryDateRange(
    entries: ReadonlyArray<{ dateFrom?: string; dateTo?: string }>
): { start?: string; end?: string } {
    let bounds: { start?: string; end?: string } | undefined;
    for (const e of entries) {
        bounds = mergeWorkLogPeriodBounds(bounds, e.dateFrom, e.dateTo);
    }
    return bounds ?? {};
}

/**
 * 작업일지 엔트리에서 기간을 못 구할 때(뷰/데이터 누락) 목록 제목 앞 날짜가 사라지지 않도록,
 * 작성일(로컬 달력)을 한 줄짜리 기간 접두사로 쓴다. 작성일 컬럼과 같은 날짜 기준.
 */
function koreanDayLabelFromCreatedAt(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const month = d.getMonth() + 1;
    const day = d.getDate();
    return `${month}월${day}일`;
}

export function formatInvoiceReportTableTitle(options: {
    periodStart?: string;
    periodEnd?: string;
    vessel?: string | null;
    subject?: string | null;
    /** 엔트리 기간이 비었을 때만 사용 (work_log.created_at 등 ISO 문자열) */
    createdAt?: string | null;
}): string {
    let period = formatKoreanPeriod(options.periodStart, options.periodEnd);
    if (!period && options.createdAt?.trim()) {
        period = koreanDayLabelFromCreatedAt(options.createdAt.trim());
    }
    const vessel = options.vessel?.trim() ? options.vessel.trim() : "";
    const purpose = options.subject?.trim() ? options.subject.trim() : "";
    const parts = [period, vessel, purpose].filter(Boolean);
    return parts.length ? parts.join(" ") : "(제목 없음)";
}
