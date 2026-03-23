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

    const renderSourceEntriesTable = (
        title: string,
        subtitle: string,
        entriesData: TimesheetRowDetailSidePanelProps["sourceEntries"],
        highlightedEntryIds: Set<number> = new Set()
    ) => (
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
                                const correctionLabel = getCorrectionLabel(entry);
                                const durationLabel = getDurationLabel(
                                    entry.dateFrom,
                                    entry.timeFrom,
                                    entry.dateTo,
                                    entry.timeTo
                                );
                                const isSameDateAsPrevious =
                                    index > 0 &&
                                    entries[index - 1]?.dateFrom === entry.dateFrom;
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
                                                : "odd:bg-white even:bg-gray-50/60"
                                        }`}
                                    >
                                        <td className="border-b border-r border-gray-200 px-3 py-2 text-center">
                                            {isSameDateAsPrevious ? "" : Number(month)}
                                        </td>
                                        <td className="border-b border-r border-gray-200 px-3 py-2 text-center">
                                            {isSameDateAsPrevious ? "" : Number(dayOfMonth)}
                                        </td>
                                        <td className="border-b border-r border-gray-200 px-3 py-2 text-center">
                                            {isSameDateAsPrevious
                                                ? ""
                                                : getWeekdayLabel(entry.dateFrom)}
                                        </td>
                                        <td className="border-b border-r border-gray-200 px-3 py-2 text-center whitespace-nowrap">
                                            {entry.descType}
                                        </td>
                                        <td className="border-b border-r border-gray-200 px-3 py-2 text-center whitespace-nowrap">
                                            {formatTimeToMinutes(entry.timeFrom)}
                                        </td>
                                        <td className="border-b border-r border-gray-200 px-3 py-2 text-center whitespace-nowrap">
                                            {formatTimeToMinutes(entry.timeTo)}
                                        </td>
                                        <td className="border-b border-r border-gray-200 px-3 py-2 text-center whitespace-nowrap">
                                            {durationLabel || "-"}
                                        </td>
                                        <td className={`border-b border-r border-gray-200 px-3 py-2 text-center whitespace-pre-line ${
                                            isWeekendDate(entry.dateFrom)
                                                ? "font-semibold text-red-600"
                                                : ""
                                        }`}>
                                            {correctionLabel}
                                        </td>
                                        <td className="border-b border-r border-gray-200 px-3 py-2 whitespace-pre-wrap break-words text-gray-900">
                                            {descriptionText || "-"}
                                        </td>
                                        <td className="border-b border-gray-200 px-3 py-2 whitespace-pre-wrap break-keep leading-5 text-gray-700">
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

    const getWeekdayLabel = (dateText: string) => {
        const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
        const date = new Date(`${dateText}T00:00:00`);
        return Number.isNaN(date.getTime()) ? "-" : weekdays[date.getDay()];
    };

    const isWeekendDate = (dateText: string) => {
        const date = new Date(`${dateText}T00:00:00`);
        if (Number.isNaN(date.getTime())) {
            return false;
        }

        const day = date.getDay();
        return day === 0 || day === 6;
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

    const getCorrectionLabel = (
        entry: TimesheetRowDetailSidePanelProps["sourceEntries"][number]
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
                                displayData.groupSourceEntries,
                                new Set(
                                    displayData.sourceEntries.map((entry) => entry.id)
                                )
                            )}
                    </div>
                </div>
            </div>
        </aside>,
        document.body
    );
}
