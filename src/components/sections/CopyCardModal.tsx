// CopyCardModal.tsx
import { useState, useMemo } from "react";
import BaseModal from "../ui/BaseModal";
import DatePicker from "../ui/DatePicker";
import Button from "../common/Button";
import WorkLogEntryCard from "./WorkLogEntryCard";
import { useWorkReportStore, toKoreanTime } from "../../store/workReportStore";
import { IconPlus } from "../icons/Icons";

interface CopyCardModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCopy: (selectedEntries: any[], targetDate: string) => void;
}

// TimelineSummarySection의 로직 재사용
interface DaySegment {
    dateKey: string;
    startMin: number;
    endMin: number;
    type: string;
    title: string;
    persons: string[];
    totalMin: number;
    entryId: number;
}

const splitEntryByDay = (entry: {
    id: number;
    dateFrom: string;
    timeFrom: string;
    dateTo: string;
    timeTo: string;
    descType: string;
    details: string;
    persons: string[];
    noLunch?: boolean;
}): DaySegment[] => {
    if (!entry.dateFrom || !entry.timeFrom || !entry.dateTo || !entry.timeTo)
        return [];

    const parseDateTime = (d: string, t: string) => {
        if (t === "24:00") {
            const base = new Date(`${d}T00:00`);
            base.setDate(base.getDate() + 1);
            return base;
        }
        return new Date(`${d}T${t}`);
    };

    const start = parseDateTime(entry.dateFrom, entry.timeFrom);
    const end = parseDateTime(entry.dateTo, entry.timeTo);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start)
        return [];

    const result: DaySegment[] = [];
    let cur = new Date(start);

    const calcLunchDeduct = (segStart: Date, segEnd: Date) => {
        if (entry.descType === "작업" && entry.noLunch) return 0;
        if (entry.descType !== "작업" && entry.descType !== "대기") return 0;

        const lunchStart = new Date(
            segStart.getFullYear(),
            segStart.getMonth(),
            segStart.getDate(),
            12,
            0,
            0
        );
        const lunchEnd = new Date(
            segStart.getFullYear(),
            segStart.getMonth(),
            segStart.getDate(),
            13,
            0,
            0
        );

        const overlapMs =
            Math.min(segEnd.getTime(), lunchEnd.getTime()) -
            Math.max(segStart.getTime(), lunchStart.getTime());
        const overlapMin = Math.max(0, Math.round(overlapMs / 60000));
        return Math.min(60, overlapMin);
    };

    while (cur < end) {
        const dayStart = new Date(
            cur.getFullYear(),
            cur.getMonth(),
            cur.getDate(),
            0,
            0,
            0
        );
        const nextDay = new Date(dayStart);
        nextDay.setDate(nextDay.getDate() + 1);

        const segStart = new Date(cur);
        const segEnd = end < nextDay ? new Date(end) : new Date(nextDay);

        const dateKey = `${segStart.getFullYear()}-${String(
            segStart.getMonth() + 1
        ).padStart(2, "0")}-${String(segStart.getDate()).padStart(2, "0")}`;

        const minutesFromDayStart = (dt: Date) => {
            const base = new Date(
                dt.getFullYear(),
                dt.getMonth(),
                dt.getDate(),
                0,
                0,
                0
            );
            return Math.max(
                0,
                Math.min(1440, Math.round((dt.getTime() - base.getTime()) / 60000))
            );
        };

        const startMin = minutesFromDayStart(segStart);
        const endMin =
            segStart.getDate() === segEnd.getDate()
                ? minutesFromDayStart(segEnd)
                : 1440;

        const rawMin = Math.max(0, endMin - startMin);
        const lunchDeduct = calcLunchDeduct(segStart, segEnd);
        const totalMin = Math.max(0, rawMin - lunchDeduct);

        result.push({
            dateKey,
            startMin,
            endMin,
            type: entry.descType,
            title: entry.details || entry.descType,
            persons: entry.persons,
            totalMin,
            entryId: entry.id,
        });

        cur = segEnd;
    }

    return result;
};

// 타임라인 그룹 빌드 (TimelineSummarySection과 동일한 로직)
type OverallTimelineGroup = {
    signature: string;
    persons: string[];
    segmentsByDate: Map<string, DaySegment[]>;
    sortedDates: string[];
};

const buildTimelineGroupsOverall = (entries: any[]): OverallTimelineGroup[] => {
    const personToSegs = new Map<string, DaySegment[]>();

    entries.forEach((entry) => {
        const segs = splitEntryByDay(entry);
        segs.forEach((seg) => {
            seg.persons.forEach((p) => {
                const one: DaySegment = { ...seg, persons: [p] };
                if (!personToSegs.has(p)) personToSegs.set(p, []);
                personToSegs.get(p)!.push(one);
            });
        });
    });

    const sigToGroup = new Map<string, OverallTimelineGroup>();

    for (const [person, segs] of personToSegs.entries()) {
        const sorted = [...segs].sort((a, b) => {
            return (
                a.dateKey.localeCompare(b.dateKey) ||
                a.startMin - b.startMin ||
                a.endMin - b.endMin ||
                a.type.localeCompare(b.type) ||
                a.title.localeCompare(b.title)
            );
        });

        const signature = sorted
            .map((s) => `${s.dateKey}-${s.startMin}-${s.endMin}-${s.type}-${s.title}`)
            .join("||");

        if (!sigToGroup.has(signature)) {
            sigToGroup.set(signature, {
                signature,
                persons: [],
                segmentsByDate: new Map(),
                sortedDates: [],
            });
        }
        sigToGroup.get(signature)!.persons.push(person);
    }

    const groups = Array.from(sigToGroup.values()).map((g) => {
        const personsSorted = Array.from(new Set(g.persons)).sort((a, b) =>
            a.localeCompare(b, "ko")
        );

        const rep = personsSorted[0];
        const repSegs = (personToSegs.get(rep) || []).slice();

        const sortedRep = repSegs.sort((a, b) => {
            return (
                a.dateKey.localeCompare(b.dateKey) ||
                a.startMin - b.startMin ||
                a.endMin - b.endMin
            );
        });

        const segmentsByDate = new Map<string, DaySegment[]>();
        sortedRep.forEach((seg) => {
            if (!segmentsByDate.has(seg.dateKey)) segmentsByDate.set(seg.dateKey, []);
            segmentsByDate.get(seg.dateKey)!.push({
                ...seg,
                persons: personsSorted,
            });
        });

        const sortedDates = Array.from(segmentsByDate.keys()).sort();

        return {
            ...g,
            persons: personsSorted,
            segmentsByDate,
            sortedDates,
        };
    });

    groups.sort((a, b) => {
        if (b.persons.length !== a.persons.length)
            return b.persons.length - a.persons.length;
        return a.persons.join(",").localeCompare(b.persons.join(","), "ko");
    });

    return groups;
};

const getTypeColor = (type: string) => {
    switch (type) {
        case "작업":
            return {
                bg: "#dbeafe",
                border: "#60a5fa",
                text: "#1f2937",
            };
        case "이동":
            return {
                bg: "#d1fae5",
                border: "#34d399",
                text: "#1f2937",
            };
        case "대기":
            return {
                bg: "#fef3c7",
                border: "#fbbf24",
                text: "#1f2937",
            };
        default:
            return {
                bg: "#e5e7eb",
                border: "#9ca3af",
                text: "#374151",
            };
    }
};

const toHourStr = (minutes: number): string => {
    const h = Math.round(Math.max(0, minutes) / 6) / 10;
    return Number.isInteger(h) ? String(h) : h.toFixed(1);
};

const minutesToTopLabel = (min: number): string => {
    const h = Math.floor(min / 60);
    const m = min % 60;

    if (m === 0) return `${h}시`;
    if (m === 30) return `${h}시반`;
    return `${h}:${String(m).padStart(2, "0")}시`;
};

const formatKoreanDateLabel = (dateKey: string) => {
    const d = new Date(dateKey);
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
    const weekday = weekdays[d.getDay()] || "";
    return `${month}월 ${day}일 (${weekday})`;
};

// 레인 할당 (겹치는 세그먼트를 다른 레인에 배치)
const assignLanes = (segments: DaySegment[]): (DaySegment & { lane: number })[] => {
    const lanes: (DaySegment & { lane: number })[] = [];
    const activeLanes: { end: number; lane: number }[] = [];

    const sorted = [...segments].sort((a, b) => {
        if (a.startMin !== b.startMin) return a.startMin - b.startMin;
        return b.endMin - a.endMin;
    });

    sorted.forEach((seg) => {
        activeLanes.sort((a, b) => a.end - b.end);

        let assignedLane = -1;
        for (let i = 0; i < activeLanes.length; i++) {
            if (activeLanes[i].end <= seg.startMin) {
                assignedLane = activeLanes[i].lane;
                activeLanes[i].end = seg.endMin;
                break;
            }
        }

        if (assignedLane === -1) {
            assignedLane = activeLanes.length;
            activeLanes.push({ end: seg.endMin, lane: assignedLane });
        }

        lanes.push({ ...seg, lane: assignedLane });
    });

    return lanes;
};

const renderTimeLabels = (
    segments: DaySegment[],
    viewStart: number,
    viewEnd: number
): { min: number; left: number }[] => {
    const times = new Set<number>();
    segments.forEach((seg) => {
        times.add(seg.startMin);
        times.add(seg.endMin);
    });

    const span = Math.max(1, viewEnd - viewStart);
    return Array.from(times)
        .filter((t) => t >= viewStart && t <= viewEnd)
        .sort((a, b) => a - b)
        .map((min) => ({
            min,
            left: ((min - viewStart) / span) * 100,
        }));
};

// 카드 뷰용: 날짜별로 엔트리 분해
function splitEntryByDayForDisplay<T extends {
    id: number;
    dateFrom: string;
    timeFrom?: string;
    dateTo: string;
    timeTo?: string;
}>(entry: T) {
    const timeFrom = entry.timeFrom || "00:00";
    const timeTo = entry.timeTo || "00:00";

    if (entry.dateFrom === entry.dateTo) {
        return [{
            ...entry,
            __segId: String(entry.id),
            __originId: entry.id,
        }];
    }

    const toDateSafe = (d: string, t: string) => {
        if (t === "24:00") {
            const base = new Date(`${d}T00:00:00`);
            base.setDate(base.getDate() + 1);
            return base;
        }
        return new Date(`${d}T${t}:00`);
    };

    const start = toDateSafe(entry.dateFrom, timeFrom);
    const end = toDateSafe(entry.dateTo, timeTo);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
        return [{
            ...entry,
            __segId: String(entry.id),
            __originId: entry.id,
        }];
    }

    const results: any[] = [];
    let cur = new Date(`${entry.dateFrom}T00:00:00`);
    const last = new Date(`${entry.dateTo}T00:00:00`);

    while (cur <= last) {
        const yyyy = cur.getFullYear();
        const mm = String(cur.getMonth() + 1).padStart(2, "0");
        const dd = String(cur.getDate()).padStart(2, "0");
        const d = `${yyyy}-${mm}-${dd}`;

        const isFirst = d === entry.dateFrom;
        const isLast = d === entry.dateTo;

        const segTimeFrom = isFirst ? timeFrom : "00:00";
        const segTimeTo = isLast ? timeTo : "24:00";

        results.push({
            ...entry,
            dateFrom: d,
            dateTo: d,
            timeFrom: segTimeFrom,
            timeTo: segTimeTo,
            __segId: `${entry.id}__${d}`,
            __originId: entry.id,
        });

        cur.setDate(cur.getDate() + 1);
    }

    return results;
}

// 카드 뷰용 날짜 포맷 함수
function formatDateWithDayForCard(dateStr: string): string {
    const d = new Date(dateStr);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
    const weekday = weekdays[d.getDay()];
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}(${weekday})`;
}

export default function CopyCardModal({
    isOpen,
    onClose,
    onCopy,
}: CopyCardModalProps) {
    const { workLogEntries } = useWorkReportStore();
    const [targetDate, setTargetDate] = useState("");
    const [viewMode, setViewMode] = useState<"card" | "timeline">("card");
    const [selectedSegmentKeys, setSelectedSegmentKeys] = useState<Set<string>>(new Set());
    const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(new Set());

    // 타임라인 그룹 생성
    const overallGroups = useMemo(() => {
        return buildTimelineGroupsOverall(workLogEntries);
    }, [workLogEntries]);

    // 카드 뷰용: 전체 엔트리들을 날짜별로 분할하여 표시
    const displayEntries = useMemo(() => {
        return workLogEntries
            .flatMap((entry) => splitEntryByDayForDisplay(entry))
            .sort((a, b) => {
                const aKey = `${a.dateFrom}T${a.timeFrom || "00:00"}`;
                const bKey = `${b.dateFrom}T${b.timeFrom || "00:00"}`;
                return aKey.localeCompare(bKey);
            });
    }, [workLogEntries]);

    // 날짜별로 그룹화 (카드 뷰용)
    const entriesByDate = useMemo(() => {
        const groups = new Map<string, typeof displayEntries>();
        displayEntries.forEach((entry) => {
            const date = entry.dateFrom;
            if (!groups.has(date)) {
                groups.set(date, []);
            }
            groups.get(date)!.push(entry);
        });
        return groups;
    }, [displayEntries]);

    // 시간 계산 (카드 뷰용) - 점심시간 자동차감 포함
    const calcHours = (entry: any) => {
        if (!entry.timeFrom || !entry.timeTo) return "0시간";
        
        const toDateSafe = (d: string, t: string) => {
            if (t === "24:00") {
                const base = new Date(`${d}T00:00:00`);
                base.setDate(base.getDate() + 1);
                return base;
            }
            return new Date(`${d}T${t}:00`);
        };

        const start = toDateSafe(entry.dateFrom, entry.timeFrom);
        const end = toDateSafe(entry.dateTo, entry.timeTo);
        if (isNaN(start.getTime()) || isNaN(end.getTime())) return "0시간";
        if (end <= start) return "0시간";

        const totalMinutes = Math.floor((end.getTime() - start.getTime()) / 60000);

        // 작업과 대기가 아니면 점심 규칙 적용 X
        if (entry.descType !== "작업" && entry.descType !== "대기") {
            const hours = Math.floor(totalMinutes / 60);
            const minutes = totalMinutes % 60;
            if (minutes === 0) return `${hours}시간`;
            return `${hours}시간 ${minutes}분`;
        }

        // 대기는 무조건 점심시간 차감
        // 작업은 "점심 안 먹음"이면 전체 시간 카운트
        if (entry.descType === "작업" && entry.noLunch) {
            const hours = Math.floor(totalMinutes / 60);
            const minutes = totalMinutes % 60;
            if (minutes === 0) return `${hours}시간`;
            return `${hours}시간 ${minutes}분`;
        }

        // 점심시간(12:00~13:00) 겹치는 분만큼 제외 (날짜跨越 대응)
        let lunchOverlapMinutes = 0;

        const cur = new Date(`${entry.dateFrom}T00:00:00`);
        const last = new Date(`${entry.dateTo}T00:00:00`);

        while (cur <= last) {
            const yyyy = cur.getFullYear();
            const mm = String(cur.getMonth() + 1).padStart(2, "0");
            const dd = String(cur.getDate()).padStart(2, "0");
            const d = `${yyyy}-${mm}-${dd}`;

            const lunchStart = new Date(`${d}T12:00:00`);
            const lunchEnd = new Date(`${d}T13:00:00`);

            const overlapStart = start > lunchStart ? start : lunchStart;
            const overlapEnd = end < lunchEnd ? end : lunchEnd;

            if (overlapEnd > overlapStart) {
                lunchOverlapMinutes += Math.floor(
                    (overlapEnd.getTime() - overlapStart.getTime()) / 60000
                );
            }

            cur.setDate(cur.getDate() + 1);
        }

        const result = totalMinutes - lunchOverlapMinutes;
        const finalMinutes = result < 0 ? 0 : result;
        const hours = Math.floor(finalMinutes / 60);
        const minutes = finalMinutes % 60;
        if (minutes === 0) return `${hours}시간`;
        return `${hours}시간 ${minutes}분`;
    };

    // 전체 뷰 범위 계산
    const globalView = useMemo(() => {
        let minStart = 1440;
        let maxEnd = 0;

        workLogEntries.forEach((entry: any) => {
            const segs = splitEntryByDay(entry);
            segs.forEach((s) => {
                minStart = Math.min(minStart, s.startMin);
                maxEnd = Math.max(maxEnd, s.endMin);
            });
        });

        if (minStart === 1440 && maxEnd === 0) {
            return { viewStart: 0, viewEnd: 1440 };
        }

        let viewStart = minStart;
        let viewEnd = maxEnd;

        const pad = 120; // 2시간
        const rawSpan = Math.max(0, viewEnd - viewStart);
        if (rawSpan >= 1440) {
            return { viewStart: 0, viewEnd: 1440 };
        }

        viewStart = Math.max(0, viewStart - pad);
        viewEnd = Math.min(1440, viewEnd + pad);

        if (viewEnd - viewStart >= 1440) {
            return { viewStart: 0, viewEnd: 1440 };
        }

        return { viewStart, viewEnd };
    }, [workLogEntries]);

    // 세그먼트 선택 토글 (타임라인 뷰)
    const handleToggleSegment = (segment: DaySegment, groupIdx: number, dateKey: string, idx: number) => {
        const key = `${segment.entryId}-${groupIdx}-${dateKey}-${idx}`;
        setSelectedSegmentKeys((prev) => {
            const next = new Set(prev);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }
            return next;
        });
    };

    // 카드 선택 토글 (카드 뷰)
    const handleToggleCard = (cardId: string) => {
        setSelectedCardIds((prev) => {
            const next = new Set(prev);
            if (next.has(cardId)) {
                next.delete(cardId);
            } else {
                next.add(cardId);
            }
            return next;
        });
    };

    // 복사 처리
    const handleCopy = () => {
        if (!targetDate) {
            alert("복사할 날짜를 선택해주세요.");
            return;
        }

        const selectedEntryIds = new Set<number>();

        if (viewMode === "timeline") {
            if (selectedSegmentKeys.size === 0) {
                alert("복사할 타임라인을 선택해주세요.");
                return;
            }
            // 타임라인 뷰: 선택된 세그먼트의 entryId를 수집
            selectedSegmentKeys.forEach((key) => {
                const entryId = parseInt(key.split("-")[0]);
                if (!isNaN(entryId)) {
                    selectedEntryIds.add(entryId);
                }
            });
        } else {
            if (selectedCardIds.size === 0) {
                alert("복사할 카드를 선택해주세요.");
                return;
            }
            // 카드 뷰: 선택된 카드의 entryId를 수집
            selectedCardIds.forEach((cardId) => {
                const entryId = parseInt(cardId.split("__")[0]);
                if (!isNaN(entryId)) {
                    selectedEntryIds.add(entryId);
                }
            });
        }

        // 원본 엔트리 찾기 및 날짜 변경
        const selectedEntries = Array.from(selectedEntryIds)
            .map((entryId) => {
                const entry = workLogEntries.find((e) => e.id === entryId);
                if (!entry) return null;

                // 날짜를 타겟 날짜로 변경
                return {
                    id: Date.now() + Math.random(),
                    dateFrom: targetDate,
                    timeFrom: entry.timeFrom,
                    dateTo: targetDate,
                    timeTo: entry.timeTo,
                    descType: entry.descType,
                    details: entry.details || "",
                    persons: [...(entry.persons || [])],
                    note: entry.note || "",
                    moveFrom: entry.moveFrom || "",
                    moveTo: entry.moveTo || "",
                    noLunch: entry.noLunch || false,
                } as any;
            })
            .filter((e): e is any => e !== null);

        onCopy(selectedEntries, targetDate);
        onClose();
        setTargetDate("");
        setSelectedSegmentKeys(new Set());
        setSelectedCardIds(new Set());
    };

    const selectedCount = viewMode === "timeline" ? selectedSegmentKeys.size : selectedCardIds.size;

    return (
        <BaseModal isOpen={isOpen} onClose={onClose} title="카드 복사" maxWidth="max-w-6xl">
            <style>{`
                .copy-card-modal-card [class*="text-[14px]"] {
                    font-size: 12px !important;
                }
                @media (min-width: 768px) {
                    .copy-card-modal-card [class*="text-[14px]"] {
                        font-size: 14px !important;
                    }
                }
                .copy-card-modal-card [class*="text-[13px]"] {
                    font-size: 11px !important;
                }
                @media (min-width: 768px) {
                    .copy-card-modal-card [class*="text-[13px]"] {
                        font-size: 13px !important;
                    }
                }
                .copy-card-modal-card [class*="text-[15px]"] {
                    font-size: 12px !important;
                }
                @media (min-width: 768px) {
                    .copy-card-modal-card [class*="text-[15px]"] {
                        font-size: 15px !important;
                    }
                }
            `}</style>
            <div className="relative flex flex-col gap-6">
                {/* 날짜 선택 */}
                <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-gray-700">
                        복사할 날짜
                    </label>
                    <DatePicker
                        value={targetDate}
                        onChange={setTargetDate}
                        placeholder="날짜 선택"
                    />
                </div>

                {/* 뷰 전환 버튼 */}
                <div className="flex items-center justify-between w-full">
                    <label className="text-sm font-medium text-gray-700">
                        {viewMode === "card" ? "복사할 카드 선택" : "복사할 타임라인 선택"}
                    </label>
                    <div className="flex gap-2 shrink-0">
                        <button
                            type="button"
                            onClick={() => setViewMode("card")}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                                viewMode === "card"
                                    ? "bg-blue-500 text-white"
                                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                            }`}
                        >
                            카드
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode("timeline")}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                                viewMode === "timeline"
                                    ? "bg-blue-500 text-white"
                                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                            }`}
                        >
                            타임라인
                        </button>
                    </div>
                </div>

                {/* 카드 뷰 */}
                {viewMode === "card" && displayEntries.length > 0 && (
                    <div className="flex flex-col gap-4 max-h-[600px] overflow-y-auto p-1">
                        {Array.from(entriesByDate.entries())
                            .sort(([a], [b]) => a.localeCompare(b))
                            .map(([date, entries]) => (
                                <div key={date} className="flex flex-col gap-2">
                                    {/* 날짜 헤더 */}
                                    <div className="text-sm font-semibold text-gray-700 pb-1 border-b border-gray-200">
                                        {formatDateWithDayForCard(date)}
                                    </div>
                                    {/* 해당 날짜의 카드들 */}
                                    <div className="flex flex-col gap-2">
                                        {entries.map((entry) => {
                                            const hoursLabel = calcHours(entry);
                                            const isSelected = selectedCardIds.has(entry.__segId);

                                            return (
                                                <div
                                                    key={entry.__segId}
                                                    className={`cursor-pointer transition-all ${
                                                        isSelected ? "ring-4 ring-red-500 ring-offset-0 rounded-2xl" : ""
                                                    }`}
                                                    onClick={() => handleToggleCard(entry.__segId)}
                                                >
                                                    <div className="copy-card-modal-card [&_button[aria-label='toggle']]:hidden [&_div.text-\\[14px\\]]:!text-[12px] md:[&_div.text-\\[14px\\]]:!text-[14px] [&_span.text-\\[13px\\]]:!text-[11px] md:[&_span.text-\\[13px\\]]:!text-[13px] [&_span.text-\\[15px\\]]:!text-[12px] md:[&_span.text-\\[15px\\]]:!text-[15px]">
                                                        <WorkLogEntryCard
                                                            descType={entry.descType as any}
                                                            hoursLabel={hoursLabel}
                                                            title={entry.details || entry.title || ""}
                                                            meta={
                                                                <div className="space-y-1.5 md:space-y-2">
                                                                    <div className="flex items-center gap-1.5 md:gap-2 text-[10px] md:text-[13px] text-gray-600">
                                                                        <svg
                                                                            width="12"
                                                                            height="12"
                                                                            viewBox="0 0 24 24"
                                                                            fill="currentColor"
                                                                            className="text-gray-400 shrink-0 w-3 h-3 md:w-4 md:h-4"
                                                                        >
                                                                            <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z" />
                                                                        </svg>
                                                                        <span className="shrink-0 min-w-0 truncate">
                                                                            {formatDateWithDayForCard(entry.dateFrom)} {toKoreanTime(entry.timeFrom)}
                                                                        </span>
                                                                        <span className="text-gray-400 shrink-0">→</span>
                                                                        <span className="shrink-0 min-w-0 truncate">
                                                                            {formatDateWithDayForCard(entry.dateTo)} {toKoreanTime(entry.timeTo)}
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex items-center gap-1.5 md:gap-2 text-[10px] md:text-[13px] text-gray-600">
                                                                        <svg
                                                                            width="12"
                                                                            height="12"
                                                                            viewBox="0 0 24 24"
                                                                            fill="currentColor"
                                                                            className="text-gray-400 shrink-0 w-3 h-3 md:w-4 md:h-4"
                                                                        >
                                                                            <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
                                                                        </svg>
                                                                        <span className="font-medium shrink-0">{entry.persons?.length || 0}명</span>
                                                                        <span className="text-gray-400 shrink-0">|</span>
                                                                        <div className="flex-1 min-w-0 text-gray-600 text-[10px] md:text-[13px] leading-3.5 md:leading-5 break-words">
                                                                            {Array.isArray(entry.persons) && entry.persons.length > 0
                                                                                ? entry.persons.join(", ")
                                                                                : "—"}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            }
                                                            isExpanded={false}
                                                            onToggle={() => {}}
                                                            showNoLunch={entry.noLunch}
                                                            noLunchText={entry.noLunch ? "점심 안 먹고 작업 진행" : undefined}
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                    </div>
                )}

                {/* 타임라인 뷰 */}
                {viewMode === "timeline" && overallGroups.length > 0 && (
                    <div className="flex flex-col gap-8 max-h-[600px] overflow-y-auto p-2">
                        {overallGroups.map((group, groupIdx) => (
                            <div key={`overall-group-${groupIdx}`} className="p-2" style={{ width: "100%" }}>
                                        {/* 그룹 라벨 */}
                                        <div className="flex items-center justify-between gap-3 mb-3">
                                            <div className="text-[14px] font-semibold text-slate-800">
                                                {group.persons.join(", ")} ({group.persons.length}명)
                                            </div>
                                        </div>

                                        {/* 그룹 내 날짜별 타임라인 */}
                                        <div className="flex flex-col gap-3" style={{ width: "100%" }}>
                                            {group.sortedDates.map((dateKey) => {
                                                const segments = group.segmentsByDate.get(dateKey) || [];
                                                const viewStart = globalView.viewStart;
                                                const viewEnd = globalView.viewEnd;

                                                const labels = renderTimeLabels(segments, viewStart, viewEnd);
                                                const lanesSegments = assignLanes(segments);
                                                const laneCount = Math.max(1, ...lanesSegments.map((s) => s.lane + 1));
                                                const trackHeight = Math.max(48, laneCount * 38 + 10);

                                                const d = new Date(dateKey);
                                                const isSunday = d.getDay() === 0;
                                                const isSaturday = d.getDay() === 6;

                                                const span = Math.max(1, viewEnd - viewStart);
                                                const hourCols = Math.max(1, Math.ceil(span / 60));

                                                return (
                                                    <div
                                                        key={`${groupIdx}-${dateKey}`}
                                                        className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4"
                                                        style={{ width: "100%" }}
                                                    >
                                                        {/* 날짜 */}
                                                        <div
                                                            className={`hidden md:block mt-2.5 text-[14px] font-medium ${
                                                                isSunday
                                                                    ? "text-rose-500"
                                                                    : isSaturday
                                                                    ? "text-blue-500"
                                                                    : "text-slate-700"
                                                            }`}
                                                        >
                                                            {formatKoreanDateLabel(dateKey)}
                                                        </div>

                                                        {/* 트랙 */}
                                                        <div className="flex-1 relative" style={{ minWidth: 0, width: "100%" }}>
                                                            <div
                                                                className="relative border border-gray-300 rounded-lg overflow-visible w-full mt-3 md:mt-3 bg-gray-50"
                                                                style={{
                                                                    width: "100%",
                                                                    height: `${trackHeight}px`,
                                                                }}
                                                            >
                                                                {/* 세로 그리드 */}
                                                                {Array.from({ length: Math.max(0, hourCols - 1) }).map(
                                                                    (_, i) => (
                                                                        <div
                                                                            key={`grid-${dateKey}-${i + 1}`}
                                                                            className="absolute top-0 bottom-0 border-l border-gray-200"
                                                                            style={{
                                                                                left: `${((i + 1) / hourCols) * 100}%`,
                                                                            }}
                                                                        />
                                                                    )
                                                                )}
                                                                {labels.map((label, idx) => (
                                                                    <div
                                                                        key={idx}
                                                                        className="absolute -top-4 text-[11px] font-medium text-gray-500 whitespace-nowrap bg-white px-1 transform -translate-x-1/2"
                                                                        style={{ left: `${label.left}%` }}
                                                                    >
                                                                        {minutesToTopLabel(label.min)}
                                                                    </div>
                                                                ))}

                                                                {/* 세그먼트 */}
                                                                {lanesSegments.map((seg, idx) => {
                                                                    const segStart = Math.max(viewStart, Math.min(viewEnd, seg.startMin));
                                                                    const segEnd = Math.max(viewStart, Math.min(viewEnd, seg.endMin));

                                                                    const left = ((segStart - viewStart) / span) * 100;
                                                                    const width = Math.max(((segEnd - segStart) / span) * 100, 0.5);

                                                                    const color = getTypeColor(seg.type);
                                                                    const laneHeight = 38;
                                                                    const topOffset = 5 + seg.lane * (laneHeight + 6);

                                                                    const showHours = width > 2;
                                                                    const showType = width > 6;
                                                                    const labelText = showType
                                                                        ? `${seg.type} ${toHourStr(seg.totalMin)}h`
                                                                        : `${toHourStr(seg.totalMin)}h`;

                                                                    const segmentKey = `${seg.entryId}-${groupIdx}-${dateKey}-${idx}`;
                                                                    const isSelected = selectedSegmentKeys.has(segmentKey);

                                                                    return (
                                                                        <div
                                                                            key={segmentKey}
                                                                            className={`absolute rounded-md cursor-pointer transition-all ${
                                                                                isSelected
                                                                                    ? "ring-4 ring-blue-500 ring-offset-2"
                                                                                    : "hover:shadow-md hover:z-10"
                                                                            }`}
                                                                            style={{
                                                                                left: `${left}%`,
                                                                                width: `${width}%`,
                                                                                top: `${topOffset}px`,
                                                                                height: `${laneHeight}px`,
                                                                                background: color.bg,
                                                                                border: `2px solid ${isSelected ? "#3b82f6" : color.border}`,
                                                                            }}
                                                                            onClick={() => handleToggleSegment(seg, groupIdx, dateKey, idx)}
                                                                        >
                                                                            {showHours && (
                                                                                <div className="absolute inset-0 flex items-center justify-center px-1 overflow-hidden">
                                                                                    <span
                                                                                        className={`font-semibold truncate ${showType ? "text-[13px]" : "text-[12px]"}`}
                                                                                        style={{ color: color.text ?? "#ffffff" }}
                                                                                    >
                                                                                        {labelText}
                                                                                    </span>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                            </div>
                        ))}
                    </div>
                )}

                {viewMode === "card" && displayEntries.length === 0 && (
                    <div className="text-center text-gray-500 py-8">
                        복사할 카드가 없습니다.
                    </div>
                )}

                {viewMode === "timeline" && overallGroups.length === 0 && (
                    <div className="text-center text-gray-500 py-8">
                        복사할 타임라인이 없습니다.
                    </div>
                )}

                {/* Floating Action Button: 복사 버튼 */}
                <div className="fixed bottom-6 right-6 z-[10001]">
                    <Button
                        variant="primary"
                        size="lg"
                        onClick={handleCopy}
                        disabled={!targetDate || selectedCount === 0}
                        icon={<IconPlus />}
                        className="shadow-lg rounded-full h-14 px-5"
                    >
                        복사 ({selectedCount})
                    </Button>
                </div>
            </div>
        </BaseModal>
    );
}
