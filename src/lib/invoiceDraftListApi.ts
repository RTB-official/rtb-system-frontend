import { supabase } from "./supabase";
import type { InvoiceDraftPayload, InvoiceDraftRow } from "./invoiceDraftApi";

const EMPTY_LIST_PAYLOAD = {
    version: 1,
    workLogDataList: [],
    timesheetRows: [],
    selectedSkilledFitters: [],
    selectedFitterRepresentatives: {},
    travelChargeOverrides: {},
    entryManualBillableHours: {},
    entryManualBillableSplitHours: {},
    deletedTimesheetEntries: [],
    selectedTimesheetDateGroupKeys: [],
} as InvoiceDraftPayload;

export type InvoiceDraftVesselGroupItem = {
    vessel: string;
    draftCount: number;
    latestUpdatedAt: string;
};

type VesselGroupRpcRow = {
    vessel: string;
    draft_count: number | string;
    latest_updated_at: string;
};

type DraftByVesselGroupRpcRow = {
    id: string;
    created_by: string;
    title: string;
    work_log_ids: number[] | null;
    status: string;
    created_at: string;
    updated_at: string;
    creator_name: string | null;
};

function normalizeWorkLogIds(value: number[] | null | undefined): number[] {
    if (!Array.isArray(value)) return [];
    return value
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id));
}

function mapDraftByVesselGroupRow(row: DraftByVesselGroupRpcRow): InvoiceDraftRow {
    return {
        id: row.id,
        created_by: row.created_by,
        title: row.title,
        work_log_ids: normalizeWorkLogIds(row.work_log_ids),
        payload: EMPTY_LIST_PAYLOAD,
        status: row.status === "final" ? "final" : "draft",
        created_at: row.created_at,
        updated_at: row.updated_at,
        creator_name: row.creator_name,
    };
}

/** 호선별 그룹 전체 */
export async function fetchInvoiceDraftVesselGroups(): Promise<
    InvoiceDraftVesselGroupItem[]
> {
    const { data, error } = await supabase.rpc("get_invoice_draft_vessel_groups");

    if (error) {
        throw new Error(`저장 목록 조회 실패: ${error.message}`);
    }

    const rows = (data ?? []) as VesselGroupRpcRow[];

    return rows.map((row) => ({
        vessel: row.vessel,
        draftCount: Number(row.draft_count ?? 0),
        latestUpdatedAt: row.latest_updated_at,
    }));
}

/** 호선 그룹별 드래프트 전체 (모달) */
export async function fetchInvoiceDraftsByVesselGroup(
    vessel: string
): Promise<InvoiceDraftRow[]> {
    const { data, error } = await supabase.rpc(
        "get_invoice_drafts_by_vessel_group",
        { p_vessel: vessel }
    );

    if (error) {
        throw new Error(`드래프트 목록 조회 실패: ${error.message}`);
    }

    const rows = (data ?? []) as DraftByVesselGroupRpcRow[];
    return rows.map(mapDraftByVesselGroupRow);
}
