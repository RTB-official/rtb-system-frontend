import { supabase } from "./supabase";

/** Local calendar date as YYYY-MM-DD (not UTC). */
export function getLocalScheduleDate(date: Date = new Date()): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

/** Next unused label among A–Z for the day (A if none, B if A exists, …). */
export function nextScheduleVersionLabel(existingLabels: string[]): string {
    const used = new Set(
        existingLabels.map((label) => label.trim().toUpperCase()).filter(Boolean)
    );
    for (let i = 0; i < 26; i += 1) {
        const label = String.fromCharCode(65 + i);
        if (!used.has(label)) return label;
    }
    throw new Error("그날의 일정 버전 라벨(A–Z)이 모두 사용되었습니다.");
}

export type NextScheduleVersion = {
    scheduleDate: string;
    versionLabel: string;
    /** e.g. 2026-09-22A */
    versionKey: string;
};

export async function fetchNextScheduleVersion(
    scheduleDate: string = getLocalScheduleDate()
): Promise<NextScheduleVersion> {
    const { data, error } = await supabase
        .from("schedule_versions")
        .select("version_label")
        .eq("schedule_date", scheduleDate);

    if (error) throw error;

    const versionLabel = nextScheduleVersionLabel(
        (data ?? []).map((row) => row.version_label as string)
    );

    return {
        scheduleDate,
        versionLabel,
        versionKey: `${scheduleDate}${versionLabel}`,
    };
}

export type ScheduleRowInput = {
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

export type SaveScheduleVersionResult = {
    versionId: string;
    scheduleDate: string;
    versionLabel: string;
    versionKey: string;
    rowCount: number;
};

function isBlankScheduleRow(row: ScheduleRowInput): boolean {
    return (
        !row.customerCompany.trim() &&
        !row.customerContact.trim() &&
        !row.shipName.trim() &&
        !row.engineType.trim() &&
        !row.workLocation.trim() &&
        !row.period.trim() &&
        !row.workItem.trim() &&
        !row.manpower.trim() &&
        !row.teamMember.trim() &&
        !row.car.trim() &&
        !row.yardPic.trim() &&
        !row.remark.trim()
    );
}

/**
 * Saves the sheet. Version label is resolved on the server at save time
 * (not the stale UI label), so concurrent deletes/repacks still land on the next slot.
 */
export async function saveScheduleVersion(params: {
    scheduleDate?: string;
    rows: ScheduleRowInput[];
    sourceFilename?: string | null;
}): Promise<SaveScheduleVersionResult> {
    const scheduleDate = params.scheduleDate ?? getLocalScheduleDate();
    const payload = params.rows
        .filter((row) => !isBlankScheduleRow(row))
        .map((row) => ({
            customer_company: row.customerCompany,
            customer_contact: row.customerContact,
            ship_name: row.shipName,
            engine_type: row.engineType,
            work_location: row.workLocation,
            period: row.period,
            work_item: row.workItem,
            manpower: row.manpower,
            team_member: row.teamMember,
            car: row.car,
            yard_pic: row.yardPic,
            remark: row.remark,
        }));

    if (payload.length === 0) {
        throw new Error("저장할 일정 행이 없습니다.");
    }

    const { data, error } = await supabase.rpc("save_schedule_version", {
        p_schedule_date: scheduleDate,
        p_rows: payload,
        p_source_filename: params.sourceFilename ?? null,
    });

    if (error) throw error;

    const raw = data as {
        version_id: string;
        schedule_date: string;
        version_label: string;
        version_key: string;
        row_count: number;
    };

    return {
        versionId: raw.version_id,
        scheduleDate: String(raw.schedule_date),
        versionLabel: raw.version_label,
        versionKey: raw.version_key,
        rowCount: raw.row_count,
    };
}

export type DeleteScheduleVersionResult = {
    scheduleDate: string;
    deletedVersionId: string;
    remainingLabels: string[];
};

/** Deletes a version and renumbers remaining labels for that date to A, B, C… */
export async function deleteScheduleVersionAndRepack(
    versionId: string
): Promise<DeleteScheduleVersionResult> {
    const { data, error } = await supabase.rpc("delete_schedule_version_and_repack", {
        p_version_id: versionId,
    });

    if (error) throw error;

    const raw = data as {
        schedule_date: string;
        deleted_version_id: string;
        remaining_labels: string[];
    };

    return {
        scheduleDate: String(raw.schedule_date),
        deletedVersionId: raw.deleted_version_id,
        remainingLabels: raw.remaining_labels ?? [],
    };
}

export type ScheduleVersionSheet = {
    id: string;
    scheduleDate: string;
    versionLabel: string;
    versionKey: string;
    createdAt: string;
    rows: Array<ScheduleRowInput & { id: string }>;
};

type DbScheduleRow = {
    id: string;
    customer_company: string;
    customer_contact: string;
    ship_name: string;
    engine_type: string;
    work_location: string;
    period: string;
    work_item: string;
    manpower: string;
    team_member: string;
    car: string;
    yard_pic: string;
    remark: string;
};

function mapDbRow(row: DbScheduleRow): ScheduleRowInput & { id: string } {
    return {
        id: row.id,
        customerCompany: row.customer_company ?? "",
        customerContact: row.customer_contact ?? "",
        shipName: row.ship_name ?? "",
        engineType: row.engine_type ?? "",
        workLocation: row.work_location ?? "",
        period: row.period ?? "",
        workItem: row.work_item ?? "",
        manpower: row.manpower ?? "",
        teamMember: row.team_member ?? "",
        car: row.car ?? "",
        yardPic: row.yard_pic ?? "",
        remark: row.remark ?? "",
    };
}

type DbScheduleVersion = {
    id: string;
    schedule_date: string;
    version_label: string;
    created_at: string;
    schedule_version_rows?: Array<{
        position: number;
        schedule_rows: DbScheduleRow | DbScheduleRow[] | null;
    }> | null;
};

function mapVersionSheet(version: DbScheduleVersion): ScheduleVersionSheet {
    const scheduleDate = String(version.schedule_date);
    const versionLabel = String(version.version_label);
    const memberships = (version.schedule_version_rows ?? [])
        .slice()
        .sort((a, b) => a.position - b.position);

    const rows = memberships
        .map((m) => {
            const raw = m.schedule_rows;
            const row = Array.isArray(raw) ? raw[0] : raw;
            if (!row) return null;
            return mapDbRow(row);
        })
        .filter((row): row is ScheduleRowInput & { id: string } => row != null);

    return {
        id: version.id,
        scheduleDate,
        versionLabel,
        versionKey: `${scheduleDate}${versionLabel}`,
        createdAt: String(version.created_at),
        rows,
    };
}

const VERSION_SELECT = `
    id,
    schedule_date,
    version_label,
    created_at,
    schedule_version_rows (
        position,
        schedule_rows (
            id,
            customer_company,
            customer_contact,
            ship_name,
            engine_type,
            work_location,
            period,
            work_item,
            manpower,
            team_member,
            car,
            yard_pic,
            remark
        )
    )
`;

/** Distinct schedule_date values, newest first. Optional inclusive date range filter. */
export async function fetchScheduleDistinctDates(options?: {
    dateFrom?: string;
    dateTo?: string;
}): Promise<string[]> {
    let query = supabase
        .from("schedule_versions")
        .select("schedule_date")
        .order("schedule_date", { ascending: false });

    if (options?.dateFrom) {
        query = query.gte("schedule_date", options.dateFrom);
    }
    if (options?.dateTo) {
        query = query.lte("schedule_date", options.dateTo);
    }

    const { data, error } = await query;
    if (error) throw error;

    const seen = new Set<string>();
    const dates: string[] = [];
    for (const row of data ?? []) {
        const d = String(row.schedule_date);
        if (seen.has(d)) continue;
        seen.add(d);
        dates.push(d);
    }
    return dates;
}

/** Sheets for the given schedule_date list (newest → oldest within those dates). */
export async function fetchScheduleVersionSheetsByDates(
    dates: string[]
): Promise<ScheduleVersionSheet[]> {
    if (dates.length === 0) return [];

    const { data, error } = await supabase
        .from("schedule_versions")
        .select(VERSION_SELECT)
        .in("schedule_date", dates)
        .order("schedule_date", { ascending: false })
        .order("version_label", { ascending: false })
        .order("created_at", { ascending: false })
        .order("position", {
            referencedTable: "schedule_version_rows",
            ascending: true,
        });

    if (error) throw error;

    return ((data ?? []) as DbScheduleVersion[]).map(mapVersionSheet);
}

/**
 * All saved sheets, newest → oldest (latest on top).
 * Prefer date-paginated helpers for the list page.
 */
export async function fetchScheduleVersionSheets(): Promise<ScheduleVersionSheet[]> {
    const dates = await fetchScheduleDistinctDates();
    return fetchScheduleVersionSheetsByDates(dates);
}

