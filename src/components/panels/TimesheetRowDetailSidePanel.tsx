import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface TimesheetRowDetailSidePanelProps {
    isOpen: boolean;
    onClose: () => void;
    sectionTitle: string;
    selectedPersons: string[];
    day: string;
    dateFormatted: string;
    timeFrom: string;
    timeTo: string;
    description: string;
    sourceEntries: Array<{
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
    }>;
    groupSourceEntries: Array<{
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
    }>;
    previousWorkLocations: Record<string, string[]>;
    nextWorkLocations: Record<string, string[]>;
    /** 인보이스 페이지와 동일: 공휴일(행정 API·캘린더 키워드). 주말은 별도 판별. */
    holidayDateKeys?: ReadonlySet<string>;
}

const GANGDONG_FACTORY = "강동동 공장";

function normalizeLocationName(value: string | null | undefined): string {
    if (!value) return "";

    const normalized = value.trim();
    if (!normalized) return "";

    if (normalized === "HHI") return "HD중공업(해양)";
    if (normalized === "HMD") return "HD미포";
    if (normalized === "HSHI") return "HD삼호";

    return normalized;
}

function getFinalDestination(
    entry: TimesheetRowDetailSidePanelProps["sourceEntries"][number]
): string {
    const moveTo = entry.moveTo?.trim();
    if (moveTo) {
        return moveTo;
    }

    const details = (entry.details ?? "").replace(/\s*이동\.?\s*$/, "").trim();
    if (!details.includes("→")) {
        return details;
    }

    return details.split("→").pop()?.trim() ?? "";
}

function getTravelEntryOrigin(
    entry: TimesheetRowDetailSidePanelProps["sourceEntries"][number]
): string {
    const moveFrom = entry.moveFrom?.trim();
    if (moveFrom) {
        return moveFrom;
    }

    const details = (entry.details ?? "").replace(/\s*이동\.?\s*$/, "").trim();
    if (!details.includes("→")) {
        return details;
    }

    return details.split("→")[0]?.trim() ?? "";
}

function sortEntriesByStart(
    entries: TimesheetRowDetailSidePanelProps["sourceEntries"]
) {
    return [...entries].sort((a, b) => {
        const aStart = new Date(
            `${a.dateFrom}T${a.timeFrom || "00:00"}`
        ).getTime();
        const bStart = new Date(
            `${b.dateFrom}T${b.timeFrom || "00:00"}`
        ).getTime();
        return aStart - bStart;
    });
}

/** 인보이스 단일 행과 동일: 선행 이동·말미 이동이 강동동 공장에서 맞물리면 해당 이동들 청구 0 */
function getZeroBillingTravelIdsForRowScopedEntries(
    entries: TimesheetRowDetailSidePanelProps["sourceEntries"]
): Set<number> {
    const sorted = sortEntriesByStart(entries);
    let i = 0;
    while (i < sorted.length && sorted[i].descType === "이동") {
        i += 1;
    }
    const before = sorted.slice(0, i);
    let j = sorted.length - 1;
    while (j >= i && sorted[j].descType === "이동") {
        j -= 1;
    }
    const after = sorted.slice(j + 1);

    const lastBefore = before[before.length - 1];
    const firstAfter = after[0];
    const factory = normalizeLocationName(GANGDONG_FACTORY);

    if (
        !lastBefore ||
        !firstAfter ||
        normalizeLocationName(getFinalDestination(lastBefore)) !== factory ||
        normalizeLocationName(getTravelEntryOrigin(firstAfter)) !== factory
    ) {
        return new Set();
    }

    return new Set(
        [...before, ...after].filter((e) => e.descType === "이동").map((e) => e.id)
    );
}

/** 전체 일자 그룹: 인당 작업 블록마다 동일 규칙 적용 */
function getZeroBillingTravelIdsForGroupEntries(
    entries: TimesheetRowDetailSidePanelProps["groupSourceEntries"]
): Set<number> {
    if (entries.length === 0) {
        return new Set();
    }

    const asSource = entries as TimesheetRowDetailSidePanelProps["sourceEntries"];
    const allPersons = new Set(asSource.flatMap((e) => e.persons ?? []));
    const result = new Set<number>();
    const factory = normalizeLocationName(GANGDONG_FACTORY);

    for (const person of allPersons) {
        const personEntries = sortEntriesByStart(
            asSource.filter((e) => (e.persons ?? []).includes(person))
        );
        let i = 0;
        while (i < personEntries.length) {
            const beforeStart = i;
            while (i < personEntries.length && personEntries[i].descType === "이동") {
                i += 1;
            }
            const before = personEntries.slice(beforeStart, i);
            if (i >= personEntries.length) {
                break;
            }
            while (
                i < personEntries.length &&
                personEntries[i].descType !== "이동"
            ) {
                i += 1;
            }
            const afterStart = i;
            while (i < personEntries.length && personEntries[i].descType === "이동") {
                i += 1;
            }
            const after = personEntries.slice(afterStart, i);

            const lastBefore = before[before.length - 1];
            const firstAfter = after[0];
            if (
                lastBefore &&
                firstAfter &&
                normalizeLocationName(getFinalDestination(lastBefore)) === factory &&
                normalizeLocationName(getTravelEntryOrigin(firstAfter)) === factory
            ) {
                before
                    .filter((e) => e.descType === "이동")
                    .forEach((e) => result.add(e.id));
                after
                    .filter((e) => e.descType === "이동")
                    .forEach((e) => result.add(e.id));
            }
        }
    }

    return result;
}

interface PanelDisplayData {
    sectionTitle: string;
    selectedPersons: string[];
    day: string;
    dateFormatted: string;
    timeFrom: string;
    timeTo: string;
    description: string;
    sourceEntries: TimesheetRowDetailSidePanelProps["sourceEntries"];
    groupSourceEntries: TimesheetRowDetailSidePanelProps["groupSourceEntries"];
}

function CloseIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path
                d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41Z"
                fill="currentColor"
            />
        </svg>
    );
}

function DescTypeBadge({ value }: { value: string }) {
    const styles =
        value === "이동"
            ? "bg-lime-100 text-lime-800 ring-lime-200"
            : value === "작업"
              ? "bg-sky-100 text-sky-800 ring-sky-200"
              : value === "대기"
                ? "bg-orange-100 text-orange-800 ring-orange-200"
                : "bg-gray-100 text-gray-800 ring-gray-200";

    return (
        <span
            className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-semibold leading-4 ring-1 ring-inset ${styles}`}
        >
            {value}
        </span>
    );
}

export default function TimesheetRowDetailSidePanel({
    isOpen,
    onClose,
    sectionTitle,
    selectedPersons,
    day,
    dateFormatted,
    timeFrom,
    timeTo,
    description,
    sourceEntries,
    groupSourceEntries,
    previousWorkLocations,
    nextWorkLocations,
    holidayDateKeys,
}: TimesheetRowDetailSidePanelProps) {
    const panelRef = useRef<HTMLElement | null>(null);
    const [displayData, setDisplayData] = useState<PanelDisplayData>({
        sectionTitle,
        selectedPersons,
        day,
        dateFormatted,
        timeFrom,
        timeTo,
        description,
        sourceEntries,
        groupSourceEntries,
    });

    const isChargeHighlightDate = (dateText: string) => {
        const date = new Date(`${dateText}T00:00:00`);
        if (Number.isNaN(date.getTime())) {
            return false;
        }

        const day = date.getDay();
        if (day === 0 || day === 6) {
            return true;
        }

        return holidayDateKeys?.has(dateText) ?? false;
    };

    const renderSourceEntriesTable = (
        title: string,
        subtitle: string,
        entriesData: TimesheetRowDetailSidePanelProps["sourceEntries"],
        highlightedEntryIds: Set<number> = new Set(),
        zeroBillingScope: "row" | "group" = "row"
    ) => {
        const travelChargeContextEntries =
            zeroBillingScope === "group"
                ? entriesData
                : displayData.groupSourceEntries.length > 0
                  ? (displayData.groupSourceEntries as TimesheetRowDetailSidePanelProps["sourceEntries"])
                  : entriesData;
        const zeroBillingTravelIds =
            zeroBillingScope === "row"
                ? getZeroBillingTravelIdsForRowScopedEntries(entriesData)
                : getZeroBillingTravelIdsForGroupEntries(
                      entriesData as TimesheetRowDetailSidePanelProps["groupSourceEntries"]
                  );

        return (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <div className="border-b border-gray-200 bg-blue-50 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                    {title}
                </div>
            </div>

            {entriesData.length === 0 ? (
                <div className="px-4 py-6 text-sm text-gray-500">
                    연결된 원본 엔트리가 없습니다.
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full table-fixed text-xs">
                        <colgroup>
                            <col className="w-[38px]" />
                            <col className="w-[38px]" />
                            <col className="w-[42px]" />
                            <col className="w-[68px]" />
                            <col className="w-[74px]" />
                            <col className="w-[74px]" />
                            <col className="w-[96px]" />
                            <col className="w-[96px]" />
                            <col className="w-[40%]" />
                            <col className="w-[16%]" />
                        </colgroup>
                        <thead className="bg-gray-50 text-gray-600">
                            <tr>
                                <th className="border-b border-r border-gray-200 px-3 py-2 text-center font-semibold">월</th>
                                <th className="border-b border-r border-gray-200 px-3 py-2 text-center font-semibold">일</th>
                                <th className="border-b border-r border-gray-200 px-3 py-2 text-center font-semibold">요일</th>
                                <th className="border-b border-r border-gray-200 px-3 py-2 text-center font-semibold">구분</th>
                                <th className="border-b border-r border-gray-200 px-3 py-2 text-center font-semibold">From</th>
                                <th className="border-b border-r border-gray-200 px-3 py-2 text-center font-semibold">To</th>
                                <th className="border-b border-r border-gray-200 px-3 py-2 text-center font-semibold whitespace-pre-line">실제{"\n"}시간</th>
                                <th className="border-b border-r border-gray-200 px-3 py-2 text-center font-semibold whitespace-pre-line">청구{"\n"}시간</th>
                                <th className="border-b border-r border-gray-200 px-3 py-2 text-left font-semibold">작업내용(Description)</th>
                                <th className="border-b border-gray-200 px-3 py-2 text-left font-semibold">비고(Remark)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {entriesData.map((entry, index, entries) => {
                                const [, month, dayOfMonth] = entry.dateFrom.split("-");
                                const correctionLabel =
                                    getCorrectionLabel(
                                        entry,
                                        travelChargeContextEntries,
                                        zeroBillingTravelIds
                                    );
                                const durationLabel = getDurationLabel(
                                    entry.dateFrom,
                                    entry.timeFrom,
                                    entry.dateTo,
                                    entry.timeTo
                                );
                                const isSameDateAsPrevious =
                                    index > 0 &&
                                    entries[index - 1]?.dateFrom === entry.dateFrom;
                                const isDateGroupStart = !isSameDateAsPrevious;
                                const dateBoundaryTopClass =
                                    isDateGroupStart && index > 0
                                        ? "border-t-2 border-t-gray-800"
                                        : "";
                                const dateHeaderRedClass =
                                    !isSameDateAsPrevious &&
                                    isChargeHighlightDate(entry.dateFrom)
                                        ? "font-semibold text-red-600"
                                        : "";
                                const descriptionText = [
                                    entry.details?.trim(),
                                    entry.note?.trim(),
                                ]
                                    .filter(Boolean)
                                    .join("\n");

                                return (
                                    <tr
                                        key={`${title}-${entry.id}-${index}`}
                                        className={`align-top ${
                                            highlightedEntryIds.has(entry.id)
                                                ? "bg-blue-50"
                                                : "bg-white"
                                        }`}
                                    >
                                        <td
                                            className={`border-b border-r border-gray-200 px-3 py-2 text-center ${dateBoundaryTopClass} ${dateHeaderRedClass}`}
                                        >
                                            {isSameDateAsPrevious ? "" : Number(month)}
                                        </td>
                                        <td
                                            className={`border-b border-r border-gray-200 px-3 py-2 text-center ${dateBoundaryTopClass} ${dateHeaderRedClass}`}
                                        >
                                            {isSameDateAsPrevious ? "" : Number(dayOfMonth)}
                                        </td>
                                        <td
                                            className={`border-b border-r border-gray-200 px-3 py-2 text-center ${dateBoundaryTopClass} ${dateHeaderRedClass}`}
                                        >
                                            {isSameDateAsPrevious
                                                ? ""
                                                : getWeekdayLabel(entry.dateFrom)}
                                        </td>
                                        <td
                                            className={`border-b border-r border-gray-200 px-3 py-2 text-center whitespace-nowrap ${dateBoundaryTopClass}`}
                                        >
                                            <DescTypeBadge value={entry.descType} />
                                        </td>
                                        <td
                                            className={`border-b border-r border-gray-200 px-3 py-2 text-center whitespace-nowrap ${dateBoundaryTopClass}`}
                                        >
                                            {formatTimeToMinutes(entry.timeFrom)}
                                        </td>
                                        <td
                                            className={`border-b border-r border-gray-200 px-3 py-2 text-center whitespace-nowrap ${dateBoundaryTopClass}`}
                                        >
                                            {formatTimeToMinutes(entry.timeTo)}
                                        </td>
                                        <td
                                            className={`border-b border-r border-gray-200 px-3 py-2 text-center whitespace-nowrap ${dateBoundaryTopClass}`}
                                        >
                                            {durationLabel || "-"}
                                        </td>
                                        <td
                                            className={`border-b border-r border-gray-200 px-3 py-2 text-center whitespace-pre-line ${
                                                isChargeHighlightDate(entry.dateFrom)
                                                    ? "font-semibold text-red-600"
                                                    : ""
                                            } ${dateBoundaryTopClass}`}
                                        >
                                            {correctionLabel}
                                        </td>
                                        <td
                                            className={`border-b border-r border-gray-200 px-3 py-2 whitespace-pre-wrap break-words text-gray-900 ${dateBoundaryTopClass}`}
                                        >
                                            {descriptionText || "-"}
                                        </td>
                                        <td
                                            className={`border-b border-gray-200 px-3 py-2 whitespace-pre-wrap break-keep leading-5 text-gray-700 ${dateBoundaryTopClass}`}
                                        >
                                            {formatRemarkPersons(
                                                entry.persons,
                                                new Set(displayData.selectedPersons)
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
        );
    };

    const getWeekdayLabel = (dateText: string) => {
        const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
        const date = new Date(`${dateText}T00:00:00`);
        return Number.isNaN(date.getTime()) ? "-" : weekdays[date.getDay()];
    };

    const getDurationLabel = (
        startDate: string,
        startTime: string,
        endDate: string,
        endTime: string
    ) => {
        const durationHours = getDurationHours(startDate, startTime, endDate, endTime);
        return durationHours === null ? "" : formatHoursLabel(durationHours);
    };

    const getDurationHours = (
        startDate: string,
        startTime: string,
        endDate: string,
        endTime: string
    ) => {
        if (!startDate || !endDate || !startTime || !endTime) {
            return null;
        }

        const start = new Date(`${startDate}T${startTime}`);
        const end =
            endTime === "24:00"
                ? new Date(new Date(`${endDate}T00:00:00`).getTime() + 24 * 60 * 60 * 1000)
                : new Date(`${endDate}T${endTime}`);

        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
            return null;
        }

        return Math.round(((end.getTime() - start.getTime()) / (1000 * 60 * 60)) * 10) / 10;
    };

    const formatHoursLabel = (value: number) => {
        return Number.isInteger(value) ? String(value) : String(value);
    };

    const getOverlapMinutes = (
        rangeStart: Date,
        rangeEnd: Date,
        targetStart: Date,
        targetEnd: Date
    ) => {
        const overlapStart = new Date(
            Math.max(rangeStart.getTime(), targetStart.getTime())
        );
        const overlapEnd = new Date(
            Math.min(rangeEnd.getTime(), targetEnd.getTime())
        );

        if (overlapEnd <= overlapStart) {
            return 0;
        }

        return Math.floor((overlapEnd.getTime() - overlapStart.getTime()) / 60000);
    };

    const getWorkingCorrectionLabel = (
        entry: TimesheetRowDetailSidePanelProps["sourceEntries"][number]
    ) => {
        if (!entry.dateFrom || !entry.dateTo || !entry.timeFrom || !entry.timeTo) {
            return "-";
        }

        const start = new Date(`${entry.dateFrom}T${entry.timeFrom}`);
        const end =
            entry.timeTo === "24:00"
                ? new Date(
                      new Date(`${entry.dateTo}T00:00:00`).getTime() +
                          24 * 60 * 60 * 1000
                  )
                : new Date(`${entry.dateTo}T${entry.timeTo}`);

        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
            return "-";
        }

        const totalMinutes = Math.floor((end.getTime() - start.getTime()) / 60000);
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
            entry.descType === "대기" ||
            (entry.descType === "작업" && !entry.lunchWorked);

        if (shouldDeductLunch) {
            normalMinutes -= getOverlapMinutes(start, end, lunchStart, lunchEnd);
        }

        normalMinutes = Math.max(0, normalMinutes);
        const afterMinutes = Math.max(0, totalMinutes - rawNormalMinutes);

        if (entry.descType === "대기") {
            const waitingMinutes = normalMinutes + afterMinutes;
            return waitingMinutes > 0
                ? `W=${formatHoursLabel(waitingMinutes / 60)}`
                : "-";
        }

        const labels = [
            normalMinutes > 0 ? `N=${formatHoursLabel(normalMinutes / 60)}` : "",
            afterMinutes > 0 ? `A=${formatHoursLabel(afterMinutes / 60)}` : "",
        ].filter(Boolean);

        return labels.length > 0 ? labels.join("\n") : "-";
    };

    const getHomeTravelHours = (location?: string | null) => {
        const primaryLocation = location?.split(",")[0].trim() ?? "";

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

        if (["PNC", "PNIT", "HPNT", "BNCT", "HJNC"].includes(primaryLocation)) {
            return 1;
        }

        return null;
    };

    type PanelEntry = TimesheetRowDetailSidePanelProps["sourceEntries"][number];
    type PersonBlock = {
        anchorEntries: PanelEntry[];
        beforeTravelEntries: PanelEntry[];
        afterTravelEntries: PanelEntry[];
    };

    const roundHours = (value: number) => Math.round(value * 10) / 10;

    const hasHomeInTravel = (entry: PanelEntry): boolean => {
        const details = entry.details ?? "";
        return (
            details.includes("자택") ||
            entry.moveFrom === "자택" ||
            entry.moveTo === "자택"
        );
    };

    const calculateRawTravelHours = (entry: PanelEntry): number => {
        if (
            entry.descType !== "이동" ||
            !entry.dateFrom ||
            !entry.dateTo ||
            !entry.timeFrom ||
            !entry.timeTo
        ) {
            return 0;
        }

        const start = new Date(`${entry.dateFrom}T${entry.timeFrom}`);
        const end =
            entry.timeTo === "24:00"
                ? new Date(
                      new Date(`${entry.dateTo}T00:00:00`).getTime() +
                          24 * 60 * 60 * 1000
                  )
                : new Date(`${entry.dateTo}T${entry.timeTo}`);

        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
            return 0;
        }

        return Math.floor((end.getTime() - start.getTime()) / 60000) / 60;
    };

    const getPrimaryLocation = (location?: string | null) =>
        normalizeLocationName(location?.split(",")[0].trim() ?? "");

    const inferWorkPlaceFromTravelSegments = (
        beforeTravelEntries: PanelEntry[],
        afterTravelEntries: PanelEntry[]
    ) => {
        const lastBeforeTravelEntry =
            beforeTravelEntries[beforeTravelEntries.length - 1];
        const leadingDestination = lastBeforeTravelEntry
            ? normalizeLocationName(getFinalDestination(lastBeforeTravelEntry))
            : "";

        if (leadingDestination && leadingDestination !== "자택") {
            return leadingDestination;
        }

        const firstAfterTravelEntry = afterTravelEntries[0];
        const trailingOrigin = firstAfterTravelEntry
            ? normalizeLocationName(getTravelEntryOrigin(firstAfterTravelEntry))
            : "";

        if (trailingOrigin && trailingOrigin !== "자택") {
            return trailingOrigin;
        }

        return "";
    };

    const doesWorkContextMatchBlockLocation = (
        person: string,
        beforeTravelEntries: PanelEntry[],
        afterTravelEntries: PanelEntry[],
        workLocations: Record<string, string[]>
    ) => {
        const blockWorkPlace = inferWorkPlaceFromTravelSegments(
            beforeTravelEntries,
            afterTravelEntries
        );
        if (!blockWorkPlace) {
            return false;
        }

        return (workLocations[person] ?? []).includes(blockWorkPlace);
    };

    const isDestinationWorkPlace = (entry: PanelEntry): boolean => {
        const destination = normalizeLocationName(getFinalDestination(entry));
        const workPlace = getPrimaryLocation(entry.location);

        if (!destination || !workPlace) {
            return false;
        }

        return destination === workPlace;
    };

    const summarizeTravelEntries = (
        entries: PanelEntry[],
        useFixedHomeHours: boolean
    ) => {
        if (entries.length === 0) {
            return {
                kind: "none",
                hours: 0,
            };
        }

        const lastEntry = entries[entries.length - 1];
        const fixedHours = getHomeTravelHours(lastEntry.location) ?? 0;
        const hasHome = entries.some((entry) => hasHomeInTravel(entry));

        if (useFixedHomeHours && hasHome && fixedHours > 0) {
            return {
                kind: "home",
                hours: fixedHours,
            };
        }

        return {
            kind: "travel",
            hours: roundHours(
                entries.reduce((sum, entry) => sum + calculateRawTravelHours(entry), 0)
            ),
        };
    };

    const getBlockSpanForEntries = (entries: PanelEntry[]) => {
        const earliest =
            entries
                .map((entry) => entry.timeFrom)
                .filter((value): value is string => Boolean(value))
                .sort()[0] ?? "00:00";
        const latest =
            entries
                .map((entry) => entry.timeTo)
                .filter((value): value is string => Boolean(value))
                .sort();

        return {
            earliest,
            latest: latest.length > 0 ? latest[latest.length - 1] : earliest,
        };
    };

    const getPersonBlocks = (
        person: string,
        entries: PanelEntry[]
    ): PersonBlock[] => {
        const personEntries = sortEntriesByStart(
            entries.filter((entry) => (entry.persons ?? []).includes(person))
        );
        const blocks: PersonBlock[] = [];

        let currentBlock: PersonBlock | null = null;
        let interBlockTravelEntries: PanelEntry[] = [];

        personEntries.forEach((entry) => {
            if (entry.descType === "이동") {
                interBlockTravelEntries.push(entry);
                return;
            }

            if (currentBlock && interBlockTravelEntries.length === 0) {
                currentBlock.anchorEntries.push(entry);
                return;
            }

            if (!currentBlock) {
                currentBlock = {
                    anchorEntries: [entry],
                    beforeTravelEntries: interBlockTravelEntries.slice(),
                    afterTravelEntries: [],
                };
                interBlockTravelEntries = [];
                return;
            }

            const beforeTravelEntriesForNext = interBlockTravelEntries.filter(
                (travelEntry) => isDestinationWorkPlace(travelEntry)
            );
            const currentAfterTravelEntries = interBlockTravelEntries.filter(
                (travelEntry) => !isDestinationWorkPlace(travelEntry)
            );

            currentBlock.afterTravelEntries = currentAfterTravelEntries;
            blocks.push(currentBlock);

            currentBlock = {
                anchorEntries: [entry],
                beforeTravelEntries: beforeTravelEntriesForNext,
                afterTravelEntries: [],
            };
            interBlockTravelEntries = [];
        });

        if (currentBlock) {
            blocks.push({
                anchorEntries: currentBlock.anchorEntries,
                beforeTravelEntries: currentBlock.beforeTravelEntries,
                afterTravelEntries: interBlockTravelEntries.slice(),
            });
        }

        return blocks;
    };

    const getBeforeTravelSummary = (
        person: string,
        blockIndex: number,
        beforeTravelEntries: PanelEntry[],
        afterTravelEntries: PanelEntry[]
    ) => {
        if (beforeTravelEntries.length === 0) {
            return { kind: "none", hours: 0 };
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
                    getHomeTravelHours(beforeTravelEntries[0].location) ?? 0;
                const hasHome = beforeTravelEntries.some((entry) => hasHomeInTravel(entry));

                if (hasHome && fixedHours > 0) {
                    return { kind: "initial-home", hours: fixedHours };
                }

                return summarizeTravelEntries(beforeTravelEntries, false);
            }

            return { kind: "continued", hours: 1 };
        }

        return summarizeTravelEntries(beforeTravelEntries, true);
    };

    const getAfterTravelSummary = (
        person: string,
        blockIndex: number,
        totalBlocks: number,
        beforeTravelEntries: PanelEntry[],
        afterTravelEntries: PanelEntry[]
    ) => {
        if (afterTravelEntries.length === 0) {
            return { kind: "none", hours: 0 };
        }

        if (blockIndex < totalBlocks - 1) {
            return summarizeTravelEntries(afterTravelEntries, true);
        }

        if (
            doesWorkContextMatchBlockLocation(
                person,
                beforeTravelEntries,
                afterTravelEntries,
                nextWorkLocations
            )
        ) {
            return { kind: "continued", hours: 1 };
        }

        return summarizeTravelEntries(afterTravelEntries, true);
    };

    const getTravelChargeHoursForPerson = (
        entry: PanelEntry,
        person: string,
        contextEntries: PanelEntry[],
        zeroBillingTravelIds: Set<number>
    ): number | null => {
        const blocks = getPersonBlocks(person, contextEntries);
        const factory = normalizeLocationName(GANGDONG_FACTORY);

        if (blocks.length === 0) {
            const personEntries = sortEntriesByStart(
                contextEntries.filter((candidate) =>
                    (candidate.persons ?? []).includes(person)
                )
            );

            if (!personEntries.some((candidate) => candidate.id === entry.id)) {
                return null;
            }

            return zeroBillingTravelIds.has(entry.id)
                ? 0
                : summarizeTravelEntries(
                      personEntries.filter((candidate) => candidate.descType === "이동"),
                      true
                  ).hours;
        }

        for (let blockIndex = 0; blockIndex < blocks.length; blockIndex += 1) {
            const block = blocks[blockIndex];
            const blockSpan = getBlockSpanForEntries(block.anchorEntries);
            const beforeTravel = getBeforeTravelSummary(
                person,
                blockIndex,
                block.beforeTravelEntries
                ,
                block.afterTravelEntries
            );
            const afterTravel = getAfterTravelSummary(
                person,
                blockIndex,
                blocks.length,
                block.beforeTravelEntries,
                block.afterTravelEntries
            );
            const lastBeforeTravelEntry =
                block.beforeTravelEntries[block.beforeTravelEntries.length - 1];
            const firstAfterTravelEntry = block.afterTravelEntries[0];
            const factoryWrapsBlock =
                lastBeforeTravelEntry &&
                firstAfterTravelEntry &&
                normalizeLocationName(
                    getFinalDestination(lastBeforeTravelEntry)
                ) === factory &&
                normalizeLocationName(
                    getTravelEntryOrigin(firstAfterTravelEntry)
                ) === factory;

            if (block.beforeTravelEntries.some((candidate) => candidate.id === entry.id)) {
                return zeroBillingTravelIds.has(entry.id) || factoryWrapsBlock
                    ? 0
                    : beforeTravel.hours;
            }

            if (block.afterTravelEntries.some((candidate) => candidate.id === entry.id)) {
                return zeroBillingTravelIds.has(entry.id) || factoryWrapsBlock
                    ? 0
                    : afterTravel.hours;
            }

            if (
                block.anchorEntries.some((candidate) => candidate.id === entry.id) &&
                blockSpan.earliest
            ) {
                return null;
            }
        }

        return null;
    };

    const getCorrectionLabel = (
        entry: PanelEntry,
        contextEntries: PanelEntry[],
        zeroBillingTravelIds: Set<number>
    ) => {
        const durationLabel = getDurationLabel(
            entry.dateFrom,
            entry.timeFrom,
            entry.dateTo,
            entry.timeTo
        );

        if (entry.descType === "작업" || entry.descType === "대기") {
            return getWorkingCorrectionLabel(entry);
        }

        if (entry.descType !== "이동") {
            return durationLabel || "-";
        }

        const personHours = entry.persons
            .map((person) =>
                getTravelChargeHoursForPerson(
                    entry,
                    person,
                    contextEntries,
                    zeroBillingTravelIds
                )
            )
            .filter((value): value is number => value !== null);

        if (personHours.length > 0) {
            const personLabels = personHours.map((value) => formatHoursLabel(value));
            return personLabels.every((label) => label === personLabels[0])
                ? personLabels[0]
                : personLabels.join(",");
        }

        if (zeroBillingTravelIds.has(entry.id)) {
            return formatHoursLabel(0);
        }

        const fixedHours = getHomeTravelHours(entry.location);
        if (!fixedHours) {
            return durationLabel || "-";
        }

        const details = entry.details ?? "";
        const containsHome =
            details.includes("자택") ||
            entry.moveFrom === "자택" ||
            entry.moveTo === "자택";

        if (!containsHome) {
            return durationLabel || "-";
        }

        return formatHoursLabel(fixedHours);
    };

    const formatTimeToMinutes = (value: string) => {
        if (!value) {
            return "-";
        }

        return value.slice(0, 5);
    };

    const formatRemarkPersons = (
        persons: string[],
        highlightedPersons: Set<string>
    ) => {
        if (persons.length === 0) {
            return "-";
        }

        const lines: JSX.Element[] = [];
        for (let index = 0; index < persons.length; index += 3) {
            const linePersons = persons.slice(index, index + 3);
            lines.push(
                <span key={`remark-line-${index}`}>
                    {linePersons.map((person, personIndex) => (
                        <span
                            key={`${person}-${personIndex}`}
                            className={
                                highlightedPersons.has(person)
                                    ? "font-bold text-gray-900"
                                    : undefined
                            }
                        >
                            {person}
                            {personIndex < linePersons.length - 1 ? ", " : ""}
                        </span>
                    ))}
                </span>
            );
        }

        return (
            <>
                {lines.map((line, index) => (
                    <span key={index}>
                        {index > 0 ? "\n" : ""}
                        {line}
                    </span>
                ))}
            </>
        );
    };

    const shouldShowFullGroupTable = (() => {
        if (displayData.groupSourceEntries.length === 0) {
            return false;
        }

        if (
            displayData.groupSourceEntries.length !== displayData.sourceEntries.length
        ) {
            return true;
        }

        const sourceIds = displayData.sourceEntries
            .map((entry) => entry.id)
            .sort((a, b) => a - b);
        const groupIds = displayData.groupSourceEntries
            .map((entry) => entry.id)
            .sort((a, b) => a - b);

        return sourceIds.some((id, index) => id !== groupIds[index]);
    })();

    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                onClose();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose]);

    useEffect(() => {
        if (!isOpen) return;

        const handlePointerDown = (event: MouseEvent) => {
            const target = event.target as HTMLElement | null;
            if (!target) return;

            if (panelRef.current?.contains(target)) {
                return;
            }

            if (target.closest('[data-timesheet-row-trigger="true"]')) {
                return;
            }

            onClose();
        };

        document.addEventListener("mousedown", handlePointerDown);
        return () => document.removeEventListener("mousedown", handlePointerDown);
    }, [isOpen, onClose]);

    useEffect(() => {
        if (!isOpen) return;

        setDisplayData({
            sectionTitle,
            selectedPersons,
            day,
            dateFormatted,
            timeFrom,
            timeTo,
            description,
            sourceEntries,
            groupSourceEntries,
        });
    }, [
        isOpen,
        sectionTitle,
        selectedPersons,
        day,
        dateFormatted,
        timeFrom,
        timeTo,
        description,
        sourceEntries,
        groupSourceEntries,
    ]);

    return createPortal(
        <aside
            ref={panelRef}
            className={`fixed inset-y-0 right-0 z-[10000] h-screen w-full sm:w-[560px] lg:w-[min(calc(50vw+24px),960px)] border-l border-gray-200 bg-white shadow-2xl transition-transform duration-300 ease-in-out ${
                isOpen ? "translate-x-0" : "translate-x-full"
            }`}
        >
            <div className="flex h-full flex-col">
                <div className="flex items-center justify-between border-b border-gray-200 px-6 py-3.5">
                    <div>
                        <div className="text-xs font-semibold text-gray-500">
                            {displayData.sectionTitle}
                        </div>
                        <h2 className="mt-1 text-xl font-bold text-gray-900">
                            Timesheet Detail
                        </h2>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-10 w-10 items-center justify-center rounded-full text-gray-700 transition-colors hover:bg-gray-100"
                        aria-label="close"
                    >
                        <CloseIcon />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-6">
                    <div className="space-y-4 text-sm text-gray-900">
                        <div className="rounded-lg border border-gray-200 p-3">
                            <div className="text-xs font-semibold text-gray-500">
                                Description
                            </div>
                            <div className="mt-1 whitespace-pre-wrap break-words">
                                {displayData.description}
                            </div>
                        </div>

                        {renderSourceEntriesTable(
                            "Actual DB Entries",
                            "인보이스 보정 전 원본 작업일지 데이터",
                            displayData.sourceEntries
                        )}

                        {shouldShowFullGroupTable &&
                            renderSourceEntriesTable(
                                "Actual DB Entries - Full Group",
                                "선택한 날짜의 전체 실제 작업일지 데이터",
                                displayData.groupSourceEntries as TimesheetRowDetailSidePanelProps["sourceEntries"],
                                new Set(
                                    displayData.sourceEntries.map((entry) => entry.id)
                                ),
                                "group"
                            )}
                    </div>
                </div>
            </div>
        </aside>,
        document.body
    );
}
