import ExcelJS from "exceljs";

export type ParsedScheduleRow = {
    id: string;
    customerCompany: string;
    customerContact: string;
    shipName: string;
    engineType: string;
    workLocation: string;
    period: string;
    workItem: string;
    manpower: string;
    teamMember: string;
    car: string;
    yardPic: string;
    remark: string;
};

const START_ROW = 5;
/** A5:M… — A=No(무시), B~M=웹 표 데이터 12컬럼 */
const COL = {
    no: 1, // A
    customerCompany: 2, // B
    customerContact: 3, // C
    shipName: 4, // D
    engineType: 5, // E
    workLocation: 6, // F
    period: 7, // G
    workItem: 8, // H
    manpower: 9, // I
    teamMember: 10, // J
    car: 11, // K
    yardPic: 12, // L
    remark: 13, // M
} as const;

function cellToText(cell: ExcelJS.Cell): string {
    const value = cell.value;
    if (value === null || value === undefined) return "";
    if (value instanceof Date) {
        const m = value.getMonth() + 1;
        const d = value.getDate();
        return `${m}/${d}`;
    }
    if (typeof value === "object") {
        if (
            "richText" in value &&
            Array.isArray((value as ExcelJS.CellRichTextValue).richText)
        ) {
            return (value as ExcelJS.CellRichTextValue).richText
                .map((part) => part.text ?? "")
                .join("");
        }
        if ("text" in value && typeof (value as { text?: string }).text === "string") {
            return (value as { text: string }).text;
        }
        if ("result" in value) {
            const result = (value as ExcelJS.CellFormulaValue).result;
            if (result instanceof Date) {
                const m = result.getMonth() + 1;
                const d = result.getDate();
                return `${m}/${d}`;
            }
            return String(result ?? "");
        }
    }
    return String(value);
}

function createRowId(rowNumber: number) {
    return `row-${rowNumber}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeUppercaseField(value: string): string {
    return value.toUpperCase();
}

function isBlankRow(ws: ExcelJS.Worksheet, rowNumber: number): boolean {
    for (let col = COL.no; col <= COL.remark; col += 1) {
        if (cellToText(ws.getCell(rowNumber, col)).trim()) return false;
    }
    return true;
}

/**
 * 일정 엑셀에서 A5:M… 데이터 행을 읽어 ScheduleRow[]로 변환.
 * A=No(무시), B~M=Customer(회사/담당)·Ship·…·Remark
 */
export async function parseScheduleExcelFile(file: File): Promise<ParsedScheduleRow[]> {
    const buffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
        throw new Error("엑셀 시트를 찾을 수 없습니다.");
    }

    const rows: ParsedScheduleRow[] = [];
    let emptyStreak = 0;

    for (let rowNumber = START_ROW; rowNumber <= worksheet.rowCount + 50; rowNumber += 1) {
        if (isBlankRow(worksheet, rowNumber)) {
            emptyStreak += 1;
            if (emptyStreak >= 3) break;
            continue;
        }
        emptyStreak = 0;

        rows.push({
            id: createRowId(rowNumber),
            customerCompany: cellToText(worksheet.getCell(rowNumber, COL.customerCompany)).trim(),
            customerContact: cellToText(worksheet.getCell(rowNumber, COL.customerContact)).trim(),
            shipName: normalizeUppercaseField(
                cellToText(worksheet.getCell(rowNumber, COL.shipName)).trim()
            ),
            engineType: normalizeUppercaseField(
                cellToText(worksheet.getCell(rowNumber, COL.engineType)).trim()
            ),
            workLocation: cellToText(worksheet.getCell(rowNumber, COL.workLocation)).trim(),
            period: cellToText(worksheet.getCell(rowNumber, COL.period)).trim(),
            workItem: cellToText(worksheet.getCell(rowNumber, COL.workItem)).trim(),
            manpower: cellToText(worksheet.getCell(rowNumber, COL.manpower)).trim(),
            teamMember: cellToText(worksheet.getCell(rowNumber, COL.teamMember)).trim(),
            car: cellToText(worksheet.getCell(rowNumber, COL.car)).trim(),
            yardPic: cellToText(worksheet.getCell(rowNumber, COL.yardPic)).trim(),
            remark: cellToText(worksheet.getCell(rowNumber, COL.remark)).trim(),
        });
    }

    if (rows.length === 0) {
        throw new Error("불러올 일정 데이터가 없습니다. (A5:M 영역을 확인해 주세요)");
    }

    return rows;
}
