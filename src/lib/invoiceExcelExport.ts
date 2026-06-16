import ExcelJS from "exceljs";
import JSZip from "jszip";
import type { WorkLogFullData } from "./workLogApi";
import {
    aggregateWorkLogEntryDateRange,
    formatInvoiceReportTableTitle,
    formatKoreanPeriod,
} from "../utils/invoiceReportDisplayTitle";
import type { InvoiceExcelFieldMappings } from "./invoiceExcelTemplateApi";
import { INVOICE_MANPOWER_UNIT_PRICE_KRW } from "../constants/invoiceManpowerUnitPriceKrw";

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

export type InvoiceExcelManpowerHourSummary = {
    weekdayNormal: number;
    weekdayAfter: number;
    weekendNormal: number;
    weekendAfter: number;
    travelWeekday: number;
    travelWeekend: number;
};

export type InvoiceExcelManpowerGroupInput = {
    sectionLabel: string;
    peopleCount: number;
    unitLabel: "MAN" | "MEN" | "";
    summary: InvoiceExcelManpowerHourSummary;
    unitPrices: InvoiceExcelManpowerHourSummary;
};

export type InvoiceExcelJobInformationInput = {
    hullNo: string;
    engineType: string;
    workPeriodAndPlace: string;
    workItem: string;
};

export type InvoiceExcelInvoiceSheetInput = {
    recipientCompany: string;
    recipientAddressLines: string[];
    jobInformation: InvoiceExcelJobInformationInput;
    poNumber?: string;
    invoiceNumber?: string;
    invoiceDate: string;
    validity: string;
    currencyUnit: string;
    skilledGroup: InvoiceExcelManpowerGroupInput;
    fitterGroup: InvoiceExcelManpowerGroupInput;
    dailyAllowanceDescription: string;
    dailyAllowanceMealsQty: number;
    dailyAllowanceUnitPrice: number;
    dailyAllowanceLineTotal: number;
};

export type InvoiceExcelJobDescriptionSheetInput = {
    shipName: string;
    workPlace: string;
    engineerNameAndTitle: string;
    mechanicNamesAndNumbers: string;
    workOrderFrom: string;
    poNumber?: string;
    departureDisplay: string;
    returnDisplay: string;
};

/** Job description 시트 상단 정보표 (양식 템플릿 기준) */
const JOB_DESCRIPTION_SHEET_COLS = {
    shipName: "B7",
    engineerNameAndTitle: "E7",
    workOrderFrom: "H7",
    departureDisplay: "K7",
    workPlace: "B9",
    mechanicNamesAndNumbers: "E9",
    poNumber: "H9",
    returnDisplay: "K9",
} as const;

/** Invoice 시트 MANPOWER 고정 행 (양식 템플릿 기준) */
const INVOICE_SHEET_MANPOWER_ROWS = {
    skilledHeader: 15,
    skilledHoursStart: 16,
    skilledSpacer: 22,
    fitterHeader: 23,
    fitterHoursStart: 24,
    fitterSpacer: 30,
    dailyAllowanceDetail: 35,
} as const;

const INVOICE_SHEET_ROW_HEIGHT = {
    manpower: 25.15,
    section: 25.9,
} as const;

const INVOICE_MANPOWER_HOUR_ROWS = [
    { key: "weekdayNormal", label: ": Weekday/ Normal Working Hours" },
    { key: "weekdayAfter", label: ": Weekday/ After Normal Working Hours" },
    {
        key: "weekendNormal",
        label: ": Weekend & Holiday/ Normal Working Hours",
    },
    {
        key: "weekendAfter",
        label: ": Weekend & Holiday/ After Normal Working Hours",
    },
    { key: "travelWeekday", label: ": Weekday/ Waiting & Travel Hours" },
    {
        key: "travelWeekend",
        label: ": Weekend & Holiday/ Waiting & Travel Hours",
    },
] as const satisfies ReadonlyArray<{
    key: keyof InvoiceExcelManpowerHourSummary;
    label: string;
}>;

function getVisibleInvoiceManpowerHourRows(
    group: InvoiceExcelManpowerGroupInput
) {
    return INVOICE_MANPOWER_HOUR_ROWS.filter((rowDef) =>
        shouldShowInvoiceManpowerHourRow(group.summary[rowDef.key])
    );
}

function resetInvoiceSheetRowPresentation(
    ws: ExcelJS.Worksheet,
    rowNumber: number,
    height: number = INVOICE_SHEET_ROW_HEIGHT.manpower
) {
    const row = ws.getRow(rowNumber);
    row.hidden = false;
    row.height = height;
}

function showInvoiceSheetSpacerRow(ws: ExcelJS.Worksheet, rowNumber: number) {
    clearInvoiceSheetRowValues(ws, rowNumber);
    resetInvoiceSheetRowPresentation(ws, rowNumber);
}

function hideInvoiceSheetRow(ws: ExcelJS.Worksheet, rowNumber: number) {
    clearInvoiceSheetRowValues(ws, rowNumber);
    const row = ws.getRow(rowNumber);
    row.hidden = true;
    row.height = INVOICE_SHEET_ROW_HEIGHT.manpower;
}

/** Invoice 시트 열 — 양식은 A열 비우고 B~F가 Description, G가 Q'ty */
const INVOICE_SHEET_COLS = {
    jobInformationLabel: "F7",
    jobInformationRows: ["F8", "F9", "F10", "F11"] as const,
    poNumber: "J7",
    invoiceNumber: "J8",
    invoiceDate: "J9",
    validity: "J10",
    currencyUnit: "J11",
    sectionDescription: "B",
    detailDescription: "C",
    qty: "G",
    unit: "H",
    unitPrice: "I",
    total: "J",
} as const;

const INVOICE_SHEET_CLEAR_COLS = [
    "A",
    "B",
    "C",
    "D",
    "E",
    "F",
    "G",
    "H",
    "I",
    "J",
] as const;

const INVOICE_SHEET_DESCRIPTION_CLEAR_COLS = [
    "A",
    "B",
    "C",
    "D",
    "E",
    "F",
] as const;

const INVOICE_SHEET_DATA_CLEAR_COLS = ["G", "H", "I", "J"] as const;

/** Normal 인보이스 Time Sheet 고정 셀 */
const NORMAL_TIMESHEET_EXCEL = {
    tableStartRow: 14,
    /** 양식에 미리 잡힌 마지막 데이터 행 (B25) */
    lastDataRow: 25,
    commentsStartRow: 38,
    /** 양식 코멘트 영역 마지막 행 (B38~B40) */
    commentsLastRow: 40,
    travelHoursHeader: "K12",
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
    travelHoursHeader: "K10",
} as const;

const TIMESHEET_TRAVEL_HOURS_HEADER = "Waiting & Travel\nHours**";

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

export function formatInvoiceJobInformationRows(
    parts: InvoiceExcelJobInformationInput
): [string, string, string, string] {
    const hull = parts.hullNo.trim();
    const engine = parts.engineType.trim();
    const period = parts.workPeriodAndPlace.trim();
    const workItem = parts.workItem.trim();

    return [
        hull ? `Hull no. ${hull}` : "",
        engine ? `Engine type: ${engine}` : "",
        period ? `Work Period & Place: ${period}` : "",
        workItem ? `Work Item: ${workItem}` : "",
    ];
}

function formatInvoiceManpowerHourQuantity(value: number): string {
    const rounded = Math.round(value * 10) / 10;
    return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

function shouldShowInvoiceManpowerHourRow(value: number): boolean {
    return Math.round(value * 10) / 10 !== 0;
}

function calcInvoiceManpowerLineTotal(hours: number, unitKrw: number): number {
    return Math.round(
        (Math.round(hours * 10) / 10) * unitKrw
    );
}

function resolveInvoiceWorksheet(
    workbook: ExcelJS.Workbook
): ExcelJS.Worksheet | undefined {
    const trimmed = workbook.getWorksheet("Invoice");
    if (trimmed) return trimmed;
    const trailing = workbook.getWorksheet("Invoice ");
    if (trailing) return trailing;
    return workbook.worksheets.find((ws) => ws.name.trim() === "Invoice");
}

function resolveJobDescriptionWorksheet(
    workbook: ExcelJS.Workbook
): ExcelJS.Worksheet | undefined {
    const trimmed = workbook.getWorksheet("Job description");
    if (trimmed) return trimmed;
    const trailing = workbook.getWorksheet("Job description ");
    if (trailing) return trailing;
    return workbook.worksheets.find(
        (ws) => ws.name.trim() === "Job description"
    );
}

export function fillJobDescriptionSheet(
    ws: ExcelJS.Worksheet,
    input: InvoiceExcelJobDescriptionSheetInput
) {
    const cols = JOB_DESCRIPTION_SHEET_COLS;
    setCellValue(ws, cols.shipName, withLeadingSpace(input.shipName));
    setCellValue(
        ws,
        cols.engineerNameAndTitle,
        withLeadingSpace(input.engineerNameAndTitle)
    );
    setCellValue(ws, cols.workOrderFrom, withLeadingSpace(input.workOrderFrom));
    setCellValue(
        ws,
        cols.departureDisplay,
        withLeadingSpace(input.departureDisplay)
    );
    setCellValue(ws, cols.workPlace, withLeadingSpace(input.workPlace));
    setCellValue(
        ws,
        cols.mechanicNamesAndNumbers,
        withLeadingSpace(input.mechanicNamesAndNumbers)
    );
    setCellValue(ws, cols.poNumber, withLeadingSpace(input.poNumber ?? ""));
    setCellValue(
        ws,
        cols.returnDisplay,
        withLeadingSpace(input.returnDisplay)
    );
}

function clearInvoiceSheetRowValues(
    ws: ExcelJS.Worksheet,
    rowNumber: number,
    columns: readonly string[] = INVOICE_SHEET_CLEAR_COLS
) {
    for (const col of columns) {
        const address = `${col}${rowNumber}`;
        if (
            (INVOICE_SHEET_DESCRIPTION_CLEAR_COLS as readonly string[]).includes(
                col
            )
        ) {
            unsetInvoiceSheetCell(ws, address);
            continue;
        }
        setCellValue(ws, address, "");
    }
}

function fillInvoiceSheetHeader(
    ws: ExcelJS.Worksheet,
    input: InvoiceExcelInvoiceSheetInput
) {
    const addressLines = input.recipientAddressLines.slice(0, 3);
    setCellValue(ws, "B8", input.recipientCompany);
    setCellValue(ws, "B9", addressLines[0] ?? "");
    setCellValue(ws, "B10", addressLines[1] ?? "");
    setCellValue(ws, "B11", addressLines[2] ?? "");

    setCellValue(ws, INVOICE_SHEET_COLS.jobInformationLabel, "Job information");
    const jobRows = formatInvoiceJobInformationRows(input.jobInformation);
    INVOICE_SHEET_COLS.jobInformationRows.forEach((cell, index) => {
        setCellValue(ws, cell, jobRows[index] ?? "");
    });

    setCellValue(ws, INVOICE_SHEET_COLS.poNumber, input.poNumber ?? "");
    setCellValue(ws, INVOICE_SHEET_COLS.invoiceNumber, input.invoiceNumber ?? "");
    setCellValue(ws, INVOICE_SHEET_COLS.invoiceDate, input.invoiceDate);
    setCellValue(ws, INVOICE_SHEET_COLS.validity, input.validity);
    setCellValue(ws, INVOICE_SHEET_COLS.currencyUnit, input.currencyUnit);
}

function fillInvoiceManpowerHourRow(
    ws: ExcelJS.Worksheet,
    rowNumber: number,
    label: string,
    hours: number,
    unitPrice: number
) {
    const cols = INVOICE_SHEET_COLS;
    resetInvoiceSheetRowPresentation(ws, rowNumber);

    safeMergeCells(ws, `C${rowNumber}:F${rowNumber}`);
    setCellValue(ws, `${cols.detailDescription}${rowNumber}`, label);
    setCellValue(
        ws,
        `${cols.qty}${rowNumber}`,
        formatInvoiceManpowerHourQuantity(hours)
    );
    setCellValue(ws, `${cols.unit}${rowNumber}`, "hours");
    setCellValue(ws, `${cols.unitPrice}${rowNumber}`, unitPrice);
    setInvoiceSheetLineTotalFormula(
        ws,
        rowNumber,
        calcInvoiceManpowerLineTotal(hours, unitPrice)
    );
}

function fillInvoiceManpowerGroup(
    ws: ExcelJS.Worksheet,
    headerRow: number,
    hoursStartRow: number,
    group: InvoiceExcelManpowerGroupInput
) {
    const cols = INVOICE_SHEET_COLS;
    resetInvoiceSheetRowPresentation(ws, headerRow);

    safeMergeCells(ws, `B${headerRow}:F${headerRow}`);
    setCellValue(ws, `${cols.sectionDescription}${headerRow}`, group.sectionLabel);
    setCellValue(
        ws,
        `${cols.qty}${headerRow}`,
        group.peopleCount > 0 ? group.peopleCount : ""
    );
    setCellValue(ws, `${cols.unit}${headerRow}`, group.unitLabel);
    unsetInvoiceSheetCell(ws, `${cols.unitPrice}${headerRow}`);
    unsetInvoiceSheetCell(ws, `${cols.total}${headerRow}`);

    const visibleRows = getVisibleInvoiceManpowerHourRows(group);
    const blockEnd = hoursStartRow + INVOICE_MANPOWER_HOUR_ROWS.length - 1;

    visibleRows.forEach((rowDef, index) => {
        fillInvoiceManpowerHourRow(
            ws,
            hoursStartRow + index,
            rowDef.label,
            group.summary[rowDef.key],
            group.unitPrices[rowDef.key]
        );
    });

    for (
        let rowNumber = hoursStartRow + visibleRows.length;
        rowNumber <= blockEnd;
        rowNumber += 1
    ) {
        hideInvoiceSheetRow(ws, rowNumber);
    }
}

export function fillInvoiceSheet(
    ws: ExcelJS.Worksheet,
    input: InvoiceExcelInvoiceSheetInput,
    _variant: "normal" | "rd"
) {
    fillInvoiceSheetHeader(ws, input);

    const rows = INVOICE_SHEET_MANPOWER_ROWS;
    for (
        let row = rows.skilledHeader;
        row <= rows.fitterSpacer;
        row += 1
    ) {
        clearInvoiceSheetRowValues(ws, row);
    }
    clearInvoiceSheetRowValues(ws, rows.dailyAllowanceDetail);

    fillInvoiceManpowerGroup(
        ws,
        rows.skilledHeader,
        rows.skilledHoursStart,
        input.skilledGroup
    );
    showInvoiceSheetSpacerRow(ws, rows.skilledSpacer);
    fillInvoiceManpowerGroup(
        ws,
        rows.fitterHeader,
        rows.fitterHoursStart,
        input.fitterGroup
    );
    showInvoiceSheetSpacerRow(ws, rows.fitterSpacer);

    const cols = INVOICE_SHEET_COLS;
    resetInvoiceSheetRowPresentation(
        ws,
        rows.dailyAllowanceDetail,
        INVOICE_SHEET_ROW_HEIGHT.manpower
    );
    safeMergeCells(
        ws,
        `${cols.detailDescription}${rows.dailyAllowanceDetail}:F${rows.dailyAllowanceDetail}`
    );
    setCellValue(
        ws,
        `${cols.detailDescription}${rows.dailyAllowanceDetail}`,
        input.dailyAllowanceDescription
    );
    setCellValue(
        ws,
        `${cols.qty}${rows.dailyAllowanceDetail}`,
        input.dailyAllowanceMealsQty > 0 ? input.dailyAllowanceMealsQty : ""
    );
    setCellValue(ws, `${cols.unit}${rows.dailyAllowanceDetail}`, "Meals");
    setCellValue(
        ws,
        `${cols.unitPrice}${rows.dailyAllowanceDetail}`,
        input.dailyAllowanceUnitPrice
    );
    setInvoiceSheetLineTotalFormula(
        ws,
        rows.dailyAllowanceDetail,
        input.dailyAllowanceLineTotal
    );

    applyInvoiceSheetFooterSectionLayout(ws, _variant);
}

export function buildInvoiceExcelManpowerGroupInput(
    sectionLabel: string,
    peopleCount: number,
    summary: InvoiceExcelManpowerHourSummary,
    role: "skilled" | "fitter"
): InvoiceExcelManpowerGroupInput {
    const unitPrices = INVOICE_MANPOWER_UNIT_PRICE_KRW[role];
    const unitLabel: InvoiceExcelManpowerGroupInput["unitLabel"] =
        peopleCount > 1 ? "MEN" : peopleCount === 1 ? "MAN" : "";

    return {
        sectionLabel,
        peopleCount,
        unitLabel,
        summary,
        unitPrices: { ...unitPrices },
    };
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

function sanitizeExcelCellString(value: string): string {
    return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
}

function unsetInvoiceSheetCell(ws: ExcelJS.Worksheet, address: string) {
    ws.getCell(address).value = null;
}

function getWorksheetCellDisplayText(cell: ExcelJS.Cell): string {
    const value = cell.value;
    if (value === null || value === undefined) return "";
    if (typeof value === "object") {
        if (
            "richText" in value &&
            Array.isArray((value as ExcelJS.CellRichTextValue).richText)
        ) {
            return (value as ExcelJS.CellRichTextValue).richText
                .map((part) => part.text ?? "")
                .join("");
        }
        if (
            "text" in value &&
            typeof (value as { text?: string }).text === "string"
        ) {
            return (value as { text: string }).text;
        }
        if ("result" in value) {
            return String((value as ExcelJS.CellFormulaValue).result ?? "");
        }
    }
    return String(value);
}

function findInvoiceSheetRowByColumnText(
    ws: ExcelJS.Worksheet,
    col: string,
    pattern: RegExp,
    startRow: number,
    endRow: number
): number | undefined {
    for (let row = startRow; row <= endRow; row += 1) {
        const text = getWorksheetCellDisplayText(ws.getCell(`${col}${row}`));
        if (pattern.test(text)) return row;
    }
    return undefined;
}

function findInvoiceSheetRowByDescriptionText(
    ws: ExcelJS.Worksheet,
    pattern: RegExp,
    startRow: number,
    endRow: number
): number | undefined {
    const descriptionCols = ["B", "C", "D", "E", "F"] as const;
    for (let row = startRow; row <= endRow; row += 1) {
        for (const col of descriptionCols) {
            const text = getWorksheetCellDisplayText(ws.getCell(`${col}${row}`));
            if (pattern.test(text)) return row;
        }
    }
    return undefined;
}

function clearInvoiceSheetCellCompletely(
    ws: ExcelJS.Worksheet,
    address: string
) {
    ws.getCell(address).value = null;
}

function materializeSharedFormulaCell(
    ws: ExcelJS.Worksheet,
    address: string
) {
    const value = ws.getCell(address).value;
    if (
        typeof value === "object" &&
        value !== null &&
        "sharedFormula" in value
    ) {
        setCellValue(ws, address, 0);
    }
}

function dissolveInvoiceSheetFooterSharedTotalFormulas(ws: ExcelJS.Worksheet) {
    const searchStart = INVOICE_SHEET_MANPOWER_ROWS.dailyAllowanceDetail;
    for (let row = searchStart; row <= searchStart + 15; row += 1) {
        materializeSharedFormulaCell(ws, `J${row}`);
    }

    const mileageRow = findInvoiceSheetRowByDescriptionText(
        ws,
        /\* Mileage:/,
        searchStart,
        searchStart + 20
    );
    if (mileageRow) {
        const masterCell = ws.getCell(`J${mileageRow}`);
        const masterValue = masterCell.value;
        if (
            typeof masterValue === "object" &&
            masterValue !== null &&
            "formula" in masterValue &&
            "shareType" in masterValue
        ) {
            setCellValue(ws, `J${mileageRow}`, 0);
        }
    }
}

function isInvoiceSheetSpacerRow(
    ws: ExcelJS.Worksheet,
    rowNumber: number
): boolean {
    if (rowNumber < 1) return false;
    for (const col of INVOICE_SHEET_CLEAR_COLS) {
        const text = getWorksheetCellDisplayText(ws.getCell(`${col}${rowNumber}`));
        const trimmed = text.trim();
        if (trimmed !== "" && trimmed !== "0") return false;
    }
    return true;
}

/** R&D 양식: Transportation(4)과 Accomodation(5) 사이 공백 행 2개 → 1개 */
function collapseRdInvoiceTransportationAccommodationGap(
    ws: ExcelJS.Worksheet,
    accommodationHeaderRow: number
) {
    const rowAboveHeader = accommodationHeaderRow - 1;
    const rowAboveThat = accommodationHeaderRow - 2;
    if (
        isInvoiceSheetSpacerRow(ws, rowAboveHeader) &&
        isInvoiceSheetSpacerRow(ws, rowAboveThat)
    ) {
        hideInvoiceSheetRow(ws, rowAboveThat);
    }
}

/** Transportation mileage 안내 행 제거, Accommodation 단위/합계를 상세 행으로 이동 */
function applyInvoiceSheetFooterSectionLayout(
    ws: ExcelJS.Worksheet,
    variant: "normal" | "rd"
) {
    const cols = INVOICE_SHEET_COLS;
    const searchStart = INVOICE_SHEET_MANPOWER_ROWS.dailyAllowanceDetail;

    dissolveInvoiceSheetFooterSharedTotalFormulas(ws);

    const mileageRow = findInvoiceSheetRowByDescriptionText(
        ws,
        /\* Mileage:/,
        searchStart,
        searchStart + 20
    );
    if (mileageRow) hideInvoiceSheetRow(ws, mileageRow);

    const hotelMileageRow = findInvoiceSheetRowByDescriptionText(
        ws,
        /Hotel to HHI/i,
        searchStart,
        searchStart + 20
    );
    if (hotelMileageRow) hideInvoiceSheetRow(ws, hotelMileageRow);

    const accommodationHeaderRow = findInvoiceSheetRowByDescriptionText(
        ws,
        /^\s*5\.\s*Accomodation/i,
        searchStart,
        searchStart + 25
    );
    if (!accommodationHeaderRow) return;

    const detailRow = accommodationHeaderRow + 1;
    const headerUnitText = getWorksheetCellDisplayText(
        ws.getCell(`${cols.unit}${accommodationHeaderRow}`)
    );
    const headerTotalCell = ws.getCell(`${cols.total}${accommodationHeaderRow}`);
    const headerTotalValue = headerTotalCell.value;
    const headerHasTotalFormula =
        typeof headerTotalValue === "object" &&
        headerTotalValue !== null &&
        ("formula" in headerTotalValue || "sharedFormula" in headerTotalValue);

    if (headerUnitText === "PC") {
        setCellValue(ws, `${cols.unit}${detailRow}`, "PC");
        clearInvoiceSheetCellCompletely(
            ws,
            `${cols.unit}${accommodationHeaderRow}`
        );
        setCellValue(ws, `${cols.total}${detailRow}`, 0);
        clearInvoiceSheetCellCompletely(
            ws,
            `${cols.total}${accommodationHeaderRow}`
        );
    } else {
        const headerTotalIsZero =
            headerTotalValue === 0 ||
            headerTotalValue === "0" ||
            (typeof headerTotalValue === "object" &&
                headerTotalValue !== null &&
                "result" in headerTotalValue &&
                (headerTotalValue as ExcelJS.CellFormulaValue).result === 0);

        if (headerTotalIsZero || headerHasTotalFormula) {
            setCellValue(ws, `${cols.total}${detailRow}`, 0);
            clearInvoiceSheetCellCompletely(
                ws,
                `${cols.total}${accommodationHeaderRow}`
            );
        }
    }

    if (variant === "rd") {
        collapseRdInvoiceTransportationAccommodationGap(
            ws,
            accommodationHeaderRow
        );
    }
}

function setCellValue(ws: ExcelJS.Worksheet, address: string, value: unknown) {
    const cell = ws.getCell(address);
    if (typeof value === "number" && Number.isFinite(value)) {
        cell.value = value;
    } else if (value === undefined || value === null) {
        cell.value = "";
    } else {
        cell.value = sanitizeExcelCellString(String(value));
    }
}

function setInvoiceSheetLineTotalFormula(
    ws: ExcelJS.Worksheet,
    rowNumber: number,
    result?: number
) {
    const cols = INVOICE_SHEET_COLS;
    const formula = `${cols.qty}${rowNumber}*${cols.unitPrice}${rowNumber}`;
    const cell = ws.getCell(`${cols.total}${rowNumber}`);
    if (result !== undefined && Number.isFinite(result)) {
        setFormulaCellValue(cell, formula, result);
        return;
    }
    setFormulaCellValue(cell, formula);
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

function isRowEmptyBetweenColumns(
    ws: ExcelJS.Worksheet,
    rowNumber: number,
    startCol: number,
    endCol: number
): boolean {
    const row = ws.getRow(rowNumber);
    for (let col = startCol; col <= endCol; col += 1) {
        const value = row.getCell(col).value;
        if (value === null || value === undefined || value === "") continue;
        return false;
    }
    return true;
}

function safeMergeCells(ws: ExcelJS.Worksheet, range: string) {
    try {
        ws.mergeCells(range);
    } catch {
        // 이미 병합된 경우 무시
    }
}

function columnLetterToNumber(letter: string): number {
    let n = 0;
    for (const ch of letter.trim().toUpperCase()) {
        n = n * 26 + (ch.charCodeAt(0) - 64);
    }
    return n;
}

function columnNumberToLetter(n: number): string {
    let out = "";
    let num = n;
    while (num > 0) {
        const rem = (num - 1) % 26;
        out = String.fromCharCode(65 + rem) + out;
        num = Math.floor((num - 1) / 26);
    }
    return out;
}

type MergeCellRange = {
    top: number;
    left: number;
    bottom: number;
    right: number;
};

type WorksheetImageAnchor = {
    nativeRow?: number;
    row?: number;
};

type WorksheetImageLike = {
    range?: {
        tl?: WorksheetImageAnchor;
        br?: WorksheetImageAnchor;
    };
};

function parseMergeRef(ref: string): MergeCellRange | null {
    const match = ref.trim().match(/^([A-Za-z]+)(\d+):([A-Za-z]+)(\d+)$/);
    if (!match) return null;
    return {
        left: columnLetterToNumber(match[1]),
        top: Number.parseInt(match[2], 10),
        right: columnLetterToNumber(match[3]),
        bottom: Number.parseInt(match[4], 10),
    };
}

function formatMergeRef(range: MergeCellRange): string {
    return `${columnNumberToLetter(range.left)}${range.top}:${columnNumberToLetter(range.right)}${range.bottom}`;
}

function getWorksheetMergeRefs(ws: ExcelJS.Worksheet): string[] {
    const model = ws.model as { merges?: string[] };
    return [...(model.merges ?? [])];
}

function mergeRangesOverlap(a: MergeCellRange, b: MergeCellRange): boolean {
    return !(
        a.bottom < b.top ||
        b.bottom < a.top ||
        a.right < b.left ||
        b.right < a.left
    );
}

function normalizeWorksheetMerges(ws: ExcelJS.Worksheet) {
    const normalized: MergeCellRange[] = [];
    for (const ref of getWorksheetMergeRefs(ws)) {
        const range = parseMergeRef(ref);
        if (!range) continue;
        if (range.top === range.bottom && range.left === range.right) continue;
        if (normalized.some((existing) => mergeRangesOverlap(existing, range))) {
            continue;
        }
        normalized.push(range);
    }

    clearWorksheetMerges(ws);
    for (const range of normalized) {
        safeMergeCells(ws, formatMergeRef(range));
    }
}

function normalizeWorkbookMerges(workbook: ExcelJS.Workbook) {
    for (const ws of workbook.worksheets) {
        normalizeWorksheetMerges(ws);
    }
}

function clearWorksheetMerges(ws: ExcelJS.Worksheet) {
    for (const ref of getWorksheetMergeRefs(ws)) {
        try {
            ws.unMergeCells(ref);
        } catch {
            // 병합 상태가 이미 바뀐 경우 무시
        }
    }
}

function shiftMergeRangeForRowInsert(
    range: MergeCellRange,
    insertAt: number,
    count: number
): MergeCellRange {
    if (range.bottom < insertAt) {
        return range;
    }
    if (range.top >= insertAt) {
        return {
            ...range,
            top: range.top + count,
            bottom: range.bottom + count,
        };
    }

    // 삽입 지점에 걸친 병합을 그대로 확장하면 날짜/시간/Total 셀이 아래 행까지 붙어버린다.
    // 새로 삽입한 타임시트 행은 별도로 병합하므로 기존 병합은 삽입 직전까지만 유지한다.
    return {
        ...range,
        bottom: insertAt - 1,
    };
}

function restoreMergesAfterRowInsert(
    ws: ExcelJS.Worksheet,
    mergeRefs: string[],
    insertAt: number,
    count: number
) {
    const restored: MergeCellRange[] = [];
    for (const ref of mergeRefs) {
        const range = parseMergeRef(ref);
        if (!range) continue;
        const shifted = shiftMergeRangeForRowInsert(range, insertAt, count);
        if (shifted.top === shifted.bottom && shifted.left === shifted.right) {
            continue;
        }
        if (restored.some((existing) => mergeRangesOverlap(existing, shifted))) {
            continue;
        }
        safeMergeCells(ws, formatMergeRef(shifted));
        restored.push(shifted);
    }
}

function shiftImageAnchorBelowRow(
    anchor: WorksheetImageAnchor | undefined,
    insertAt: number,
    count: number
) {
    if (!anchor) return;

    const zeroBasedInsertRow = insertAt - 1;
    if (typeof anchor.nativeRow === "number" && anchor.nativeRow >= zeroBasedInsertRow) {
        anchor.nativeRow += count;
    }
}

function shiftImagesBelowRow(
    ws: ExcelJS.Worksheet,
    insertAt: number,
    count: number
) {
    const worksheetWithImages = ws as ExcelJS.Worksheet & {
        getImages?: () => WorksheetImageLike[];
    };
    const images = worksheetWithImages.getImages?.() ?? [];

    for (const image of images) {
        shiftImageAnchorBelowRow(image.range?.tl, insertAt, count);
        shiftImageAnchorBelowRow(image.range?.br, insertAt, count);
    }
}

function stripWorksheetImages(workbook: ExcelJS.Workbook) {
    for (const ws of workbook.worksheets) {
        const worksheetWithMedia = ws as ExcelJS.Worksheet & {
            _media?: unknown[];
        };
        if (Array.isArray(worksheetWithMedia._media)) {
            worksheetWithMedia._media = [];
        }
    }
}

function calculateWorksheetDimensionRef(xml: string): string | null {
    const refs = [...xml.matchAll(/<c\b[^>]*\br="([A-Z]+)(\d+)"/g)];
    if (refs.length === 0) return null;

    let minRow = Number.POSITIVE_INFINITY;
    let maxRow = 0;
    let minCol = Number.POSITIVE_INFINITY;
    let maxCol = 0;

    for (const match of refs) {
        const col = columnLetterToNumber(match[1]);
        const row = Number.parseInt(match[2], 10);
        if (!Number.isFinite(row) || row < 1 || col < 1) continue;
        minRow = Math.min(minRow, row);
        maxRow = Math.max(maxRow, row);
        minCol = Math.min(minCol, col);
        maxCol = Math.max(maxCol, col);
    }

    if (!Number.isFinite(minRow) || maxRow < 1 || maxCol < 1) return null;
    return `${columnNumberToLetter(minCol)}${minRow}:${columnNumberToLetter(maxCol)}${maxRow}`;
}

type MinimalWorksheetCell = {
    col: number;
    ref: string;
    xml: string;
};

const invoiceExcelTemplateBuffers = new WeakMap<ExcelJS.Workbook, ArrayBuffer>();

function rememberInvoiceExcelTemplate(
    workbook: ExcelJS.Workbook,
    templateBuffer: ArrayBuffer
) {
    invoiceExcelTemplateBuffers.set(workbook, templateBuffer.slice(0));
}

function extractXmlFragment(xml: string, tagName: string): string {
    const pairedMatch = xml.match(
        new RegExp(`<${tagName}\\b[\\s\\S]*?<\\/${tagName}>`)
    );
    if (pairedMatch) return pairedMatch[0].replace(/\s+\w+:\w+="[^"]*"/g, "");

    const selfClosingMatch = xml.match(new RegExp(`<${tagName}\\b[^>]*\\/>`));
    return selfClosingMatch?.[0].replace(/\s+\w+:\w+="[^"]*"/g, "") ?? "";
}

/** sheetPr 자식 순서(outlinePr → pageSetUpPr)를 OOXML 스키마에 맞게 정렬 */
function normalizeSheetPrFragment(sheetPrXml: string): string {
    if (!sheetPrXml) return "";

    const outlinePr = sheetPrXml.match(/<outlinePr\b[^>]*\/>/)?.[0] ?? "";
    const pageSetUpPr = sheetPrXml.match(/<pageSetUpPr\b[^>]*\/>/)?.[0] ?? "";
    if (!outlinePr && !pageSetUpPr) {
        return sheetPrXml.replace(/\s+\w+:\w+="[^"]*"/g, "");
    }

    return `<sheetPr>${outlinePr}${pageSetUpPr}</sheetPr>`;
}

function extractRowAttributes(xml: string): Map<number, string> {
    const rowAttrs = new Map<number, string>();

    for (const match of xml.matchAll(/<row\b([^>]*?)\/?>/g)) {
        const attrs = match[1] ?? "";
        const rowMatch = attrs.match(/\br="(\d+)"/);
        if (!rowMatch) continue;

        const row = Number.parseInt(rowMatch[1], 10);
        if (!Number.isFinite(row) || row < 1) continue;

        const preservedAttrs = [
            "ht",
            "customHeight",
            "hidden",
            "outlineLevel",
            "thickTop",
            "thickBot",
        ]
            .map((name) => attrs.match(new RegExp(`\\b${name}="[^"]+"`))?.[0])
            .filter(Boolean)
            .join(" ");

        if (preservedAttrs) rowAttrs.set(row, preservedAttrs);
    }

    return rowAttrs;
}

function extractTopRowAttributes(xml: string, lastRow: number): Map<number, string> {
    const attrs = extractRowAttributes(xml);
    for (const row of [...attrs.keys()]) {
        if (row > lastRow) attrs.delete(row);
    }
    return attrs;
}

function extractTemplateRowAttributes(xml: string): Map<number, string> {
    const rowAttrs = new Map<number, string>();

    for (const match of xml.matchAll(/<row\b([^>]*?)\/?>/g)) {
        const attrs = match[1] ?? "";
        const rowMatch = attrs.match(/\br="(\d+)"/);
        if (!rowMatch) continue;

        const row = Number.parseInt(rowMatch[1], 10);
        if (!Number.isFinite(row) || row < 1) continue;

        const preservedAttrs = [
            "spans",
            "s",
            "customFormat",
            "ht",
            "customHeight",
            "hidden",
            "outlineLevel",
            "thickTop",
            "thickBot",
        ]
            .map((name) => attrs.match(new RegExp(`\\b${name}="[^"]+"`))?.[0])
            .filter(Boolean)
            .join(" ");

        if (preservedAttrs) rowAttrs.set(row, preservedAttrs);
    }

    return rowAttrs;
}

function normalizeWorksheetCellXml(
    cellXml: string,
    templateStyles: Map<string, string> | undefined
): MinimalWorksheetCell | null {
    const refMatch = cellXml.match(/\br="([A-Z]+)(\d+)"/);
    if (!refMatch) return null;

    const ref = `${refMatch[1]}${refMatch[2]}`;
    const col = columnLetterToNumber(refMatch[1]);
    const valueMatch = cellXml.match(/<v>[\s\S]*?<\/v>/);
    const formulaMatch = cellXml.match(/<f(?:\s[^>]*)?>[\s\S]*?<\/f>/);
    const inlineStringMatch = cellXml.match(/<is>[\s\S]*?<\/is>/);
    const typeMatch = cellXml.match(/\bt="([^"]+)"/);

    const templateStyle = templateStyles?.get(ref);
    if (!valueMatch && !formulaMatch && !inlineStringMatch && !templateStyle) {
        return null;
    }

    const attrs = [`r="${ref}"`];
    if (templateStyle) attrs.push(`s="${templateStyle}"`);
    if (typeMatch) attrs.push(`t="${typeMatch[1]}"`);

    const body = [
        formulaMatch?.[0],
        valueMatch?.[0],
        inlineStringMatch?.[0],
    ]
        .filter(Boolean)
        .join("");

    return {
        col,
        ref,
        xml: `<c ${attrs.join(" ")}>${body}</c>`,
    };
}

function injectMissingTimeSheetGrayBarCells(
    rows: Map<number, MinimalWorksheetCell[]>,
    templateStyles?: Map<string, string>
) {
    if (!templateStyles?.has("E4") || !templateStyles.has("B5")) return;

    for (const [ref, styleId] of templateStyles) {
        const refMatch = ref.match(/^([A-Z]+)(\d+)$/);
        if (!refMatch) continue;

        const row = Number.parseInt(refMatch[2], 10);
        if (row !== 4 && row !== 5) continue;

        const col = columnLetterToNumber(refMatch[1]);
        const cells = rows.get(row) ?? [];
        if (cells.some((cell) => cell.ref === ref)) continue;

        cells.push({
            col,
            ref,
            xml: `<c r="${ref}" s="${styleId}"></c>`,
        });
        rows.set(row, cells);
    }
}

function buildMinimalWorksheetXml(
    xml: string,
    templateStyles?: Map<string, string>,
    templateLayout?: TemplateWorksheetLayout
): string {
    const rows = new Map<number, MinimalWorksheetCell[]>();
    const rowAttrs = extractRowAttributes(xml);
    for (const [row, attrs] of templateLayout?.topRowAttrs ?? []) {
        rowAttrs.set(row, attrs);
    }
    const cellMatches = xml.match(/<c\b[\s\S]*?(?:<\/c>|\/>)/g) ?? [];

    for (const cellXml of cellMatches) {
        const normalized = normalizeWorksheetCellXml(cellXml, templateStyles);
        if (!normalized) continue;

        const row = Number.parseInt(normalized.ref.replace(/^[A-Z]+/, ""), 10);
        if (!Number.isFinite(row) || row < 1) continue;

        const cells = rows.get(row) ?? [];
        cells.push(normalized);
        rows.set(row, cells);
    }

    injectMissingTimeSheetGrayBarCells(rows, templateStyles);

    const rowXml = [...rows.entries()]
        .sort(([a], [b]) => a - b)
        .map(([row, cells]) => {
            const cellsXml = cells
                .sort((a, b) => a.col - b.col)
                .map((cell) => cell.xml)
                .join("");
            const attrs = rowAttrs.get(row);
            return `<row r="${row}"${attrs ? ` ${attrs}` : ""}>${cellsXml}</row>`;
        })
        .join("");

    const sheetDataXml = `<sheetData>${rowXml}</sheetData>`;
    const dimensionRef = calculateWorksheetDimensionRef(sheetDataXml) ?? "A1";
    const sheetFormatPr = extractXmlFragment(xml, "sheetFormatPr");
    const cols = extractXmlFragment(xml, "cols");
    const mergeCells = extractXmlFragment(xml, "mergeCells");
    const pageMargins = extractXmlFragment(xml, "pageMargins");
    const pageSetup = extractXmlFragment(xml, "pageSetup");
    const drawing = extractXmlFragment(xml, "drawing");
    const sheetPr = normalizeSheetPrFragment(
        templateLayout?.sheetPr || extractXmlFragment(xml, "sheetPr")
    );
    const sheetViews =
        extractXmlFragment(xml, "sheetViews") ||
        templateLayout?.sheetViews ||
        '<sheetViews><sheetView workbookViewId="0" showGridLines="0"/></sheetViews>';

    return [
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
        sheetPr,
        `<dimension ref="${dimensionRef}"/>`,
        sheetViews,
        sheetFormatPr,
        cols,
        sheetDataXml,
        mergeCells,
        drawing,
        pageMargins,
        pageSetup,
        "</worksheet>",
    ].join("");
}

type WorkbookSheetInfo = {
    name: string;
    path: string;
};

type TemplateWorksheetLayout = {
    topRowAttrs: Map<number, string>;
    sheetViews?: string;
    sheetPr?: string;
};

function hasTemplateCellStyle(xml: string, ref: string): boolean {
    return new RegExp(`<c\\b[^>]*\\br="${ref}"[^>]*\\bs="\\d+"`).test(xml);
}

function buildTimeSheetTemplateLayout(
    templateXml: string,
    outputXml: string,
    outputSharedStrings: string[]
): TemplateWorksheetLayout {
    const topRowAttrs = new Map<number, string>();
    for (const [row, attrs] of extractTemplateRowAttributes(templateXml)) {
        if (row <= 13) {
            topRowAttrs.set(row, attrs);
        }
    }
    const totalRow =
        findRowsContainingText(outputXml, outputSharedStrings, /^Total$/i)
            .filter((row) => row >= 14)
            .sort((a, b) => b - a)[0] ?? 1000;

    if (hasTemplateCellStyle(templateXml, "A48")) {
        return { topRowAttrs };
    }

    applyNormalTimeSheetFooterRowAttributes(
        topRowAttrs,
        extractTemplateRowAttributes(templateXml),
        totalRow,
        outputXml,
        outputSharedStrings
    );

    return { topRowAttrs };
}

function normalizeWorkbookTargetPath(target: string): string {
    const normalized = target.replace(/^\/?xl\//, "").replace(/^\/+/, "");
    return `xl/${normalized}`;
}

async function readWorkbookSheetInfos(zip: JSZip): Promise<WorkbookSheetInfo[]> {
    const workbookXml = await zip.file("xl/workbook.xml")?.async("string");
    const relsXml = await zip.file("xl/_rels/workbook.xml.rels")?.async("string");
    if (!workbookXml || !relsXml) return [];

    const relTargets = new Map<string, string>();
    for (const match of relsXml.matchAll(
        /<Relationship\b[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g
    )) {
        relTargets.set(match[1], normalizeWorkbookTargetPath(match[2]));
    }

    return [...workbookXml.matchAll(/<sheet\b[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g)]
        .map((match) => {
            const path = relTargets.get(match[2]);
            return path ? { name: match[1], path } : null;
        })
        .filter((sheet): sheet is WorkbookSheetInfo => Boolean(sheet));
}

function getTemplateSheetName(outputSheetName: string): string {
    const normalized = outputSheetName.trim();
    if (normalized.startsWith("Time Sheet")) return "Time Sheet";
    if (normalized === "Invoice") return "Invoice";
    return normalized;
}

function extractSharedStrings(xml: string | undefined): string[] {
    if (!xml) return [];
    return [...xml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((match) =>
        match[1].replace(/<[^>]+>/g, "")
    );
}

function findRowsContainingText(xml: string, sharedStrings: string[], text: RegExp): number[] {
    const rows: number[] = [];
    for (const rowMatch of xml.matchAll(/<row\b[^>]*r="(\d+)"[^>]*>[\s\S]*?<\/row>/g)) {
        const rowXml = rowMatch[0];
        for (const cellMatch of rowXml.matchAll(/<c\b[^>]*?(?:t="s")?[^>]*>[\s\S]*?<v>(.*?)<\/v>[\s\S]*?<\/c>/g)) {
            const raw = cellMatch[1];
            const value = /t="s"/.test(cellMatch[0])
                ? sharedStrings[Number(raw)] ?? raw
                : raw;
            if (text.test(value)) {
                rows.push(Number(rowMatch[1]));
                break;
            }
        }
    }
    return rows;
}

function copyTemplateRowStyles(
    styles: Map<string, string>,
    templateRowStyles: Map<string, string>,
    templateRow: number,
    outputRow: number
) {
    for (const [key, styleId] of templateRowStyles) {
        const [sourceRow, col] = key.split(":");
        if (Number(sourceRow) !== templateRow) continue;
        styles.set(`${col}${outputRow}`, styleId);
    }
}

function copyTemplateRowAttributes(
    attrs: Map<number, string>,
    templateRowAttrs: Map<number, string>,
    templateRow: number,
    outputRow: number
) {
    const rowAttrs = templateRowAttrs.get(templateRow);
    if (rowAttrs) attrs.set(outputRow, rowAttrs);
}

function applyTimeSheetTotalRowStyles(
    styles: Map<string, string>,
    templateRowStyles: Map<string, string>,
    totalRow: number,
    isRdTemplate: boolean
) {
    const templateTotalRow = isRdTemplate ? 30 : 26;
    copyTemplateRowStyles(styles, templateRowStyles, templateTotalRow, totalRow);
}

function applyNormalTimeSheetFooterStyles(
    styles: Map<string, string>,
    templateRowStyles: Map<string, string>,
    totalRow: number,
    outputXml: string,
    outputSharedStrings: string[]
) {
    copyTemplateRowStyles(styles, templateRowStyles, 27, totalRow + 1);
    copyTemplateRowStyles(styles, templateRowStyles, 28, totalRow + 2);

    const termsStartRow =
        findRowsContainingText(outputXml, outputSharedStrings, /Normal Working Hours/i)
            .filter((row) => row > totalRow)
            .sort((a, b) => a - b)[0] ?? totalRow + 3;
    const commentsRow =
        findRowsContainingText(outputXml, outputSharedStrings, /^Comments$/i)
            .filter((row) => row > termsStartRow)
            .sort((a, b) => a - b)[0] ?? totalRow + 11;
    const confirmRow =
        findRowsContainingText(outputXml, outputSharedStrings, /We hereby confirm/i)
            .filter((row) => row > commentsRow)
            .sort((a, b) => a - b)[0] ?? commentsRow + 4;

    for (let offset = 0; offset <= 6; offset += 1) {
        copyTemplateRowStyles(
            styles,
            templateRowStyles,
            29 + offset,
            termsStartRow + offset
        );
    }

    copyTemplateRowStyles(styles, templateRowStyles, 36, commentsRow - 1);
    copyTemplateRowStyles(styles, templateRowStyles, 37, commentsRow);

    for (let row = commentsRow + 1; row < confirmRow; row += 1) {
        const templateRow = row === confirmRow - 1 ? 40 : 38;
        copyTemplateRowStyles(styles, templateRowStyles, templateRow, row);
    }

    copyTemplateRowStyles(styles, templateRowStyles, 41, confirmRow);
    copyTemplateRowStyles(styles, templateRowStyles, 42, confirmRow + 1);
    copyTemplateRowStyles(styles, templateRowStyles, 43, confirmRow + 2);
    copyTemplateRowStyles(styles, templateRowStyles, 44, confirmRow + 3);
    copyTemplateRowStyles(styles, templateRowStyles, 45, confirmRow + 4);
    copyTemplateRowStyles(styles, templateRowStyles, 46, confirmRow + 5);
    copyTemplateRowStyles(styles, templateRowStyles, 47, confirmRow + 6);
    copyTemplateRowStyles(styles, templateRowStyles, 48, confirmRow + 7);
}

function applyNormalTimeSheetFooterRowAttributes(
    attrs: Map<number, string>,
    templateRowAttrs: Map<number, string>,
    totalRow: number,
    outputXml: string,
    outputSharedStrings: string[]
) {
    copyTemplateRowAttributes(attrs, templateRowAttrs, 27, totalRow + 1);
    copyTemplateRowAttributes(attrs, templateRowAttrs, 28, totalRow + 2);

    const termsStartRow =
        findRowsContainingText(outputXml, outputSharedStrings, /Normal Working Hours/i)
            .filter((row) => row > totalRow)
            .sort((a, b) => a - b)[0] ?? totalRow + 3;
    const commentsRow =
        findRowsContainingText(outputXml, outputSharedStrings, /^Comments$/i)
            .filter((row) => row > termsStartRow)
            .sort((a, b) => a - b)[0] ?? totalRow + 11;
    const confirmRow =
        findRowsContainingText(outputXml, outputSharedStrings, /We hereby confirm/i)
            .filter((row) => row > commentsRow)
            .sort((a, b) => a - b)[0] ?? commentsRow + 4;

    for (let offset = 0; offset <= 6; offset += 1) {
        copyTemplateRowAttributes(
            attrs,
            templateRowAttrs,
            29 + offset,
            termsStartRow + offset
        );
    }

    copyTemplateRowAttributes(attrs, templateRowAttrs, 36, commentsRow - 1);
    copyTemplateRowAttributes(attrs, templateRowAttrs, 37, commentsRow);

    for (let row = commentsRow + 1; row < confirmRow; row += 1) {
        const templateRow = row === confirmRow - 1 ? 40 : 38;
        copyTemplateRowAttributes(attrs, templateRowAttrs, templateRow, row);
    }

    copyTemplateRowAttributes(attrs, templateRowAttrs, 41, confirmRow);
    copyTemplateRowAttributes(attrs, templateRowAttrs, 42, confirmRow + 1);
    copyTemplateRowAttributes(attrs, templateRowAttrs, 43, confirmRow + 2);
    copyTemplateRowAttributes(attrs, templateRowAttrs, 44, confirmRow + 3);
    copyTemplateRowAttributes(attrs, templateRowAttrs, 45, confirmRow + 4);
    copyTemplateRowAttributes(attrs, templateRowAttrs, 46, confirmRow + 5);
    copyTemplateRowAttributes(attrs, templateRowAttrs, 47, confirmRow + 6);
    copyTemplateRowAttributes(attrs, templateRowAttrs, 48, confirmRow + 7);
}

function applyRdTimeSheetFooterStyles(
    styles: Map<string, string>,
    templateRowStyles: Map<string, string>,
    totalRow: number,
    outputXml: string,
    outputSharedStrings: string[]
) {
    const termsStartRow =
        findRowsContainingText(outputXml, outputSharedStrings, /Normal Working Hours/i)
            .filter((row) => row > totalRow)
            .sort((a, b) => a - b)[0] ?? totalRow + 3;
    const commentsRow =
        findRowsContainingText(outputXml, outputSharedStrings, /^Comments$/i)
            .filter((row) => row > termsStartRow)
            .sort((a, b) => a - b)[0] ?? termsStartRow + 8;
    const confirmRow =
        findRowsContainingText(outputXml, outputSharedStrings, /We hereby confirm/i)
            .filter((row) => row > commentsRow)
            .sort((a, b) => a - b)[0] ?? commentsRow + 4;
    const signatureRow =
        findRowsContainingText(outputXml, outputSharedStrings, /Customer representative/i)
            .filter((row) => row > confirmRow)
            .sort((a, b) => a - b)[0] ?? confirmRow + 3;
    const emailRow =
        findRowsContainingText(outputXml, outputSharedStrings, /E-mail:/i)
            .filter((row) => row > signatureRow)
            .sort((a, b) => a - b)[0] ?? signatureRow + 3;

    for (let offset = 0; offset <= 5; offset += 1) {
        copyTemplateRowStyles(styles, templateRowStyles, 33 + offset, termsStartRow + offset);
    }

    for (let row = termsStartRow + 6; row < commentsRow; row += 1) {
        copyTemplateRowStyles(styles, templateRowStyles, row === commentsRow - 1 ? 40 : 39, row);
    }

    copyTemplateRowStyles(styles, templateRowStyles, 41, commentsRow);

    for (let row = commentsRow + 1; row < confirmRow; row += 1) {
        const templateRow = row === confirmRow - 1 ? 44 : 42;
        copyTemplateRowStyles(styles, templateRowStyles, templateRow, row);
    }

    copyTemplateRowStyles(styles, templateRowStyles, 45, confirmRow);

    copyTemplateRowStyles(styles, templateRowStyles, 46, signatureRow - 2);
    copyTemplateRowStyles(styles, templateRowStyles, 47, signatureRow - 1);
    copyTemplateRowStyles(styles, templateRowStyles, 48, signatureRow);
    copyTemplateRowStyles(styles, templateRowStyles, 49, signatureRow + 1);
    copyTemplateRowStyles(styles, templateRowStyles, 50, emailRow - 1);
    copyTemplateRowStyles(styles, templateRowStyles, 51, emailRow);
    copyTemplateRowStyles(styles, templateRowStyles, 52, emailRow + 1);
}

function extractTemplateCellStyles(
    xml: string,
    sheetName: string,
    outputXml?: string,
    outputSharedStrings: string[] = []
): Map<string, string> {
    const styles = new Map<string, string>();
    const normalizedSheetName = sheetName.trim();
    const timeSheetPatternRows = [14, 15, 16];
    const timeSheetPatterns = new Map<string, string>();
    const timeSheetFooterStyles = new Map<string, string>();

    for (const match of xml.matchAll(/<c\b[^>]*\br="([A-Z]+\d+)"[^>]*\bs="(\d+)"/g)) {
        const row = Number.parseInt(match[1].replace(/^[A-Z]+/, ""), 10);
        const col = match[1].replace(/\d+$/, "");
        if (normalizedSheetName === "Time Sheet" && row >= 14) {
            if (timeSheetPatternRows.includes(row)) {
                timeSheetPatterns.set(`${row}:${col}`, match[2]);
            }
            if (row >= 26 && row <= 60) {
                timeSheetFooterStyles.set(`${row}:${col}`, match[2]);
            }
            continue;
        }
        styles.set(match[1], match[2]);
    }

    if (normalizedSheetName === "Time Sheet" && outputXml) {
        const totalRow =
            findRowsContainingText(outputXml, outputSharedStrings, /^Total$/i)
                .filter((row) => row >= 14)
                .sort((a, b) => b - a)[0] ?? 1000;

        const isRdTemplate = timeSheetFooterStyles.has("48:A");
        applyTimeSheetTotalRowStyles(
            styles,
            timeSheetFooterStyles,
            totalRow,
            isRdTemplate
        );

        for (let row = 14; row < totalRow; row += 1) {
            const patternRow =
                row === 14
                    ? 14
                    : timeSheetPatternRows[((row - 15) % 2) + 1] ?? 15;
            for (const [key, styleId] of timeSheetPatterns) {
                const [sourceRow, col] = key.split(":");
                if (Number(sourceRow) !== patternRow) continue;
                styles.set(`${col}${row}`, styleId);
            }
        }

        if (isRdTemplate) {
            applyRdTimeSheetFooterStyles(
                styles,
                timeSheetFooterStyles,
                totalRow,
                outputXml,
                outputSharedStrings
            );
        } else {
            applyNormalTimeSheetFooterStyles(
                styles,
                timeSheetFooterStyles,
                totalRow,
                outputXml,
                outputSharedStrings
            );
        }
    }

    return styles;
}

async function buildTemplateStyleMaps(
    outputZip: JSZip,
    templateBuffer: ArrayBuffer | undefined
): Promise<{
    stylesXml?: string;
    signatureImage?: Uint8Array;
    logoImage?: Uint8Array;
    templateLogoAnchorByName: Map<string, string>;
    byOutputPath: Map<string, Map<string, string>>;
    layoutByOutputPath: Map<string, TemplateWorksheetLayout>;
}> {
    if (!templateBuffer) {
        return {
            byOutputPath: new Map(),
            layoutByOutputPath: new Map(),
            templateLogoAnchorByName: new Map(),
        };
    }

    const templateZip = await JSZip.loadAsync(templateBuffer);
    const stylesXml = await templateZip.file("xl/styles.xml")?.async("string");
    const signatureImage = await templateZip
        .file("xl/media/image2.png")
        ?.async("uint8array");
    const logoImage = await templateZip
        .file("xl/media/image1.png")
        ?.async("uint8array");
    const templateSheets = await readWorkbookSheetInfos(templateZip);
    const templateLogoAnchorByName = await loadTemplateLogoAnchorBySheetNames(
        templateZip,
        templateSheets
    );
    const outputSharedStrings = extractSharedStrings(
        await outputZip.file("xl/sharedStrings.xml")?.async("string")
    );
    const outputSheets = await readWorkbookSheetInfos(outputZip);
    const templateByName = new Map(
        templateSheets.map((sheet) => [sheet.name.trim(), sheet.path])
    );
    const byOutputPath = new Map<string, Map<string, string>>();
    const layoutByOutputPath = new Map<string, TemplateWorksheetLayout>();

    for (const outputSheet of outputSheets) {
        const templateName = getTemplateSheetName(outputSheet.name);
        const templatePath =
            templateByName.get(templateName) ??
            templateByName.get(`${templateName} `) ??
            templateByName.get(outputSheet.name.trim());
        const templateSheetFile = templatePath ? templateZip.file(templatePath) : null;
        if (!templateSheetFile) continue;
        const outputSheetFile = outputZip.file(outputSheet.path);
        if (!outputSheetFile) continue;

        const templateXml = await templateSheetFile.async("string");
        byOutputPath.set(
            outputSheet.path,
            extractTemplateCellStyles(
                templateXml,
                templateName,
                await outputSheetFile.async("string"),
                outputSharedStrings
            )
        );
        if (templateName === "Time Sheet") {
            layoutByOutputPath.set(
                outputSheet.path,
                buildTimeSheetTemplateLayout(
                    templateXml,
                    await outputSheetFile.async("string"),
                    outputSharedStrings
                )
            );
            continue;
        }

        if (templateName === "Invoice") {
            layoutByOutputPath.set(outputSheet.path, {
                topRowAttrs: extractTopRowAttributes(templateXml, 12),
                sheetViews: extractXmlFragment(templateXml, "sheetViews"),
                sheetPr: normalizeSheetPrFragment(
                    extractXmlFragment(templateXml, "sheetPr")
                ),
            });
        }
    }

    return { stylesXml, signatureImage, logoImage, templateLogoAnchorByName, byOutputPath, layoutByOutputPath };
}

const TEMPLATE_LOGO_SHEET_NAMES = new Set([
    "Invoice",
    "Job description",
    "Time Sheet",
]);

async function loadTemplateLogoAnchor(
    templateZip: JSZip,
    sheetPath: string
): Promise<string | null> {
    const sheetNumber = sheetPath.match(/sheet(\d+)\.xml$/)?.[1];
    if (!sheetNumber) return null;

    const sheetRelsPath = `xl/worksheets/_rels/sheet${sheetNumber}.xml.rels`;
    const sheetRels = await templateZip.file(sheetRelsPath)?.async("string");
    const drawingFile = sheetRels?.match(/Target="\.\.\/drawings\/([^"]+)"/)?.[1];
    if (!drawingFile) return null;

    const drawingXml = await templateZip
        .file(`xl/drawings/${drawingFile}`)
        ?.async("string");
    if (!drawingXml) return null;

    return extractLogoAnchorFromDrawing(drawingXml);
}

async function loadTemplateLogoAnchorBySheetNames(
    templateZip: JSZip,
    templateSheets: WorkbookSheetInfo[]
): Promise<Map<string, string>> {
    const anchors = new Map<string, string>();

    await Promise.all(
        templateSheets.map(async (sheet) => {
            const name = sheet.name.trim();
            if (!TEMPLATE_LOGO_SHEET_NAMES.has(name)) return;
            const anchor = await loadTemplateLogoAnchor(templateZip, sheet.path);
            if (anchor) anchors.set(name, anchor);
        })
    );

    return anchors;
}

function extractLogoAnchorFromDrawing(drawingXml: string): string | null {
    for (const match of drawingXml.matchAll(
        /<xdr:(oneCellAnchor|twoCellAnchor)\b[\s\S]*?<\/xdr:\1>/g
    )) {
        if (/r:embed="rId1"/.test(match[0])) {
            return match[0];
        }
    }

    const first = drawingXml.match(
        /<xdr:(oneCellAnchor|twoCellAnchor)\b[\s\S]*?<\/xdr:\1>/
    );
    return first?.[0] ?? null;
}

function buildCombinedDrawingXml(anchors: string[]): string {
    return [
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
        '<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">',
        ...anchors,
        "</xdr:wsDr>",
    ].join("");
}

function buildDrawingRelsXml(hasSignature: boolean): string {
    const relationships = [
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.png"/>',
    ];
    if (hasSignature) {
        relationships.push(
            '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image2.png"/>'
        );
    }

    return [
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
        ...relationships,
        "</Relationships>",
    ].join("");
}

function buildSignatureAnchorXml(anchorRow: number): string {
    const zeroBasedRow = Math.max(0, anchorRow - 1);
    return [
        "<xdr:oneCellAnchor>",
        `<xdr:from><xdr:col>7</xdr:col><xdr:colOff>809625</xdr:colOff><xdr:row>${zeroBasedRow}</xdr:row><xdr:rowOff>133350</xdr:rowOff></xdr:from>`,
        '<xdr:ext cx="3248025" cy="1285875"/>',
        '<xdr:pic><xdr:nvPicPr><xdr:cNvPr id="3" name="image2.png"/><xdr:cNvPicPr preferRelativeResize="0"/></xdr:nvPicPr>',
        '<xdr:blipFill><a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="rId2" cstate="print"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill>',
        '<xdr:spPr><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></xdr:spPr></xdr:pic>',
        '<xdr:clientData fLocksWithSheet="0"/>',
        "</xdr:oneCellAnchor>",
    ].join("");
}

function attachDrawingToWorksheet(xml: string): string {
    let next = xml
        .replace(/<drawing\b[^>]*\/>/g, "")
        .replace(/<drawing\b[^>]*>[\s\S]*?<\/drawing>/g, "");
    if (!/xmlns:r=/.test(next)) {
        next = next.replace(
            "<worksheet ",
            '<worksheet xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" '
        );
    }
    return next.replace(
        "</worksheet>",
        '<drawing r:id="rIdDrawing"/></worksheet>'
    );
}

function ensureWorksheetDrawingRels(
    existingRels: string | undefined,
    drawingIndex: number
): string {
    const drawingTarget = `../drawings/drawing${drawingIndex}.xml`;
    if (!existingRels) {
        return buildWorksheetRelsWithDrawing(drawingIndex);
    }

    if (/relationships\/drawing/.test(existingRels)) {
        return existingRels.replace(
            /Target="\.\.\/drawings\/drawing\d+\.xml"/,
            `Target="${drawingTarget}"`
        );
    }

    return existingRels.replace(
        "</Relationships>",
        `<Relationship Id="rIdDrawing" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="${drawingTarget}"/></Relationships>`
    );
}

async function restoreTemplateSheetDrawings(
    zip: JSZip,
    worksheetPaths: string[],
    options: {
        logoImage?: Uint8Array;
        signatureImage?: Uint8Array;
        templateLogoAnchorByName: Map<string, string>;
    }
) {
    if (!options.logoImage || options.templateLogoAnchorByName.size === 0) {
        return;
    }

    zip.file("xl/media/image1.png", options.logoImage);
    if (options.signatureImage) {
        zip.file("xl/media/image2.png", options.signatureImage);
    }

    const sheetInfos = await readWorkbookSheetInfos(zip);
    const sheetNameByPath = new Map(
        sheetInfos.map((sheet) => [sheet.path, sheet.name.trim()])
    );
    const sharedStrings = extractSharedStrings(
        await zip.file("xl/sharedStrings.xml")?.async("string")
    );

    let drawingIndex = 100;
    for (const worksheetPath of worksheetPaths) {
        const sheetName = sheetNameByPath.get(worksheetPath);
        if (!sheetName) continue;

        const templateName = getTemplateSheetName(sheetName);
        const logoAnchor = options.templateLogoAnchorByName.get(templateName);
        if (!logoAnchor) continue;

        const file = zip.file(worksheetPath);
        if (!file) continue;

        const xml = await file.async("string");
        const signatureRow = findRowsContainingText(
            xml,
            sharedStrings,
            /RTB representative/i
        )[0];

        const anchors = [logoAnchor];
        const hasSignature = Boolean(signatureRow && options.signatureImage);
        if (hasSignature) {
            anchors.push(buildSignatureAnchorXml(signatureRow! - 2));
        }

        drawingIndex += 1;
        const drawingPath = `xl/drawings/drawing${drawingIndex}.xml`;
        const drawingRelsPath = `xl/drawings/_rels/drawing${drawingIndex}.xml.rels`;
        const sheetNumber = worksheetPath.match(/sheet(\d+)\.xml$/)?.[1];
        if (!sheetNumber) continue;

        const worksheetRelsPath = `xl/worksheets/_rels/sheet${sheetNumber}.xml.rels`;
        const existingRels = await zip.file(worksheetRelsPath)?.async("string");

        zip.file(drawingPath, buildCombinedDrawingXml(anchors));
        zip.file(drawingRelsPath, buildDrawingRelsXml(hasSignature));
        zip.file(
            worksheetRelsPath,
            ensureWorksheetDrawingRels(existingRels, drawingIndex)
        );
        zip.file(worksheetPath, attachDrawingToWorksheet(xml));
        await ensureContentTypesForPngAndDrawing(zip, drawingPath);
    }
}

async function normalizeXlsxWorksheetDimensions(
    input: ArrayBuffer | Uint8Array,
    templateBuffer?: ArrayBuffer
): Promise<Blob> {
    const zip = await JSZip.loadAsync(input);
    const worksheetPaths = Object.keys(zip.files).filter((path) =>
        /^xl\/worksheets\/sheet\d+\.xml$/.test(path)
    );
    const templateStyles = await buildTemplateStyleMaps(zip, templateBuffer);

    await Promise.all(
        worksheetPaths.map(async (path) => {
            const file = zip.file(path);
            if (!file) return;

            const xml = await file.async("string");
            const dimensionRef = calculateWorksheetDimensionRef(xml);
            if (!dimensionRef) return;

            const nextXml = /<dimension\b[^>]*\/>/.test(xml)
                ? xml.replace(
                      /<dimension\b[^>]*\/>/,
                      `<dimension ref="${dimensionRef}"/>`
                  )
                : xml.replace(
                      /<sheetViews\b/,
                      `<dimension ref="${dimensionRef}"/><sheetViews`
                  );
            zip.file(path, nextXml);
        })
    );

    await stripXlsxStylesForExcelCompatibility(zip, worksheetPaths, templateStyles);

    return await zip.generateAsync({
        type: "blob",
        mimeType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
}

async function stripXlsxStylesForExcelCompatibility(
    zip: JSZip,
    worksheetPaths: string[],
    templateStyles: {
        stylesXml?: string;
        signatureImage?: Uint8Array;
        logoImage?: Uint8Array;
        templateLogoAnchorByName: Map<string, string>;
        byOutputPath: Map<string, Map<string, string>>;
        layoutByOutputPath: Map<string, TemplateWorksheetLayout>;
    }
): Promise<void> {
    for (const path of worksheetPaths) {
        const file = zip.file(path);
        if (!file) continue;
        const xml = await file.async("string");
        zip.file(
            path,
            buildMinimalWorksheetXml(
                xml
                    .replace(/\s+s="\d+"/g, "")
                    .replace(/\s+style="\d+"/g, "")
                    .replace(/\s+customFormat="1"/g, ""),
                templateStyles.byOutputPath.get(path),
                templateStyles.layoutByOutputPath.get(path)
            )
        );
    }

    zip.file("xl/styles.xml", templateStyles.stylesXml ?? minimalExcelStylesXml());
    await restoreTemplateSheetDrawings(zip, worksheetPaths, {
        logoImage: templateStyles.logoImage,
        signatureImage: templateStyles.signatureImage,
        templateLogoAnchorByName: templateStyles.templateLogoAnchorByName,
    });
}

async function ensureContentTypesForPngAndDrawing(zip: JSZip, drawingPath: string) {
    const contentTypesFile = zip.file("[Content_Types].xml");
    if (!contentTypesFile) return;

    let nextXml = await contentTypesFile.async("string");
    if (!/<Default\b[^>]*Extension="png"/.test(nextXml)) {
        nextXml = nextXml.replace(
            "</Types>",
            '<Default Extension="png" ContentType="image/png"/></Types>'
        );
    }
    const partName = `/${drawingPath}`;
    if (!nextXml.includes(`PartName="${partName}"`)) {
        nextXml = nextXml.replace(
            "</Types>",
            `<Override PartName="${partName}" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>`
        );
    }
    zip.file("[Content_Types].xml", nextXml);
}

function buildWorksheetRelsWithDrawing(drawingIndex: number): string {
    return [
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
        `<Relationship Id="rIdDrawing" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing${drawingIndex}.xml"/>`,
        "</Relationships>",
    ].join("");
}

function minimalExcelStylesXml(): string {
    return [
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
        '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
        '<fonts count="1"><font><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/><scheme val="minor"/></font></fonts>',
        '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>',
        '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>',
        '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>',
        '<cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>',
        '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>',
        '<dxfs count="0"/>',
        '<tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/>',
        "</styleSheet>",
    ].join("");
}

function spliceRowsWithLayoutRepair(
    ws: ExcelJS.Worksheet,
    insertAt: number,
    count: number
) {
    const mergeRefs = getWorksheetMergeRefs(ws);
    clearWorksheetMerges(ws);

    const emptyRows = Array.from({ length: count }, () =>
        new Array(32).fill(undefined)
    );
    ws.spliceRows(insertAt, 0, ...emptyRows);

    restoreMergesAfterRowInsert(ws, mergeRefs, insertAt, count);
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

    ws.eachRow((row) => {
        row.eachCell((cell) => {
            const bundle = readFormulaCellBundle(cell);
            if (bundle?.formula && !bundle.sharedFormula) {
                masters.set(cell.address, {
                    formula: bundle.formula,
                    result: bundle.result,
                });
            }
        });
    });

    ws.eachRow((row) => {
        row.eachCell((cell) => {
            const bundle = readFormulaCellBundle(cell);
            if (!bundle) return;

            if (bundle.sharedFormula) {
                const masterAddr = bundle.sharedFormula.replace(/\$/g, "");
                const master =
                    masters.get(masterAddr) ??
                    readFormulaCellBundle(ws.getCell(masterAddr));
                const translatedFormula =
                    typeof cell.formula === "string" && cell.formula.length > 0
                        ? cell.formula
                        : master?.formula;
                if (translatedFormula) {
                    setFormulaCellValue(
                        cell,
                        translatedFormula,
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

const materializedFormulaWorkbooks = new WeakSet<ExcelJS.Workbook>();

export function materializeSharedFormulasInWorkbook(workbook: ExcelJS.Workbook) {
    if (materializedFormulaWorkbooks.has(workbook)) return;
    for (const ws of workbook.worksheets) {
        materializeSharedFormulasInWorksheet(ws);
    }
    materializedFormulaWorkbooks.add(workbook);
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
    const mergeRanges = getWorksheetMergeRefs(ws)
        .map(parseMergeRef)
        .filter((range): range is MergeCellRange => Boolean(range));
    source.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        if (!isMergeMasterCellInRanges(mergeRanges, sourceRowNum, colNumber)) {
            return;
        }
        target.getCell(colNumber).style = { ...cell.style };
    });
}

const EXCEL_MEDIUM_BLACK_BORDER = {
    style: "medium",
    color: { argb: "FF000000" },
} as const;

function findMergeContainingCell(
    ws: ExcelJS.Worksheet,
    row: number,
    col: number
): MergeCellRange | null {
    for (const ref of getWorksheetMergeRefs(ws)) {
        const range = parseMergeRef(ref);
        if (!range) continue;
        if (
            range.top <= row &&
            row <= range.bottom &&
            range.left <= col &&
            col <= range.right
        ) {
            return range;
        }
    }
    return null;
}

function isMergeMasterCell(
    ws: ExcelJS.Worksheet,
    row: number,
    col: number
): boolean {
    const merge = findMergeContainingCell(ws, row, col);
    if (!merge) return true;
    return merge.top === row && merge.left === col;
}

function isMergeMasterCellInRanges(
    ranges: readonly MergeCellRange[],
    row: number,
    col: number
): boolean {
    const merge = ranges.find(
        (range) =>
            range.top <= row &&
            row <= range.bottom &&
            range.left <= col &&
            col <= range.right
    );
    if (!merge) return true;
    return merge.top === row && merge.left === col;
}

function applyCellBorderPatch(
    cell: ExcelJS.Cell,
    patch: Partial<NonNullable<ExcelJS.Style["border"]>>
) {
    cell.style = {
        ...cell.style,
        border: {
            ...cell.style?.border,
            ...patch,
        },
    };
}

function applyBorderToCellSafe(
    ws: ExcelJS.Worksheet,
    row: number,
    col: number,
    apply: (cell: ExcelJS.Cell) => void
) {
    const merge = findMergeContainingCell(ws, row, col);
    if (!merge) {
        apply(ws.getCell(row, col));
        return;
    }

    apply(ws.getCell(merge.top, merge.left));
}

function forceRdSummaryRowRightBorder(ws: ExcelJS.Worksheet, rowNumber: number) {
    void ws;
    void rowNumber;
}

function clearRdCommentInternalBottomBorders(
    ws: ExcelJS.Worksheet,
    commentsStartRow: number,
    actualCommentsLastRow: number
) {
    for (let row = commentsStartRow; row < actualCommentsLastRow; row += 1) {
        for (let col = 2; col <= 13; col += 1) {
            applyBorderToCellSafe(ws, row, col, (cell) => {
                const border = { ...(cell.style?.border ?? {}) };
                delete (border as { bottom?: unknown }).bottom;
                cell.style = {
                    ...cell.style,
                    border,
                };
            });
        }
    }
}

function forceRdSignatureRightBorder(
    ws: ExcelJS.Worksheet,
    startRow: number,
    endRow: number
) {
    for (let row = startRow; row <= endRow; row += 1) {
        applyBorderToCellSafe(ws, row, 13, (cell) => {
            applyCellBorderPatch(cell, { right: EXCEL_MEDIUM_BLACK_BORDER });
        });
    }
}

function findRdTotalRow(ws: ExcelJS.Worksheet, searchStartRow: number): number {
    const maxRow = Math.min(ws.rowCount, searchStartRow + 20);
    for (let row = searchStartRow; row <= maxRow; row += 1) {
        const value = ws.getCell(`E${row}`).value;
        if (typeof value === "string" && value.trim().toLowerCase() === "total") {
            return row;
        }
    }
    return searchStartRow;
}

function resetRdTotalFormulas(
    ws: ExcelJS.Worksheet,
    startRow: number,
    lastDataRow: number,
    totalRow: number
) {
    for (const col of ["F", "G", "H", "I", "J", "K", "L"] as const) {
        const cell = ws.getCell(`${col}${totalRow}`);
        cell.value = {
            formula: `SUM(${col}${startRow}:${col}${lastDataRow})`,
            result: cell.result,
        };
    }
}

function clearRdFooterRightBorder(
    ws: ExcelJS.Worksheet,
    startRow: number,
    endRow: number
) {
    for (let row = startRow; row <= endRow; row += 1) {
        for (let col = 2; col <= 13; col += 1) {
            applyBorderToCellSafe(ws, row, col, (cell) => {
                const border = { ...(cell.style?.border ?? {}) };
                delete (border as { right?: unknown }).right;
                cell.style = {
                    ...cell.style,
                    border,
                };
            });
        }
    }
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
    spliceRowsWithLayoutRepair(ws, insertAt, extraRowCount);

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
    // Keep export stable and fast. The uploaded template already contains
    // the intended borders; mutating merged-cell borders in ExcelJS can create
    // invalid workbook XML and is expensive on large invoices.
    void ws;
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
    for (let row = 6; row <= 9; row += 1) {
        applyBorderToCellSafe(ws, row, 10, (cell) => {
            applyCellBorderPatch(cell, {
                left: EXCEL_MEDIUM_BLACK_BORDER,
                right: EXCEL_MEDIUM_BLACK_BORDER,
                top:
                    row === 6
                        ? EXCEL_MEDIUM_BLACK_BORDER
                        : cell.style?.border?.top,
                bottom:
                    row === 9
                        ? EXCEL_MEDIUM_BLACK_BORDER
                        : cell.style?.border?.bottom,
            });
        });
    }
}

function forceM6ToM9RightBoldBorder(ws: ExcelJS.Worksheet) {
    for (let row = 6; row <= 9; row += 1) {
        applyBorderToCellSafe(ws, row, 13, (cell) => {
            applyCellBorderPatch(cell, { right: EXCEL_MEDIUM_BLACK_BORDER });
        });
    }
}

function forceNormalHeaderBottomBold(ws: ExcelJS.Worksheet) {
    for (const address of ["D12", "E12", "F11", "M11"] as const) {
        const cell = ws.getCell(address);
        applyBorderToCellSafe(
            ws,
            cell.fullAddress.row,
            cell.fullAddress.col,
            (targetCell) => {
                applyCellBorderPatch(targetCell, {
                    bottom: EXCEL_MEDIUM_BLACK_BORDER,
                });
            }
        );
    }
}

function forceRangeRightBorder(ws: ExcelJS.Worksheet, range: MergeCellRange) {
    applyCellBorderPatch(ws.getCell(range.top, range.left), {
        right: EXCEL_MEDIUM_BLACK_BORDER,
    });
}

function forceNormalSignatureRightBorders(
    ws: ExcelJS.Worksheet,
    searchStartRow: number
) {
    const applied = new Set<string>();
    const maxRow = Math.min(ws.rowCount, searchStartRow + 80);

    for (let row = searchStartRow; row <= maxRow && applied.size < 2; row += 1) {
        for (let col = 2; col <= 13 && applied.size < 2; col += 1) {
            const value = ws.getCell(row, col).value;
            if (
                typeof value !== "string" ||
                !value.toLowerCase().includes("representative")
            ) {
                continue;
            }

            const range = findMergeContainingCell(ws, row, col) ?? {
                top: row,
                bottom: row,
                left: col,
                right: col,
            };
            const key = formatMergeRef(range);
            if (applied.has(key)) continue;
            forceRangeRightBorder(ws, range);
            applied.add(key);
        }
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
            targetRow.getCell(colNumber).value = cell.value as ExcelJS.CellValue;
        });
    });

    const merges = (source.model as { merges?: string[] }).merges ?? [];
    for (const merge of merges) {
        target.mergeCells(merge);
    }
    const mergeRanges = merges
        .map(parseMergeRef)
        .filter((range): range is MergeCellRange => Boolean(range));

    source.eachRow({ includeEmpty: true }, (row, rowNumber) => {
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            if (!isMergeMasterCellInRanges(mergeRanges, rowNumber, colNumber)) {
                return;
            }
            target.getRow(rowNumber).getCell(colNumber).style = {
                ...cell.style,
            };
        });
    });

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
    rememberInvoiceExcelTemplate(workbook, templateBuffer);

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
    sections: InvoiceExcelNormalTimesheetSectionInput[],
    invoice?: InvoiceExcelInvoiceSheetInput,
    jobDescription?: InvoiceExcelJobDescriptionSheetInput
): Promise<ExcelJS.Workbook> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(templateBuffer);
    rememberInvoiceExcelTemplate(workbook, templateBuffer);
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
    setCellValue(
        baseSheet,
        NORMAL_TIMESHEET_EXCEL.travelHoursHeader,
        TIMESHEET_TRAVEL_HOURS_HEADER
    );
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
            comments.length + 1
        );
        comments.forEach((comment, idx) => {
            setCellValue(ws, `B${commentsStartRow + idx}`, ` * ${comment}`);
        });
        void commentsStartRow;
    }

    if (invoice) {
        const invoiceWs = resolveInvoiceWorksheet(workbook);
        if (invoiceWs) {
            fillInvoiceSheet(invoiceWs, invoice, "normal");
        }
    }

    if (jobDescription) {
        const jobDescriptionWs = resolveJobDescriptionWorksheet(workbook);
        if (jobDescriptionWs) {
            fillJobDescriptionSheet(jobDescriptionWs, jobDescription);
        }
    }

    materializeSharedFormulasInWorkbook(workbook);
    return workbook;
}

export async function fillRdTimesheetInvoiceExcelWorkbook(
    templateBuffer: ArrayBuffer,
    mappings: InvoiceExcelFieldMappings | null | undefined,
    data: InvoiceExcelRdInput,
    invoice?: InvoiceExcelInvoiceSheetInput,
    jobDescription?: InvoiceExcelJobDescriptionSheetInput
): Promise<ExcelJS.Workbook> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(templateBuffer);
    rememberInvoiceExcelTemplate(workbook, templateBuffer);
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
    setCellValue(
        ws,
        RD_TIMESHEET_EXCEL.travelHoursHeader,
        TIMESHEET_TRAVEL_HOURS_HEADER
    );
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

        safeMergeCells(ws, `G${descRow}:M${descRow}`);
        forceRdSummaryRowRightBorder(ws, descRow);
        const summary = row.summaryLine.trim();
        setCellValue(ws, `G${descRow}`, summary.length > 0 ? ` ${summary}` : "");

        currentRow += 2;
    }

    if (
        currentRow < commentsStartRow &&
        isRowEmptyBetweenColumns(ws, currentRow, 2, 12)
    ) {
        ws.getRow(currentRow).hidden = true;
        ws.getRow(currentRow).height = 0;
    }

    const rdLastDataRow = Math.max(startRow, currentRow - 2);
    const rdTotalRow = findRdTotalRow(ws, currentRow);
    resetRdTotalFormulas(ws, startRow, rdLastDataRow, rdTotalRow);

    ensureCommentRowCapacity(
        ws,
        commentsStartRow,
        commentsLastRow,
        data.comments.length
    );
    data.comments.forEach((comment, idx) => {
        setCellValue(ws, `B${commentsStartRow + idx}`, ` * ${comment}`);
    });

    const commentAreaRowCount = Math.max(
        commentsLastRow - commentsStartRow + 1,
        data.comments.length
    );
    const commentTextLastRow = commentsStartRow + commentAreaRowCount - 1;
    insertTimesheetRowsAfterTemplate(ws, commentTextLastRow, 1, [
        commentTextLastRow,
    ]);
    const commentsBoxLastRow = commentTextLastRow + 1;
    void commentsStartRow;
    const signatureRightBorderStartRow = commentsBoxLastRow + 1;
    const signatureRightBorderEndRow = commentsBoxLastRow + 6;
    void signatureRightBorderStartRow;
    void signatureRightBorderEndRow;

    if (invoice) {
        const invoiceWs = resolveInvoiceWorksheet(workbook);
        if (invoiceWs) {
            fillInvoiceSheet(invoiceWs, invoice, "rd");
        }
    }

    if (jobDescription) {
        const jobDescriptionWs = resolveJobDescriptionWorksheet(workbook);
        if (jobDescriptionWs) {
            fillJobDescriptionSheet(jobDescriptionWs, jobDescription);
        }
    }

    materializeSharedFormulasInWorkbook(workbook);
    return workbook;
}

export async function invoiceExcelWorkbookToBlob(
    workbook: ExcelJS.Workbook
): Promise<Blob> {
    materializeSharedFormulasInWorkbook(workbook);
    normalizeWorkbookMerges(workbook);
    stripWorksheetImages(workbook);
    const buf = await workbook.xlsx.writeBuffer();
    return await normalizeXlsxWorksheetDimensions(
        buf,
        invoiceExcelTemplateBuffers.get(workbook)
    );
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
