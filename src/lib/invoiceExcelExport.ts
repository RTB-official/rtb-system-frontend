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
    hideDayDate?: boolean;
};

export type InvoiceExcelMeta = Record<string, string | number | undefined>;

export type InvoiceExcelNormalTimesheetSectionInput = {
    vessel: string;
    workPlace: string;
    engineerNameAndTitle: string;
    mechanicNamesAndNumbers: string;
    departureDisplay: string;
    returnDisplay: string;
    rows: InvoiceExcelTimesheetRowInput[];
    comments?: string[];
};

export type InvoiceExcelRdRowInput = {
    /** YYYY-MM-DD — 연도(C12) 계산용 */
    date: string;
    day: string;
    dateFormatted: string;
    timeFrom: string;
    timeTo: string;
    totalHours: number;
    weekdayNormal: number;
    weekdayAfter: number;
    weekendNormal: number;
    weekendAfter: number;
    travelWeekday: number;
    travelWeekend: number;
    summaryLine: string;
};

export type InvoiceExcelRdInput = {
    vessel: string;
    workPlace: string;
    rows: InvoiceExcelRdRowInput[];
    comments: string[];
};

/** Normal 인보이스 Time Sheet 고정 셀 */
const NORMAL_TIMESHEET_EXCEL = {
    tableStartRow: 14,
    /** 양식에 미리 잡힌 마지막 데이터 행 (B25) */
    lastDataRow: 25,
    commentsStartRow: 38,
    /** 양식 코멘트 영역 마지막 행 (B38~B40) */
    commentsLastRow: 40,
} as const;

/** R&D 인보이스 양식(Time Sheet) 고정 셀 — Normal과 다름 */
const RD_TIMESHEET_EXCEL = {
    vessel: "B7",
    workPlace: "E7",
    year: "C10",
    tableStartRow: 12,
    /** 양식에 미리 잡힌 마지막 데이터 행 (B28) */
    lastDataRow: 28,
    /** 요약 행(2행 단위) 스타일 복사용 */
    stylePatternRows: [27, 28] as const,
    commentsStartRow: 42,
    /** 양식 코멘트 영역 마지막 행 (B42~B44) */
    commentsLastRow: 44,
} as const;

function resolveSectionYear(rows: InvoiceExcelTimesheetRowInput[]): string {
    for (const row of rows) {
        const date = row.date?.trim();
        if (!date) continue;
        const year = date.split("-")[0]?.trim();
        if (year && /^\d{4}$/.test(year)) return year;
    }
    return String(new Date().getFullYear());
}

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
        createdAt: workLogDataList[0]?.workLog.created_at ?? null,
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
        date: r.hideDayDate ? "" : r.date,
        day: r.hideDayDate ? "" : r.day,
        date_formatted: r.hideDayDate ? "" : r.dateFormatted,
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

function withLeadingSpace(value: string | undefined): string {
    const text = (value ?? "").trim();
    return text.length > 0 ? ` ${text}` : "";
}

function excelNumericCell(value: number | null | undefined): number | "" {
    if (value === null || value === undefined) return "";
    if (typeof value !== "number" || !Number.isFinite(value) || value === 0) {
        return "";
    }
    return value;
}

function safeMergeCells(ws: ExcelJS.Worksheet, range: string) {
    try {
        ws.mergeCells(range);
    } catch {
        // 이미 병합된 경우 무시
    }
}

type FormulaCellBundle = {
    formula?: string;
    result?: ExcelJS.CellValue;
    sharedFormula?: string;
};

function readFormulaCellBundle(cell: ExcelJS.Cell): FormulaCellBundle | null {
    const raw = cell.value;
    if (raw && typeof raw === "object" && !Array.isArray(raw) && !(raw instanceof Date)) {
        const value = raw as {
            formula?: string;
            result?: ExcelJS.CellValue;
            sharedFormula?: string;
            shareType?: string;
        };
        if (typeof value.formula === "string") {
            return {
                formula: value.formula,
                result: value.result,
                sharedFormula:
                    typeof value.sharedFormula === "string"
                        ? value.sharedFormula
                        : undefined,
            };
        }
        if (typeof value.sharedFormula === "string") {
            return {
                sharedFormula: value.sharedFormula,
                result: value.result,
            };
        }
    }
    if (cell.type === ExcelJS.ValueType.Formula && typeof cell.formula === "string") {
        return { formula: cell.formula, result: cell.result };
    }
    return null;
}

function setFormulaCellValue(
    cell: ExcelJS.Cell,
    formula: string,
    result?: ExcelJS.CellValue
) {
    if (result !== undefined) {
        cell.value = { formula, result };
        return;
    }
    cell.value = { formula };
}

/**
 * 엑셀 양식의 드래그 복사(shared) 수식을 일반 수식으로 풀어 spliceRows/write 오류를 방지한다.
 */
export function materializeSharedFormulasInWorksheet(ws: ExcelJS.Worksheet) {
    const masters = new Map<string, { formula: string; result?: ExcelJS.CellValue }>();

    ws.eachRow({ includeEmpty: true }, (row) => {
        row.eachCell({ includeEmpty: true }, (cell) => {
            const bundle = readFormulaCellBundle(cell);
            if (bundle?.formula && !bundle.sharedFormula) {
                masters.set(cell.address, {
                    formula: bundle.formula,
                    result: bundle.result,
                });
            }
        });
    });

    ws.eachRow({ includeEmpty: true }, (row) => {
        row.eachCell({ includeEmpty: true }, (cell) => {
            const bundle = readFormulaCellBundle(cell);
            if (!bundle) return;

            if (bundle.sharedFormula) {
                const masterAddr = bundle.sharedFormula.replace(/\$/g, "");
                const master =
                    masters.get(masterAddr) ??
                    readFormulaCellBundle(ws.getCell(masterAddr));
                if (master?.formula) {
                    setFormulaCellValue(
                        cell,
                        master.formula,
                        bundle.result ?? master.result
                    );
                } else if (bundle.result !== undefined) {
                    cell.value = bundle.result;
                } else {
                    cell.value = null;
                }
                return;
            }

            if (bundle.formula) {
                setFormulaCellValue(cell, bundle.formula, bundle.result);
            }
        });
    });
}

export function materializeSharedFormulasInWorkbook(workbook: ExcelJS.Workbook) {
    for (const ws of workbook.worksheets) {
        materializeSharedFormulasInWorksheet(ws);
    }
}

function copyWorksheetRowStyle(
    ws: ExcelJS.Worksheet,
    sourceRowNum: number,
    targetRowNum: number
) {
    const source = ws.getRow(sourceRowNum);
    const target = ws.getRow(targetRowNum);
    if (source.height) {
        target.height = source.height;
    }
    source.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const targetCell = target.getCell(colNumber);
        targetCell.style = { ...cell.style };
    });
}

/**
 * 양식 lastDataRow(B25/B28) 아래에 행을 삽입해 서명·코멘트 영역을 밀어냄.
 * @returns 삽입한 행 수 (코멘트 시작 행 보정용)
 */
function insertTimesheetRowsAfterTemplate(
    ws: ExcelJS.Worksheet,
    lastDataRow: number,
    extraRowCount: number,
    styleSourceRows: readonly number[]
): number {
    if (extraRowCount <= 0 || styleSourceRows.length === 0) {
        return 0;
    }

    const insertAt = lastDataRow + 1;
    const emptyRows = Array.from({ length: extraRowCount }, () =>
        new Array(32).fill(undefined)
    );
    ws.spliceRows(insertAt, 0, ...emptyRows);

    for (let i = 0; i < extraRowCount; i += 1) {
        const styleRow =
            styleSourceRows[i % styleSourceRows.length] ??
            styleSourceRows[styleSourceRows.length - 1];
        copyWorksheetRowStyle(ws, styleRow, insertAt + i);
    }

    return extraRowCount;
}

function ensureTimesheetRowCapacity(
    ws: ExcelJS.Worksheet,
    startRow: number,
    lastDataRow: number,
    totalRowsNeeded: number,
    styleSourceRows: readonly number[]
): number {
    const capacity = Math.max(0, lastDataRow - startRow + 1);
    if (totalRowsNeeded <= capacity) {
        return 0;
    }
    return insertTimesheetRowsAfterTemplate(
        ws,
        lastDataRow,
        totalRowsNeeded - capacity,
        styleSourceRows
    );
}

/** 코멘트가 양식 행 수(B38~40 / B42~44)를 넘으면 마지막 코멘트 행 아래에 삽입 */
function ensureCommentRowCapacity(
    ws: ExcelJS.Worksheet,
    commentsStartRow: number,
    commentsLastRow: number,
    commentCount: number
): void {
    const capacity = Math.max(0, commentsLastRow - commentsStartRow + 1);
    if (commentCount <= capacity) {
        return;
    }
    insertTimesheetRowsAfterTemplate(
        ws,
        commentsLastRow,
        commentCount - capacity,
        [commentsLastRow]
    );
}

/** Normal 인보이스 Time Sheet 전용 — R&D 양식에는 적용하지 않음 */
function applyNormalTimesheetSheetBorderFormatting(ws: ExcelJS.Worksheet) {
    forceJ6ToJ9BoldOuterBorder(ws);
    forceM6ToM9RightBoldBorder(ws);
    forceD13AndF13BottomBold(ws);
}

function shiftColumnLetter(letter: string, offset: number): string {
    const src = letter.trim().toUpperCase();
    if (!/^[A-Z]+$/.test(src)) return letter;
    let n = 0;
    for (let i = 0; i < src.length; i += 1) {
        n = n * 26 + (src.charCodeAt(i) - 64);
    }
    n += offset;
    if (n < 1) return letter;
    let out = "";
    while (n > 0) {
        const rem = (n - 1) % 26;
        out = String.fromCharCode(65 + rem) + out;
        n = Math.floor((n - 1) / 26);
    }
    return out;
}

function forceJ6ToJ9BoldOuterBorder(ws: ExcelJS.Worksheet) {
    const bold = { style: "medium", color: { argb: "FF000000" } } as const;
    for (let row = 6; row <= 9; row += 1) {
        const cell = ws.getCell(`J${row}`);
        cell.style = {
            ...cell.style,
            border: {
                ...cell.style?.border,
                left: bold,
                right: bold,
                top: row === 6 ? bold : cell.style?.border?.top,
                bottom: row === 9 ? bold : cell.style?.border?.bottom,
            },
        };
    }
}

function forceM6ToM9RightBoldBorder(ws: ExcelJS.Worksheet) {
    const bold = { style: "medium", color: { argb: "FF000000" } } as const;
    for (let row = 6; row <= 9; row += 1) {
        const cell = ws.getCell(`M${row}`);
        cell.style = {
            ...cell.style,
            border: {
                ...cell.style?.border,
                right: bold,
            },
        };
    }
}

function forceD13AndF13BottomBold(ws: ExcelJS.Worksheet) {
    const bold = { style: "medium", color: { argb: "FF000000" } } as const;
    for (const address of ["D13", "E13", "F13"] as const) {
        const cell = ws.getCell(address);
        cell.style = {
            ...cell.style,
            border: {
                ...cell.style?.border,
                bottom: bold,
            },
        };
    }
}

function cloneWorksheetLike(source: ExcelJS.Worksheet, targetName: string) {
    const workbook = source.workbook;
    const target = workbook.addWorksheet(targetName, {
        properties: { ...source.properties },
        views: source.views ? [...source.views] : undefined,
        pageSetup: { ...source.pageSetup },
        headerFooter: { ...source.headerFooter },
        state: source.state,
    });

    if (source.columns && source.columns.length > 0) {
        target.columns = source.columns.map((col) => ({
            key: col.key,
            width: col.width,
            style: col.style ? { ...col.style } : undefined,
            hidden: col.hidden,
            outlineLevel: col.outlineLevel,
        }));
    }

    source.eachRow({ includeEmpty: true }, (row, rowNumber) => {
        const targetRow = target.getRow(rowNumber);
        targetRow.height = row.height;
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            const targetCell = targetRow.getCell(colNumber);
            targetCell.value = cell.value as ExcelJS.CellValue;
            targetCell.style = { ...cell.style };
        });
    });

    const merges = (source.model as { merges?: string[] }).merges ?? [];
    for (const merge of merges) {
        target.mergeCells(merge);
    }

    // ExcelJS 시트 복제 시 이미지가 자동 복제되지 않아서 로고를 수동 복사한다.
    const sourceImages = source.getImages();
    for (const image of sourceImages) {
        const media = source.workbook.getImage(image.imageId);
        if (!media) continue;
        const nextImageId = source.workbook.addImage(media);
        target.addImage(nextImageId, image.range);
    }

    // 일부 병합/스타일 케이스에서 H8 우측 border가 사라지는 문제를 원본 기준으로 복원한다.
    const sourceH8 = source.getCell("H8");
    const targetH8 = target.getCell("H8");
    if (sourceH8.style?.border) {
        targetH8.style = {
            ...targetH8.style,
            border: { ...sourceH8.style.border },
        };
    }
    applyNormalTimesheetSheetBorderFormatting(target);

    return target;
}

function resolveTimeSheetBaseWorksheet(
    workbook: ExcelJS.Workbook,
    mappings: InvoiceExcelFieldMappings | null | undefined
) {
    const m = mappings ?? {};
    const tableSheet = m.table?.sheet?.trim();
    if (tableSheet) {
        const ws = workbook.getWorksheet(tableSheet);
        if (ws) return ws;
    }
    const defaultSheet = m.defaultSheet?.trim();
    if (defaultSheet) {
        const ws = workbook.getWorksheet(defaultSheet);
        if (ws) return ws;
    }
    const named = workbook.getWorksheet("Time Sheet");
    if (named) return named;
    return workbook.worksheets[0];
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

export async function fillNormalTimesheetInvoiceExcelWorkbook(
    templateBuffer: ArrayBuffer,
    mappings: InvoiceExcelFieldMappings | null | undefined,
    sections: InvoiceExcelNormalTimesheetSectionInput[]
): Promise<ExcelJS.Workbook> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(templateBuffer);
    materializeSharedFormulasInWorkbook(workbook);

    if (sections.length === 0) return workbook;

    const baseSheet = resolveTimeSheetBaseWorksheet(workbook, mappings);
    if (!baseSheet) return workbook;

    const sheetNames =
        sections.length <= 1
            ? ["Time Sheet"]
            : sections.map((_, i) => `Time Sheet ${String.fromCharCode(65 + i)}`);

    const timeSheets: ExcelJS.Worksheet[] = [];
    baseSheet.name = sheetNames[0];
    timeSheets.push(baseSheet);
    for (let i = 1; i < sheetNames.length; i += 1) {
        timeSheets.push(cloneWorksheetLike(baseSheet, sheetNames[i]));
    }

    const currencySheet = workbook.getWorksheet("Currency");
    if (currencySheet) {
        const nonCurrencyCount = workbook.worksheets.length - 1;
        currencySheet.orderNo = nonCurrencyCount + 1;
    }

    for (let i = 0; i < sections.length; i += 1) {
        const ws = timeSheets[i];
        const section = sections[i];
        const rowRecords = buildInvoiceExcelRowRecords(section.rows);
        const m = mappings ?? {};
        const startRow = NORMAL_TIMESHEET_EXCEL.tableStartRow;
        const cols = m.table?.columns ?? {
            B: "day",
            C: "date_formatted",
            D: "time_from",
            E: "time_to",
            F: "total_hours",
            G: "weekday_normal",
            H: "weekday_after",
            I: "weekend_normal",
            J: "weekend_after",
            K: "travel_weekday",
            L: "travel_weekend",
        };

        setCellValue(
            ws,
            "E3",
            sections.length <= 1 ? "TIMESHEET" : `TIMESHEET ${String.fromCharCode(65 + i)}`
        );
        setCellValue(ws, "B7", withLeadingSpace(section.vessel));
        setCellValue(ws, "B9", withLeadingSpace(section.workPlace));
        setCellValue(ws, "E7", withLeadingSpace(section.engineerNameAndTitle));
        setCellValue(ws, "E9", withLeadingSpace(section.mechanicNamesAndNumbers));
        setCellValue(ws, "J7", withLeadingSpace(section.departureDisplay));
        setCellValue(ws, "J9", withLeadingSpace(section.returnDisplay));
        setCellValue(ws, "C12", resolveSectionYear(section.rows));
        applyNormalTimesheetSheetBorderFormatting(ws);

        const insertedRows = ensureTimesheetRowCapacity(
            ws,
            startRow,
            NORMAL_TIMESHEET_EXCEL.lastDataRow,
            rowRecords.length,
            [NORMAL_TIMESHEET_EXCEL.lastDataRow]
        );
        const commentsStartRow =
            NORMAL_TIMESHEET_EXCEL.commentsStartRow + insertedRows;
        const commentsLastRow =
            NORMAL_TIMESHEET_EXCEL.commentsLastRow + insertedRows;

        rowRecords.forEach((rec, rowIdx) => {
            const lineNo = startRow + rowIdx;
            for (const [colLetter, fieldKey] of Object.entries(cols)) {
                const shifted = m.table?.columns
                    ? shiftColumnLetter(colLetter, 1)
                    : colLetter;
                const raw = rec[fieldKey];
                const displayValue = raw === 0 ? "" : raw;
                setCellValue(ws, `${shifted}${lineNo}`, displayValue);
            }
        });

        const comments = section.comments ?? [];
        ensureCommentRowCapacity(
            ws,
            commentsStartRow,
            commentsLastRow,
            comments.length
        );
        comments.forEach((comment, idx) => {
            setCellValue(ws, `B${commentsStartRow + idx}`, ` * ${comment}`);
        });
    }

    materializeSharedFormulasInWorkbook(workbook);
    return workbook;
}

export async function fillRdTimesheetInvoiceExcelWorkbook(
    templateBuffer: ArrayBuffer,
    mappings: InvoiceExcelFieldMappings | null | undefined,
    data: InvoiceExcelRdInput
): Promise<ExcelJS.Workbook> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(templateBuffer);
    materializeSharedFormulasInWorkbook(workbook);

    const ws = resolveTimeSheetBaseWorksheet(workbook, mappings);
    if (!ws) return workbook;

    ws.name = "Time Sheet";

    const currencySheet = workbook.getWorksheet("Currency");
    if (currencySheet) {
        const nonCurrencyCount = workbook.worksheets.length - 1;
        currencySheet.orderNo = nonCurrencyCount + 1;
    }

    const startRow = RD_TIMESHEET_EXCEL.tableStartRow;
    const totalRowsNeeded = data.rows.length * 2;
    const insertedRows = ensureTimesheetRowCapacity(
        ws,
        startRow,
        RD_TIMESHEET_EXCEL.lastDataRow,
        totalRowsNeeded,
        RD_TIMESHEET_EXCEL.stylePatternRows
    );
    const commentsStartRow =
        RD_TIMESHEET_EXCEL.commentsStartRow + insertedRows;
    const commentsLastRow = RD_TIMESHEET_EXCEL.commentsLastRow + insertedRows;

    setCellValue(ws, "E3", "TIMESHEET");
    setCellValue(ws, RD_TIMESHEET_EXCEL.vessel, withLeadingSpace(data.vessel));
    setCellValue(
        ws,
        RD_TIMESHEET_EXCEL.workPlace,
        withLeadingSpace(data.workPlace)
    );
    setCellValue(
        ws,
        RD_TIMESHEET_EXCEL.year,
        resolveSectionYear(
            data.rows.map((row) => ({
                date: row.date,
                day: row.day,
                dateFormatted: row.dateFormatted,
                timeFrom: row.timeFrom,
                timeTo: row.timeTo,
                description: "",
                totalHours: row.totalHours,
                weekdayNormal: row.weekdayNormal,
                weekdayAfter: row.weekdayAfter,
                weekendNormal: row.weekendNormal,
                weekendAfter: row.weekendAfter,
                travelWeekday: row.travelWeekday,
                travelWeekend: row.travelWeekend,
            }))
        )
    );

    let currentRow = startRow;
    for (const row of data.rows) {
        const dataRow = currentRow;
        const descRow = currentRow + 1;

        setCellValue(ws, `B${dataRow}`, row.day);
        setCellValue(ws, `C${dataRow}`, row.dateFormatted);
        setCellValue(ws, `D${dataRow}`, row.timeFrom);
        setCellValue(ws, `E${dataRow}`, row.timeTo);
        setCellValue(ws, `F${dataRow}`, excelNumericCell(row.totalHours));
        setCellValue(ws, `G${dataRow}`, excelNumericCell(row.weekdayNormal));
        setCellValue(ws, `H${dataRow}`, excelNumericCell(row.weekdayAfter));
        setCellValue(ws, `I${dataRow}`, excelNumericCell(row.weekendNormal));
        setCellValue(ws, `J${dataRow}`, excelNumericCell(row.weekendAfter));
        setCellValue(ws, `K${dataRow}`, excelNumericCell(row.travelWeekday));
        setCellValue(ws, `L${dataRow}`, excelNumericCell(row.travelWeekend));

        for (const col of ["B", "C", "D", "E", "F"] as const) {
            safeMergeCells(ws, `${col}${dataRow}:${col}${descRow}`);
        }

        safeMergeCells(ws, `G${descRow}:L${descRow}`);
        const summary = row.summaryLine.trim();
        setCellValue(ws, `G${descRow}`, summary.length > 0 ? ` ${summary}` : "");

        currentRow += 2;
    }

    ensureCommentRowCapacity(
        ws,
        commentsStartRow,
        commentsLastRow,
        data.comments.length
    );
    data.comments.forEach((comment, idx) => {
        setCellValue(ws, `B${commentsStartRow + idx}`, ` * ${comment}`);
    });

    materializeSharedFormulasInWorkbook(workbook);
    return workbook;
}

export async function invoiceExcelWorkbookToBlob(
    workbook: ExcelJS.Workbook
): Promise<Blob> {
    materializeSharedFormulasInWorkbook(workbook);
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
