// src/pages/Invoice/InvoiceCreatePage.tsx
import React, { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/common/Header";
import { IconEdit } from "../../components/icons/Icons";
import BaseModal from "../../components/ui/BaseModal";
import TimesheetDateGroupDetailSidePanel from "../../components/panels/TimesheetDateGroupDetailSidePanel";
import TimesheetRowDetailSidePanel from "../../components/panels/TimesheetRowDetailSidePanel";
import { getWorkLogById, type WorkLogFullData } from "../../lib/workLogApi";
import { getCalendarEvents } from "../../lib/dashboardApi";
import { supabase } from "../../lib/supabase";
import { useToast } from "../../components/ui/ToastProvider";
import {
    SKILLED_FITTER_KOREAN_NAMES,
    SKILLED_FITTER_NAME_SET,
} from "../../constants/skilledFitter";

interface TimesheetRow {
    rowId: string;
    date: string; // YYYY-MM-DD
    day: string; // 요일 (Mon, Tue, etc.)
    dateFormatted: string; // DD.MMM 형식
    timeFrom: string; // HH 형식
    timeTo: string; // HH 형식
    totalHours: number;
    weekdayNormal: number;
    weekdayAfter: number;
    weekendNormal: number;
    weekendAfter: number;
    travelWeekday: number;
    travelWeekend: number;
    travelWeekdayDisplay?: string;
    travelWeekendDisplay?: string;
    description: string;
    hideDayDate?: boolean;
    sourceEntries: TimesheetSourceEntryData[];
    chargeWindowStart?: string;
    chargeWindowEnd?: string;
}

interface TimesheetSourceEntryData {
    id: number;
    workLogId: number;
    dateFrom: string;
    timeFrom: string;
    dateTo: string;
    timeTo: string;
    descType: string;
    details: string;
    persons: string[];
    note?: string;
    moveFrom?: string;
    moveTo?: string;
    location?: string | null;
    lunchWorked?: boolean;
    /** 사이드패널에서 복사로 만든 행(빨간 테두리 등) */
    clientDuplicated?: boolean;
}

/** 동일 시작 시각일 때 정렬 안정화(복사·원본 행 순서 뒤바뀜 방지) */
function compareTimesheetSourceEntriesByTimeThenId(
    a: TimesheetSourceEntryData,
    b: TimesheetSourceEntryData
): number {
    const aStart = new Date(`${a.dateFrom}T${a.timeFrom || "00:00"}`).getTime();
    const bStart = new Date(`${b.dateFrom}T${b.timeFrom || "00:00"}`).getTime();
    if (aStart !== bStart) {
        return aStart - bStart;
    }
    const aNeg = a.id < 0;
    const bNeg = b.id < 0;
    if (!aNeg && !bNeg) {
        return a.id - b.id;
    }
    if (aNeg && !bNeg) {
        return 1;
    }
    if (!aNeg && bNeg) {
        return -1;
    }
    return b.id - a.id;
}

function timesheetSourceToWorkLogEntry(
    src: TimesheetSourceEntryData
): WorkLogFullData["entries"][number] {
    return {
        id: src.id,
        dateFrom: src.dateFrom,
        timeFrom: src.timeFrom,
        dateTo: src.dateTo,
        timeTo: src.timeTo,
        descType: src.descType,
        details: src.details,
        persons: [...(src.persons ?? [])],
        note: src.note,
        moveFrom: src.moveFrom,
        moveTo: src.moveTo,
        lunch_worked: src.lunchWorked,
        clientDuplicated: src.clientDuplicated === true,
    };
}

function insertWorkLogEntrySorted(
    entries: WorkLogFullData["entries"],
    newEntry: WorkLogFullData["entries"][number]
): WorkLogFullData["entries"] {
    const next = [...entries, newEntry];
    next.sort((a, b) => {
        const aStart = new Date(`${a.dateFrom}T${a.timeFrom || "00:00"}`).getTime();
        const bStart = new Date(`${b.dateFrom}T${b.timeFrom || "00:00"}`).getTime();
        if (aStart !== bStart) {
            return aStart - bStart;
        }
        return a.id - b.id;
    });
    return next;
}

function mergeRestoredPanelEntries(
    arr: TimesheetSourceEntryData[],
    restored: TimesheetSourceEntryData
): TimesheetSourceEntryData[] {
    if (arr.some((e) => e.id === restored.id)) {
        return arr;
    }
    return [...arr, restored].sort(compareTimesheetSourceEntriesByTimeThenId);
}

/** 날짜 그룹 패널 동기화: 이전 엔트리와 새로 계산한 엔트리가 동일한지 확인한다. */
function isTimesheetSourceEntryPanelSyncEqual(
    a: TimesheetSourceEntryData,
    b: TimesheetSourceEntryData
): boolean {
    return (
        a.id === b.id &&
        a.workLogId === b.workLogId &&
        a.dateFrom === b.dateFrom &&
        a.timeFrom === b.timeFrom &&
        a.dateTo === b.dateTo &&
        a.timeTo === b.timeTo &&
        a.descType === b.descType &&
        a.details === b.details &&
        (a.note ?? "") === (b.note ?? "") &&
        (a.moveFrom ?? "") === (b.moveFrom ?? "") &&
        (a.moveTo ?? "") === (b.moveTo ?? "") &&
        (a.location ?? null) === (b.location ?? null) &&
        Boolean(a.lunchWorked) === Boolean(b.lunchWorked) &&
        Boolean(a.clientDuplicated) === Boolean(b.clientDuplicated) &&
        (a.persons ?? []).join("|") === (b.persons ?? []).join("|")
    );
}

type MealCountAdjustmentEntry = { delta: number; lastDirection: "up" | "down" };

/** 로직 계산 후 청구시간 기준 구간으로 Time from / Time to를 보정 */
const applyChargedTimeWindowToTimesheetRows = (
    rows: TimesheetRow[]
): TimesheetRow[] =>
    rows
        .map((row) => ({
            ...row,
            timeFrom: (row.chargeWindowStart ?? row.timeFrom).split(":")[0],
            timeTo: (row.chargeWindowEnd ?? row.timeTo).split(":")[0],
        }))
        .sort((a, b) => {
            if (a.date !== b.date) {
                return a.date.localeCompare(b.date);
            }
            if (a.timeFrom !== b.timeFrom) {
                return a.timeFrom.localeCompare(b.timeFrom);
            }
            return a.timeTo.localeCompare(b.timeTo);
        });

/** 타임시트 행 생성 로직 이후, 화면에 보이는 시간·청구 열이 같으면 인접 행만 병합 */
const mergeAdjacentTimesheetRowsByVisibleTimeAndCharge = (
    rows: TimesheetRow[]
): TimesheetRow[] => {
    const round1 = (n: number) => Math.round(n * 10) / 10;

    const chargeDisplayKey = (row: TimesheetRow) => {
        const travelWeekdayCell =
            row.travelWeekdayDisplay ||
            (row.travelWeekday > 0 ? String(round1(row.travelWeekday)) : "");
        const travelWeekendCell =
            row.travelWeekendDisplay ||
            (row.travelWeekend > 0 ? String(round1(row.travelWeekend)) : "");
        return [
            String(round1(row.totalHours)),
            row.weekdayNormal > 0 ? String(round1(row.weekdayNormal)) : "",
            row.weekdayAfter > 0 ? String(round1(row.weekdayAfter)) : "",
            row.weekendNormal > 0 ? String(round1(row.weekendNormal)) : "",
            row.weekendAfter > 0 ? String(round1(row.weekendAfter)) : "",
            travelWeekdayCell,
            travelWeekendCell,
        ].join("|");
    };

    const rowMergeKey = (row: TimesheetRow) =>
        [row.date, row.timeFrom, row.timeTo, chargeDisplayKey(row)].join("\x1f");

    const merged: TimesheetRow[] = [];
    for (const row of rows) {
        const key = rowMergeKey(row);
        const prev = merged[merged.length - 1];
        if (prev && rowMergeKey(prev) === key) {
            const prevNames = prev.description
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);
            const nextNames = row.description
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);
            prev.description = Array.from(new Set([...prevNames, ...nextNames]))
                .sort((a, b) => a.localeCompare(b, "ko"))
                .join(", ");

            const entryById = new Map<number, TimesheetSourceEntryData>();
            for (const e of prev.sourceEntries) {
                entryById.set(e.id, e);
            }
            for (const e of row.sourceEntries) {
                entryById.set(e.id, e);
            }
            prev.sourceEntries = Array.from(entryById.values()).sort(
                compareTimesheetSourceEntriesByTimeThenId
            );
        } else {
            merged.push({
                ...row,
                sourceEntries: [...row.sourceEntries],
            });
        }
    }

    let lastDate: string | undefined;
    let indexWithinDate = 0;
    return merged.map((row) => {
        if (row.date !== lastDate) {
            lastDate = row.date;
            indexWithinDate = 0;
        }
        const hideDayDate = indexWithinDate > 0;
        const rowId = `${row.date}-${indexWithinDate}`;
        indexWithinDate += 1;
        return {
            ...row,
            rowId,
            hideDayDate,
        };
    });
};

interface TimesheetRowModalData {
    rowKey: string;
    sectionTitle: string;
    selectedPersons: string[];
    day: string;
    dateFormatted: string;
    timeFrom: string;
    timeTo: string;
    description: string;
    sourceEntries: TimesheetSourceEntryData[];
    groupSourceEntries: TimesheetSourceEntryData[];
    previousWorkLocations: Record<string, string[]>;
    nextWorkLocations: Record<string, string[]>;
    /** 타임시트 행의 YYYY-MM-DD — 삭제 엔트리 스코프(내 엔트리만 모두 삭제해도 유지) */
    timesheetRowCalendarDate?: string;
}

interface TimesheetDateGroupPanelData {
    blockKey: string;
    sectionTitle: string;
    fullGroupEntries: TimesheetSourceEntryData[];
    workLocationsByDate: Record<string, Record<string, string[]>>;
    /** 패널이 다루는 행 날짜(YYYY-MM-DD) — 엔트리가 모두 삭제된 뒤에도 삭제 목록 스코프 유지 */
    panelCalendarDates?: string[];
}

type PersonVesselHistoryItem = {
    date: string;
    vessels: string[];
};

type TravelChargeOverrideTarget = "home" | "lodging";

type TravelChargeOverrideValue = {
    target: TravelChargeOverrideTarget;
    updatedAt: number;
};

type TravelChargeOverrideMap = Record<string, TravelChargeOverrideValue>;

type InvoiceUndoSnapshot = {
    workLogDataList: WorkLogFullData[];
    travelChargeOverrides: TravelChargeOverrideMap;
    entryManualBillableHours: Record<number, number>;
    deletedTimesheetEntries: TimesheetSourceEntryData[];
    selectedTimesheetDateGroupPanel: TimesheetDateGroupPanelData | null;
    selectedTimesheetRow: TimesheetRowModalData | null;
};

const MAX_INVOICE_UNDO = 40;

function cloneInvoiceUndoSnapshot(s: InvoiceUndoSnapshot): InvoiceUndoSnapshot {
    return {
        workLogDataList: JSON.parse(JSON.stringify(s.workLogDataList)) as WorkLogFullData[],
        travelChargeOverrides: { ...s.travelChargeOverrides },
        entryManualBillableHours: { ...s.entryManualBillableHours },
        deletedTimesheetEntries: JSON.parse(
            JSON.stringify(s.deletedTimesheetEntries ?? [])
        ) as TimesheetSourceEntryData[],
        selectedTimesheetDateGroupPanel: s.selectedTimesheetDateGroupPanel
            ? (JSON.parse(
                  JSON.stringify(s.selectedTimesheetDateGroupPanel)
              ) as TimesheetDateGroupPanelData)
            : null,
        selectedTimesheetRow: s.selectedTimesheetRow
            ? (JSON.parse(JSON.stringify(s.selectedTimesheetRow)) as TimesheetRowModalData)
            : null,
    };
}

interface PersonnelEditorState {
    scopeKey: string;
    scopeTitle: string;
    mode: "engineer" | "mechanic";
    people: string[];
}

interface PersonnelSelectionCandidate {
    name: string;
    displayName: string;
    selected: boolean;
}

type NormalTimesheetSection = {
    key: string;
    title: string;
    people: string[];
    rows: TimesheetRow[];
};

type WorkLogEntryItem = WorkLogFullData["entries"][number];
type WorkLocationContext = Record<string, string[]>;
type WorkLocationContextByDate = Record<string, WorkLocationContext>;

/** Entry edit highlight baseline — synced on save and undo */
export type TimesheetEntryEditBaseline = {
    descType: string;
    dateFrom: string;
    dateTo: string;
    timeFrom: string;
    timeTo: string;
    manualBillableHours?: number;
};

function buildTimesheetEntryEditBaselineMap(
    workLogs: WorkLogFullData[],
    manualMap: Record<number, number>
): Record<number, TimesheetEntryEditBaseline> {
    return Object.fromEntries(
        workLogs.flatMap((data) =>
            data.entries.map(
                (entry) =>
                    [
                        entry.id,
                        {
                            descType: entry.descType,
                            dateFrom: entry.dateFrom,
                            dateTo: entry.dateTo,
                            timeFrom: entry.timeFrom ?? "",
                            timeTo: entry.timeTo ?? "",
                            manualBillableHours: manualMap[entry.id],
                        },
                    ] as const
            )
        )
    );
}

type InvoiceTimesheetEntry = WorkLogEntryItem & {
    workLogId: number;
    location: string | null;
    sourceEntryIds: number[];
    /** 자택 고정 청구시간을 반영해 시간 구간 자체를 이미 보정했는지 여부 */
    fixedHomeTravelWindowApplied?: boolean;
};

const HOLIDAY_API_KEY =
    "cac7adf961a1b55472fa90319e4cb89dde6c04242edcb3d3970ae9e09c931e98";
const HOLIDAY_API_ENDPOINT =
    "https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo";
const SKILLED_FITTER_PRIORITY = [...SKILLED_FITTER_KOREAN_NAMES];
const SKILLED_FITTER_SET = SKILLED_FITTER_NAME_SET;

/** 기본 Skilled fitter 1순위 풀(동순위). 타임시트에 이 중 한 명이라도 있으면 이들만 엔트리 수로 경쟁. */
const DEFAULT_SKILLED_FITTER_TIER1 = [
    "김춘근",
    "안재훈",
    "온권태",
] as const;
const DEFAULT_SKILLED_FITTER_TIER1_SET = new Set<string>(
    DEFAULT_SKILLED_FITTER_TIER1
);
const SKILLED_FITTER_ENTRY_COUNT_DESC_TYPES = new Set([
    "이동",
    "작업",
    "대기",
]);

const countSkilledFitterRowsByPerson = (
    workLogs: readonly WorkLogFullData[]
): Map<string, number> => {
    const counts = new Map<string, number>();
    for (const wl of workLogs) {
        for (const entry of wl.entries) {
            const dt = (entry.descType ?? "").trim();
            if (!SKILLED_FITTER_ENTRY_COUNT_DESC_TYPES.has(dt)) {
                continue;
            }
            for (const person of entry.persons ?? []) {
                if (!person || !SKILLED_FITTER_SET.has(person)) {
                    continue;
                }
                counts.set(person, (counts.get(person) ?? 0) + 1);
            }
        }
    }
    return counts;
};

const pickDefaultSkilledFitterByEntryCount = (
    timesheetPeople: readonly string[],
    workLogs: readonly WorkLogFullData[]
): string | null => {
    const inTimesheet = SKILLED_FITTER_KOREAN_NAMES.filter((name) =>
        timesheetPeople.includes(name)
    );
    if (inTimesheet.length === 0) {
        return null;
    }

    const counts = countSkilledFitterRowsByPerson(workLogs);
    const tier1InTimesheet = inTimesheet.filter((name) =>
        DEFAULT_SKILLED_FITTER_TIER1_SET.has(name)
    );
    const pool =
        tier1InTimesheet.length > 0 ? tier1InTimesheet : inTimesheet;

    const sorted = [...pool].sort((a, b) => {
        const ca = counts.get(a) ?? 0;
        const cb = counts.get(b) ?? 0;
        if (cb !== ca) {
            return cb - ca;
        }
        return a.localeCompare(b, "ko");
    });
    return sorted[0] ?? null;
};
const PERSON_MENTION_PRIORITY = [
    "김춘근",
    "안재훈",
    "온권태",
    "정영철",
    "이효익",
    "정상민",
    "김동민",
    "성기형",
    "류성관",
    "우상윤",
    "김희규",
    "이종훈",
    "조용남",
    "박영성",
    "김민규",
    "문채훈",
    "김상민",
];
const PERSON_MENTION_PRIORITY_INDEX = new Map(
    PERSON_MENTION_PRIORITY.map((name, index) => [name, index] as const)
);
const MONTH_LABELS = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
];

function PersonnelSelectionModal({
    isOpen,
    onClose,
    title,
    scopeTitle,
    candidates,
    onCandidateClick,
}: {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    scopeTitle: string;
    candidates: PersonnelSelectionCandidate[];
    onCandidateClick: (name: string) => void;
}) {
    return (
        <BaseModal
            isOpen={isOpen}
            onClose={onClose}
            title={title}
            maxWidth="max-w-[720px]"
        >
            <div className="space-y-4">
                <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
                    <div className="font-semibold text-gray-900">{scopeTitle}</div>
                </div>

                {candidates.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500">
                        선택할 수 있는 인원이 없습니다.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {candidates.map((candidate) => (
                            <button
                                key={candidate.name}
                                type="button"
                                className={`relative rounded-xl border px-4 py-4 text-left transition-colors ${
                                    candidate.selected
                                        ? "border-blue-500 bg-blue-50 text-blue-700"
                                        : "border-gray-200 bg-white text-gray-900 hover:border-blue-200 hover:bg-gray-50"
                                }`}
                                onClick={() => onCandidateClick(candidate.name)}
                            >
                                <div className="text-sm font-semibold">
                                    {candidate.name}
                                </div>
                                <div className="mt-1 text-xs text-gray-500">
                                    {candidate.displayName}
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </BaseModal>
    );
}

export default function InvoiceCreatePage() {
    const [searchParams] = useSearchParams();
    const workLogIdsParam =
        searchParams.get("workLogIds") ?? searchParams.get("workLogId");
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [workLogDataList, setWorkLogDataList] = useState<WorkLogFullData[]>([]);
    const [timesheetRows, setTimesheetRows] = useState<TimesheetRow[]>([]);
    const [profileUsernameMap, setProfileUsernameMap] = useState<
        Record<string, string>
    >({});
    const [personVesselHistoryByPerson, setPersonVesselHistoryByPerson] =
        useState<Record<string, PersonVesselHistoryItem[]>>({});
    const [selectedSkilledFitters, setSelectedSkilledFitters] = useState<
        string[]
    >([]);
    const [selectedFitterRepresentatives, setSelectedFitterRepresentatives] =
        useState<Record<string, string>>({});
    const [personnelEditor, setPersonnelEditor] =
        useState<PersonnelEditorState | null>(null);
    const [holidayDateSet, setHolidayDateSet] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(false);
    const [selectedTimesheetRow, setSelectedTimesheetRow] =
        useState<TimesheetRowModalData | null>(null);
    const [selectedTimesheetDateGroupKeys, setSelectedTimesheetDateGroupKeys] =
        useState<string[]>([]);
    const [selectedTimesheetDateGroupAnchorKey, setSelectedTimesheetDateGroupAnchorKey] =
        useState<string | null>(null);
    const [selectedTimesheetDateGroupPanel, setSelectedTimesheetDateGroupPanel] =
        useState<TimesheetDateGroupPanelData | null>(null);
    const [travelChargeOverrides, setTravelChargeOverrides] =
        useState<TravelChargeOverrideMap>({});
    /** 엔트리별 수동 청구시간(시). 이동 묶음은 구성 엔트리가 모두 값이 있을 때 합산 적용 */
    const [entryManualBillableHours, setEntryManualBillableHours] = useState<
        Record<number, number>
    >({});
    const invoiceUndoPastRef = useRef<InvoiceUndoSnapshot[]>([]);
    const invoiceUndoFutureRef = useRef<InvoiceUndoSnapshot[]>([]);
    const latestInvoiceStateRef = useRef<InvoiceUndoSnapshot | null>(null);
    const pushInvoiceUndoSnapshotRef = useRef<() => void>(() => {});
    const [invoiceUndoRedoCounts, setInvoiceUndoRedoCounts] = useState({
        past: 0,
        future: 0,
    });
    const [hoveredTimesheetRowKey, setHoveredTimesheetRowKey] = useState<
        string | null
    >(null);
    const [hoveredTimesheetDateGroupKey, setHoveredTimesheetDateGroupKey] =
        useState<string | null>(null);
    const [timesheetView, setTimesheetView] = useState<"rnd" | "normal">("rnd");
    const [normalTimesheetIndex, setNormalTimesheetIndex] = useState(0);
    const [normalTimesheetGrouping, setNormalTimesheetGrouping] = useState<
        "person" | "date"
    >("person");
    const [mealCountAdjustmentsBySectionDate, setMealCountAdjustmentsBySectionDate] =
        useState<Record<string, MealCountAdjustmentEntry>>({});
    const duplicateTimesheetEntryIdRef = useRef(-1);
    /** normalTimesheetSectionsByPerson 정의 이후 매 렌더에서 갱신 — 인원별 `::date::` 조정을 R&D 등에서 조회 */
    const resolveNormalPersonDateScopedMealAdjustmentRef = useRef<
        (row: TimesheetRow) => MealCountAdjustmentEntry | undefined
    >(() => undefined);
    const loadedWorkLogIdsParamRef = useRef<string | null>(null);
    const initialTimesheetRowValueByIdentityRef = useRef<
        Record<
            string,
            {
                timeFrom: string;
                timeTo: string;
                totalHours: string;
                weekdayNormal: string;
                weekdayAfter: string;
                weekendNormal: string;
                weekendAfter: string;
                travelWeekday: string;
                travelWeekend: string;
            }
        >
    >({});
    /** 최초 로드(또는 API 재조회) 직후 보고서 스냅샷 — 기본값 초기화에 사용 */
    const initialWorkLogSnapshotRef = useRef<WorkLogFullData[] | null>(null);
    const originalEntryPersonsByIdRef = useRef<Record<number, string[]>>({});
    const timesheetEntryEditBaselineByIdRef = useRef<
        Record<number, TimesheetEntryEditBaseline>
    >({});
    const [invoiceResetConfirmOpen, setInvoiceResetConfirmOpen] =
        useState(false);
    const [timesheetEntryEditorRemountTickById, setTimesheetEntryEditorRemountTickById] =
        useState<Record<number, number>>({});
    const [deletedTimesheetEntries, setDeletedTimesheetEntries] = useState<
        TimesheetSourceEntryData[]
    >([]);
    const { showError, showSuccess } = useToast();

    latestInvoiceStateRef.current = {
        workLogDataList,
        travelChargeOverrides,
        entryManualBillableHours,
        deletedTimesheetEntries,
        selectedTimesheetDateGroupPanel,
        selectedTimesheetRow,
    };

    const getTravelChargeOverrideKey = (entryId: number, person: string) =>
        `${entryId}:${person}`;

    const getTravelChargeOverride = (entryId: number, person: string) =>
        travelChargeOverrides[getTravelChargeOverrideKey(entryId, person)] ?? null;

    /** 타임시트 행에 실제 표시되는 인원 기준 자택/숙소 오버라이드 시그니처 */
    const getTravelChargeOverrideSignatureForRow = (row: TimesheetRow) => {
        const visiblePeople = new Set(
            row.description
                .split(",")
                .map((value) => value.trim())
                .filter(Boolean)
        );
        const parts: string[] = [];
        for (const entry of row.sourceEntries) {
            for (const person of entry.persons ?? []) {
                if (!visiblePeople.has(person)) {
                    continue;
                }
                const o = getTravelChargeOverride(entry.id, person);
                if (o) {
                    parts.push(
                        `${entry.id}\x1f${person}\x1f${o.target}`
                    );
                }
            }
        }
        return parts.sort((a, b) => a.localeCompare(b, "ko")).join("|");
    };

    const setTravelChargeOverrideTarget = (
        entryId: number,
        person: string,
        target: TravelChargeOverrideTarget
    ) => {
        pushInvoiceUndoSnapshotRef.current();
        setTravelChargeOverrides((previous) => {
            const updatedAt = Date.now();
            const next: TravelChargeOverrideMap = {
                ...previous,
                [getTravelChargeOverrideKey(entryId, person)]: {
                    target,
                    updatedAt,
                },
            };

            // 전날 편집(자택/숙소)이 다음날 "첫 이동" 판정에도 자동 연동되도록
            // 다음 날짜의 leading travel(첫 작업/대기/작업 전 연속 이동) 엔트리에 같은 오버라이드를 복사한다.
            const baseEntry = timesheetRows
                .flatMap((row) => row.sourceEntries)
                .find((entry) => entry.id === entryId);
            if (!baseEntry?.dateFrom) {
                return next;
            }

            const previousDate = shiftDateByDays(baseEntry.dateFrom, -1);
            const nextDate = shiftDateByDays(baseEntry.dateFrom, 1);

            // 오늘 편집(자택/숙소)이 전날 "마지막 이동" 판정에도 자동 연동되도록
            // 이전 날짜의 trailing travel(마지막 작업/대기 이후 연속 이동) 엔트리에 같은 오버라이드를 복사한다.
            const previousDateEntries = timesheetRows
                .filter((row) => row.date === previousDate)
                .flatMap((row) => row.sourceEntries)
                .filter((entry, index, entries) => {
                    return (
                        entries.findIndex((candidate) => candidate.id === entry.id) ===
                        index
                    );
                })
                .sort(compareTimesheetSourceEntriesByTimeThenId);

            const personPreviousEntries = previousDateEntries.filter((entry) =>
                (entry.persons ?? []).includes(person)
            );
            const trailingTravelIds: number[] = [];
            for (let i = personPreviousEntries.length - 1; i >= 0; i -= 1) {
                const entry = personPreviousEntries[i];
                if (entry.descType !== "이동") break;
                trailingTravelIds.push(entry.id);
            }

            trailingTravelIds.forEach((prevEntryId) => {
                next[getTravelChargeOverrideKey(prevEntryId, person)] = {
                    target,
                    updatedAt,
                };
            });
            const nextDateEntries = timesheetRows
                .filter((row) => row.date === nextDate)
                .flatMap((row) => row.sourceEntries)
                .filter((entry, index, entries) => {
                    return (
                        entries.findIndex((candidate) => candidate.id === entry.id) ===
                        index
                    );
                })
                .sort(compareTimesheetSourceEntriesByTimeThenId);

            const personNextEntries = nextDateEntries.filter((entry) =>
                (entry.persons ?? []).includes(person)
            );
            const leadingTravelIds: number[] = [];
            for (const entry of personNextEntries) {
                if (entry.descType !== "이동") break;
                leadingTravelIds.push(entry.id);
            }

            leadingTravelIds.forEach((nextEntryId) => {
                next[getTravelChargeOverrideKey(nextEntryId, person)] = {
                    target,
                    updatedAt,
                };
            });

            return next;
        });
    };

    const resetTravelChargeOverridesForEntry = (entryId: number) => {
        setTravelChargeOverrides((previous) =>
            Object.fromEntries(
                Object.entries(previous).filter(([key]) => !key.startsWith(`${entryId}:`))
            )
        );
    };

    const pushInvoiceUndoSnapshot = useCallback(() => {
        const s = latestInvoiceStateRef.current;
        if (!s) {
            return;
        }
        invoiceUndoPastRef.current.push(cloneInvoiceUndoSnapshot(s));
        if (invoiceUndoPastRef.current.length > MAX_INVOICE_UNDO) {
            invoiceUndoPastRef.current.shift();
        }
        invoiceUndoFutureRef.current = [];
        setInvoiceUndoRedoCounts({
            past: invoiceUndoPastRef.current.length,
            future: invoiceUndoFutureRef.current.length,
        });
    }, []);

    pushInvoiceUndoSnapshotRef.current = pushInvoiceUndoSnapshot;

    const handleInvoiceUndo = useCallback(() => {
        if (invoiceUndoPastRef.current.length === 0) {
            return;
        }
        const snapshot = invoiceUndoPastRef.current.pop()!;
        const cur = latestInvoiceStateRef.current;
        if (cur) {
            invoiceUndoFutureRef.current.push(cloneInvoiceUndoSnapshot(cur));
        }
        setWorkLogDataList(snapshot.workLogDataList);
        setTravelChargeOverrides(snapshot.travelChargeOverrides);
        setEntryManualBillableHours(snapshot.entryManualBillableHours ?? {});
        setDeletedTimesheetEntries(snapshot.deletedTimesheetEntries ?? []);
        setSelectedTimesheetDateGroupPanel(snapshot.selectedTimesheetDateGroupPanel);
        setSelectedTimesheetRow(snapshot.selectedTimesheetRow);
        setInvoiceUndoRedoCounts({
            past: invoiceUndoPastRef.current.length,
            future: invoiceUndoFutureRef.current.length,
        });
    }, []);

    const handleInvoiceRedo = useCallback(() => {
        if (invoiceUndoFutureRef.current.length === 0) {
            return;
        }
        const snapshot = invoiceUndoFutureRef.current.pop()!;
        const cur = latestInvoiceStateRef.current;
        if (cur) {
            invoiceUndoPastRef.current.push(cloneInvoiceUndoSnapshot(cur));
        }
        setWorkLogDataList(snapshot.workLogDataList);
        setTravelChargeOverrides(snapshot.travelChargeOverrides);
        setEntryManualBillableHours(snapshot.entryManualBillableHours ?? {});
        setDeletedTimesheetEntries(snapshot.deletedTimesheetEntries ?? []);
        setSelectedTimesheetDateGroupPanel(snapshot.selectedTimesheetDateGroupPanel);
        setSelectedTimesheetRow(snapshot.selectedTimesheetRow);
        setInvoiceUndoRedoCounts({
            past: invoiceUndoPastRef.current.length,
            future: invoiceUndoFutureRef.current.length,
        });
    }, []);

    const openInvoiceResetConfirmModal = useCallback(() => {
        setInvoiceResetConfirmOpen(true);
    }, []);

    const handleConfirmInvoiceResetToInitial = useCallback(() => {
        setInvoiceResetConfirmOpen(false);
        const snap = initialWorkLogSnapshotRef.current;
        if (!snap || snap.length === 0) {
            showError("초기 데이터를 불러올 수 없습니다. 페이지를 새로고침 후 다시 시도해 주세요.");
            return;
        }

        pushInvoiceUndoSnapshot();

        const restored = JSON.parse(JSON.stringify(snap)) as WorkLogFullData[];
        originalEntryPersonsByIdRef.current = Object.fromEntries(
            restored.flatMap((data) =>
                data.entries.map((entry) => [
                    entry.id,
                    [...(entry.persons ?? [])],
                ] as const)
            )
        );
        timesheetEntryEditBaselineByIdRef.current =
            buildTimesheetEntryEditBaselineMap(restored, {});
        setWorkLogDataList(restored);
        setTravelChargeOverrides({});
        setEntryManualBillableHours({});
        setDeletedTimesheetEntries([]);
        duplicateTimesheetEntryIdRef.current = -1;
        setSelectedFitterRepresentatives({});
        setSelectedTimesheetRow(null);
        setPersonnelEditor(null);
        showSuccess("최초 로드 상태로 되돌렸습니다.");
    }, [pushInvoiceUndoSnapshot, showError, showSuccess]);

    useEffect(() => {
        const isLikelyTextFieldFocus = (target: EventTarget | null) => {
            if (!(target instanceof HTMLElement)) {
                return false;
            }
            if (target.isContentEditable) {
                return true;
            }
            const t = target.tagName;
            if (t === "INPUT" || t === "TEXTAREA" || t === "SELECT") {
                return true;
            }
            return Boolean(
                target.closest('[contenteditable="true"], [contenteditable=""]')
            );
        };

        const onKeyDown = (e: KeyboardEvent) => {
            if (isLikelyTextFieldFocus(e.target)) {
                return;
            }
            const mod = e.ctrlKey || e.metaKey;
            if (!mod) {
                return;
            }

            const key = e.key;
            if (key === "z" || key === "Z") {
                if (e.shiftKey) {
                    if (invoiceUndoFutureRef.current.length > 0) {
                        e.preventDefault();
                        handleInvoiceRedo();
                    }
                } else if (invoiceUndoPastRef.current.length > 0) {
                    e.preventDefault();
                    handleInvoiceUndo();
                }
                return;
            }

            if ((key === "y" || key === "Y") && !e.shiftKey) {
                if (invoiceUndoFutureRef.current.length > 0) {
                    e.preventDefault();
                    handleInvoiceRedo();
                }
            }
        };

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [handleInvoiceUndo, handleInvoiceRedo]);

    const toDateSafe = (date: string, time: string): Date => {
        const [hhStr, mmStr] = time.split(":");
        const hh = Number(hhStr);
        const mm = Number(mmStr ?? "0");

        if (hh === 24) {
            const nextDay = new Date(`${date}T00:00:00`);
            nextDay.setDate(nextDay.getDate() + 1);
            nextDay.setHours(0, mm, 0, 0);
            return nextDay;
        }

        return new Date(
            `${date}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00`
        );
    };

    const formatTimeHHMM = (date: Date): string => {
        return `${String(date.getHours()).padStart(2, "0")}:${String(
            date.getMinutes()
        ).padStart(2, "0")}`;
    };

    const shiftTimeByHours = (
        date: string,
        time: string,
        hours: number
    ): string => {
        const shifted = toDateSafe(date, time);
        shifted.setMinutes(shifted.getMinutes() + hours * 60);
        return formatTimeHHMM(shifted);
    };

    const getPrimaryLocation = (location: string | null): string => {
        return location?.split(",")[0].trim() ?? "";
    };

    const getHomeTravelHours = (location: string | null): number | null => {
        const primaryLocation = getPrimaryLocation(location);

        if (
            primaryLocation === "HD중공업(해양)" ||
            primaryLocation === "HD미포" ||
            primaryLocation === "HHI" ||
            primaryLocation === "HMD"
        ) {
            return 2;
        }

        if (primaryLocation === "HD삼호" || primaryLocation === "HSHI") {
            return 4;
        }

        if (
            ["PNC", "PNIT", "HPNT", "BNCT", "HJNC"].includes(primaryLocation)
        ) {
            return 1;
        }

        return null;
    };

    const formatDateKey = (date: Date): string => {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
            2,
            "0"
        )}-${String(date.getDate()).padStart(2, "0")}`;
    };

    const getAdjustedTravelDateTimes = (
        entry: InvoiceTimesheetEntry
    ): Pick<
        InvoiceTimesheetEntry,
        "dateFrom" | "dateTo" | "timeFrom" | "timeTo" | "fixedHomeTravelWindowApplied"
    > => {
        const originalTimeFrom = entry.timeFrom || "";
        const originalTimeTo = entry.timeTo || "";

        if (
            entry.descType !== "이동" ||
            !entry.dateFrom ||
            !entry.dateTo ||
            !originalTimeFrom ||
            !originalTimeTo
        ) {
            return {
                dateFrom: entry.dateFrom,
                dateTo: entry.dateTo,
                timeFrom: entry.timeFrom,
                timeTo: entry.timeTo,
                fixedHomeTravelWindowApplied: false,
            };
        }

        const fixedHours = getHomeTravelHours(entry.location);
        if (!fixedHours) {
            return {
                dateFrom: entry.dateFrom,
                dateTo: entry.dateTo,
                timeFrom: entry.timeFrom,
                timeTo: entry.timeTo,
                fixedHomeTravelWindowApplied: false,
            };
        }

        const details = entry.details ?? "";
        const containsHome =
            details.includes("자택") ||
            entry.moveFrom === "자택" ||
            entry.moveTo === "자택";

        if (!containsHome) {
            return {
                dateFrom: entry.dateFrom,
                dateTo: entry.dateTo,
                timeFrom: entry.timeFrom,
                timeTo: entry.timeTo,
                fixedHomeTravelWindowApplied: false,
            };
        }

        const originalStart = toDateSafe(entry.dateFrom, originalTimeFrom);
        const originalEnd = toDateSafe(entry.dateTo, originalTimeTo);

        if (
            Number.isNaN(originalStart.getTime()) ||
            Number.isNaN(originalEnd.getTime()) ||
            originalEnd <= originalStart
        ) {
            return {
                dateFrom: entry.dateFrom,
                dateTo: entry.dateTo,
                timeFrom: entry.timeFrom,
                timeTo: entry.timeTo,
                fixedHomeTravelWindowApplied: false,
            };
        }

        const fromHome =
            entry.moveFrom === "자택" || details.trim().startsWith("자택→");
        const toHome =
            entry.moveTo === "자택" ||
            details.includes("→자택 이동.") ||
            details.endsWith("→자택");

        if (fromHome) {
            const adjustedStart = new Date(
                originalEnd.getTime() - fixedHours * 60 * 60 * 1000
            );
            return {
                dateFrom: formatDateKey(adjustedStart),
                dateTo: formatDateKey(originalEnd),
                timeFrom: formatTimeHHMM(adjustedStart),
                timeTo: formatTimeHHMM(originalEnd),
                fixedHomeTravelWindowApplied: true,
            };
        }

        const adjustedEnd = new Date(
            originalStart.getTime() + fixedHours * 60 * 60 * 1000
        );

        if (toHome) {
            return {
                dateFrom: formatDateKey(originalStart),
                dateTo: formatDateKey(adjustedEnd),
                timeFrom: formatTimeHHMM(originalStart),
                timeTo: formatTimeHHMM(adjustedEnd),
                fixedHomeTravelWindowApplied: true,
            };
        }

        return {
            dateFrom: formatDateKey(originalStart),
            dateTo: formatDateKey(adjustedEnd),
            timeFrom: formatTimeHHMM(originalStart),
            timeTo: formatTimeHHMM(adjustedEnd),
            fixedHomeTravelWindowApplied: true,
        };
    };

    const getTravelMergeKey = (entry: InvoiceTimesheetEntry): string => {
        return [
            entry.workLogId,
            entry.descType,
            normalizeLocationName(entry.location),
            [...(entry.persons ?? [])].sort().join("|"),
        ].join("::");
    };

    const mergeContinuousTravelEntries = (
        entries: InvoiceTimesheetEntry[]
    ): InvoiceTimesheetEntry[] => {
        const sortedEntries = [...entries].sort((a, b) => {
            const aStart = getEntryStartTime(a) ?? Number.MAX_SAFE_INTEGER;
            const bStart = getEntryStartTime(b) ?? Number.MAX_SAFE_INTEGER;

            if (aStart !== bStart) {
                return aStart - bStart;
            }

            const aEnd = getEntryEndTime(a) ?? Number.MAX_SAFE_INTEGER;
            const bEnd = getEntryEndTime(b) ?? Number.MAX_SAFE_INTEGER;
            return aEnd - bEnd;
        });

        const merged: InvoiceTimesheetEntry[] = [];
        const latestMergedIndexByKey = new Map<string, number>();

        sortedEntries.forEach((entry) => {
            if (entry.descType !== "이동") {
                merged.push({ ...entry });
                return;
            }

            const mergeKey = getTravelMergeKey(entry);
            const lastMergedIndex = latestMergedIndexByKey.get(mergeKey);
            const lastEntry =
                lastMergedIndex !== undefined ? merged[lastMergedIndex] : null;
            const lastEnd = lastEntry ? getEntryEndTime(lastEntry) : null;
            const currentStart = getEntryStartTime(entry);

            if (
                lastEntry &&
                lastEntry.descType === "이동" &&
                lastEnd !== null &&
                currentStart !== null &&
                lastEnd === currentStart
            ) {
                const firstMoveFrom =
                    lastEntry.moveFrom?.trim() || entry.moveFrom?.trim() || "";
                const lastMoveTo =
                    entry.moveTo?.trim() || lastEntry.moveTo?.trim() || "";
                const firstDetails = (lastEntry.details ?? "").trim();
                const lastDetails = (entry.details ?? "").trim();

                lastEntry.dateTo = entry.dateTo;
                lastEntry.timeTo = entry.timeTo;
                lastEntry.moveFrom = firstMoveFrom || lastEntry.moveFrom;
                lastEntry.moveTo = lastMoveTo || lastEntry.moveTo;
                lastEntry.details =
                    firstMoveFrom && lastMoveTo
                        ? `${firstMoveFrom}→${lastMoveTo} 이동.`
                        : [firstDetails, lastDetails].filter(Boolean).join(" / ");
                lastEntry.sourceEntryIds = Array.from(
                    new Set([...lastEntry.sourceEntryIds, ...entry.sourceEntryIds])
                );
                return;
            }

            merged.push({ ...entry });
            latestMergedIndexByKey.set(mergeKey, merged.length - 1);
        });

        return merged;
    };


    const hasHomeInTravel = (entry: InvoiceTimesheetEntry): boolean => {
        const details = entry.details ?? "";
        return (
            details.includes("자택") ||
            entry.moveFrom === "자택" ||
            entry.moveTo === "자택"
        );
    };

    const getLatestTravelChargeOverrideForEntries = (
        entries: InvoiceTimesheetEntry[],
        person: string
    ): TravelChargeOverrideValue | null => {
        let latestOverride: TravelChargeOverrideValue | null = null;

        entries.forEach((entry) => {
            const override = getTravelChargeOverride(entry.id, person);
            if (!override) {
                return;
            }

            if (!latestOverride || override.updatedAt > latestOverride.updatedAt) {
                latestOverride = override;
            }
        });

        return latestOverride;
    };

    const getFinalDestination = (entry: InvoiceTimesheetEntry): string => {
        const moveTo = entry.moveTo?.trim();
        if (moveTo) {
            return moveTo;
        }

        const details = (entry.details ?? "").replace(/\s*이동\.?\s*$/, "").trim();
        if (!details.includes("→")) {
            return details;
        }

        return details.split("→").pop()?.trim() ?? "";
    };

    const getTravelEntryOrigin = (entry: InvoiceTimesheetEntry): string => {
        const moveFrom = entry.moveFrom?.trim();
        if (moveFrom) {
            return moveFrom;
        }

        const details = (entry.details ?? "").replace(/\s*이동\.?\s*$/, "").trim();
        if (!details.includes("→")) {
            return details;
        }

        return details.split("→")[0]?.trim() ?? "";
    };

    const normalizeLocationName = (value: string | null | undefined): string => {
        if (!value) return "";

        const normalized = value.trim();
        if (!normalized) return "";

        if (normalized === "HHI") return "HD중공업(해양)";
        if (normalized === "HMD") return "HD미포";
        if (normalized === "HSHI") return "HD삼호";

        return normalized;
    };

    const isDestinationWorkPlace = (entry: InvoiceTimesheetEntry): boolean => {
        const destination = normalizeLocationName(getFinalDestination(entry));
        const workPlace = normalizeLocationName(getPrimaryLocation(entry.location));

        if (!destination || !workPlace) {
            return false;
        }

        return destination === workPlace;
    };

    

    const getEntryStartTime = (entry: InvoiceTimesheetEntry): number | null => {
        if (!entry.dateFrom || !entry.timeFrom) {
            return null;
        }

        const time = toDateSafe(entry.dateFrom, entry.timeFrom).getTime();
        return Number.isNaN(time) ? null : time;
    };

    const getEntryEndTime = (entry: InvoiceTimesheetEntry): number | null => {
        if (!entry.dateTo || !entry.timeTo) {
            return null;
        }

        const time = toDateSafe(entry.dateTo, entry.timeTo).getTime();
        return Number.isNaN(time) ? null : time;
    };

    const calculateRawTravelHours = (entry: InvoiceTimesheetEntry): number => {
        if (
            entry.descType !== "이동" ||
            !entry.dateFrom ||
            !entry.dateTo ||
            !entry.timeFrom ||
            !entry.timeTo
        ) {
            return 0;
        }

        const start = toDateSafe(entry.dateFrom, entry.timeFrom);
        const end = toDateSafe(entry.dateTo, entry.timeTo);

        if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
            return 0;
        }

        return Math.floor((end.getTime() - start.getTime()) / 60000) / 60;
    };

    const calculateTravelHours = (entry: InvoiceTimesheetEntry): number => {
        if (
            entry.descType !== "이동" ||
            !entry.dateFrom ||
            !entry.dateTo ||
            !entry.timeFrom ||
            !entry.timeTo
        ) {
            return 0;
        }

        const fixedHours = getHomeTravelHours(entry.location);
        if (
            fixedHours &&
            hasHomeInTravel(entry) &&
            !entry.fixedHomeTravelWindowApplied
        ) {
            return fixedHours;
        }

        const start = toDateSafe(entry.dateFrom, entry.timeFrom);
        const end = toDateSafe(entry.dateTo, entry.timeTo);

        if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
            return 0;
        }

        return (
            Math.floor((end.getTime() - start.getTime()) / 60000) / 60
        );
    };

    const getOverlapMinutes = (
        rangeStart: Date,
        rangeEnd: Date,
        targetStart: Date,
        targetEnd: Date
    ): number => {
        const overlapStart = rangeStart > targetStart ? rangeStart : targetStart;
        const overlapEnd = rangeEnd < targetEnd ? rangeEnd : targetEnd;

        if (overlapEnd <= overlapStart) {
            return 0;
        }

        return Math.floor((overlapEnd.getTime() - overlapStart.getTime()) / 60000);
    };

    const classifyWorkingHours = (
        entry: InvoiceTimesheetEntry
    ): { normalHours: number; afterHours: number; totalHours: number } => {
        if (
            !entry.dateFrom ||
            !entry.dateTo ||
            !entry.timeFrom ||
            !entry.timeTo
        ) {
            return { normalHours: 0, afterHours: 0, totalHours: 0 };
        }

        const start = toDateSafe(entry.dateFrom, entry.timeFrom);
        const end = toDateSafe(entry.dateTo, entry.timeTo);
        if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
            return { normalHours: 0, afterHours: 0, totalHours: 0 };
        }

        const totalMinutes = Math.floor((end.getTime() - start.getTime()) / 60000);

        if (entry.descType === "이동") {
            const travelHours = totalMinutes / 60;
            return {
                normalHours: 0,
                afterHours: 0,
                totalHours: travelHours,
            };
        }

        const normalStart = new Date(`${entry.dateFrom}T08:00:00`);
        const normalEnd = new Date(`${entry.dateFrom}T17:00:00`);
        const lunchStart = new Date(`${entry.dateFrom}T12:00:00`);
        const lunchEnd = new Date(`${entry.dateFrom}T13:00:00`);

        const rawNormalMinutes = getOverlapMinutes(
            start,
            end,
            normalStart,
            normalEnd
        );
        let normalMinutes = rawNormalMinutes;

        const shouldDeductLunch =
            entry.descType === "대기" || (entry.descType === "작업" && !entry.lunch_worked);

        if (shouldDeductLunch) {
            normalMinutes -= getOverlapMinutes(start, end, lunchStart, lunchEnd);
        }

        normalMinutes = Math.max(0, normalMinutes);
        const afterMinutes = Math.max(0, totalMinutes - rawNormalMinutes);

        return {
            normalHours: normalMinutes / 60,
            afterHours: afterMinutes / 60,
            totalHours: (normalMinutes + afterMinutes) / 60,
        };
    };

    /** Meals 구간 계산용: 행에 묶인 엔트리 중 대기(descType 대기) 시간 합계 */
    const getWaitingHoursFromRowSourceEntries = (row: TimesheetRow): number => {
        const total = row.sourceEntries.reduce((sum, entry) => {
            if (entry.descType !== "대기") {
                return sum;
            }
            const asInvoice = {
                ...entry,
                lunch_worked: entry.lunchWorked,
                sourceEntryIds: [entry.id],
                location: entry.location ?? null,
                workLogId: entry.workLogId,
            } as InvoiceTimesheetEntry;
            return sum + classifyWorkingHours(asInvoice).totalHours;
        }, 0);
        return Math.round(total * 10) / 10;
    };

    // 요일 계산 함수
    const getDayOfWeek = (dateString: string): string => {
        const date = new Date(`${dateString}T00:00:00`);
        const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        return days[date.getDay()];
    };

    // 날짜 포맷팅 함수 (DD.MMM)
    const formatDate = (dateString: string): string => {
        const date = new Date(`${dateString}T00:00:00`);
        const day = String(date.getDate()).padStart(2, "0");
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const month = months[date.getMonth()];
        return `${day}.${month}`;
    };

    // 주말/공휴일 체크 함수
    const isWeekend = (dateString: string): boolean => {
        const date = new Date(`${dateString}T00:00:00`);
        const day = date.getDay();
        return day === 0 || day === 6; // 일요일 또는 토요일
    };

    const enumerateDateRange = (startDate: string, endDate: string): string[] => {
        const dates: string[] = [];
        const start = new Date(`${startDate}T00:00:00`);
        const end = new Date(`${endDate}T00:00:00`);

        if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
            return dates;
        }

        const cursor = new Date(start);
        while (cursor <= end) {
            const yyyy = cursor.getFullYear();
            const mm = String(cursor.getMonth() + 1).padStart(2, "0");
            const dd = String(cursor.getDate()).padStart(2, "0");
            dates.push(`${yyyy}-${mm}-${dd}`);
            cursor.setDate(cursor.getDate() + 1);
        }

        return dates;
    };

    const shiftDateByDays = (dateString: string, days: number): string => {
        const date = new Date(`${dateString}T00:00:00`);
        date.setDate(date.getDate() + days);

        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, "0");
        const dd = String(date.getDate()).padStart(2, "0");

        return `${yyyy}-${mm}-${dd}`;
    };

    const fetchPublicHolidays = async (
        year: number,
        monthZeroBased: number
    ): Promise<string[]> => {
        const monthStr = String(monthZeroBased + 1).padStart(2, "0");
        const url = `${HOLIDAY_API_ENDPOINT}?serviceKey=${HOLIDAY_API_KEY}&solYear=${year}&solMonth=${monthStr}&_type=json&numOfRows=100`;
        const response = await fetch(url);
        const data = await response.json();
        const items = data.response?.body?.items?.item;

        if (!items) return [];

        const itemList = Array.isArray(items) ? items : [items];
        return itemList.map((item: { locdate: string | number }) => {
            const dateStr = String(item.locdate);
            return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(
                6,
                8
            )}`;
        });
    };

    const loadHolidayDates = async (
        targetDates: string[]
    ): Promise<Set<string>> => {
        if (targetDates.length === 0) {
            const empty = new Set<string>();
            setHolidayDateSet(empty);
            return empty;
        }

        const uniqueDates = Array.from(new Set(targetDates));
        const yearMonthPairs = Array.from(
            new Set(uniqueDates.map((date) => date.slice(0, 7)))
        );
        const years = Array.from(
            new Set(uniqueDates.map((date) => Number(date.slice(0, 4))))
        );

        try {
            const publicHolidayResults = await Promise.all(
                yearMonthPairs.map(async (pair) => {
                    const [year, month] = pair.split("-").map(Number);
                    return fetchPublicHolidays(year, month - 1);
                })
            );

            const calendarEventsResults = await Promise.all(
                years.map((year) => getCalendarEvents({ year }))
            );

            const holidayKeywords = [
                "휴일",
                "공휴일",
                "대체공휴일",
                "임시공휴일",
                "선거",
            ];

            const merged = new Set<string>();

            publicHolidayResults.flat().forEach((date) => merged.add(date));

            calendarEventsResults.flat().forEach((event) => {
                const title = event.title?.trim() ?? "";
                const isHolidayLikeEvent = holidayKeywords.some((keyword) =>
                    title.includes(keyword)
                );

                if (!isHolidayLikeEvent) return;

                enumerateDateRange(event.start_date, event.end_date).forEach((date) =>
                    merged.add(date)
                );
            });

            setHolidayDateSet(merged);
            return merged;
        } catch (error) {
            console.error("휴일 데이터 로드 실패:", error);
            const empty = new Set<string>();
            setHolidayDateSet(empty);
            return empty;
        }
    };

    // 보고서 데이터 로드 (다중 선택 지원)
    useEffect(() => {
        const loadWorkLogData = async () => {
            if (!workLogIdsParam) {
                return;
            }

            const workLogIds = workLogIdsParam.split(",").map(id => Number(id.trim())).filter(id => !isNaN(id));
            if (workLogIds.length === 0) {
                return;
            }

            const shouldReuseLoadedData =
                loadedWorkLogIdsParamRef.current === workLogIdsParam &&
                workLogDataList.length > 0;

            if (!shouldReuseLoadedData) {
                setLoading(true);
            }
            try {
                let validData: WorkLogFullData[];
                let holidaySetForTimesheet: Set<string>;

                if (shouldReuseLoadedData) {
                    validData = workLogDataList;
                    holidaySetForTimesheet = new Set(holidayDateSet);
                } else {
                    const dataPromises = workLogIds.map((id) => getWorkLogById(id));
                    const results = await Promise.all(dataPromises);

                    validData = [];
                    for (const data of results) {
                        if (!data) {
                            showError("일부 보고서를 찾을 수 없습니다.");
                            continue;
                        }

                        if (data.workLog.order_group !== "ELU") {
                            showError("ELU 보고서만 인보이스를 생성할 수 있습니다.");
                            continue;
                        }

                        validData.push(data);
                    }

                    if (validData.length === 0) {
                        showError("유효한 보고서가 없습니다.");
                        return;
                    }

                    originalEntryPersonsByIdRef.current = Object.fromEntries(
                        validData.flatMap((data) =>
                            data.entries.map((entry) => [
                                entry.id,
                                [...(entry.persons ?? [])],
                            ] as const)
                        )
                    );
                    timesheetEntryEditBaselineByIdRef.current =
                        buildTimesheetEntryEditBaselineMap(validData, {});
                    initialWorkLogSnapshotRef.current = JSON.parse(
                        JSON.stringify(validData)
                    ) as WorkLogFullData[];
                    setWorkLogDataList(validData);
                    invoiceUndoPastRef.current = [];
                    invoiceUndoFutureRef.current = [];
                    setInvoiceUndoRedoCounts({ past: 0, future: 0 });

                    const rawEntriesForHoliday: InvoiceTimesheetEntry[] = validData.flatMap(
                        (data) =>
                            data.entries.map((entry) => ({
                                ...entry,
                                workLogId: data.workLog.id,
                                location: data.workLog.location,
                                sourceEntryIds: [entry.id],
                            }))
                    );
                    const allEntriesForHoliday =
                        mergeContinuousTravelEntries(rawEntriesForHoliday);

                    holidaySetForTimesheet = await loadHolidayDates(
                        allEntriesForHoliday.flatMap((entry) =>
                            enumerateDateRange(entry.dateFrom, entry.dateTo)
                        )
                    );
                    loadedWorkLogIdsParamRef.current = workLogIdsParam;
                }

                // 타임시트 데이터 계산
                const rawEntries: InvoiceTimesheetEntry[] = validData.flatMap(data =>
                    data.entries.map(entry => ({
                        ...entry,
                        workLogId: data.workLog.id,
                        location: data.workLog.location,
                        sourceEntryIds: [entry.id],
                    }))
                );
                const rawEntryById = new Map(
                    rawEntries.map((entry) => [entry.id, entry] as const)
                );
                const allEntries = mergeContinuousTravelEntries(rawEntries);
                const getMergedTravelHoursWithManualOverride = (
                    entry: InvoiceTimesheetEntry
                ): { hours: number; hasManualOverride: boolean } => {
                    const sourceIds =
                        entry.sourceEntryIds.length > 0
                            ? entry.sourceEntryIds
                            : [entry.id];
                    let hasManualOverride = false;
                    let hours = 0;

                    sourceIds.forEach((sourceEntryId) => {
                        const manual = entryManualBillableHours[sourceEntryId];
                        if (manual !== undefined) {
                            hasManualOverride = true;
                            hours += manual;
                            return;
                        }

                        const rawSourceEntry = rawEntryById.get(sourceEntryId);
                        hours += rawSourceEntry
                            ? calculateRawTravelHours(rawSourceEntry)
                            : calculateRawTravelHours(entry);
                    });

                    return {
                        hours: roundHours(hours),
                        hasManualOverride,
                    };
                };

                /** 수동 청구시간이 하나라도 있으면 출장지·override 고정시간보다 우선 */
                const entriesHaveManualBillableTravel = (
                    entries: InvoiceTimesheetEntry[]
                ): boolean =>
                    entries.some((e) => {
                        const ids =
                            e.sourceEntryIds && e.sourceEntryIds.length > 0
                                ? e.sourceEntryIds
                                : [e.id];
                        return ids.some(
                            (id) => entryManualBillableHours[id] !== undefined
                        );
                    });

                // 날짜별로 그룹화
                const entriesByDate = new Map<string, InvoiceTimesheetEntry[]>();
                allEntries.forEach(entry => {
                    if (!entry.dateFrom) return;
                    const adjustedEntry = {
                        ...entry,
                        ...getAdjustedTravelDateTimes(entry),
                    };
                    if (!adjustedEntry.dateFrom || !adjustedEntry.dateTo) return;
                    
                    // 날짜가 넘어가는 경우 분할
                    if (adjustedEntry.dateFrom === adjustedEntry.dateTo) {
                        const startTime = getEntryStartTime(adjustedEntry);
                        const endTime = getEntryEndTime(adjustedEntry);
                        if (
                            startTime === null ||
                            endTime === null ||
                            endTime <= startTime
                        ) {
                            return;
                        }

                        const date = adjustedEntry.dateFrom;
                        if (!entriesByDate.has(date)) {
                            entriesByDate.set(date, []);
                        }
                        entriesByDate.get(date)!.push({
                            ...adjustedEntry,
                        });
                    } else {
                        // 여러 날짜에 걸치는 경우 각 날짜별로 분할
                        const startDate = new Date(`${adjustedEntry.dateFrom}T00:00:00`);
                        const endDate = new Date(`${adjustedEntry.dateTo}T00:00:00`);
                        let currentDate = new Date(startDate);

                        while (currentDate <= endDate) {
                            const dateStr = formatDateKey(currentDate);
                            if (!entriesByDate.has(dateStr)) {
                                entriesByDate.set(dateStr, []);
                            }

                            let timeFrom = adjustedEntry.timeFrom || "00:00";
                            let timeTo = adjustedEntry.timeTo || "24:00";

                            if (
                                dateStr === adjustedEntry.dateFrom &&
                                dateStr !== adjustedEntry.dateTo
                            ) {
                                timeTo = "24:00";
                            } else if (
                                dateStr === adjustedEntry.dateTo &&
                                dateStr !== adjustedEntry.dateFrom
                            ) {
                                timeFrom = "00:00";
                            } else if (
                                dateStr !== adjustedEntry.dateFrom &&
                                dateStr !== adjustedEntry.dateTo
                            ) {
                                timeFrom = "00:00";
                                timeTo = "24:00";
                            }

                            const segmentedEntry: InvoiceTimesheetEntry = {
                                ...adjustedEntry,
                                dateFrom: dateStr,
                                dateTo: dateStr,
                                timeFrom,
                                timeTo,
                            };
                            const segmentStart = getEntryStartTime(segmentedEntry);
                            const segmentEnd = getEntryEndTime(segmentedEntry);

                            if (
                                segmentStart === null ||
                                segmentEnd === null ||
                                segmentEnd <= segmentStart
                            ) {
                                currentDate.setDate(currentDate.getDate() + 1);
                                continue;
                            }

                            entriesByDate.get(dateStr)!.push({
                                ...segmentedEntry,
                            });

                            currentDate.setDate(currentDate.getDate() + 1);
                        }
                    }
                });

                // 날짜별로 타임시트 행 생성
                const rows: TimesheetRow[] = [];
                const sortedDates = Array.from(entriesByDate.keys()).sort();
                const chronologicalEntries = Array.from(entriesByDate.values())
                    .flat()
                    .sort((a, b) => {
                        const aStart =
                            getEntryStartTime(a) ?? Number.MAX_SAFE_INTEGER;
                        const bStart =
                            getEntryStartTime(b) ?? Number.MAX_SAFE_INTEGER;
                        if (aStart !== bStart) return aStart - bStart;
                        const aEnd =
                            getEntryEndTime(a) ?? Number.MAX_SAFE_INTEGER;
                        const bEnd =
                            getEntryEndTime(b) ?? Number.MAX_SAFE_INTEGER;
                        return aEnd - bEnd;
                    });
                const workEntries = chronologicalEntries.filter(
                    (entry) => entry.descType === "작업"
                );
                const workDates = Array.from(
                    new Set(workEntries.map((entry) => entry.dateFrom))
                ).sort();
                const inferWorkPlaceFromTravelSegments = (
                    leadingTravelEntries: InvoiceTimesheetEntry[],
                    trailingTravelEntries: InvoiceTimesheetEntry[]
                ) => {
                    const lastLeadingTravelEntry =
                        leadingTravelEntries[leadingTravelEntries.length - 1];
                    const leadingDestination = lastLeadingTravelEntry
                        ? normalizeLocationName(
                              getFinalDestination(lastLeadingTravelEntry)
                          )
                        : "";
                    if (leadingDestination && leadingDestination !== "자택") {
                        return leadingDestination;
                    }

                    const firstTrailingTravelEntry = trailingTravelEntries[0];
                    const trailingOrigin = firstTrailingTravelEntry
                        ? normalizeLocationName(
                              getTravelEntryOrigin(firstTrailingTravelEntry)
                          )
                        : "";
                    if (trailingOrigin && trailingOrigin !== "자택") {
                        return trailingOrigin;
                    }

                    return "";
                };

                const collectInferredWorkPlacesForPerson = (
                    entries: InvoiceTimesheetEntry[],
                    person: string
                ) => {
                    const personEntries = [...entries]
                        .filter((entry) => (entry.persons ?? []).includes(person))
                        .sort((a, b) => {
                            const aStart =
                                getEntryStartTime(a) ?? Number.MAX_SAFE_INTEGER;
                            const bStart =
                                getEntryStartTime(b) ?? Number.MAX_SAFE_INTEGER;
                            if (aStart !== bStart) return aStart - bStart;
                            const aEnd =
                                getEntryEndTime(a) ?? Number.MAX_SAFE_INTEGER;
                            const bEnd =
                                getEntryEndTime(b) ?? Number.MAX_SAFE_INTEGER;
                            return aEnd - bEnd;
                        });

                    const inferredPlaces = new Set<string>();
                    let index = 0;
                    let leadingTravelEntries: InvoiceTimesheetEntry[] = [];

                    while (
                        index < personEntries.length &&
                        personEntries[index].descType === "이동"
                    ) {
                        leadingTravelEntries.push(personEntries[index]);
                        index += 1;
                    }

                    while (index < personEntries.length) {
                        const anchorEntries: InvoiceTimesheetEntry[] = [];
                        while (
                            index < personEntries.length &&
                            personEntries[index].descType !== "이동"
                        ) {
                            anchorEntries.push(personEntries[index]);
                            index += 1;
                        }

                        if (anchorEntries.length === 0) {
                            break;
                        }

                        const trailingTravelEntries: InvoiceTimesheetEntry[] = [];
                        while (
                            index < personEntries.length &&
                            personEntries[index].descType === "이동"
                        ) {
                            trailingTravelEntries.push(personEntries[index]);
                            index += 1;
                        }

                        const inferredPlace = inferWorkPlaceFromTravelSegments(
                            leadingTravelEntries,
                            trailingTravelEntries
                        );
                        if (inferredPlace) {
                            inferredPlaces.add(inferredPlace);
                        }

                        leadingTravelEntries = trailingTravelEntries;
                    }

                    return inferredPlaces;
                };

                const workLocationsByDate = new Map<
                    string,
                    Map<string, Set<string>>
                >();
                workDates.forEach((date) => {
                    const dayEntries = entriesByDate.get(date) ?? [];
                    const persons = Array.from(
                        new Set(dayEntries.flatMap((entry) => entry.persons ?? []))
                    );
                    const locationsByPerson = new Map<string, Set<string>>();

                    persons.forEach((person) => {
                        const inferredPlaces = collectInferredWorkPlacesForPerson(
                            dayEntries,
                            person
                        );
                        if (inferredPlaces.size > 0) {
                            locationsByPerson.set(person, inferredPlaces);
                        }
                    });

                    workLocationsByDate.set(date, locationsByPerson);
                });
                const roundHours = (value: number): number =>
                    Math.round(value * 10) / 10;
                const formatHoursValue = (value: number): string => {
                    const rounded = roundHours(value);
                    return Number.isInteger(rounded)
                        ? String(rounded)
                        : String(rounded);
                };
                const buildTravelDisplay = (
                    moveHours: number,
                    waitingHours: number
                ): string => {
                    const roundedMove = roundHours(moveHours);
                    const roundedWaiting = roundHours(waitingHours);

                    if (roundedMove > 0 && roundedWaiting > 0) {
                        return `${formatHoursValue(roundedMove)}+${formatHoursValue(roundedWaiting)}`;
                    }

                    if (roundedMove > 0) {
                        return formatHoursValue(roundedMove);
                    }

                    if (roundedWaiting > 0) {
                        return formatHoursValue(roundedWaiting);
                    }

                    return "";
                };

                sortedDates.forEach((date) => {
                    const dayEntries = entriesByDate.get(date)!;
                    if (dayEntries.length === 0) return;

                    const sortedDayEntries = [...dayEntries].sort((a, b) => {
                        const aStart =
                            getEntryStartTime(a) ?? Number.MAX_SAFE_INTEGER;
                        const bStart =
                            getEntryStartTime(b) ?? Number.MAX_SAFE_INTEGER;
                        if (aStart !== bStart) return aStart - bStart;
                        const aEnd =
                            getEntryEndTime(a) ?? Number.MAX_SAFE_INTEGER;
                        const bEnd =
                            getEntryEndTime(b) ?? Number.MAX_SAFE_INTEGER;
                        return aEnd - bEnd;
                    });
                    const dayWorkEntries = sortedDayEntries.filter(
                        (entry) => entry.descType === "작업"
                    );
                    const dayWaitEntries = sortedDayEntries.filter(
                        (entry) => entry.descType === "대기"
                    );
                    // state(holidayDateSet)는 아직 갱신 전일 수 있으므로 방금 로드한 Set 사용
                    const isWeekendDay =
                        isWeekend(date) || holidaySetForTimesheet.has(date);

                    const splitTravelOnlyEntriesByGap = (
                        travelEntries: InvoiceTimesheetEntry[],
                        minimumGapHours: number
                    ) => {
                        if (travelEntries.length <= 1) {
                            return travelEntries.length === 0 ? [] : [travelEntries];
                        }

                        const sortedEntries = [...travelEntries].sort((a, b) => {
                            const aStart =
                                getEntryStartTime(a) ?? Number.MAX_SAFE_INTEGER;
                            const bStart =
                                getEntryStartTime(b) ?? Number.MAX_SAFE_INTEGER;
                            if (aStart !== bStart) {
                                return aStart - bStart;
                            }
                            const aEnd =
                                getEntryEndTime(a) ?? Number.MAX_SAFE_INTEGER;
                            const bEnd =
                                getEntryEndTime(b) ?? Number.MAX_SAFE_INTEGER;
                            return aEnd - bEnd;
                        });

                        const groups: InvoiceTimesheetEntry[][] = [];
                        let currentGroup: InvoiceTimesheetEntry[] = [];
                        const minimumGapMs = minimumGapHours * 60 * 60 * 1000;

                        sortedEntries.forEach((entry, index) => {
                            if (index === 0) {
                                currentGroup = [entry];
                                return;
                            }

                            const previousEntry = sortedEntries[index - 1];
                            const previousEnd = getEntryEndTime(previousEntry);
                            const currentStart = getEntryStartTime(entry);
                            const shouldSplit =
                                previousEnd !== null &&
                                currentStart !== null &&
                                currentStart - previousEnd >= minimumGapMs;

                            if (shouldSplit) {
                                groups.push(currentGroup);
                                currentGroup = [entry];
                                return;
                            }

                            currentGroup.push(entry);
                        });

                        if (currentGroup.length > 0) {
                            groups.push(currentGroup);
                        }

                        return groups;
                    };

                    const summarizeTravelOnlyEntriesForPerson = (
                        person: string,
                        entries: InvoiceTimesheetEntry[]
                    ) => {
                        if (entries.length === 0) {
                            return {
                                hours: 0,
                                start: null as string | null,
                                end: null as string | null,
                            };
                        }

                        const lastEntry = entries[entries.length - 1];
                        const fixedHours = getHomeTravelHours(lastEntry.location) ?? 0;
                        const hasHome = entries.some((entry) => hasHomeInTravel(entry));
                        const earliest =
                            entries
                                .map((entry) => entry.timeFrom)
                                .filter((value): value is string => Boolean(value))
                                .sort()[0] ?? null;
                        const latest =
                            entries
                                .map((entry) => entry.timeTo)
                                .filter((value): value is string => Boolean(value))
                                .sort();
                        const latestValue =
                            latest.length > 0 ? latest[latest.length - 1] : null;

                        if (entriesHaveManualBillableTravel(entries)) {
                            const mixedHours = entries.reduce(
                                (acc, entry) => {
                                    const result =
                                        getMergedTravelHoursWithManualOverride(
                                            entry
                                        );
                                    return {
                                        hours: acc.hours + result.hours,
                                        hasManualOverride:
                                            acc.hasManualOverride ||
                                            result.hasManualOverride,
                                    };
                                },
                                { hours: 0, hasManualOverride: false }
                            );
                            return {
                                hours: roundHours(mixedHours.hours),
                                start: earliest,
                                end: latestValue,
                            };
                        }

                        const override = getLatestTravelChargeOverrideForEntries(
                            entries,
                            person
                        );
                        const hasAdjustedFixedHomeWindow = entries.some(
                            (entry) => entry.fixedHomeTravelWindowApplied
                        );

                        if (override?.target === "lodging") {
                            return {
                                hours: 1,
                                start: earliest,
                                end: latestValue,
                            };
                        }

                        if (
                            override?.target === "home" &&
                            fixedHours > 0 &&
                            !hasAdjustedFixedHomeWindow
                        ) {
                            return {
                                hours: fixedHours,
                                start: earliest,
                                end: latestValue,
                            };
                        }

                        if (
                            hasHome &&
                            fixedHours > 0 &&
                            !hasAdjustedFixedHomeWindow
                        ) {
                            return {
                                hours: fixedHours,
                                start: earliest,
                                end: latestValue,
                            };
                        }

                        const mixedHours = entries.reduce(
                            (acc, entry) => {
                                const result =
                                    getMergedTravelHoursWithManualOverride(entry);
                                return {
                                    hours: acc.hours + result.hours,
                                    hasManualOverride:
                                        acc.hasManualOverride ||
                                        result.hasManualOverride,
                                };
                            },
                            { hours: 0, hasManualOverride: false }
                        );

                        return {
                            hours: roundHours(mixedHours.hours),
                            start: earliest,
                            end: latestValue,
                        };
                    };

                    const buildPureTravelRow = (
                        person: string,
                        entries: InvoiceTimesheetEntry[]
                    ): TimesheetRow | null => {
                        const travel = summarizeTravelOnlyEntriesForPerson(
                            person,
                            entries
                        );

                        if (travel.hours <= 0 || !travel.start || !travel.end) {
                            return null;
                        }

                        const sourceEntries = Array.from(
                            new Set(entries.flatMap((entry) => entry.sourceEntryIds))
                        )
                            .map((entryId) => rawEntryById.get(entryId))
                            .filter(
                                (
                                    entry
                                ): entry is InvoiceTimesheetEntry => Boolean(entry)
                            )
                            .sort((a, b) => {
                                const aStart =
                                    new Date(
                                        `${a.dateFrom}T${a.timeFrom ?? "00:00"}`
                                    ).getTime();
                                const bStart =
                                    new Date(
                                        `${b.dateFrom}T${b.timeFrom ?? "00:00"}`
                                    ).getTime();
                                return aStart - bStart;
                            })
                            .map((entry) => ({
                                id: entry.id,
                                workLogId: entry.workLogId,
                                dateFrom: entry.dateFrom,
                                timeFrom: entry.timeFrom ?? "",
                                dateTo: entry.dateTo,
                                timeTo: entry.timeTo ?? "",
                                descType: entry.descType,
                                details: entry.details,
                                persons: entry.persons,
                                note: entry.note,
                                moveFrom: entry.moveFrom,
                                moveTo: entry.moveTo,
                                location: entry.location,
                                lunchWorked: entry.lunch_worked,
                                clientDuplicated: entry.clientDuplicated === true,
                            }));

                        return {
                            rowId: `${date}-${person}-${travel.start}-${travel.end}`,
                            date,
                            day: getDayOfWeek(date),
                            dateFormatted: formatDate(date),
                            timeFrom: travel.start.split(":")[0],
                            timeTo: travel.end.split(":")[0],
                            totalHours: roundHours(travel.hours),
                            weekdayNormal: 0,
                            weekdayAfter: 0,
                            weekendNormal: 0,
                            weekendAfter: 0,
                            travelWeekday: isWeekendDay ? 0 : travel.hours,
                            travelWeekend: isWeekendDay ? travel.hours : 0,
                            travelWeekdayDisplay: isWeekendDay
                                ? ""
                                : buildTravelDisplay(travel.hours, 0),
                            travelWeekendDisplay: isWeekendDay
                                ? buildTravelDisplay(travel.hours, 0)
                                : "",
                            description: person,
                            sourceEntries,
                            chargeWindowStart: travel.start,
                            chargeWindowEnd: travel.end,
                        };
                    };

                    if (dayWorkEntries.length === 0 && dayWaitEntries.length === 0) {
                        const allDayPersons = Array.from(
                            new Set(
                                sortedDayEntries.flatMap((entry) => entry.persons ?? [])
                            )
                        ).sort();

                        allDayPersons.forEach((person) => {
                            const personTravelEntries = sortedDayEntries.filter(
                                (entry) =>
                                    entry.descType === "이동" &&
                                    (entry.persons ?? []).includes(person)
                            );

                            splitTravelOnlyEntriesByGap(personTravelEntries, 2).forEach(
                                (travelEntries) => {
                                    const row = buildPureTravelRow(
                                        person,
                                        travelEntries
                                    );
                                    if (row) {
                                        rows.push(row);
                                    }
                                }
                            );
                        });
                        return;
                    }

                    const anchorEntriesForDayBounds =
                        dayWorkEntries.length > 0 ? dayWorkEntries : dayWaitEntries;
                    const firstAnchorStart = Math.min(
                        ...anchorEntriesForDayBounds
                            .map((entry) => getEntryStartTime(entry))
                            .filter((value): value is number => value !== null)
                    );
                    const lastAnchorEnd = Math.max(
                        ...anchorEntriesForDayBounds
                            .map((entry) => getEntryEndTime(entry))
                            .filter((value): value is number => value !== null)
                    );
                    const firstWorkTime = formatTimeHHMM(new Date(firstAnchorStart));
                    const lastWorkTime = formatTimeHHMM(new Date(lastAnchorEnd));

                    const waitPersonsThisDate = new Set<string>();
                    sortedDayEntries.forEach((entry) => {
                        if (entry.descType !== "대기") {
                            return;
                        }
                        entry.persons?.forEach((person) =>
                            waitPersonsThisDate.add(person)
                        );
                    });
                    /** 작업/대기 엔트리에만 적힌 인원도 포함 (이동 구간으로 출퇴근지가 비어 있어도 타임시트 비고에 표시) */
                    const personsOnWorkOrWaitEntries = Array.from(
                        new Set(
                            sortedDayEntries
                                .filter(
                                    (entry) =>
                                        entry.descType === "작업" ||
                                        entry.descType === "대기"
                                )
                                .flatMap((entry) => entry.persons ?? [])
                        )
                    );
                    const currentWorkPersons = Array.from(
                        new Set([
                            ...Array.from(
                                workLocationsByDate.get(date)?.keys() ?? []
                            ),
                            ...waitPersonsThisDate,
                            ...personsOnWorkOrWaitEntries,
                        ])
                    ).sort();
                    const previousDate = shiftDateByDays(date, -1);
                    const nextDate = shiftDateByDays(date, 1);
                    const previousWorkLocations =
                        workLocationsByDate.get(previousDate) ??
                        new Map<string, Set<string>>();
                    const nextWorkLocations =
                        workLocationsByDate.get(nextDate) ??
                        new Map<string, Set<string>>();
                    const hasNextCalendarWorkDate = workLocationsByDate.has(nextDate);

                    const doesWorkContextMatchBlockLocation = (
                        person: string,
                        beforeTravelEntries: InvoiceTimesheetEntry[],
                        afterTravelEntries: InvoiceTimesheetEntry[],
                        workContext: Map<string, Set<string>>
                    ) => {
                        const workPlaces = workContext.get(person);
                        if (!workPlaces || workPlaces.size === 0) {
                            return false;
                        }

                        const blockWorkPlace = inferWorkPlaceFromTravelSegments(
                            beforeTravelEntries,
                            afterTravelEntries
                        );
                        if (!blockWorkPlace) {
                            return false;
                        }

                        return workPlaces.has(blockWorkPlace);
                    };

                    const getWorkingMetricsForEntries = (
                        entries: InvoiceTimesheetEntry[]
                    ) => {
                        let normal = 0;
                        let after = 0;

                        entries.forEach((entry) => {
                            if (entry.descType !== "작업") {
                                return;
                            }

                            const manual = entryManualBillableHours[entry.id];
                            if (manual !== undefined) {
                                normal += manual;
                                return;
                            }

                            const classified = classifyWorkingHours(entry);
                            normal += classified.normalHours;
                            after += classified.afterHours;
                        });

                        return {
                            normal: roundHours(normal),
                            after: roundHours(after),
                            total: roundHours(normal + after),
                        };
                    };

                    const getWaitingHoursForEntries = (
                        entries: InvoiceTimesheetEntry[]
                    ) => {
                        let total = 0;

                        entries.forEach((entry) => {
                            if (entry.descType !== "대기") {
                                return;
                            }

                            const manual = entryManualBillableHours[entry.id];
                            if (manual !== undefined) {
                                total += manual;
                                return;
                            }

                            total += classifyWorkingHours(entry).totalHours;
                        });

                        return roundHours(total);
                    };

                    const getBlockSpanForEntries = (
                        entries: InvoiceTimesheetEntry[]
                    ) => {
                        let earliest: string | null = null;
                        let latest: string | null = null;

                        entries.forEach((entry) => {
                            if (
                                entry.timeFrom &&
                                (!earliest || entry.timeFrom < earliest)
                            ) {
                                earliest = entry.timeFrom;
                            }

                            if (
                                entry.timeTo &&
                                (!latest || entry.timeTo > latest)
                            ) {
                                latest = entry.timeTo;
                            }
                        });

                        return {
                            earliest: earliest ?? firstWorkTime,
                            latest: latest ?? lastWorkTime,
                        };
                    };

                    const summarizeTravelEntries = (
                        entries: InvoiceTimesheetEntry[],
                        fallbackLabel: string,
                        useFixedHomeHours: boolean,
                        person?: string
                    ) => {
                        if (entries.length === 0) {
                            return {
                                kind: "none",
                                hours: 0,
                                start: null as string | null,
                                end: null as string | null,
                                label: "",
                            };
                        }

                        const lastEntry = entries[entries.length - 1];
                        const fixedHours =
                            getHomeTravelHours(lastEntry.location) ?? 0;
                        const hasHome = entries.some((entry) =>
                            hasHomeInTravel(entry)
                        );
                        const earliest =
                            entries
                                .map((entry) => entry.timeFrom)
                                .filter((value): value is string => Boolean(value))
                                .sort()[0] ?? null;
                        const latest =
                            entries
                                .map((entry) => entry.timeTo)
                                .filter((value): value is string => Boolean(value))
                                .sort();
                        const latestValue =
                            latest.length > 0 ? latest[latest.length - 1] : null;
                        const manualOrAutoMixedHours = (() => {
                            let hasManualOverride = false;
                            let sum = 0;
                            for (const e of entries) {
                                const result =
                                    getMergedTravelHoursWithManualOverride(e);
                                hasManualOverride =
                                    hasManualOverride || result.hasManualOverride;
                                sum += result.hours;
                            }
                            return hasManualOverride ? roundHours(sum) : null;
                        })();

                        if (manualOrAutoMixedHours !== null) {
                            const destination = getFinalDestination(lastEntry);
                            return {
                                kind: fallbackLabel,
                                hours: manualOrAutoMixedHours,
                                start: earliest,
                                end: latestValue,
                                label: destination || fallbackLabel,
                            };
                        }

                        const override =
                            person !== undefined
                                ? getLatestTravelChargeOverrideForEntries(entries, person)
                                : null;

                        if (override?.target === "lodging") {
                            return {
                                kind: "continued",
                                hours: 1,
                                start: earliest,
                                end: latestValue,
                                label: fallbackLabel,
                            };
                        }

                        const hasAdjustedFixedHomeWindow = entries.some(
                            (entry) => entry.fixedHomeTravelWindowApplied
                        );

                        if (
                            override?.target === "home" &&
                            fixedHours > 0 &&
                            !hasAdjustedFixedHomeWindow
                        ) {
                            return {
                                kind: `${fallbackLabel}-home`,
                                hours: fixedHours,
                                start: earliest,
                                end: latestValue,
                                label: fallbackLabel,
                            };
                        }

                        if (
                            useFixedHomeHours &&
                            hasHome &&
                            fixedHours > 0 &&
                            !hasAdjustedFixedHomeWindow
                        ) {
                            return {
                                kind: `${fallbackLabel}-home`,
                                hours: fixedHours,
                                start: earliest,
                                end: latestValue,
                                label: fallbackLabel,
                            };
                        }
                        const hours = entries.reduce(
                            (sum, entry) => sum + calculateRawTravelHours(entry),
                            0
                        );
                        const destination = getFinalDestination(lastEntry);

                        return {
                            kind: fallbackLabel,
                            hours: roundHours(hours),
                            start: earliest,
                            end: latestValue,
                            label: destination || "최종 철수",
                        };
                    };

                    const getPersonBlocks = (person: string) => {
                        const personEntries = sortedDayEntries.filter((entry) =>
                            (entry.persons ?? []).includes(person)
                        );
                        type PersonBlock = {
                            workEntries: InvoiceTimesheetEntry[];
                            beforeTravelEntries: InvoiceTimesheetEntry[];
                            afterTravelEntries: InvoiceTimesheetEntry[];
                        };
                        const blocks: PersonBlock[] = [];

                        let currentBlock: PersonBlock | null = null;
                        let interBlockTravelEntries: InvoiceTimesheetEntry[] = [];

                        personEntries.forEach((entry) => {
                            if (entry.descType === "이동") {
                                interBlockTravelEntries.push(entry);
                                return;
                            }

                            if (
                                currentBlock &&
                                interBlockTravelEntries.length === 0
                            ) {
                                currentBlock.workEntries.push(entry);
                                return;
                            }

                            if (!currentBlock) {
                                currentBlock = {
                                    workEntries: [entry],
                                    beforeTravelEntries:
                                        interBlockTravelEntries.slice(),
                                    afterTravelEntries: [],
                                };
                                interBlockTravelEntries = [];
                                return;
                            }

                            const beforeTravelEntriesForNext =
                                interBlockTravelEntries.filter((travelEntry) =>
                                    isDestinationWorkPlace(travelEntry)
                                );
                            const currentAfterTravelEntries =
                                interBlockTravelEntries.filter(
                                    (travelEntry) =>
                                        !isDestinationWorkPlace(travelEntry)
                                );

                            currentBlock.afterTravelEntries =
                                currentAfterTravelEntries;
                            blocks.push(currentBlock);

                            currentBlock = {
                                workEntries: [entry],
                                beforeTravelEntries: beforeTravelEntriesForNext,
                                afterTravelEntries: [],
                            };
                            interBlockTravelEntries = [];
                        });

                        if (currentBlock) {
                            const finalizedSource = currentBlock as PersonBlock;
                            const finalizedBlock = {
                                workEntries: finalizedSource.workEntries,
                                beforeTravelEntries:
                                    finalizedSource.beforeTravelEntries,
                                afterTravelEntries:
                                    interBlockTravelEntries.slice(),
                            };
                            blocks.push(finalizedBlock);
                        }

                        return blocks;
                    };

                    const getBeforeTravelSummary = (
                        person: string,
                        blockIndex: number,
                        beforeTravelEntries: InvoiceTimesheetEntry[],
                        afterTravelEntries: InvoiceTimesheetEntry[],
                        blockStartTime: string
                    ) => {
                        if (beforeTravelEntries.length === 0) {
                            return {
                                kind: "none",
                                hours: 0,
                                start: null as string | null,
                                end: null as string | null,
                                label: "",
                            };
                        }

                        if (entriesHaveManualBillableTravel(beforeTravelEntries)) {
                            if (blockIndex === 0) {
                                return summarizeTravelEntries(
                                    beforeTravelEntries,
                                    "최초투입",
                                    false,
                                    person
                                );
                            }
                            return summarizeTravelEntries(
                                beforeTravelEntries,
                                "이동",
                                true,
                                person
                            );
                        }

                        const override = getLatestTravelChargeOverrideForEntries(
                            beforeTravelEntries,
                            person
                        );
                        const overrideFixedHours =
                            getHomeTravelHours(beforeTravelEntries[0].location) ?? 0;

                        if (override?.target === "lodging") {
                            return {
                                kind: "continued",
                                hours: 1,
                                start: shiftTimeByHours(date, blockStartTime, -1),
                                end: blockStartTime,
                                label: blockIndex === 0 ? "최초투입" : "이동",
                            };
                        }

                        if (override?.target === "home" && overrideFixedHours > 0) {
                            return {
                                kind: blockIndex === 0 ? "initial-home" : "이동-home",
                                hours: overrideFixedHours,
                                start: shiftTimeByHours(
                                    date,
                                    blockStartTime,
                                    -overrideFixedHours
                                ),
                                end: blockStartTime,
                                label: blockIndex === 0 ? "최초투입" : "이동",
                            };
                        }

                        if (blockIndex === 0) {
                            if (
                                !doesWorkContextMatchBlockLocation(
                                    person,
                                    beforeTravelEntries,
                                    afterTravelEntries,
                                    previousWorkLocations
                                )
                            ) {
                                const fixedHours =
                                    getHomeTravelHours(
                                        beforeTravelEntries[0].location
                                    ) ?? 0;
                                const hasHome = beforeTravelEntries.some((entry) =>
                                    hasHomeInTravel(entry)
                                );

                                if (hasHome && fixedHours > 0) {
                                    return {
                                        kind: "initial-home",
                                        hours: fixedHours,
                                        start: shiftTimeByHours(
                                            date,
                                            blockStartTime,
                                            -fixedHours
                                        ),
                                        end: blockStartTime,
                                        label: "최초투입",
                                    };
                                }

                                return summarizeTravelEntries(
                                    beforeTravelEntries,
                                    "최초투입",
                                    false,
                                    person
                                );
                            }

                            return {
                                kind: "continued",
                                hours: 1,
                                start: shiftTimeByHours(date, blockStartTime, -1),
                                end: blockStartTime,
                                label: "작업지속",
                            };
                        }

                        return summarizeTravelEntries(
                            beforeTravelEntries,
                            "이동",
                            true,
                            person
                        );
                    };

                    const getAfterTravelSummary = (
                        person: string,
                        blockIndex: number,
                        totalBlocks: number,
                        beforeTravelEntries: InvoiceTimesheetEntry[],
                        afterTravelEntries: InvoiceTimesheetEntry[],
                        blockEndTime: string
                    ) => {
                        if (afterTravelEntries.length === 0) {
                            return {
                                kind: "none",
                                hours: 0,
                                start: null as string | null,
                                end: null as string | null,
                                label: "",
                            };
                        }

                        if (entriesHaveManualBillableTravel(afterTravelEntries)) {
                            if (blockIndex < totalBlocks - 1) {
                                return summarizeTravelEntries(
                                    afterTravelEntries,
                                    "이동",
                                    true,
                                    person
                                );
                            }
                            return summarizeTravelEntries(
                                afterTravelEntries,
                                "최종 철수",
                                true,
                                person
                            );
                        }

                        const override = getLatestTravelChargeOverrideForEntries(
                            afterTravelEntries,
                            person
                        );
                        const overrideFixedHours =
                            getHomeTravelHours(afterTravelEntries[0].location) ?? 0;

                        if (override?.target === "lodging") {
                            return {
                                kind: "continued",
                                hours: 1,
                                start: blockEndTime,
                                end: shiftTimeByHours(date, blockEndTime, 1),
                                label: blockIndex < totalBlocks - 1 ? "이동" : "최종 철수",
                            };
                        }

                        if (override?.target === "home" && overrideFixedHours > 0) {
                            return {
                                kind:
                                    blockIndex < totalBlocks - 1
                                        ? "이동-home"
                                        : "최종 철수-home",
                                hours: overrideFixedHours,
                                start: blockEndTime,
                                end: shiftTimeByHours(
                                    date,
                                    blockEndTime,
                                    overrideFixedHours
                                ),
                                label: blockIndex < totalBlocks - 1 ? "이동" : "최종 철수",
                            };
                        }

                        if (blockIndex < totalBlocks - 1) {
                            return summarizeTravelEntries(
                                afterTravelEntries,
                                "이동",
                                true,
                                person
                            );
                        }

                        if (
                            hasNextCalendarWorkDate &&
                            doesWorkContextMatchBlockLocation(
                                person,
                                beforeTravelEntries,
                                afterTravelEntries,
                                nextWorkLocations
                            )
                        ) {
                            const start = afterTravelEntries[0].timeFrom ?? blockEndTime;
                            return {
                                kind: "continued",
                                hours: 1,
                                start,
                                end: shiftTimeByHours(date, start, 1),
                                label: "작업지속",
                            };
                        }

                        return summarizeTravelEntries(
                            afterTravelEntries,
                            "최종 철수",
                            true,
                            person
                        );
                    };

                    type PersonDayRow = {
                        person: string;
                        rowKey: string;
                        priority: number;
                        sourceEntryIds: number[];
                        timeFrom: string;
                        timeTo: string;
                        totalHours: number;
                        weekdayNormal: number;
                        weekdayAfter: number;
                        weekendNormal: number;
                        weekendAfter: number;
                        travelWeekday: number;
                        travelWeekend: number;
                        travelWeekdayDisplay: string;
                        travelWeekendDisplay: string;
                        label: string;
                        chargeWindowStart?: string;
                        chargeWindowEnd?: string;
                    };

                    const splitFirstBlockLeadingTravelEntries = (
                        beforeTravelEntries: InvoiceTimesheetEntry[]
                    ) => {
                        const firstInboundTravelIndex = beforeTravelEntries.findIndex(
                            (entry) => isDestinationWorkPlace(entry)
                        );

                        if (firstInboundTravelIndex <= 0) {
                            return {
                                detachedLeadingEntries:
                                    [] as InvoiceTimesheetEntry[],
                                effectiveBeforeTravelEntries: beforeTravelEntries,
                            };
                        }

                        return {
                            detachedLeadingEntries: beforeTravelEntries.slice(
                                0,
                                firstInboundTravelIndex
                            ),
                            effectiveBeforeTravelEntries:
                                beforeTravelEntries.slice(firstInboundTravelIndex),
                        };
                    };

                    const splitTravelEntriesByGap = (
                        travelEntries: InvoiceTimesheetEntry[],
                        minimumGapHours: number
                    ) => {
                        if (travelEntries.length <= 1) {
                            return travelEntries.length === 0 ? [] : [travelEntries];
                        }

                        const sortedEntries = [...travelEntries].sort((a, b) => {
                            const aStart =
                                getEntryStartTime(a) ?? Number.MAX_SAFE_INTEGER;
                            const bStart =
                                getEntryStartTime(b) ?? Number.MAX_SAFE_INTEGER;
                            if (aStart !== bStart) {
                                return aStart - bStart;
                            }
                            const aEnd =
                                getEntryEndTime(a) ?? Number.MAX_SAFE_INTEGER;
                            const bEnd =
                                getEntryEndTime(b) ?? Number.MAX_SAFE_INTEGER;
                            return aEnd - bEnd;
                        });

                        const groups: InvoiceTimesheetEntry[][] = [];
                        let currentGroup: InvoiceTimesheetEntry[] = [];
                        const minimumGapMs = minimumGapHours * 60 * 60 * 1000;

                        sortedEntries.forEach((entry, index) => {
                            if (index === 0) {
                                currentGroup = [entry];
                                return;
                            }

                            const previousEntry = sortedEntries[index - 1];
                            const previousEnd = getEntryEndTime(previousEntry);
                            const currentStart = getEntryStartTime(entry);
                            const shouldSplit =
                                previousEnd !== null &&
                                currentStart !== null &&
                                currentStart - previousEnd >= minimumGapMs;

                            if (shouldSplit) {
                                groups.push(currentGroup);
                                currentGroup = [entry];
                                return;
                            }

                            currentGroup.push(entry);
                        });

                        if (currentGroup.length > 0) {
                            groups.push(currentGroup);
                        }

                        return groups;
                    };

                    const buildTravelOnlyRow = (
                        person: string,
                        entries: InvoiceTimesheetEntry[]
                    ): PersonDayRow | null => {
                        const moveEntries = entries.filter(
                            (entry) => entry.descType === "이동"
                        );
                        const travel = summarizeTravelEntries(
                            moveEntries,
                            "최종 철수",
                            true,
                            person
                        );

                        if (
                            moveEntries.length === 0 ||
                            travel.hours <= 0 ||
                            !travel.start ||
                            !travel.end
                        ) {
                            return null;
                        }

                        return {
                            person,
                            rowKey: [
                                "travel-only",
                                travel.kind,
                                travel.hours,
                                travel.start,
                                travel.end,
                            ].join("|"),
                            priority: -1,
                            sourceEntryIds: Array.from(
                                new Set(entries.flatMap((entry) => entry.sourceEntryIds))
                            ),
                            timeFrom: travel.start.split(":")[0],
                            timeTo: travel.end.split(":")[0],
                            totalHours: roundHours(travel.hours),
                            weekdayNormal: 0,
                            weekdayAfter: 0,
                            weekendNormal: 0,
                            weekendAfter: 0,
                            travelWeekday: isWeekendDay ? 0 : travel.hours,
                            travelWeekend: isWeekendDay ? travel.hours : 0,
                            travelWeekdayDisplay: isWeekendDay
                                ? ""
                                : buildTravelDisplay(travel.hours, 0),
                            travelWeekendDisplay: isWeekendDay
                                ? buildTravelDisplay(travel.hours, 0)
                                : "",
                            label: "",
                            chargeWindowStart: travel.start,
                            chargeWindowEnd: travel.end,
                        };
                    };

                    const currentWorkPersonSet = new Set(currentWorkPersons);
                    const allDayPersons = Array.from(
                        new Set(
                            sortedDayEntries.flatMap((entry) => entry.persons ?? [])
                        )
                    ).sort();

                    const travelOnlyRows: PersonDayRow[] = allDayPersons.flatMap(
                        (person) => {
                            if (currentWorkPersonSet.has(person)) {
                                return [];
                            }

                            const personEntries = sortedDayEntries.filter((entry) =>
                                (entry.persons ?? []).includes(person)
                            );

                            const row = buildTravelOnlyRow(person, personEntries);
                            return row ? [row] : [];
                        }
                    );

                    const personRows: PersonDayRow[] = [
                        ...travelOnlyRows,
                        ...currentWorkPersons.flatMap((person) => {
                            const blocks = getPersonBlocks(person);
                            const firstBlock = blocks[0] ?? null;
                            const firstBlockLeadingTravel =
                                firstBlock === null
                                    ? {
                                          detachedLeadingEntries:
                                              [] as InvoiceTimesheetEntry[],
                                          effectiveBeforeTravelEntries:
                                              [] as InvoiceTimesheetEntry[],
                                      }
                                    : splitFirstBlockLeadingTravelEntries(
                                          firstBlock.beforeTravelEntries
                                      );
                            const detachedLeadingTravelRow =
                                firstBlockLeadingTravel.detachedLeadingEntries
                                    .length > 0
                                    ? buildTravelOnlyRow(
                                          person,
                                          firstBlockLeadingTravel.detachedLeadingEntries
                                      )
                                    : null;

                            return [
                                ...(detachedLeadingTravelRow
                                    ? [detachedLeadingTravelRow]
                                    : []),
                                ...blocks.flatMap((block, blockIndex) => {
                                    const afterTravelGroups =
                                        blockIndex === blocks.length - 1
                                            ? splitTravelEntriesByGap(
                                                  block.afterTravelEntries,
                                                  2
                                              )
                                            : [block.afterTravelEntries];
                                    const effectiveAfterTravelEntries =
                                        afterTravelGroups[0] ?? [];
                                    const detachedTrailingTravelRows =
                                        afterTravelGroups
                                            .slice(1)
                                            .map((entries) =>
                                                buildTravelOnlyRow(person, entries)
                                            )
                                            .filter(
                                                (row): row is PersonDayRow =>
                                                    Boolean(row)
                                            );
                                    const effectiveBeforeTravelEntries =
                                        blockIndex === 0
                                            ? firstBlockLeadingTravel
                                                  .effectiveBeforeTravelEntries
                                            : block.beforeTravelEntries;
                                const working = getWorkingMetricsForEntries(
                                    block.workEntries
                                );
                                const waitingHours = getWaitingHoursForEntries(
                                    block.workEntries
                                );
                                const blockSpan = getBlockSpanForEntries(
                                    block.workEntries
                                );
                                const beforeTravel = getBeforeTravelSummary(
                                    person,
                                    blockIndex,
                                    effectiveBeforeTravelEntries,
                                    effectiveAfterTravelEntries,
                                    blockSpan.earliest
                                );
                                const afterTravel = getAfterTravelSummary(
                                    person,
                                    blockIndex,
                                    blocks.length,
                                    effectiveBeforeTravelEntries,
                                    effectiveAfterTravelEntries,
                                    blockSpan.latest
                                );

                                const gangdongFactory = normalizeLocationName(
                                    "강동동 공장"
                                );
                                const lastBeforeTravelEntry =
                                    effectiveBeforeTravelEntries.length > 0
                                        ? effectiveBeforeTravelEntries[
                                              effectiveBeforeTravelEntries.length - 1
                                          ]
                                        : null;
                                const firstAfterTravelEntry =
                                    effectiveAfterTravelEntries.length > 0
                                        ? effectiveAfterTravelEntries[0]
                                        : null;
                                const factoryWrapsWorkBlock =
                                    lastBeforeTravelEntry &&
                                    firstAfterTravelEntry &&
                                    normalizeLocationName(
                                        getFinalDestination(lastBeforeTravelEntry)
                                    ) === gangdongFactory &&
                                    normalizeLocationName(
                                        getTravelEntryOrigin(firstAfterTravelEntry)
                                    ) === gangdongFactory;

                                const beforeMoveHours = factoryWrapsWorkBlock
                                    ? 0
                                    : beforeTravel.hours;
                                const afterMoveHours = factoryWrapsWorkBlock
                                    ? 0
                                    : afterTravel.hours;

                                const travelHours = roundHours(
                                    beforeMoveHours +
                                        afterMoveHours +
                                        waitingHours
                                );
                                const moveTravelHours = roundHours(
                                    beforeMoveHours + afterMoveHours
                                );
                                const timeFrom =
                                    [
                                        beforeTravel.start,
                                        blockSpan.earliest,
                                        afterTravel.start,
                                    ]
                                        .filter(
                                            (value): value is string =>
                                                Boolean(value)
                                        )
                                        .sort()[0] ?? blockSpan.earliest;
                                const timeTo =
                                    (() => {
                                        const candidates = [
                                            blockSpan.latest,
                                            beforeTravel.end,
                                            afterTravel.end,
                                        ]
                                            .filter(
                                                (value): value is string =>
                                                    Boolean(value)
                                            )
                                            .sort();

                                        return candidates.length > 0
                                            ? candidates[candidates.length - 1]
                                            : blockSpan.latest;
                                    })();
                                const chargedStartCandidates = [
                                    beforeMoveHours > 0 ? beforeTravel.start : null,
                                    working.total > 0 || waitingHours > 0
                                        ? blockSpan.earliest
                                        : null,
                                    afterMoveHours > 0 ? afterTravel.start : null,
                                ].filter(
                                    (value): value is string => Boolean(value)
                                );
                                const chargedEndCandidates = [
                                    beforeMoveHours > 0 ? beforeTravel.end : null,
                                    working.total > 0 || waitingHours > 0
                                        ? blockSpan.latest
                                        : null,
                                    afterMoveHours > 0 ? afterTravel.end : null,
                                ].filter(
                                    (value): value is string => Boolean(value)
                                );
                                const chargeWindowStart =
                                    chargedStartCandidates.sort()[0] ?? timeFrom;
                                const chargeWindowEnd =
                                    chargedEndCandidates.sort()[
                                        chargedEndCandidates.length - 1
                                    ] ?? timeTo;
                                const label =
                                    afterTravel.kind.startsWith("final")
                                        ? afterTravel.label
                                        : beforeTravel.kind.startsWith("initial")
                                          ? beforeTravel.label
                                          : "";
                                const priority =
                                    blockIndex === 0
                                        ? 0
                                        : afterTravel.kind.startsWith("final")
                                          ? 2
                                          : 1;

                                    const blockRow: PersonDayRow = {
                                        person,
                                        rowKey: [
                                            blockIndex,
                                            beforeTravel.kind,
                                            beforeMoveHours,
                                            afterTravel.kind,
                                            afterMoveHours,
                                            working.normal,
                                            working.after,
                                            timeFrom,
                                            timeTo,
                                        ].join("|"),
                                        priority,
                                        sourceEntryIds: Array.from(
                                            new Set(
                                                [
                                                    ...effectiveBeforeTravelEntries,
                                                    ...block.workEntries,
                                                    ...effectiveAfterTravelEntries,
                                                ].flatMap(
                                                    (entry) => entry.sourceEntryIds
                                                )
                                            )
                                        ),
                                        timeFrom: timeFrom.split(":")[0],
                                        timeTo: timeTo.split(":")[0],
                                        totalHours: roundHours(
                                            working.total + travelHours
                                        ),
                                        weekdayNormal: isWeekendDay
                                            ? 0
                                            : working.normal,
                                        weekdayAfter: isWeekendDay
                                            ? 0
                                            : working.after,
                                        weekendNormal: isWeekendDay
                                            ? working.normal
                                            : 0,
                                        weekendAfter: isWeekendDay
                                            ? working.after
                                            : 0,
                                        travelWeekday: isWeekendDay ? 0 : travelHours,
                                        travelWeekend: isWeekendDay ? travelHours : 0,
                                        travelWeekdayDisplay: isWeekendDay
                                            ? ""
                                            : buildTravelDisplay(
                                                  moveTravelHours,
                                                  waitingHours
                                              ),
                                        travelWeekendDisplay: isWeekendDay
                                            ? buildTravelDisplay(
                                                  moveTravelHours,
                                                  waitingHours
                                              )
                                            : "",
                                        label,
                                        chargeWindowStart,
                                        chargeWindowEnd,
                                    };

                                    return [blockRow, ...detachedTrailingTravelRows];
                                }),
                            ];
                        }),
                    ];

                    const groupedRows = new Map<
                        string,
                        {
                            row: PersonDayRow;
                            persons: string[];
                            sourceEntryIds: Set<number>;
                        }
                    >();
                    personRows.forEach((personRow) => {
                        if (!groupedRows.has(personRow.rowKey)) {
                            groupedRows.set(personRow.rowKey, {
                                row: personRow,
                                persons: [],
                                sourceEntryIds: new Set<number>(),
                            });
                        }
                        groupedRows.get(personRow.rowKey)!.persons.push(
                            personRow.person
                        );
                        personRow.sourceEntryIds.forEach((entryId) => {
                            groupedRows.get(personRow.rowKey)!.sourceEntryIds.add(
                                entryId
                            );
                        });
                    });

                    const orderedRows = Array.from(groupedRows.values()).sort(
                        (a, b) => {
                            if (a.row.timeFrom !== b.row.timeFrom) {
                                return a.row.timeFrom.localeCompare(
                                    b.row.timeFrom
                                );
                            }
                            if (a.row.priority !== b.row.priority) {
                                return a.row.priority - b.row.priority;
                            }
                            if (a.persons.length !== b.persons.length) {
                                return b.persons.length - a.persons.length;
                            }
                            return a.row.timeTo.localeCompare(b.row.timeTo);
                        }
                    );

                    orderedRows.forEach((group, index) => {
                        const description = group.persons.join(", ");

                        rows.push({
                            rowId: `${date}-${index}`,
                            date,
                            day: getDayOfWeek(date),
                            dateFormatted: formatDate(date),
                            timeFrom: group.row.timeFrom,
                            timeTo: group.row.timeTo,
                            totalHours: group.row.totalHours,
                            weekdayNormal: group.row.weekdayNormal,
                            weekdayAfter: group.row.weekdayAfter,
                            weekendNormal: group.row.weekendNormal,
                            weekendAfter: group.row.weekendAfter,
                            travelWeekday: group.row.travelWeekday,
                            travelWeekend: group.row.travelWeekend,
                            travelWeekdayDisplay: group.row.travelWeekdayDisplay,
                            travelWeekendDisplay: group.row.travelWeekendDisplay,
                            description,
                            hideDayDate: index > 0,
                            sourceEntries: Array.from(group.sourceEntryIds)
                                .map((entryId) => rawEntryById.get(entryId))
                                .filter(
                                    (
                                        entry
                                    ): entry is InvoiceTimesheetEntry => Boolean(entry)
                                )
                                .sort((a, b) => {
                                    const aStart =
                                        new Date(
                                            `${a.dateFrom}T${a.timeFrom ?? "00:00"}`
                                        ).getTime();
                                    const bStart =
                                        new Date(
                                            `${b.dateFrom}T${b.timeFrom ?? "00:00"}`
                                        ).getTime();
                                    return aStart - bStart;
                                })
                                .map((entry) => ({
                                    id: entry.id,
                                    workLogId: entry.workLogId,
                                    dateFrom: entry.dateFrom,
                                    timeFrom: entry.timeFrom ?? "",
                                    dateTo: entry.dateTo,
                                    timeTo: entry.timeTo ?? "",
                                    descType: entry.descType,
                                    details: entry.details,
                                    persons: entry.persons,
                                    note: entry.note,
                                    moveFrom: entry.moveFrom,
                                    moveTo: entry.moveTo,
                                    location: entry.location,
                                    lunchWorked: entry.lunch_worked,
                                    clientDuplicated:
                                        entry.clientDuplicated === true,
                                })),
                            chargeWindowStart: group.row.chargeWindowStart,
                            chargeWindowEnd: group.row.chargeWindowEnd,
                        });
                    });
                });

                const finalTimesheetRows =
                    mergeAdjacentTimesheetRowsByVisibleTimeAndCharge(
                        applyChargedTimeWindowToTimesheetRows(rows)
                    );
                setTimesheetRows(finalTimesheetRows);
                if (!shouldReuseLoadedData) {
                    initialTimesheetRowValueByIdentityRef.current =
                        Object.fromEntries(
                            finalTimesheetRows.map((row) => [
                                getTimesheetRowIdentityKey(row),
                                getTimesheetRowDisplayedValueSnapshot(row),
                            ])
                        );
                }
            } catch (error) {
                console.error("보고서 데이터 로드 실패:", error);
                showError("보고서 데이터를 불러오는 중 오류가 발생했습니다.");
            } finally {
                if (!shouldReuseLoadedData) {
                    setLoading(false);
                }
            }
        };

        loadWorkLogData();
    }, [
        workLogIdsParam,
        showError,
        travelChargeOverrides,
        workLogDataList,
        entryManualBillableHours,
    ]);

    const handleMenuClick = () => {
        setSidebarOpen(!sidebarOpen);
    };

    const handleSidebarClose = () => {
        setSidebarOpen(false);
    };

    // 출장지 매핑 함수
    const mapWorkPlace = (location: string | null): string => {
        if (!location) return "";
        
        // 첫 번째 출장지 추출
        const firstLocation = location.split(",")[0].trim();
        
        // 매핑 규칙 적용
        if (firstLocation === "HD중공업(해양)") {
            return "HHI";
        } else if (firstLocation === "HD미포") {
            return "HMD";
        } else if (firstLocation === "HD삼호") {
            return "HSHI";
        }
        
        // 나머지는 원본 값 그대로 반환
        return firstLocation;
    };

    const shipNameDisplay = workLogDataList[0]?.workLog.vessel || "";
    const workPlaceDisplay = mapWorkPlace(workLogDataList[0]?.workLog.location || null);
    const workOrderFromDisplay = "Everllence ELU KOREA";
    const engineTypeDisplay = workLogDataList[0]?.workLog.engine || "";
    const workItemDisplay = workLogDataList[0]?.workLog.subject || "";
    const formatBoundaryTime = (value: string) => {
        if (!value) return "";
        return value.includes(":")
            ? value
            : `${String(value).padStart(2, "0")}:00`;
    };
    const formatDateParts = (dateString: string) => {
        const date = new Date(`${dateString}T00:00:00`);
        return {
            day: String(date.getDate()).padStart(2, "0"),
            month: MONTH_LABELS[date.getMonth()],
            year: String(date.getFullYear()),
        };
    };
    const formatDateWithYear = (dateString: string) => {
        const { day, month, year } = formatDateParts(dateString);
        return `${day}.${month}.${year}`;
    };
    const formatDateObjectWithYear = (date: Date) => {
        const day = String(date.getDate()).padStart(2, "0");
        const month = MONTH_LABELS[date.getMonth()];
        const year = String(date.getFullYear());
        return `${day}.${month}.${year}`;
    };
    const formatWorkPeriodAndPlace = (
        startDate: string,
        endDate: string,
        place: string
    ) => {
        if (!startDate || !endDate) {
            return place ? `at ${place}` : "";
        }

        const start = formatDateParts(startDate);
        const end = formatDateParts(endDate);
        let periodLabel = "";

        if (startDate === endDate) {
            periodLabel = `${start.day}.${start.month}.${start.year}`;
        } else if (start.year === end.year && start.month === end.month) {
            periodLabel = `${start.day}~${end.day}.${end.month}.${end.year}`;
        } else if (start.year === end.year) {
            periodLabel = `${start.day}.${start.month}~${end.day}.${end.month}.${end.year}`;
        } else {
            periodLabel = `${start.day}.${start.month}.${start.year}~${end.day}.${end.month}.${end.year}`;
        }

        return place ? `${periodLabel} at ${place}` : periodLabel;
    };
    const getInitialOrigin = (entry: TimesheetSourceEntryData): string => {
        const moveFrom = entry.moveFrom?.trim();
        if (moveFrom) {
            return moveFrom;
        }

        const details = (entry.details ?? "").replace(/\s*이동\.?\s*$/, "").trim();
        if (!details.includes("→")) {
            return details;
        }

        return details.split("→")[0]?.trim() ?? "";
    };
    const resolvePlaceToCity = (place: string, workLocation?: string | null) => {
        const normalizedPlace = normalizeLocationName(place);
        const resolvedPlace =
            normalizedPlace === "숙소"
                ? normalizeLocationName(getPrimaryLocation(workLocation ?? null))
                : normalizedPlace;

        if (
            [
                "자택",
                "강동동 공장",
                "PNC",
                "PNIT",
                "HPNT",
                "BNCT",
                "HJNC",
            ].includes(resolvedPlace)
        ) {
            return "Busan";
        }

        if (
            ["HD중공업(해양)", "HD미포", "HHI", "HMD"].includes(resolvedPlace)
        ) {
            return "Ulsan";
        }

        if (["HD삼호", "HSHI"].includes(resolvedPlace)) {
            return "Mokpo";
        }

        if (["한화오션", "삼성중공업"].includes(resolvedPlace)) {
            return "Geoje";
        }

        return "";
    };
    const pickPriorityCity = (cities: string[]) => {
        const uniqueCities = Array.from(new Set(cities.filter(Boolean)));
        if (uniqueCities.includes("Busan")) {
            return "Busan";
        }

        return uniqueCities[0] ?? "";
    };
    const getRowBoundaryCity = (
        row: TimesheetRow,
        mode: "departure" | "return"
    ) => {
        if (row.sourceEntries.length === 0) {
            return "";
        }

        const sourceEntriesWithAdjustedTimes = row.sourceEntries.map((entry) => {
            const adjusted = getAdjustedTravelDateTimes(entry as InvoiceTimesheetEntry);
            return {
                entry,
                start: adjusted.dateFrom && adjusted.timeFrom
                    ? toDateSafe(adjusted.dateFrom, adjusted.timeFrom)
                    : null,
                end: adjusted.dateTo && adjusted.timeTo
                    ? toDateSafe(adjusted.dateTo, adjusted.timeTo)
                    : null,
            };
        });

        const boundaryTime =
            mode === "departure"
                ? sourceEntriesWithAdjustedTimes
                      .map((item) => item.start?.getTime() ?? Number.MAX_SAFE_INTEGER)
                      .reduce((min, value) => Math.min(min, value), Number.MAX_SAFE_INTEGER)
                : sourceEntriesWithAdjustedTimes
                      .map((item) => item.end?.getTime() ?? 0)
                      .reduce((max, value) => Math.max(max, value), 0);

        const boundaryEntries = sourceEntriesWithAdjustedTimes
            .filter((item) =>
                mode === "departure"
                    ? item.start?.getTime() === boundaryTime
                    : item.end?.getTime() === boundaryTime
            )
            .map((item) => item.entry);

        const cities = boundaryEntries
            .map((entry) => {
                const place =
                    mode === "departure"
                        ? entry.descType === "이동"
                            ? getInitialOrigin(entry)
                            : getPrimaryLocation(entry.location ?? null)
                        : entry.descType === "이동"
                          ? getFinalDestination(entry as InvoiceTimesheetEntry)
                          : getPrimaryLocation(entry.location ?? null);

                return resolvePlaceToCity(place, entry.location);
            })
            .filter(Boolean);

        return pickPriorityCity(cities);
    };
    const getBoundaryDisplay = (
        rows: TimesheetRow[],
        mode: "departure" | "return"
    ) => {
        if (rows.length === 0) {
            return "";
        }

        const sortedRows = [...rows].sort((a, b) => {
            const aTime = toDateSafe(
                a.date,
                formatBoundaryTime(mode === "departure" ? a.timeFrom : a.timeTo)
            ).getTime();
            const bTime = toDateSafe(
                b.date,
                formatBoundaryTime(mode === "departure" ? b.timeFrom : b.timeTo)
            ).getTime();
            return mode === "departure" ? aTime - bTime : bTime - aTime;
        });

        const boundaryRow = sortedRows[0];
        const boundaryTime = formatBoundaryTime(
            mode === "departure" ? boundaryRow.timeFrom : boundaryRow.timeTo
        );
        const sameTimeRows = sortedRows.filter((row) => {
            const rowTime = toDateSafe(
                row.date,
                formatBoundaryTime(mode === "departure" ? row.timeFrom : row.timeTo)
            ).getTime();
            const boundaryDateTime = toDateSafe(boundaryRow.date, boundaryTime).getTime();
            return rowTime === boundaryDateTime;
        });

        const city = pickPriorityCity(
            sameTimeRows
                .map((row) => getRowBoundaryCity(row, mode))
                .filter(Boolean)
        );

        if (!city) {
            return "";
        }

        return `${formatDateWithYear(boundaryRow.date)}, ${boundaryTime} ${
            mode === "departure" ? "from" : "to"
        } ${city}`;
    };
    const jobDescriptionDepartureDisplay = getBoundaryDisplay(
        timesheetRows,
        "departure"
    );
    const jobDescriptionReturnDisplay = getBoundaryDisplay(timesheetRows, "return");
    const invoiceDateDisplay = formatDateObjectWithYear(new Date());
    const sortedTimesheetDates = Array.from(
        new Set(timesheetRows.map((row) => row.date).filter(Boolean))
    ).sort();
    const invoiceWorkPeriodDisplay = formatWorkPeriodAndPlace(
        sortedTimesheetDates[0] ?? "",
        sortedTimesheetDates[sortedTimesheetDates.length - 1] ?? "",
        workPlaceDisplay
    );
    const formatHourQuantity = (value: number) => {
        const rounded = Math.round(value * 10) / 10;
        return Number.isInteger(rounded) ? String(rounded) : String(rounded);
    };
    const shouldShowInvoiceManpowerHourRow = (value: number) =>
        Math.round(value * 10) / 10 !== 0;
    /** R&D는 항상 행(그룹) 단위. 노말은 "날짜별 보기"(`date:` 키)일 때만 행 단위 — 인원별 보기는 날짜 합산 유지 */
    const usesRowScopedMealGroups = (
        sectionTitle: string,
        sectionKey: string | undefined
    ) =>
        sectionTitle === "R&D TIMESHEET" ||
        (sectionTitle.startsWith("NORMAL TIMESHEET") &&
            sectionKey?.startsWith("date:"));

    const getMealGroupKey = (
        sectionTitle: string,
        sectionKey: string | undefined,
        row: TimesheetRow
    ) =>
        usesRowScopedMealGroups(sectionTitle, sectionKey)
            ? `${sectionTitle}::row::${row.rowId}`
            : `${sectionTitle}::date::${row.date}`;
    const getMealGroupRows = (
        sectionTitle: string,
        sectionKey: string | undefined,
        rows: TimesheetRow[],
        row: TimesheetRow
    ) =>
        rows.filter(
            (candidate) =>
                getMealGroupKey(sectionTitle, sectionKey, candidate) ===
                getMealGroupKey(sectionTitle, sectionKey, row)
        );

    /**
     * 같은 rowId는 R&D / NORMAL(날짜별 보기)에서 각각 다른 state 키로 저장됨.
     * 서로 다른 표에서 같은 행의 조정을 맞추기 위한 보조 lookup.
     */
    const findRowScopedMealAdjustmentEntry = (
        rowId: string
    ): MealCountAdjustmentEntry | undefined => {
        const suffix = `::row::${rowId}`;
        let normal: MealCountAdjustmentEntry | undefined;
        let rnd: MealCountAdjustmentEntry | undefined;
        for (const [key, value] of Object.entries(mealCountAdjustmentsBySectionDate)) {
            if (!key.endsWith(suffix)) {
                continue;
            }
            if (key.startsWith("R&D TIMESHEET")) {
                rnd = value;
            } else if (key.includes("NORMAL TIMESHEET")) {
                normal = value;
            }
        }
        return normal ?? rnd;
    };
    /** 작업+대기 합산 시간으로 1/2/3끼 구간 (4h 이하 1, 4h 초과 8h 미만 2, 8h 이상 3) */
    const getMealsPerPersonFromWorkAndWaitingHours = (hours: number) => {
        const rounded = Math.round(hours * 10) / 10;
        if (rounded <= 0) {
            return 0;
        }
        if (rounded <= 4) {
            return 1;
        }
        if (rounded < 8) {
            return 2;
        }
        return 3;
    };
    const getSectionMealGroupData = (
        sectionTitle: string,
        sectionKey: string | undefined,
        rows: TimesheetRow[],
        row: TimesheetRow
    ) => {
        const groupRows = getMealGroupRows(sectionTitle, sectionKey, rows, row);
        const workHoursOnly = groupRows.reduce(
            (sum, candidateRow) =>
                sum +
                candidateRow.weekdayNormal +
                candidateRow.weekdayAfter +
                candidateRow.weekendNormal +
                candidateRow.weekendAfter,
            0
        );
        const waitingHours = groupRows.reduce(
            (sum, candidateRow) =>
                sum + getWaitingHoursFromRowSourceEntries(candidateRow),
            0
        );
        const mealBasisHours =
            Math.round((workHoursOnly + waitingHours) * 10) / 10;
        const peopleCount = getUniquePersonsFromRows(groupRows).length;
        const baseMealsPerPerson =
            getMealsPerPersonFromWorkAndWaitingHours(mealBasisHours);
        const mealGroupKey = getMealGroupKey(sectionTitle, sectionKey, row);
        let mealAdjustment: MealCountAdjustmentEntry | undefined =
            mealCountAdjustmentsBySectionDate[mealGroupKey];

        if (
            mealAdjustment === undefined &&
            usesRowScopedMealGroups(sectionTitle, sectionKey)
        ) {
            mealAdjustment = findRowScopedMealAdjustmentEntry(row.rowId);
        }

        if (mealAdjustment === undefined && sectionTitle === "R&D TIMESHEET") {
            mealAdjustment =
                resolveNormalPersonDateScopedMealAdjustmentRef.current(row);
        }

        if (
            mealAdjustment === undefined &&
            sectionTitle.startsWith("NORMAL TIMESHEET") &&
            !usesRowScopedMealGroups(sectionTitle, sectionKey)
        ) {
            mealAdjustment = findRowScopedMealAdjustmentEntry(row.rowId);
        }

        const mealDelta = mealAdjustment?.delta ?? 0;
        const mealsPerPerson = Math.max(baseMealsPerPerson + mealDelta, 0);

        return {
            peopleCount,
            workHours: mealBasisHours,
            baseMealsPerPerson,
            mealsPerPerson,
            totalMeals: peopleCount * mealsPerPerson,
            isMealAdjusted: mealDelta !== 0,
            mealAdjustLastDirection: mealAdjustment?.lastDirection ?? null,
        };
    };
    const adjustSectionMealGroupMeals = (
        sectionTitle: string,
        sectionKey: string | undefined,
        rows: TimesheetRow[],
        row: TimesheetRow,
        delta: number
    ) => {
        setMealCountAdjustmentsBySectionDate((previous) => {
            const key = getMealGroupKey(sectionTitle, sectionKey, row);
            const currentDelta = previous[key]?.delta ?? 0;
            const baseMealsPerPerson = getSectionMealGroupData(
                sectionTitle,
                sectionKey,
                rows,
                row
            ).baseMealsPerPerson;
            const nextMealsPerPerson = Math.max(baseMealsPerPerson + currentDelta + delta, 0);
            const nextDelta = nextMealsPerPerson - baseMealsPerPerson;
            const lastDirection = delta > 0 ? ("up" as const) : ("down" as const);

            if (nextDelta === 0) {
                const { [key]: _removed, ...rest } = previous;
                return rest;
            }

            return {
                ...previous,
                [key]: { delta: nextDelta, lastDirection },
            };
        });
    };
    const getSectionMealsTotal = (
        sectionTitle: string,
        sectionKey: string | undefined,
        rows: TimesheetRow[]
    ) =>
        rows.reduce((groupLeadRows, row) => {
            const key = getMealGroupKey(sectionTitle, sectionKey, row);
            if (
                groupLeadRows.some(
                    (candidate) =>
                        getMealGroupKey(sectionTitle, sectionKey, candidate) === key
                )
            ) {
                return groupLeadRows;
            }
            return [...groupLeadRows, row];
        }, [] as TimesheetRow[]).reduce(
            (sum, row) =>
                sum +
                getSectionMealGroupData(sectionTitle, sectionKey, rows, row).totalMeals,
            0
        );
    const mealsCellSplitShell = (left: ReactNode, right: ReactNode) => (
        <div className="flex min-h-[18px] w-full items-stretch">
            <div className="relative flex min-w-0 flex-1 flex-col items-center justify-center border-r border-gray-200 px-0.5">
                {left}
            </div>
            <div className="flex min-w-0 flex-1 items-center justify-center px-0.5 tabular-nums text-gray-400">
                {right}
            </div>
        </div>
    );

    const renderMealsCell = (
        sectionTitle: string,
        sectionKey: string | undefined,
        rows: TimesheetRow[],
        row: TimesheetRow,
        _sizeClassName: string
    ) => {
        const isFirstRowForMealGroup =
            getMealGroupRows(sectionTitle, sectionKey, rows, row)[0]?.rowId ===
            row.rowId;
        const cellClassName = `relative px-0 py-0 text-center align-middle ${getTimesheetRowStateClass(
            sectionTitle,
            row
        )}`;

        const lodgingEmpty = (
            <span className="select-none text-gray-300" aria-hidden="true">
                —
            </span>
        );

        if (!isFirstRowForMealGroup) {
            return (
                <td
                    className={cellClassName}
                    {...getTimesheetInteractiveCellProps(sectionTitle, row)}
                >
                    {mealsCellSplitShell(null, lodgingEmpty)}
                </td>
            );
        }

        const lodgingCount = countLodgingArrivalPersonsForMealGroup(
            sectionTitle,
            sectionKey,
            rows,
            row
        );
        const lodgingValue = (
            <span
                className={`tabular-nums ${
                    lodgingCount > 0
                        ? "font-semibold text-gray-900"
                        : "text-gray-400"
                }`}
            >
                {lodgingCount}
            </span>
        );

        const mealsData = getSectionMealGroupData(
            sectionTitle,
            sectionKey,
            rows,
            row
        );
        const mealsLabel =
            mealsData.totalMeals +
            (mealsData.isMealAdjusted && mealsData.mealAdjustLastDirection === "up"
                ? "▲"
                : mealsData.isMealAdjusted && mealsData.mealAdjustLastDirection === "down"
                  ? "▼"
                  : "");

        return (
            <td
                className={cellClassName}
                {...getTimesheetInteractiveCellProps(sectionTitle, row)}
            >
                {mealsCellSplitShell(
                    <div className="relative flex min-h-[18px] w-full items-center justify-center pr-3">
                        <span
                            className={`block text-center font-semibold leading-none ${
                                mealsData.isMealAdjusted
                                    ? getTimesheetChangedValueTextClass(true, mealsLabel)
                                    : "text-gray-900"
                            }`}
                        >
                            {mealsLabel}
                        </span>
                        <div className="absolute right-0 top-1/2 flex -translate-y-1/2 flex-col items-center gap-0">
                            <button
                                type="button"
                                className="flex h-2.5 w-2.5 items-center justify-center rounded-none bg-transparent p-0 text-gray-500 hover:text-gray-700"
                                onClick={(event) => {
                                    event.stopPropagation();
                                    adjustSectionMealGroupMeals(
                                        sectionTitle,
                                        sectionKey,
                                        rows,
                                        row,
                                        1
                                    );
                                }}
                                aria-label="increase meals"
                            >
                                <svg
                                    viewBox="0 0 16 16"
                                    width="7"
                                    height="7"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.8"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    aria-hidden="true"
                                >
                                    <path d="M4 10l4-4 4 4" />
                                </svg>
                            </button>
                            <button
                                type="button"
                                className="flex h-2.5 w-2.5 items-center justify-center rounded-none bg-transparent p-0 text-gray-500 hover:text-gray-700"
                                onClick={(event) => {
                                    event.stopPropagation();
                                    adjustSectionMealGroupMeals(
                                        sectionTitle,
                                        sectionKey,
                                        rows,
                                        row,
                                        -1
                                    );
                                }}
                                aria-label="decrease meals"
                            >
                                <svg
                                    viewBox="0 0 16 16"
                                    width="7"
                                    height="7"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.8"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    aria-hidden="true"
                                >
                                    <path d="M4 6l4 4 4-4" />
                                </svg>
                            </button>
                        </div>
                    </div>,
                    lodgingValue
                )}
            </td>
        );
    };
    const createEmptyInvoiceHourSummary = () => ({
        weekdayNormal: 0,
        weekdayAfter: 0,
        weekendNormal: 0,
        weekendAfter: 0,
        travelWeekday: 0,
        travelWeekend: 0,
    });
    const getInvoiceManpowerSummaries = () =>
        timesheetRows.reduce(
            (summary, row) => {
                const rowPeople = getRowPersons(row);
                if (rowPeople.length === 0) {
                    return summary;
                }

                const billedSkilledFitterCount = 1;
                const billedFitterCount = Math.max(
                    rowPeople.length - billedSkilledFitterCount,
                    0
                );

                summary.skilled.weekdayNormal +=
                    row.weekdayNormal * billedSkilledFitterCount;
                summary.skilled.weekdayAfter +=
                    row.weekdayAfter * billedSkilledFitterCount;
                summary.skilled.weekendNormal +=
                    row.weekendNormal * billedSkilledFitterCount;
                summary.skilled.weekendAfter +=
                    row.weekendAfter * billedSkilledFitterCount;
                summary.skilled.travelWeekday +=
                    row.travelWeekday * billedSkilledFitterCount;
                summary.skilled.travelWeekend +=
                    row.travelWeekend * billedSkilledFitterCount;

                summary.fitter.weekdayNormal +=
                    row.weekdayNormal * billedFitterCount;
                summary.fitter.weekdayAfter +=
                    row.weekdayAfter * billedFitterCount;
                summary.fitter.weekendNormal +=
                    row.weekendNormal * billedFitterCount;
                summary.fitter.weekendAfter +=
                    row.weekendAfter * billedFitterCount;
                summary.fitter.travelWeekday +=
                    row.travelWeekday * billedFitterCount;
                summary.fitter.travelWeekend +=
                    row.travelWeekend * billedFitterCount;
                return summary;
            },
            {
                skilled: createEmptyInvoiceHourSummary(),
                fitter: createEmptyInvoiceHourSummary(),
            }
        );

    const renderSplitHoursCells = (
        row: TimesheetRow,
        sectionTitle: string,
        sizeClassName: string
    ) => {
        const changed = getTimesheetRowChangedFlags(row);
        const values = {
            weekdayNormal:
                row.weekdayNormal > 0 ? String(row.weekdayNormal) : "",
            weekdayAfter: row.weekdayAfter > 0 ? String(row.weekdayAfter) : "",
            weekendNormal:
                row.weekendNormal > 0 ? String(row.weekendNormal) : "",
            weekendAfter: row.weekendAfter > 0 ? String(row.weekendAfter) : "",
            travelWeekday:
                row.travelWeekdayDisplay ||
                (row.travelWeekday > 0 ? String(row.travelWeekday) : ""),
            travelWeekend:
                row.travelWeekendDisplay ||
                (row.travelWeekend > 0 ? String(row.travelWeekend) : ""),
        };
        const isInteractive = Object.values(values).some((value) => value !== "");
        const baseClassName = `border-r border-gray-300 text-center ${sizeClassName}`;
        const interactiveClassName = isInteractive ? "cursor-pointer" : "";
        const stateClassName = isInteractive
            ? getTimesheetRowStateClass(sectionTitle, row)
            : "";

        const getCellClassName = () =>
            `${baseClassName} ${interactiveClassName} ${stateClassName}`;

        const interactiveCellProps = isInteractive
            ? getTimesheetInteractiveCellProps(sectionTitle, row)
            : {};

        return (
            <>
                <td
                    className={getCellClassName()}
                    {...interactiveCellProps}
                >
                    <span
                        className={getTimesheetChangedValueTextClass(
                            changed.weekdayNormal,
                            values.weekdayNormal
                        )}
                    >
                        {values.weekdayNormal}
                    </span>
                </td>
                <td
                    className={getCellClassName()}
                    {...interactiveCellProps}
                >
                    <span
                        className={getTimesheetChangedValueTextClass(
                            changed.weekdayAfter,
                            values.weekdayAfter
                        )}
                    >
                        {values.weekdayAfter}
                    </span>
                </td>
                <td
                    className={getCellClassName()}
                    {...interactiveCellProps}
                >
                    <span
                        className={getTimesheetChangedValueTextClass(
                            changed.weekendNormal,
                            values.weekendNormal
                        )}
                    >
                        {values.weekendNormal}
                    </span>
                </td>
                <td
                    className={getCellClassName()}
                    {...interactiveCellProps}
                >
                    <span
                        className={getTimesheetChangedValueTextClass(
                            changed.weekendAfter,
                            values.weekendAfter
                        )}
                    >
                        {values.weekendAfter}
                    </span>
                </td>
                <td
                    className={getCellClassName()}
                    {...interactiveCellProps}
                >
                    <span
                        className={getTimesheetChangedValueTextClass(
                            changed.travelWeekday,
                            values.travelWeekday
                        )}
                    >
                        {values.travelWeekday}
                    </span>
                </td>
                <td
                    className={getCellClassName()}
                    {...interactiveCellProps}
                >
                    <span
                        className={getTimesheetChangedValueTextClass(
                            changed.travelWeekend,
                            values.travelWeekend
                        )}
                    >
                        {values.travelWeekend}
                    </span>
                </td>
            </>
        );
    };

    const getTimesheetRowModalValues = (row: TimesheetRow) => ({
        weekdayNormal: row.weekdayNormal > 0 ? String(row.weekdayNormal) : "",
        weekdayAfter: row.weekdayAfter > 0 ? String(row.weekdayAfter) : "",
        weekendNormal: row.weekendNormal > 0 ? String(row.weekendNormal) : "",
        weekendAfter: row.weekendAfter > 0 ? String(row.weekendAfter) : "",
        travelWeekday:
            row.travelWeekdayDisplay ||
            (row.travelWeekday > 0 ? String(row.travelWeekday) : ""),
        travelWeekend:
            row.travelWeekendDisplay ||
            (row.travelWeekend > 0 ? String(row.travelWeekend) : ""),
    });

    const getRowPersons = (row: TimesheetRow) =>
        row.description
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean);
    const getUniquePersonsFromRows = (rows: TimesheetRow[]) =>
        Array.from(
            new Set(
                rows.flatMap((row) => getRowPersons(row))
            )
        ).filter(Boolean);
    const getUniquePersonsFromWorkLogs = (items: WorkLogFullData[]) =>
        Array.from(
            new Set(
                items.flatMap((item) => [
                    ...(item.workers ?? []),
                    ...item.entries.flatMap((entry) => entry.persons ?? []),
                ])
            )
        ).filter(Boolean);
    const formatUsernameDisplay = (username: string) => {
        const baseUsername = username.split("_")[0]?.trim() ?? "";
        if (!baseUsername) return "";

        return baseUsername
            .split(".")
            .filter(Boolean)
            .map((part, index) =>
                index === 0
                    ? part.toUpperCase()
                    : `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`
            )
            .join(" ");
    };
    const getEnglishPersonName = (personName: string) => {
        const username = profileUsernameMap[personName];
        return username ? formatUsernameDisplay(username) : personName;
    };
    const sortPeopleForMention = (people: string[]) => {
        const uniquePeople = Array.from(new Set(people)).filter(Boolean);
        const hasPriorityPerson = uniquePeople.some((person) =>
            PERSON_MENTION_PRIORITY_INDEX.has(person)
        );

        return [...uniquePeople].sort((a, b) => {
            if (!hasPriorityPerson) {
                return a.localeCompare(b, "ko");
            }

            const aPriority =
                PERSON_MENTION_PRIORITY_INDEX.get(a) ?? Number.MAX_SAFE_INTEGER;
            const bPriority =
                PERSON_MENTION_PRIORITY_INDEX.get(b) ?? Number.MAX_SAFE_INTEGER;

            if (aPriority !== bPriority) {
                return aPriority - bPriority;
            }

            return a.localeCompare(b, "ko");
        });
    };
    const formatEngineerTitleDisplay = (people: string[]) => {
        const sortedPeople = sortPeopleForMention(people);
        if (sortedPeople.length === 0) {
            return "";
        }

        return `${sortedPeople
            .map((person) => getEnglishPersonName(person))
            .join(", ")} / Skilled fitter${sortedPeople.length > 1 ? "s" : ""}`;
    };
    const formatMechanicSummaryDisplay = (
        people: string[],
        representative?: string
    ) => {
        const sortedPeople = sortPeopleForMention(people);
        if (sortedPeople.length === 0) {
            return "";
        }

        const leadPerson = representative && sortedPeople.includes(representative)
            ? representative
            : sortedPeople[0];
        const leadName = getEnglishPersonName(leadPerson);
        if (sortedPeople.length === 1) {
            return `${leadName} / Fitter`;
        }

        const remainingCount = sortedPeople.length - 1;
        return `${leadName} and ${remainingCount} fitter${
            remainingCount > 1 ? "s" : ""
        } (Total ${sortedPeople.length} fitters)`;
    };
    const getTopSelectableSkilledFitters = (people: string[]) =>
        SKILLED_FITTER_PRIORITY.filter((person) => people.includes(person)).slice(0, 3);
    const getTopSelectableMechanics = (people: string[]) =>
        sortPeopleForMention(people).slice(0, 3);
    const getScopedMechanicRepresentative = (
        scopeKey: string,
        mechanicPeople: string[]
    ) => {
        const sortedMechanics = sortPeopleForMention(mechanicPeople);
        const savedRepresentative = selectedFitterRepresentatives[scopeKey];

        if (savedRepresentative && sortedMechanics.includes(savedRepresentative)) {
            return savedRepresentative;
        }

        return sortedMechanics[0] ?? "";
    };
    const getPersonnelDisplayData = (scopeKey: string, people: string[]) => {
        const uniquePeople = Array.from(new Set(people)).filter(Boolean);
        const engineerPeople = sortPeopleForMention(
            uniquePeople.filter(
                (person) =>
                    SKILLED_FITTER_SET.has(person) &&
                    selectedSkilledFitters.includes(person)
            )
        );
        const mechanicPeople = sortPeopleForMention(
            uniquePeople.filter((person) => !engineerPeople.includes(person))
        );
        const mechanicRepresentative = getScopedMechanicRepresentative(
            scopeKey,
            mechanicPeople
        );

        return {
            engineerDisplay: formatEngineerTitleDisplay(engineerPeople),
            mechanicDisplay: formatMechanicSummaryDisplay(
                mechanicPeople,
                mechanicRepresentative
            ),
            engineerPeople,
            mechanicPeople,
            mechanicRepresentative,
        };
    };
    const openPersonnelEditor = (
        scopeKey: string,
        scopeTitle: string,
        mode: "engineer" | "mechanic",
        people: string[]
    ) => {
        setPersonnelEditor({
            scopeKey,
            scopeTitle,
            mode,
            people,
        });
    };
    const toggleSkilledFitterSelection = (person: string) => {
        if (!SKILLED_FITTER_SET.has(person)) {
            return;
        }

        setSelectedSkilledFitters((previous) => {
            if (previous.includes(person)) {
                return previous.filter((value) => value !== person);
            }

            if (previous.length >= 3) {
                return previous;
            }

            return [...previous, person];
        });
    };
    const selectMechanicRepresentative = (scopeKey: string, person: string) => {
        setSelectedFitterRepresentatives((previous) => ({
            ...previous,
            [scopeKey]: person,
        }));
    };
    const renderEditablePersonnelCard = (
        label: string,
        value: string,
        scopeKey: string,
        scopeTitle: string,
        mode: "engineer" | "mechanic",
        people: string[]
    ) => (
        <div className="group relative rounded-lg border border-gray-200 bg-white p-4 transition-shadow hover:shadow-sm hover:ring-1 hover:ring-blue-200">
            <button
                type="button"
                className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 opacity-0 shadow-sm transition-all hover:border-blue-200 hover:text-blue-600 group-hover:opacity-100"
                onClick={() =>
                    openPersonnelEditor(scopeKey, scopeTitle, mode, people)
                }
                aria-label={`${label} 수정`}
            >
                <IconEdit className="h-4 w-4" />
            </button>
            <div className="mb-2 pr-10 text-xs font-semibold text-gray-700">
                {label}
            </div>
            <div className="text-sm text-gray-900">{value}</div>
        </div>
    );

    const getNormalTimesheetSignature = (row: TimesheetRow) =>
        [
            row.date,
            row.timeFrom,
            row.timeTo,
            row.totalHours,
            row.weekdayNormal,
            row.weekdayAfter,
            row.weekendNormal,
            row.weekendAfter,
            row.travelWeekday,
            row.travelWeekend,
            row.travelWeekdayDisplay ?? "",
            row.travelWeekendDisplay ?? "",
        ].join("|");

    const normalTimesheetSectionsByPerson = (() => {
        const personSignatures = new Map<string, string[]>();
        const personFirstIndex = new Map<string, number>();

        timesheetRows.forEach((row, rowIndex) => {
            getRowPersons(row).forEach((person) => {
                if (!personSignatures.has(person)) {
                    personSignatures.set(person, []);
                }

                personSignatures.get(person)!.push(
                    getNormalTimesheetSignature(row)
                );

                if (!personFirstIndex.has(person)) {
                    personFirstIndex.set(person, rowIndex);
                }
            });
        });

        const groupedPersons = new Map<
            string,
            { people: string[]; firstIndex: number }
        >();

        personSignatures.forEach((signatures, person) => {
            const signatureKey = signatures.join("||");

            if (!groupedPersons.has(signatureKey)) {
                groupedPersons.set(signatureKey, {
                    people: [],
                    firstIndex:
                        personFirstIndex.get(person) ?? Number.MAX_SAFE_INTEGER,
                });
            }

            const group = groupedPersons.get(signatureKey)!;
            group.people.push(person);
            group.firstIndex = Math.min(
                group.firstIndex,
                personFirstIndex.get(person) ?? Number.MAX_SAFE_INTEGER
            );
        });

        return Array.from(groupedPersons.values())
            .sort((a, b) => a.firstIndex - b.firstIndex)
            .map((group, index) => {
                const sectionRows = timesheetRows
                    .map((row) => {
                        const matchedPersons = getRowPersons(row).filter((person) =>
                            group.people.includes(person)
                        );

                        if (matchedPersons.length === 0) {
                            return null;
                        }

                        const filteredSourceEntries = row.sourceEntries.filter(
                            (entry) =>
                                (entry.persons ?? []).some((person) =>
                                    matchedPersons.includes(person)
                                )
                        );

                        return {
                            ...row,
                            description: matchedPersons.join(", "),
                            sourceEntries:
                                filteredSourceEntries.length > 0
                                    ? filteredSourceEntries
                                    : row.sourceEntries,
                        };
                    })
                    .filter((row): row is TimesheetRow => Boolean(row))
                    .map((row, rowIndex, rows) => ({
                        ...row,
                        hideDayDate:
                            rowIndex > 0 && rows[rowIndex - 1]?.date === row.date,
                    }));

                return {
                    key: group.people.join("|"),
                    title: `NORMAL TIMESHEET - ${String.fromCharCode(65 + index)}`,
                    people: group.people,
                    rows: sectionRows,
                };
            });
    })();

    const normalTimesheetSectionsByDate = (() => {
        const dates = Array.from(
            new Set(timesheetRows.map((row) => row.date).filter(Boolean))
        ).sort();

        return dates.map((date, index) => {
            const rows = timesheetRows
                .filter((row) => row.date === date)
                .map((row, rowIndex, sameDateRows) => ({
                    ...row,
                    hideDayDate: rowIndex > 0 && sameDateRows[rowIndex - 1]?.date === row.date,
                }));

            return {
                key: `date:${date}`,
                title: `NORMAL TIMESHEET - ${String.fromCharCode(65 + index)}`,
                people: getUniquePersonsFromRows(rows),
                rows,
            };
        });
    })();

    resolveNormalPersonDateScopedMealAdjustmentRef.current = (row: TimesheetRow) => {
        for (const section of normalTimesheetSectionsByPerson) {
            if (!section.rows.some((r) => r.rowId === row.rowId)) {
                continue;
            }
            const sameDateRows = section.rows.filter((r) => r.date === row.date);
            const leader = sameDateRows[0];
            if (!leader || leader.rowId !== row.rowId) {
                return undefined;
            }
            const dateKey = `${section.title}::date::${row.date}`;
            return mealCountAdjustmentsBySectionDate[dateKey];
        }
        return undefined;
    };

    const allTimesheetPeople = getUniquePersonsFromRows(timesheetRows);
    const allTimesheetPeopleKey = allTimesheetPeople.join("|");
    const allInvoicePeople = getUniquePersonsFromWorkLogs(workLogDataList);
    const allInvoicePeopleKey = allInvoicePeople.join("|");
    const jobDescriptionPersonnel = getPersonnelDisplayData(
        "JOB_DESCRIPTION",
        allTimesheetPeople
    );
    const DAILY_ALLOWANCE_MEAL_UNIT_PRICE_KRW = 15000;
    const invoiceMealsTotal = normalTimesheetSectionsByPerson.reduce(
        (sum, section) =>
            sum + getSectionMealsTotal(section.title, section.key, section.rows),
        0
    );
    const dailyAllowanceSkilledCount =
        jobDescriptionPersonnel.engineerPeople.length;
    const dailyAllowanceFitterCount =
        jobDescriptionPersonnel.mechanicPeople.length;
    const dailyAllowanceSkilledLabel =
        dailyAllowanceSkilledCount === 1 ? "Skilled fitter" : "Skilled fitters";
    const dailyAllowanceFitterLabel =
        dailyAllowanceFitterCount === 1 ? "fitter" : "fitters";
    const invoiceDailyAllowanceDescription = `: ${dailyAllowanceSkilledCount} ${dailyAllowanceSkilledLabel} and ${dailyAllowanceFitterCount} ${dailyAllowanceFitterLabel}`;
    const invoiceDailyAllowanceLineTotal =
        invoiceMealsTotal * DAILY_ALLOWANCE_MEAL_UNIT_PRICE_KRW;
    const formatKrwWithCommas = (value: number) =>
        Math.round(value).toLocaleString("en-US");
    const resolveRequiredSkilledFittersForSectionTitle = (
        sectionTitle: string
    ) => {
        if (sectionTitle === "ALL DATE GROUP DETAIL") {
            return jobDescriptionPersonnel.engineerPeople;
        }

        const normalSection = [
            ...normalTimesheetSectionsByPerson,
            ...normalTimesheetSectionsByDate,
        ].find((section) => section.title === sectionTitle);

        if (normalSection) {
            return getPersonnelDisplayData(
                normalSection.key,
                normalSection.people
            ).engineerPeople;
        }

        return jobDescriptionPersonnel.engineerPeople;
    };
    const getPersonVesselHistoryNeighbors = (
        person: string,
        targetDate: string
    ) => {
        const history = personVesselHistoryByPerson[person] ?? [];
        const currentIndex = history.findIndex((item) => item.date === targetDate);
        const insertionIndex =
            currentIndex >= 0
                ? currentIndex
                : history.findIndex((item) => item.date > targetDate);
        const nextIndex =
            currentIndex >= 0
                ? currentIndex + 1
                : insertionIndex >= 0
                  ? insertionIndex
                  : history.length;
        const previousIndex = currentIndex >= 0 ? currentIndex - 1 : nextIndex - 1;

        return {
            previous:
                previousIndex >= 0 && previousIndex < history.length
                    ? history[previousIndex]
                    : null,
            current:
                currentIndex >= 0 && currentIndex < history.length
                    ? history[currentIndex]
                    : null,
            next:
                nextIndex >= 0 && nextIndex < history.length
                    ? history[nextIndex]
                    : null,
        };
    };
    const getTravelBadgeLabelForPerson = (
        entry: TimesheetSourceEntryData,
        person: string
    ) => {
        if (entry.descType !== "이동" || !(entry.persons ?? []).includes(person)) {
            return "";
        }

        const travelOrigin = normalizeLocationName(getInitialOrigin(entry));
        const travelDestination = normalizeLocationName(
            getFinalDestination({
                ...entry,
                sourceEntryIds: [entry.id],
            } as InvoiceTimesheetEntry)
        );
        const direction =
            travelDestination === "자택"
                ? "arrival"
                : travelOrigin === "자택"
                  ? "departure"
                  : travelDestination === "숙소"
                    ? "arrival"
                    : travelOrigin === "숙소"
                      ? "departure"
                      : null;

        if (!direction) {
            return "";
        }

        const fixedHours = getHomeTravelHours(entry.location ?? null) ?? 0;
        const containsLodging = (entry.details ?? "").includes("숙소");
        const containsHome =
            (entry.details ?? "").includes("자택") ||
            entry.moveFrom === "자택" ||
            entry.moveTo === "자택";
        const override = getTravelChargeOverride(entry.id, person);
        const travelHours = calculateTravelHours({
            ...entry,
            sourceEntryIds: [entry.id],
        } as InvoiceTimesheetEntry);

        let target: TravelChargeOverrideTarget | null = null;
        if (override?.target === "lodging") {
            target = "lodging";
        } else if (override?.target === "home") {
            target = "home";
        } else if (travelHours === 1 && containsLodging) {
            target = "lodging";
        } else if (travelHours === 1 && containsHome) {
            target = "home";
        } else if (containsHome && fixedHours > 0) {
            target = "home";
        }

        if (!target) {
            return "";
        }

        if (direction === "departure") {
            return target === "home" ? "자택→" : "숙소→";
        }

        return target === "home" ? "→자택" : "→숙소";
    };

    /** 해당 meal 그룹·해당 일자에서 이동 배지가 `→숙소`인 인원 수(중복 인원 1회) */
    const countLodgingArrivalPersonsForMealGroup = (
        sectionTitle: string,
        sectionKey: string | undefined,
        allRows: TimesheetRow[],
        row: TimesheetRow
    ): number => {
        const groupRows = getMealGroupRows(sectionTitle, sectionKey, allRows, row);
        const dateKey = row.date;
        const entryById = new Map<number, TimesheetSourceEntryData>();
        for (const r of groupRows) {
            for (const e of r.sourceEntries) {
                if (e.dateFrom === dateKey) {
                    entryById.set(e.id, e);
                }
            }
        }
        const entries = [...entryById.values()];
        const persons = getUniquePersonsFromRows(groupRows);
        let n = 0;
        for (const person of persons) {
            for (const entry of entries) {
                if (entry.descType !== "이동") {
                    continue;
                }
                if (!(entry.persons ?? []).includes(person)) {
                    continue;
                }
                if (getTravelBadgeLabelForPerson(entry, person) === "→숙소") {
                    n += 1;
                    break;
                }
            }
        }
        return n;
    };

    const getSectionLodgingArrivalTotal = (
        sectionTitle: string,
        sectionKey: string | undefined,
        rows: TimesheetRow[]
    ) =>
        rows
            .reduce((groupLeadRows, row) => {
                const key = getMealGroupKey(sectionTitle, sectionKey, row);
                if (
                    groupLeadRows.some(
                        (candidate) =>
                            getMealGroupKey(sectionTitle, sectionKey, candidate) ===
                            key
                    )
                ) {
                    return groupLeadRows;
                }
                return [...groupLeadRows, row];
            }, [] as TimesheetRow[])
            .reduce(
                (sum, row) =>
                    sum +
                    countLodgingArrivalPersonsForMealGroup(
                        sectionTitle,
                        sectionKey,
                        rows,
                        row
                    ),
                0
            );

    const getNormalTimesheetComments = (
        section: NormalTimesheetSection
    ): string[] => {
        const currentVessel = shipNameDisplay.trim();
        const tripLocation = workLogDataList[0]?.workLog.location ?? null;
        const tripCity =
            resolvePlaceToCity("숙소", tripLocation) ||
            resolvePlaceToCity(getPrimaryLocation(tripLocation), tripLocation);

        if (!currentVessel || !tripCity) {
            return [];
        }

        const dates = Array.from(
            new Set(section.rows.map((row) => row.date).filter(Boolean))
        ).sort();
        const comments: string[] = [];

        dates.forEach((date) => {
            const dayEntries = Array.from(
                new Map(
                    section.rows
                        .filter((row) => row.date === date)
                        .flatMap((row) => row.sourceEntries)
                        .map((entry) => [entry.id, entry] as const)
                ).values()
            ).sort((a, b) => {
                const aStart = new Date(
                    `${a.dateFrom}T${a.timeFrom ?? "00:00"}`
                ).getTime();
                const bStart = new Date(
                    `${b.dateFrom}T${b.timeFrom ?? "00:00"}`
                ).getTime();
                if (aStart !== bStart) {
                    return aStart - bStart;
                }

                const aEnd = new Date(
                    `${a.dateTo}T${a.timeTo ?? "00:00"}`
                ).getTime();
                const bEnd = new Date(
                    `${b.dateTo}T${b.timeTo ?? "00:00"}`
                ).getTime();
                return aEnd - bEnd;
            });

            const previousDayVessels = new Set<string>();
            const nextDayVessels = new Set<string>();
            const sameDayOtherVesselsBeforeWork = new Set<string>();
            const sameDayOtherVesselsAfterWork = new Set<string>();

            section.people.forEach((person) => {
                const personEntries = dayEntries.filter((entry) =>
                    (entry.persons ?? []).includes(person)
                );
                if (personEntries.length === 0) {
                    return;
                }

                const { previous, current, next } =
                    getPersonVesselHistoryNeighbors(person, date);

                const firstEntry = personEntries[0];
                if (
                    firstEntry?.descType === "이동" &&
                    getTravelBadgeLabelForPerson(firstEntry, person) === "숙소→"
                ) {
                    const previousVesselsForPerson = (previous?.vessels ?? []).filter(
                        (vessel) => vessel && vessel !== currentVessel
                    );
                    if (
                        previousVesselsForPerson.length > 0 &&
                        !(previous?.vessels ?? []).includes(currentVessel)
                    ) {
                        previousVesselsForPerson.forEach((vessel) =>
                            previousDayVessels.add(vessel)
                        );
                    }
                }

                const lastEntry = personEntries[personEntries.length - 1];
                if (
                    lastEntry?.descType === "이동" &&
                    getTravelBadgeLabelForPerson(lastEntry, person) === "→숙소"
                ) {
                    const nextVesselsForPerson = (next?.vessels ?? []).filter(
                        (vessel) => vessel && vessel !== currentVessel
                    );
                    if (
                        nextVesselsForPerson.length > 0 &&
                        !(next?.vessels ?? []).includes(currentVessel)
                    ) {
                        nextVesselsForPerson.forEach((vessel) =>
                            nextDayVessels.add(vessel)
                        );
                    }
                }

                const firstWorkIndex = personEntries.findIndex(
                    (entry) => entry.descType === "작업"
                );
                const reversedLastWorkIndex = [...personEntries]
                    .reverse()
                    .findIndex((entry) => entry.descType === "작업");
                if (firstWorkIndex < 0 || reversedLastWorkIndex < 0) {
                    return;
                }

                const lastWorkIndex =
                    personEntries.length - 1 - reversedLastWorkIndex;
                const hasTravelBeforeWork = personEntries
                    .slice(0, firstWorkIndex)
                    .some((entry) => entry.descType === "이동");
                const hasTravelAfterWork = personEntries
                    .slice(lastWorkIndex + 1)
                    .some((entry) => entry.descType === "이동");
                const currentOtherVessels = (current?.vessels ?? []).filter(
                    (vessel) => vessel && vessel !== currentVessel
                );

                if (currentOtherVessels.length > 0 && !hasTravelBeforeWork) {
                    currentOtherVessels.forEach((vessel) =>
                        sameDayOtherVesselsBeforeWork.add(vessel)
                    );
                }

                if (currentOtherVessels.length > 0 && !hasTravelAfterWork) {
                    currentOtherVessels.forEach((vessel) =>
                        sameDayOtherVesselsAfterWork.add(vessel)
                    );
                }
            });

            const dateLabel = formatDate(date);
            if (previousDayVessels.size > 0) {
                comments.push(
                    `Fitters started a day in ${tripCity}, because they had a work on ${Array.from(previousDayVessels).join(", ")} previously. (${dateLabel})`
                );
            }
            if (nextDayVessels.size > 0) {
                comments.push(
                    `Fitters stayed in ${tripCity} after the work, because they have a work on ${Array.from(nextDayVessels).join(", ")} a day after. (${dateLabel})`
                );
            }
            if (sameDayOtherVesselsAfterWork.size > 0) {
                comments.push(
                    `Travel time did not occur after the work because they continued to work on ${Array.from(sameDayOtherVesselsAfterWork).join(", ")}. (${dateLabel})`
                );
            }
            if (sameDayOtherVesselsBeforeWork.size > 0) {
                comments.push(
                    `Travel time did not occur before the work because they had work on ${Array.from(sameDayOtherVesselsBeforeWork).join(", ")} previously. (${dateLabel})`
                );
            }
        });

        return Array.from(new Set(comments));
    };
    const rndTimesheetComments = getNormalTimesheetComments({
        key: "R&D TIMESHEET",
        title: "R&D TIMESHEET",
        people: allTimesheetPeople,
        rows: timesheetRows,
    });
    const invoiceRoleRepresentative =
        sortPeopleForMention(jobDescriptionPersonnel.engineerPeople)[0] ??
        sortPeopleForMention(allTimesheetPeople)[0] ??
        "";
    const invoiceSkilledFitterPeople = invoiceRoleRepresentative
        ? [invoiceRoleRepresentative]
        : [];
    const invoiceFitterPeople = sortPeopleForMention(allTimesheetPeople).filter(
        (person) => person !== invoiceRoleRepresentative
    );
    const invoiceManpowerSummaries = getInvoiceManpowerSummaries();
    const skilledFitterInvoiceSummary = invoiceManpowerSummaries.skilled;
    const fitterInvoiceSummary = invoiceManpowerSummaries.fitter;

    useEffect(() => {
        if (allInvoicePeople.length === 0) {
            setProfileUsernameMap({});
            return;
        }

        let cancelled = false;

        const loadProfileUsernames = async () => {
            const { data, error } = await supabase
                .from("profiles")
                .select("name, username")
                .in("name", allInvoicePeople);

            if (cancelled) {
                return;
            }

            if (error) {
                console.error("프로필 username 조회 실패:", error);
                return;
            }

            const nextMap: Record<string, string> = {};
            (data ?? []).forEach((profile) => {
                const profileName =
                    typeof profile.name === "string" ? profile.name.trim() : "";
                const profileUsername =
                    typeof profile.username === "string"
                        ? profile.username.trim()
                        : "";

                if (profileName && profileUsername) {
                    nextMap[profileName] = profileUsername;
                }
            });

            setProfileUsernameMap(nextMap);
        };

        void loadProfileUsernames();

        return () => {
            cancelled = true;
        };
    }, [allInvoicePeopleKey]);

    useEffect(() => {
        if (allInvoicePeople.length === 0) {
            setPersonVesselHistoryByPerson({});
            return;
        }

        let cancelled = false;
        function chunk<T>(items: T[], size: number): T[][] {
            const groups: T[][] = [];
            for (let i = 0; i < items.length; i += size) {
                groups.push(items.slice(i, i + size));
            }
            return groups;
        }

        const loadPersonVesselHistory = async () => {
            const { data: entryPersonRows, error: entryPersonError } = await supabase
                .from("work_log_entry_persons")
                .select("entry_id, person_name")
                .in("person_name", allInvoicePeople);

            if (cancelled) {
                return;
            }

            if (entryPersonError) {
                console.error("인원별 호선 이력 참여자 조회 실패:", entryPersonError);
                return;
            }

            const normalizedPairs = (entryPersonRows ?? [])
                .map((row) => ({
                    entryId:
                        typeof row.entry_id === "number" ? row.entry_id : Number(row.entry_id),
                    person:
                        typeof row.person_name === "string"
                            ? row.person_name.trim()
                            : "",
                }))
                .filter((row) => Number.isFinite(row.entryId) && row.person);

            const entryIds = Array.from(
                new Set(normalizedPairs.map((row) => row.entryId))
            );

            if (entryIds.length === 0) {
                setPersonVesselHistoryByPerson({});
                return;
            }

            const entryRows: Array<{
                id: number;
                work_log_id: number;
                date_from: string | null;
                time_from: string | null;
            }> = [];
            for (const ids of chunk(entryIds, 500)) {
                const { data, error } = await supabase
                    .from("work_log_entries")
                    .select("id, work_log_id, date_from, time_from")
                    .in("id", ids);

                if (cancelled) {
                    return;
                }

                if (error) {
                    console.error("인원별 호선 이력 엔트리 조회 실패:", error);
                    return;
                }

                entryRows.push(...((data as typeof entryRows) ?? []));
            }

            const workLogIds = Array.from(
                new Set(
                    entryRows
                        .map((row) => row.work_log_id)
                        .filter((id) => Number.isFinite(id))
                )
            );

            const workLogRows: Array<{
                id: number;
                vessel: string | null;
                is_draft: boolean | null;
            }> = [];
            for (const ids of chunk(workLogIds, 500)) {
                const { data, error } = await supabase
                    .from("work_logs")
                    .select("id, vessel, is_draft")
                    .in("id", ids);

                if (cancelled) {
                    return;
                }

                if (error) {
                    console.error("인원별 호선 이력 보고서 조회 실패:", error);
                    return;
                }

                workLogRows.push(...((data as typeof workLogRows) ?? []));
            }

            const entryMetaById = new Map<
                number,
                {
                    workLogId: number;
                    dateFrom: string | null;
                    timeFrom: string | null;
                }
            >(
                entryRows.map((row) => [
                    row.id,
                    {
                        workLogId: row.work_log_id,
                        dateFrom: row.date_from,
                        timeFrom: row.time_from,
                    },
                ])
            );
            const vesselByWorkLogId = new Map<number, string>(
                workLogRows
                    .filter((row) => !row.is_draft && row.vessel?.trim())
                    .map((row) => [row.id, row.vessel!.trim()])
            );

            const sortedPairs = [...normalizedPairs].sort((a, b) => {
                const metaA = entryMetaById.get(a.entryId);
                const metaB = entryMetaById.get(b.entryId);
                const dateA = metaA?.dateFrom ?? "";
                const dateB = metaB?.dateFrom ?? "";
                if (dateA !== dateB) {
                    return dateA.localeCompare(dateB);
                }
                const timeA = metaA?.timeFrom ?? "00:00";
                const timeB = metaB?.timeFrom ?? "00:00";
                if (timeA !== timeB) {
                    return timeA.localeCompare(timeB);
                }
                return a.entryId - b.entryId;
            });

            const next = new Map<
                string,
                Map<string, { vessels: string[]; vesselSet: Set<string> }>
            >();
            sortedPairs.forEach(({ entryId, person }) => {
                const meta = entryMetaById.get(entryId);
                if (!meta?.dateFrom) {
                    return;
                }

                const vessel = vesselByWorkLogId.get(meta.workLogId);
                if (!vessel) {
                    return;
                }

                if (!next.has(person)) {
                    next.set(
                        person,
                        new Map<string, { vessels: string[]; vesselSet: Set<string> }>()
                    );
                }
                const byDate = next.get(person)!;
                if (!byDate.has(meta.dateFrom)) {
                    byDate.set(meta.dateFrom, {
                        vessels: [],
                        vesselSet: new Set<string>(),
                    });
                }
                const bucket = byDate.get(meta.dateFrom)!;
                if (!bucket.vesselSet.has(vessel)) {
                    bucket.vesselSet.add(vessel);
                    bucket.vessels.push(vessel);
                }
            });

            if (cancelled) {
                return;
            }

            setPersonVesselHistoryByPerson(
                Object.fromEntries(
                    Array.from(next.entries()).map(([person, byDate]) => [
                        person,
                        Array.from(byDate.entries())
                            .sort(([a], [b]) => a.localeCompare(b))
                            .map(([date, bucket]) => ({
                                date,
                                vessels: bucket.vessels,
                            })),
                    ])
                )
            );
        };

        void loadPersonVesselHistory();

        return () => {
            cancelled = true;
        };
    }, [allInvoicePeopleKey]);

    useEffect(() => {
        setSelectedSkilledFitters((previous) => {
            const validPrevious = previous.filter(
                (person) =>
                    SKILLED_FITTER_SET.has(person) &&
                    allTimesheetPeople.includes(person)
            );

            if (validPrevious.length > 0) {
                if (
                    validPrevious.length === previous.length &&
                    validPrevious.every((person, index) => person === previous[index])
                ) {
                    return previous;
                }

                return validPrevious;
            }

            const defaultSkilledFitter = pickDefaultSkilledFitterByEntryCount(
                allTimesheetPeople,
                workLogDataList
            );

            if (!defaultSkilledFitter) {
                return previous.length === 0 ? previous : [];
            }

            return previous.length === 1 && previous[0] === defaultSkilledFitter
                ? previous
                : [defaultSkilledFitter];
        });
    }, [allTimesheetPeopleKey, workLogDataList]);

    const getTimesheetRowsBySectionTitle = (sectionTitle: string) => {
        const normalSection = [
            ...normalTimesheetSectionsByPerson,
            ...normalTimesheetSectionsByDate,
        ].find((section) => section.title === sectionTitle);

        if (normalSection) {
            return normalSection.rows;
        }

        return timesheetRows;
    };

    const isTimesheetRowInteractive = (row: TimesheetRow) =>
        Object.values(getTimesheetRowModalValues(row)).some((value) => value !== "");

    const getTimesheetRowKey = (sectionTitle: string, row: TimesheetRow) =>
        `${sectionTitle}-${row.rowId}`;

    const getTimesheetDateGroupKey = (sectionTitle: string, row: TimesheetRow) =>
        `${sectionTitle}-${row.date}`;

    const isTimesheetDateGroupSelected = (
        sectionTitle: string,
        row: TimesheetRow
    ) =>
        selectedTimesheetDateGroupKeys.includes(
            getTimesheetDateGroupKey(sectionTitle, row)
        );

    const getOrderedTimesheetDateGroupKeys = (sectionTitle: string) => {
        const keys: string[] = [];
        const seen = new Set<string>();

        getTimesheetRowsBySectionTitle(sectionTitle).forEach((row) => {
            const key = getTimesheetDateGroupKey(sectionTitle, row);
            if (seen.has(key)) return;
            seen.add(key);
            keys.push(key);
        });

        return keys;
    };

    const getTimesheetDateGroupRows = (
        sectionTitle: string,
        row: TimesheetRow
    ) =>
        getTimesheetRowsBySectionTitle(sectionTitle).filter(
            (candidate) =>
                getTimesheetDateGroupKey(sectionTitle, candidate) ===
                getTimesheetDateGroupKey(sectionTitle, row)
        );

    const getTimesheetDateGroupRowsByKey = (sectionTitle: string, groupKey: string) =>
        getTimesheetRowsBySectionTitle(sectionTitle).filter(
            (candidate) => getTimesheetDateGroupKey(sectionTitle, candidate) === groupKey
        );

    const isFirstTimesheetDateGroupRow = (
        sectionTitle: string,
        row: TimesheetRow
    ) => getTimesheetDateGroupRows(sectionTitle, row)[0]?.rowId === row.rowId;

    const isLastTimesheetDateGroupRow = (
        sectionTitle: string,
        row: TimesheetRow
    ) => {
        const groupRows = getTimesheetDateGroupRows(sectionTitle, row);
        return groupRows[groupRows.length - 1]?.rowId === row.rowId;
    };

    const getSelectedTimesheetDateBlockKeys = (
        sectionTitle: string,
        row: TimesheetRow
    ) => {
        const orderedKeys = getOrderedTimesheetDateGroupKeys(sectionTitle);
        const currentKey = getTimesheetDateGroupKey(sectionTitle, row);
        const currentIndex = orderedKeys.indexOf(currentKey);

        if (
            currentIndex === -1 ||
            !selectedTimesheetDateGroupKeys.includes(currentKey)
        ) {
            return [];
        }

        let startIndex = currentIndex;
        let endIndex = currentIndex;

        while (
            startIndex > 0 &&
            selectedTimesheetDateGroupKeys.includes(orderedKeys[startIndex - 1])
        ) {
            startIndex -= 1;
        }

        while (
            endIndex < orderedKeys.length - 1 &&
            selectedTimesheetDateGroupKeys.includes(orderedKeys[endIndex + 1])
        ) {
            endIndex += 1;
        }

        return orderedKeys.slice(startIndex, endIndex + 1);
    };

    const isFirstSelectedTimesheetDateBlockGroup = (
        sectionTitle: string,
        row: TimesheetRow
    ) => getSelectedTimesheetDateBlockKeys(sectionTitle, row)[0] ===
        getTimesheetDateGroupKey(sectionTitle, row);

    const isLastSelectedTimesheetDateBlockGroup = (
        sectionTitle: string,
        row: TimesheetRow
    ) => {
        const blockKeys = getSelectedTimesheetDateBlockKeys(sectionTitle, row);
        return (
            blockKeys[blockKeys.length - 1] ===
            getTimesheetDateGroupKey(sectionTitle, row)
        );
    };

    const toggleTimesheetDateGroupSelection = (
        sectionTitle: string,
        row: TimesheetRow
    ) => {
        const groupKey = getTimesheetDateGroupKey(sectionTitle, row);
        const orderedKeys = getOrderedTimesheetDateGroupKeys(sectionTitle);
        setSelectedTimesheetDateGroupPanel(null);

        setSelectedTimesheetDateGroupKeys((previousKeys) => {
            const anchorKey =
                selectedTimesheetDateGroupAnchorKey &&
                orderedKeys.includes(selectedTimesheetDateGroupAnchorKey)
                    ? selectedTimesheetDateGroupAnchorKey
                    : null;

            if (previousKeys.length === 0 || !anchorKey) {
                setSelectedTimesheetDateGroupAnchorKey(groupKey);
                return [groupKey];
            }

            if (groupKey === anchorKey) {
                if (previousKeys.length === 1) {
                    setSelectedTimesheetDateGroupAnchorKey(null);
                    return [];
                }

                setSelectedTimesheetDateGroupAnchorKey(groupKey);
                return [groupKey];
            }

            const anchorIndex = orderedKeys.indexOf(anchorKey);
            const currentIndex = orderedKeys.indexOf(groupKey);

            if (anchorIndex === -1 || currentIndex === -1) {
                setSelectedTimesheetDateGroupAnchorKey(groupKey);
                return [groupKey];
            }

            const startIndex = Math.min(anchorIndex, currentIndex);
            const endIndex = Math.max(anchorIndex, currentIndex);
            return orderedKeys.slice(startIndex, endIndex + 1);
        });
    };

    const buildWorkLocationContextByDate = (
        rows: TimesheetRow[]
    ): WorkLocationContextByDate => {
        const locationsByDate = new Map<string, Map<string, Set<string>>>();

        rows.forEach((row) => {
            if (locationsByDate.has(row.date)) {
                return;
            }

            const dateEntries = rows
                .filter((candidate) => candidate.date === row.date)
                .flatMap((candidate) => candidate.sourceEntries)
                .filter(
                    (entry, index, entries) =>
                        entries.findIndex((candidate) => candidate.id === entry.id) ===
                        index
                )
                .sort((a, b) => {
                    const aStart = new Date(
                        `${a.dateFrom}T${a.timeFrom || "00:00"}`
                    ).getTime();
                    const bStart = new Date(
                        `${b.dateFrom}T${b.timeFrom || "00:00"}`
                    ).getTime();
                    return aStart - bStart;
                });

            const persons = Array.from(
                new Set(dateEntries.flatMap((entry) => entry.persons ?? []))
            );
            const locationsByPerson = new Map<string, Set<string>>();

            persons.forEach((person) => {
                const personEntries = dateEntries.filter((entry) =>
                    (entry.persons ?? []).includes(person)
                );
                let index = 0;
                let leadingTravelEntries: TimesheetSourceEntryData[] = [];
                while (
                    index < personEntries.length &&
                    personEntries[index].descType === "이동"
                ) {
                    leadingTravelEntries.push(personEntries[index]);
                    index += 1;
                }

                while (index < personEntries.length) {
                    const anchorEntries: TimesheetSourceEntryData[] = [];
                    while (
                        index < personEntries.length &&
                        personEntries[index].descType !== "이동"
                    ) {
                        anchorEntries.push(personEntries[index]);
                        index += 1;
                    }

                    if (anchorEntries.length === 0) {
                        break;
                    }

                    const trailingTravelEntries: TimesheetSourceEntryData[] = [];
                    while (
                        index < personEntries.length &&
                        personEntries[index].descType === "이동"
                    ) {
                        trailingTravelEntries.push(personEntries[index]);
                        index += 1;
                    }

                    const lastLeadingTravelEntry =
                        leadingTravelEntries[leadingTravelEntries.length - 1];
                    const firstTrailingTravelEntry = trailingTravelEntries[0];
                    const inferredPlace =
                        (lastLeadingTravelEntry
                            ? normalizeLocationName(
                                  getFinalDestination(
                                      lastLeadingTravelEntry as InvoiceTimesheetEntry
                                  )
                              )
                            : "") ||
                        (firstTrailingTravelEntry
                            ? normalizeLocationName(
                                  getTravelEntryOrigin(
                                      firstTrailingTravelEntry as InvoiceTimesheetEntry
                                  )
                              )
                            : "");

                    if (inferredPlace && inferredPlace !== "자택") {
                        if (!locationsByPerson.has(person)) {
                            locationsByPerson.set(person, new Set<string>());
                        }
                        locationsByPerson.get(person)!.add(inferredPlace);
                    }

                    leadingTravelEntries = trailingTravelEntries;
                }
            });

            locationsByDate.set(row.date, locationsByPerson);
        });

        return Object.fromEntries(
            Array.from(locationsByDate.entries()).map(
                ([date, locationsByPerson]) => [
                    date,
                    Object.fromEntries(
                        Array.from(locationsByPerson.entries()).map(
                            ([person, locations]) => [
                                person,
                                Array.from(locations).sort(),
                            ]
                        )
                    ),
                ]
            )
        );
    };

    const openTimesheetDateGroupPanel = (
        sectionTitle: string,
        row: TimesheetRow
    ) => {
        const blockKeys = getSelectedTimesheetDateBlockKeys(sectionTitle, row);
        if (blockKeys.length === 0) return;
        const workLocationContextByDate =
            buildWorkLocationContextByDate(timesheetRows);

        const fullGroupEntryMap = new Map<number, TimesheetSourceEntryData>();
        blockKeys.forEach((groupKey) => {
            getTimesheetDateGroupRowsByKey(sectionTitle, groupKey).forEach((groupRow) => {
                groupRow.sourceEntries.forEach((entry) => {
                    fullGroupEntryMap.set(entry.id, entry);
                });
            });
        });

        setSelectedTimesheetRow(null);
        const panelCalendarDates = Array.from(
            new Set(
                blockKeys.flatMap((groupKey) =>
                    getTimesheetDateGroupRowsByKey(sectionTitle, groupKey).map(
                        (groupRow) => groupRow.date
                    )
                )
            )
        ).sort();

        setSelectedTimesheetDateGroupPanel({
            blockKey: blockKeys.join("__"),
            sectionTitle,
            fullGroupEntries: Array.from(fullGroupEntryMap.values()).sort(
                compareTimesheetSourceEntriesByTimeThenId
            ),
            workLocationsByDate: workLocationContextByDate,
            panelCalendarDates,
        });
    };

    const getFullGroupEntriesForRows = (rows: TimesheetRow[]) => {
        const fullGroupEntryMap = new Map<number, TimesheetSourceEntryData>();

        rows.forEach((row) => {
            row.sourceEntries.forEach((entry) => {
                fullGroupEntryMap.set(entry.id, entry);
            });
        });

        return Array.from(fullGroupEntryMap.values()).sort(
            compareTimesheetSourceEntriesByTimeThenId
        );
    };

    const openTimesheetTotalPanel = (
        sectionTitle: string,
        rows: TimesheetRow[]
    ) => {
        const workLocationContextByDate =
            buildWorkLocationContextByDate(timesheetRows);
        setSelectedTimesheetRow(null);
        setSelectedTimesheetDateGroupKeys([]);
        setSelectedTimesheetDateGroupAnchorKey(null);
        const panelCalendarDates = Array.from(
            new Set(rows.map((r) => r.date))
        ).sort();

        setSelectedTimesheetDateGroupPanel({
            blockKey: `${sectionTitle}-total`,
            sectionTitle,
            fullGroupEntries: getFullGroupEntriesForRows(rows),
            workLocationsByDate: workLocationContextByDate,
            panelCalendarDates,
        });
    };

    const getTimesheetInteractiveCellProps = (
        sectionTitle: string,
        row: TimesheetRow
    ) => {
        if (!isTimesheetRowInteractive(row)) {
            return {};
        }

        return {
            "data-timesheet-row-trigger": "true",
            onMouseEnter: () =>
                setHoveredTimesheetRowKey(getTimesheetRowKey(sectionTitle, row)),
            onMouseLeave: () => setHoveredTimesheetRowKey(null),
            onClick: () => openTimesheetRowModal(sectionTitle, row),
        };
    };

    const getTimesheetDateHoverCellProps = (
        sectionTitle: string,
        row: TimesheetRow
    ) => ({
        onMouseEnter: () =>
            setHoveredTimesheetDateGroupKey(
                getTimesheetDateGroupKey(sectionTitle, row)
            ),
        onMouseLeave: () => setHoveredTimesheetDateGroupKey(null),
    });

    const getTimesheetDateSelectCellProps = (
        sectionTitle: string,
        row: TimesheetRow
    ) => ({
        "data-timesheet-date-group-cell": "true",
        onClick: () => toggleTimesheetDateGroupSelection(sectionTitle, row),
    });

    const getTimesheetRowPersonsKey = (row: TimesheetRow) =>
        row.description
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean)
            .sort()
            .join("|");
    /** 날짜 + 엔트리 id 집합만 사용 — 인원 교체 시에도 초기 스냅샷 키가 유지되어 시간·근무 표시가 오표시되지 않음 */
    const getTimesheetRowIdentityKey = (row: TimesheetRow) =>
        [
            row.date,
            Array.from(new Set(row.sourceEntries.map((entry) => entry.id)))
                .sort((a, b) => a - b)
                .join(","),
        ].join("::");
    const getTimesheetRowDisplayedValueSnapshot = (row: TimesheetRow) => ({
        timeFrom: row.timeFrom,
        timeTo: row.timeTo,
        totalHours: String(row.totalHours),
        weekdayNormal: row.weekdayNormal > 0 ? String(row.weekdayNormal) : "",
        weekdayAfter: row.weekdayAfter > 0 ? String(row.weekdayAfter) : "",
        weekendNormal: row.weekendNormal > 0 ? String(row.weekendNormal) : "",
        weekendAfter: row.weekendAfter > 0 ? String(row.weekendAfter) : "",
        travelWeekday:
            row.travelWeekdayDisplay ||
            (row.travelWeekday > 0 ? String(row.travelWeekday) : ""),
        travelWeekend:
            row.travelWeekendDisplay ||
            (row.travelWeekend > 0 ? String(row.travelWeekend) : ""),
        travelChargeOverrideSignature: getTravelChargeOverrideSignatureForRow(row),
    });

    const getOriginalTimesheetEntryPersons = useCallback(
        (entryId: number) => originalEntryPersonsByIdRef.current[entryId] ?? [],
        []
    );

    const getTimesheetEntryEditBaseline = useCallback(
        (entryId: number) => timesheetEntryEditBaselineByIdRef.current[entryId],
        []
    );
    const getTimesheetChangedValueTextClass = (
        isChanged: boolean,
        displayedText?: string
    ) =>
        isChanged && (displayedText ?? "").trim() !== ""
            ? "inline-block rounded border border-blue-500 px-1 py-0.5 align-middle text-blue-700"
            : "";
    const isTimesheetRowEditedFromBaseline = useCallback(
        (row: TimesheetRow) =>
            row.sourceEntries.some((entry) => {
                const baseline = timesheetEntryEditBaselineByIdRef.current[entry.id];
                if (!baseline) {
                    return false;
                }
                const currentManual = entryManualBillableHours[entry.id];
                const baselineManual = baseline.manualBillableHours;
                return (
                    baseline.descType !== entry.descType ||
                    baseline.dateFrom !== entry.dateFrom ||
                    baseline.dateTo !== entry.dateTo ||
                    baseline.timeFrom !== (entry.timeFrom ?? "") ||
                    baseline.timeTo !== (entry.timeTo ?? "") ||
                    (baselineManual ?? null) !== (currentManual ?? null)
                );
            }),
        [entryManualBillableHours]
    );
    const getTimesheetRowChangedFlags = useCallback(
        (row: TimesheetRow) => {
            const identity = getTimesheetRowIdentityKey(row);
            const baseline =
                initialTimesheetRowValueByIdentityRef.current[identity];
            const normOverrideSig = (v: string | undefined) => v ?? "";
            const overrideSigNow = getTravelChargeOverrideSignatureForRow(row);
            if (!baseline) {
                const fallbackChanged = isTimesheetRowEditedFromBaseline(row);
                const travelOverrideDirty = overrideSigNow !== "";
                return {
                    timeFrom: fallbackChanged,
                    timeTo: fallbackChanged,
                    totalHours: fallbackChanged,
                    weekdayNormal: fallbackChanged,
                    weekdayAfter: fallbackChanged,
                    weekendNormal: fallbackChanged,
                    weekendAfter: fallbackChanged,
                    travelWeekday: fallbackChanged || travelOverrideDirty,
                    travelWeekend: fallbackChanged || travelOverrideDirty,
                };
            }
            const current = getTimesheetRowDisplayedValueSnapshot(row);
            const overrideChanged =
                normOverrideSig(current.travelChargeOverrideSignature) !==
                normOverrideSig(
                    (
                        baseline as {
                            travelChargeOverrideSignature?: string;
                        }
                    ).travelChargeOverrideSignature
                );
            return {
                timeFrom: current.timeFrom !== baseline.timeFrom,
                timeTo: current.timeTo !== baseline.timeTo,
                totalHours: current.totalHours !== baseline.totalHours,
                weekdayNormal: current.weekdayNormal !== baseline.weekdayNormal,
                weekdayAfter: current.weekdayAfter !== baseline.weekdayAfter,
                weekendNormal: current.weekendNormal !== baseline.weekendNormal,
                weekendAfter: current.weekendAfter !== baseline.weekendAfter,
                travelWeekday:
                    current.travelWeekday !== baseline.travelWeekday ||
                    overrideChanged,
                travelWeekend:
                    current.travelWeekend !== baseline.travelWeekend ||
                    overrideChanged,
            };
        },
        [isTimesheetRowEditedFromBaseline, travelChargeOverrides]
    );

    /** 병합 행 비고: 원본 스냅샷에 없는 현재 이름(추가·교체)만 빨간 강조 — 슬롯 인덱스 비교 금지 */
    const getReplacedRemarkPersonNamesForRow = useCallback(
        (row: TimesheetRow) => {
            const replaced = new Set<string>();
            for (const entry of row.sourceEntries) {
                const orig = originalEntryPersonsByIdRef.current[entry.id] ?? [];
                const cur = entry.persons ?? [];
                if (orig.length === 0) {
                    continue;
                }
                const originalPersonSet = new Set(orig);
                for (const name of cur) {
                    if (name && !originalPersonSet.has(name)) {
                        replaced.add(name);
                    }
                }
            }
            return replaced;
        },
        []
    );

    const replaceTimesheetEntryPerson = useCallback(
        (args: { entryId: number; fromPerson: string; toPerson: string }) => {
            pushInvoiceUndoSnapshot();
            const { entryId, fromPerson, toPerson } = args;
            const patchEntryPersons = (
                entry: TimesheetSourceEntryData
            ): TimesheetSourceEntryData =>
                entry.id !== entryId
                    ? entry
                    : {
                          ...entry,
                          persons: (entry.persons ?? []).map((p) =>
                              p === fromPerson ? toPerson : p
                          ),
                      };

            setWorkLogDataList((prev) =>
                prev.map((wl) => ({
                    ...wl,
                    entries: wl.entries.map((en) =>
                        en.id !== entryId
                            ? en
                            : {
                                  ...en,
                                  persons: (en.persons ?? []).map((p) =>
                                      p === fromPerson ? toPerson : p
                                  ),
                              }
                    ),
                }))
            );

            setSelectedTimesheetRow((prev) => {
                if (!prev) {
                    return prev;
                }
                const touches =
                    prev.sourceEntries.some((e) => e.id === entryId) ||
                    prev.groupSourceEntries.some((e) => e.id === entryId);
                if (!touches) {
                    return prev;
                }
                return {
                    ...prev,
                    sourceEntries: prev.sourceEntries.map(patchEntryPersons),
                    groupSourceEntries:
                        prev.groupSourceEntries.map(patchEntryPersons),
                };
            });

            setSelectedTimesheetDateGroupPanel((prev) => {
                if (!prev) {
                    return prev;
                }
                if (!prev.fullGroupEntries.some((e) => e.id === entryId)) {
                    return prev;
                }
                return {
                    ...prev,
                    fullGroupEntries:
                        prev.fullGroupEntries.map(patchEntryPersons),
                };
            });

            setTravelChargeOverrides((prev) => {
                const oldKey = `${entryId}:${fromPerson}`;
                const newKey = `${entryId}:${toPerson}`;
                if (!prev[oldKey]) {
                    return prev;
                }
                const next = { ...prev };
                next[newKey] = next[oldKey];
                delete next[oldKey];
                return next;
            });
        },
        [pushInvoiceUndoSnapshot]
    );

    const mapWorkLogEntryToTimesheetSource = useCallback(
        (
            entry: WorkLogFullData["entries"][number],
            workLogId: number,
            location: string | null
        ): TimesheetSourceEntryData => ({
            id: entry.id,
            workLogId,
            dateFrom: entry.dateFrom,
            timeFrom: entry.timeFrom ?? "",
            dateTo: entry.dateTo,
            timeTo: entry.timeTo ?? "",
            descType: entry.descType,
            details: entry.details,
            persons: [...(entry.persons ?? [])],
            note: entry.note,
            moveFrom: entry.moveFrom,
            moveTo: entry.moveTo,
            location,
            lunchWorked: entry.lunch_worked,
            clientDuplicated: entry.clientDuplicated === true,
        }),
        []
    );

    type TimesheetEntryUpdatePayload = {
        entryId: number;
        descType: string;
        dateFrom: string;
        dateTo: string;
        timeFrom: string;
        timeTo: string;
        persons: string[];
        manualBillableHours: number | null;
    };

    const updateTimesheetEntry = useCallback(
        (payload: TimesheetEntryUpdatePayload) => {
            const prevList = latestInvoiceStateRef.current?.workLogDataList ?? [];
            let mapped: TimesheetSourceEntryData | null = null;
            const nextList = prevList.map((wl) => {
                const idx = wl.entries.findIndex((e) => e.id === payload.entryId);
                if (idx === -1) {
                    return wl;
                }
                const prevEn = wl.entries[idx];
                const nextEn: WorkLogFullData["entries"][number] = {
                    ...prevEn,
                    descType: payload.descType,
                    dateFrom: payload.dateFrom,
                    dateTo: payload.dateTo,
                    timeFrom: payload.timeFrom,
                    timeTo: payload.timeTo,
                    persons: [...payload.persons],
                    clientDuplicated: prevEn.clientDuplicated === true,
                };
                const entries = [...wl.entries];
                entries[idx] = nextEn;
                mapped = mapWorkLogEntryToTimesheetSource(
                    nextEn,
                    wl.workLog.id,
                    wl.workLog.location ?? null
                );
                return { ...wl, entries };
            });

            if (!mapped) {
                showError("엔트리를 찾을 수 없습니다.");
                return;
            }

            pushInvoiceUndoSnapshot();
            setWorkLogDataList(nextList);

            setEntryManualBillableHours((prev) => {
                const next = { ...prev };
                if (payload.manualBillableHours === null) {
                    delete next[payload.entryId];
                } else {
                    next[payload.entryId] = payload.manualBillableHours;
                }
                return next;
            });

            const mergePanel = (arr: TimesheetSourceEntryData[]) =>
                arr.map((e) => (e.id === payload.entryId ? mapped! : e));

            setSelectedTimesheetRow((p) =>
                p
                    ? {
                          ...p,
                          sourceEntries: mergePanel(p.sourceEntries),
                          groupSourceEntries: mergePanel(p.groupSourceEntries),
                      }
                    : p
            );

            setSelectedTimesheetDateGroupPanel((p) =>
                p && p.fullGroupEntries.some((e) => e.id === payload.entryId)
                    ? {
                          ...p,
                          fullGroupEntries: mergePanel(p.fullGroupEntries),
                      }
                    : p
            );

            showSuccess("엔트리를 저장했습니다.");
        },
        [
            mapWorkLogEntryToTimesheetSource,
            pushInvoiceUndoSnapshot,
            showError,
            showSuccess,
        ]
    );

    const resetSingleTimesheetEntryToInitial = useCallback(
        (entryId: number) => {
            const snap = initialWorkLogSnapshotRef.current;
            let fromSnap: WorkLogFullData["entries"][number] | undefined;
            if (snap) {
                for (const wl of snap) {
                    const e = wl.entries.find((en) => en.id === entryId);
                    if (e) {
                        fromSnap = e;
                        break;
                    }
                }
            }
            const baseline = timesheetEntryEditBaselineByIdRef.current[entryId];
            if (!fromSnap && !baseline) {
                showError("기본값 정보를 찾을 수 없습니다.");
                return;
            }

            const prevList =
                latestInvoiceStateRef.current?.workLogDataList ?? [];
            let mapped: TimesheetSourceEntryData | null = null;
            let found = false;

            const nextList = prevList.map((wl) => {
                const idx = wl.entries.findIndex((e) => e.id === entryId);
                if (idx === -1) {
                    return wl;
                }
                found = true;
                const cur = wl.entries[idx];
                const nextEn: WorkLogFullData["entries"][number] = fromSnap
                    ? (JSON.parse(
                          JSON.stringify(fromSnap)
                      ) as WorkLogFullData["entries"][number])
                    : {
                          ...cur,
                          descType: baseline!.descType,
                          dateFrom: baseline!.dateFrom,
                          dateTo: baseline!.dateTo,
                          timeFrom: baseline!.timeFrom,
                          timeTo: baseline!.timeTo,
                          persons: [
                              ...(originalEntryPersonsByIdRef.current[entryId] ??
                                  cur.persons ??
                                  []),
                          ],
                      };
                nextEn.clientDuplicated = cur.clientDuplicated === true;
                const entries = [...wl.entries];
                entries[idx] = nextEn;
                mapped = mapWorkLogEntryToTimesheetSource(
                    nextEn,
                    wl.workLog.id,
                    wl.workLog.location ?? null
                );
                return { ...wl, entries };
            });

            if (!found || !mapped) {
                showError("엔트리를 찾을 수 없습니다.");
                return;
            }

            pushInvoiceUndoSnapshot();
            setWorkLogDataList(nextList);

            setEntryManualBillableHours((prev) => {
                if (!(entryId in prev)) {
                    return prev;
                }
                const next = { ...prev };
                delete next[entryId];
                return next;
            });

            resetTravelChargeOverridesForEntry(entryId);

            const mergePanel = (arr: TimesheetSourceEntryData[]) =>
                arr.map((e) => (e.id === entryId ? mapped! : e));

            setSelectedTimesheetRow((p) =>
                p
                    ? {
                          ...p,
                          sourceEntries: mergePanel(p.sourceEntries),
                          groupSourceEntries: mergePanel(p.groupSourceEntries),
                      }
                    : p
            );

            setSelectedTimesheetDateGroupPanel((p) =>
                p && p.fullGroupEntries.some((e) => e.id === entryId)
                    ? {
                          ...p,
                          fullGroupEntries: mergePanel(p.fullGroupEntries),
                      }
                    : p
            );

            setTimesheetEntryEditorRemountTickById((prev) => ({
                ...prev,
                [entryId]: (prev[entryId] ?? 0) + 1,
            }));

            showSuccess("이 엔트리를 기본값으로 되돌렸습니다.");
        },
        [mapWorkLogEntryToTimesheetSource, pushInvoiceUndoSnapshot, showError, showSuccess]
    );

    const duplicateTimesheetEntry = useCallback(
        (entryId: number) => {
            let wlIndex = -1;
            let entryIndex = -1;
            for (let i = 0; i < workLogDataList.length; i++) {
                const j = workLogDataList[i].entries.findIndex((e) => e.id === entryId);
                if (j !== -1) {
                    wlIndex = i;
                    entryIndex = j;
                    break;
                }
            }
            if (wlIndex === -1 || entryIndex === -1) {
                return;
            }

            pushInvoiceUndoSnapshot();

            const wl = workLogDataList[wlIndex];
            const src = wl.entries[entryIndex];
            const newId = duplicateTimesheetEntryIdRef.current--;
            // persons는 타임시트 행·sourceEntryIds 집계에 쓰이므로 복제해둠(비고 UI는 패널에서 clientDuplicated로 공란 처리).
            const copyRaw: WorkLogFullData["entries"][number] = {
                ...src,
                id: newId,
                note: "",
                persons: [...(src.persons ?? [])],
                clientDuplicated: true,
            };

            setWorkLogDataList((prev) => {
                const next = [...prev];
                const w = next[wlIndex];
                const entries = [...w.entries];
                entries.splice(entryIndex + 1, 0, copyRaw);
                next[wlIndex] = { ...w, entries };
                return next;
            });

            originalEntryPersonsByIdRef.current[newId] = [
                ...(src.persons ?? []),
            ];
            timesheetEntryEditBaselineByIdRef.current[newId] = {
                descType: copyRaw.descType,
                dateFrom: copyRaw.dateFrom,
                dateTo: copyRaw.dateTo,
                timeFrom: copyRaw.timeFrom ?? "",
                timeTo: copyRaw.timeTo ?? "",
                manualBillableHours: undefined,
            };

            const panelEntry = mapWorkLogEntryToTimesheetSource(
                copyRaw,
                wl.workLog.id,
                wl.workLog.location ?? null
            );

            const insertAfter = (arr: TimesheetSourceEntryData[]) => {
                const i = arr.findIndex((e) => e.id === entryId);
                if (i === -1) {
                    return arr;
                }
                const out = [...arr];
                out.splice(i + 1, 0, panelEntry);
                return out;
            };

            setSelectedTimesheetRow((prev) => {
                if (!prev) {
                    return prev;
                }
                const inSource = prev.sourceEntries.some((e) => e.id === entryId);
                const inGroup = prev.groupSourceEntries.some((e) => e.id === entryId);
                if (!inSource && !inGroup) {
                    return prev;
                }
                return {
                    ...prev,
                    sourceEntries: inSource
                        ? insertAfter(prev.sourceEntries)
                        : prev.sourceEntries,
                    groupSourceEntries: inGroup
                        ? insertAfter(prev.groupSourceEntries)
                        : prev.groupSourceEntries,
                };
            });

            setSelectedTimesheetDateGroupPanel((prev) => {
                if (!prev) {
                    return prev;
                }
                if (!prev.fullGroupEntries.some((e) => e.id === entryId)) {
                    return prev;
                }
                return {
                    ...prev,
                    fullGroupEntries: insertAfter(prev.fullGroupEntries),
                };
            });

            showSuccess("엔트리를 복사했습니다.");
        },
        [
            workLogDataList,
            mapWorkLogEntryToTimesheetSource,
            showSuccess,
            pushInvoiceUndoSnapshot,
        ]
    );

    const deleteTimesheetEntry = useCallback(
        (entryId: number) => {
            let wlIndex = -1;
            for (let i = 0; i < workLogDataList.length; i++) {
                if (workLogDataList[i].entries.some((e) => e.id === entryId)) {
                    wlIndex = i;
                    break;
                }
            }
            if (wlIndex === -1) {
                showError("삭제할 엔트리를 찾을 수 없습니다.");
                return;
            }

            pushInvoiceUndoSnapshot();

            // 삭제 전 엔트리를 별도 보관(사이드 패널에서 조회)
            const w = workLogDataList[wlIndex];
            const targetEntry = w.entries.find((e) => e.id === entryId) ?? null;
            if (
                targetEntry &&
                targetEntry.clientDuplicated !== true
            ) {
                const panelEntry = mapWorkLogEntryToTimesheetSource(
                    targetEntry,
                    w.workLog.id,
                    w.workLog.location ?? null
                );
                setDeletedTimesheetEntries((prev) => {
                    // 같은 id가 여러 번 들어가지 않게
                    const next = prev.filter((e) => e.id !== entryId);
                    return [panelEntry, ...next];
                });
            }

            resetTravelChargeOverridesForEntry(entryId);
            delete originalEntryPersonsByIdRef.current[entryId];
            delete timesheetEntryEditBaselineByIdRef.current[entryId];
            setEntryManualBillableHours((prev) => {
                if (!(entryId in prev)) {
                    return prev;
                }
                const next = { ...prev };
                delete next[entryId];
                return next;
            });

            setWorkLogDataList((prev) => {
                const next = [...prev];
                const w = next[wlIndex];
                const entries = w.entries.filter((e) => e.id !== entryId);
                if (entries.length === w.entries.length) {
                    return prev;
                }
                next[wlIndex] = { ...w, entries };
                return next;
            });

            const removeFromSource = (arr: TimesheetSourceEntryData[]) =>
                arr.filter((e) => e.id !== entryId);

            setSelectedTimesheetRow((prev) => {
                if (!prev) {
                    return prev;
                }
                return {
                    ...prev,
                    sourceEntries: removeFromSource(prev.sourceEntries),
                    groupSourceEntries: removeFromSource(prev.groupSourceEntries),
                };
            });

            setSelectedTimesheetDateGroupPanel((prev) => {
                if (!prev) {
                    return prev;
                }
                return {
                    ...prev,
                    fullGroupEntries: removeFromSource(prev.fullGroupEntries),
                };
            });

            showSuccess("엔트리를 삭제했습니다.");
        },
        [
            workLogDataList,
            mapWorkLogEntryToTimesheetSource,
            showError,
            showSuccess,
            resetTravelChargeOverridesForEntry,
            pushInvoiceUndoSnapshot,
        ]
    );

    const restoreDeletedTimesheetEntriesBatch = useCallback(
        (entryIds: number[]) => {
            const idSet = new Set(entryIds);
            if (idSet.size === 0) {
                return;
            }
            const snap = latestInvoiceStateRef.current;
            if (!snap) {
                return;
            }
            const toRestore = snap.deletedTimesheetEntries.filter((e) =>
                idSet.has(e.id)
            );
            if (toRestore.length === 0) {
                showError("되돌릴 엔트리가 없습니다.");
                return;
            }

            for (const d of toRestore) {
                const wl = snap.workLogDataList.find(
                    (w) => w.workLog.id === d.workLogId
                );
                if (!wl) {
                    showError(
                        `작업일지 #${d.workLogId}를 찾을 수 없어 엔트리 #${d.id}를 복구할 수 없습니다.`
                    );
                    return;
                }
                if (wl.entries.some((e) => e.id === d.id)) {
                    showError(`엔트리 #${d.id}는 이미 복구되어 있습니다.`);
                    return;
                }
            }

            pushInvoiceUndoSnapshot();

            for (const d of toRestore) {
                const wlEntry = timesheetSourceToWorkLogEntry(d);
                originalEntryPersonsByIdRef.current[d.id] = [
                    ...(wlEntry.persons ?? []),
                ];
                timesheetEntryEditBaselineByIdRef.current[d.id] = {
                    descType: wlEntry.descType,
                    dateFrom: wlEntry.dateFrom,
                    dateTo: wlEntry.dateTo,
                    timeFrom: wlEntry.timeFrom ?? "",
                    timeTo: wlEntry.timeTo ?? "",
                };
            }

            setWorkLogDataList((prev) => {
                const next = [...prev];
                for (const d of toRestore) {
                    const wi = next.findIndex((w) => w.workLog.id === d.workLogId);
                    if (wi === -1) {
                        continue;
                    }
                    const wl = next[wi];
                    if (wl.entries.some((e) => e.id === d.id)) {
                        continue;
                    }
                    const wlEntry = timesheetSourceToWorkLogEntry(d);
                    next[wi] = {
                        ...wl,
                        entries: insertWorkLogEntrySorted(wl.entries, wlEntry),
                    };
                }
                return next;
            });

            setDeletedTimesheetEntries((prev) =>
                prev.filter((e) => !idSet.has(e.id))
            );

            setTimesheetEntryEditorRemountTickById((prev) => {
                const next = { ...prev };
                for (const d of toRestore) {
                    next[d.id] = (prev[d.id] ?? 0) + 1;
                }
                return next;
            });

            setSelectedTimesheetRow((prev) => {
                if (!prev) {
                    return prev;
                }
                let source = prev.sourceEntries;
                let group = prev.groupSourceEntries;
                const panelDates = new Set(
                    [...source, ...group].map((e) => e.dateFrom)
                );
                for (const d of toRestore) {
                    if (!panelDates.has(d.dateFrom)) {
                        continue;
                    }
                    const mapped = mapWorkLogEntryToTimesheetSource(
                        timesheetSourceToWorkLogEntry(d),
                        d.workLogId,
                        d.location ?? null
                    );
                    source = mergeRestoredPanelEntries(source, mapped);
                    group = mergeRestoredPanelEntries(group, mapped);
                }
                return { ...prev, sourceEntries: source, groupSourceEntries: group };
            });

            setSelectedTimesheetDateGroupPanel((prev) => {
                if (!prev) {
                    return prev;
                }
                let full = prev.fullGroupEntries;
                const panelDates = new Set(full.map((e) => e.dateFrom));
                for (const d of toRestore) {
                    if (!panelDates.has(d.dateFrom)) {
                        continue;
                    }
                    const mapped = mapWorkLogEntryToTimesheetSource(
                        timesheetSourceToWorkLogEntry(d),
                        d.workLogId,
                        d.location ?? null
                    );
                    full = mergeRestoredPanelEntries(full, mapped);
                }
                return { ...prev, fullGroupEntries: full };
            });

            const n = toRestore.length;
            showSuccess(
                n === 1
                    ? `엔트리 #${toRestore[0].id}를 되돌렸습니다.`
                    : `${n}개 엔트리를 되돌렸습니다.`
            );
        },
        [
            pushInvoiceUndoSnapshot,
            mapWorkLogEntryToTimesheetSource,
            showError,
            showSuccess,
        ]
    );

    const buildTimesheetRowModalData = useCallback(
        (sectionTitle: string, row: TimesheetRow): TimesheetRowModalData | null => {
            if (!isTimesheetRowInteractive(row)) {
                return null;
            }

            const workLocationContextByDate =
                buildWorkLocationContextByDate(timesheetRows);
            const selectedPersonsKey = getTimesheetRowPersonsKey(row);
            const sameDateRows = timesheetRows.filter(
                (candidate) => candidate.date === row.date
            );
            const hasDifferentGroupOnDate = sameDateRows.some((candidate) => {
                if (candidate.rowId === row.rowId) {
                    return false;
                }

                return getTimesheetRowPersonsKey(candidate) !== selectedPersonsKey;
            });
            const hasAnotherRowOnDate = sameDateRows.some(
                (candidate) => candidate.rowId !== row.rowId
            );

            const groupSourceEntryMap = new Map<number, TimesheetSourceEntryData>();
            if (hasDifferentGroupOnDate || hasAnotherRowOnDate) {
                sameDateRows.forEach((candidate) => {
                    candidate.sourceEntries.forEach((entry) => {
                        groupSourceEntryMap.set(entry.id, entry);
                    });
                });
            }

            return {
                rowKey: getTimesheetRowKey(sectionTitle, row),
                sectionTitle,
                selectedPersons: sectionTitle.startsWith("NORMAL TIMESHEET - ")
                    ? getRowPersons(row)
                    : [],
                day: row.day,
                dateFormatted: row.dateFormatted,
                timeFrom: row.timeFrom,
                timeTo: row.timeTo,
                description: row.description,
                sourceEntries: row.sourceEntries,
                groupSourceEntries: Array.from(groupSourceEntryMap.values()).sort(
                    compareTimesheetSourceEntriesByTimeThenId
                ),
                previousWorkLocations:
                    workLocationContextByDate[shiftDateByDays(row.date, -1)] ?? {},
                nextWorkLocations:
                    workLocationContextByDate[shiftDateByDays(row.date, 1)] ?? {},
                timesheetRowCalendarDate: row.date,
            };
        },
        [timesheetRows]
    );

    const openTimesheetRowModal = (sectionTitle: string, row: TimesheetRow) => {
        const data = buildTimesheetRowModalData(sectionTitle, row);
        if (!data) {
            return;
        }

        setSelectedTimesheetDateGroupPanel(null);
        setSelectedTimesheetRow(data);
    };

    useEffect(() => {
        setSelectedTimesheetRow((prev) => {
            if (!prev) {
                return prev;
            }
            const rowId = prev.rowKey.slice(prev.sectionTitle.length + 1);
            const row = getTimesheetRowsBySectionTitle(prev.sectionTitle).find(
                (r) => r.rowId === rowId
            );
            if (!row) {
                return prev;
            }
            const next = buildTimesheetRowModalData(prev.sectionTitle, row);
            if (!next) {
                return prev;
            }
            if (
                prev.description === next.description &&
                prev.sourceEntries.length === next.sourceEntries.length &&
                prev.sourceEntries.every((e, i) => {
                    const n = next.sourceEntries[i];
                    return (
                        n &&
                        e.id === n.id &&
                        (e.persons ?? []).join("|") === (n.persons ?? []).join("|")
                    );
                })
            ) {
                return prev;
            }
            return next;
        });
    }, [timesheetRows, buildTimesheetRowModalData]);

    useEffect(() => {
        setSelectedTimesheetDateGroupPanel((prev) => {
            if (!prev) {
                return prev;
            }

            let fullGroupEntries: TimesheetSourceEntryData[];

            if (prev.blockKey === `${prev.sectionTitle}-total`) {
                fullGroupEntries = getFullGroupEntriesForRows(
                    getTimesheetRowsBySectionTitle(prev.sectionTitle)
                );
            } else {
                const blockKeys = prev.blockKey.split("__");
                const fullGroupEntryMap = new Map<number, TimesheetSourceEntryData>();
                blockKeys.forEach((groupKey) => {
                    getTimesheetDateGroupRowsByKey(
                        prev.sectionTitle,
                        groupKey
                    ).forEach((groupRow) => {
                        groupRow.sourceEntries.forEach((entry) => {
                            fullGroupEntryMap.set(entry.id, entry);
                        });
                    });
                });
                fullGroupEntries = Array.from(fullGroupEntryMap.values()).sort(
                    compareTimesheetSourceEntriesByTimeThenId
                );
            }

            const workLocationsByDate =
                buildWorkLocationContextByDate(timesheetRows);
            const same =
                prev.fullGroupEntries.length === fullGroupEntries.length &&
                prev.fullGroupEntries.every((e, i) => {
                    const n = fullGroupEntries[i];
                    return n && isTimesheetSourceEntryPanelSyncEqual(e, n);
                });
            if (same) {
                return prev;
            }
            return {
                ...prev,
                fullGroupEntries,
                workLocationsByDate,
            };
        });
    }, [timesheetRows]);

    const getTimesheetRowStateClass = (
        sectionTitle: string,
        row: TimesheetRow
    ) => {
        const rowKey = getTimesheetRowKey(sectionTitle, row);

        if (selectedTimesheetRow?.rowKey === rowKey) {
            return "bg-blue-100";
        }

        if (hoveredTimesheetRowKey === rowKey) {
            return "bg-blue-50";
        }

        return "";
    };

    const getTimesheetDateGroupStateClass = (
        sectionTitle: string,
        row: TimesheetRow
    ) => {
        const groupKey = getTimesheetDateGroupKey(sectionTitle, row);

        if (selectedTimesheetDateGroupKeys.includes(groupKey)) {
            return "bg-blue-100";
        }

        if (hoveredTimesheetDateGroupKey === groupKey) {
            return "bg-blue-50";
        }

        return "";
    };

    const getTimesheetDateGroupBorderClass = (
        sectionTitle: string,
        row: TimesheetRow,
        cellType: "day" | "date"
    ) => {
        if (!isTimesheetDateGroupSelected(sectionTitle, row)) {
            return "";
        }

        return cellType === "date" ? "relative" : "";
    };

    const getTimesheetDateGroupBorderStyle = (
        sectionTitle: string,
        row: TimesheetRow,
        cellType: "day" | "date"
    ): React.CSSProperties => {
        if (!isTimesheetDateGroupSelected(sectionTitle, row)) {
            return {};
        }

        const shadows = [
            cellType === "day"
                ? "inset 2px 0 0 0 rgb(96 165 250)"
                : "inset -2px 0 0 0 rgb(96 165 250)",
        ];

        if (
            isFirstSelectedTimesheetDateBlockGroup(sectionTitle, row) &&
            isFirstTimesheetDateGroupRow(sectionTitle, row)
        ) {
            shadows.push("inset 0 2px 0 0 rgb(96 165 250)");
        }

        if (
            isLastSelectedTimesheetDateBlockGroup(sectionTitle, row) &&
            isLastTimesheetDateGroupRow(sectionTitle, row)
        ) {
            shadows.push("inset 0 -2px 0 0 rgb(96 165 250)");
        }

        const style: React.CSSProperties = {
            boxShadow: shadows.join(", "),
            transition:
                "box-shadow 520ms ease-out, background-color 220ms ease-out, border-radius 520ms ease-out",
        };

        if (
            isFirstSelectedTimesheetDateBlockGroup(sectionTitle, row) &&
            isFirstTimesheetDateGroupRow(sectionTitle, row)
        ) {
            if (cellType === "day") {
                style.borderTopLeftRadius = "10px";
            } else {
                style.borderTopRightRadius = "10px";
            }
        }

        if (
            isLastSelectedTimesheetDateBlockGroup(sectionTitle, row) &&
            isLastTimesheetDateGroupRow(sectionTitle, row)
        ) {
            if (cellType === "day") {
                style.borderBottomLeftRadius = "10px";
            } else {
                style.borderBottomRightRadius = "10px";
            }
        }

        return style;
    };

    const shouldShowTimesheetDateGroupBadge = (
        sectionTitle: string,
        row: TimesheetRow
    ) =>
        isTimesheetDateGroupSelected(sectionTitle, row) &&
        isFirstTimesheetDateGroupRow(sectionTitle, row) &&
        isFirstSelectedTimesheetDateBlockGroup(sectionTitle, row);

    useEffect(() => {
        if (selectedTimesheetDateGroupKeys.length === 0) return;

        const handlePointerDown = (event: MouseEvent) => {
            const target = event.target as HTMLElement | null;
            if (!target) return;

            if (
                target.closest('[data-timesheet-date-group-cell="true"]') ||
                target.closest('[data-timesheet-date-group-badge="true"]') ||
                target.closest('[data-timesheet-date-group-panel="true"]') ||
                target.closest("[data-base-modal='true']") ||
                target.closest('[data-app-toast="true"]')
            ) {
                return;
            }

            setSelectedTimesheetDateGroupKeys([]);
            setSelectedTimesheetDateGroupAnchorKey(null);
            setSelectedTimesheetDateGroupPanel(null);
        };

        document.addEventListener("mousedown", handlePointerDown);
        return () => document.removeEventListener("mousedown", handlePointerDown);
    }, [selectedTimesheetDateGroupKeys.length]);

    return (
        <div className="flex h-screen bg-white overflow-hidden font-pretendard">
            {/* Overlay - 사이드바가 열려있을 때만 표시 */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40"
                    onClick={handleSidebarClose}
                />
            )}

            {/* Sidebar - 접기/펼치기 가능 (데스크탑에서도 접기 가능) */}
            <div
                className={`
                    fixed inset-y-0 left-0 z-50
                    w-[260px] max-w-[88vw] lg:max-w-none lg:w-[239px] h-screen shrink-0
                    transform transition-transform duration-300 ease-in-out
                    ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
                `}
                onClick={(e) => e.stopPropagation()}
            >
                <Sidebar onClose={handleSidebarClose} showCloseOnDesktop={true} />
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <Header
                    title="인보이스 생성"
                    onMenuClick={handleMenuClick}
                    showMenuOnDesktop={true}
                />
                
                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
                    {loading ? (
                        <div className="flex items-center justify-center h-64">
                            <div className="text-gray-500">로딩 중...</div>
                        </div>
                    ) : workLogDataList.length === 0 ? (
                        <div className="flex items-center justify-center h-64">
                            <div className="text-gray-500">보고서를 선택해주세요.</div>
                        </div>
                    ) : (
                        <div className="max-w-full mx-auto">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* 좌측: R&D / NORMAL TIMESHEET */}
                                <div className="flex flex-col gap-6">
                                    {/* R&D / NORMAL TIMESHEET (좌측 상단 토글) */}
                                    {timesheetView === "rnd" ? (
                                    <div className="flex flex-col gap-6 bg-white border border-gray-200 rounded-xl p-6">
                                        <div className="flex items-center justify-between gap-3">
                                            <button
                                                type="button"
                                                onClick={() => setTimesheetView("normal")}
                                                className="group -mx-2 flex max-w-full shrink-0 items-center gap-3 rounded-lg px-2 py-1 text-left transition-colors hover:bg-gray-100"
                                                aria-label="switch to normal timesheet"
                                            >
                                                <h2 className="text-3xl font-bold text-black">
                                                    R&amp;D TIMESHEET
                                                </h2>
                                                <span className="shrink-0 text-sm font-semibold text-gray-500 opacity-0 transition-opacity group-hover:opacity-100">
                                                    NORMAL로 전환
                                                </span>
                                            </button>

                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (
                                                            selectedTimesheetDateGroupPanel?.blockKey ===
                                                            "ALL DATE GROUP DETAIL-total"
                                                        ) {
                                                            setSelectedTimesheetDateGroupPanel(
                                                                null
                                                            );
                                                            return;
                                                        }

                                                        openTimesheetTotalPanel(
                                                            "ALL DATE GROUP DETAIL",
                                                            timesheetRows
                                                        );
                                                    }}
                                                    className={[
                                                        "h-9 w-9 rounded-full border border-gray-200 bg-white text-gray-700 transition-colors hover:bg-gray-100",
                                                        selectedTimesheetDateGroupPanel?.blockKey ===
                                                        "ALL DATE GROUP DETAIL-total"
                                                            ? "bg-gray-100"
                                                            : null,
                                                    ]
                                                        .filter(Boolean)
                                                        .join(" ")}
                                                    aria-label="open all date group detail panel"
                                                    title="전체 Date Group"
                                                >
                                                    <svg
                                                        viewBox="0 0 24 24"
                                                        width="18"
                                                        height="18"
                                                        className="mx-auto block"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        strokeWidth="2"
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        aria-hidden="true"
                                                    >
                                                        <rect
                                                            x="4"
                                                            y="5"
                                                            width="16"
                                                            height="16"
                                                            rx="2"
                                                        />
                                                        <path d="M8 9h12" />
                                                        <path d="M8 13h12" />
                                                        <path d="M8 17h12" />
                                                        <path d="M6.5 9h.01" />
                                                        <path d="M6.5 13h.01" />
                                                        <path d="M6.5 17h.01" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>
                                    
                                    {/* Job Information Table */}
                                    <div className="flex flex-col gap-4 mb-6">
                                        <div className="border border-gray-300 rounded overflow-hidden">
                                            <table className="w-full text-sm border-collapse">
                                                <thead className="bg-gray-100">
                                                    <tr>
                                                        <th className="px-4 py-3 text-left font-semibold text-gray-900 border-b border-gray-300">SHIP NAME</th>
                                                        <th className="px-4 py-3 text-left font-semibold text-gray-900 border-b border-l border-gray-300">WORK PLACE</th>
                                                        <th className="px-4 py-3 text-left font-semibold text-gray-900 border-b border-l border-gray-300">Work order from</th>
                                                        <th className="px-4 py-3 text-left font-semibold text-gray-900 border-b border-l border-gray-300">P O No.</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    <tr>
                                                        <td className="px-4 py-2 text-gray-900 border-b border-gray-300">
                                                            {workLogDataList[0]?.workLog.vessel || ""}
                                                        </td>
                                                        <td className="px-4 py-2 text-gray-900 border-b border-l border-gray-300">
                                                            {mapWorkPlace(workLogDataList[0]?.workLog.location || null)}
                                                        </td>
                                                        <td className="px-4 py-2 text-gray-900 border-b border-l border-gray-300">
                                                            Everllence ELU KOREA
                                                        </td>
                                                        <td className="px-4 py-2 text-gray-900 border-b border-l border-gray-300"></td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                
                                    {/* Hours Logging Table */}
                                <div className="flex flex-col gap-4">
                                    <div className="border border-gray-300 rounded overflow-hidden">
                                        <table className="w-full table-fixed text-[11px] min-w-full border-collapse">
                                            <colgroup>
                                                <col className="w-[56px]" />
                                                <col className="w-[68px]" />
                                                <col className="w-[52px]" />
                                                <col className="w-[52px]" />
                                                <col className="w-[56px]" />
                                                <col className="w-[74px]" />
                                                <col className="w-[74px]" />
                                                <col className="w-[74px]" />
                                                <col className="w-[82px]" />
                                                <col className="w-[66px]" />
                                                <col className="w-[76px]" />
                                                <col className="w-[88px]" />
                                            </colgroup>
                                            <thead className="bg-gray-100">
                                                {/* 1행: Indication of date & time / Total Hours / Split of Hours / Meals & 숙박 */}
                                                <tr>
                                                    <th colSpan={4} className="px-1 py-2 text-center font-semibold text-gray-900 border-b border-r border-gray-300">
                                                        Indication of date &amp; time
                                                    </th>
                                                    <th rowSpan={3} className="px-1 py-2 text-center font-semibold text-gray-900 border-b border-r border-gray-300 leading-tight">
                                                        Total
                                                        <br />
                                                        Hours
                                                    </th>
                                                    <th colSpan={6} className="px-1 py-2 text-center font-semibold text-gray-900 border-b border-r border-gray-300">
                                                        Split of Hours
                                                    </th>
                                                    <th rowSpan={3} className="px-1 py-2 text-center font-semibold text-gray-900 border-b border-gray-300 leading-tight">
                                                        Meals
                                                        <br />
                                                        &amp;
                                                        <br />
                                                        숙박
                                                    </th>
                                                </tr>
                                                {/* 2행: Year/Day/Date/Time From/Time To + 상위 그룹 헤더 */}
                                                <tr>
                                                    <th className="px-1 py-2 text-center font-medium text-gray-700 border-b border-r border-gray-300">
                                                        Year
                                                    </th>
                                                    <th className="px-1 py-2 text-center font-medium text-gray-900 bg-white border-b border-r border-gray-300">
                                                        2026
                                                    </th>
                                                    <th rowSpan={2} className="px-1 py-2 text-center font-medium text-gray-700 border-b border-r border-gray-300 leading-tight">
                                                        Time
                                                        <br />
                                                        From
                                                    </th>
                                                    <th rowSpan={2} className="px-1 py-2 text-center font-medium text-gray-700 border-b border-r border-gray-300 leading-tight">
                                                        Time
                                                        <br />
                                                        To
                                                    </th>
                                                    <th colSpan={2} className="px-1 py-1 text-center font-medium text-gray-700 border-b border-r border-gray-300 leading-tight">
                                                        Weekdays
                                                        <br />
                                                        (with in normal working
                                                        <br />
                                                        hours,
                                                        <br />
                                                        08:00 to 17:00)
                                                    </th>
                                                    <th colSpan={2} className="px-1 py-1 text-center font-medium text-gray-700 border-b border-r border-gray-300 leading-tight">
                                                        Saturday, Sunday, and
                                                        <br />
                                                        local holidays
                                                    </th>
                                                    <th colSpan={2} className="px-1 py-1 text-center font-medium text-gray-700 border-b border-r border-gray-300 leading-tight">
                                                        Travel
                                                        <br />
                                                        Hours**
                                                    </th>
                                                </tr>
                                                {/* 3행: Day/Date 하위 헤더 + Split of Hours 하위 라벨 */}
                                                <tr>
                                                    <th className="px-1 py-1 text-center font-medium text-gray-700 border-b border-r border-gray-300">
                                                        Day
                                                    </th>
                                                    <th className="px-1 py-1 text-center font-medium text-gray-700 border-b border-r border-gray-300">
                                                        Date
                                                    </th>
                                                    <th className="px-1 py-1 text-center font-medium text-gray-700 border-b border-r border-gray-300 leading-tight">
                                                        Normal
                                                        <br />
                                                        Working
                                                    </th>
                                                    <th className="px-1 py-1 text-center font-medium text-gray-700 border-b border-r border-gray-300 leading-tight">
                                                        After Normal
                                                        <br />
                                                        Working
                                                    </th>
                                                    <th className="px-1 py-1 text-center font-medium text-gray-700 border-b border-r border-gray-300 leading-tight">
                                                        Normal
                                                        <br />
                                                        Working
                                                    </th>
                                                    <th className="px-1 py-1 text-center font-medium text-gray-700 border-b border-r border-gray-300 leading-tight">
                                                        After Normal
                                                        <br />
                                                        Working
                                                    </th>
                                                    <th className="px-1 py-1 text-center font-medium text-gray-700 border-b border-r border-gray-300">
                                                        Weekday
                                                    </th>
                                                    <th className="px-1 py-1 text-center font-medium text-gray-700 border-b border-r border-gray-300 leading-tight">
                                                        Weekend
                                                        <br />
                                                        / Holiday
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {timesheetRows.map((row) => (
                                                    <React.Fragment key={row.rowId}>
                                                        <tr
                                                            className="border-b border-gray-300"
                                                        >
                                                            <td
                                                                rowSpan={2}
                                                                className={`px-2 py-2 text-center border-r border-gray-300 cursor-pointer transition-colors duration-200 ${getTimesheetDateGroupStateClass("R&D TIMESHEET", row)} ${getTimesheetDateGroupBorderClass("R&D TIMESHEET", row, "day")}`}
                                                                style={getTimesheetDateGroupBorderStyle("R&D TIMESHEET", row, "day")}
                                                                {...getTimesheetDateHoverCellProps("R&D TIMESHEET", row)}
                                                                {...getTimesheetDateSelectCellProps("R&D TIMESHEET", row)}
                                                            >
                                                                {row.hideDayDate ? "" : row.day}
                                                            </td>
                                                            <td
                                                                rowSpan={2}
                                                                className={`px-2 py-2 text-center border-r border-gray-300 cursor-pointer transition-colors duration-200 ${getTimesheetDateGroupStateClass("R&D TIMESHEET", row)} ${getTimesheetDateGroupBorderClass("R&D TIMESHEET", row, "date")}`}
                                                                style={getTimesheetDateGroupBorderStyle("R&D TIMESHEET", row, "date")}
                                                                {...getTimesheetDateHoverCellProps("R&D TIMESHEET", row)}
                                                                {...getTimesheetDateSelectCellProps("R&D TIMESHEET", row)}
                                                            >
                                                                {shouldShowTimesheetDateGroupBadge(
                                                                    "R&D TIMESHEET",
                                                                    row
                                                                ) && (
                                                                    <button
                                                                        type="button"
                                                                        data-timesheet-date-group-badge="true"
                                                                        className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[11px] font-bold text-white shadow-sm hover:bg-blue-700"
                                                                        onClick={(event) => {
                                                                            event.stopPropagation();
                                                                            openTimesheetDateGroupPanel(
                                                                                "R&D TIMESHEET",
                                                                                row
                                                                            );
                                                                        }}
                                                                        aria-label="open date group detail"
                                                                    >
                                                                        i
                                                                    </button>
                                                                )}
                                                                {row.hideDayDate ? "" : row.dateFormatted}
                                                            </td>
                                                            <td rowSpan={2} className={`px-2 py-2 text-center border-r border-gray-300 cursor-pointer ${getTimesheetRowStateClass("R&D TIMESHEET", row)}`} {...getTimesheetInteractiveCellProps("R&D TIMESHEET", row)}>
                                                                <span className={getTimesheetChangedValueTextClass(getTimesheetRowChangedFlags(row).timeFrom, row.timeFrom)}>{row.timeFrom}</span>
                                                            </td>
                                                            <td rowSpan={2} className={`px-2 py-2 text-center border-r border-gray-300 cursor-pointer ${getTimesheetRowStateClass("R&D TIMESHEET", row)}`} {...getTimesheetInteractiveCellProps("R&D TIMESHEET", row)}>
                                                                <span className={getTimesheetChangedValueTextClass(getTimesheetRowChangedFlags(row).timeTo, row.timeTo)}>{row.timeTo}</span>
                                                            </td>
                                                            <td rowSpan={2} className={`px-2 py-2 text-center border-r border-gray-300 font-bold cursor-pointer ${getTimesheetRowStateClass("R&D TIMESHEET", row)}`} {...getTimesheetInteractiveCellProps("R&D TIMESHEET", row)}>
                                                                <span className={getTimesheetChangedValueTextClass(getTimesheetRowChangedFlags(row).totalHours, String(row.totalHours))}>{row.totalHours}</span>
                                                            </td>
                                                            {renderSplitHoursCells(
                                                                row,
                                                                "R&D TIMESHEET",
                                                                "px-2 py-2"
                                                            )}
                                                            {renderMealsCell(
                                                                "R&D TIMESHEET",
                                                                undefined,
                                                                timesheetRows,
                                                                row,
                                                                "px-2 py-2"
                                                            )}
                                                        </tr>
                                                        <tr
                                                            className="border-b border-gray-300"
                                                        >
                                                            <td colSpan={7} className={`px-2 py-1 text-left text-xs text-gray-600 cursor-pointer ${getTimesheetRowStateClass("R&D TIMESHEET", row)}`} {...getTimesheetInteractiveCellProps("R&D TIMESHEET", row)}>
                                                                {(() => {
                                                                    const replaced =
                                                                        getReplacedRemarkPersonNamesForRow(
                                                                            row
                                                                        );
                                                                    return getRowPersons(
                                                                        row
                                                                    ).map(
                                                                        (
                                                                            person,
                                                                            idx
                                                                        ) => (
                                                                            <React.Fragment
                                                                                key={`${row.rowId}-rd-desc-${idx}`}
                                                                            >
                                                                                {idx >
                                                                                0 ? (
                                                                                    <span className="text-gray-500">
                                                                                        ,{" "}
                                                                                    </span>
                                                                                ) : null}
                                                                                <span
                                                                                    className={
                                                                                        replaced.has(
                                                                                            person
                                                                                        )
                                                                                            ? "inline-block rounded border border-blue-500 px-1 py-0.5 font-bold text-blue-700"
                                                                                            : ""
                                                                                    }
                                                                                >
                                                                                    {
                                                                                        person
                                                                                    }
                                                                                </span>
                                                                            </React.Fragment>
                                                                        )
                                                                    );
                                                                })()}
                                                            </td>
                                                        </tr>
                                                    </React.Fragment>
                                                ))}
                                                {/* Total Row */}
                                                {timesheetRows.length > 0 && (
                                                        <tr className="bg-gray-100 font-semibold">
                                                            <td
                                                                colSpan={4}
                                                                className="px-2 py-2 text-center border-r border-gray-300 cursor-pointer transition-colors hover:bg-blue-50"
                                                                onClick={() =>
                                                                    openTimesheetTotalPanel(
                                                                        "R&D TIMESHEET",
                                                                        timesheetRows
                                                                    )
                                                                }
                                                            >
                                                                Total
                                                            </td>
                                                        <td className="px-2 py-2 text-center border-r border-gray-300 font-bold">
                                                            {Math.round(timesheetRows.reduce((sum, row) => sum + row.totalHours, 0) * 10) / 10}
                                                        </td>
                                                        <td className="px-2 py-2 text-center border-r border-gray-300 font-bold">
                                                            {Math.round(timesheetRows.reduce((sum, row) => sum + row.weekdayNormal, 0) * 10) / 10}
                                                        </td>
                                                        <td className="px-2 py-2 text-center border-r border-gray-300 font-bold">
                                                            {Math.round(timesheetRows.reduce((sum, row) => sum + row.weekdayAfter, 0) * 10) / 10}
                                                        </td>
                                                        <td className="px-2 py-2 text-center border-r border-gray-300 font-bold">
                                                            {Math.round(timesheetRows.reduce((sum, row) => sum + row.weekendNormal, 0) * 10) / 10}
                                                        </td>
                                                        <td className="px-2 py-2 text-center border-r border-gray-300 font-bold">
                                                            {Math.round(timesheetRows.reduce((sum, row) => sum + row.weekendAfter, 0) * 10) / 10}
                                                        </td>
                                                        <td className="px-2 py-2 text-center border-r border-gray-300 font-bold">
                                                            {Math.round(timesheetRows.reduce((sum, row) => sum + row.travelWeekday, 0) * 10) / 10}
                                                        </td>
                                                        <td className="px-2 py-2 text-center border-r border-gray-300 font-bold">
                                                            {Math.round(timesheetRows.reduce((sum, row) => sum + row.travelWeekend, 0) * 10) / 10}
                                                        </td>
                                                        <td className="px-0 py-2 text-center font-bold">
                                                            <div className="flex min-h-[20px] w-full items-stretch">
                                                                <div className="flex min-w-0 flex-1 items-center justify-center border-r border-gray-200 px-0.5">
                                                                    {getSectionMealsTotal(
                                                                        "R&D TIMESHEET",
                                                                        undefined,
                                                                        timesheetRows
                                                                    )}
                                                                </div>
                                                                {(() => {
                                                                    const lodgingTotal =
                                                                        getSectionLodgingArrivalTotal(
                                                                            "R&D TIMESHEET",
                                                                            undefined,
                                                                            timesheetRows
                                                                        );
                                                                    return (
                                                                        <div
                                                                            className={`flex min-w-0 flex-1 items-center justify-center px-0.5 tabular-nums ${
                                                                                lodgingTotal > 0
                                                                                    ? "font-semibold text-gray-900"
                                                                                    : "text-gray-400"
                                                                            }`}
                                                                        >
                                                                            {lodgingTotal}
                                                                        </div>
                                                                    );
                                                                })()}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                            </div>
                                            <div className="text-sm text-gray-700">
                                                <span className="font-semibold text-gray-900">
                                                    Comments :
                                                </span>{" "}
                                                {rndTimesheetComments.length > 0 ? (
                                                    <div className="mt-2 flex flex-col gap-1">
                                                        {rndTimesheetComments.map((comment) => (
                                                            <div key={comment}>{comment}</div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-400">-</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    ) : (() => {
                                    const normalTimesheetSections =
                                        normalTimesheetGrouping === "date"
                                            ? normalTimesheetSectionsByDate
                                            : normalTimesheetSectionsByPerson;
                                    const total = normalTimesheetSections.length;
                                    const safeIndex =
                                        total === 0
                                            ? 0
                                            : Math.min(
                                                  Math.max(normalTimesheetIndex, 0),
                                                  total - 1
                                              );
                                    const section =
                                        total === 0 ? null : normalTimesheetSections[safeIndex];
                                    const sectionComments = section
                                        ? getNormalTimesheetComments(section)
                                        : [];

                                    return (
                                    <div className="flex flex-col gap-4 bg-white border border-gray-200 rounded-xl p-6">
                                        <div className="flex items-center justify-between gap-3">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setTimesheetView("rnd");
                                                    setSelectedTimesheetDateGroupPanel(
                                                        null
                                                    );
                                                }}
                                                className="group -mx-2 flex items-center gap-3 rounded-lg px-2 py-1 text-left transition-colors hover:bg-gray-100"
                                                aria-label="switch to rnd timesheet"
                                            >
                                                <h2 className="text-3xl font-bold text-black">
                                                    {section?.title ?? "NORMAL TIMESHEET"}
                                                </h2>
                                                <span className="text-sm font-semibold text-gray-500 opacity-0 transition-opacity group-hover:opacity-100">
                                                    R&amp;D로 전환
                                                </span>
                                            </button>

                                            <div className="flex items-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            if (
                                                                selectedTimesheetDateGroupPanel?.blockKey ===
                                                                "ALL DATE GROUP DETAIL-total"
                                                            ) {
                                                                setSelectedTimesheetDateGroupPanel(
                                                                    null
                                                                );
                                                                return;
                                                            }

                                                            openTimesheetTotalPanel(
                                                                "ALL DATE GROUP DETAIL",
                                                                timesheetRows
                                                            );
                                                        }}
                                                        className={[
                                                            "h-9 w-9 rounded-full border border-gray-200 bg-white text-gray-700 transition-colors hover:bg-gray-100",
                                                            selectedTimesheetDateGroupPanel?.blockKey ===
                                                            "ALL DATE GROUP DETAIL-total"
                                                                ? "bg-gray-100"
                                                                : null,
                                                        ]
                                                            .filter(Boolean)
                                                            .join(" ")}
                                                        aria-label="open all date group detail panel"
                                                        title="전체 Date Group"
                                                    >
                                                        <svg
                                                            viewBox="0 0 24 24"
                                                            width="18"
                                                            height="18"
                                                            className="mx-auto block"
                                                            fill="none"
                                                            stroke="currentColor"
                                                            strokeWidth="2"
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            aria-hidden="true"
                                                        >
                                                            {/* 전체 Date Group(전체 날짜 테이블) 아이콘 */}
                                                            <rect
                                                                x="4"
                                                                y="5"
                                                                width="16"
                                                                height="16"
                                                                rx="2"
                                                            />
                                                            <path d="M8 9h12" />
                                                            <path d="M8 13h12" />
                                                            <path d="M8 17h12" />
                                                            <path d="M6.5 9h.01" />
                                                            <path d="M6.5 13h.01" />
                                                            <path d="M6.5 17h.01" />
                                                        </svg>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setNormalTimesheetGrouping((prev) =>
                                                                prev === "person"
                                                                    ? "date"
                                                                    : "person"
                                                            );
                                                            setNormalTimesheetIndex(0);
                                                        }}
                                                        className="h-9 w-9 rounded-full border border-gray-200 bg-white text-gray-700 transition-colors hover:bg-gray-100"
                                                        aria-label={
                                                            normalTimesheetGrouping === "person"
                                                                ? "switch to date grouped normal timesheet"
                                                                : "switch to person grouped normal timesheet"
                                                        }
                                                        title={
                                                            normalTimesheetGrouping === "person"
                                                                ? "날짜별 보기"
                                                                : "인원별 보기"
                                                        }
                                                    >
                                                        {normalTimesheetGrouping === "person" ? (
                                                            <svg
                                                                viewBox="0 0 24 24"
                                                                width="18"
                                                                height="18"
                                                                className="mx-auto"
                                                                fill="currentColor"
                                                                aria-hidden="true"
                                                            >
                                                                <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5Z" />
                                                            </svg>
                                                        ) : (
                                                            <svg
                                                                viewBox="0 0 24 24"
                                                                width="18"
                                                                height="18"
                                                                className="mx-auto block"
                                                                fill="none"
                                                                stroke="currentColor"
                                                                strokeWidth="2"
                                                                strokeLinecap="round"
                                                                strokeLinejoin="round"
                                                                aria-hidden="true"
                                                            >
                                                                <rect x="4" y="5" width="16" height="15" rx="2" />
                                                                <path d="M8 3v4M16 3v4M4 10h16" />
                                                            </svg>
                                                        )}
                                                    </button>
                                                    {total > 1 ? (
                                                        <>
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setNormalTimesheetIndex((prev) =>
                                                                Math.max(0, prev - 1)
                                                            )
                                                        }
                                                        disabled={safeIndex <= 0}
                                                        className="h-9 w-9 rounded-full border border-gray-200 bg-white text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-white"
                                                        aria-label="previous normal timesheet"
                                                    >
                                                        ←
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setNormalTimesheetIndex((prev) =>
                                                                Math.min(total - 1, prev + 1)
                                                            )
                                                        }
                                                        disabled={safeIndex >= total - 1}
                                                        className="h-9 w-9 rounded-full border border-gray-200 bg-white text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-white"
                                                        aria-label="next normal timesheet"
                                                    >
                                                        →
                                                    </button>
                                                        </>
                                                    ) : null}
                                                </div>
                                        </div>

                                        {section ? (
                                            <>

                                                    <div className="grid grid-cols-4 gap-4">
                                                        {(() => {
                                                            const sectionPersonnel =
                                                                getPersonnelDisplayData(
                                                                    section.key,
                                                                    section.people
                                                                );

                                                            return (
                                                                <>
                                                                    <div className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col">
                                                                        <div className="text-xs font-semibold text-gray-700 mb-2">SHIP NAME</div>
                                                                        <div className="text-sm text-gray-900">{shipNameDisplay}</div>
                                                                    </div>
                                                                    {renderEditablePersonnelCard(
                                                                        "Engineer Name and Title",
                                                                        sectionPersonnel.engineerDisplay,
                                                                        section.key,
                                                                        section.title,
                                                                        "engineer",
                                                                        section.people
                                                                    )}
                                                                    <div className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col">
                                                                        <div className="text-xs font-semibold text-gray-700 mb-2">Work Order From</div>
                                                                        <div className="text-sm text-gray-900">{workOrderFromDisplay}</div>
                                                                    </div>
                                                                    <div className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col">
                                                                        <div className="text-xs font-semibold text-gray-700 mb-2">Departure date &amp; time, from place</div>
                                                                        <div className="text-sm text-gray-900">
                                                                            {getBoundaryDisplay(section.rows, "departure")}
                                                                        </div>
                                                                    </div>
                                                                    <div className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col">
                                                                        <div className="text-xs font-semibold text-gray-700 mb-2">WORK PLACE</div>
                                                                        <div className="text-sm text-gray-900">{workPlaceDisplay}</div>
                                                                    </div>
                                                                    {renderEditablePersonnelCard(
                                                                        "Mechanic names and numbers",
                                                                        sectionPersonnel.mechanicDisplay,
                                                                        section.key,
                                                                        section.title,
                                                                        "mechanic",
                                                                        section.people
                                                                    )}
                                                                    <div className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col">
                                                                        <div className="text-xs font-semibold text-gray-700 mb-2">P.O No.</div>
                                                                        <div className="text-sm text-gray-900"></div>
                                                                    </div>
                                                                    <div className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col">
                                                                        <div className="text-xs font-semibold text-gray-700 mb-2">Return date &amp; time, to place</div>
                                                                        <div className="text-sm text-gray-900">
                                                                            {getBoundaryDisplay(section.rows, "return")}
                                                                        </div>
                                                                    </div>
                                                                </>
                                                            );
                                                        })()}
                                                    </div>

                                                    <div className="flex flex-col gap-4">
                                                        <div className="border border-gray-300 rounded overflow-hidden">
                                                            <table className="w-full table-fixed text-[11px] min-w-full border-collapse">
                                                                <colgroup>
                                                                    <col className="w-[56px]" />
                                                                    <col className="w-[68px]" />
                                                                    <col className="w-[52px]" />
                                                                    <col className="w-[52px]" />
                                                                    <col className="w-[56px]" />
                                                                    <col className="w-[74px]" />
                                                                    <col className="w-[74px]" />
                                                                    <col className="w-[74px]" />
                                                                    <col className="w-[82px]" />
                                                                    <col className="w-[66px]" />
                                                                    <col className="w-[76px]" />
                                                                    <col className="w-[88px]" />
                                                                </colgroup>
                                                                <thead className="bg-gray-100">
                                                                    <tr>
                                                                        <th colSpan={4} className="px-1 py-2 text-center font-semibold text-gray-900 border-b border-r border-gray-300">
                                                                            Indication of date &amp; time
                                                                        </th>
                                                                        <th rowSpan={3} className="px-1 py-2 text-center font-semibold text-gray-900 border-b border-r border-gray-300 leading-tight">
                                                                            Total<br />Hours
                                                                        </th>
                                                                        <th colSpan={6} className="px-1 py-2 text-center font-semibold text-gray-900 border-b border-r border-gray-300">
                                                                            Split of Hours
                                                                        </th>
                                                                        <th rowSpan={3} className="px-1 py-2 text-center font-semibold text-gray-900 border-b border-gray-300 leading-tight">
                                                                            Meals
                                                                            <br />
                                                                            &amp;
                                                                            <br />
                                                                            숙박
                                                                        </th>
                                                                    </tr>
                                                                    <tr>
                                                                        <th className="px-1 py-2 text-center font-medium text-gray-700 border-b border-r border-gray-300">
                                                                            Year
                                                                        </th>
                                                                        <th className="px-1 py-2 text-center font-medium text-gray-900 bg-white border-b border-r border-gray-300">
                                                                            {section.rows.length > 0 ? section.rows[0].date.split("-")[0] : new Date().getFullYear()}
                                                                        </th>
                                                                        <th rowSpan={2} className="px-1 py-2 text-center font-medium text-gray-700 border-b border-r border-gray-300 leading-tight">
                                                                            Time<br />From
                                                                        </th>
                                                                        <th rowSpan={2} className="px-1 py-2 text-center font-medium text-gray-700 border-b border-r border-gray-300 leading-tight">
                                                                            Time<br />To
                                                                        </th>
                                                                        <th colSpan={2} className="px-1 py-1 text-center font-medium text-gray-700 border-b border-r border-gray-300 leading-tight">
                                                                            Weekdays<br />(with in normal working<br />hours,<br />08:00 to 17:00)
                                                                        </th>
                                                                        <th colSpan={2} className="px-1 py-1 text-center font-medium text-gray-700 border-b border-r border-gray-300 leading-tight">
                                                                            Saturday, Sunday, and<br />local holidays
                                                                        </th>
                                                                        <th colSpan={2} className="px-1 py-1 text-center font-medium text-gray-700 border-b border-r border-gray-300 leading-tight">
                                                                            Travel<br />Hours**
                                                                        </th>
                                                                    </tr>
                                                                    <tr>
                                                                        <th className="px-1 py-1 text-center font-medium text-gray-700 border-b border-r border-gray-300">
                                                                            Day
                                                                        </th>
                                                                        <th className="px-1 py-1 text-center font-medium text-gray-700 border-b border-r border-gray-300">
                                                                            Date
                                                                        </th>
                                                                        <th className="px-1 py-1 text-center font-medium text-gray-700 border-b border-r border-gray-300 leading-tight">
                                                                            Normal<br />Working
                                                                        </th>
                                                                        <th className="px-1 py-1 text-center font-medium text-gray-700 border-b border-r border-gray-300 leading-tight">
                                                                            After Normal<br />Working
                                                                        </th>
                                                                        <th className="px-1 py-1 text-center font-medium text-gray-700 border-b border-r border-gray-300 leading-tight">
                                                                            Normal<br />Working
                                                                        </th>
                                                                        <th className="px-1 py-1 text-center font-medium text-gray-700 border-b border-r border-gray-300 leading-tight">
                                                                            After Normal<br />Working
                                                                        </th>
                                                                        <th className="px-1 py-1 text-center font-medium text-gray-700 border-b border-r border-gray-300">
                                                                            Weekday
                                                                        </th>
                                                                        <th className="px-1 py-1 text-center font-medium text-gray-700 border-b border-r border-gray-300 leading-tight">
                                                                            Weekend<br />/ Holiday
                                                                        </th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {section.rows.map((row) => (
                                                                        <tr
                                                                            key={row.rowId}
                                                                            className="border-b border-gray-300"
                                                                        >
                                                                            <td
                                                                                className={`px-2 py-3 text-center border-r border-gray-300 cursor-pointer transition-colors duration-200 ${getTimesheetDateGroupStateClass(section.title, row)} ${getTimesheetDateGroupBorderClass(section.title, row, "day")}`}
                                                                                style={getTimesheetDateGroupBorderStyle(section.title, row, "day")}
                                                                                {...getTimesheetDateHoverCellProps(section.title, row)}
                                                                                {...getTimesheetDateSelectCellProps(section.title, row)}
                                                                            >
                                                                                {row.hideDayDate ? "" : row.day}
                                                                            </td>
                                                                            <td
                                                                                className={`px-2 py-3 text-center border-r border-gray-300 cursor-pointer transition-colors duration-200 ${getTimesheetDateGroupStateClass(section.title, row)} ${getTimesheetDateGroupBorderClass(section.title, row, "date")}`}
                                                                                style={getTimesheetDateGroupBorderStyle(section.title, row, "date")}
                                                                                {...getTimesheetDateHoverCellProps(section.title, row)}
                                                                                {...getTimesheetDateSelectCellProps(section.title, row)}
                                                                            >
                                                                                {shouldShowTimesheetDateGroupBadge(
                                                                                    section.title,
                                                                                    row
                                                                                ) && (
                                                                                    <button
                                                                                        type="button"
                                                                                        data-timesheet-date-group-badge="true"
                                                                                        className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[11px] font-bold text-white shadow-sm hover:bg-blue-700"
                                                                                        onClick={(event) => {
                                                                                            event.stopPropagation();
                                                                                            openTimesheetDateGroupPanel(
                                                                                                section.title,
                                                                                                row
                                                                                            );
                                                                                        }}
                                                                                        aria-label="open date group detail"
                                                                                    >
                                                                                        i
                                                                                    </button>
                                                                                )}
                                                                                {row.hideDayDate ? "" : row.dateFormatted}
                                                                            </td>
                                                                            <td className={`px-2 py-3 text-center border-r border-gray-300 cursor-pointer ${getTimesheetRowStateClass(section.title, row)}`} {...getTimesheetInteractiveCellProps(section.title, row)}>
                                                                                <span className={getTimesheetChangedValueTextClass(getTimesheetRowChangedFlags(row).timeFrom, row.timeFrom)}>{row.timeFrom}</span>
                                                                            </td>
                                                                            <td className={`px-2 py-3 text-center border-r border-gray-300 cursor-pointer ${getTimesheetRowStateClass(section.title, row)}`} {...getTimesheetInteractiveCellProps(section.title, row)}>
                                                                                <span className={getTimesheetChangedValueTextClass(getTimesheetRowChangedFlags(row).timeTo, row.timeTo)}>{row.timeTo}</span>
                                                                            </td>
                                                                            <td className={`px-2 py-3 text-center border-r border-gray-300 font-bold cursor-pointer ${getTimesheetRowStateClass(section.title, row)}`} {...getTimesheetInteractiveCellProps(section.title, row)}>
                                                                                <span className={getTimesheetChangedValueTextClass(getTimesheetRowChangedFlags(row).totalHours, String(row.totalHours))}>{row.totalHours}</span>
                                                                            </td>
                                                                            {renderSplitHoursCells(
                                                                                row,
                                                                                section.title,
                                                                                "px-2 py-3"
                                                                            )}
                                                                            {renderMealsCell(
                                                                                section.title,
                                                                                section.key,
                                                                                section.rows,
                                                                                row,
                                                                                "px-2 py-3"
                                                                            )}
                                                                        </tr>
                                                                    ))}
                                                                    {section.rows.length > 0 && (
                                                                        <tr className="bg-gray-100 font-semibold">
                                                                            <td
                                                                                colSpan={4}
                                                                                className="px-2 py-2 text-center border-r border-gray-300 cursor-pointer transition-colors hover:bg-blue-50"
                                                                                onClick={() =>
                                                                                    openTimesheetTotalPanel(
                                                                                        section.title,
                                                                                        section.rows
                                                                                    )
                                                                                }
                                                                            >
                                                                                Total
                                                                            </td>
                                                                            <td className="px-2 py-2 text-center border-r border-gray-300 font-bold">
                                                                                {Math.round(section.rows.reduce((sum, row) => sum + row.totalHours, 0) * 10) / 10}
                                                                            </td>
                                                                            <td className="px-2 py-2 text-center border-r border-gray-300 font-bold">
                                                                                {Math.round(section.rows.reduce((sum, row) => sum + row.weekdayNormal, 0) * 10) / 10}
                                                                            </td>
                                                                            <td className="px-2 py-2 text-center border-r border-gray-300 font-bold">
                                                                                {Math.round(section.rows.reduce((sum, row) => sum + row.weekdayAfter, 0) * 10) / 10}
                                                                            </td>
                                                                            <td className="px-2 py-2 text-center border-r border-gray-300 font-bold">
                                                                                {Math.round(section.rows.reduce((sum, row) => sum + row.weekendNormal, 0) * 10) / 10}
                                                                            </td>
                                                                            <td className="px-2 py-2 text-center border-r border-gray-300 font-bold">
                                                                                {Math.round(section.rows.reduce((sum, row) => sum + row.weekendAfter, 0) * 10) / 10}
                                                                            </td>
                                                                            <td className="px-2 py-2 text-center border-r border-gray-300 font-bold">
                                                                                {Math.round(section.rows.reduce((sum, row) => sum + row.travelWeekday, 0) * 10) / 10}
                                                                            </td>
                                                                            <td className="px-2 py-2 text-center border-r border-gray-300 font-bold">
                                                                                {Math.round(section.rows.reduce((sum, row) => sum + row.travelWeekend, 0) * 10) / 10}
                                                                            </td>
                                                                            <td className="px-0 py-2 text-center font-bold">
                                                                                <div className="flex min-h-[20px] w-full items-stretch">
                                                                                    <div className="flex min-w-0 flex-1 items-center justify-center border-r border-gray-200 px-0.5">
                                                                                        {getSectionMealsTotal(
                                                                                            section.title,
                                                                                            section.key,
                                                                                            section.rows
                                                                                        )}
                                                                                    </div>
                                                                                    {(() => {
                                                                                        const lodgingTotal =
                                                                                            getSectionLodgingArrivalTotal(
                                                                                                section.title,
                                                                                                section.key,
                                                                                                section.rows
                                                                                            );
                                                                                        return (
                                                                                            <div
                                                                                                className={`flex min-w-0 flex-1 items-center justify-center px-0.5 tabular-nums ${
                                                                                                    lodgingTotal > 0
                                                                                                        ? "font-semibold text-gray-900"
                                                                                                        : "text-gray-400"
                                                                                                }`}
                                                                                            >
                                                                                                {lodgingTotal}
                                                                                            </div>
                                                                                        );
                                                                                    })()}
                                                                                </div>
                                                                            </td>
                                                                        </tr>
                                                                    )}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                        <div className="text-sm text-gray-700">
                                                            <span className="font-semibold text-gray-900">
                                                                Comments :
                                                            </span>{" "}
                                                            {sectionComments.length > 0 ? (
                                                                <div className="mt-2 flex flex-col gap-1">
                                                                    {sectionComments.map((comment) => (
                                                                        <div key={comment}>
                                                                            {comment}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <span className="text-gray-400">
                                                                    -
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                            </>
                                        ) : (
                                            <div className="text-sm text-gray-500">
                                                표시할 NORMAL TIMESHEET가 없습니다.
                                            </div>
                                        )}
                                    </div>
                                    );
                                    })()}
                            </div>

                            {/* 우측: JOB DESCRIPTION(상단) + INVOICE */}
                            <div className="flex flex-col gap-6">
                                {/* JOB DESCRIPTION 섹션 */}
                                <div className="flex flex-col gap-4 bg-white border border-gray-200 rounded-xl p-6">
                                    <h2 className="text-3xl font-bold text-black mb-2">JOB DESCRIPTION</h2>
                                    <div className="grid grid-cols-4 gap-4">
                                        {/* Row 1 - Card 1: SHIP NAME */}
                                        <div className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col">
                                            <div className="text-xs font-semibold text-gray-700 mb-2">SHIP NAME</div>
                                            <div className="text-sm text-gray-900">{shipNameDisplay}</div>
                                        </div>
                                        {/* Row 1 - Card 2: Engineer Name and Title */}
                                        {renderEditablePersonnelCard(
                                            "Engineer Name and Title",
                                            jobDescriptionPersonnel.engineerDisplay,
                                            "JOB_DESCRIPTION",
                                            "JOB DESCRIPTION",
                                            "engineer",
                                            allTimesheetPeople
                                        )}
                                        {/* Row 1 - Card 3: Work Order From */}
                                        <div className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col">
                                            <div className="text-xs font-semibold text-gray-700 mb-2">Work Order From</div>
                                            <div className="text-sm text-gray-900">{workOrderFromDisplay}</div>
                                        </div>
                                        {/* Row 1 - Card 4: Departure date & time, from place */}
                                        <div className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col">
                                            <div className="text-xs font-semibold text-gray-700 mb-2">Departure date & time, from place</div>
                                            <div className="text-sm text-gray-900">{jobDescriptionDepartureDisplay}</div>
                                        </div>
                                        {/* Row 2 - Card 5: WORK PLACE */}
                                        <div className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col">
                                            <div className="text-xs font-semibold text-gray-700 mb-2">WORK PLACE</div>
                                            <div className="text-sm text-gray-900">{workPlaceDisplay}</div>
                                        </div>
                                        {/* Row 2 - Card 6: Mechanic names and numbers */}
                                        {renderEditablePersonnelCard(
                                            "Mechanic names and numbers",
                                            jobDescriptionPersonnel.mechanicDisplay,
                                            "JOB_DESCRIPTION",
                                            "JOB DESCRIPTION",
                                            "mechanic",
                                            allTimesheetPeople
                                        )}
                                        {/* Row 2 - Card 7: P.O No. */}
                                        <div className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col">
                                            <div className="text-xs font-semibold text-gray-700 mb-2">P.O No.</div>
                                            <div className="text-sm text-gray-900"></div>
                                        </div>
                                        {/* Row 2 - Card 8: Return date & time, to place */}
                                        <div className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col">
                                            <div className="text-xs font-semibold text-gray-700 mb-2">Return date & time, to place</div>
                                            <div className="text-sm text-gray-900">{jobDescriptionReturnDisplay}</div>
                                        </div>
                                    </div>
                                </div>

                                {/* INVOICE 섹션 */}
                                <div className="flex min-w-0 flex-col gap-6 bg-white border border-gray-200 rounded-xl p-6">
                                    {/* INVOICE 제목 - 크고 굵게 */}
                                    <h2 className="text-3xl font-bold text-black mb-2">INVOICE</h2>
                                    
                                    {/* Top Information Sections - 3 columns (가운데는 minmax로 줄바꿈 가능) */}
                                    <div className="grid grid-cols-1 gap-6 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-start">
                                        {/* Invoice to (Left Column) */}
                                        <div className="flex max-w-full flex-col gap-3">
                                            <h3 className="text-sm font-semibold text-gray-900">Invoice to</h3>
                                            <div className="text-sm text-gray-900">Everllence</div>
                                            <div className="text-sm text-gray-900">2-Stroke Business, Operation / Engineering</div>
                                            <div className="text-sm text-gray-900">Teglholmsgade 41</div>
                                            <div className="text-sm text-gray-900">2450 Copenhagen SV, Denmark</div>
                                        </div>

                                        {/* Job Information (Middle Column) */}
                                        <div className="flex min-w-0 flex-col gap-3">
                                            <h3 className="text-sm font-semibold text-gray-900">Job information</h3>
                                            <div className="flex min-w-0 items-start gap-2">
                                                <span className="shrink-0 text-sm text-gray-700">Hull no.</span>
                                                <span className="min-w-0 break-words text-sm text-gray-900">
                                                    {shipNameDisplay}
                                                </span>
                                            </div>
                                            <div className="flex min-w-0 items-start gap-2">
                                                <span className="shrink-0 text-sm text-gray-700">Engine type:</span>
                                                <span className="min-w-0 break-words text-sm text-gray-900">
                                                    {engineTypeDisplay}
                                                </span>
                                            </div>
                                            <div className="flex min-w-0 items-start gap-2">
                                                <span className="shrink-0 text-sm text-gray-700">
                                                    Work Period & Place:
                                                </span>
                                                <span className="min-w-0 break-words text-sm text-gray-900">
                                                    {invoiceWorkPeriodDisplay}
                                                </span>
                                            </div>
                                            <div className="flex min-w-0 items-start gap-2">
                                                <span className="shrink-0 text-sm text-gray-700">Work Item:</span>
                                                <span className="min-w-0 break-words text-sm text-gray-900">
                                                    {workItemDisplay}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Invoice Numbers & Dates (Right Column) */}
                                        <div className="flex shrink-0 flex-col gap-3 md:justify-self-end">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm text-gray-700">P.O No:</span>
                                                <span className="text-sm text-gray-900"></span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm text-gray-700">INVOICE No:</span>
                                                <span className="text-sm text-gray-900"></span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm text-gray-700">Date:</span>
                                                <span className="text-sm text-gray-900">{invoiceDateDisplay}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm text-gray-700">Validity:</span>
                                                <span className="text-sm text-gray-900">14 days</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm text-gray-700">Currency unit:</span>
                                                <span className="text-sm text-gray-900">EUR</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Line Items Table */}
                                    <div className="flex flex-col gap-4 mt-4">
                                        <div className="border border-gray-300 rounded overflow-hidden">
                                            <table className="w-full text-sm border-collapse">
                                                <thead className="bg-gray-100">
                                                    <tr>
                                                        <th className="px-4 py-3 text-left font-semibold text-gray-900 border-b border-gray-300">Description</th>
                                                        <th className="px-4 py-3 text-center font-semibold text-gray-900 border-b border-gray-300 border-l border-gray-300 w-20">Q'ty</th>
                                                        <th className="px-4 py-3 text-center font-semibold text-gray-900 border-b border-gray-300 border-l border-gray-300 w-24">Unit</th>
                                                        <th className="px-4 py-3 text-right font-semibold text-gray-900 border-b border-gray-300 border-l border-gray-300 w-32">Unit price</th>
                                                        <th className="px-4 py-3 text-right font-semibold text-gray-900 border-b border-gray-300 border-l border-gray-300 w-32">Total</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {/* 1. MANPOWER */}
                                                    <tr>
                                                        <td className="px-4 py-2 text-gray-900 font-semibold border-b border-gray-300">1. MANPOWER</td>
                                                        <td className="px-4 py-2 text-center border-b border-gray-300 border-l border-gray-300"></td>
                                                        <td className="px-4 py-2 text-center border-b border-gray-300 border-l border-gray-300"></td>
                                                        <td className="px-4 py-2 text-right border-b border-gray-300 border-l border-gray-300"></td>
                                                        <td className="px-4 py-2 text-right border-b border-gray-300 border-l border-gray-300"></td>
                                                    </tr>
                                                    {/* 1.1 Skilled Fitter */}
                                                    <tr>
                                                        <td className="px-4 py-2 text-gray-900 pl-8 border-b border-gray-300">
                                                            {`1.1 ${
                                                                invoiceSkilledFitterPeople.length > 1
                                                                    ? "Skilled Fitters"
                                                                    : "Skilled Fitter"
                                                            }${
                                                                jobDescriptionPersonnel.engineerPeople.length > 0
                                                                    ? ` (${jobDescriptionPersonnel.engineerPeople
                                                                          .map((person) =>
                                                                              getEnglishPersonName(person)
                                                                          )
                                                                          .join(", ")})`
                                                                    : ""
                                                            }`}
                                                        </td>
                                                        <td className="px-4 py-2 text-center border-b border-gray-300 border-l border-gray-300">
                                                            {invoiceSkilledFitterPeople.length > 0
                                                                ? invoiceSkilledFitterPeople.length
                                                                : ""}
                                                        </td>
                                                        <td className="px-4 py-2 text-center border-b border-gray-300 border-l border-gray-300">
                                                            {invoiceSkilledFitterPeople.length > 1
                                                                ? "MEN"
                                                                : invoiceSkilledFitterPeople.length ===
                                                                    1
                                                                  ? "MAN"
                                                                  : ""}
                                                        </td>
                                                        <td className="px-4 py-2 text-right border-b border-gray-300 border-l border-gray-300"></td>
                                                        <td className="px-4 py-2 text-right border-b border-gray-300 border-l border-gray-300"></td>
                                                    </tr>
                                                    {shouldShowInvoiceManpowerHourRow(
                                                        skilledFitterInvoiceSummary.weekdayNormal
                                                    ) && (
                                                    <tr>
                                                        <td className="px-4 py-2 text-gray-900 pl-12 border-b border-gray-300">: Weekday/ Normal Working Hours</td>
                                                        <td className="px-4 py-2 text-center border-b border-gray-300 border-l border-gray-300">
                                                            {formatHourQuantity(
                                                                skilledFitterInvoiceSummary.weekdayNormal
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-2 text-center border-b border-gray-300 border-l border-gray-300">hours</td>
                                                        <td className="px-4 py-2 text-right border-b border-gray-300 border-l border-gray-300"></td>
                                                        <td className="px-4 py-2 text-right border-b border-gray-300 border-l border-gray-300"></td>
                                                    </tr>
                                                    )}
                                                    {shouldShowInvoiceManpowerHourRow(
                                                        skilledFitterInvoiceSummary.weekdayAfter
                                                    ) && (
                                                    <tr>
                                                        <td className="px-4 py-2 text-gray-900 pl-12 border-b border-gray-300">: Weekday/ After Normal Working Hours</td>
                                                        <td className="px-4 py-2 text-center border-b border-gray-300 border-l border-gray-300">
                                                            {formatHourQuantity(
                                                                skilledFitterInvoiceSummary.weekdayAfter
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-2 text-center border-b border-gray-300 border-l border-gray-300">hours</td>
                                                        <td className="px-4 py-2 text-right border-b border-gray-300 border-l border-gray-300"></td>
                                                        <td className="px-4 py-2 text-right border-b border-gray-300 border-l border-gray-300"></td>
                                                    </tr>
                                                    )}
                                                    {shouldShowInvoiceManpowerHourRow(
                                                        skilledFitterInvoiceSummary.weekendNormal
                                                    ) && (
                                                    <tr>
                                                        <td className="px-4 py-2 text-gray-900 pl-12 border-b border-gray-300">: Weekend &amp; Holiday/ Normal Working Hours</td>
                                                        <td className="px-4 py-2 text-center border-b border-gray-300 border-l border-gray-300">
                                                            {formatHourQuantity(
                                                                skilledFitterInvoiceSummary.weekendNormal
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-2 text-center border-b border-gray-300 border-l border-gray-300">hours</td>
                                                        <td className="px-4 py-2 text-right border-b border-gray-300 border-l border-gray-300"></td>
                                                        <td className="px-4 py-2 text-right border-b border-gray-300 border-l border-gray-300"></td>
                                                    </tr>
                                                    )}
                                                    {shouldShowInvoiceManpowerHourRow(
                                                        skilledFitterInvoiceSummary.weekendAfter
                                                    ) && (
                                                    <tr>
                                                        <td className="px-4 py-2 text-gray-900 pl-12 border-b border-gray-300">: Weekend &amp; Holiday/ After Normal Working Hours</td>
                                                        <td className="px-4 py-2 text-center border-b border-gray-300 border-l border-gray-300">
                                                            {formatHourQuantity(
                                                                skilledFitterInvoiceSummary.weekendAfter
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-2 text-center border-b border-gray-300 border-l border-gray-300">hours</td>
                                                        <td className="px-4 py-2 text-right border-b border-gray-300 border-l border-gray-300"></td>
                                                        <td className="px-4 py-2 text-right border-b border-gray-300 border-l border-gray-300"></td>
                                                    </tr>
                                                    )}
                                                    {shouldShowInvoiceManpowerHourRow(
                                                        skilledFitterInvoiceSummary.travelWeekday
                                                    ) && (
                                                    <tr>
                                                        <td className="px-4 py-2 text-gray-900 pl-12 border-b border-gray-300">: Weekday/ Waiting & Travel Hours</td>
                                                        <td className="px-4 py-2 text-center border-b border-gray-300 border-l border-gray-300">
                                                            {formatHourQuantity(
                                                                skilledFitterInvoiceSummary.travelWeekday
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-2 text-center border-b border-gray-300 border-l border-gray-300">hours</td>
                                                        <td className="px-4 py-2 text-right border-b border-gray-300 border-l border-gray-300"></td>
                                                        <td className="px-4 py-2 text-right border-b border-gray-300 border-l border-gray-300"></td>
                                                    </tr>
                                                    )}
                                                    {shouldShowInvoiceManpowerHourRow(
                                                        skilledFitterInvoiceSummary.travelWeekend
                                                    ) && (
                                                    <tr>
                                                        <td className="px-4 py-2 text-gray-900 pl-12 border-b border-gray-300">: Weekend &amp; Holiday/ Waiting &amp; Travel Hours</td>
                                                        <td className="px-4 py-2 text-center border-b border-gray-300 border-l border-gray-300">
                                                            {formatHourQuantity(
                                                                skilledFitterInvoiceSummary.travelWeekend
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-2 text-center border-b border-gray-300 border-l border-gray-300">hours</td>
                                                        <td className="px-4 py-2 text-right border-b border-gray-300 border-l border-gray-300"></td>
                                                        <td className="px-4 py-2 text-right border-b border-gray-300 border-l border-gray-300"></td>
                                                    </tr>
                                                    )}
                                                    {/* 1.2 Fitters */}
                                                    <tr>
                                                        <td className="px-4 py-2 text-gray-900 pl-8 border-b border-gray-300">
                                                            {`1.2 ${
                                                                invoiceFitterPeople.length > 1
                                                                    ? "Fitters"
                                                                    : "Fitter"
                                                            }${
                                                                jobDescriptionPersonnel.mechanicPeople.length > 0
                                                                    ? ` (${jobDescriptionPersonnel.mechanicPeople
                                                                          .map((person) =>
                                                                              getEnglishPersonName(person)
                                                                          )
                                                                          .join(", ")})`
                                                                    : ""
                                                            }`}
                                                        </td>
                                                        <td className="px-4 py-2 text-center border-b border-gray-300 border-l border-gray-300">
                                                            {invoiceFitterPeople.length > 0
                                                                ? invoiceFitterPeople.length
                                                                : ""}
                                                        </td>
                                                        <td className="px-4 py-2 text-center border-b border-gray-300 border-l border-gray-300">
                                                            {invoiceFitterPeople.length > 1
                                                                ? "MEN"
                                                                : invoiceFitterPeople.length ===
                                                                    1
                                                                  ? "MAN"
                                                                  : ""}
                                                        </td>
                                                        <td className="px-4 py-2 text-right border-b border-gray-300 border-l border-gray-300"></td>
                                                        <td className="px-4 py-2 text-right border-b border-gray-300 border-l border-gray-300"></td>
                                                    </tr>
                                                    {shouldShowInvoiceManpowerHourRow(
                                                        fitterInvoiceSummary.weekdayNormal
                                                    ) && (
                                                    <tr>
                                                        <td className="px-4 py-2 text-gray-900 pl-12 border-b border-gray-300">: Weekday/ Normal Working Hours</td>
                                                        <td className="px-4 py-2 text-center border-b border-gray-300 border-l border-gray-300">
                                                            {formatHourQuantity(
                                                                fitterInvoiceSummary.weekdayNormal
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-2 text-center border-b border-gray-300 border-l border-gray-300">hours</td>
                                                        <td className="px-4 py-2 text-right border-b border-gray-300 border-l border-gray-300"></td>
                                                        <td className="px-4 py-2 text-right border-b border-gray-300 border-l border-gray-300"></td>
                                                    </tr>
                                                    )}
                                                    {shouldShowInvoiceManpowerHourRow(
                                                        fitterInvoiceSummary.weekdayAfter
                                                    ) && (
                                                    <tr>
                                                        <td className="px-4 py-2 text-gray-900 pl-12 border-b border-gray-300">: Weekday/ After Normal Working Hours</td>
                                                        <td className="px-4 py-2 text-center border-b border-gray-300 border-l border-gray-300">
                                                            {formatHourQuantity(
                                                                fitterInvoiceSummary.weekdayAfter
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-2 text-center border-b border-gray-300 border-l border-gray-300">hours</td>
                                                        <td className="px-4 py-2 text-right border-b border-gray-300 border-l border-gray-300"></td>
                                                        <td className="px-4 py-2 text-right border-b border-gray-300 border-l border-gray-300"></td>
                                                    </tr>
                                                    )}
                                                    {shouldShowInvoiceManpowerHourRow(
                                                        fitterInvoiceSummary.weekendNormal
                                                    ) && (
                                                    <tr>
                                                        <td className="px-4 py-2 text-gray-900 pl-12 border-b border-gray-300">: Weekend &amp; Holiday/ Normal Working Hours</td>
                                                        <td className="px-4 py-2 text-center border-b border-gray-300 border-l border-gray-300">
                                                            {formatHourQuantity(
                                                                fitterInvoiceSummary.weekendNormal
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-2 text-center border-b border-gray-300 border-l border-gray-300">hours</td>
                                                        <td className="px-4 py-2 text-right border-b border-gray-300 border-l border-gray-300"></td>
                                                        <td className="px-4 py-2 text-right border-b border-gray-300 border-l border-gray-300"></td>
                                                    </tr>
                                                    )}
                                                    {shouldShowInvoiceManpowerHourRow(
                                                        fitterInvoiceSummary.weekendAfter
                                                    ) && (
                                                    <tr>
                                                        <td className="px-4 py-2 text-gray-900 pl-12 border-b border-gray-300">: Weekend &amp; Holiday/ After Normal Working Hours</td>
                                                        <td className="px-4 py-2 text-center border-b border-gray-300 border-l border-gray-300">
                                                            {formatHourQuantity(
                                                                fitterInvoiceSummary.weekendAfter
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-2 text-center border-b border-gray-300 border-l border-gray-300">hours</td>
                                                        <td className="px-4 py-2 text-right border-b border-gray-300 border-l border-gray-300"></td>
                                                        <td className="px-4 py-2 text-right border-b border-gray-300 border-l border-gray-300"></td>
                                                    </tr>
                                                    )}
                                                    {shouldShowInvoiceManpowerHourRow(
                                                        fitterInvoiceSummary.travelWeekday
                                                    ) && (
                                                    <tr>
                                                        <td className="px-4 py-2 text-gray-900 pl-12 border-b border-gray-300">: Weekday/ Waiting & Travel Hours</td>
                                                        <td className="px-4 py-2 text-center border-b border-gray-300 border-l border-gray-300">
                                                            {formatHourQuantity(
                                                                fitterInvoiceSummary.travelWeekday
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-2 text-center border-b border-gray-300 border-l border-gray-300">hours</td>
                                                        <td className="px-4 py-2 text-right border-b border-gray-300 border-l border-gray-300"></td>
                                                        <td className="px-4 py-2 text-right border-b border-gray-300 border-l border-gray-300"></td>
                                                    </tr>
                                                    )}
                                                    {shouldShowInvoiceManpowerHourRow(
                                                        fitterInvoiceSummary.travelWeekend
                                                    ) && (
                                                    <tr>
                                                        <td className="px-4 py-2 text-gray-900 pl-12 border-b border-gray-300">: Weekend &amp; Holiday/ Waiting &amp; Travel Hours</td>
                                                        <td className="px-4 py-2 text-center border-b border-gray-300 border-l border-gray-300">
                                                            {formatHourQuantity(
                                                                fitterInvoiceSummary.travelWeekend
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-2 text-center border-b border-gray-300 border-l border-gray-300">hours</td>
                                                        <td className="px-4 py-2 text-right border-b border-gray-300 border-l border-gray-300"></td>
                                                        <td className="px-4 py-2 text-right border-b border-gray-300 border-l border-gray-300"></td>
                                                    </tr>
                                                    )}
                                                    {/* 2. Daily Allowance */}
                                                    <tr>
                                                        <td className="px-4 py-2 text-gray-900 font-semibold border-b border-gray-300">2. Daily Allowance</td>
                                                        <td className="px-4 py-2 text-center border-b border-gray-300 border-l border-gray-300"></td>
                                                        <td className="px-4 py-2 text-center border-b border-gray-300 border-l border-gray-300"></td>
                                                        <td className="px-4 py-2 text-right border-b border-gray-300 border-l border-gray-300"></td>
                                                        <td className="px-4 py-2 text-right border-b border-gray-300 border-l border-gray-300"></td>
                                                    </tr>
                                                    <tr>
                                                        <td className="px-4 py-2 text-gray-900 pl-8 border-b border-gray-300">
                                                            {invoiceDailyAllowanceDescription}
                                                        </td>
                                                        <td className="px-4 py-2 text-center border-b border-gray-300 border-l border-gray-300">
                                                            {invoiceMealsTotal}
                                                        </td>
                                                        <td className="px-4 py-2 text-center border-b border-gray-300 border-l border-gray-300 leading-tight">
                                                            Meals
                                                            <br />
                                                            &amp;
                                                            <br />
                                                            숙박
                                                        </td>
                                                        <td className="px-4 py-2 text-right border-b border-gray-300 border-l border-gray-300">
                                                            {formatKrwWithCommas(
                                                                DAILY_ALLOWANCE_MEAL_UNIT_PRICE_KRW
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-2 text-right border-b border-gray-300 border-l border-gray-300">
                                                            {formatKrwWithCommas(
                                                                invoiceDailyAllowanceLineTotal
                                                            )}
                                                        </td>
                                                    </tr>
                                                    {/* 3. Transportation (KRW 500/km) */}
                                                    <tr>
                                                        <td className="px-4 py-2 text-gray-900 font-semibold border-b border-gray-300">3. Transportation (KRW 500/km)</td>
                                                        <td className="px-4 py-2 text-center border-b border-gray-300 border-l border-gray-300"></td>
                                                        <td className="px-4 py-2 text-center border-b border-gray-300 border-l border-gray-300"></td>
                                                        <td className="px-4 py-2 text-right border-b border-gray-300 border-l border-gray-300"></td>
                                                        <td className="px-4 py-2 text-right border-b border-gray-300 border-l border-gray-300"></td>
                                                    </tr>
                                                    {/* : 1 (Round) x 200km x 1car: 200km */}
                                                    <tr>
                                                        <td className="px-4 py-2 text-gray-900 pl-8 border-b border-gray-300">: 1 (Round) x 200km x 1car: 200km</td>
                                                        <td className="px-4 py-2 text-center border-b border-gray-300 border-l border-gray-300">200</td>
                                                        <td className="px-4 py-2 text-center border-b border-gray-300 border-l border-gray-300">Km</td>
                                                        <td className="px-4 py-2 text-right border-b border-gray-300 border-l border-gray-300">500</td>
                                                        <td className="px-4 py-2 text-right border-b border-gray-300 border-l border-gray-300">100,000</td>
                                                    </tr>
                                                    {/* * Mileage: RTB to HHI(Round): 200km */}
                                                    <tr>
                                                        <td className="px-4 py-2 text-gray-900 pl-8 border-b border-gray-300 italic">* Mileage: RTB to HHI(Round): 200km</td>
                                                        <td className="px-4 py-2 text-center border-b border-gray-300 border-l border-gray-300"></td>
                                                        <td className="px-4 py-2 text-center border-b border-gray-300 border-l border-gray-300"></td>
                                                        <td className="px-4 py-2 text-right border-b border-gray-300 border-l border-gray-300"></td>
                                                        <td className="px-4 py-2 text-right border-b border-gray-300 border-l border-gray-300"></td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        </div>
                    )}
                </div>

                <BaseModal
                    isOpen={invoiceResetConfirmOpen}
                    onClose={() => setInvoiceResetConfirmOpen(false)}
                    title="초기화"
                    maxWidth="max-w-md"
                    footer={
                        <>
                            <button
                                type="button"
                                className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-50"
                                onClick={() => setInvoiceResetConfirmOpen(false)}
                            >
                                취소
                            </button>
                            <button
                                type="button"
                                className="rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
                                onClick={handleConfirmInvoiceResetToInitial}
                            >
                                초기화
                            </button>
                        </>
                    }
                >
                    <p className="text-sm leading-relaxed text-gray-700">
                        보고서·타임시트·이동 청구 등 편집 내역을 모두
                        버리고, 이 페이지를 처음 불러왔을 때 상태로
                        되돌리시겠습니까?
                    </p>
                </BaseModal>

                <PersonnelSelectionModal
                    isOpen={personnelEditor !== null}
                    onClose={() => setPersonnelEditor(null)}
                    title={
                        personnelEditor?.mode === "engineer"
                            ? "Skilled fitter 수정"
                            : "Fitter 대표자 수정"
                    }
                    scopeTitle={personnelEditor?.scopeTitle ?? ""}
                    candidates={
                        personnelEditor === null
                            ? []
                            : (
                                  personnelEditor.mode === "engineer"
                                      ? getTopSelectableSkilledFitters(
                                            personnelEditor.people
                                        )
                                      : getTopSelectableMechanics(
                                            getPersonnelDisplayData(
                                            personnelEditor.scopeKey,
                                            personnelEditor.people
                                            ).mechanicPeople
                                        )
                              ).map((person) => ({
                                  name: person,
                                  displayName: getEnglishPersonName(person),
                                  selected:
                                      personnelEditor.mode === "engineer"
                                          ? selectedSkilledFitters.includes(person)
                                          : getPersonnelDisplayData(
                                                personnelEditor.scopeKey,
                                                personnelEditor.people
                                            ).mechanicRepresentative === person,
                              }))
                    }
                    onCandidateClick={(person: string) => {
                        if (!personnelEditor) return;

                        if (personnelEditor.mode === "engineer") {
                            toggleSkilledFitterSelection(person);
                            return;
                        }

                        selectMechanicRepresentative(personnelEditor.scopeKey, person);
                    }}
                />
                <TimesheetRowDetailSidePanel
                    isOpen={selectedTimesheetRow !== null}
                    onClose={() => setSelectedTimesheetRow(null)}
                    sectionTitle={selectedTimesheetRow?.sectionTitle ?? ""}
                    selectedPersons={selectedTimesheetRow?.selectedPersons ?? []}
                    day={selectedTimesheetRow?.day ?? ""}
                    dateFormatted={selectedTimesheetRow?.dateFormatted ?? ""}
                    timeFrom={selectedTimesheetRow?.timeFrom ?? ""}
                    timeTo={selectedTimesheetRow?.timeTo ?? ""}
                    description={selectedTimesheetRow?.description ?? ""}
                    sourceEntries={selectedTimesheetRow?.sourceEntries ?? []}
                    groupSourceEntries={
                        selectedTimesheetRow?.groupSourceEntries ?? []
                    }
                    previousWorkLocations={
                        selectedTimesheetRow?.previousWorkLocations ?? {}
                    }
                    nextWorkLocations={selectedTimesheetRow?.nextWorkLocations ?? {}}
                    holidayDateKeys={holidayDateSet}
                    travelChargeOverrides={travelChargeOverrides}
                    onTravelChargeOverrideChange={setTravelChargeOverrideTarget}
                    onTravelChargeOverrideResetEntry={resetTravelChargeOverridesForEntry}
                    requiredSkilledFittersInRemarks={
                        selectedTimesheetRow
                            ? resolveRequiredSkilledFittersForSectionTitle(
                                  selectedTimesheetRow.sectionTitle
                              )
                            : []
                    }
                    personVesselHistoryByPerson={personVesselHistoryByPerson}
                    invoiceTimesheetPeople={allInvoicePeople}
                    getOriginalTimesheetEntryPersons={getOriginalTimesheetEntryPersons}
                    getTimesheetEntryEditBaseline={getTimesheetEntryEditBaseline}
                    onReplaceTimesheetEntryPerson={replaceTimesheetEntryPerson}
                    manualBillableHoursByEntryId={entryManualBillableHours}
                    deletedEntries={deletedTimesheetEntries}
                    onRestoreDeletedTimesheetEntry={(entryId) =>
                        restoreDeletedTimesheetEntriesBatch([entryId])
                    }
                    onRestoreAllDeletedTimesheetEntriesInScope={
                        restoreDeletedTimesheetEntriesBatch
                    }
                    timesheetRowCalendarDate={
                        selectedTimesheetRow?.timesheetRowCalendarDate ?? ""
                    }
                />
                <TimesheetDateGroupDetailSidePanel
                    isOpen={selectedTimesheetDateGroupPanel !== null}
                    onClose={() => setSelectedTimesheetDateGroupPanel(null)}
                    sectionTitle={selectedTimesheetDateGroupPanel?.sectionTitle ?? ""}
                    disableOutsideClose={
                        selectedTimesheetDateGroupPanel?.blockKey ===
                        "ALL DATE GROUP DETAIL-total"
                    }
                    fullGroupEntries={
                        selectedTimesheetDateGroupPanel?.fullGroupEntries ?? []
                    }
                    workLocationsByDate={
                        selectedTimesheetDateGroupPanel?.workLocationsByDate ?? {}
                    }
                    holidayDateKeys={holidayDateSet}
                    travelChargeOverrides={travelChargeOverrides}
                    onTravelChargeOverrideChange={setTravelChargeOverrideTarget}
                    onTravelChargeOverrideResetEntry={resetTravelChargeOverridesForEntry}
                    requiredSkilledFittersInRemarks={
                        selectedTimesheetDateGroupPanel
                            ? resolveRequiredSkilledFittersForSectionTitle(
                                  selectedTimesheetDateGroupPanel.sectionTitle
                              )
                            : []
                    }
                    personVesselHistoryByPerson={personVesselHistoryByPerson}
                    invoiceTimesheetPeople={allInvoicePeople}
                    getOriginalTimesheetEntryPersons={getOriginalTimesheetEntryPersons}
                    getTimesheetEntryEditBaseline={getTimesheetEntryEditBaseline}
                    onReplaceTimesheetEntryPerson={replaceTimesheetEntryPerson}
                    onDuplicateTimesheetEntry={duplicateTimesheetEntry}
                    onDeleteTimesheetEntry={deleteTimesheetEntry}
                    onUndo={handleInvoiceUndo}
                    onRedo={handleInvoiceRedo}
                    onFullGroupResetToDefault={openInvoiceResetConfirmModal}
                    resetToInitialDisabled={workLogDataList.length === 0}
                    undoDisabled={invoiceUndoRedoCounts.past === 0}
                    redoDisabled={invoiceUndoRedoCounts.future === 0}
                    manualBillableHoursByEntryId={entryManualBillableHours}
                    onUpdateTimesheetEntry={updateTimesheetEntry}
                    onResetSingleTimesheetEntryToInitial={
                        resetSingleTimesheetEntryToInitial
                    }
                    timesheetEntryEditorRemountTickById={
                        timesheetEntryEditorRemountTickById
                    }
                    deletedEntries={deletedTimesheetEntries}
                    onRestoreDeletedTimesheetEntry={(entryId) =>
                        restoreDeletedTimesheetEntriesBatch([entryId])
                    }
                    onRestoreAllDeletedTimesheetEntriesInScope={
                        restoreDeletedTimesheetEntriesBatch
                    }
                    panelCalendarDates={
                        selectedTimesheetDateGroupPanel?.panelCalendarDates ?? []
                    }
                />
            </div>
        </div>
    );
}
