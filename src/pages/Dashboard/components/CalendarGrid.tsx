import React, { useEffect, useState } from "react";
import WeekRow from "../../../components/calendar/WeekRow";
import Button from "../../../components/common/Button";
import TextInput from "../../../components/ui/TextInput";
import { IconCheck, IconClose } from "../../../components/icons/Icons";
import { LOCATIONS, ORDER_PERSONS } from "../../../store/workReportStore";
import { CalendarEvent } from "../../../types";
import { getWeekEventRows, getEventsForDate, getSafeDateKey, getColumnPadding } from "../../../utils/calendarUtils";
import { prefetchWorkLogById } from "../../../lib/workLogApi";
import {
    SCHEDULE_COLUMNS,
    SCHEDULE_LABEL_BG,
} from "../../../components/schedule/scheduleTableShared";

interface CalendarGridProps {
    weeks: { date: Date; inMonth: boolean }[][];
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
}

/** Empty slot that grows open under the week that holds the chosen end date. */
const SCHEDULE_FORM_TABS = [
    "Customer",
    "Ship name",
    "Work location",
    "Period",
    "Work Item",
    "Team member",
    "Car",
    "Yard PIC",
    "Remark",
] as const;

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
};

const EMPTY_CUSTOMER_DRAFT: CustomerDraft = {
    group: null,
    companyDirect: "",
    person: null,
    personDirect: "",
    contactDirect: "",
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
    locationDirect: boolean;
    locationCustom: string;
};

const EMPTY_LOCATION_DRAFT: LocationDraft = {
    locations: [],
    locationDirect: false,
    locationCustom: "",
};

function shipTableValues(draft: ShipDraft) {
    return {
        shipName: draft.shipName,
        engineType: draft.engineType,
    };
}

function locationTableValue(draft: LocationDraft) {
    const places = [
        ...draft.locations,
        ...(draft.locationDirect ? [draft.locationCustom] : []),
    ].filter((place) => place.trim());
    return places.join(", ");
}

function ShipCardFields({
    draft,
    onChange,
}: {
    draft: ShipDraft;
    onChange: (next: ShipDraft) => void;
}) {
    return (
        <div className="mt-3 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
            <TextInput
                label="Ship name"
                value={draft.shipName}
                onChange={(value) => onChange({ ...draft, shipName: value })}
                placeholder="Ship name"
                uppercase
            />
            <TextInput
                label="Engine type"
                value={draft.engineType}
                onChange={(value) => onChange({ ...draft, engineType: value })}
                placeholder="Engine type"
                uppercase
            />
        </div>
    );
}

function WorkLocationCardFields({
    draft,
    onChange,
}: {
    draft: LocationDraft;
    onChange: (next: LocationDraft) => void;
}) {
    const toggleLocation = (location: string) => {
        const selected = draft.locations.includes(location);
        onChange({
            ...draft,
            locations: selected
                ? draft.locations.filter((item) => item !== location)
                : [...draft.locations, location],
        });
    };

    return (
        <div className="mt-3 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
            <div className="grid grid-cols-2 gap-2">
                {LOCATIONS.map((location) => (
                    <Button
                        key={location}
                        type="button"
                        variant={draft.locations.includes(location) ? "primary" : "outline"}
                        size="sm"
                        fullWidth
                        onClick={() => toggleLocation(location)}
                    >
                        {location}
                    </Button>
                ))}
            </div>
            <Button
                type="button"
                variant={draft.locationDirect ? "primary" : "outline"}
                size="sm"
                fullWidth
                onClick={() => onChange({ ...draft, locationDirect: !draft.locationDirect })}
            >
                직접입력
            </Button>
            {draft.locationDirect ? (
                <TextInput
                    value={draft.locationCustom}
                    onChange={(value) => onChange({ ...draft, locationCustom: value })}
                    placeholder="직접입력"
                />
            ) : null}
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
    const { group, companyDirect, person, personDirect, contactDirect } = draft;
    const names = group === "ELU" || group === "PRIME" ? ORDER_PERSONS[group] : [];

    return (
        <div className="mt-3 flex min-h-0 flex-1 gap-3 overflow-y-auto">
            <div className="flex min-w-0 flex-1 flex-col gap-2">
                {CUSTOMER_GROUPS.map((item) => (
                    <Button
                        key={item.id}
                        type="button"
                        variant={group === item.id ? "primary" : "outline"}
                        size="sm"
                        fullWidth
                        onClick={() =>
                            onChange({
                                ...draft,
                                group: item.id,
                                person: null,
                                personDirect: "",
                            })
                        }
                    >
                        {item.label}
                    </Button>
                ))}
                {group === "DIRECT" ? (
                    <TextInput
                        value={companyDirect}
                        onChange={(value) => onChange({ ...draft, companyDirect: value })}
                        placeholder="직접입력"
                    />
                ) : null}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
                {group === "DIRECT" ? (
                    <TextInput
                        value={contactDirect}
                        onChange={(value) => onChange({ ...draft, contactDirect: value })}
                        placeholder="직접입력"
                    />
                ) : null}
                {names.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2">
                        {names.map((name) => (
                            <Button
                                key={name}
                                type="button"
                                variant={person === name ? "primary" : "outline"}
                                size="sm"
                                fullWidth
                                onClick={() =>
                                    onChange({ ...draft, person: name, personDirect: "" })
                                }
                            >
                                {name}
                            </Button>
                        ))}
                    </div>
                ) : null}
                {names.length > 0 ? (
                    <>
                        <Button
                            type="button"
                            variant={person === "DIRECT" ? "primary" : "outline"}
                            size="sm"
                            fullWidth
                            onClick={() => onChange({ ...draft, person: "DIRECT" })}
                        >
                            직접입력
                        </Button>
                        {person === "DIRECT" ? (
                            <TextInput
                                value={personDirect}
                                onChange={(value) => onChange({ ...draft, personDirect: value })}
                                placeholder="직접입력"
                            />
                        ) : null}
                    </>
                ) : null}
            </div>
        </div>
    );
}

const FORM_TABLE_COLUMNS = SCHEDULE_COLUMNS.filter((column) => column.key !== "no");
const FORM_TABLE_HEADER_COLUMNS = FORM_TABLE_COLUMNS.filter(
    (column) => column.key !== "customerCompany" && column.key !== "customerContact"
);

function WeekInsertSlot({ onClose }: { onClose: () => void }) {
    const [expanded, setExpanded] = useState(false);
    const [activeTab, setActiveTab] = useState<(typeof SCHEDULE_FORM_TABS)[number]>(
        SCHEDULE_FORM_TABS[0]
    );
    const closingRef = React.useRef(false);
    const slotRef = React.useRef<HTMLDivElement>(null);
    const scrollerRef = React.useRef<HTMLDivElement>(null);
    const cardRefs = React.useRef<Array<HTMLDivElement | null>>([]);
    const [cardWidth, setCardWidth] = useState(0);
    const [sidePad, setSidePad] = useState(0);
    const [customer, setCustomer] = useState<CustomerDraft>(EMPTY_CUSTOMER_DRAFT);
    const [ship, setShip] = useState<ShipDraft>(EMPTY_SHIP_DRAFT);
    const [workLocation, setWorkLocation] = useState<LocationDraft>(EMPTY_LOCATION_DRAFT);
    const tableCells = {
        ...customerTableValues(customer),
        ...shipTableValues(ship),
        workLocation: locationTableValue(workLocation),
    };

    useEffect(() => {
        const frame = requestAnimationFrame(() => setExpanded(true));
        return () => cancelAnimationFrame(frame);
    }, []);

    useEffect(() => {
        if (!expanded) return;
        slotRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, [expanded]);

    useEffect(() => {
        const scroller = scrollerRef.current;
        if (!scroller || !expanded) return;
        const updateWidth = () => {
            const width = Math.max(0, (scroller.clientWidth - 48) / 3);
            setCardWidth(width);
            setSidePad(Math.max(0, (scroller.clientWidth - width) / 2));
        };
        updateWidth();
        const observer = new ResizeObserver(updateWidth);
        observer.observe(scroller);
        return () => observer.disconnect();
    }, [expanded]);

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
        scroller.scrollTo({ left: Math.max(0, left - inset), behavior: "smooth" });
    };

    const syncTabWithScroll = () => {
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
        setExpanded(false);
    };

    return (
        <div
            ref={slotRef}
            className={`flex shrink-0 flex-col overflow-hidden border-gray-200 bg-white transition-[height] duration-500 ease-out ${
                expanded ? "h-[34rem] border-b" : "h-0"
            }`}
            aria-label="일정 입력"
            onTransitionEnd={(event) => {
                if (event.propertyName !== "height" || !closingRef.current) return;
                onClose();
            }}
        >
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
                                    className="border-r border-b border-gray-800 px-1 py-2 text-center font-bold leading-tight"
                                    style={{ backgroundColor: SCHEDULE_LABEL_BG }}
                                >
                                    Customer
                                </th>
                                {FORM_TABLE_HEADER_COLUMNS.map((column, index) => (
                                    <th
                                        key={column.key}
                                        className={`border-b border-gray-800 px-1 py-2 text-center font-bold leading-tight whitespace-pre-line ${
                                            index < FORM_TABLE_HEADER_COLUMNS.length - 1
                                                ? "border-r"
                                                : ""
                                        }`}
                                        style={{ backgroundColor: SCHEDULE_LABEL_BG }}
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
                                        className={`bg-white p-0 align-middle ${
                                            index < FORM_TABLE_COLUMNS.length - 1
                                                ? "border-r border-gray-800"
                                                : ""
                                        }`}
                                    >
                                        <div className="flex min-h-[72px] items-center justify-center px-1 py-1 text-center leading-tight break-words">
                                            {column.key in tableCells
                                                ? tableCells[column.key as keyof typeof tableCells]
                                                : ""}
                                        </div>
                                    </td>
                                ))}
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
            <div className="flex items-end gap-1 border-b border-gray-200 px-2 pt-2">
                <div role="tablist" className="flex min-w-0 flex-1 items-end">
                    {SCHEDULE_FORM_TABS.map((label) => {
                        const selected = activeTab === label;
                        return (
                            <button
                                key={label}
                                type="button"
                                role="tab"
                                aria-selected={selected}
                                title={label}
                                onClick={() => scrollToTab(label)}
                                className={`min-w-0 flex-1 basis-0 truncate rounded-t-lg px-2 py-2 text-center text-[13px] font-medium transition-colors ${
                                    selected
                                        ? "relative z-10 -mb-px border border-b-white border-gray-200 bg-white text-gray-900"
                                        : "text-gray-500 hover:bg-white/70 hover:text-gray-700"
                                }`}
                            >
                                {label}
                            </button>
                        );
                    })}
                </div>
                <div className="mb-1 flex shrink-0">
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="!h-9 !w-9 !rounded-full !px-0 !text-gray-700 hover:!bg-gray-200"
                        aria-label="저장"
                        title="저장"
                        icon={<IconCheck className="h-5 w-5" />}
                    />
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="!h-9 !w-9 !rounded-full !px-0 !text-gray-700 hover:!bg-gray-200"
                        aria-label="닫기"
                        title="닫기"
                        icon={<IconClose className="h-5 w-5" />}
                        onClick={requestClose}
                    />
                </div>
            </div>
            <div
                ref={scrollerRef}
                onScroll={syncTabWithScroll}
                className="min-h-0 flex-1 overflow-x-scroll overflow-y-hidden"
            >
                <div className="flex h-full py-3">
                    <div aria-hidden className="shrink-0" style={{ width: sidePad, minWidth: sidePad }} />
                    {SCHEDULE_FORM_TABS.map((label, index) => (
                        <div
                            key={label}
                            ref={(element) => {
                                cardRefs.current[index] = element;
                            }}
                            className="flex h-full shrink-0 flex-col overflow-hidden rounded-2xl bg-[#f3f4f6] p-4"
                            style={{
                                width: cardWidth > 0 ? cardWidth : "100%",
                                marginRight: index < SCHEDULE_FORM_TABS.length - 1 ? 16 : 0,
                            }}
                            aria-label={label}
                        >
                            <p className="text-left text-sm font-medium text-gray-800">{label}</p>
                            {label === "Customer" ? (
                                <CustomerCardFields draft={customer} onChange={setCustomer} />
                            ) : null}
                            {label === "Ship name" ? (
                                <ShipCardFields draft={ship} onChange={setShip} />
                            ) : null}
                            {label === "Work location" ? (
                                <WorkLocationCardFields
                                    draft={workLocation}
                                    onChange={setWorkLocation}
                                />
                            ) : null}
                        </div>
                    ))}
                    <div aria-hidden className="shrink-0" style={{ width: sidePad, minWidth: sidePad }} />
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
    onDragStart,
    onDragEnter,
    onHiddenCountClick,
    onCellHeightChange,
    tagLayerTop: tagLayerTopProp,
    tagsBesideDate = false,
    uniformColumns = false,
    rowHeight,
}: CalendarGridProps) {
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
                        uniformColumns={uniformColumns}
                        rowHeight={rowHeight}
                    />
                    {showInsert ? (
                        <WeekInsertSlot
                            key={insertAfterDate}
                            onClose={() => onInsertClose?.()}
                        />
                    ) : null}
                    </React.Fragment>
                );
            })}
        </div>
    );
}
