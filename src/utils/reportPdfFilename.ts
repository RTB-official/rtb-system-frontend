/** ReportPdfPage / 인보이스 PDF와 동일한 파일명 규칙 (날짜·호선·목적) */

export function formatReportPdfFilename(
    start?: string | null,
    end?: string | null,
    vessel?: string | null,
    subject?: string | null
) {
    if (!start) return "출장보고서";

    const fmt = (ymd: string) => {
        const d = new Date(ymd);
        if (Number.isNaN(d.getTime())) return "";
        const m = d.getMonth() + 1;
        const day = String(d.getDate()).padStart(2, "0");
        return `${m}월${day}일`;
    };

    const s = fmt(start);
    const e = end ? fmt(end) : s;

    const vesselText = vessel ? `${vessel}` : "";
    const subjectText = subject ? subject.trim() : "";

    const datePart = !end || start === end ? `${s}` : `${s}~${e}`;

    return `${datePart} ${vesselText} ${subjectText}`.trim();
}

export function sanitizeReportPdfFilenameBase(name: string): string {
    const trimmed = name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").trim();
    return trimmed || "출장보고서";
}
