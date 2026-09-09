import ExcelJS from "exceljs";
import JSZip from "jszip";
import type { WorkLogFullData } from "./workLogApi";
import {
    aggregateWorkLogEntryDateRange,
    formatInvoiceExcelFilenamePeriod,
    formatInvoiceReportTableTitle,
    formatKoreanPeriod,
} from "../utils/invoiceReportDisplayTitle";
import {
    resolveOrderGroupExcelFilenameLabel,
    resolvePrimaryWorkLogOrderGroup,
} from "../utils/invoiceOrderGroupDisplay";
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
    /** Total Meals 열. 없으면 빈 칸 */
    totalMeals?: number;
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
    totalMeals?: number;
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
    /** Description 영역 `MAN POWER : …` 한 줄 (없으면 템플릿 문구만 공백 정리) */
    manPowerLine?: string;
    /** Description 영역에서 MAN POWER 바로 위 행에 넣을 PIC 문구 */
    picLine?: string;
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
    /** 2. Service material 헤더 (양식 기본값; 실제로는 텍스트로 탐색) */
    serviceMaterialHeader: 31,
    serviceMaterialDetail: 32,
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
    numberedNoteStartRow: 29,
    commentsStartRow: 38,
    /** 양식 코멘트 영역 마지막 행 (B38~B40) */
    commentsLastRow: 40,
    travelHoursHeader: "L12",
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
    numberedNoteStartRow: 33,
    commentsStartRow: 42,
    /** 양식 코멘트 영역 마지막 행 (B42~B44) */
    commentsLastRow: 44,
    travelHoursHeader: "L10",
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

/**
 * 인보이스 엑셀 다운로드 파일명
 * `{업체명}_{호선}_{출장목적}_{기간}_{R}.xlsx`
 * 예: Everllence_ELU_YZJ2023-1552_SOU-booster retrofit_22.Jul~24.Aug.2026_R.xlsx
 */
export function buildInvoiceExcelDownloadFilename(
    workLogDataList: WorkLogFullData[]
): string {
    if (workLogDataList.length === 0) {
        return "invoice_R.xlsx";
    }

    const orderGroup = resolvePrimaryWorkLogOrderGroup(
        workLogDataList.map((w) => w.workLog)
    );
    const company = resolveOrderGroupExcelFilenameLabel(orderGroup);
    const vessel = uniqJoin(
        workLogDataList.map((w) => w.workLog.vessel),
        "-"
    );
    const subject = uniqJoin(
        workLogDataList.map((w) => w.workLog.subject),
        "-"
    );
    const flatEntries = workLogDataList.flatMap((w) => w.entries);
    const { start, end } = aggregateWorkLogEntryDateRange(flatEntries);
    const period = formatInvoiceExcelFilenamePeriod(start, end);

    const parts = [company, vessel, subject, period, "R"].filter(
        (part) => part.length > 0
    );
    const safeBase = parts
        .join("_")
        .replace(/[\\/:*?"<>|]/g, "_")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 180);

    return `${safeBase.length > 0 ? safeBase : "invoice_R"}.xlsx`;
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
        total_meals: r.totalMeals,
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
    insertJobDescriptionPicRowAboveManPower(
        ws,
        input.picLine?.trim() || "Everllence PIC : Mr."
    );
    normalizeJobDescriptionManPowerLabel(ws, input.manPowerLine);
    ensureJobDescriptionLongTextOverflow(ws);
}

/** Job description 시트에서 MAN POWER 셀 위치 찾기 */
function findJobDescriptionManPowerCell(
    ws: ExcelJS.Worksheet
): { row: number; col: number } | null {
    let found: { row: number; col: number } | null = null;
    ws.eachRow((row, rowNumber) => {
        if (found) return;
        row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
            if (found) return;
            if (/MAN POWER/i.test(getWorksheetCellDisplayText(cell))) {
                found = { row: rowNumber, col: colNumber };
            }
        });
    });
    return found;
}

/**
 * PIC / MAN POWER / “carried out the following work” 긴 문구가
 * B열에 갇히지 않고 우측으로 넘치도록 정리한다.
 * (옆 칸 잔여값·wrapText 때문에 잘리는 문제 방지)
 */
function ensureJobDescriptionLongTextOverflow(ws: ExcelJS.Worksheet) {
    const targets: Array<{ row: number; col: number }> = [];

    ws.eachRow((row, rowNumber) => {
        row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
            const text = getWorksheetCellDisplayText(cell);
            if (
                /MAN POWER/i.test(text) ||
                /PIC\s*:/i.test(text) ||
                /carried out the following work/i.test(text)
            ) {
                targets.push({ row: rowNumber, col: colNumber });
            }
        });
    });

    for (const { row, col } of targets) {
        clearJobDescriptionRowCellsToRight(ws, row, col);
        const cell = ws.getCell(row, col);
        cell.alignment = {
            ...(cell.alignment ?? {}),
            wrapText: false,
            horizontal: "left",
            vertical: cell.alignment?.vertical ?? "center",
        };
    }
}

function clearJobDescriptionRowCellsToRight(
    ws: ExcelJS.Worksheet,
    row: number,
    startCol: number,
    endCol = 20
) {
    for (let col = startCol + 1; col <= endCol; col += 1) {
        const merge = findMergeContainingCell(ws, row, col);
        // 가로로 이어진 병합(같은 행)은 텍스트 표시용일 수 있어 유지.
        // 시작 열과 다른 병합·단독 셀 값만 비운다.
        if (merge && merge.top === merge.bottom && merge.left === startCol) {
            continue;
        }
        if (merge && (merge.left !== startCol || merge.top !== row)) {
            try {
                ws.unMergeCells(formatMergeRef(merge));
            } catch {
                // ignore
            }
        }
        const cell = ws.getCell(row, col);
        cell.value = null;
    }
}

/**
 * MAN POWER 행(보통 14) 위에 PIC 행을 삽입하고, MAN POWER 이하를 한 칸씩 내린다.
 * 이미 바로 위에 PIC 행이 있으면 문구만 갱신한다.
 */
function insertJobDescriptionPicRowAboveManPower(
    ws: ExcelJS.Worksheet,
    picLine: string
) {
    const manPower = findJobDescriptionManPowerCell(ws);
    if (!manPower) {
        return;
    }

    const colLetter = columnNumberToLetter(manPower.col);
    if (manPower.row > 1) {
        const aboveText = getWorksheetCellDisplayText(
            ws.getCell(manPower.row - 1, manPower.col)
        );
        if (/PIC\s*:/i.test(aboveText)) {
            setCellValue(ws, `${colLetter}${manPower.row - 1}`, picLine);
            return;
        }
    }

    const insertAt = manPower.row;
    spliceRowsWithLayoutRepair(ws, insertAt, 1);
    // 삽입 후: insertAt = 새 PIC 행, insertAt+1 = MAN POWER
    copyWorksheetRowStyle(ws, insertAt + 1, insertAt);
    // PIC 행에 wrap 이 켜지거나 옆 칸이 생기면 긴 문구가 잘리므로 비활성
    const picCell = ws.getCell(insertAt, manPower.col);
    picCell.alignment = {
        ...(picCell.alignment ?? {}),
        wrapText: false,
        horizontal: "left",
        vertical: picCell.alignment?.vertical ?? "center",
    };
    setCellValue(ws, `${colLetter}${insertAt}`, picLine);
    clearJobDescriptionRowCellsToRight(ws, insertAt, manPower.col);
}

/**
 * Job description Description 영역의 MAN POWER 줄 정리/치환.
 * - 템플릿 " MAN POWER" 앞 공백 제거
 * - manPowerLine 이 있으면 해당 셀 전체를 그 문구로 교체
 */
function normalizeJobDescriptionManPowerLabel(
    ws: ExcelJS.Worksheet,
    manPowerLine?: string
) {
    const stripLeadingSpace = (text: string) =>
        text.replace(/(^|\n) MAN POWER/g, "$1MAN POWER");
    const replaceManPowerLine = (text: string) => {
        const normalized = stripLeadingSpace(text);
        if (!manPowerLine?.trim()) {
            return normalized;
        }
        if (!/MAN POWER/i.test(normalized)) {
            return normalized;
        }
        return manPowerLine.trim();
    };

    const updateRichText = (
        rich: ExcelJS.CellRichTextValue
    ): ExcelJS.CellRichTextValue | null => {
        if (!manPowerLine?.trim()) {
            let changed = false;
            const nextRich = rich.richText.map((part, index) => {
                if (typeof part.text !== "string") {
                    return part;
                }
                const nextText =
                    index === 0
                        ? stripLeadingSpace(part.text)
                        : part.text.replace(/^ MAN POWER/, "MAN POWER");
                if (nextText !== part.text) {
                    changed = true;
                    return { ...part, text: nextText };
                }
                return part;
            });
            return changed ? { richText: nextRich } : null;
        }

        const joined = rich.richText
            .map((part) => (typeof part.text === "string" ? part.text : ""))
            .join("");
        if (!/MAN POWER/i.test(joined)) {
            return null;
        }
        const first = rich.richText[0];
        return {
            richText: [
                {
                    ...(first && typeof first === "object" ? first : {}),
                    text: manPowerLine.trim(),
                },
            ],
        };
    };

    ws.eachRow((row) => {
        row.eachCell({ includeEmpty: false }, (cell) => {
            const value = cell.value;
            if (typeof value === "string") {
                const next = replaceManPowerLine(value);
                if (next !== value) {
                    cell.value = next;
                }
                return;
            }
            if (
                value &&
                typeof value === "object" &&
                "richText" in value &&
                Array.isArray((value as ExcelJS.CellRichTextValue).richText)
            ) {
                const next = updateRichText(value as ExcelJS.CellRichTextValue);
                if (next) {
                    cell.value = next;
                }
            }
        });
    });
}

export function applyNormalJobDescriptionSheetBorderFormatting(
    ws: ExcelJS.Worksheet
) {
    applyNormalSheetInfoTableMiddleDividerBorder(ws);
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

    applyInvoiceSheetServiceMaterialLayout(ws);
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

/** Gloves → Cotton gloves (이미 Cotton gloves면 유지) */
function replaceGlovesWithCottonGloves(text: string): string {
    if (/Cotton\s+gloves/i.test(text)) return text;
    return text.replace(/\bGloves\b/g, "Cotton gloves");
}

/**
 * 2. Service material: 헤더 행의 G/H/I/J를 바로 아래 상세 행으로 내리고
 * 상세 설명의 Gloves를 Cotton gloves로 교체
 */
function applyInvoiceSheetServiceMaterialLayout(ws: ExcelJS.Worksheet) {
    const cols = INVOICE_SHEET_COLS;
    const rows = INVOICE_SHEET_MANPOWER_ROWS;
    const headerRow =
        findInvoiceSheetRowByDescriptionText(
            ws,
            /^\s*2\.\s*Service material/i,
            rows.fitterSpacer,
            rows.dailyAllowanceDetail
        ) ?? rows.serviceMaterialHeader;
    const detailRow = headerRow + 1;

    for (const col of INVOICE_SHEET_DATA_CLEAR_COLS) {
        const headerAddress = `${col}${headerRow}`;
        const detailAddress = `${col}${detailRow}`;
        const headerCell = ws.getCell(headerAddress);
        const headerValue = headerCell.value;
        if (
            headerValue === null ||
            headerValue === undefined ||
            headerValue === ""
        ) {
            continue;
        }

        if (
            col === cols.total &&
            typeof headerValue === "object" &&
            headerValue !== null &&
            ("formula" in headerValue || "sharedFormula" in headerValue)
        ) {
            const result =
                "result" in headerValue &&
                typeof (headerValue as ExcelJS.CellFormulaValue).result ===
                    "number"
                    ? (headerValue as ExcelJS.CellFormulaValue).result
                    : 0;
            setInvoiceSheetLineTotalFormula(
                ws,
                detailRow,
                typeof result === "number" ? result : 0
            );
        } else {
            ws.getCell(detailAddress).value = headerValue;
        }
        clearInvoiceSheetCellCompletely(ws, headerAddress);
    }

    for (const col of INVOICE_SHEET_DESCRIPTION_CLEAR_COLS) {
        const address = `${col}${detailRow}`;
        const cell = ws.getCell(address);
        const text = getWorksheetCellDisplayText(cell);
        if (!text) continue;
        const next = replaceGlovesWithCottonGloves(text);
        if (next !== text) {
            setCellValue(ws, address, next);
        }
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
        return;
    }

    insertInvoiceSheetGrandTotalGapRow(ws, detailRow);
}

function findInvoiceSheetGrandTotalRow(
    ws: ExcelJS.Worksheet,
    startRow: number,
    endRow: number
): number | undefined {
    for (const col of INVOICE_SHEET_CLEAR_COLS) {
        const row = findInvoiceSheetRowByColumnText(
            ws,
            col,
            /Grand\s*Total/i,
            startRow,
            endRow
        );
        if (row) return row;
    }
    return undefined;
}

/**
 * Normal 양식은 표 바로 아래에 Grand Total이 붙어 있어, 그 위에 빈 행 하나를 끼워
 * 넣는다(엑셀 "삽입"과 동일). 아래 내용이 한 칸씩 밀리므로 수식의 행 참조도 옮긴다.
 */
function insertInvoiceSheetGrandTotalGapRow(
    ws: ExcelJS.Worksheet,
    searchStart: number
) {
    const grandTotalRow = findInvoiceSheetGrandTotalRow(
        ws,
        searchStart,
        searchStart + 20
    );
    if (!grandTotalRow || grandTotalRow < 2) return;

    // 이미 표와 떨어져 있으면(빈 행 2개 이상) 그대로 둔다
    if (
        isInvoiceSheetSpacerRow(ws, grandTotalRow - 1) &&
        isInvoiceSheetSpacerRow(ws, grandTotalRow - 2)
    ) {
        return;
    }

    spliceRowsWithLayoutRepair(ws, grandTotalRow, 1);
    shiftWorksheetFormulaRowRefs(ws, grandTotalRow, 1);
}

/** 수식 문자열의 행 참조를 insertAt 이상만 count 만큼 내린다 (문자열 리터럴은 제외) */
function shiftFormulaRowRefs(
    formula: string,
    insertAt: number,
    count: number
): string {
    return formula.replace(
        /"[^"]*"|(^|[^A-Za-z0-9_$.!])(\$?)([A-Z]{1,3})(\$?)(\d+)(?![A-Za-z0-9_(])/g,
        (
            match: string,
            prefix: string | undefined,
            absCol: string,
            col: string,
            absRow: string,
            rowText: string
        ) => {
            if (prefix === undefined) return match;
            const row = Number.parseInt(rowText, 10);
            if (!Number.isFinite(row) || row < insertAt) return match;
            return `${prefix}${absCol}${col}${absRow}${row + count}`;
        }
    );
}

/**
 * 행 삽입 후 시트 전체 수식의 행 참조를 보정한다.
 * 병합 셀은 master/slave가 같은 수식을 공유하므로, 먼저 원본을 모아 두고
 * 한 번에 쓴다(같은 수식이 두 번 밀려 자기 참조가 되는 것을 방지).
 */
function shiftWorksheetFormulaRowRefs(
    ws: ExcelJS.Worksheet,
    insertAt: number,
    count: number
) {
    const updates: {
        address: string;
        formula: string;
        result?: ExcelJS.CellValue;
    }[] = [];

    ws.eachRow({ includeEmpty: false }, (row) => {
        row.eachCell({ includeEmpty: false }, (cell) => {
            const bundle = readFormulaCellBundle(cell);
            const formula = bundle?.formula;
            if (!formula) return;

            const shifted = shiftFormulaRowRefs(formula, insertAt, count);
            if (shifted === formula) return;

            updates.push({
                address: cell.address,
                formula: shifted,
                result: bundle?.result,
            });
        });
    });

    for (const update of updates) {
        setFormulaCellValue(
            ws.getCell(update.address),
            update.formula,
            update.result
        );
    }
}

/** 수식의 열 참조를 insertAtCol 이상만 count 만큼 오른쪽으로 민다 */
function shiftFormulaColRefs(
    formula: string,
    insertAtCol: number,
    count: number
): string {
    return formula.replace(
        /"[^"]*"|(^|[^A-Za-z0-9_$.!])(\$?)([A-Z]{1,3})(\$?)(\d+)(?![A-Za-z0-9_(])/g,
        (
            match: string,
            prefix: string | undefined,
            absCol: string,
            col: string,
            absRow: string,
            rowText: string
        ) => {
            if (prefix === undefined) return match;
            const colNum = columnLetterToNumber(col);
            if (!Number.isFinite(colNum) || colNum < insertAtCol) return match;
            return `${prefix}${absCol}${columnNumberToLetter(colNum + count)}${absRow}${rowText}`;
        }
    );
}

function shiftWorksheetFormulaColRefs(
    ws: ExcelJS.Worksheet,
    insertAtCol: number,
    count: number
) {
    const updates: {
        address: string;
        formula: string;
        result?: ExcelJS.CellValue;
    }[] = [];

    ws.eachRow({ includeEmpty: false }, (row) => {
        row.eachCell({ includeEmpty: false }, (cell) => {
            const bundle = readFormulaCellBundle(cell);
            const formula = bundle?.formula;
            if (!formula) return;

            const shifted = shiftFormulaColRefs(formula, insertAtCol, count);
            if (shifted === formula) return;

            updates.push({
                address: cell.address,
                formula: shifted,
                result: bundle?.result,
            });
        });
    });

    for (const update of updates) {
        setFormulaCellValue(
            ws.getCell(update.address),
            update.formula,
            update.result
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

function setBoldRichText(
    ws: ExcelJS.Worksheet,
    address: string,
    value: string,
    fontSize: number,
    fontName?: string
) {
    ws.getCell(address).value = {
        richText: [
            {
                font: {
                    bold: true,
                    size: fontSize,
                    ...(fontName ? { name: fontName } : {}),
                },
                text: sanitizeExcelCellString(value),
            },
        ],
    };
}

function numberFirstFourTimesheetNotes(
    ws: ExcelJS.Worksheet,
    startRow: number,
    boldThirdNoteFontName?: string
) {
    for (let index = 0; index < 4; index += 1) {
        const address = `B${startRow + index}`;
        const text = ws.getCell(address).text;
        const numberedText = text.replace(
            /^\s*\*\s*/,
            ` ${index + 1}. `
        );
        if (index === 2) {
            setBoldRichText(
                ws,
                address,
                numberedText,
                11,
                boldThirdNoteFontName
            );
        } else {
            setCellValue(ws, address, numberedText);
        }
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
    nativeCol?: number;
    row?: number;
    col?: number;
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

function shiftMergeRangeForColumnInsert(
    range: MergeCellRange,
    insertAtCol: number,
    count: number
): MergeCellRange {
    if (range.right < insertAtCol) {
        return range;
    }
    if (range.left >= insertAtCol) {
        return {
            ...range,
            left: range.left + count,
            right: range.right + count,
        };
    }
    return {
        ...range,
        right: range.right + count,
    };
}

function restoreMergesAfterColumnInsert(
    ws: ExcelJS.Worksheet,
    mergeRefs: string[],
    insertAtCol: number,
    count: number
) {
    const restored: MergeCellRange[] = [];
    for (const ref of mergeRefs) {
        const range = parseMergeRef(ref);
        if (!range) continue;
        const shifted = shiftMergeRangeForColumnInsert(range, insertAtCol, count);
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

function spliceColumnsWithLayoutRepair(
    ws: ExcelJS.Worksheet,
    insertAtCol: number,
    count: number
) {
    const mergeRefs = getWorksheetMergeRefs(ws);
    clearWorksheetMerges(ws);
    const emptyCols = Array.from({ length: count }, () => [] as unknown[]);
    ws.spliceColumns(insertAtCol, 0, ...emptyCols);
    restoreMergesAfterColumnInsert(ws, mergeRefs, insertAtCol, count);
}

function shiftImageAnchorAfterColumn(
    anchor: WorksheetImageAnchor | undefined,
    insertAtCol: number,
    count: number
) {
    if (!anchor) return;
    const zeroBasedInsertCol = insertAtCol - 1;
    if (typeof anchor.nativeCol === "number" && anchor.nativeCol >= zeroBasedInsertCol) {
        anchor.nativeCol += count;
    }
}

function shiftImagesAfterColumn(
    ws: ExcelJS.Worksheet,
    insertAtCol: number,
    count: number
) {
    const worksheetWithImages = ws as ExcelJS.Worksheet & {
        getImages?: () => WorksheetImageLike[];
    };
    const images = worksheetWithImages.getImages?.() ?? [];
    for (const image of images) {
        shiftImageAnchorAfterColumn(image.range?.tl, insertAtCol, count);
        shiftImageAnchorAfterColumn(image.range?.br, insertAtCol, count);
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

function injectMissingGrayBarCells(
    rows: Map<number, MinimalWorksheetCell[]>,
    templateStyles?: Map<string, string>
) {
    if (!templateStyles?.has("E4")) return;
    if (!templateStyles.has("B5") && !templateStyles.has("E5")) return;

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

/** 값이 없어도 서식(테두리)이 필요한 열의 빈 셀을 넣는다. Time Sheet G열(Total Meals)용 */
function injectMissingStyledColumnCells(
    rows: Map<number, MinimalWorksheetCell[]>,
    templateStyles: Map<string, string> | undefined,
    columnLetter: string
) {
    if (!templateStyles) return;
    for (const [ref, styleId] of templateStyles) {
        const refMatch = ref.match(/^([A-Z]+)(\d+)$/);
        if (!refMatch || refMatch[1] !== columnLetter) continue;

        const row = Number.parseInt(refMatch[2], 10);
        if (!Number.isFinite(row)) continue;

        const cells = rows.get(row) ?? [];
        if (cells.some((cell) => cell.ref === ref)) continue;

        cells.push({
            col: columnLetterToNumber(columnLetter),
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

    injectMissingGrayBarCells(rows, templateStyles);
    injectMissingStyledColumnCells(rows, templateStyles, "G");

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
    const cols = templateLayout?.cols || extractXmlFragment(xml, "cols");
    const mergeCells = extractXmlFragment(xml, "mergeCells");
    const printOptions =
        templateLayout?.printOptions || extractXmlFragment(xml, "printOptions");
    const pageMargins =
        templateLayout?.pageMargins || extractXmlFragment(xml, "pageMargins");
    const pageSetup =
        templateLayout?.pageSetup || extractXmlFragment(xml, "pageSetup");
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
        printOptions,
        pageMargins,
        pageSetup,
        drawing,
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
    cols?: string;
    printOptions?: string;
    pageMargins?: string;
    pageSetup?: string;
};

function extractTemplatePrintLayout(templateXml: string) {
    const pageSetup = extractXmlFragment(templateXml, "pageSetup");
    return {
        cols: extractXmlFragment(templateXml, "cols"),
        printOptions: extractXmlFragment(templateXml, "printOptions"),
        pageMargins: extractXmlFragment(templateXml, "pageMargins"),
        pageSetup: pageSetup.replace(/\s+r:id="[^"]*"/g, ""),
    };
}

function withTemplatePrintLayout(
    layout: TemplateWorksheetLayout,
    templateXml: string
): TemplateWorksheetLayout {
    return {
        ...layout,
        ...extractTemplatePrintLayout(templateXml),
    };
}

function hasTemplateCellStyle(xml: string, ref: string): boolean {
    return new RegExp(`<c\\b[^>]*\\br="${ref}"[^>]*\\bs="\\d+"`).test(xml);
}

/** Normal 양식 정보표 2·3행 사이 구분선 — row 8에 row 6 헤더와 동일한 top medium border 스타일 적용 */
function extractTemplateRowCellStylesByColumn(
    templateXml: string,
    row: number
): Map<string, string> {
    const stylesByColumn = new Map<string, string>();
    for (const match of templateXml.matchAll(
        new RegExp(`<c\\b[^>]*\\br="([A-Z]+)${row}"[^>]*\\bs="(\\d+)"`, "g")
    )) {
        stylesByColumn.set(match[1], match[2]);
    }
    return stylesByColumn;
}

function applyNormalInfoTableMiddleDividerCellStyles(
    styles: Map<string, string>,
    templateXml: string,
    sheetName: string
) {
    const normalizedSheetName = sheetName.trim();
    if (
        normalizedSheetName !== "Job description" &&
        normalizedSheetName !== "Time Sheet"
    ) {
        return;
    }
    if (
        normalizedSheetName === "Time Sheet" &&
        hasTemplateCellStyle(templateXml, "A48")
    ) {
        return;
    }

    const headerRowStyles = extractTemplateRowCellStylesByColumn(templateXml, 6);
    for (const [col, _styleId] of extractTemplateRowCellStylesByColumn(
        templateXml,
        8
    )) {
        const dividerStyle = headerRowStyles.get(col);
        if (dividerStyle) {
            styles.set(`${col}8`, dividerStyle);
        }
    }
}

function buildNormalInfoTableTemplateLayout(
    templateXml: string,
    maxRow = 13
): Map<number, string> {
    const topRowAttrs = new Map<number, string>();
    for (const [row, attrs] of extractTemplateRowAttributes(templateXml)) {
        if (row <= maxRow) {
            topRowAttrs.set(row, attrs);
        }
    }
    return topRowAttrs;
}

/** Job description 제목 아래 회색 막대 — Time Sheet row 4·5와 동일하게 적용 */
const JOB_DESCRIPTION_GRAY_BAR_ROWS = [4, 5] as const;

function applyJobDescriptionGrayBarFromTimeSheetTemplate(
    styles: Map<string, string>,
    timeSheetTemplateXml: string
) {
    for (const match of timeSheetTemplateXml.matchAll(
        /<c\b[^>]*\br="([A-Z]+)([45])"[^>]*\bs="(\d+)"/g
    )) {
        styles.set(`${match[1]}${match[2]}`, match[3]);
    }

    // Job description 템플릿에만 있는 row 4 셀(J4 등)은 Time Sheet와 맞추기 위해 제거
    for (const [ref] of [...styles]) {
        const refMatch = ref.match(/^([A-Z]+)4$/);
        if (!refMatch) continue;
        if (timeSheetTemplateXml.includes(`r="${ref}"`)) continue;
        styles.delete(ref);
    }
}

function applyJobDescriptionGrayBarRowAttributes(
    topRowAttrs: Map<number, string>,
    timeSheetTemplateXml: string
) {
    const timeSheetRowAttrs = extractTemplateRowAttributes(timeSheetTemplateXml);
    for (const row of JOB_DESCRIPTION_GRAY_BAR_ROWS) {
        const attrs = timeSheetRowAttrs.get(row);
        if (attrs) topRowAttrs.set(row, attrs);
    }
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
        findRowsContainingText(outputXml, outputSharedStrings, /^\s*\*Comments/i)
            .filter((row) => row > termsStartRow)
            .sort((a, b) => a - b)[0] ??
        findRowsContainingText(outputXml, outputSharedStrings, /^Comments$/i)
            .filter((row) => row > termsStartRow)
            .sort((a, b) => a - b)[0] ??
        totalRow + 11;
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
        findRowsContainingText(outputXml, outputSharedStrings, /^\s*\*Comments/i)
            .filter((row) => row > termsStartRow)
            .sort((a, b) => a - b)[0] ??
        findRowsContainingText(outputXml, outputSharedStrings, /^Comments$/i)
            .filter((row) => row > termsStartRow)
            .sort((a, b) => a - b)[0] ??
        totalRow + 11;
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
        findRowsContainingText(outputXml, outputSharedStrings, /^\s*\*Comments/i)
            .filter((row) => row > termsStartRow)
            .sort((a, b) => a - b)[0] ??
        findRowsContainingText(outputXml, outputSharedStrings, /^Comments$/i)
            .filter((row) => row > termsStartRow)
            .sort((a, b) => a - b)[0] ??
        termsStartRow + 8;
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

    // Total과 Notes 사이 여백(템플릿 31·32) — G열 굵은 하단선이 이어지도록 같은 행 F 서식을 둔다.
    copyTemplateRowStyles(styles, templateRowStyles, 31, termsStartRow - 2);
    copyTemplateRowStyles(styles, templateRowStyles, 32, termsStartRow - 1);

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
    outputSharedStrings: string[] = [],
    invoiceRowShift?: InvoiceSheetRowShift | null
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

    applyNormalInfoTableMiddleDividerCellStyles(
        styles,
        xml,
        normalizedSheetName
    );

    // Job description: PIC 행 삽입으로 내용이 +1행 밀린 경우,
    // 템플릿 셀 스타일 주소도 같이 밀어 'carried out…' 행에 빈 옆칸 스타일이
    // 붙으며 텍스트 넘침이 막히는 문제를 방지한다.
    if (normalizedSheetName === "Job description" && outputXml) {
        remapJobDescriptionStylesAfterPicInsert(
            styles,
            outputXml,
            outputSharedStrings
        );
    }

    // Invoice: 표와 Grand Total 사이에 빈 행을 끼워 넣으면 아래 내용이 밀리므로,
    // 템플릿 셀 스타일 주소도 같이 밀어야 서식이 어긋나지 않는다.
    if (normalizedSheetName === "Invoice" && invoiceRowShift) {
        shiftTemplateCellStylesFromRow(styles, invoiceRowShift);
    }

    if (normalizedSheetName === "Invoice") {
        normalizeInvoicePoNumberCellStyle(styles);
    }

    if (
        normalizedSheetName === "Time Sheet" &&
        outputXml &&
        timesheetOutputHasTotalMeals(outputXml, outputSharedStrings)
    ) {
        remapTimeSheetStylesAfterMealsColumnInsert(styles);
    }

    return styles;
}

function timesheetOutputHasTotalMeals(
    outputXml: string,
    outputSharedStrings: string[]
): boolean {
    return Boolean(
        firstRowContainingText(outputXml, outputSharedStrings, /Total\s*Meals/i)
    );
}

/**
 * 템플릿 G열 이후 스타일을 +1 밀고, 새 G열(Total Meals)은 F열(Total Hours) 서식을 복제한다.
 */
function remapTimeSheetStylesAfterMealsColumnInsert(
    styles: Map<string, string>
) {
    const insertAtCol = TIMESHEET_MEALS_COL;
    const remapped = new Map<string, string>();
    for (const [ref, styleId] of styles) {
        const match = ref.match(/^([A-Z]+)(\d+)$/);
        if (!match) {
            remapped.set(ref, styleId);
            continue;
        }
        const colNum = columnLetterToNumber(match[1]);
        const row = match[2];
        if (colNum >= insertAtCol) {
            remapped.set(`${columnNumberToLetter(colNum + 1)}${row}`, styleId);
            continue;
        }
        remapped.set(ref, styleId);
    }

    for (const [ref, styleId] of remapped) {
        const match = ref.match(/^F(\d+)$/);
        if (!match) continue;
        remapped.set(`G${match[1]}`, styleId);
    }

    styles.clear();
    for (const [ref, styleId] of remapped) {
        styles.set(ref, styleId);
    }
}

function getCellXfBorderSides(
    stylesXml: string,
    styleId: number
): { top?: string; bottom?: string; left?: string; right?: string } | null {
    const xfBlock = stylesXml.match(/<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/)?.[1];
    const borderBlock = stylesXml.match(/<borders\b[^>]*>([\s\S]*?)<\/borders>/)?.[1];
    if (!xfBlock || !borderBlock) return null;
    const xf = listXmlBlockItems(xfBlock, "xf")[styleId];
    if (!xf) return null;
    const borderId = Number.parseInt(xf.match(/\bborderId="(\d+)"/)?.[1] ?? "", 10);
    if (!Number.isFinite(borderId)) return null;
    const border = listXmlBlockItems(borderBlock, "border")[borderId];
    if (!border) return null;
    const side = (name: string) =>
        border.match(new RegExp(`<${name}[^>]*style="([^"]+)"`))?.[1];
    return {
        top: side("top"),
        bottom: side("bottom"),
        left: side("left"),
        right: side("right"),
    };
}

function findCellXfIdByBorder(
    stylesXml: string,
    need: { top?: string; bottom?: string | "none" }
): string | undefined {
    const xfBlock = stylesXml.match(/<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/)?.[1];
    if (!xfBlock) return undefined;
    const items = listXmlBlockItems(xfBlock, "xf");
    for (let i = 0; i < items.length; i += 1) {
        const sides = getCellXfBorderSides(stylesXml, i);
        if (!sides) continue;
        if (need.top && sides.top !== need.top) continue;
        if (need.bottom === "none" && sides.bottom) continue;
        if (need.bottom && need.bottom !== "none" && sides.bottom !== need.bottom) {
            continue;
        }
        return String(i);
    }
    return undefined;
}

/**
 * Total Meals(G) 열에서 표/노트/코멘트 구간의 굵은·일반 테두리를 맞춘다.
 */
function assignTimeSheetMealsColumnBorders(
    styles: Map<string, string>,
    stylesXml: string,
    outputXml: string,
    outputSharedStrings: string[]
) {
    const hoursRow = firstRowContainingText(
        outputXml,
        outputSharedStrings,
        /Total\s*Hours/i
    );
    const totalRow = firstRowContainingText(
        outputXml,
        outputSharedStrings,
        /^Total$/i
    );
    const note1Row = firstRowContainingText(
        outputXml,
        outputSharedStrings,
        /1\.\s*Normal Working Hours/i
    );
    const commentsRow =
        firstRowContainingText(
            outputXml,
            outputSharedStrings,
            /^\s*\*Comments/i
        ) ??
        firstRowContainingText(outputXml, outputSharedStrings, /^\s*Comments$/i);

    const mediumTop =
        (hoursRow ? styles.get(`F${hoursRow - 1}`) : undefined) ??
        styles.get("F10") ??
        findCellXfIdByBorder(stylesXml, { top: "medium" });
    // H11은 시간대 헤더라 굵은 선이다. 데이터 행(F14·F15)의 얇은 격자를 쓴다.
    const thinGrid =
        styles.get("F15") ??
        styles.get("F14") ??
        findCellXfIdByBorder(stylesXml, { top: "thin", bottom: "thin" }) ??
        findCellXfIdByBorder(stylesXml, { bottom: "thin" });
    // F27/F29는 템플릿 고정 행이다. 데이터 행이 늘어나면 그 칸이 표 격자가 되어
    // Notes·Comments의 G열에 좌우(·아래) 테두리가 따로 생긴다. 같은 출력 행 F만 쓴다.
    const mediumBottom = note1Row
        ? styles.get(`F${note1Row - 1}`)
        : undefined;
    const commentsStyle = commentsRow
        ? styles.get(`F${commentsRow}`)
        : undefined;

    const tableTopRow = hoursRow ? hoursRow - 1 : 10;
    if (mediumTop) styles.set(`G${tableTopRow}`, mediumTop);

    // Total 위 빈 행(G23·G24 등): F열과 같이 위·아래 얇은 선
    if (totalRow) {
        for (const row of [totalRow - 3, totalRow - 2, totalRow - 1]) {
            const fromF = styles.get(`F${row}`) ?? thinGrid;
            if (fromF) styles.set(`G${row}`, fromF);
        }
    }

    // 1번 노트 바로 위: F열과 같은 하단 굵은 선만 이어 준다.
    if (note1Row && mediumBottom) {
        styles.set(`G${note1Row - 1}`, mediumBottom);
    }

    // *Comments 행: F열과 동일한 서식. 없으면 G 셀을 만들지 않아 혼자 상자가 생기지 않게 한다.
    if (commentsRow) {
        if (commentsStyle) {
            styles.set(`G${commentsRow}`, commentsStyle);
        } else {
            styles.delete(`G${commentsRow}`);
        }
    }
}

/** 템플릿 cols XML에 G열(51px)을 끼우고 F열도 51px로 맞춘다. min/max >= 7 은 +1 */
function insertMealsColumnIntoColsXml(colsXml: string): string {
    if (!colsXml) return colsXml;

    const width = String(TIMESHEET_COL_WIDTH_51PX);
    const items = [
        ...colsXml.matchAll(/<col\b[^>]*\/?>/g),
    ].map((match) => match[0]);
    if (items.length === 0) return colsXml;

    const shifted: string[] = [];
    for (const item of items) {
        const min = Number.parseInt(item.match(/\bmin="(\d+)"/)?.[1] ?? "", 10);
        const max = Number.parseInt(item.match(/\bmax="(\d+)"/)?.[1] ?? "", 10);
        if (!Number.isFinite(min) || !Number.isFinite(max)) {
            shifted.push(item);
            continue;
        }

        if (max < TIMESHEET_MEALS_COL) {
            if (min === 6 && max === 6) {
                shifted.push(
                    item.replace(/\bwidth="[^"]+"/, `width="${width}"`)
                );
                continue;
            }
            shifted.push(item);
            continue;
        }

        if (min >= TIMESHEET_MEALS_COL) {
            shifted.push(
                item
                    .replace(/\bmin="\d+"/, `min="${min + 1}"`)
                    .replace(/\bmax="\d+"/, `max="${max + 1}"`)
            );
            continue;
        }

        // min < 7 <= max 인 범위는 쪼개지 않고 오른쪽만 늘림
        shifted.push(
            item.replace(/\bmax="\d+"/, `max="${max + 1}"`)
        );
    }

    const mealsCol = `<col min="7" max="7" width="${width}" customWidth="1"/>`;
    const fIndex = shifted.findIndex((item) => /\bmin="6"/.test(item));
    if (fIndex >= 0) {
        shifted.splice(fIndex + 1, 0, mealsCol);
    } else {
        shifted.push(mealsCol);
    }

    return colsXml.replace(
        /(<cols\b[^>]*>)[\s\S]*?(<\/cols>)/,
        `$1${shifted.join("")}$2`
    );
}

function excelColumnWidthDeltaFromPixels(extraPixels: number): number {
    return extraPixels / EXCEL_DEFAULT_COL_PIXELS_PER_WIDTH;
}

function roundExcelColumnWidth(width: number): number {
    return Math.round(width * 100) / 100;
}

function withColXmlWidth(item: string, width: number): string {
    if (/\bwidth="/.test(item)) {
        return item.replace(/\bwidth="[^"]+"/, `width="${width}"`);
    }
    return item.replace(/<col\b/, `<col width="${width}" customWidth="1"`);
}

/** cols XML에서 지정 열만 너비를 extraPixels만큼 늘린다. 범위 col이면 해당 열만 분리한다. */
function bumpColWidthInColsXml(
    colsXml: string,
    col: number,
    extraPixels: number
): string {
    if (!colsXml || extraPixels === 0) return colsXml;
    const delta = excelColumnWidthDeltaFromPixels(extraPixels);
    const items = [...colsXml.matchAll(/<col\b[^>]*\/?>/g)].map(
        (match) => match[0]
    );
    if (items.length === 0) return colsXml;

    const bumped: string[] = [];
    for (const item of items) {
        const min = Number.parseInt(item.match(/\bmin="(\d+)"/)?.[1] ?? "", 10);
        const max = Number.parseInt(item.match(/\bmax="(\d+)"/)?.[1] ?? "", 10);
        if (!Number.isFinite(min) || !Number.isFinite(max) || col < min || col > max) {
            bumped.push(item);
            continue;
        }

        const currentWidth = Number.parseFloat(
            item.match(/\bwidth="([^"]+)"/)?.[1] ?? ""
        );
        const nextWidth = Number.isFinite(currentWidth)
            ? roundExcelColumnWidth(currentWidth + delta)
            : undefined;
        const applyWidth = (xml: string) =>
            nextWidth === undefined ? xml : withColXmlWidth(xml, nextWidth);

        if (min === max) {
            bumped.push(applyWidth(item));
            continue;
        }

        if (min < col) {
            bumped.push(item.replace(/\bmax="\d+"/, `max="${col - 1}"`));
        }
        bumped.push(
            applyWidth(
                item
                    .replace(/\bmin="\d+"/, `min="${col}"`)
                    .replace(/\bmax="\d+"/, `max="${col}"`)
            )
        );
        if (col < max) {
            bumped.push(item.replace(/\bmin="\d+"/, `min="${col + 1}"`));
        }
    }

    return colsXml.replace(
        /(<cols\b[^>]*>)[\s\S]*?(<\/cols>)/,
        `$1${bumped.join("")}$2`
    );
}

function bumpNormalTimesheetColumnWidthsInColsXml(colsXml: string): string {
    return bumpColWidthInColsXml(
        bumpColWidthInColsXml(colsXml, 8, NORMAL_TIMESHEET_COL_H_EXTRA_PX),
        13,
        NORMAL_TIMESHEET_COL_M_EXTRA_PX
    );
}

function bumpExcelJsColumnWidth(
    ws: ExcelJS.Worksheet,
    col: number,
    extraPixels: number
) {
    const column = ws.getColumn(col);
    const current = column.width;
    if (typeof current !== "number" || !Number.isFinite(current)) return;
    column.width = roundExcelColumnWidth(
        current + excelColumnWidthDeltaFromPixels(extraPixels)
    );
}

function widenNormalTimesheetColumns(ws: ExcelJS.Worksheet) {
    bumpExcelJsColumnWidth(ws, 8, NORMAL_TIMESHEET_COL_H_EXTRA_PX);
    bumpExcelJsColumnWidth(ws, 13, NORMAL_TIMESHEET_COL_M_EXTRA_PX);
}

/**
 * P.O No 입력란(J7) 템플릿 서식이 라벨용(Roboto 9pt 파란 굵게)으로 잡혀 있어
 * Date/Validity/Currency(J9~J11)와 맞춰 Arial 14 입력란 스타일로 통일한다.
 */
function normalizeInvoicePoNumberCellStyle(styles: Map<string, string>) {
    const valueStyle =
        styles.get("J9") ?? styles.get("J10") ?? styles.get("J11") ?? styles.get("J8");
    if (!valueStyle) return;
    styles.set("J7", valueStyle);
}

/** Invoice 시트에 빈 행을 끼워 넣어 templateRow 이후가 shift 만큼 밀린 상태 */
type InvoiceSheetRowShift = {
    templateRow: number;
    shift: number;
};

/**
 * 텍스트가 들어 있는 행 번호들.
 * 빈 행(`<row .../>`)이 뒤 행 내용을 삼키지 않도록 행/셀을 정확히 끊어 읽는다.
 */
function findAllRowsContainingText(
    xml: string,
    sharedStrings: string[],
    text: RegExp
): number[] {
    const found = new Set<number>();

    for (const rowMatch of xml.matchAll(
        /<row\b([^>]*?)\/>|<row\b([^>]*?)>([\s\S]*?)<\/row>/g
    )) {
        const rowBody = rowMatch[3];
        if (!rowBody) continue;

        const rowNumber = Number.parseInt(
            (rowMatch[2] ?? "").match(/\br="(\d+)"/)?.[1] ?? "",
            10
        );
        if (!Number.isFinite(rowNumber)) continue;

        for (const cellMatch of rowBody.matchAll(
            /<c\b([^>]*?)\/>|<c\b([^>]*?)>([\s\S]*?)<\/c>/g
        )) {
            const cellBody = cellMatch[3];
            if (!cellBody) continue;

            const raw = cellBody.match(/<v>([\s\S]*?)<\/v>/)?.[1];
            if (raw === undefined) continue;

            const value = /t="s"/.test(cellMatch[2] ?? "")
                ? sharedStrings[Number(raw)] ?? raw
                : raw;
            if (text.test(value)) {
                found.add(rowNumber);
                break;
            }
        }
    }

    return [...found].sort((a, b) => a - b);
}

/**
 * 텍스트가 들어 있는 첫 행 번호.
 */
function firstRowContainingText(
    xml: string,
    sharedStrings: string[],
    text: RegExp
): number | undefined {
    return findAllRowsContainingText(xml, sharedStrings, text)[0];
}

function lastRowContainingText(
    xml: string,
    sharedStrings: string[],
    text: RegExp
): number | undefined {
    const rows = findAllRowsContainingText(xml, sharedStrings, text);
    return rows[rows.length - 1];
}

/** 출력의 Grand Total 행이 템플릿보다 아래면 그 차이를 반환 */
function resolveInvoiceSheetRowShift(
    templateXml: string,
    templateSharedStrings: string[],
    outputXml: string,
    outputSharedStrings: string[]
): InvoiceSheetRowShift | null {
    const grandTotal = /Grand\s*Total/i;
    const templateRow = firstRowContainingText(
        templateXml,
        templateSharedStrings,
        grandTotal
    );
    const outputRow = firstRowContainingText(
        outputXml,
        outputSharedStrings,
        grandTotal
    );
    if (!templateRow || !outputRow) return null;

    const shift = outputRow - templateRow;
    return shift > 0 ? { templateRow, shift } : null;
}

/**
 * templateRow 이후의 셀 스타일 주소를 shift 만큼 내린다.
 * 새로 생긴 빈 행에는 스타일이 남지 않아 테두리 없는 공백 행이 된다.
 */
function shiftTemplateCellStylesFromRow(
    styles: Map<string, string>,
    { templateRow, shift }: InvoiceSheetRowShift
) {
    const remapped = new Map<string, string>();
    for (const [ref, styleId] of styles) {
        const match = ref.match(/^([A-Z]+)(\d+)$/);
        if (!match) {
            remapped.set(ref, styleId);
            continue;
        }
        const row = Number.parseInt(match[2], 10);
        if (!Number.isFinite(row) || row < templateRow) {
            remapped.set(ref, styleId);
            continue;
        }
        remapped.set(`${match[1]}${row + shift}`, styleId);
    }

    styles.clear();
    for (const [ref, styleId] of remapped) {
        styles.set(ref, styleId);
    }
}

function listXmlBlockItems(blockXml: string, tagName: string): string[] {
    return [
        ...blockXml.matchAll(
            new RegExp(`<${tagName}\\b[^>]*/>|<${tagName}\\b[\\s\\S]*?</${tagName}>`, "g")
        ),
    ].map((match) => match[0]);
}

function replaceXmlBlockItems(
    stylesXml: string,
    blockTag: string,
    items: string[]
): string {
    const blockMatch = stylesXml.match(
        new RegExp(`(<${blockTag}\\b[^>]*>)([\\s\\S]*?)(</${blockTag}>)`)
    );
    if (!blockMatch) return stylesXml;

    const open = blockMatch[1].replace(
        /\bcount="\d+"/,
        `count="${items.length}"`
    );
    return stylesXml.replace(
        blockMatch[0],
        `${open}${items.join("")}${blockMatch[3]}`
    );
}

function getCellXfFontId(stylesXml: string, styleId: number): number | null {
    const block = stylesXml.match(/<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/)?.[1];
    if (!block) return null;
    const items = listXmlBlockItems(block, "xf");
    const xf = items[styleId];
    if (!xf) return null;
    const fontId = Number.parseInt(xf.match(/\bfontId="(\d+)"/)?.[1] ?? "", 10);
    return Number.isFinite(fontId) ? fontId : null;
}

/** sourceStyle 을 복제하고 fontId 만 바꿔 새 cellXf 를 추가한다. */
function appendClonedCellXfWithFont(
    stylesXml: string,
    sourceStyleId: number,
    fontId: number
): { stylesXml: string; styleId: number } {
    const block = stylesXml.match(/<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/)?.[1];
    if (!block) return { stylesXml, styleId: sourceStyleId };
    const items = listXmlBlockItems(block, "xf");
    const source = items[sourceStyleId];
    if (!source) return { stylesXml, styleId: sourceStyleId };

    const cloned = source.includes("fontId=")
        ? source.replace(/\bfontId="\d+"/, `fontId="${fontId}"`)
        : source.replace(/<xf\b/, `<xf fontId="${fontId}"`);
    items.push(cloned);

    return {
        stylesXml: replaceXmlBlockItems(stylesXml, "cellXfs", items),
        styleId: items.length - 1,
    };
}

function appendClonedFontWithSize(
    stylesXml: string,
    sourceFontId: number,
    size: number,
    options?: { keepUnderline?: boolean }
): { stylesXml: string; fontId: number } {
    const block = stylesXml.match(/<fonts\b[^>]*>([\s\S]*?)<\/fonts>/)?.[1];
    if (!block) return { stylesXml, fontId: sourceFontId };
    const fonts = listXmlBlockItems(block, "font");
    const source = fonts[sourceFontId];
    if (!source) return { stylesXml, fontId: sourceFontId };

    let cloned = /<sz\b/.test(source)
        ? source.replace(/<sz\b[^>]*\/?>/, `<sz val="${size}"/>`)
        : source.replace(/<font\b([^>]*)>/, `<font$1><sz val="${size}"/>`);
    if (!options?.keepUnderline) {
        cloned = cloned.replace(/<u\b[^>]*\/?>/g, "");
    }
    fonts.push(cloned);

    return {
        stylesXml: replaceXmlBlockItems(stylesXml, "fonts", fonts),
        fontId: fonts.length - 1,
    };
}

/**
 * Normal Invoice Grand Total:
 * - 윗줄(원화): 라벨·금액 모두 16
 * - 아랫줄(유로): 라벨·금액 모두 18
 * 템플릿은 라벨 16 / 금액 18 이라 행 삽입 후에도 좌우가 어긋나 있어 맞춘다.
 */
function alignNormalInvoiceGrandTotalFontSizes(
    stylesXml: string,
    styles: Map<string, string>,
    outputXml: string,
    outputSharedStrings: string[]
): string {
    const gtRows = findAllRowsContainingText(
        outputXml,
        outputSharedStrings,
        /Grand\s*Total/i
    );
    if (gtRows.length < 2) return stylesXml;

    const [krwRow, eurRow] = gtRows;
    const krwValueStyleId = Number.parseInt(
        styles.get(`I${krwRow}`) ?? styles.get(`J${krwRow}`) ?? "",
        10
    );
    const eurLabelStyleId = Number.parseInt(
        styles.get(`H${eurRow}`) ?? "",
        10
    );
    const eurValueStyleId = Number.parseInt(
        styles.get(`I${eurRow}`) ?? styles.get(`J${eurRow}`) ?? "",
        10
    );

    let nextXml = stylesXml;

    // 원화 금액: 폰트 복제 후 16 (EUR 금액과 font 공유여도 영향 없음), 밑줄 유지
    if (Number.isFinite(krwValueStyleId)) {
        const fontId = getCellXfFontId(nextXml, krwValueStyleId);
        if (fontId !== null) {
            const clonedFont = appendClonedFontWithSize(nextXml, fontId, 16, {
                keepUnderline: true,
            });
            nextXml = clonedFont.stylesXml;
            const clonedXf = appendClonedCellXfWithFont(
                nextXml,
                krwValueStyleId,
                clonedFont.fontId
            );
            nextXml = clonedXf.stylesXml;
            styles.set(`I${krwRow}`, String(clonedXf.styleId));
            styles.set(`J${krwRow}`, String(clonedXf.styleId));
        }
    }

    // 유로 라벨: 금액과 같은 18 크기, 밑줄 없는 폰트로 새 스타일
    if (Number.isFinite(eurLabelStyleId) && Number.isFinite(eurValueStyleId)) {
        const valueFontId = getCellXfFontId(nextXml, eurValueStyleId);
        if (valueFontId !== null) {
            const clonedFont = appendClonedFontWithSize(
                nextXml,
                valueFontId,
                18,
                { keepUnderline: false }
            );
            nextXml = clonedFont.stylesXml;
            const clonedXf = appendClonedCellXfWithFont(
                nextXml,
                eurLabelStyleId,
                clonedFont.fontId
            );
            nextXml = clonedXf.stylesXml;
            styles.set(`H${eurRow}`, String(clonedXf.styleId));
        }
    }

    return nextXml;
}

/**
 * 출력에 PIC 행이 있고 MAN POWER가 그 다음이면,
 * 템플릿 기준 insertAt 이상 행 스타일을 +1 이동하고 PIC 행에는 원래 MAN POWER 행 스타일을 쓴다.
 */
function remapJobDescriptionStylesAfterPicInsert(
    styles: Map<string, string>,
    outputXml: string,
    outputSharedStrings: string[]
) {
    const picRows = findRowsContainingText(
        outputXml,
        outputSharedStrings,
        /PIC\s*:/i
    );
    const manPowerRows = findRowsContainingText(
        outputXml,
        outputSharedStrings,
        /MAN POWER/i
    );
    const picRow = picRows.sort((a, b) => a - b)[0];
    const manPowerRow = manPowerRows.sort((a, b) => a - b)[0];
    if (!picRow || !manPowerRow || manPowerRow !== picRow + 1) {
        return;
    }

    const insertAt = picRow;
    const remapped = new Map<string, string>();
    for (const [ref, styleId] of styles) {
        const match = ref.match(/^([A-Z]+)(\d+)$/);
        if (!match) {
            remapped.set(ref, styleId);
            continue;
        }
        const col = match[1];
        const row = Number.parseInt(match[2], 10);
        if (!Number.isFinite(row)) {
            remapped.set(ref, styleId);
            continue;
        }
        if (row < insertAt) {
            remapped.set(`${col}${row}`, styleId);
            continue;
        }
        // 템플릿 row → 출력 row+1 (밀린 본문)
        remapped.set(`${col}${row + 1}`, styleId);
        // PIC 행은 템플릿 MAN POWER 행(insertAt) 스타일 재사용
        if (row === insertAt) {
            remapped.set(`${col}${insertAt}`, styleId);
        }
    }

    styles.clear();
    for (const [ref, styleId] of remapped) {
        styles.set(ref, styleId);
    }
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
    rowShiftBySheetName: Map<string, number>;
    colShiftBySheetName: Map<string, number>;
}> {
    if (!templateBuffer) {
        return {
            byOutputPath: new Map(),
            layoutByOutputPath: new Map(),
            templateLogoAnchorByName: new Map(),
            rowShiftBySheetName: new Map(),
            colShiftBySheetName: new Map(),
        };
    }

    const templateZip = await JSZip.loadAsync(templateBuffer);
    let stylesXml = await templateZip.file("xl/styles.xml")?.async("string");
    const signatureImage = await templateZip
        .file("xl/media/image2.png")
        ?.async("uint8array");
    const logoImage = await templateZip
        .file("xl/media/image1.png")
        ?.async("uint8array");
    const templateSheets = await readWorkbookSheetInfos(templateZip);
    const templateSharedStrings = extractSharedStrings(
        await templateZip.file("xl/sharedStrings.xml")?.async("string")
    );
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
    const rowShiftBySheetName = new Map<string, number>();
    const colShiftBySheetName = new Map<string, number>();

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
        const outputXml = await outputSheetFile.async("string");
        const invoiceRowShift =
            templateName === "Invoice"
                ? resolveInvoiceSheetRowShift(
                      templateXml,
                      templateSharedStrings,
                      outputXml,
                      outputSharedStrings
                  )
                : null;
        if (invoiceRowShift) {
            rowShiftBySheetName.set(
                outputSheet.name.trim(),
                invoiceRowShift.shift
            );
        }
        byOutputPath.set(
            outputSheet.path,
            extractTemplateCellStyles(
                templateXml,
                templateName,
                outputXml,
                outputSharedStrings,
                invoiceRowShift
            )
        );
        if (
            templateName === "Invoice" &&
            stylesXml &&
            byOutputPath.has(outputSheet.path)
        ) {
            stylesXml = alignNormalInvoiceGrandTotalFontSizes(
                stylesXml,
                byOutputPath.get(outputSheet.path)!,
                outputXml,
                outputSharedStrings
            );
        }
        if (templateName === "Time Sheet") {
            const layout = withTemplatePrintLayout(
                buildTimeSheetTemplateLayout(
                    templateXml,
                    outputXml,
                    outputSharedStrings
                ),
                templateXml
            );
            if (timesheetOutputHasTotalMeals(outputXml, outputSharedStrings)) {
                layout.cols = insertMealsColumnIntoColsXml(layout.cols ?? "");
                colShiftBySheetName.set(outputSheet.name.trim(), 1);
                const mealsStyles = byOutputPath.get(outputSheet.path);
                if (mealsStyles && stylesXml) {
                    assignTimeSheetMealsColumnBorders(
                        mealsStyles,
                        stylesXml,
                        outputXml,
                        outputSharedStrings
                    );
                }
            }
            if (!hasTemplateCellStyle(templateXml, "A48")) {
                layout.cols = bumpNormalTimesheetColumnWidthsInColsXml(
                    layout.cols ?? ""
                );
            }
            layoutByOutputPath.set(outputSheet.path, layout);
            continue;
        }

        if (templateName === "Job description") {
            const topRowAttrs = buildNormalInfoTableTemplateLayout(templateXml);
            layoutByOutputPath.set(
                outputSheet.path,
                withTemplatePrintLayout(
                    {
                        topRowAttrs,
                        sheetViews: extractXmlFragment(templateXml, "sheetViews"),
                        sheetPr: normalizeSheetPrFragment(
                            extractXmlFragment(templateXml, "sheetPr")
                        ),
                    },
                    templateXml
                )
            );
            continue;
        }

        if (templateName === "Invoice") {
            layoutByOutputPath.set(
                outputSheet.path,
                withTemplatePrintLayout(
                    {
                        topRowAttrs: extractTopRowAttributes(templateXml, 12),
                        sheetViews: extractXmlFragment(templateXml, "sheetViews"),
                        sheetPr: normalizeSheetPrFragment(
                            extractXmlFragment(templateXml, "sheetPr")
                        ),
                    },
                    templateXml
                )
            );
        }
    }

    const timeSheetTemplatePath = templateByName.get("Time Sheet");
    if (timeSheetTemplatePath) {
        const timeSheetTemplateXml = await templateZip
            .file(timeSheetTemplatePath)
            ?.async("string");
        if (timeSheetTemplateXml) {
            for (const outputSheet of outputSheets) {
                if (getTemplateSheetName(outputSheet.name) !== "Job description") {
                    continue;
                }
                const styles = byOutputPath.get(outputSheet.path);
                if (styles) {
                    applyJobDescriptionGrayBarFromTimeSheetTemplate(
                        styles,
                        timeSheetTemplateXml
                    );
                }
                const layout = layoutByOutputPath.get(outputSheet.path);
                if (layout) {
                    applyJobDescriptionGrayBarRowAttributes(
                        layout.topRowAttrs,
                        timeSheetTemplateXml
                    );
                }
            }
        }
    }

    return {
        stylesXml,
        signatureImage,
        logoImage,
        templateLogoAnchorByName,
        byOutputPath,
        layoutByOutputPath,
        rowShiftBySheetName,
        colShiftBySheetName,
    };
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
    await syncPrintAreasToCompanyAddressFooter(
        zip,
        templateStyles.rowShiftBySheetName,
        templateStyles.colShiftBySheetName
    );

    return await zip.generateAsync({
        type: "blob",
        mimeType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
}

/**
 * 회사 주소 행 + 여백 1행까지 인쇄 영역(페이지 나누기 미리보기 파란 테두리)을 맞춘다.
 * 예: 주소가 51행이면 Print_Area 끝은 52행.
 */
const PRINT_AREA_ROWS_BELOW_ADDRESS = 1;
const COMPANY_ADDRESS_ROW_PATTERN = /Jedoro\s*767-16/i;

function isInvoicePrintAreaSheet(sheetName: string): boolean {
    const name = sheetName.trim();
    return (
        name === "Invoice" ||
        name === "Job description" ||
        name.startsWith("Time Sheet")
    );
}

function excelDefinedNameSheetRef(sheetName: string): string {
    const escaped = sheetName.replace(/'/g, "''");
    return /[^A-Za-z0-9]/.test(sheetName) ? `'${escaped}'` : escaped;
}

function decodeXmlEntities(value: string): string {
    return value
        .replace(/&apos;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&");
}

function parsePrintAreaValue(value: string): {
    sheetRef: string;
    sheetName: string;
    absStartCol: string;
    startCol: string;
    absStartRow: string;
    startRow: string;
    absEndCol: string;
    endCol: string;
    absEndRow: string;
    endRow: string;
} | null {
    const areaMatch = value.trim().match(
        /^(.*?)!(\$?)([A-Z]+)(\$?)(\d+):(\$?)([A-Z]+)(\$?)(\d+)$/
    );
    if (!areaMatch) return null;
    return {
        sheetRef: areaMatch[1],
        sheetName: decodeXmlEntities(areaMatch[1]).replace(/'/g, "").trim(),
        absStartCol: areaMatch[2],
        startCol: areaMatch[3],
        absStartRow: areaMatch[4],
        startRow: areaMatch[5],
        absEndCol: areaMatch[6],
        endCol: areaMatch[7],
        absEndRow: areaMatch[8],
        endRow: areaMatch[9],
    };
}

function worksheetDimensionLastCol(xml: string): string | undefined {
    return xml.match(/<dimension\b[^>]*ref="[A-Z]+\d+:([A-Z]+)\d+"/)?.[1];
}

function buildPrintAreaValue(
    sheetName: string,
    startCol: string,
    startRow: string,
    endCol: string,
    endRow: number
): string {
    return `${excelDefinedNameSheetRef(sheetName)}!$${startCol}$${startRow}:$${endCol}$${endRow}`;
}

async function syncPrintAreasToCompanyAddressFooter(
    zip: JSZip,
    rowShiftBySheetName: Map<string, number>,
    colShiftBySheetName: Map<string, number> = new Map()
): Promise<void> {
    const workbookFile = zip.file("xl/workbook.xml");
    if (!workbookFile) return;

    const sheets = await readWorkbookSheetInfos(zip);
    const sharedStrings = extractSharedStrings(
        await zip.file("xl/sharedStrings.xml")?.async("string")
    );
    const xml = await workbookFile.async("string");

    const existingBySheet = new Map<
        string,
        NonNullable<ReturnType<typeof parsePrintAreaValue>>
    >();
    for (const match of xml.matchAll(
        /<definedName\b[^>]*name="_xlnm\.Print_Area"[^>]*>[\s\S]*?<\/definedName>/g
    )) {
        const value = match[0].replace(/<[^>]+>/g, "").trim();
        const parsed = parsePrintAreaValue(value);
        if (parsed) existingBySheet.set(parsed.sheetName, parsed);
    }

    const nextRangeBySheet = new Map<string, string>();
    for (const sheet of sheets) {
        const sheetName = sheet.name.trim();
        if (!isInvoicePrintAreaSheet(sheetName)) continue;

        const sheetXml = await zip.file(sheet.path)?.async("string");
        if (!sheetXml) continue;

        const addressRow = lastRowContainingText(
            sheetXml,
            sharedStrings,
            COMPANY_ADDRESS_ROW_PATTERN
        );
        const existing = existingBySheet.get(sheetName);
        const colShift = colShiftBySheetName.get(sheetName) ?? 0;
        const rowShift = rowShiftBySheetName.get(sheetName) ?? 0;

        let endRow: number | undefined;
        if (addressRow) {
            endRow = addressRow + PRINT_AREA_ROWS_BELOW_ADDRESS;
        } else if (existing && rowShift) {
            endRow = Number.parseInt(existing.endRow, 10) + rowShift;
        }
        if (!endRow || !Number.isFinite(endRow) || endRow < 1) continue;

        const startCol = existing?.startCol ?? "A";
        const startRow = existing?.startRow ?? "1";
        const existingEndColNum = existing
            ? columnLetterToNumber(existing.endCol) + colShift
            : undefined;
        const endCol =
            existingEndColNum && Number.isFinite(existingEndColNum)
                ? columnNumberToLetter(existingEndColNum)
                : worksheetDimensionLastCol(sheetXml) ?? existing?.endCol ?? "N";

        nextRangeBySheet.set(
            sheetName,
            buildPrintAreaValue(sheetName, startCol, startRow, endCol, endRow)
        );
    }

    if (nextRangeBySheet.size === 0) return;

    let nextXml = xml.replace(
        /(<definedName\b[^>]*name="_xlnm\.Print_Area"[^>]*>)([\s\S]*?)(<\/definedName>)/g,
        (match, open: string, value: string, close: string) => {
            const parsed = parsePrintAreaValue(value);
            if (!parsed) return match;
            const nextValue = nextRangeBySheet.get(parsed.sheetName);
            if (!nextValue) return match;
            nextRangeBySheet.delete(parsed.sheetName);
            return `${open}${nextValue}${close}`;
        }
    );

    const missing = [...nextRangeBySheet.entries()];
    if (missing.length > 0) {
        const newNames = missing
            .map(([sheetName, value]) => {
                const localSheetId = sheets.findIndex(
                    (sheet) => sheet.name.trim() === sheetName
                );
                if (localSheetId < 0) return "";
                return `<definedName name="_xlnm.Print_Area" localSheetId="${localSheetId}">${value}</definedName>`;
            })
            .filter(Boolean)
            .join("");

        if (/<definedNames\b[^>]*>/.test(nextXml)) {
            nextXml = nextXml.replace(
                /(<definedNames\b[^>]*>)/,
                `$1${newNames}`
            );
        } else {
            nextXml = nextXml.replace(
                /<\/sheets>/,
                `</sheets><definedNames>${newNames}</definedNames>`
            );
        }
    }

    if (nextXml !== xml) zip.file("xl/workbook.xml", nextXml);
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
        rowShiftBySheetName: Map<string, number>;
        colShiftBySheetName: Map<string, number>;
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
    for (const col of ["F", "G", "H", "I", "J", "K", "L", "M"] as const) {
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
    styleSourceRows: readonly number[],
    blankRowBeforeTotal = false
): number {
    const capacity = Math.max(0, lastDataRow - startRow + 1);
    if (totalRowsNeeded <= capacity) {
        return 0;
    }
    const extraDataRows = totalRowsNeeded - capacity;
    const extraRowCount = extraDataRows + (blankRowBeforeTotal ? 1 : 0);
    return insertTimesheetRowsAfterTemplate(
        ws,
        lastDataRow,
        extraRowCount,
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

/** Normal 인보이스 Time Sheet / Job description 정보표 2·3행 사이 구분선 */
function applyNormalSheetInfoTableMiddleDividerBorder(ws: ExcelJS.Worksheet) {
    for (let col = 2; col <= 14; col += 1) {
        if (!isMergeMasterCell(ws, 8, col)) continue;
        applyBorderToCellSafe(ws, 8, col, (cell) => {
            applyCellBorderPatch(cell, {
                top: EXCEL_MEDIUM_BLACK_BORDER,
            });
        });
    }
}

/** Normal 인보이스 Time Sheet 전용 — R&D 양식에는 적용하지 않음 */
function applyNormalTimesheetSheetBorderFormatting(ws: ExcelJS.Worksheet) {
    applyNormalSheetInfoTableMiddleDividerBorder(ws);
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

    // 일부 병합/스타일 케이스에서 정보표 중간 구분선 border가 사라지는 문제를 원본 기준으로 복원한다.
    for (const address of ["H8", "I8"] as const) {
        const sourceCell = source.getCell(address);
        const targetCell = target.getCell(address);
        if (sourceCell.style?.border) {
            targetCell.style = {
                ...targetCell.style,
                border: { ...sourceCell.style.border },
            };
        }
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

/** 엑셀 열 너비 6.57 ≈ 51픽셀 (Calibri 기본, 픽셀 ≈ 너비×7+5) */
const TIMESHEET_COL_WIDTH_51PX = 6.57;
const EXCEL_DEFAULT_COL_PIXELS_PER_WIDTH = 7;
const TIMESHEET_MEALS_COL = 7;
/** Normal 타임시트만: 출력 H열(8)·M열(13) 픽셀 증가 */
const NORMAL_TIMESHEET_COL_H_EXTRA_PX = 3;
const NORMAL_TIMESHEET_COL_M_EXTRA_PX = 2;

function timesheetSheetHasTotalMeals(ws: ExcelJS.Worksheet): boolean {
    const maxRow = Math.min(ws.rowCount || 20, 20);
    for (let row = 1; row <= maxRow; row += 1) {
        for (let col = 6; col <= 8; col += 1) {
            const text = getWorksheetCellDisplayText(ws.getCell(row, col));
            if (/Total\s*Meals/i.test(text)) return true;
        }
    }
    return false;
}

function findTimesheetHeaderRowByText(
    ws: ExcelJS.Worksheet,
    pattern: RegExp
): { row: number; col: number } | undefined {
    const maxRow = Math.min(ws.rowCount || 16, 16);
    for (let row = 8; row <= maxRow; row += 1) {
        for (let col = 2; col <= 16; col += 1) {
            const text = getWorksheetCellDisplayText(ws.getCell(row, col));
            if (pattern.test(text)) return { row, col };
        }
    }
    return undefined;
}

function findTimesheetTotalRow(ws: ExcelJS.Worksheet): number | undefined {
    const maxRow = Math.min(ws.rowCount || 80, 80);
    for (let row = 14; row <= maxRow; row += 1) {
        for (const col of [4, 5] as const) {
            const text = getWorksheetCellDisplayText(ws.getCell(row, col));
            if (text.trim().toLowerCase() === "total") return row;
        }
    }
    return undefined;
}

function copyTimesheetCellStyle(
    ws: ExcelJS.Worksheet,
    fromAddress: string,
    toAddress: string
) {
    const source = ws.getCell(fromAddress);
    const target = ws.getCell(toAddress);
    target.style = { ...source.style };
    if (source.font) target.font = { ...source.font };
    if (source.alignment) target.alignment = { ...source.alignment };
    if (source.border) target.border = { ...source.border };
    if (source.fill) target.fill = { ...source.fill };
    if (source.numFmt) target.numFmt = source.numFmt;
}

/**
 * Time Sheet F열(Total Hours)과 G열 사이에 Total Meals 열을 삽입한다.
 * 엑셀에서 G열 선택 후 '삽입'한 것과 같다. 이미 있으면 건너뛴다.
 */
function ensureTimesheetTotalMealsColumn(ws: ExcelJS.Worksheet) {
    if (timesheetSheetHasTotalMeals(ws)) return;

    const hoursHeader =
        findTimesheetHeaderRowByText(ws, /Total\s*Hours/i) ?? {
            row: 11,
            col: 6,
        };
    const hoursMerge = findMergeContainingCell(
        ws,
        hoursHeader.row,
        hoursHeader.col
    ) ?? {
        top: 11,
        bottom: 13,
        left: 6,
        right: 6,
    };

    spliceColumnsWithLayoutRepair(ws, TIMESHEET_MEALS_COL, 1);
    shiftWorksheetFormulaColRefs(ws, TIMESHEET_MEALS_COL, 1);
    shiftImagesAfterColumn(ws, TIMESHEET_MEALS_COL, 1);

    const headerTop = hoursMerge.top;
    const headerBottom = hoursMerge.bottom;
    safeMergeCells(ws, `G${headerTop}:G${headerBottom}`);
    copyTimesheetCellStyle(ws, `F${headerTop}`, `G${headerTop}`);

    const headerCell = ws.getCell(`G${headerTop}`);
    headerCell.value = "Total\nMeals";
    headerCell.alignment = {
        ...(headerCell.alignment ?? {}),
        wrapText: true,
        horizontal: "center",
        vertical: "center",
    };
    headerCell.font = {
        ...(headerCell.font ?? {}),
        bold: true,
    };

    ws.getColumn(6).width = TIMESHEET_COL_WIDTH_51PX;
    ws.getColumn(7).width = TIMESHEET_COL_WIDTH_51PX;

    const totalRow = findTimesheetTotalRow(ws);
    if (!totalRow) return;

    const dataStart = headerBottom + 1;
    const dataEnd = totalRow - 1;
    copyTimesheetCellStyle(ws, `F${totalRow}`, `G${totalRow}`);
    setFormulaCellValue(
        ws.getCell(`G${totalRow}`),
        `SUM(G${dataStart}:G${dataEnd})`
    );
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
    ensureTimesheetTotalMealsColumn(baseSheet);
    widenNormalTimesheetColumns(baseSheet);

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
            G: "total_meals",
            H: "weekday_normal",
            I: "weekday_after",
            J: "weekend_normal",
            K: "weekend_after",
            L: "travel_weekday",
            M: "travel_weekend",
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
        setCellValue(ws, "K7", withLeadingSpace(section.departureDisplay));
        setCellValue(ws, "K9", withLeadingSpace(section.returnDisplay));
        setCellValue(ws, "C12", resolveSectionYear(section.rows));
        applyNormalTimesheetSheetBorderFormatting(ws);

        const insertedRows = ensureTimesheetRowCapacity(
            ws,
            startRow,
            NORMAL_TIMESHEET_EXCEL.lastDataRow,
            rowRecords.length,
            [NORMAL_TIMESHEET_EXCEL.lastDataRow],
            true
        );
        const commentsStartRow =
            NORMAL_TIMESHEET_EXCEL.commentsStartRow + insertedRows;
        const commentsLastRow =
            NORMAL_TIMESHEET_EXCEL.commentsLastRow + insertedRows;
        numberFirstFourTimesheetNotes(
            ws,
            NORMAL_TIMESHEET_EXCEL.numberedNoteStartRow + insertedRows
        );
        setBoldRichText(
            ws,
            `B${commentsStartRow - 1}`,
            " *Comments",
            11
        );

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
            if (!Object.values(cols).includes("total_meals")) {
                setCellValue(
                    ws,
                    `G${lineNo}`,
                    excelNumericCell(Number(rec.total_meals ?? 0))
                );
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
            setBoldRichText(
                ws,
                `B${commentsStartRow + idx}`,
                ` ${comment}`,
                11
            );
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
            applyNormalJobDescriptionSheetBorderFormatting(jobDescriptionWs);
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
    ensureTimesheetTotalMealsColumn(ws);

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
    numberFirstFourTimesheetNotes(
        ws,
        RD_TIMESHEET_EXCEL.numberedNoteStartRow + insertedRows,
        "Arial"
    );
    setBoldRichText(
        ws,
        `B${commentsStartRow - 1}`,
        " *Comments",
        11,
        "Arial"
    );

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
        setCellValue(ws, `G${dataRow}`, excelNumericCell(row.totalMeals ?? 0));
        setCellValue(ws, `H${dataRow}`, excelNumericCell(row.weekdayNormal));
        setCellValue(ws, `I${dataRow}`, excelNumericCell(row.weekdayAfter));
        setCellValue(ws, `J${dataRow}`, excelNumericCell(row.weekendNormal));
        setCellValue(ws, `K${dataRow}`, excelNumericCell(row.weekendAfter));
        setCellValue(ws, `L${dataRow}`, excelNumericCell(row.travelWeekday));
        setCellValue(ws, `M${dataRow}`, excelNumericCell(row.travelWeekend));

        for (const col of ["B", "C", "D", "E", "F", "G"] as const) {
            safeMergeCells(ws, `${col}${dataRow}:${col}${descRow}`);
        }

        safeMergeCells(ws, `H${descRow}:N${descRow}`);
        forceRdSummaryRowRightBorder(ws, descRow);
        const summary = row.summaryLine.trim();
        setCellValue(ws, `H${descRow}`, summary.length > 0 ? ` ${summary}` : "");

        currentRow += 2;
    }

    if (
        currentRow < commentsStartRow &&
        isRowEmptyBetweenColumns(ws, currentRow, 2, 14)
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
        setBoldRichText(
            ws,
            `B${commentsStartRow + idx}`,
            ` ${comment}`,
            11,
            "Arial"
        );
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
