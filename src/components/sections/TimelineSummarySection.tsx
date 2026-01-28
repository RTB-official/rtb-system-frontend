// src/components/sections/TimelineSummarySection.tsx
import { Fragment, useMemo, useState } from "react";
import { useWorkReportStore } from "../../store/workReportStore";

// 분 → 시간 문자열 (0.5시간 단위)
const toHourStr = (minutes: number): string => {
    const h = Math.round(Math.max(0, minutes) / 6) / 10;
    return Number.isInteger(h) ? String(h) : h.toFixed(1);
};

// 분 → 시:분 표시
const minutesToLabel = (min: number): string => {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m === 0 ? `${h}` : `${h}:${String(m).padStart(2, "0")}`;
};

// ✅ 타임라인 상단 라벨용 (30분이면 "n시반")
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

// ✅ 작업시간 표기용: 09~22 / 09:30~22:00 형태
const minutesToRangeLabel = (minStart: number, minEnd: number): string => {
    const fmt = (m: number) => {
        const h = Math.floor(m / 60);
        const mm = m % 60;
        if (mm === 0) return String(h).padStart(2, "0");
        return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
    };
    return `${fmt(minStart)}~${fmt(minEnd)}`;
};

// 날짜별로 엔트리 분해
interface DaySegment {
    dateKey: string;
    startMin: number;
    endMin: number;
    type: string;
    title: string;
    persons: string[];
    totalMin: number; // ✅ "해당 날짜 세그먼트" 기준(점심 반영)
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

    // 한 날짜 세그먼트의 점심 겹침(12:00~13:00) 차감 계산
    const calcLunchDeduct = (segStart: Date, segEnd: Date) => {
        if (entry.descType !== "작업" || entry.noLunch) return 0;

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

// 인원별 일자별 데이터 집계
const aggregatePersonDayData = (entries: any[]) => {
    const dayPersonMap = new Map<
        string,
        { 작업: number; 이동: number; 대기: number }
    >();
    const dates = new Set<string>();
    const persons = new Set<string>();

    entries.forEach((entry) => {
        const segments = splitEntryByDay(entry);
        segments.forEach((seg) => {
            dates.add(seg.dateKey);

            const adjMinutes = seg.totalMin;

            seg.persons.forEach((person) => {
                persons.add(person);
                const key = `${seg.dateKey}|${person}`;
                if (!dayPersonMap.has(key)) {
                    dayPersonMap.set(key, { 작업: 0, 이동: 0, 대기: 0 });
                }
                const rec = dayPersonMap.get(key)!;
                if (seg.type === "작업") rec.작업 += adjMinutes;
                else if (seg.type === "이동") rec.이동 += adjMinutes;
                else if (seg.type === "대기") rec.대기 += adjMinutes;
            });
        });
    });

    return {
        dayPersonData: dayPersonMap,
        allDates: Array.from(dates).sort(),
        allPersons: Array.from(persons).sort((a, b) => a.localeCompare(b, "ko")),
    };
};

// 타입별 색상
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


// 팝오버 컴포넌트
interface PopoverProps {
    segment: DaySegment;
    position: { x: number; y: number };
}

function Popover({ segment, position }: PopoverProps) {
    const hours = toHourStr(segment.totalMin);
    return (
        <div
            className="fixed z-50 bg-white border border-[#e5e7eb] rounded-lg shadow-lg p-3 text-[12px] pointer-events-none max-w-[300px]"
            style={{
                left: Math.min(position.x, window.innerWidth - 320),
                top: Math.max(10, position.y - 80),
            }}
        >
            <p className="font-bold text-[#101828] mb-1">
                {segment.type}({hours}시간) · {segment.title}
            </p>
            <p className="text-[#6a7282] mb-1">
                {segment.dateKey} {minutesToLabel(segment.startMin)}시 ~{" "}
                {minutesToLabel(segment.endMin)}시
            </p>
            <p className="text-[#6a7282]">
                {segment.persons.join(", ")} ({segment.persons.length}명)
            </p>
        </div>
    );
}

// ✅ "같이 움직인 사람들" 기준으로 날짜별 그룹 생성
type OverallTimelineGroup = {
    signature: string;
    persons: string[];
    segmentsByDate: Map<string, DaySegment[]>;
    sortedDates: string[];
};

// ✅ "전체 기간" 기준으로 같이 움직인 사람들 그룹화
const buildTimelineGroupsOverall = (entries: any[]) => {
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

interface TimelineSummarySectionProps {
    onDraftSave?: () => void;
    onSubmit?: () => void;

    // ✅ PDF에서만 작업시간(09~22 / 09:30~22:00) 표시 여부
    showWorkTimeRange?: boolean;
}

export default function TimelineSummarySection({
    onDraftSave: _onDraftSave,
    onSubmit: _onSubmit,
    showWorkTimeRange = false,
}: TimelineSummarySectionProps) {
    const { workLogEntries } = useWorkReportStore();

    const [hoveredSegment, setHoveredSegment] = useState<{
        segment: DaySegment;
        position: { x: number; y: number };
    } | null>(null);

    // ✅ 전체 기간 기준 "같이 움직인 사람들" 그룹
    const overallGroups = useMemo(() => {
        return buildTimelineGroupsOverall(workLogEntries);
    }, [workLogEntries]);

    // 인원별 일자별 집계 데이터
    const { dayPersonData, allDates, allPersons } = useMemo(
        () => aggregatePersonDayData(workLogEntries),
        [workLogEntries]
    );

    // ✅ (날짜|인원)별 작업시간 범위: 작업 세그먼트의 시작~끝
    const workTimeRangeMap = useMemo(() => {
        const map = new Map<string, { minStart: number; maxEnd: number }>();

        workLogEntries.forEach((entry: any) => {
            const segs = splitEntryByDay(entry);

            segs.forEach((s) => {
                if (s.type !== "작업") return;

                s.persons.forEach((p) => {
                    const key = `${s.dateKey}|${p}`;
                    const prev = map.get(key);

                    if (!prev) {
                        map.set(key, { minStart: s.startMin, maxEnd: s.endMin });
                    } else {
                        map.set(key, {
                            minStart: Math.min(prev.minStart, s.startMin),
                            maxEnd: Math.max(prev.maxEnd, s.endMin),
                        });
                    }
                });
            });
        });

        return map;
    }, [workLogEntries]);

    // ✅ 전체(이동/작업/대기)에서 가장 빠른 시작 ~ 가장 늦은 종료로 축 통일 + 앞뒤 2시간 여백
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

// ✅ "대기"가 1분이라도 있는 사람만 대기 컬럼 노출
const waitPersonSet = useMemo(() => {
    const set = new Set<string>();
    dayPersonData.forEach((rec, key) => {
        if ((rec.대기 || 0) > 0) {
            const person = key.split("|")[1];
            if (person) set.add(person);
        }
    });
    return set;
}, [dayPersonData]);

// ✅ 인원 3명 단위로 테이블 분할
const personChunks = useMemo(() => {
    const chunks: string[][] = [];
    for (let i = 0; i < allPersons.length; i += 3) {
        chunks.push(allPersons.slice(i, i + 3));
    }
    return chunks;
}, [allPersons]);

    if (overallGroups.length === 0) {
        return (
            <div className="bg-white p-4 md:p-7" style={{ width: "100%" }}>
                <h2 className="text-[18px] md:text-[22px] font-semibold text-[#364153] mb-4">
                    타임라인
                </h2>
                <p className="text-[#99a1af] text-center py-8">
                    저장된 스케줄이 없습니다.
                </p>
            </div>
        );
    }

    // 시간 라벨 렌더링 (겹치지 않게) - ✅ 화면 표시 범위(viewStart~viewEnd) 기준
    const renderTimeLabels = (segments: DaySegment[], viewStart: number, viewEnd: number) => {
        const usedPositions = new Set<number>();
        const labels: { min: number; left: number; isStart: boolean }[] = [];

        const span = Math.max(1, viewEnd - viewStart);

        const toLeftPct = (min: number) => {
            const clamped = Math.max(viewStart, Math.min(viewEnd, min));
            return ((clamped - viewStart) / span) * 100;
        };

        segments.forEach((seg) => {
            const startKey = Math.round((seg.startMin - viewStart) / 30);
            const endKey = Math.round((seg.endMin - viewStart) / 30);

            if (!usedPositions.has(startKey)) {
                usedPositions.add(startKey);
                labels.push({ min: seg.startMin, left: toLeftPct(seg.startMin), isStart: true });
            }
            if (!usedPositions.has(endKey)) {
                usedPositions.add(endKey);
                labels.push({ min: seg.endMin, left: toLeftPct(seg.endMin), isStart: false });
            }
        });

        return labels;
    };

    // 겹치는 세그먼트를 레인으로 분배
    const assignLanes = (segs: DaySegment[]): (DaySegment & { lane: number })[] => {
        const sorted = [...segs].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
        const lanes: number[] = [];

        return sorted.map((seg) => {
            let assignedLane = lanes.findIndex((endTime) => endTime <= seg.startMin);
            if (assignedLane === -1) {
                assignedLane = lanes.length;
                lanes.push(seg.endMin);
            } else {
                lanes[assignedLane] = seg.endMin;
            }
            return { ...seg, lane: assignedLane };
        });
    };

    return (
        <div className="bg-white" style={{ width: "100%", maxWidth: "100%", boxSizing: "border-box" }}>
            {/* 그룹별 타임라인 */}
            <div className="flex flex-col gap-8" style={{ width: "100%" }}>
                {overallGroups.map((group, groupIdx) => {
                    return (
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
                                            className="flex items-center gap-4"
                                            style={{ width: "100%" }}
                                        >
                                            {/* 날짜 */}
                                            <div
                                                className={`mt-2.5 text-[14px] font-medium ${
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
                                            <div className="flex-1" style={{ minWidth: 0, width: "100%" }}>
                                                <div
                                                    className="relative border border-gray-300 rounded-lg overflow-visible w-full mt-3 bg-gray-50"
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

                                                        return (
                                                            <div
                                                                key={`${seg.entryId}-${groupIdx}-${dateKey}-${idx}`}
                                                                className="absolute rounded-md cursor-pointer transition-colors hover:shadow-md hover:z-10"
                                                                style={{
                                                                    left: `${left}%`,
                                                                    width: `${width}%`,
                                                                    top: `${topOffset}px`,
                                                                    height: `${laneHeight}px`,
                                                                    background: color.bg,
                                                                    border: `1px solid ${color.border}`,
                                                                }}
                                                                onMouseEnter={(e) =>
                                                                    setHoveredSegment({
                                                                        segment: seg,
                                                                        position: { x: e.clientX, y: e.clientY },
                                                                    })
                                                                }
                                                                onMouseLeave={() => setHoveredSegment(null)}
                                                                onMouseMove={(e) => {
                                                                    if (hoveredSegment) {
                                                                        setHoveredSegment({
                                                                            segment: seg,
                                                                            position: { x: e.clientX, y: e.clientY },
                                                                        });
                                                                    }
                                                                }}
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
                    );
                })}
            </div>

            {/* 일별 시간표 */}
            {allPersons.length > 0 && (
                <div className="mt-8 daily-timesheet" style={{ width: "100%" }}>
                    <div className="flex items-center justify-between mb-4" style={{ width: "100%" }}>
                        <h3 className="text-[16px] md:text-[18px] font-semibold text-[#364153]">
                            일별 시간표
                        </h3>
                        </div>

                    {/* ✅ 4명 단위로 표 여러 개 */}
                    <div className="flex flex-col gap-6" style={{ width: "100%" }}>
                        {personChunks.map((chunkPersons, chunkIdx) => (
                            <div
                            key={`person-chunk-${chunkIdx}`}
                            className="overflow-x-auto rounded-xl border border-gray-300 w-fit max-w-full"
                        >

<table className="w-full text-[13px] border-collapse" style={{ width: "100%" }}>
                                    <thead>
                                        {/* 1줄: 날짜 + 사람(3칸 합치기) */}
                                        <tr className="bg-white">
                                        <th
                                        rowSpan={2}
                                        className="px-1 py-2 text-center font-bold text-slate-700 border-b border-gray-300 border-r border-r-gray-300 w-[56px] min-w-[56px] sticky left-0 bg-white whitespace-nowrap"
                                    >
                                        날짜
                                    </th>


                                            {chunkPersons.map((person, idx) => {
                                            const showWait = waitPersonSet.has(person);
                                            return (
                                            <th
                                                key={person}
                                                colSpan={showWait ? (showWorkTimeRange ? 4 : 3) : (showWorkTimeRange ? 3 : 2)}
                                                className={`px-3 py-2 text-center border-b border-gray-300 min-w-[280px] bg-white ${
                                                    idx > 0 ? "border-l border-l-gray-300" : ""
                                                }`}
                                            >
                                                <span className="text-[14px] font-bold text-slate-700">{person}</span>
                                            </th>

                                            );
                                        })}
                                        </tr>

                                            {/* 2줄: 사람 아래 세부항목 */}
                                            <tr className="bg-white">
                                            {chunkPersons.map((person, idx) => {
                                            const showWait = waitPersonSet.has(person);
                                            return (
                                                <Fragment key={`${person}-sub`}>
                                                    <th
                                                        className={`px-2 py-2 text-center border-b border-gray-300 text-[14px] text-slate-600 bg-white ${
                                                            idx > 0 ? "border-l border-l-gray-300" : ""
                                                        }`}
                                                    >
                                                        작업
                                                    </th>
                                                    {showWorkTimeRange && (
                                                        <th className="px-2 py-2 text-center border-b border-gray-300 text-[14px] text-slate-600 bg-white">
                                                            작업시간
                                                        </th>
                                                    )}
                                                    <th className="px-2 py-2 text-center border-b border-gray-300 text-[14px] text-slate-600 bg-white">
                                                        이동
                                                    </th>
                                                    {showWait && (
                                                        <th className="px-2 py-2 text-center border-b border-gray-300 text-[14px] text-slate-600 bg-white">
                                                            대기
                                                        </th>
                                                    )}
                                                </Fragment>
                                            );
                                        })}
                                    </tr>

                                    </thead>

                                    <tbody>
                                        {allDates.map((date, dateIdx) => {
                                            const d = new Date(date);
                                            const weekday = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
                                            const isSunday = d.getDay() === 0;
                                            const isSaturday = d.getDay() === 6;

                                            return (
                                                <tr
                                                    key={date}
                                                    className={`${
                                                        dateIdx % 2 === 0 ? "bg-white" : "bg-slate-50"
                                                    } hover:bg-blue-50 transition-all`}
                                                >
                                                        {/* 날짜 셀 */}
                                                    <td
                                                        className={`px-1 py-2 font-bold text-slate-800 border-b border-gray-300 border-r border-r-gray-300 sticky left-0 whitespace-nowrap w-[56px] min-w-[56px] text-center ${
                                                            dateIdx % 2 === 0 ? "bg-white" : "bg-slate-50"
                                                        }`}
                                                    >
                                                        <div className="flex flex-col items-center">

                                                            <span
                                                                className={`text-[14px] font-extrabold ${
                                                                    isSunday
                                                                        ? "text-rose-500"
                                                                        : isSaturday
                                                                        ? "text-blue-500"
                                                                        : "text-slate-700"
                                                                }`}
                                                            >
                                                                {d.getMonth() + 1}/{d.getDate()}
                                                            </span>
                                                            <span
                                                                className={`text-[11px] font-semibold ${
                                                                    isSunday
                                                                        ? "text-rose-400"
                                                                        : isSaturday
                                                                        ? "text-blue-400"
                                                                        : "text-slate-400"
                                                                }`}
                                                            >
                                                                ({weekday})
                                                            </span>
                                                        </div>
                                                    </td>

                                                    {/* 사람별: 3칸(이동/작업/작업시간) */}
                                                    {chunkPersons.map((person, idx) => {
                                                        const key = `${date}|${person}`;
                                                        const rec = dayPersonData.get(key) || {
                                                            작업: 0,
                                                            이동: 0,
                                                            대기: 0,
                                                        };

                                                        const range = workTimeRangeMap.get(`${date}|${person}`);

                                                        const moveStr = rec.이동 > 0 ? toHourStr(rec.이동) : "-";
                                                        const workStr = rec.작업 > 0 ? toHourStr(rec.작업) : "-";
                                                        const waitStr = rec.대기 > 0 ? toHourStr(rec.대기) : "";
                                                        const timeStr =
                                                            range && rec.작업 > 0
                                                                ? minutesToRangeLabel(range.minStart, range.maxEnd)
                                                                : "-";


                                                        const personLeftBorder =
                                                            idx > 0 ? "border-l border-l-gray-300" : "";
                                                            const showWait = waitPersonSet.has(person);
                                                            return (
                                                                <Fragment key={`${date}-${person}`}>
                                                                    {/* 작업 */}
                                                                    
                                                                    <td className={`px-2 py-2 border-b border-gray-300 ${personLeftBorder} bg-blue-50 text-center`}>
                                                                <span className="text-[16px] font-bold text-blue-700">
                                                                    {workStr}
                                                                </span>
                                                                    </td>
                                                            
                                                                    {/* 작업시간 */}
                                                                    {showWorkTimeRange && (
                                                                        <td className="px-2 py-2 border-b border-gray-300 bg-slate-50 text-center">
                                                                            <span className="text-[16px] font-semibold text-slate-700">
                                                                                {timeStr}
                                                                            </span>
                                                                        </td>
                                                                    )}
                                                            
                                                                    {/* 이동 */}
                                                                    <td className="px-2 py-2 border-b border-gray-300 bg-emerald-50 text-center">
                                                                        <span className="text-[16px] font-bold text-emerald-700">
                                                                            {moveStr}
                                                                        </span>
                                                                    </td>
                                                            
                                                            {/* 대기 (해당 사람이 대기 0이면 컬럼 자체 생략) */}
                                                            {showWait && (
                                                                <td className="px-2 py-2 border-b border-gray-300 bg-amber-50 text-center">
                                                                    <span className="text-[16px] font-bold text-amber-700">
                                                                        {waitStr || "-"}
                                                                    </span>
                                                                </td>
                                                            )}
                                                                </Fragment>
                                                            );
                                                            
                                                    })}
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bg-white">
                                            <td className="px-1 py-2 font-bold text-slate-800 border-t-0 border-gray-300 border-r border-r-gray-300 sticky left-0 bg-white text-center">
                                                합계
                                            </td>
                                            {chunkPersons.map((person, idx) => {
                                                const personLeftBorder =
                                                    idx > 0 ? "border-l border-l-gray-300" : "";
                                                const showWait = waitPersonSet.has(person);
                                                let totalWork = 0;
                                                let totalMove = 0;
                                                let totalWait = 0;
                                                allDates.forEach((date) => {
                                                    const rec = dayPersonData.get(`${date}|${person}`);
                                                    if (rec) {
                                                        totalWork += rec.작업 || 0;
                                                        totalMove += rec.이동 || 0;
                                                        totalWait += rec.대기 || 0;
                                                    }
                                                });
                                                const totalWorkStr = totalWork > 0 ? toHourStr(totalWork) : "-";
                                                const totalMoveStr = totalMove > 0 ? toHourStr(totalMove) : "-";
                                                const totalWaitStr = totalWait > 0 ? toHourStr(totalWait) : "";

                                                return (
                                                    <Fragment key={`total-${person}`}>
                                                        <td className={`px-2 py-2 border-t-0 border-gray-300 ${personLeftBorder} bg-blue-50 text-center`}>
                                                            <span className="text-[16px] font-bold text-blue-700">
                                                                {totalWorkStr}
                                                            </span>
                                                        </td>
                                                        {showWorkTimeRange && (
                                                            <td className="px-2 py-2 border-t-0 border-gray-300 bg-slate-50 text-center">
                                                                <span className="text-[16px] font-semibold text-slate-700">
                                                                    -
                                                                </span>
                                                            </td>
                                                        )}
                                                        <td className="px-2 py-2 border-t-0 border-gray-300 bg-emerald-50 text-center">
                                                            <span className="text-[16px] font-bold text-emerald-700">
                                                                {totalMoveStr}
                                                            </span>
                                                        </td>
                                                        {showWait && (
                                                            <td className="px-2 py-2 border-t-0 border-gray-300 bg-amber-50 text-center">
                                                                <span className="text-[16px] font-bold text-amber-700">
                                                                    {totalWaitStr || "-"}
                                                                </span>
                                                            </td>
                                                        )}
                                                    </Fragment>
                                                );
                                            })}
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 팝오버 */}
            {hoveredSegment && (
                <Popover
                    segment={hoveredSegment.segment}
                    position={hoveredSegment.position}
                />
            )}
        </div>
    );
}
