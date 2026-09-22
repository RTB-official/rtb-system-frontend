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
};

/** Column widths (sum 100%) — keep in sync across create/list */
export const SCHEDULE_COLUMNS = [
    { key: "no", label: "No.", width: "2.5%", center: true },
    { key: "customerCompany", label: "Customer", width: "4.5%", center: false },
    { key: "customerContact", label: "", width: "4.5%", center: false },
    { key: "shipName", label: "Ship name", width: "6.5%", center: false },
    { key: "engineType", label: "Engine type", width: "9%", center: false },
    { key: "workLocation", label: "Work location", width: "5.5%", center: false },
    { key: "period", label: "Period", width: "4.5%", center: true },
    { key: "workItem", label: "Work Item", width: "24%", center: false },
    { key: "manpower", label: "Man\nPower", width: "2.8%", center: true },
    { key: "teamMember", label: "Team member", width: "14%", center: false },
    { key: "car", label: "Car", width: "3.5%", center: true },
    { key: "yardPic", label: "Yard\nPIC", width: "2.8%", center: false },
    { key: "remark", label: "Remark", width: "15.9%", center: false },
] as const;

export type ScheduleFieldKey = Exclude<(typeof SCHEDULE_COLUMNS)[number]["key"], "no">;

export const SCHEDULE_TITLE_BG = "#A8D0F0";
export const SCHEDULE_LABEL_BG = "#E2E8F0";
export const SCHEDULE_CELL_BORDER = "border border-gray-800";

export function formatScheduleVersionKey(
    scheduleDate: string,
    versionLabel: string
): string {
    return `${scheduleDate}${versionLabel}`;
}
