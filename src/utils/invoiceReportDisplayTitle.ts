/** 인보이스 보고서 목록 테이블 제목과 동일 규칙: 기간 + 호선 + 출장목적 */

function formatKoreanDate(dateString: string) {
    const d = new Date(dateString);
    const month = d.getMonth() + 1;
    const day = d.getDate();
    return { month, day };
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
    let start: string | undefined;
    let end: string | undefined;
    for (const e of entries) {
        const df = e.dateFrom?.trim();
        const dt = e.dateTo?.trim();
        if (df && (!start || df < start)) {
            start = df;
        }
        if (dt && (!end || dt > end)) {
            end = dt;
        }
    }
    return { start, end };
}

export function formatInvoiceReportTableTitle(options: {
    periodStart?: string;
    periodEnd?: string;
    vessel?: string | null;
    subject?: string | null;
}): string {
    const period = formatKoreanPeriod(options.periodStart, options.periodEnd);
    const vessel = options.vessel?.trim() ? options.vessel.trim() : "";
    const purpose = options.subject?.trim() ? options.subject.trim() : "";
    const parts = [period, vessel, purpose].filter(Boolean);
    return parts.length ? parts.join(" ") : "(제목 없음)";
}
