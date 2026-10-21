import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import WeekRow from "../../../components/calendar/WeekRow";
import ActionMenu from "../../../components/common/ActionMenu";
import Button from "../../../components/common/Button";
import TextInput from "../../../components/ui/TextInput";
import BaseModal from "../../../components/ui/BaseModal";
import DatePicker from "../../../components/ui/DatePicker";
import Chip from "../../../components/ui/Chip";
import { useToast } from "../../../components/ui/ToastProvider";
import {
    IconCheck,
    IconClose,
    IconEdit,
    IconStar,
    IconTrash,
} from "../../../components/icons/Icons";
import type { DayScheduleHoverInfo } from "../../../components/calendar/DayCell";
import {
    VEHICLES,
    LOCATIONS,
    ORDER_PERSONS,
    useWorkReportStore,
    type StaffProfile,
} from "../../../store/workReportStore";
import { CalendarEvent } from "../../../types";
import {
    getWeekEventRows,
    getEventsForDate,
    getSafeDateKey,
    getColumnPadding,
    getDateRangeRole,
} from "../../../utils/calendarUtils";
import { prefetchWorkLogById } from "../../../lib/workLogApi";
import { useStaffSortMeta } from "../../../hooks/useStaffSortMeta";
import {
    sortPeopleByRoleAndJoinDate,
    type PersonSortMeta,
} from "../../../utils/sortPeopleByRoleAndJoinDate";
import {
    SCHEDULE_COLUMNS,
    SCHEDULE_TEAM_LEADERS,
    type ScheduleInsertValues,
} from "../../../components/schedule/scheduleTableShared";
import {
    formatPersonalSchedulePeriod,
    type PersonalScheduleEntry,
} from "../../../components/schedule/PersonalScheduleModal";

interface CalendarGridProps {
    weeks: {
        date: Date;
        inMonth: boolean;
        isFollowingMonth?: boolean;
    }[][];
    sortedEvents: CalendarEvent[];
    today: Date;
    isMobile?: boolean;
    dragStart: string | null;
    dragEnd: string | null;
    isDragging: boolean;
    cellRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
    cellHeights: Record<string, number>;
    onEditEvent: (event: CalendarEvent) => void;
    onDeleteEvent: (eventId: string) => void;
    onEventClick: (event: CalendarEvent, e: React.MouseEvent) => void;
    onDateClick: (dateKey: string, e: React.MouseEvent) => void;
    onDateHover?: (dateKey: string) => void;
    selectionStart?: string | null;
    selectionEnd?: string | null;
    /** First click is waiting for the second date. */
    selectionPending?: boolean;
    allowOutsideMonthSelect?: boolean;
    /** Open an insert slot after the week that contains this date. */
    insertAfterDate?: string | null;
    onInsertClose?: () => void;
    onScheduleSave?: (values: ScheduleInsertValues) => void;
    /** Prefill the insert form (edit mode). */
    insertInitialValues?: ScheduleInsertValues | null;
    /** When set, save updates this row instead of inserting. */
    insertEditId?: string | null;
    onScheduleUpdate?: (id: string, values: ScheduleInsertValues) => void;
    onDragStart: (dateKey: string, e: React.MouseEvent) => void;
    onDragEnter: (dateKey: string) => void;
    onHiddenCountClick: (dateKey: string, hiddenEventIds: string[]) => void;
    onCellHeightChange?: (dateKey: string, height: number) => void;
    /** Distance from the top of a cell to the first event. Defaults to the dashboard offset. */
    tagLayerTop?: number;
    /** Place the first event row to the right of the date number. */
    tagsBesideDate?: boolean;
    /** Use the same horizontal inset on every weekday, including Sat and Sun. */
    uniformColumns?: boolean;
    /** Lock each week row so an insert slot grows the calendar instead of the cells. */
    rowHeight?: number;
    /** Saved schedule ranges drawn under the date numbers. */
    scheduleBars?: {
        id: string;
        start: string;
        end: string;
        ratio: number;
        color: string;
        shipName: string;
        teamMember: string;
    }[];
    /** Per-day available leaders/members (not assigned to a schedule that day). */
    dayAvailability?: Record<
        string,
        { leaders: number; members: number; names: string[] }
    >;
    /** 개인 일정 — 날짜칸 상단 빨간 이름 (일정표·막대에는 없음) */
    personalEntriesByDay?: Record<string, PersonalScheduleEntry[]>;
    onPersonalEntrySave?: (
        entry: PersonalScheduleEntry
    ) => void | Promise<void>;
    onPersonalEntryDelete?: (entry: PersonalScheduleEntry) => void;
    /** 외부(예: 일정 메뉴)에서 해당 날짜 상세 팝오버를 연다. */
    dayDetailDateKey?: string | null;
    dayDetailPosition?: { x: number; y: number } | null;
    /** 일정 추가/개인 일정 메뉴가 열리면 상세 팝오버를 닫는다. */
    suppressDayDetail?: boolean;
    onDayDetailClose?: () => void;
}

function scheduleBarLength(bar: { start: string; end: string }) {
    const start = new Date(`${bar.start}T00:00:00`).getTime();
    const end = new Date(`${bar.end}T00:00:00`).getTime();
    return end - start;
}

function scheduleBarsOverlap(
    a: { start: string; end: string },
    b: { start: string; end: string }
) {
    return a.start <= b.end && b.start <= a.end;
}

function assignScheduleBarLanes(
    bars: {
        id: string;
        start: string;
        end: string;
        ratio: number;
        color: string;
        shipName: string;
        teamMember: string;
    }[]
) {
    const placed: { start: string; end: string; lane: number; ratio: number }[] = [];
    const laned = [...bars]
        .sort((a, b) => {
            const byLength = scheduleBarLength(b) - scheduleBarLength(a);
            if (byLength !== 0) return byLength;
            return a.start.localeCompare(b.start) || a.end.localeCompare(b.end);
        })
        .map((bar) => {
            const used = new Set(
                placed.filter((other) => scheduleBarsOverlap(other, bar)).map((other) => other.lane)
            );
            let lane = 0;
            while (used.has(lane)) lane += 1;
            placed.push({ start: bar.start, end: bar.end, lane, ratio: bar.ratio });
            return { ...bar, lane };
        });

    return laned.map((bar) => {
        const priorLaneRatios: number[] = [];
        for (let lane = 0; lane < bar.lane; lane += 1) {
            const overlapping = placed.filter(
                (other) => other.lane === lane && scheduleBarsOverlap(other, bar)
            );
            if (overlapping.length === 0) continue;
            priorLaneRatios.push(
                overlapping.reduce((max, other) => Math.max(max, other.ratio), 0)
            );
        }
        return { ...bar, priorLaneRatios };
    });
}

/** Shrink stacked bar ratios so the tallest stack fits in the day cell. */
function scaleScheduleBarStacks<
    T extends { ratio: number; priorLaneRatios: number[] },
>(bars: T[], availablePx: number, minHeight = 6, gap = 2): T[] {
    if (bars.length === 0 || availablePx <= 0) return bars;
    const rawHeight = (ratio: number) =>
        Math.max(minHeight, availablePx * Math.min(1, Math.max(0, ratio)));
    let maxBottom = 0;
    bars.forEach((bar) => {
        let top = 0;
        bar.priorLaneRatios.forEach((ratio) => {
            top += rawHeight(ratio) + gap;
        });
        maxBottom = Math.max(maxBottom, top + rawHeight(bar.ratio));
    });
    if (maxBottom <= availablePx) return bars;
    const scale = availablePx / maxBottom;
    return bars.map((bar) => ({
        ...bar,
        ratio: bar.ratio * scale,
        priorLaneRatios: bar.priorLaneRatios.map((ratio) => ratio * scale),
    }));
}

const SCHEDULE_FORM_TABS = [
    "Customer",
    "Ship name",
    "Work Item",
    "Team member",
    "Car",
    "Remark",
] as const;

const TAB_TITLE: Record<(typeof SCHEDULE_FORM_TABS)[number], string> = {
    Customer: "Customer",
    "Ship name": "Ship name / Engine type / Work location",
    "Work Item": "Work Item",
    "Team member": "Team member",
    Car: "Car / Yard PIC",
    Remark: "Remark",
};

const FORM_GROUP_COLORS = {
    customer: "#FFFEF6",
    ship: "#F7FDF9",
    period: "#F7FAFF",
    workItem: "#FFF9F4",
    team: "#F9F6FF",
    car: "#F5FCFE",
    remark: "#FFF7FA",
} as const;

const COLUMN_TAB: Record<string, (typeof SCHEDULE_FORM_TABS)[number]> = {
    customerCompany: "Customer",
    customerContact: "Customer",
    shipName: "Ship name",
    engineType: "Ship name",
    workLocation: "Ship name",
    workItem: "Work Item",
    manpower: "Team member",
    teamMember: "Team member",
    car: "Car",
    yardPic: "Car",
    remark: "Remark",
};

const COLUMN_GROUP_COLOR: Record<string, string> = {
    customerCompany: FORM_GROUP_COLORS.customer,
    customerContact: FORM_GROUP_COLORS.customer,
    shipName: FORM_GROUP_COLORS.ship,
    engineType: FORM_GROUP_COLORS.ship,
    workLocation: FORM_GROUP_COLORS.ship,
    period: FORM_GROUP_COLORS.period,
    workItem: FORM_GROUP_COLORS.workItem,
    manpower: FORM_GROUP_COLORS.team,
    teamMember: FORM_GROUP_COLORS.team,
    car: FORM_GROUP_COLORS.car,
    yardPic: FORM_GROUP_COLORS.car,
    remark: FORM_GROUP_COLORS.remark,
};

const TAB_GROUP_COLOR: Record<(typeof SCHEDULE_FORM_TABS)[number], string> = {
    Customer: FORM_GROUP_COLORS.customer,
    "Ship name": FORM_GROUP_COLORS.ship,
    "Work Item": FORM_GROUP_COLORS.workItem,
    "Team member": FORM_GROUP_COLORS.team,
    Car: FORM_GROUP_COLORS.car,
    Remark: FORM_GROUP_COLORS.remark,
};

type FormControlTone = {
    fill: string;
    active: string;
    line: string;
};

const FORM_CONTROL_TONES: Record<(typeof SCHEDULE_FORM_TABS)[number], FormControlTone> = {
    Customer: { fill: "#FFF6CC", active: "#FFD766", line: "#F0E2A4" },
    "Ship name": { fill: "#E5F6EB", active: "#9AD9B4", line: "#C9E6D4" },
    "Work Item": { fill: "#FFEDDE", active: "#FFBE96", line: "#F0D4C0" },
    "Team member": { fill: "#F0E9FF", active: "#C4A6F5", line: "#DDD0F2" },
    Car: { fill: "#E4F5FB", active: "#9DD4EA", line: "#C5E3EE" },
    Remark: { fill: "#FFE8F1", active: "#FFB0C8", line: "#F3D0DE" },
};

function columnSelectionStyle(
    key: string,
    activeTab: (typeof SCHEDULE_FORM_TABS)[number],
    accent: boolean
) {
    const tab = COLUMN_TAB[key];
    const tone = tab ? FORM_CONTROL_TONES[tab] : null;
    if (tab === activeTab && tone) {
        return {
            backgroundColor: tone.fill,
            boxShadow: accent ? `inset 0 -3px 0 ${tone.active}` : undefined,
        };
    }
    return {
        backgroundColor: COLUMN_GROUP_COLOR[key],
        boxShadow: undefined,
    };
}

const FormToneContext = React.createContext<FormControlTone>(FORM_CONTROL_TONES.Customer);

function ToneButton({
    selected = false,
    className = "",
    style,
    variant: _variant,
    ...props
}: React.ComponentProps<typeof Button> & { selected?: boolean }) {
    const tone = React.useContext(FormToneContext);
    return (
        <Button
            {...props}
            tabIndex={-1}
            variant="outline"
            className={`!text-[#101828] transition-[filter] duration-150 hover:brightness-95 active:brightness-90 ${className}`}
            style={{
                backgroundColor: selected ? tone.active : tone.fill,
                borderColor: tone.line,
                color: "#101828",
                ...style,
            }}
        />
    );
}

function ToneTextInput(props: React.ComponentProps<typeof TextInput>) {
    const tone = React.useContext(FormToneContext);
    return (
        <TextInput
            {...props}
            boxStyle={{ backgroundColor: tone.fill, borderColor: tone.line }}
        />
    );
}

function ToneBox({
    className,
    children,
}: {
    className?: string;
    children: React.ReactNode;
}) {
    const tone = React.useContext(FormToneContext);
    return (
        <div className={className} style={{ backgroundColor: tone.fill, borderColor: tone.line }}>
            {children}
        </div>
    );
}

const ToneTextarea = React.forwardRef<
    HTMLTextAreaElement,
    React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function ToneTextarea({ className = "", style, ...props }, ref) {
    const tone = React.useContext(FormToneContext);
    return (
        <textarea
            ref={ref}
            {...props}
            spellCheck={false}
            className={className}
            style={{ backgroundColor: tone.fill, borderColor: tone.line, ...style }}
        />
    );
});

const CUSTOMER_GROUPS = [
    { id: "ELU", label: "Everllence-ELU" },
    { id: "PRIME", label: "Everllence-Prime" },
    { id: "DIRECT", label: "직접입력" },
] as const;

type CustomerGroupId = (typeof CUSTOMER_GROUPS)[number]["id"];

type CustomerDraft = {
    group: CustomerGroupId | null;
    companyDirect: string;
    person: string | null;
    personDirect: string;
    contactDirect: string;
    extraNames: string[];
};

const EMPTY_CUSTOMER_DRAFT: CustomerDraft = {
    group: null,
    companyDirect: "",
    person: null,
    personDirect: "",
    contactDirect: "",
    extraNames: [],
};

function customerTableValues(draft: CustomerDraft) {
    const company =
        draft.group === "DIRECT"
            ? draft.companyDirect
            : CUSTOMER_GROUPS.find((item) => item.id === draft.group)?.label ?? "";
    const contact =
        draft.group === "DIRECT"
            ? draft.contactDirect
            : draft.person === "DIRECT"
              ? draft.personDirect
              : draft.person && draft.person !== "DIRECT"
                ? draft.person
                : "";
    return { customerCompany: company, customerContact: contact };
}

type ShipDraft = {
    shipName: string;
    engineType: string;
};

const EMPTY_SHIP_DRAFT: ShipDraft = {
    shipName: "",
    engineType: "",
};

type LocationDraft = {
    locations: string[];
    locationCustom: string;
    extraLocations: string[];
    locationDetail: string;
};

const EMPTY_LOCATION_DRAFT: LocationDraft = {
    locations: [],
    locationCustom: "",
    extraLocations: [],
    locationDetail: "",
};

function shipTableValues(draft: ShipDraft) {
    return {
        shipName: draft.shipName,
        engineType: draft.engineType,
    };
}

function locationTableValue(draft: LocationDraft) {
    const places = draft.locations.filter((place) => place.trim()).join(", ");
    const detail = draft.locationDetail.trim();
    if (places && detail) return `${places}\n${detail}`;
    return places || detail;
}

function ShipCardFields({
    draft,
    onChange,
    location,
    onLocationChange,
}: {
    draft: ShipDraft;
    onChange: (next: ShipDraft) => void;
    location: LocationDraft;
    onLocationChange: (next: LocationDraft) => void;
}) {
    const places = [...LOCATIONS, ...location.extraLocations];
    const toggleLocation = (name: string) => {
        const selected = location.locations.includes(name);
        onLocationChange({
            ...location,
            locations: selected
                ? location.locations.filter((item) => item !== name)
                : [...location.locations, name],
        });
    };
    const addCustomLocation = () => {
        const name = location.locationCustom.trim();
        if (!name) return;
        onLocationChange({
            ...location,
            locationCustom: "",
            extraLocations: location.extraLocations.includes(name)
                ? location.extraLocations
                : [...location.extraLocations, name],
            locations: location.locations.includes(name)
                ? location.locations
                : [...location.locations, name],
        });
    };

    return (
        <div className="mt-3 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
            <div className="flex gap-3">
                <ToneTextInput
                    value={draft.shipName}
                    onChange={(value) => onChange({ ...draft, shipName: value })}
                    placeholder="Ship name"
                    uppercase
                    className="min-w-0 flex-1"
                />
                <ToneTextInput
                    value={draft.engineType}
                    onChange={(value) => onChange({ ...draft, engineType: value })}
                    placeholder="Engine type"
                    uppercase
                    className="min-w-0 flex-1"
                />
            </div>
            <div className="flex flex-col gap-2">
                <p className="text-left text-sm font-medium text-gray-800">Work location</p>
                <div className="grid grid-cols-4 gap-2">
                    {places.map((name) => (
                        <ToneButton
                            key={name}
                            type="button"
                            selected={location.locations.includes(name)}
                            size="sm"
                            fullWidth
                            onClick={() => toggleLocation(name)}
                        >
                            {name}
                        </ToneButton>
                    ))}
                </div>
                <div className="flex gap-2">
                    <ToneBox className="flex h-12 min-w-0 flex-1 items-center gap-2 rounded-xl border px-3">
                        <input
                            value={location.locationCustom}
                            onChange={(event) =>
                                onLocationChange({ ...location, locationCustom: event.target.value })
                            }
                            onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                    event.preventDefault();
                                    addCustomLocation();
                                }
                            }}
                            placeholder="Work location"
                            className="min-w-0 flex-1 bg-transparent text-[16px] text-[#101828] outline-none placeholder:text-[#99a1af]"
                        />
                        <ToneButton type="button" selected size="sm" onClick={addCustomLocation}>
                            추가
                        </ToneButton>
                    </ToneBox>
                    <ToneBox className="flex h-12 min-w-0 flex-1 items-center rounded-xl border px-3">
                        <input
                            value={location.locationDetail}
                            onChange={(event) =>
                                onLocationChange({ ...location, locationDetail: event.target.value })
                            }
                            placeholder="상세 위치"
                            className="min-w-0 flex-1 bg-transparent text-center text-[16px] text-[#101828] outline-none placeholder:text-[#99a1af]"
                        />
                    </ToneBox>
                </div>
            </div>
        </div>
    );
}

function CustomerCardFields({
    draft,
    onChange,
}: {
    draft: CustomerDraft;
    onChange: (next: CustomerDraft) => void;
}) {
    const { group, companyDirect, person, personDirect, contactDirect, extraNames } = draft;
    const names =
        group === "ELU" || group === "PRIME" ? [...ORDER_PERSONS[group], ...extraNames] : [];
    const addCustomName = () => {
        const name = personDirect.trim();
        if (!name) return;
        onChange({
            ...draft,
            extraNames: extraNames.includes(name) ? extraNames : [...extraNames, name],
            person: name,
            personDirect: "",
        });
    };

    return (
        <div className="mt-3 flex min-h-0 flex-1 gap-3 overflow-y-auto">
            <div className="flex w-1/4 shrink-0 flex-col gap-2">
                {CUSTOMER_GROUPS.map((item) => (
                    <ToneButton
                        key={item.id}
                        type="button"
                        selected={group === item.id}
                        size="sm"
                        fullWidth
                        onClick={() =>
                            onChange({
                                ...draft,
                                group: item.id,
                                person: null,
                                personDirect: "",
                                extraNames: [],
                            })
                        }
                    >
                        {item.label}
                    </ToneButton>
                ))}
                {group === "DIRECT" ? (
                    <ToneTextInput
                        value={companyDirect}
                        onChange={(value) => onChange({ ...draft, companyDirect: value })}
                        placeholder="직접입력"
                    />
                ) : null}
            </div>
            <div aria-hidden className="w-px shrink-0 self-stretch bg-gray-300" />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
                {group === "DIRECT" ? (
                    <ToneTextInput
                        value={contactDirect}
                        onChange={(value) => onChange({ ...draft, contactDirect: value })}
                        placeholder="직접입력"
                    />
                ) : null}
                {names.length > 0 ? (
                    <>
                        <div className="grid grid-cols-3 gap-2">
                            {names.map((name) => (
                                <ToneButton
                                    key={name}
                                    type="button"
                                    selected={person === name}
                                    size="sm"
                                    fullWidth
                                    onClick={() =>
                                        onChange({ ...draft, person: name, personDirect: "" })
                                    }
                                >
                                    {name}
                                </ToneButton>
                            ))}
                        </div>
                        <ToneBox className="flex h-12 items-center gap-2 rounded-xl border px-3">
                            <input
                                value={personDirect}
                                onChange={(event) =>
                                    onChange({ ...draft, personDirect: event.target.value })
                                }
                                onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                        event.preventDefault();
                                        addCustomName();
                                    }
                                }}
                                placeholder="이름"
                                className="min-w-0 flex-1 bg-transparent text-[16px] text-[#101828] outline-none placeholder:text-[#99a1af]"
                            />
                            <ToneButton type="button" selected size="sm" onClick={addCustomName}>
                                추가
                            </ToneButton>
                        </ToneBox>
                    </>
                ) : null}
            </div>
        </div>
    );
}

const STAFF_ROLE_ORDER: Record<string, number> = {
    대표: 1,
    감사: 2,
    부장: 3,
    차장: 4,
    과장: 5,
    대리: 6,
    주임: 7,
    사원: 8,
    인턴: 9,
};

type TeamDraft = {
    members: string[];
    memberCustom: string;
    extraMembers: string[];
};

const EMPTY_TEAM_DRAFT: TeamDraft = {
    members: [],
    memberCustom: "",
    extraMembers: [],
};

function teamMemberTableValue(
    draft: TeamDraft,
    metaByName: Map<string, PersonSortMeta>
) {
    const names = draft.members.filter((name) => name.trim());
    return sortPeopleByRoleAndJoinDate(names, metaByName, {
        priorityFirst: SCHEDULE_TEAM_LEADERS,
    }).join(" ");
}

type CarDraft = {
    selected: string[];
    notes: Record<string, string>;
};

const EMPTY_CAR_DRAFT: CarDraft = {
    selected: [],
    notes: {},
};

function carTableValue(draft: CarDraft) {
    return VEHICLES.filter((vehicle) => draft.selected.includes(vehicle))
        .map((vehicle) => {
            const note = draft.notes[vehicle]?.trim();
            return note ? `${vehicle} ${note}` : vehicle;
        })
        .join("\n");
}

function teamMemberCount(draft: TeamDraft) {
    const count = draft.members.filter((name) => name.trim()).length;
    return count > 0 ? String(count) : "";
}

function teamMemberGroups(staff: StaffProfile[]) {
    const regular = staff.filter((member) => member.department !== "공무팀");
    const admin = staff.filter((member) => member.department === "공무팀");
    const byRole = new Map<string, string[]>();
    regular.forEach((member) => {
        const role = member.position?.trim();
        const name = member.name?.trim();
        if (!role || !name) return;
        const names = byRole.get(role) ?? [];
        if (!names.includes(name)) names.push(name);
        byRole.set(role, names);
    });
    const groups = [...byRole.entries()]
        .map(([label, names]) => ({
            label,
            names: [...names].sort((a, b) => a.localeCompare(b, "ko")),
        }))
        .sort(
            (a, b) =>
                (STAFF_ROLE_ORDER[a.label] ?? 999) - (STAFF_ROLE_ORDER[b.label] ?? 999)
        );
    const adminNames = [...admin]
        .sort((a, b) => {
            const orderA = STAFF_ROLE_ORDER[a.position] ?? 999;
            const orderB = STAFF_ROLE_ORDER[b.position] ?? 999;
            if (orderA !== orderB) return orderA - orderB;
            return a.name.localeCompare(b.name, "ko");
        })
        .map((member) => member.name.trim())
        .filter(Boolean);
    return { groups, adminNames };
}

function TeamMemberCardFields({
    draft,
    onChange,
}: {
    draft: TeamDraft;
    onChange: (next: TeamDraft) => void;
}) {
    const allStaff = useWorkReportStore((state) => state.allStaff);
    const staffLoading = useWorkReportStore((state) => state.staffLoading);
    const fetchAllStaff = useWorkReportStore((state) => state.fetchAllStaff);
    const [adminTeamOpen, setAdminTeamOpen] = useState(false);

    useEffect(() => {
        void fetchAllStaff();
    }, [fetchAllStaff]);

    const { groups, adminNames } = teamMemberGroups(allStaff);
    const listed = new Set([...groups.flatMap((group) => group.names), ...adminNames]);
    const extras = draft.extraMembers.filter((name) => !listed.has(name));
    const toggleMember = (name: string) => {
        const selected = draft.members.includes(name);
        onChange({
            ...draft,
            members: selected
                ? draft.members.filter((item) => item !== name)
                : [...draft.members, name],
        });
    };
    const addCustomMember = () => {
        const name = draft.memberCustom.trim();
        if (!name) return;
        onChange({
            ...draft,
            memberCustom: "",
            extraMembers: draft.extraMembers.includes(name)
                ? draft.extraMembers
                : [...draft.extraMembers, name],
            members: draft.members.includes(name) ? draft.members : [...draft.members, name],
        });
    };

    return (
        <div className="mt-3 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
            {staffLoading && allStaff.length === 0 ? (
                <p className="py-6 text-center text-sm text-gray-500">불러오는 중…</p>
            ) : (
                groups.map((group) => (
                    <div key={group.label} className="flex items-start gap-2">
                        <p className="flex h-[30px] w-12 shrink-0 items-center text-sm font-medium text-gray-800">
                            {group.label}
                        </p>
                        <div className="grid min-w-0 flex-1 grid-cols-6 gap-1.5">
                            {group.names.map((name) => (
                                <ToneButton
                                    key={name}
                                    type="button"
                                    selected={draft.members.includes(name)}
                                    size="sm"
                                    fullWidth
                                    className="!px-0.5 !text-[12px]"
                                    onClick={() => toggleMember(name)}
                                >
                                    {name}
                                </ToneButton>
                            ))}
                        </div>
                    </div>
                ))
            )}
            {adminNames.length > 0 ? (
                <div className="flex items-start gap-2">
                    <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => setAdminTeamOpen((open) => !open)}
                        title={adminTeamOpen ? "숨기기" : "보기"}
                        className="flex h-[30px] w-12 shrink-0 items-center rounded-md text-left text-sm font-medium text-gray-800 transition-colors hover:bg-black/5"
                    >
                        공무팀
                    </button>
                    {adminTeamOpen ? (
                        <div className="grid min-w-0 flex-1 grid-cols-6 gap-1.5">
                            {adminNames.map((name) => (
                                <ToneButton
                                    key={name}
                                    type="button"
                                    selected={draft.members.includes(name)}
                                    size="sm"
                                    fullWidth
                                    className="!px-0.5 !text-[12px]"
                                    onClick={() => toggleMember(name)}
                                >
                                    {name}
                                </ToneButton>
                            ))}
                        </div>
                    ) : (
                        <button
                            type="button"
                            tabIndex={-1}
                            onClick={() => setAdminTeamOpen(true)}
                            className="flex h-[30px] items-center rounded-md px-2 text-[12px] font-normal text-gray-500 transition-colors hover:bg-black/5 hover:text-gray-700"
                        >
                            보기 ({adminNames.length})
                        </button>
                    )}
                </div>
            ) : null}
            {extras.length > 0 ? (
                <div className="flex items-start gap-2">
                    <span aria-hidden className="w-12 shrink-0" />
                    <div className="grid min-w-0 flex-1 grid-cols-6 gap-1.5">
                    {extras.map((name) => (
                        <ToneButton
                            key={name}
                            type="button"
                            selected={draft.members.includes(name)}
                            size="sm"
                            fullWidth
                            className="!px-0.5 !text-[12px]"
                            onClick={() => toggleMember(name)}
                        >
                            {name}
                        </ToneButton>
                    ))}
                    </div>
                </div>
            ) : null}
            <ToneBox className="flex h-12 shrink-0 items-center gap-2 rounded-xl border px-3">
                <input
                    value={draft.memberCustom}
                    onChange={(event) => onChange({ ...draft, memberCustom: event.target.value })}
                    onKeyDown={(event) => {
                        if (event.key === "Enter") {
                            event.preventDefault();
                            addCustomMember();
                        }
                    }}
                    placeholder="이름"
                    className="min-w-0 flex-1 bg-transparent text-[16px] text-[#101828] outline-none placeholder:text-[#99a1af]"
                />
                <ToneButton type="button" selected size="sm" onClick={addCustomMember}>
                    추가
                </ToneButton>
            </ToneBox>
        </div>
    );
}

function CarCardFields({
    draft,
    onChange,
    yardPic,
    onYardPicChange,
    teamMembers,
}: {
    draft: CarDraft;
    onChange: (next: CarDraft) => void;
    yardPic: string;
    onYardPicChange: (value: string) => void;
    teamMembers: string[];
}) {
    const tone = React.useContext(FormToneContext);
    const [noteVehicle, setNoteVehicle] = useState<string | null>(null);
    const [noteAnchor, setNoteAnchor] = useState<HTMLElement | null>(null);
    const toggleCar = (name: string) => {
        onChange({
            ...draft,
            selected: draft.selected.includes(name)
                ? draft.selected.filter((item) => item !== name)
                : [...draft.selected, name],
        });
    };
    const closeNotePicker = () => {
        setNoteVehicle(null);
        setNoteAnchor(null);
    };
    const setNote = (vehicle: string, value: string) => {
        onChange({
            ...draft,
            selected:
                value.length > 0 && !draft.selected.includes(vehicle)
                    ? [...draft.selected, vehicle]
                    : draft.selected,
            notes: { ...draft.notes, [vehicle]: value },
        });
    };
    const pickMember = (member: string) => {
        if (!noteVehicle) return;
        setNote(noteVehicle, member);
        closeNotePicker();
    };

    return (
        <div className="mt-3 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
            <div className="grid grid-cols-3 gap-2">
                {VEHICLES.map((name) => {
                    const on = draft.selected.includes(name);
                    return (
                        <div
                            key={name}
                            className="flex min-w-0 overflow-hidden rounded-[8px] border"
                            style={{ backgroundColor: tone.fill, borderColor: tone.line }}
                        >
                            <ToneButton
                                type="button"
                                selected={on}
                                size="sm"
                                className="!h-[30px] w-1/2 !rounded-none !border-0 !px-0.5 !text-[12px]"
                                onClick={() => toggleCar(name)}
                            >
                                {name}
                            </ToneButton>
                            <input
                                value={draft.notes[name] ?? ""}
                                onChange={(event) => setNote(name, event.target.value)}
                                onFocus={(event) => {
                                    setNoteVehicle(name);
                                    setNoteAnchor(event.currentTarget);
                                }}
                                aria-label={`${name} 입력`}
                                className="h-[30px] w-1/2 min-w-0 border-l bg-transparent px-1 text-center text-[12px] text-[#101828] outline-none"
                                style={{ borderColor: tone.line }}
                            />
                        </div>
                    );
                })}
            </div>
            <ActionMenu
                isOpen={noteVehicle != null}
                anchorEl={noteAnchor}
                onClose={closeNotePicker}
                showDelete={false}
                showLogout={false}
                placement="bottom-left"
                width="w-56"
                estimatedHeight={teamMembers.length > 0 ? 160 : 72}
            >
                {teamMembers.length === 0 ? (
                    <p className="px-2 py-1 text-sm text-gray-500">선택된 인원이 없습니다</p>
                ) : (
                    <div className="flex flex-wrap gap-1.5">
                        {teamMembers.map((member) => (
                            <ToneButton
                                key={member}
                                type="button"
                                size="sm"
                                selected={
                                    noteVehicle != null && draft.notes[noteVehicle] === member
                                }
                                onClick={() => pickMember(member)}
                            >
                                {member}
                            </ToneButton>
                        ))}
                    </div>
                )}
            </ActionMenu>
            <div className="flex flex-col gap-2">
                <p className="text-left text-sm font-medium text-gray-800">Yard PIC</p>
                <ToneTextInput value={yardPic} onChange={onYardPicChange} placeholder="Yard PIC" />
            </div>
        </div>
    );
}

const FORM_TABLE_COLUMNS = SCHEDULE_COLUMNS.filter((column) => column.key !== "no");
const FORM_TABLE_HEADER_COLUMNS = FORM_TABLE_COLUMNS.filter(
    (column) => column.key !== "customerCompany" && column.key !== "customerContact"
);

function formatSchedulePeriod(start: string | null, end: string | null) {
    const formatDay = (dateKey: string) => {
        const [, month, day] = dateKey.split("-");
        if (!month || !day) return "";
        return `${month}/${day}`;
    };
    if (!start) return "";
    const from = !end || start <= end ? start : end;
    const to = !end || start <= end ? end ?? start : start;
    if (!to || from === to) return formatDay(from);
    return `${formatDay(from)}~${formatDay(to)}`;
}

function earlierScheduleDate(start: string | null, end: string | null) {
    if (!start) return end ?? "";
    if (!end) return start;
    return start <= end ? start : end;
}

function customerDraftFromValues(
    company: string,
    contact: string
): CustomerDraft {
    const companyTrim = company.trim();
    const contactTrim = contact.trim();
    const group = CUSTOMER_GROUPS.find((item) => item.label === companyTrim);
    if (group && (group.id === "ELU" || group.id === "PRIME")) {
        const known = ORDER_PERSONS[group.id] ?? [];
        if (known.includes(contactTrim)) {
            return {
                ...EMPTY_CUSTOMER_DRAFT,
                group: group.id,
                person: contactTrim,
            };
        }
        if (contactTrim) {
            return {
                ...EMPTY_CUSTOMER_DRAFT,
                group: group.id,
                person: contactTrim,
                extraNames: [contactTrim],
            };
        }
        return { ...EMPTY_CUSTOMER_DRAFT, group: group.id };
    }
    if (companyTrim || contactTrim) {
        return {
            ...EMPTY_CUSTOMER_DRAFT,
            group: "DIRECT",
            companyDirect: companyTrim,
            contactDirect: contactTrim,
        };
    }
    return EMPTY_CUSTOMER_DRAFT;
}

function locationDraftFromValue(value: string): LocationDraft {
    const lines = value.split("\n");
    const placesLine = lines[0] ?? "";
    const detail = lines.slice(1).join("\n").trim();
    const places = placesLine
        .split(/[,，]/)
        .map((part) => part.trim())
        .filter(Boolean);
    const locations: string[] = [];
    const extraLocations: string[] = [];
    for (const place of places) {
        locations.push(place);
        if (!(LOCATIONS as readonly string[]).includes(place)) {
            extraLocations.push(place);
        }
    }
    return {
        locations,
        locationCustom: "",
        extraLocations,
        locationDetail: detail,
    };
}

function teamDraftFromValue(value: string): TeamDraft {
    const members = value.split(/\s+/).filter(Boolean);
    return {
        members,
        memberCustom: "",
        extraMembers: members,
    };
}

function carDraftFromValue(value: string): CarDraft {
    const selected: string[] = [];
    const notes: Record<string, string> = {};
    for (const line of value
        .split("\n")
        .map((part) => part.trim())
        .filter(Boolean)) {
        const vehicle = VEHICLES.find(
            (item) => line === item || line.startsWith(`${item} `)
        );
        if (!vehicle) continue;
        selected.push(vehicle);
        const note = line.slice(vehicle.length).trim();
        if (note) notes[vehicle] = note;
    }
    return { selected, notes };
}

function draftsFromScheduleValues(values: ScheduleInsertValues) {
    return {
        customer: customerDraftFromValues(
            values.customerCompany,
            values.customerContact
        ),
        ship: {
            shipName: values.shipName,
            engineType: values.engineType,
        },
        workLocation: locationDraftFromValue(values.workLocation),
        workItem: values.workItem,
        team: teamDraftFromValue(values.teamMember),
        cars: carDraftFromValue(values.car),
        yardPic: values.yardPic,
        remark: values.remark,
    };
}

function scrollParentOf(element: HTMLElement): HTMLElement | null {
    const candidates: HTMLElement[] = [];
    let parent = element.parentElement;
    while (parent) {
        const overflowY = getComputedStyle(parent).overflowY;
        if (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") {
            candidates.push(parent);
        }
        parent = parent.parentElement;
    }
    // The calendar itself is overflow:auto but grows with its content, so scrolling it
    // does nothing. Use the ancestor that actually overflows the viewport.
    const overflowing = candidates.filter((el) => el.scrollHeight > el.clientHeight + 4);
    return overflowing[0] ?? candidates[candidates.length - 1] ?? null;
}

/** Matches Tailwind `ease-out`: cubic-bezier(0, 0, 0.2, 1). */
function easeOut(t: number) {
    const sampleX = (u: number) => (0.6 + 0.4 * u) * u * u;
    const sampleY = (u: number) => (3 - 2 * u) * u * u;
    const sampleDX = (u: number) => (1.2 + 1.2 * u) * u;
    let u = t;
    for (let i = 0; i < 6; i += 1) {
        const dx = sampleDX(u);
        if (Math.abs(dx) < 1e-6) break;
        u -= (sampleX(u) - t) / dx;
    }
    return sampleY(Math.min(1, Math.max(0, u)));
}

function WeekInsertSlot({
    onClose,
    onSave,
    onUpdate,
    editId = null,
    initialValues = null,
    periodStart,
    periodEnd,
    isMobile = false,
}: {
    onClose: () => void;
    onSave?: (values: ScheduleInsertValues) => void;
    onUpdate?: (id: string, values: ScheduleInsertValues) => void;
    editId?: string | null;
    initialValues?: ScheduleInsertValues | null;
    periodStart: string | null;
    periodEnd: string | null;
    isMobile?: boolean;
}) {
    const seeded = initialValues ? draftsFromScheduleValues(initialValues) : null;
    const [expanded, setExpanded] = useState(false);
    const [activeTab, setActiveTab] = useState<(typeof SCHEDULE_FORM_TABS)[number]>(
        SCHEDULE_FORM_TABS[0]
    );
    const closingRef = React.useRef(false);
    const tabScrollLock = React.useRef(false);
    const unlockTabScroll = React.useRef<(() => void) | null>(null);
    const slotRef = React.useRef<HTMLDivElement>(null);
    const slotContentRef = React.useRef<HTMLDivElement>(null);
    const [slotHeight, setSlotHeight] = useState(0);
    const [snapSlotHeight, setSnapSlotHeight] = useState(false);
    const tabBarRef = React.useRef<HTMLDivElement>(null);
    const scrollerRef = React.useRef<HTMLDivElement>(null);
    const cardRefs = React.useRef<Array<HTMLDivElement | null>>([]);
    const [cardWidth, setCardWidth] = useState(0);
    const [sidePad, setSidePad] = useState(0);
    const [customer, setCustomer] = useState<CustomerDraft>(
        () => seeded?.customer ?? EMPTY_CUSTOMER_DRAFT
    );
    const [ship, setShip] = useState<ShipDraft>(() => seeded?.ship ?? EMPTY_SHIP_DRAFT);
    const [workLocation, setWorkLocation] = useState<LocationDraft>(
        () => seeded?.workLocation ?? EMPTY_LOCATION_DRAFT
    );
    const [workItem, setWorkItem] = useState(() => seeded?.workItem ?? "");
    const [team, setTeam] = useState<TeamDraft>(() => seeded?.team ?? EMPTY_TEAM_DRAFT);
    const [cars, setCars] = useState<CarDraft>(() => seeded?.cars ?? EMPTY_CAR_DRAFT);
    const [yardPic, setYardPic] = useState(() => seeded?.yardPic ?? "");
    const [remark, setRemark] = useState(() => seeded?.remark ?? "");
    const workItemCardRef = useRef<HTMLTextAreaElement>(null);
    const workItemTableRef = useRef<HTMLTextAreaElement>(null);
    const workItemCaretRef = useRef({ start: 0, end: 0 });
    const staffSortMeta = useStaffSortMeta();
    const tableCells = {
        ...customerTableValues(customer),
        ...shipTableValues(ship),
        workLocation: locationTableValue(workLocation),
        period: formatSchedulePeriod(periodStart, periodEnd),
        workItem,
        manpower: teamMemberCount(team),
        teamMember: teamMemberTableValue(team, staffSortMeta),
        car: carTableValue(cars),
        yardPic,
        remark,
    };

    const rememberWorkItemCaret = (element: HTMLTextAreaElement) => {
        workItemCaretRef.current = {
            start: element.selectionStart ?? 0,
            end: element.selectionEnd ?? 0,
        };
    };

    const syncWorkItemCaret = (source: HTMLTextAreaElement) => {
        rememberWorkItemCaret(source);
        const other =
            source === workItemCardRef.current ? workItemTableRef.current : workItemCardRef.current;
        if (!other) return;
        const { start, end } = workItemCaretRef.current;
        if (other.selectionStart === start && other.selectionEnd === end) return;
        other.setSelectionRange(start, end);
    };

    const resizeWorkItemTable = () => {
        const tableField = workItemTableRef.current;
        if (!tableField) return;
        tableField.style.height = "auto";
        tableField.style.height = `${tableField.scrollHeight}px`;
    };

    useEffect(() => {
        resizeWorkItemTable();
        const { start, end } = workItemCaretRef.current;
        workItemCardRef.current?.setSelectionRange(start, end);
        workItemTableRef.current?.setSelectionRange(start, end);
    }, [workItem]);

    useEffect(() => {
        const frame = requestAnimationFrame(() => setExpanded(true));
        return () => cancelAnimationFrame(frame);
    }, []);

    useLayoutEffect(() => {
        const content = slotContentRef.current;
        if (!content) return;
        const measure = () => setSlotHeight(expanded ? content.offsetHeight : 0);
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(content);
        return () => observer.disconnect();
    }, [expanded]);

    useEffect(() => {
        if (!expanded) {
            setSnapSlotHeight(false);
            return;
        }
        if (slotHeight === 0) return;
        const timer = window.setTimeout(() => setSnapSlotHeight(true), 500);
        return () => window.clearTimeout(timer);
    }, [expanded, slotHeight]);

    const slotHeightRef = React.useRef(slotHeight);
    slotHeightRef.current = slotHeight;

    useEffect(() => {
        if (!expanded) return;
        let frame = 0;
        let cancelled = false;

        const waitAndScroll = () => {
            if (cancelled) return;
            const height = slotHeightRef.current;
            const slot = slotRef.current;
            if (!height || !slot) {
                frame = requestAnimationFrame(waitAndScroll);
                return;
            }

            const scroller = scrollParentOf(slot);
            if (!scroller) {
                slot.scrollIntoView({ behavior: "smooth", block: "center" });
                return;
            }

            const scrollerRect = scroller.getBoundingClientRect();
            const slotRect = slot.getBoundingClientRect();
            const slotTop = slotRect.top - scrollerRect.top + scroller.scrollTop;
            const target = Math.max(0, slotTop + height / 2 - scroller.clientHeight / 2);
            const startTop = scroller.scrollTop;
            const startTime = performance.now();

            const step = (now: number) => {
                if (cancelled) return;
                const t = Math.min(1, (now - startTime) / 500);
                const desired = startTop + (target - startTop) * easeOut(t);
                const max = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
                scroller.scrollTop = Math.min(desired, max);
                if (t < 1) frame = requestAnimationFrame(step);
            };
            frame = requestAnimationFrame(step);
        };

        frame = requestAnimationFrame(waitAndScroll);
        return () => {
            cancelled = true;
            cancelAnimationFrame(frame);
        };
    }, [expanded]);

    useEffect(() => {
        const scroller = scrollerRef.current;
        if (!scroller || !expanded) return;
        const updateWidth = () => {
            if (isMobile) {
                setCardWidth(Math.max(0, scroller.clientWidth));
                setSidePad(0);
                return;
            }
            const width = Math.max(0, ((scroller.clientWidth - 48) / 3) * 0.8);
            setCardWidth(width);
            setSidePad(Math.max(0, (scroller.clientWidth - width) / 2));
        };
        updateWidth();
        const observer = new ResizeObserver(updateWidth);
        observer.observe(scroller);
        return () => observer.disconnect();
    }, [expanded, isMobile]);

    useEffect(() => {
        const scroller = scrollerRef.current;
        if (!scroller || !expanded || isMobile) return;
        const tabBar = tabBarRef.current;
        const onWheel = (event: WheelEvent) => {
            if (scroller.scrollWidth <= scroller.clientWidth + 1) return;
            const raw = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
            if (raw === 0) return;
            const delta =
                event.deltaMode === WheelEvent.DOM_DELTA_LINE
                    ? raw * 16
                    : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
                      ? raw * scroller.clientWidth
                      : raw;
            event.preventDefault();
            scroller.scrollLeft += delta;
        };
        tabBar?.addEventListener("wheel", onWheel, { passive: false });
        scroller.addEventListener("wheel", onWheel, { passive: false });
        return () => {
            tabBar?.removeEventListener("wheel", onWheel);
            scroller.removeEventListener("wheel", onWheel);
        };
    }, [expanded, isMobile]);

    /**
     * 모바일:
     * 1) 가로 드래그 (탭은 가로채지 않음)
     * 2) 버튼/입력 focus 시 브라우저가 카드를 가로로 밀어 focus 맞추며
     *    첫 탭의 클릭이 씹히는 문제 방지 (scroll 위치 고정)
     */
    useEffect(() => {
        const scroller = scrollerRef.current;
        if (!scroller || !expanded || !isMobile) return;

        const DRAG_LOCK_PX = 28;
        let startX = 0;
        let startY = 0;
        let startScroll = 0;
        let lastX = 0;
        let lastT = 0;
        let velocity = 0;
        let axis: "h" | "v" | null = null;
        let dragged = false;
        let momentumFrame = 0;
        let startOnField = false;
        let freezeScrollLeft: number | null = null;
        /** 스와이프 직후 ghost click만 짧게 무시 (다음 탭까지 막지 않음) */
        let ignoreClicksUntil = 0;

        const maxScroll = () =>
            Math.max(0, scroller.scrollWidth - scroller.clientWidth);

        const clampScroll = (value: number) =>
            Math.max(0, Math.min(maxScroll(), value));

        const stopMomentum = () => {
            if (momentumFrame) {
                cancelAnimationFrame(momentumFrame);
                momentumFrame = 0;
            }
        };

        const runMomentum = (initialVelocity: number) => {
            stopMomentum();
            let v = initialVelocity;
            const step = () => {
                if (Math.abs(v) < 0.4) {
                    momentumFrame = 0;
                    syncTabWithScroll();
                    return;
                }
                scroller.scrollLeft = clampScroll(scroller.scrollLeft + v);
                if (
                    scroller.scrollLeft <= 0 ||
                    scroller.scrollLeft >= maxScroll()
                ) {
                    v = 0;
                } else {
                    v *= 0.95;
                }
                momentumFrame = requestAnimationFrame(step);
            };
            momentumFrame = requestAnimationFrame(step);
        };

        const onTouchStart = (event: TouchEvent) => {
            const touch = event.touches[0];
            if (!touch) return;
            const target = event.target;
            startOnField =
                target instanceof HTMLElement &&
                Boolean(
                    target.closest(
                        "input, textarea, select, [contenteditable='true']"
                    )
                );
            stopMomentum();
            startX = touch.clientX;
            startY = touch.clientY;
            lastX = touch.clientX;
            lastT = performance.now();
            startScroll = scroller.scrollLeft;
            velocity = 0;
            axis = null;
            dragged = false;
        };

        const onTouchMove = (event: TouchEvent) => {
            if (startOnField) return;
            const touch = event.touches[0];
            if (!touch) return;
            const dx = touch.clientX - startX;
            const dy = touch.clientY - startY;
            if (axis == null) {
                if (Math.abs(dx) < DRAG_LOCK_PX && Math.abs(dy) < DRAG_LOCK_PX) {
                    return;
                }
                axis = Math.abs(dx) > Math.abs(dy) * 1.35 ? "h" : "v";
            }
            if (axis !== "h") return;
            event.preventDefault();
            dragged = true;
            const now = performance.now();
            const dt = Math.max(1, now - lastT);
            velocity = -(touch.clientX - lastX) / dt;
            lastX = touch.clientX;
            lastT = now;
            scroller.scrollLeft = clampScroll(startScroll - dx);
        };

        const onClickCapture = (event: Event) => {
            if (performance.now() >= ignoreClicksUntil) return;
            event.preventDefault();
            event.stopPropagation();
        };

        const onTouchEnd = () => {
            const scrolled = Math.abs(scroller.scrollLeft - startScroll);
            const movedFar = axis === "h" && dragged && scrolled > 24;
            if (movedFar) {
                runMomentum(velocity * 16);
                // 같은 제스처의 ghost click만 ~300ms 차단.
                // once 리스너는 이후 진짜 버튼 탭까지 가로채서 첫 탭이 포커스만 됨.
                ignoreClicksUntil = performance.now() + 300;
            } else {
                syncTabWithScroll();
            }
            axis = null;
            dragged = false;
            startOnField = false;
        };

        /** focus scroll-into-view가 캐러셀을 밀며 클릭을 취소하는 것 차단 */
        const onFocusIn = () => {
            freezeScrollLeft = scroller.scrollLeft;
            const restore = () => {
                if (freezeScrollLeft == null) return;
                if (scroller.scrollLeft !== freezeScrollLeft) {
                    scroller.scrollLeft = freezeScrollLeft;
                }
            };
            restore();
            requestAnimationFrame(() => {
                restore();
                requestAnimationFrame(() => {
                    restore();
                    freezeScrollLeft = null;
                });
            });
        };

        scroller.addEventListener("touchstart", onTouchStart, { passive: true });
        scroller.addEventListener("touchmove", onTouchMove, { passive: false });
        scroller.addEventListener("touchend", onTouchEnd);
        scroller.addEventListener("touchcancel", onTouchEnd);
        scroller.addEventListener("click", onClickCapture, true);
        scroller.addEventListener("focusin", onFocusIn);
        return () => {
            stopMomentum();
            scroller.removeEventListener("touchstart", onTouchStart);
            scroller.removeEventListener("touchmove", onTouchMove);
            scroller.removeEventListener("touchend", onTouchEnd);
            scroller.removeEventListener("touchcancel", onTouchEnd);
            scroller.removeEventListener("click", onClickCapture, true);
            scroller.removeEventListener("focusin", onFocusIn);
        };
    }, [expanded, isMobile]);

    const scrollToTab = (label: (typeof SCHEDULE_FORM_TABS)[number]) => {
        setActiveTab(label);
        const scroller = scrollerRef.current;
        const card = cardRefs.current[SCHEDULE_FORM_TABS.indexOf(label)];
        if (!scroller || !card) return;
        const left =
            card.getBoundingClientRect().left -
            scroller.getBoundingClientRect().left +
            scroller.scrollLeft;
        const inset = (scroller.clientWidth - card.offsetWidth) / 2;
        const target = Math.max(0, left - inset);
        unlockTabScroll.current?.();
        if (Math.abs(scroller.scrollLeft - target) < 2) return;
        tabScrollLock.current = true;
        const unlock = () => {
            tabScrollLock.current = false;
            scroller.removeEventListener("scrollend", unlock);
            window.clearTimeout(timer);
            if (unlockTabScroll.current === unlock) unlockTabScroll.current = null;
        };
        const timer = window.setTimeout(unlock, 700);
        unlockTabScroll.current = unlock;
        scroller.addEventListener("scrollend", unlock);
        scroller.scrollTo({ left: target, behavior: "smooth" });
    };

    const syncTabWithScroll = () => {
        if (tabScrollLock.current) return;
        const scroller = scrollerRef.current;
        if (!scroller) return;
        const center = scroller.getBoundingClientRect().left + scroller.clientWidth / 2;
        let nearest = 0;
        let best = Number.POSITIVE_INFINITY;
        cardRefs.current.forEach((card, index) => {
            if (!card) return;
            const cardCenter =
                card.getBoundingClientRect().left + card.getBoundingClientRect().width / 2;
            const distance = Math.abs(cardCenter - center);
            if (distance < best) {
                best = distance;
                nearest = index;
            }
        });
        const next = SCHEDULE_FORM_TABS[nearest];
        if (next) setActiveTab((current) => (current === next ? current : next));
    };

    const requestClose = () => {
        closingRef.current = true;
        setSnapSlotHeight(false);
        setExpanded(false);
    };

    const saveActions = (
        <div className="mb-1 flex shrink-0">
            <Button
                type="button"
                tabIndex={-1}
                variant="ghost"
                size="sm"
                className="!h-9 !w-9 !rounded-full !px-0 !text-gray-700 hover:!bg-gray-200"
                aria-label="저장"
                title="저장"
                icon={<IconCheck className="h-5 w-5" />}
                onClick={() => {
                    const payload: ScheduleInsertValues = {
                        ...tableCells,
                        periodFrom: earlierScheduleDate(periodStart, periodEnd),
                    };
                    if (editId) onUpdate?.(editId, payload);
                    else onSave?.(payload);
                    requestClose();
                }}
            />
            <Button
                type="button"
                tabIndex={-1}
                variant="ghost"
                size="sm"
                className="!h-9 !w-9 !rounded-full !px-0 !text-gray-700 hover:!bg-gray-200"
                aria-label="닫기"
                title="닫기"
                icon={<IconClose className="h-5 w-5" />}
                onClick={requestClose}
            />
        </div>
    );

    return (
        <div
            ref={slotRef}
            className={`flex shrink-0 flex-col overflow-hidden border-gray-200 bg-white ease-out ${
                snapSlotHeight ? "" : "transition-[height] duration-500"
            } ${expanded ? "border-b" : ""}`}
            style={{ height: expanded ? slotHeight : 0 }}
            aria-label="일정 입력"
            onTransitionEnd={(event) => {
                if (event.propertyName !== "height" || !closingRef.current) return;
                onClose();
            }}
        >
            <div ref={slotContentRef} className="flex shrink-0 flex-col">
            {!isMobile ? (
            <div className="shrink-0 px-3 pt-3">
                <div className="overflow-hidden rounded-xl border border-gray-800">
                    <table className="w-full table-fixed border-separate border-spacing-0 text-[11px] text-gray-900 md:text-[12px]">
                        <colgroup>
                            {FORM_TABLE_COLUMNS.map((column) => (
                                <col key={column.key} style={{ width: column.width }} />
                            ))}
                        </colgroup>
                        <thead>
                            <tr>
                                <th
                                    colSpan={2}
                                    className="border-r border-b border-gray-800 px-1 py-2 text-center font-bold leading-tight transition-[background-color,box-shadow]"
                                    style={columnSelectionStyle("customerCompany", activeTab, true)}
                                >
                                    Customer
                                </th>
                                {FORM_TABLE_HEADER_COLUMNS.map((column, index) => (
                                    <th
                                        key={column.key}
                                        className={`border-b border-gray-800 px-1 py-2 text-center font-bold leading-tight whitespace-pre-line transition-[background-color,box-shadow] ${
                                            index < FORM_TABLE_HEADER_COLUMNS.length - 1
                                                ? "border-r"
                                                : ""
                                        }`}
                                        style={columnSelectionStyle(column.key, activeTab, true)}
                                    >
                                        {column.key === "workLocation" ? "Work\nlocation" : column.label}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                {FORM_TABLE_COLUMNS.map((column, index) => (
                                    <td
                                        key={column.key}
                                        className={`p-0 align-middle transition-[background-color] ${
                                            index < FORM_TABLE_COLUMNS.length - 1
                                                ? "border-r border-gray-800"
                                                : ""
                                        }`}
                                        style={columnSelectionStyle(column.key, activeTab, false)}
                                    >
                                        {column.key === "workItem" ? (
                                            <div className="flex min-h-[72px] items-center justify-center px-1 py-1">
                                                <textarea
                                                    ref={workItemTableRef}
                                                    value={workItem}
                                                    rows={1}
                                                    spellCheck={false}
                                                    onChange={(event) => {
                                                        rememberWorkItemCaret(event.target);
                                                        setWorkItem(event.target.value);
                                                    }}
                                                    onSelect={(event) => syncWorkItemCaret(event.currentTarget)}
                                                    onKeyUp={(event) => syncWorkItemCaret(event.currentTarget)}
                                                    className="block w-full resize-none overflow-hidden border-0 bg-transparent text-center text-[11px] leading-tight text-gray-900 outline-none md:text-[12px]"
                                                />
                                            </div>
                                        ) : (
                                            <div className="flex min-h-[72px] items-center justify-center px-1 py-1 text-center leading-tight break-words whitespace-pre-wrap">
                                                {column.key in tableCells
                                                    ? tableCells[column.key as keyof typeof tableCells]
                                                    : ""}
                                            </div>
                                        )}
                                    </td>
                                ))}
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
            ) : null}
            {isMobile ? (
                <div className="flex items-center justify-end border-b border-gray-200 px-2 pt-2">
                    {saveActions}
                </div>
            ) : (
            <div ref={tabBarRef} className="flex items-end gap-1 border-b border-gray-200 px-2 pt-2">
                <div role="tablist" className="flex min-w-0 flex-1 items-end">
                    {SCHEDULE_FORM_TABS.map((label) => {
                        const selected = activeTab === label;
                        return (
                            <button
                                key={label}
                                type="button"
                                role="tab"
                                tabIndex={-1}
                                aria-selected={selected}
                                title={TAB_TITLE[label]}
                                onClick={() => scrollToTab(label)}
                                className={`min-w-0 flex-1 basis-0 whitespace-normal rounded-t-lg px-2 py-2 text-center text-[13px] font-medium leading-tight transition-[background-color,border-color] ${
                                    selected
                                        ? "relative z-10 -mb-px border border-b-white text-gray-900"
                                        : "text-gray-700 hover:brightness-95"
                                }`}
                                style={{
                                    backgroundColor: selected
                                        ? FORM_CONTROL_TONES[label].fill
                                        : TAB_GROUP_COLOR[label],
                                    borderColor: selected ? FORM_CONTROL_TONES[label].active : undefined,
                                }}
                            >
                                {TAB_TITLE[label]}
                            </button>
                        );
                    })}
                </div>
                {saveActions}
            </div>
            )}
            <div
                ref={scrollerRef}
                onScroll={syncTabWithScroll}
                className={
                    isMobile
                        ? "h-[23rem] shrink-0 overflow-x-auto overflow-y-hidden overscroll-x-contain [overflow-anchor:none] touch-pan-x"
                        : "h-[23rem] shrink-0 overflow-x-scroll overflow-y-hidden"
                }
            >
                <div className={`flex h-full ${isMobile ? "py-0" : "py-3"}`}>
                    <div aria-hidden className="shrink-0" style={{ width: sidePad, minWidth: sidePad }} />
                    {SCHEDULE_FORM_TABS.map((label, index) => {
                        const selected = activeTab === label;
                        const tone = FORM_CONTROL_TONES[label];
                        return (
                        <FormToneContext.Provider key={label} value={tone}>
                        <div
                            ref={(element) => {
                                cardRefs.current[index] = element;
                            }}
                            className={`flex h-full shrink-0 flex-col overflow-hidden p-4 transition-[box-shadow,background-color] ${
                                isMobile ? "" : "rounded-2xl"
                            }`}
                            style={{
                                width: cardWidth > 0 ? cardWidth : "100%",
                                marginRight:
                                    index < SCHEDULE_FORM_TABS.length - 1 ? (isMobile ? 0 : 16) : 0,
                                backgroundColor: TAB_GROUP_COLOR[label],
                                boxShadow:
                                    !isMobile && selected
                                        ? `0 0 0 2px ${tone.active}`
                                        : undefined,
                            }}
                            aria-label={label}
                            onClick={() => {
                                if (!isMobile) scrollToTab(label);
                            }}
                            onFocus={() => {
                                if (!isMobile) {
                                    requestAnimationFrame(() => scrollToTab(label));
                                }
                            }}
                        >
                            <p className="text-left text-sm font-medium text-gray-800">
                                {TAB_TITLE[label]}
                            </p>
                            {label === "Customer" ? (
                                <CustomerCardFields draft={customer} onChange={setCustomer} />
                            ) : null}
                            {label === "Ship name" ? (
                                <ShipCardFields
                                    draft={ship}
                                    onChange={setShip}
                                    location={workLocation}
                                    onLocationChange={setWorkLocation}
                                />
                            ) : null}
                            {label === "Team member" ? (
                                <TeamMemberCardFields draft={team} onChange={setTeam} />
                            ) : null}
                            {label === "Car" ? (
                                <CarCardFields
                                    draft={cars}
                                    onChange={setCars}
                                    yardPic={yardPic}
                                    onYardPicChange={setYardPic}
                                    teamMembers={team.members.filter((name) => name.trim())}
                                />
                            ) : null}
                            {label === "Work Item" ? (
                                <ToneTextarea
                                    ref={workItemCardRef}
                                    value={workItem}
                                    onChange={(event) => {
                                        rememberWorkItemCaret(event.target);
                                        setWorkItem(event.target.value);
                                    }}
                                    onSelect={(event) => syncWorkItemCaret(event.currentTarget)}
                                    onKeyUp={(event) => syncWorkItemCaret(event.currentTarget)}
                                    placeholder="Work Item"
                                    className="mt-3 min-h-0 w-full flex-1 resize-none rounded-xl border p-3 text-[16px] leading-relaxed text-[#101828] outline-none placeholder:text-[#99a1af]"
                                />
                            ) : null}
                            {label === "Remark" ? (
                                <ToneTextarea
                                    value={remark}
                                    onChange={(event) => setRemark(event.target.value)}
                                    placeholder="Remark"
                                    className="mt-3 min-h-0 w-full flex-1 resize-none rounded-xl border p-3 text-[16px] leading-relaxed text-[#101828] outline-none placeholder:text-[#99a1af]"
                                />
                            ) : null}
                        </div>
                        </FormToneContext.Provider>
                        );
                    })}
                    <div aria-hidden className="shrink-0" style={{ width: sidePad, minWidth: sidePad }} />
                </div>
            </div>
            </div>
        </div>
    );
}

export default function CalendarGrid({
    weeks,
    sortedEvents,
    today,
    isMobile = false,
    dragStart,
    dragEnd,
    isDragging,
    cellRefs,
    cellHeights,
    onEditEvent,
    onDeleteEvent,
    onEventClick,
    onDateClick,
    onDateHover,
    selectionStart = null,
    selectionEnd = null,
    selectionPending = false,
    allowOutsideMonthSelect = false,
    insertAfterDate = null,
    onInsertClose,
    onScheduleSave,
    insertInitialValues = null,
    insertEditId = null,
    onScheduleUpdate,
    onDragStart,
    onDragEnter,
    onHiddenCountClick,
    onCellHeightChange,
    tagLayerTop: tagLayerTopProp,
    tagsBesideDate = false,
    uniformColumns = false,
    rowHeight,
    scheduleBars = [],
    dayAvailability,
    personalEntriesByDay,
    onPersonalEntrySave,
    onPersonalEntryDelete,
    dayDetailDateKey = null,
    dayDetailPosition = null,
    suppressDayDetail = false,
    onDayDetailClose,
}: CalendarGridProps) {
    const dayHoverStaffSortMeta = useStaffSortMeta();
    const [dayHover, setDayHover] = useState<DayScheduleHoverInfo | null>(null);
    const [dayScheduleIndex, setDayScheduleIndex] = useState(0);
    const dayHoverCloseTimer = useRef<number | null>(null);
    const { showError } = useToast();
    const [personalDetail, setPersonalDetail] =
        useState<PersonalScheduleEntry | null>(null);
    const [personalDetailEditing, setPersonalDetailEditing] = useState(false);
    const [personalEditStart, setPersonalEditStart] = useState("");
    const [personalEditEnd, setPersonalEditEnd] = useState("");
    const [personalEditReason, setPersonalEditReason] = useState("");
    const [personalSaving, setPersonalSaving] = useState(false);

    const openPersonalDetail = (entry: PersonalScheduleEntry) => {
        setPersonalDetail(entry);
        setPersonalDetailEditing(false);
        setPersonalEditStart(entry.start);
        setPersonalEditEnd(entry.end);
        setPersonalEditReason(entry.reason);
        setPersonalSaving(false);
    };

    const closePersonalDetail = () => {
        setPersonalDetail(null);
        setPersonalDetailEditing(false);
        setPersonalSaving(false);
    };

    const clearDayHoverClose = () => {
        if (dayHoverCloseTimer.current != null) {
            window.clearTimeout(dayHoverCloseTimer.current);
            dayHoverCloseTimer.current = null;
        }
    };

    const closeDayDetail = () => {
        clearDayHoverClose();
        setDayHover(null);
        onDayDetailClose?.();
    };

    const handleDayScheduleHover = (info: DayScheduleHoverInfo) => {
        // 모바일: 셀 호버/탭으로는 열지 않고, 일정 메뉴 → 상세정보로만 연다.
        if (isMobile) return;
        // 일정 추가/개인 일정 메뉴가 떠 있으면 상세 팝오버를 열지 않음
        if (suppressDayDetail) return;
        clearDayHoverClose();
        setDayHover(info);
    };

    useEffect(() => {
        if (!suppressDayDetail) return;
        clearDayHoverClose();
        setDayHover(null);
    }, [suppressDayDetail]);

    const handleDayScheduleLeave = () => {
        if (isMobile) return;
        clearDayHoverClose();
        dayHoverCloseTimer.current = window.setTimeout(() => {
            setDayHover(null);
        }, 180);
    };

    useEffect(() => {
        if (!dayDetailDateKey) return;
        clearDayHoverClose();
        const schedules = scheduleBars
            .filter((bar) => getDateRangeRole(dayDetailDateKey, bar.start, bar.end))
            .map((bar) => ({
                id: bar.id,
                shipName: bar.shipName,
                teamMember: bar.teamMember,
                color: bar.color,
            }));
        // 공사 일정이 없으면 상세 팝오버를 열지 않음
        if (schedules.length === 0) {
            setDayHover(null);
            onDayDetailClose?.();
            return;
        }
        const anchorEl = cellRefs.current[dayDetailDateKey] ?? null;
        setDayScheduleIndex(0);
        setDayHover({
            dateKey: dayDetailDateKey,
            schedules,
            anchorEl: anchorEl as HTMLElement,
        });
        // onDayDetailClose는 부모 인라인 콜백일 수 있어 deps 제외
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dayDetailDateKey, scheduleBars, cellRefs]);

    useEffect(() => {
        setDayScheduleIndex(0);
    }, [dayHover?.dateKey]);

    const dayHoverScheduleCount = dayHover?.schedules.length ?? 0;
    const dayHoverColumnCount = isMobile
        ? 1
        : Math.max(dayHoverScheduleCount, 1);
    const dayHoverMenuWidthPx = Math.min(
        isMobile
            ? Math.max(
                  typeof window !== "undefined" ? window.innerWidth - 24 : 320,
                  280
              )
            : dayHoverColumnCount * 280 + 24,
        typeof window !== "undefined" ? Math.max(window.innerWidth - 24, 280) : 280
    );
    const safeDayScheduleIndex = Math.min(
        dayScheduleIndex,
        Math.max(dayHoverScheduleCount - 1, 0)
    );
    const visibleDaySchedules =
        dayHover == null
            ? []
            : isMobile
              ? dayHover.schedules.slice(
                    safeDayScheduleIndex,
                    safeDayScheduleIndex + 1
                )
              : dayHover.schedules;
    const dayHoverAvailableNames =
        dayHover != null ? (dayAvailability?.[dayHover.dateKey]?.names ?? []) : [];
    const dayHoverPersonalEntries =
        dayHover != null
            ? (personalEntriesByDay?.[dayHover.dateKey] ?? [])
            : [];
    const dayHoverPersonalNames = sortPeopleByRoleAndJoinDate(
        Array.from(
            new Set(dayHoverPersonalEntries.flatMap((entry) => entry.names))
        ),
        dayHoverStaffSortMeta,
        { priorityFirst: SCHEDULE_TEAM_LEADERS }
    );
    // 공사 일정이 있는 날만 팝오버 (빈 날·개인일정만 있는 날은 열지 않음)
    const dayHoverHasContent = dayHoverScheduleCount > 0;
    const dayHoverHoliday =
        dayHover != null
            ? getEventsForDate(dayHover.dateKey, sortedEvents).find(
                  (event) => event.isHoliday
              ) ?? null
            : null;

    const scheduleBarBaseTop = isMobile ? 28 : 40;
    const scheduleBarAvailable = Math.max(
        0,
        (rowHeight ?? 0) - scheduleBarBaseTop - 4
    );
    const lanedScheduleBars = scaleScheduleBarStacks(
        assignScheduleBarLanes(scheduleBars),
        scheduleBarAvailable
    );
    const dateHeaderHeight = tagLayerTopProp ?? (isMobile ? 40 : 48);
    const bottomPadding = 18;
    const tagLayerTop = tagLayerTopProp ?? (isMobile ? 36 : 48);

    // 모바일: 작은 사각형 태그로 세로 쌓기(참고: 네이버 캘린더 스타일), 데스크톱: 기존 태그 높이
    const tagHeight = isMobile ? 20 : 22; // 모바일: 태그 한 줄 높이(20px), 데스크톱: 22px
    const tagSpacing = isMobile ? 2 : 6; // 모바일: 태그 간격(2px), 데스크톱: 6px

    const pad = (n: number) => (n < 10 ? "0" + n : String(n));
    const rowIndexByEvent = new Map<string, number>();

    useEffect(() => {
        // Prefetch visible worklog details in the background to reduce menu loading time.
        const workLogIds = Array.from(
            new Set(
                sortedEvents
                    .filter((e) => e.id.startsWith("worklog-"))
                    .map((e) => parseInt(e.id.replace("worklog-", ""), 10))
                    .filter((id) => !Number.isNaN(id))
            )
        ).slice(0, 50);

        if (workLogIds.length === 0) return;

        let cancelled = false;
        const runPrefetch = () => {
            if (cancelled) return;
            workLogIds.forEach((id) => {
                prefetchWorkLogById(id);
            });
        };

        if ("requestIdleCallback" in window) {
            const idleId = (window as any).requestIdleCallback(runPrefetch, { timeout: 1500 });
            return () => {
                cancelled = true;
                (window as any).cancelIdleCallback?.(idleId);
            };
        }

        const timer = window.setTimeout(runPrefetch, 300);
        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [sortedEvents]);

    return (
        <div
            dir="ltr"
            className={`bg-white flex flex-col min-w-[280px] ${
                rowHeight ? "" : "min-h-0 flex-1"
            }`}
            style={{
                overflowX: 'auto',
                overflowY: 'auto',
                WebkitOverflowScrolling: 'touch'
            }}
        >
            {weeks.map((week, weekIdx) => {
                // 주 단위 이벤트 행 정보 가져오기
                const weekEventRows = getWeekEventRows(
                    week,
                    sortedEvents,
                    rowIndexByEvent
                );
                const weekStartKey = getSafeDateKey(week[0].date);
                const weekEndKey = getSafeDateKey(week[6].date);
                weekEventRows.forEach((segment) => {
                    const startKey = segment.event.startDate.slice(0, 10);
                    if (startKey >= weekStartKey && startKey <= weekEndKey) {
                        rowIndexByEvent.set(segment.event.id, segment.rowIndex);
                    } else if (!rowIndexByEvent.has(segment.event.id)) {
                        rowIndexByEvent.set(segment.event.id, segment.rowIndex);
                    }
                });

                // 각 날짜 셀의 최소 높이를 계산하여 표시 가능한 행 수 결정
                const weekCellHeights = week.map(({ date }) => {
                    const dateKey = `${date.getFullYear()}-${pad(
                        date.getMonth() + 1
                    )}-${pad(date.getDate())}`;
                    return cellHeights[dateKey] || 0;
                });

                const minCellHeight = Math.min(
                    ...weekCellHeights.filter((h) => h > 0)
                );
                const availableHeight = Math.max(
                    0,
                    minCellHeight - dateHeaderHeight - bottomPadding
                );
                const maxVisibleRows =
                    availableHeight > 0
                        ? Math.ceil(
                            (availableHeight + tagSpacing) /
                            (tagHeight + tagSpacing)
                        )
                        : 3;

                const showInsert =
                    insertAfterDate != null &&
                    insertAfterDate >= getSafeDateKey(week[0].date) &&
                    insertAfterDate <= getSafeDateKey(week[6].date);

                return (
                    <React.Fragment key={weekIdx}>
                    <WeekRow
                        week={week}
                        weekIdx={weekIdx}
                        weekEventRows={weekEventRows}
                        today={today}
                        isMobile={isMobile}
                        tagLayerTop={tagLayerTop}
                        dragStart={dragStart}
                        dragEnd={dragEnd}
                        isDragging={isDragging}
                        cellRefs={cellRefs}
                        getColumnPadding={(index, mobile) =>
                            getColumnPadding(index, mobile, uniformColumns)
                        }
                        getSafeDateKey={getSafeDateKey}
                        getEventsForDate={(dateKey) =>
                            getEventsForDate(dateKey, sortedEvents)
                        }
                        maxVisibleRows={maxVisibleRows}
                        tagHeight={tagHeight}
                        tagSpacing={tagSpacing}
                        cellHeights={cellHeights}
                        onEditEvent={onEditEvent}
                        onDeleteEvent={onDeleteEvent}
                        onEventClick={onEventClick}
                        onDateClick={onDateClick}
                        onDateHover={onDateHover}
                        selectionStart={selectionStart}
                        selectionEnd={selectionEnd}
                        selectionPending={selectionPending}
                        allowOutsideMonthSelect={allowOutsideMonthSelect}
                        onDragStart={onDragStart}
                        onDragEnter={onDragEnter}
                        onHiddenCountClick={onHiddenCountClick}
                        onCellHeightChange={onCellHeightChange}
                        tagsBesideDate={tagsBesideDate}
                        scheduleBars={lanedScheduleBars}
                        dayAvailability={dayAvailability}
                        personalEntriesByDay={personalEntriesByDay}
                        onPersonalEntryClick={openPersonalDetail}
                        onDayScheduleHover={handleDayScheduleHover}
                        onDayScheduleLeave={handleDayScheduleLeave}
                        uniformColumns={uniformColumns}
                        rowHeight={rowHeight}
                    />
                    {showInsert ? (
                        <WeekInsertSlot
                            key={insertEditId ?? insertAfterDate}
                            periodStart={selectionStart}
                            periodEnd={selectionEnd}
                            initialValues={insertInitialValues}
                            editId={insertEditId}
                            isMobile={isMobile}
                            onSave={onScheduleSave}
                            onUpdate={onScheduleUpdate}
                            onClose={() => onInsertClose?.()}
                        />
                    ) : null}
                    </React.Fragment>
                );
            })}
            <ActionMenu
                isOpen={
                    dayHover != null &&
                    dayHoverHasContent &&
                    !suppressDayDetail
                }
                anchorEl={
                    // 모바일 상세: 셀 전체(주 높이) 대신 탭 좌표로 붙여 날짜와 가깝게
                    isMobile && dayDetailDateKey != null
                        ? null
                        : dayHover?.anchorEl ?? null
                }
                position={
                    isMobile && dayDetailDateKey != null
                        ? dayDetailPosition ?? undefined
                        : dayDetailDateKey != null && !dayHover?.anchorEl
                          ? dayDetailPosition ?? undefined
                          : undefined
                }
                onClose={closeDayDetail}
                showDelete={false}
                showLogout={false}
                placement="bottom-right"
                width={`w-[${dayHoverMenuWidthPx}px]`}
                estimatedHeight={
                    120 +
                    (dayHoverAvailableNames.length > 0 ? 72 : 0) +
                    (dayHoverPersonalEntries.length > 0 ? 72 : 0) +
                    (isMobile
                        ? 200
                        : Math.max(dayHoverScheduleCount, 1) * 120)
                }
            >
                {dayHover && dayHoverHasContent ? (
                    <div
                        className="flex flex-col gap-2 px-1 py-0.5"
                        onMouseEnter={clearDayHoverClose}
                        onMouseLeave={handleDayScheduleLeave}
                    >
                        <div className="flex items-start justify-between gap-2 px-1">
                            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-0.5">
                                <p
                                    className={`text-[12px] font-medium ${
                                        dayHoverHoliday
                                            ? "text-red-500"
                                            : "text-gray-500"
                                    }`}
                                >
                                    {dayHover.dateKey
                                        .slice(5)
                                        .replace("-", "/")}{" "}
                                    일정
                                </p>
                                {dayHoverHoliday ? (
                                    <span className="inline-flex min-w-0 items-center gap-1 text-[12px] font-medium text-red-500">
                                        <span className="inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-red-100">
                                            <IconStar className="h-3.5 w-3.5 text-red-500" />
                                        </span>
                                        <span className="min-w-0 truncate">
                                            {dayHoverHoliday.title || "공휴일"}
                                        </span>
                                    </span>
                                ) : null}
                            </div>
                            {isMobile ? (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="!h-7 !w-7 !min-w-0 shrink-0 !rounded-full !px-0 !text-gray-500 hover:!bg-gray-100"
                                    aria-label="닫기"
                                    title="닫기"
                                    icon={<IconClose className="h-4 w-4" />}
                                    onClick={closeDayDetail}
                                />
                            ) : null}
                        </div>
                        <div className="px-1">
                            <p className="flex flex-wrap items-baseline gap-x-1.5 text-[12px] text-gray-500">
                                <span>투입가능 인원</span>
                                <span className="text-[14px] font-medium text-gray-900">
                                    {dayHoverAvailableNames.length}명
                                </span>
                            </p>
                            {dayHoverAvailableNames.length > 0 ? (
                                <p className="mt-0.5 break-words text-[14px] font-medium text-gray-900">
                                    {dayHoverAvailableNames.join(", ")}
                                </p>
                            ) : null}
                        </div>
                        {dayHoverPersonalEntries.length > 0 ? (
                            <div className="px-1">
                                <p className="flex flex-wrap items-baseline gap-x-1.5 text-[12px] text-gray-500">
                                    <span>개인 일정</span>
                                    <span className="text-[14px] font-medium text-red-500">
                                        {dayHoverPersonalNames.length}명
                                    </span>
                                </p>
                                <div className="mt-1 flex flex-wrap gap-1">
                                    {dayHoverPersonalEntries.map((entry) =>
                                        entry.names.map((name) => (
                                            <button
                                                key={`${entry.id}-${name}`}
                                                type="button"
                                                className="inline-flex items-center rounded-[6px] bg-red-50 px-1.5 py-[3px] text-[11px] font-medium text-red-500 transition-colors hover:bg-red-100"
                                                title={entry.reason || name}
                                                onClick={() => {
                                                    closeDayDetail();
                                                    openPersonalDetail(entry);
                                                }}
                                            >
                                                {name}
                                            </button>
                                        ))
                                    )}
                                </div>
                            </div>
                        ) : null}
                        {isMobile && dayHoverScheduleCount > 0 ? (
                            <div className="flex flex-wrap gap-1.5 px-1">
                                {dayHover.schedules.map((schedule, index) => {
                                    const selected = index === safeDayScheduleIndex;
                                    return (
                                        <button
                                            key={schedule.id}
                                            type="button"
                                            aria-pressed={selected}
                                            aria-label={`호선 ${schedule.shipName || "없음"}`}
                                            onClick={() => setDayScheduleIndex(index)}
                                            className={`inline-flex max-w-full items-center gap-1.5 rounded-[8px] border px-2 py-1.5 text-left text-[12px] font-medium transition-colors ${
                                                selected
                                                    ? "border-transparent text-gray-900"
                                                    : "border-gray-200 bg-white text-gray-700"
                                            }`}
                                            style={
                                                selected
                                                    ? { backgroundColor: schedule.color }
                                                    : undefined
                                            }
                                        >
                                            {/* 선택 시 칩 배경과 원이 같아 빈칸처럼 보이므로, 미선택일 때만 색 원 표시 */}
                                            {!selected ? (
                                                <span
                                                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                                                    style={{
                                                        backgroundColor: schedule.color,
                                                    }}
                                                    aria-hidden
                                                />
                                            ) : null}
                                            <span className="min-w-0 truncate">
                                                {schedule.shipName || "—"}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        ) : null}
                        <div
                            className="grid gap-3"
                            style={{
                                gridTemplateColumns: `repeat(${dayHoverColumnCount}, minmax(0, 1fr))`,
                            }}
                        >
                            {visibleDaySchedules.map((schedule, index) => (
                                <div
                                    key={schedule.id}
                                    className={`flex min-w-0 flex-col gap-1.5 px-1 ${
                                        !isMobile && index > 0
                                            ? "border-l border-gray-100 pl-3"
                                            : ""
                                    }`}
                                >
                                    {!isMobile ? (
                                        <div className="flex items-center gap-2">
                                            <span
                                                className="h-2.5 w-2.5 shrink-0 rounded-full"
                                                style={{ backgroundColor: schedule.color }}
                                                aria-hidden
                                            />
                                            <div className="min-w-0">
                                                <p className="text-[12px] text-gray-500">호선</p>
                                                <p className="truncate text-[14px] font-medium text-gray-900">
                                                    {schedule.shipName || "—"}
                                                </p>
                                            </div>
                                        </div>
                                    ) : null}
                                    <div>
                                        <p className="text-[12px] text-gray-500">인원</p>
                                        {schedule.teamMember.trim() ? (
                                            <div className="mt-1 grid grid-cols-4 gap-1">
                                                {sortPeopleByRoleAndJoinDate(
                                                    schedule.teamMember
                                                        .split(/\s+/)
                                                        .filter(Boolean),
                                                    dayHoverStaffSortMeta,
                                                    { priorityFirst: SCHEDULE_TEAM_LEADERS }
                                                ).map((name) => {
                                                    const isSf = (
                                                        SCHEDULE_TEAM_LEADERS as readonly string[]
                                                    ).includes(name);
                                                    if (isSf) {
                                                        return (
                                                            <span
                                                                key={`${schedule.id}-${name}`}
                                                                className="inline-flex min-w-0 items-center justify-center rounded-[6px] border border-transparent px-1 py-[3px] text-[11px] font-medium text-gray-800"
                                                                style={{
                                                                    backgroundColor: schedule.color,
                                                                }}
                                                            >
                                                                {name}
                                                            </span>
                                                        );
                                                    }
                                                    return (
                                                        <Chip
                                                            key={`${schedule.id}-${name}`}
                                                            color="gray-600"
                                                            variant="solid"
                                                            size="sm"
                                                            className="min-w-0 justify-center !px-1"
                                                        >
                                                            {name}
                                                        </Chip>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <p className="text-[14px] font-medium text-gray-900">—</p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : null}
            </ActionMenu>
            <BaseModal
                isOpen={personalDetail != null}
                onClose={closePersonalDetail}
                title={personalDetailEditing ? "개인 일정 수정" : "개인 일정"}
                maxWidth="max-w-[400px]"
                footer={
                    personalDetail ? (
                        personalDetailEditing ? (
                            <div className="flex w-full gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="md"
                                    className="flex-1"
                                    disabled={personalSaving}
                                    onClick={() => {
                                        setPersonalDetailEditing(false);
                                        setPersonalEditStart(personalDetail.start);
                                        setPersonalEditEnd(personalDetail.end);
                                        setPersonalEditReason(personalDetail.reason);
                                    }}
                                >
                                    취소
                                </Button>
                                <Button
                                    type="button"
                                    variant="primary"
                                    size="md"
                                    className="flex-1"
                                    loading={personalSaving}
                                    onClick={() => {
                                        void (async () => {
                                            if (!personalEditStart || !personalEditEnd) {
                                                showError("기간을 선택해주세요.");
                                                return;
                                            }
                                            if (!personalEditReason.trim()) {
                                                showError("사유를 입력해주세요.");
                                                return;
                                            }
                                            const start =
                                                personalEditStart <= personalEditEnd
                                                    ? personalEditStart
                                                    : personalEditEnd;
                                            const end =
                                                personalEditStart <= personalEditEnd
                                                    ? personalEditEnd
                                                    : personalEditStart;
                                            const next: PersonalScheduleEntry = {
                                                ...personalDetail,
                                                start,
                                                end,
                                                reason: personalEditReason.trim(),
                                            };
                                            setPersonalSaving(true);
                                            try {
                                                await Promise.resolve(
                                                    onPersonalEntrySave?.(next)
                                                );
                                                setPersonalDetail(next);
                                                setPersonalDetailEditing(false);
                                            } catch {
                                                // 부모에서 토스트 처리
                                            } finally {
                                                setPersonalSaving(false);
                                            }
                                        })();
                                    }}
                                >
                                    저장
                                </Button>
                            </div>
                        ) : (
                            <div className="flex w-full gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="md"
                                    className="flex-1"
                                    icon={<IconEdit className="h-4 w-4" />}
                                    onClick={() => {
                                        setPersonalEditStart(personalDetail.start);
                                        setPersonalEditEnd(personalDetail.end);
                                        setPersonalEditReason(personalDetail.reason);
                                        setPersonalDetailEditing(true);
                                    }}
                                >
                                    수정
                                </Button>
                                <Button
                                    type="button"
                                    variant="danger"
                                    size="md"
                                    className="flex-1"
                                    icon={<IconTrash className="h-4 w-4" />}
                                    onClick={() => {
                                        const entry = personalDetail;
                                        closePersonalDetail();
                                        onPersonalEntryDelete?.(entry);
                                    }}
                                >
                                    삭제
                                </Button>
                            </div>
                        )
                    ) : null
                }
            >
                {personalDetail ? (
                    <div className="flex flex-col gap-4">
                        <div>
                            <p className="mb-1 text-sm font-medium text-gray-500">
                                인원
                            </p>
                            <p className="text-[15px] font-medium text-gray-900">
                                {personalDetail.names.join(", ") || "—"}
                            </p>
                        </div>
                        {personalDetailEditing ? (
                            <>
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                    <DatePicker
                                        label="시작일"
                                        value={personalEditStart}
                                        onChange={setPersonalEditStart}
                                        displayFormat="iso"
                                        className="w-full"
                                    />
                                    <DatePicker
                                        label="종료일"
                                        value={personalEditEnd}
                                        onChange={setPersonalEditEnd}
                                        displayFormat="iso"
                                        className="w-full"
                                    />
                                </div>
                                <TextInput
                                    label="사유"
                                    required
                                    value={personalEditReason}
                                    onChange={setPersonalEditReason}
                                    placeholder="사유를 입력하세요"
                                    className="w-full"
                                />
                            </>
                        ) : (
                            <>
                                <div>
                                    <p className="mb-1 text-sm font-medium text-gray-500">
                                        기간
                                    </p>
                                    <p className="text-[15px] font-medium text-gray-900">
                                        {formatPersonalSchedulePeriod(
                                            personalDetail.start,
                                            personalDetail.end
                                        )}
                                    </p>
                                </div>
                                <div>
                                    <p className="mb-1 text-sm font-medium text-gray-500">
                                        사유
                                    </p>
                                    <p className="break-words text-[15px] font-medium text-gray-900">
                                        {personalDetail.reason || "—"}
                                    </p>
                                </div>
                            </>
                        )}
                    </div>
                ) : null}
            </BaseModal>
        </div>
    );
}
