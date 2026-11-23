/** Shared schedule sheet table layout (create + list must stay identical). */

export type ScheduleSheetRow = {
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
    entryApplication: string;
    materialPrep: string;
};

/** Values written from the calendar insert form into the sheet. */
export type ScheduleInsertValues = Omit<ScheduleSheetRow, "id"> & {
    /** YYYY-MM-DD of the period start, used to order rows. */
    periodFrom: string;
};

/** Base sheet width used for “Remark까지” 기본 뷰. */
export const SCHEDULE_BASE_MIN_WIDTH = 1280;

/** Extra columns after Remark (출입신청 / 자재준비). 배지 폭에 맞춤. */
export const SCHEDULE_EXTRA_COL_WIDTH_PX = 102;

type ScheduleColumnDef = {
    key: string;
    label: string;
    /** Weight within the base sheet (sums to 100). Extra cols omit this. */
    baseWeight?: number;
    widthPx?: number;
    center: boolean;
    extra?: boolean;
};

const SCHEDULE_BASE_COLUMN_DEFS: ScheduleColumnDef[] = [
    { key: "no", label: "No.", baseWeight: 2, center: true },
    { key: "customerCompany", label: "Customer", baseWeight: 5.4, center: false },
    { key: "customerContact", label: "", baseWeight: 3.6, center: false },
    { key: "shipName", label: "Ship name", baseWeight: 5.5, center: false },
    { key: "engineType", label: "Engine type", baseWeight: 9, center: false },
    { key: "workLocation", label: "Work location", baseWeight: 5.5, center: false },
    { key: "period", label: "Period", baseWeight: 5, center: true },
    { key: "workItem", label: "Work Item", baseWeight: 24, center: false },
    { key: "manpower", label: "Man\nPower", baseWeight: 2.8, center: true },
    { key: "teamMember", label: "Team member", baseWeight: 14, center: false },
    { key: "car", label: "Car", baseWeight: 5, center: true },
    { key: "yardPic", label: "Yard\nPIC", baseWeight: 2.8, center: false },
    { key: "remark", label: "Remark", baseWeight: 15.4, center: false },
];

const SCHEDULE_EXTRA_COLUMN_DEFS: ScheduleColumnDef[] = [
    {
        key: "entryApplication",
        label: "출입신청",
        widthPx: SCHEDULE_EXTRA_COL_WIDTH_PX,
        center: false,
        extra: true,
    },
    {
        key: "materialPrep",
        label: "자재준비",
        widthPx: SCHEDULE_EXTRA_COL_WIDTH_PX,
        center: false,
        extra: true,
    },
];

export const SCHEDULE_EXTRA_COLUMNS_TOTAL_WIDTH = SCHEDULE_EXTRA_COLUMN_DEFS.reduce(
    (sum, col) => sum + (col.widthPx ?? 0),
    0
);

export const SCHEDULE_TABLE_MIN_WIDTH =
    SCHEDULE_BASE_MIN_WIDTH + SCHEDULE_EXTRA_COLUMNS_TOTAL_WIDTH;

export type ScheduleColumn = {
    key: string;
    label: string;
    width: string;
    center: boolean;
    extra?: boolean;
};

/** Resolve column pixel widths for a measured base (Remark까지) width. */
export function getScheduleColumns(
    baseWidth: number = SCHEDULE_BASE_MIN_WIDTH,
    options?: { includeExtra?: boolean }
): ScheduleColumn[] {
    const includeExtra = options?.includeExtra !== false;
    const safeBase = Math.max(SCHEDULE_BASE_MIN_WIDTH, baseWidth);
    const extraTotal = includeExtra ? SCHEDULE_EXTRA_COLUMNS_TOTAL_WIDTH : 0;
    const total = safeBase + extraTotal;

    const baseColumns = SCHEDULE_BASE_COLUMN_DEFS.map((col) => {
        const widthPx = ((col.baseWeight ?? 0) / 100) * safeBase;
        return {
            key: col.key,
            label: col.label,
            center: col.center,
            width: `${(widthPx / total) * 100}%`,
        };
    });

    if (!includeExtra) return baseColumns;

    return [
        ...baseColumns,
        ...SCHEDULE_EXTRA_COLUMN_DEFS.map((col) => ({
            key: col.key,
            label: col.label,
            center: col.center,
            extra: true as const,
            width: `${((col.widthPx ?? 0) / total) * 100}%`,
        })),
    ];
}

/** Static columns (min layout) — keep in sync across create/list */
export const SCHEDULE_COLUMNS = getScheduleColumns(SCHEDULE_BASE_MIN_WIDTH);

export const SCHEDULE_BASE_COLUMNS = SCHEDULE_COLUMNS.filter((col) => !col.extra);

export type ScheduleFieldKey =
    | "customerCompany"
    | "customerContact"
    | "shipName"
    | "engineType"
    | "workLocation"
    | "period"
    | "workItem"
    | "manpower"
    | "teamMember"
    | "car"
    | "yardPic"
    | "remark"
    | "entryApplication"
    | "materialPrep";

export const SCHEDULE_EDITABLE_FIELDS: ScheduleFieldKey[] = [
    "customerCompany",
    "customerContact",
    "shipName",
    "engineType",
    "workLocation",
    "period",
    "workItem",
    "manpower",
    "teamMember",
    "car",
    "yardPic",
    "remark",
    "entryApplication",
    "materialPrep",
];

export const SCHEDULE_EXTRA_FIELD_KEYS: ScheduleFieldKey[] = [
    "entryApplication",
    "materialPrep",
];

export const SCHEDULE_TITLE_BG = "#A8D0F0";
export const SCHEDULE_LABEL_BG = "#E2E8F0";
export const SCHEDULE_CELL_BORDER = "border border-gray-800";

/** SF(팀장) — Team member 정렬 시 직급·입사일보다 우선 */
export const SCHEDULE_TEAM_LEADERS = ["안재훈", "온권태", "정상민", "이효익"] as const;

/** Visual cell merge across contiguous rows for one field (rowspan). */
export type ScheduleFieldMerge = {
    field: ScheduleFieldKey;
    rowIds: string[];
};

/** Persisted merge range using 1-based positions within a saved version. */
export type ScheduleStoredCellMerge = {
    field: ScheduleFieldKey;
    start: number;
    end: number;
};

export function formatScheduleVersionKey(
    scheduleDate: string,
    versionLabel: string
): string {
    return `${scheduleDate}${versionLabel}`;
}

export function isBlankScheduleSheetRow(
    row: Pick<ScheduleSheetRow, ScheduleFieldKey>
): boolean {
    return SCHEDULE_EDITABLE_FIELDS.every((key) => row[key].trim() === "");
}

function orderRowIdsByRows(
    rowIds: string[],
    rows: Array<Pick<ScheduleSheetRow, "id">>
): string[] {
    return [...rowIds]
        .map((id) => ({ id, index: rows.findIndex((row) => row.id === id) }))
        .filter((item) => item.index >= 0)
        .sort((a, b) => a.index - b.index)
        .map((item) => item.id);
}

export function areScheduleIndicesContiguous(indices: number[]): boolean {
    if (indices.length < 2) return false;
    for (let i = 1; i < indices.length; i++) {
        if (indices[i] !== indices[i - 1]! + 1) return false;
    }
    return true;
}

export function pruneScheduleFieldMerges(
    merges: ScheduleFieldMerge[],
    rows: Array<Pick<ScheduleSheetRow, "id" | ScheduleFieldKey>>
): ScheduleFieldMerge[] {
    const next: ScheduleFieldMerge[] = [];
    for (const merge of merges) {
        const ordered = orderRowIdsByRows(merge.rowIds, rows);
        if (ordered.length < 2) continue;
        const indices = ordered.map((id) => rows.findIndex((row) => row.id === id));
        if (!areScheduleIndicesContiguous(indices)) continue;
        const firstValue = rows[indices[0]!]![merge.field];
        if (
            !ordered.every(
                (id) => rows.find((row) => row.id === id)?.[merge.field] === firstValue
            )
        ) {
            continue;
        }
        next.push({ field: merge.field, rowIds: ordered });
    }
    return next;
}

export function buildScheduleMergeLookup(
    merges: ScheduleFieldMerge[],
    rows: Array<Pick<ScheduleSheetRow, "id" | ScheduleFieldKey>>
): Map<string, { rowspan: number } | "skip"> {
    const map = new Map<string, { rowspan: number } | "skip">();
    for (const merge of pruneScheduleFieldMerges(merges, rows)) {
        merge.rowIds.forEach((id, i) => {
            const key = `${id}__${merge.field}`;
            if (i === 0) map.set(key, { rowspan: merge.rowIds.length });
            else map.set(key, "skip");
        });
    }
    return map;
}

export function toStoredScheduleCellMerges(
    merges: ScheduleFieldMerge[],
    rows: Array<Pick<ScheduleSheetRow, "id" | ScheduleFieldKey>>
): ScheduleStoredCellMerge[] {
    const savedRows = rows.filter((row) => !isBlankScheduleSheetRow(row));
    const idToPos = new Map(savedRows.map((row, index) => [row.id, index + 1]));
    const stored: ScheduleStoredCellMerge[] = [];

    for (const merge of pruneScheduleFieldMerges(merges, rows)) {
        const positions = merge.rowIds
            .map((id) => idToPos.get(id))
            .filter((pos): pos is number => pos != null)
            .sort((a, b) => a - b);
        if (positions.length < 2) continue;
        if (!areScheduleIndicesContiguous(positions.map((pos) => pos - 1))) continue;
        stored.push({
            field: merge.field,
            start: positions[0]!,
            end: positions[positions.length - 1]!,
        });
    }

    return stored;
}

const MERGEABLE_FIELD_SET = new Set<string>(SCHEDULE_EDITABLE_FIELDS);

export function fromStoredScheduleCellMerges(
    stored: ScheduleStoredCellMerge[] | null | undefined,
    rows: Array<Pick<ScheduleSheetRow, "id">>
): ScheduleFieldMerge[] {
    if (!stored || stored.length === 0) return [];
    const merges: ScheduleFieldMerge[] = [];

    for (const item of stored) {
        if (!MERGEABLE_FIELD_SET.has(item.field)) continue;
        if (
            !Number.isInteger(item.start) ||
            !Number.isInteger(item.end) ||
            item.start < 1 ||
            item.end < item.start ||
            item.end > rows.length
        ) {
            continue;
        }
        const rowIds = rows.slice(item.start - 1, item.end).map((row) => row.id);
        if (rowIds.length < 2) continue;
        merges.push({ field: item.field, rowIds });
    }

    return merges;
}
