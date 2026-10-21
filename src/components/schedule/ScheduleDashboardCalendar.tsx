import { useEffect, useMemo, useRef, useState } from "react";
import CalendarMenu from "../CalendarMenu";
import CalendarHeader, {
    WeekDayHeader,
} from "../../pages/Dashboard/components/CalendarHeader";
import CalendarGrid from "../../pages/Dashboard/components/CalendarGrid";
import useIsMobile from "../../hooks/useIsMobile";
import { useHolidays } from "../../hooks/useHolidays";
import {
    useDashboardEvents,
    useMergedHolidays,
    useSortedEvents,
} from "../../hooks/useDashboardEvents";
import { useCellHeights } from "../../hooks/useCellHeights";
import {
    applyScheduleDateClick,
    EMPTY_SCHEDULE_DATE_SELECTION,
    generateTwoMonthGrid,
    splitIntoWeeks,
    type ScheduleDateSelection,
} from "../../utils/calendarUtils";
import {
    SCHEDULE_TEAM_LEADERS,
    type ScheduleInsertValues,
} from "./scheduleTableShared";
import PersonalScheduleModal, {
    type PersonalScheduleEntry,
} from "./PersonalScheduleModal";
import {
    createSchedulePersonalEntry,
    deleteSchedulePersonalEntry,
    fetchSchedulePersonalEntriesInMonth,
    updateSchedulePersonalEntry,
} from "../../lib/scheduleApi";
import { useToast } from "../ui/ToastProvider";
import ConfirmDialog from "../ui/ConfirmDialog";
import { useWorkReportStore, type StaffProfile } from "../../store/workReportStore";

export type DayAvailability = {
    leaders: number;
    members: number;
    /** 그날 일정에 미배정된 투입 가능 인원 (팀장 → 팀원 순) */
    names: string[];
};

function pad2(n: number) {
    return n < 10 ? `0${n}` : String(n);
}

/** 일정 막대·개인 일정 기간별 배정 인원 → 날짜별 이름 집합 */
function buildScheduledNamesByDay(
    bars: { start: string; end: string; teamMember: string }[],
    personalEntries: PersonalScheduleEntry[] = []
): Map<string, Set<string>> {
    const byDay = new Map<string, Set<string>>();
    const addRange = (startKey: string, endKey: string, names: string[]) => {
        if (names.length === 0) return;
        const start = new Date(`${startKey}T00:00:00`);
        const end = new Date(`${endKey}T00:00:00`);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return;
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const key = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
            let set = byDay.get(key);
            if (!set) {
                set = new Set();
                byDay.set(key, set);
            }
            for (const name of names) set.add(name);
        }
    };
    for (const bar of bars) {
        addRange(
            bar.start,
            bar.end,
            bar.teamMember.split(/\s+/).filter(Boolean)
        );
    }
    for (const entry of personalEntries) {
        addRange(entry.start, entry.end, entry.names);
    }
    return byDay;
}

/** 개인 일정 → 날짜별 항목 (같은 날 여러 건 유지) */
function buildPersonalEntriesByDay(
    entries: PersonalScheduleEntry[]
): Record<string, PersonalScheduleEntry[]> {
    const byDay = new Map<string, PersonalScheduleEntry[]>();
    for (const entry of entries) {
        const start = new Date(`${entry.start}T00:00:00`);
        const end = new Date(`${entry.end}T00:00:00`);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue;
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const key = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
            const list = byDay.get(key) ?? [];
            if (!list.some((item) => item.id === entry.id)) list.push(entry);
            byDay.set(key, list);
        }
    }
    const result: Record<string, PersonalScheduleEntry[]> = {};
    byDay.forEach((list, key) => {
        result[key] = list;
    });
    return result;
}

function buildDayAvailability(
    dateKeys: string[],
    staff: StaffProfile[],
    scheduledByDay: Map<string, Set<string>>
): Record<string, DayAvailability> {
    const leaderSet = new Set<string>(SCHEDULE_TEAM_LEADERS);
    const members = staff
        .filter(
            (member) =>
                member.department === "공사팀" &&
                member.name.trim() &&
                !leaderSet.has(member.name.trim())
        )
        .map((member) => member.name.trim());

    const result: Record<string, DayAvailability> = {};
    for (const dateKey of dateKeys) {
        const busy = scheduledByDay.get(dateKey) ?? new Set();
        const availableLeaders = SCHEDULE_TEAM_LEADERS.filter((name) => !busy.has(name));
        const availableMembers = members.filter((name) => !busy.has(name));
        result[dateKey] = {
            leaders: availableLeaders.length,
            members: availableMembers.length,
            names: [...availableLeaders, ...availableMembers],
        };
    }
    return result;
}

export type ScheduleCalendarEntry = {
    id: string;
    period: string;
    periodFrom?: string;
    teamMember?: string;
    shipName?: string;
};

/** Table row opened for calendar edit (prefill + update on save). */
export type ScheduleCalendarEditTarget = ScheduleInsertValues & {
    id: string;
};

const SCHEDULE_BAR_COLORS = [
    { name: "안재훈", color: "#93C5FD" },
    { name: "온권태", color: "#C4B5FD" },
    { name: "이효익", color: "#86EFAC" },
    { name: "정상민", color: "#FDBA74" },
] as const;

function scheduleBarColor(teamMember: string) {
    const names = new Set(teamMember.split(/\s+/).filter(Boolean));
    return SCHEDULE_BAR_COLORS.find((item) => names.has(item.name))?.color ?? "#D1D5DB";
}

function constructionStaffRatio(teamMember: string, staff: StaffProfile[]) {
    const construction = new Set(
        staff
            .filter((member) => member.department === "공사팀" && member.name.trim())
            .map((member) => member.name.trim())
    );
    if (construction.size === 0) return 0;
    const selected = new Set(teamMember.split(/\s+/).filter(Boolean));
    let count = 0;
    construction.forEach((name) => {
        if (selected.has(name)) count += 1;
    });
    return count / construction.size;
}

function monthDayKey(year: number, value: string): string | null {
    const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})$/);
    if (!match) return null;
    return `${year}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}`;
}

function padDatePart(n: number) {
    return n < 10 ? `0${n}` : String(n);
}

function todayDateKey() {
    const now = new Date();
    return `${now.getFullYear()}-${padDatePart(now.getMonth() + 1)}-${padDatePart(now.getDate())}`;
}

/** Resolve MM/DD~MM/DD (+ optional periodFrom) to YYYY-MM-DD start/end. */
export function resolveSchedulePeriodRange(
    period: string,
    periodFrom: string | undefined,
    viewYear: number
): { start: string; end: string } | null {
    const parts = period.split("~").map((part) => part.trim()).filter(Boolean);
    const storedFrom = /^\d{4}-\d{2}-\d{2}$/.test(periodFrom ?? "")
        ? periodFrom
        : null;
    const startYear = storedFrom ? Number(storedFrom.slice(0, 4)) : viewYear;
    const start = storedFrom ?? (parts[0] ? monthDayKey(startYear, parts[0]) : null);
    if (!start) return null;
    let end = parts[1] ? monthDayKey(startYear, parts[1]) : start;
    if (!end) end = start;
    if (parts[1] && end < start) {
        end = monthDayKey(startYear + 1, parts[1]) ?? end;
    }
    return { start, end };
}

export function scheduleBarsFromEntries(
    entries: ScheduleCalendarEntry[],
    viewYear: number,
    staff: StaffProfile[]
) {
    return entries.flatMap((entry) => {
        const parts = entry.period.split("~").map((part) => part.trim()).filter(Boolean);
        const storedFrom = /^\d{4}-\d{2}-\d{2}$/.test(entry.periodFrom ?? "")
            ? entry.periodFrom
            : null;
        const startYear = storedFrom ? Number(storedFrom.slice(0, 4)) : viewYear;
        const start = storedFrom ?? (parts[0] ? monthDayKey(startYear, parts[0]) : null);
        if (!start) return [];
        let end = parts[1] ? monthDayKey(startYear, parts[1]) : start;
        if (!end) end = start;
        if (parts[1] && end < start) {
            end = monthDayKey(startYear + 1, parts[1]) ?? end;
        }
        return [{
            id: entry.id,
            start,
            end,
            ratio: constructionStaffRatio(entry.teamMember ?? "", staff),
            color: scheduleBarColor(entry.teamMember ?? ""),
            shipName: entry.shipName?.trim() ?? "",
            teamMember: entry.teamMember?.trim() ?? "",
        }];
    });
}

/**
 * Dashboard calendar, shortened so it can sit under the schedule sheet.
 * Month navigation and event display match the dashboard. Editing stays there.
 */
export default function ScheduleDashboardCalendar({
    onScheduleSave,
    onScheduleUpdate,
    schedules = [],
    editTarget = null,
    onEditTargetClear,
}: {
    onScheduleSave?: (values: ScheduleInsertValues) => void;
    onScheduleUpdate?: (id: string, values: ScheduleInsertValues) => void;
    schedules?: ScheduleCalendarEntry[];
    editTarget?: ScheduleCalendarEditTarget | null;
    onEditTargetClear?: () => void;
}) {
    const today = new Date();
    const isMobile = useIsMobile();
    const [year, setYear] = useState(today.getFullYear());
    const [month, setMonth] = useState(today.getMonth());
    const [selection, setSelection] = useState<ScheduleDateSelection>(
        EMPTY_SCHEDULE_DATE_SELECTION
    );
    const [hoverDate, setHoverDate] = useState<string | null>(null);
    const [menuOpen, setMenuOpen] = useState(false);
    const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
    const [menuAnchorKey, setMenuAnchorKey] = useState<string | null>(null);
    const [dayDetailDateKey, setDayDetailDateKey] = useState<string | null>(null);
    const [dayDetailPosition, setDayDetailPosition] = useState<{
        x: number;
        y: number;
    } | null>(null);
    const [insertAfterDate, setInsertAfterDate] = useState<string | null>(null);
    const [insertEditId, setInsertEditId] = useState<string | null>(null);
    const [insertInitialValues, setInsertInitialValues] =
        useState<ScheduleInsertValues | null>(null);
    const [personalModalOpen, setPersonalModalOpen] = useState(false);
    const [personalDeleteTarget, setPersonalDeleteTarget] =
        useState<PersonalScheduleEntry | null>(null);
    const [personalDeleting, setPersonalDeleting] = useState(false);
    const [personalSchedules, setPersonalSchedules] = useState<
        PersonalScheduleEntry[]
    >([]);
    const { showError, showSuccess } = useToast();
    const allStaff = useWorkReportStore((state) => state.allStaff);
    const fetchAllStaff = useWorkReportStore((state) => state.fetchAllStaff);

    useEffect(() => {
        void fetchAllStaff();
    }, [fetchAllStaff]);

    const followingYear = month === 11 ? year + 1 : year;
    const followingMonth = month === 11 ? 0 : month + 1;

    // 개인 일정은 일정표 로드와 무관하게 DB에서 조회 (표시 구간: 이번 달 + 다음 달)
    useEffect(() => {
        let cancelled = false;
        void (async () => {
            try {
                const [current, following] = await Promise.all([
                    fetchSchedulePersonalEntriesInMonth(year, month),
                    fetchSchedulePersonalEntriesInMonth(
                        followingYear,
                        followingMonth
                    ),
                ]);
                if (cancelled) return;
                const byId = new Map<string, PersonalScheduleEntry>();
                for (const entry of [...current, ...following]) {
                    byId.set(entry.id, entry);
                }
                setPersonalSchedules(Array.from(byId.values()));
            } catch (err) {
                console.error(err);
                if (!cancelled) {
                    showError("개인 일정을 불러오지 못했습니다.");
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [year, month, followingYear, followingMonth, showError]);

    useEffect(() => {
        if (!editTarget) return;
        const fallbackYear = /^\d{4}/.test(editTarget.periodFrom)
            ? Number(editTarget.periodFrom.slice(0, 4))
            : new Date().getFullYear();
        const range =
            resolveSchedulePeriodRange(
                editTarget.period,
                editTarget.periodFrom,
                fallbackYear
            ) ?? (() => {
                const key = todayDateKey();
                return { start: key, end: key };
            })();
        const startDate = new Date(`${range.start}T00:00:00`);
        if (!Number.isNaN(startDate.getTime())) {
            setYear(startDate.getFullYear());
            setMonth(startDate.getMonth());
        }
        setHoverDate(null);
        setMenuOpen(false);
        setMenuPos(null);
        setSelection({
            anchor: null,
            start: range.start,
            end: range.end,
        });
        setInsertAfterDate(range.end);
        setInsertEditId(editTarget.id);
        const { id: _id, ...values } = editTarget;
        setInsertInitialValues(values);
    }, [editTarget]);

    const holidaysCurrent = useHolidays(year, month);
    const holidaysNext = useHolidays(followingYear, followingMonth);
    const holidays = useMemo(
        () => ({ ...holidaysCurrent, ...holidaysNext }),
        [holidaysCurrent, holidaysNext]
    );
    const { loading } = useDashboardEvents(year, month);
    const mergedHolidays = useMergedHolidays(holidays);
    const sortedEvents = useSortedEvents([], mergedHolidays);

    // 이번 달 + 다음 달 (총 2개월)
    const grid = useMemo(
        () => generateTwoMonthGrid(year, month),
        [year, month]
    );
    const weeks = useMemo(() => splitIntoWeeks(grid), [grid]);
    const scheduleBars = useMemo(
        () => scheduleBarsFromEntries(schedules, year, allStaff),
        [schedules, year, allStaff]
    );
    const personalEntriesByDay = useMemo(
        () => buildPersonalEntriesByDay(personalSchedules),
        [personalSchedules]
    );
    const dayAvailability = useMemo(() => {
        const dateKeys = grid.map((cell) => {
            const d = cell.date;
            const m = String(d.getMonth() + 1).padStart(2, "0");
            const day = String(d.getDate()).padStart(2, "0");
            return `${d.getFullYear()}-${m}-${day}`;
        });
        return buildDayAvailability(
            dateKeys,
            allStaff,
            buildScheduledNamesByDay(scheduleBars, personalSchedules)
        );
    }, [grid, allStaff, scheduleBars, personalSchedules]);
    const cellRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const headerRef = useRef<HTMLDivElement>(null);
    const { cellHeights, handleCellHeightChange } = useCellHeights(cellRefs, weeks);
    // 1개월 기준 높이를 유지해 주 높이를 맞추고, 2개월은 아래로 이어짐
    const singleMonthClosedHeight = isMobile ? 640 : 760;
    const [headerHeight, setHeaderHeight] = useState(isMobile ? 41 : 57);

    useEffect(() => {
        const header = headerRef.current;
        if (!header) return;
        const update = () => setHeaderHeight(header.offsetHeight);
        update();
        const observer = new ResizeObserver(update);
        observer.observe(header);
        return () => observer.disconnect();
    }, [isMobile]);

    const rowHeight =
        weeks.length > 0
            ? (singleMonthClosedHeight - headerHeight) / 5
            : undefined;

    const prevMonth = () => {
        setHoverDate(null);
        if (month === 0) {
            setYear((current) => current - 1);
            setMonth(11);
        } else {
            setMonth((current) => current - 1);
        }
    };

    const nextMonth = () => {
        setHoverDate(null);
        if (month === 11) {
            setYear((current) => current + 1);
            setMonth(0);
        } else {
            setMonth((current) => current + 1);
        }
    };

    const goToday = () => {
        const now = new Date();
        setYear(now.getFullYear());
        setMonth(now.getMonth());
    };

    const displayStart = selection.anchor ?? selection.start;
    const displayEnd = selection.anchor
        ? hoverDate ?? selection.anchor
        : selection.end;

    return (
        <section
            className="mt-6"
            aria-label="달력"
            onMouseLeave={() => setHoverDate(null)}
        >
            <CalendarHeader
                year={year}
                month={month}
                onPrevMonth={prevMonth}
                onNextMonth={nextMonth}
                onGoToday={goToday}
                isMobile={isMobile}
                compact
                monthSpan={2}
            />
            <div className="flex flex-col overflow-hidden rounded-sm border border-gray-200 bg-white">
                <div ref={headerRef} className="shrink-0">
                    <WeekDayHeader isMobile={isMobile} uniformColumns />
                </div>
                {loading ? (
                    <div
                        className="flex items-center justify-center text-sm text-gray-500"
                        style={{
                            height: Math.max(
                                0,
                                singleMonthClosedHeight - headerHeight
                            ),
                        }}
                    >
                        불러오는 중…
                    </div>
                ) : (
                    <CalendarGrid
                        weeks={weeks}
                        sortedEvents={sortedEvents}
                        today={today}
                        isMobile={isMobile}
                        dragStart={null}
                        dragEnd={null}
                        isDragging={false}
                        cellRefs={cellRefs}
                        cellHeights={cellHeights}
                        onCellHeightChange={handleCellHeightChange}
                        onEditEvent={() => {}}
                        onDeleteEvent={() => {}}
                        onEventClick={() => {}}
                        onDateClick={(dateKey, event) => {
                            if (insertAfterDate) return;
                            setHoverDate(null);
                            const next = applyScheduleDateClick(selection, dateKey);
                            setSelection(next);
                            const completed = next.anchor == null && next.start != null;
                            if (completed) {
                                setDayDetailDateKey(null);
                                setDayDetailPosition(null);
                                setMenuAnchorKey(dateKey);
                                setMenuPos({ x: event.clientX, y: event.clientY });
                                setMenuOpen(true);
                                return;
                            }
                            setMenuOpen(false);
                            setMenuPos(null);
                            setMenuAnchorKey(null);
                        }}
                        onDateHover={(dateKey) => {
                            if (selection.anchor) setHoverDate(dateKey);
                        }}
                        selectionStart={displayStart}
                        selectionEnd={displayEnd}
                        selectionPending={selection.anchor != null}
                        allowOutsideMonthSelect
                        onDragStart={() => {}}
                        onDragEnter={() => {}}
                        onHiddenCountClick={() => {}}
                        // 날짜·공휴일 별표·개인일정 이름 줄 아래로 막대/태그 배치
                        tagLayerTop={isMobile ? 28 : 34}
                        tagsBesideDate
                        uniformColumns
                        insertAfterDate={insertAfterDate}
                        onInsertClose={() => {
                            setInsertAfterDate(null);
                            setInsertEditId(null);
                            setInsertInitialValues(null);
                            onEditTargetClear?.();
                        }}
                        onScheduleSave={onScheduleSave}
                        insertInitialValues={insertInitialValues}
                        insertEditId={insertEditId}
                        onScheduleUpdate={(id, values) => {
                            onScheduleUpdate?.(id, values);
                            onEditTargetClear?.();
                        }}
                        scheduleBars={scheduleBars}
                        dayAvailability={dayAvailability}
                        personalEntriesByDay={personalEntriesByDay}
                        onPersonalEntrySave={async (entry) => {
                            try {
                                const saved = await updateSchedulePersonalEntry(
                                    entry.id,
                                    {
                                        start: entry.start,
                                        end: entry.end,
                                        names: entry.names,
                                        reason: entry.reason,
                                    }
                                );
                                setPersonalSchedules((current) =>
                                    current.map((item) =>
                                        item.id === saved.id ? saved : item
                                    )
                                );
                                showSuccess("개인 일정을 수정했습니다.");
                            } catch (err) {
                                console.error(err);
                                showError(
                                    err instanceof Error
                                        ? err.message
                                        : "개인 일정 수정에 실패했습니다."
                                );
                                throw err;
                            }
                        }}
                        onPersonalEntryDelete={(entry) => {
                            setPersonalDeleteTarget(entry);
                        }}
                        rowHeight={rowHeight}
                        dayDetailDateKey={dayDetailDateKey}
                        dayDetailPosition={dayDetailPosition}
                        suppressDayDetail={
                            menuOpen ||
                            insertAfterDate != null ||
                            personalModalOpen
                        }
                        onDayDetailClose={() => {
                            setDayDetailDateKey(null);
                            setDayDetailPosition(null);
                        }}
                    />
                )}
            </div>
            <CalendarMenu
                variant="schedule"
                isOpen={menuOpen}
                anchorEl={
                    menuAnchorKey ? cellRefs.current[menuAnchorKey] ?? null : null
                }
                position={menuPos ?? undefined}
                selectedDate={selection.start}
                onClose={() => {
                    setMenuOpen(false);
                    setMenuPos(null);
                    setMenuAnchorKey(null);
                }}
                onDayDetail={
                    isMobile &&
                    selection.start != null &&
                    selection.end != null &&
                    selection.start === selection.end
                        ? () => {
                              const dateKey = selection.start;
                              if (!dateKey) return;
                              setDayDetailPosition(menuPos);
                              setDayDetailDateKey(dateKey);
                          }
                        : undefined
                }
                onAddSchedule={() => {
                    if (selection.end) {
                        setDayDetailDateKey(null);
                        setDayDetailPosition(null);
                        setInsertEditId(null);
                        setInsertInitialValues(null);
                        setInsertAfterDate(selection.end);
                    }
                }}
                onPersonalSchedule={() => {
                    if (!selection.start) return;
                    setDayDetailDateKey(null);
                    setDayDetailPosition(null);
                    setPersonalModalOpen(true);
                }}
            />
            <PersonalScheduleModal
                isOpen={personalModalOpen}
                onClose={() => setPersonalModalOpen(false)}
                periodStart={selection.start}
                periodEnd={selection.end}
                onSubmit={async (entry) => {
                    try {
                        const saved = await createSchedulePersonalEntry({
                            start: entry.start,
                            end: entry.end,
                            names: entry.names,
                            reason: entry.reason,
                        });
                        setPersonalSchedules((current) => {
                            if (current.some((item) => item.id === saved.id)) {
                                return current;
                            }
                            return [...current, saved];
                        });
                        showSuccess("개인 일정을 등록했습니다.");
                    } catch (err) {
                        console.error(err);
                        showError(
                            err instanceof Error
                                ? err.message
                                : "개인 일정 등록에 실패했습니다."
                        );
                        throw err;
                    }
                }}
            />
            <ConfirmDialog
                isOpen={personalDeleteTarget != null}
                onClose={() => {
                    if (personalDeleting) return;
                    setPersonalDeleteTarget(null);
                }}
                onConfirm={() => {
                    void (async () => {
                        if (!personalDeleteTarget) return;
                        setPersonalDeleting(true);
                        try {
                            await deleteSchedulePersonalEntry(
                                personalDeleteTarget.id
                            );
                            setPersonalSchedules((current) =>
                                current.filter(
                                    (item) => item.id !== personalDeleteTarget.id
                                )
                            );
                            showSuccess("개인 일정을 삭제했습니다.");
                            setPersonalDeleteTarget(null);
                        } catch (err) {
                            console.error(err);
                            showError(
                                err instanceof Error
                                    ? err.message
                                    : "개인 일정 삭제에 실패했습니다."
                            );
                        } finally {
                            setPersonalDeleting(false);
                        }
                    })();
                }}
                title="개인 일정 삭제"
                message={`${personalDeleteTarget?.names.join(" ") ?? ""} 일정을 삭제할까요?`}
                confirmText="삭제"
                cancelText="취소"
                confirmVariant="danger"
                isLoading={personalDeleting}
            />
        </section>
    );
}
