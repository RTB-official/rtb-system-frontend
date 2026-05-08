import ExcelJS from "exceljs";
import type { WorkLogFullData } from "./workLogApi";
import {
    aggregateWorkLogEntryDateRange,
    formatInvoiceReportTableTitle,
    formatKoreanPeriod,
} from "../utils/invoiceReportDisplayTitle";
import type { InvoiceExcelFieldMappings } from "./invoiceExcelTemplateApi";

export type InvoiceExcelTimesheetRowInput = {
    date: string;
    day: string;
    dateFormatted: string;
    timeFrom: string;
    timeTo: string;
    description: string;
    totalHours: number;
    weekdayNormal: number;
    weekdayAfter: number;
    weekendNormal: number;
    weekendAfter: number;
    travelWeekday: number;
    travelWeekend: number;
};

export type InvoiceExcelMeta = Record<string, string | number | undefined>;

function uniqJoin(values: (string | null | undefined)[], sep: string): string {
    const set = new Set<string>();
    for (const v of values) {
        const t = v?.trim();
        if (t) set.add(t);
    }
    return [...set].join(sep);
}

export function buildInvoiceExcelMeta(
    workLogDataList: WorkLogFullData[]
): InvoiceExcelMeta {
    if (workLogDataList.length === 0) {
        return { report_count: 0 };
    }

    const flatEntries = workLogDataList.flatMap((w) => w.entries);
    const { start: periodStart, end: periodEnd } =
        aggregateWorkLogEntryDateRange(flatEntries);

    const vessel = uniqJoin(
        workLogDataList.map((w) => w.workLog.vessel),
        " · "
    );
    const subject = uniqJoin(
        workLogDataList.map((w) => w.workLog.subject),
        " · "
    );
    const author = uniqJoin(
        workLogDataList.map((w) => w.workLog.author),
        ", "
    );
    const engine = uniqJoin(
        workLogDataList.map((w) => w.workLog.engine),
        " · "
    );
    const location = uniqJoin(
        workLogDataList.map((w) => w.workLog.location),
        " · "
    );
    const vehicle = uniqJoin(
        workLogDataList.map((w) => w.workLog.vehicle),
        " · "
    );

    const reportTitle = formatInvoiceReportTableTitle({
        periodStart,
        periodEnd,
        vessel: vessel || null,
        subject: subject || null,
    });

    const periodLabel = formatKoreanPeriod(periodStart, periodEnd);

    return {
        report_title: reportTitle,
        period_start: periodStart ?? "",
        period_end: periodEnd ?? "",
        period_label: periodLabel,
        vessel,
        subject,
        author,
        engine,
        location,
        vehicle,
        report_count: workLogDataList.length,
    };
}

export function buildInvoiceExcelRowRecords(
    rows: InvoiceExcelTimesheetRowInput[]
): InvoiceExcelMeta[] {
    return rows.map((r) => ({
        date: r.date,
        day: r.day,
        date_formatted: r.dateFormatted,
        time_from: r.timeFrom,
        time_to: r.timeTo,
        description: r.description,
        total_hours: r.totalHours,
        weekday_normal: r.weekdayNormal,
        weekday_after: r.weekdayAfter,
        weekend_normal: r.weekendNormal,
        weekend_after: r.weekendAfter,
        travel_weekday: r.travelWeekday,
        travel_weekend: r.travelWeekend,
    }));
}

function parseCellRef(ref: string): { sheet?: string; address: string } {
    const bang = ref.indexOf("!");
    if (bang === -1) {
        return { address: ref.trim() };
    }
    return {
        sheet: ref.slice(0, bang).trim(),
        address: ref.slice(bang + 1).trim(),
    };
}

function resolveWorksheet(
    workbook: ExcelJS.Workbook,
    sheetName: string | undefined,
    fallbackFirst: boolean
): ExcelJS.Worksheet | undefined {
    if (sheetName && sheetName.length > 0) {
        const ws = workbook.getWorksheet(sheetName);
        if (ws) return ws;
    }
    if (fallbackFirst) {
        const first = workbook.worksheets[0];
        return first;
    }
    return undefined;
}

function setCellValue(ws: ExcelJS.Worksheet, address: string, value: unknown) {
    const cell = ws.getCell(address);
    if (typeof value === "number" && Number.isFinite(value)) {
        cell.value = value;
    } else if (value === undefined || value === null) {
        cell.value = "";
    } else {
        cell.value = String(value);
    }
}

export async function fillInvoiceExcelWorkbook(
    templateBuffer: ArrayBuffer,
    mappings: InvoiceExcelFieldMappings | null | undefined,
    meta: InvoiceExcelMeta,
    rowRecords: InvoiceExcelMeta[]
): Promise<ExcelJS.Workbook> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(templateBuffer);

    const m = mappings ?? {};
    const defaultSheet = m.defaultSheet?.trim();

    if (m.cells) {
        for (const [refRaw, fieldKey] of Object.entries(m.cells)) {
            const ref = parseCellRef(refRaw.trim());
            const ws = resolveWorksheet(
                workbook,
                ref.sheet ?? defaultSheet,
                true
            );
            if (!ws) continue;
            setCellValue(ws, ref.address, meta[fieldKey]);
        }
    }

    if (m.table && rowRecords.length > 0) {
        const sheetName = m.table.sheet?.trim() || defaultSheet;
        const ws = resolveWorksheet(workbook, sheetName, true);
        if (ws) {
            const startRow = Math.max(1, Math.floor(m.table.startRow));
            const cols = m.table.columns ?? {};
            rowRecords.forEach((rec, i) => {
                const rowIdx = startRow + i;
                for (const [colLetter, fieldKey] of Object.entries(cols)) {
                    const addr = `${colLetter}${rowIdx}`;
                    setCellValue(ws, addr, rec[fieldKey]);
                }
            });
        }
    }

    return workbook;
}

export async function invoiceExcelWorkbookToBlob(
    workbook: ExcelJS.Workbook
): Promise<Blob> {
    const buf = await workbook.xlsx.writeBuffer();
    return new Blob([buf], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
}

export function triggerExcelDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}
