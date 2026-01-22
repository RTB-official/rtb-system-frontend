// src/components/sections/TimelineSummarySection.tsx
import { useMemo, useState } from "react";
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

        // 겹치는 분(min)
        const overlapMs =
            Math.min(segEnd.getTime(), lunchEnd.getTime()) -
            Math.max(segStart.getTime(), lunchStart.getTime());
        const overlapMin = Math.max(0, Math.round(overlapMs / 60000));
        return Math.min(60, overlapMin); // 최대 60분
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

        // 분 계산 (하루 내)
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
                Math.min(
                    1440,
                    Math.round((dt.getTime() - base.getTime()) / 60000)
                )
            );
        };

        const startMin = minutesFromDayStart(segStart);
        const endMin =
            segStart.getDate() === segEnd.getDate()
                ? minutesFromDayStart(segEnd)
                : 1440; // 자정까지

        // ✅ 해당 날짜 세그먼트 길이(점심 반영)
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

            // ✅ splitEntryByDay에서 이미 점심 차감된 totalMin 사용
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
        allPersons: Array.from(persons).sort((a, b) =>
            a.localeCompare(b, "ko")
        ),
    };
};

// 타입별 색상
const getTypeColor = (type: string) => {
    switch (type) {
        case "작업":
            return { bg: "#3b82f6", bgDark: "#2563eb", border: "#1d4ed8" };
        case "이동":
            return { bg: "#10b981", bgDark: "#059669", border: "#047857" };
        case "대기":
            return { bg: "#f59e0b", bgDark: "#d97706", border: "#b45309" };
        default:
            return { bg: "#9ca3af", bgDark: "#6b7280", border: "#4b5563" };
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
// - 사람별로 세그먼트를 분해
// - 각 사람의 세그먼트 목록(시간/타입/타이틀)을 시그니처로 만들고
// - 시그니처가 같은 사람들끼리 묶음
type OverallTimelineGroup = {
    signature: string;
    persons: string[];
    // 그룹 공통 타임라인을 날짜별로 렌더링 하기 위해
    segmentsByDate: Map<string, DaySegment[]>;
    sortedDates: string[];
};

// ✅ "전체 기간" 기준으로 같이 움직인 사람들 그룹화
// - 사람별로 전체 세그먼트를 모으고(날짜 포함)
// - (dateKey + start/end/type/title) 시퀀스가 완전히 동일한 사람들끼리만 묶음
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

    // signature -> group
    const sigToGroup = new Map<string, OverallTimelineGroup>();

    for (const [person, segs] of personToSegs.entries()) {
        const sorted = [...segs].sort((a, b) => {
            // ✅ "전체" 비교라 dateKey가 가장 중요
            return (
                a.dateKey.localeCompare(b.dateKey) ||
                a.startMin - b.startMin ||
                a.endMin - b.endMin ||
                a.type.localeCompare(b.type) ||
                a.title.localeCompare(b.title)
            );
        });

        // ✅ dateKey 포함 시그니처
        const signature = sorted
            .map(
                (s) =>
                    `${s.dateKey}-${s.startMin}-${s.endMin}-${s.type}-${s.title}`
            )
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

    // 그룹별로 대표 타임라인(segmentsByDate) 구성
    // 대표 타임라인은 "그 그룹의 첫 번째 사람"의 세그먼트를 사용
    // (어차피 시그니처가 같으면 전부 동일)
    const groups = Array.from(sigToGroup.values()).map((g) => {
        const personsSorted = Array.from(new Set(g.persons)).sort((a, b) =>
            a.localeCompare(b, "ko")
        );

        // 대표 사람
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
            if (!segmentsByDate.has(seg.dateKey))
                segmentsByDate.set(seg.dateKey, []);
            segmentsByDate.get(seg.dateKey)!.push({
                ...seg,
                persons: personsSorted, // ✅ 렌더/팝오버용: 그룹 사람들
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

    // 보기 좋게 그룹 정렬(인원 많은 순 -> 이름순)
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
}

export default function TimelineSummarySection({
    onDraftSave: _onDraftSave,
    onSubmit: _onSubmit,
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

    // 날짜별 대기 존재 여부
    const hasWaitByDate = useMemo(() => {
        const map = new Map<string, boolean>();
        dayPersonData.forEach((rec, key) => {
            const [dateKey] = key.split("|");
            if (rec.대기 > 0) map.set(dateKey, true);
        });
        return map;
    }, [dayPersonData]);

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

    // 시간 라벨 렌더링 (겹치지 않게)
    const renderTimeLabels = (segments: DaySegment[]) => {
        const usedPositions = new Set<number>();
        const labels: { min: number; left: number; isStart: boolean }[] = [];

        segments.forEach((seg) => {
            const startKey = Math.round(seg.startMin / 30);
            const endKey = Math.round(seg.endMin / 30);

            if (!usedPositions.has(startKey)) {
                usedPositions.add(startKey);
                labels.push({
                    min: seg.startMin,
                    left: (seg.startMin / 1440) * 100,
                    isStart: true,
                });
            }
            if (!usedPositions.has(endKey)) {
                usedPositions.add(endKey);
                labels.push({
                    min: seg.endMin,
                    left: (seg.endMin / 1440) * 100,
                    isStart: false,
                });
            }
        });

        return labels;
    };

    // 겹치는 세그먼트를 레인으로 분배
    const assignLanes = (
        segs: DaySegment[]
    ): (DaySegment & { lane: number })[] => {
        const sorted = [...segs].sort(
            (a, b) => a.startMin - b.startMin || a.endMin - b.endMin
        );
        const lanes: number[] = []; // 각 레인의 종료 시간

        return sorted.map((seg) => {
            let assignedLane = lanes.findIndex(
                (endTime) => endTime <= seg.startMin
            );
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
            {/* 타임라인 */}
            <h2 className="text-[18px] md:text-[22px] font-semibold text-[#364153] mb-4">
                타임라인
            </h2>

            {/* 범례 */}
            <div className="flex flex-wrap gap-4 mb-6 text-[12px] text-[#6a7282]">
                <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-[#3b82f6]"></span>{" "}
                    작업
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-[#10b981]"></span>{" "}
                    이동
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-[#f59e0b]"></span>{" "}
                    대기
                </span>
            </div>

            {/* 그룹별 타임라인 (전체 기준으로 같은 사람끼리 묶임) */}
            <div className="flex flex-col gap-8" style={{ width: "100%" }}>
                {overallGroups.map((group, groupIdx) => {
                    return (
                        <div
                            key={`overall-group-${groupIdx}`}
                            className="p-4"
                            style={{ width: "100%" }}
                        >
                            {/* 그룹 라벨 */}
                            <div className="flex items-center justify-between gap-3 mb-3">
                                <div className="text-[14px] font-semibold text-slate-800">
                                    {group.persons.join(", ")} (
                                    {group.persons.length}명)
                                </div>
                                <div className="text-[12px] text-slate-400"></div>
                            </div>

                            {/* 그룹 내 날짜별 타임라인 */}
                            <div className="flex flex-col gap-6" style={{ width: "100%" }}>
                                {group.sortedDates.map((dateKey) => {
                                    const segments =
                                        group.segmentsByDate.get(dateKey) || [];
                                    const labels = renderTimeLabels(segments);

                                    const lanesSegments = assignLanes(segments);
                                    const laneCount = Math.max(
                                        1,
                                        ...lanesSegments.map((s) => s.lane + 1)
                                    );
                                    const trackHeight = Math.max(
                                        36,
                                        laneCount * 32 + 8
                                    );

                                    // 날짜 포맷팅
                                    const d = new Date(dateKey);
                                    const isSunday = d.getDay() === 0;
                                    const isSaturday = d.getDay() === 6;


                                    return (
                                        <div
                                            key={`${groupIdx}-${dateKey}`}
                                            className="flex items-start gap-3"
                                            style={{ width: "100%" }}
                                        >
                                            {/* ✅ 날짜 (막대 왼쪽, M/D) */}
                                            <div
                                                className={`w-[44px] shrink-0 text-[14px] font-semibold leading-[28px] pt-[18px] ${
                                                    isSunday
                                                        ? "text-rose-500"
                                                        : isSaturday
                                                        ? "text-blue-500"
                                                        : "text-slate-700"
                                                }`}
                                            >
                                                {d.getMonth() + 1}/{d.getDate()}
                                            </div>


                                            {/* ✅ 트랙 영역 */}
                                            <div className="flex-1" style={{ minWidth: 0, width: "100%" }}>
                                                <div
                                                    className="relative border border-[#e5e7eb] rounded-xl overflow-visible w-full mt-5"
                                                    style={{
                                                        width: "100%",
                                                        height: `${trackHeight}px`,
                                                        background: `
                                            linear-gradient(90deg, rgba(17,24,39,0.04) 1px, transparent 1px) 0 0 / calc(100%/24) 100%,
                                            linear-gradient(to bottom, #f8fafc, #fff)
                                          `,
                                                    }}
                                                >
                                                    {/* 시간 라벨 */}
                                                    {labels.map(
                                                        (label, idx) => (
                                                            <div
                                                                key={idx}
                                                                className={`absolute -top-5 text-[10px] text-slate-500 font-medium whitespace-nowrap ${
                                                                    label.isStart
                                                                        ? ""
                                                                        : "transform -translate-x-full"
                                                                }`}
                                                                style={{
                                                                    left: `${label.left}%`,
                                                                }}
                                                            >
                                                                {minutesToLabel(
                                                                    label.min
                                                                )}
                                                                시
                                                            </div>
                                                        )
                                                    )}

                                                    {/* 세그먼트 */}
                                                    {lanesSegments.map(
                                                        (seg, idx) => {
                                                            const left =
                                                                (seg.startMin /
                                                                    1440) *
                                                                100;
                                                            const width =
                                                                Math.max(
                                                                    ((seg.endMin -
                                                                        seg.startMin) /
                                                                        1440) *
                                                                        100,
                                                                    0.5
                                                                );
                                                            const color =
                                                                getTypeColor(
                                                                    seg.type
                                                                );
                                                            const laneHeight = 28;
                                                            const topOffset =
                                                                4 +
                                                                seg.lane *
                                                                    (laneHeight +
                                                                        4);

                                                            return (
                                                                <div
                                                                    key={`${seg.entryId}-${groupIdx}-${dateKey}-${idx}`}
                                                                    className="absolute rounded-lg cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg hover:z-10"
                                                                    style={{
                                                                        left: `${left}%`,
                                                                        width: `${width}%`,
                                                                        top: `${topOffset}px`,
                                                                        height: `${laneHeight}px`,
                                                                        background: `linear-gradient(135deg, ${color.bg} 0%, ${color.bgDark} 100%)`,
                                                                        border: `1px solid ${color.border}`,
                                                                        boxShadow:
                                                                            "0 2px 4px rgba(0,0,0,0.1)",
                                                                    }}
                                                                    onMouseEnter={(
                                                                        e
                                                                    ) =>
                                                                        setHoveredSegment(
                                                                            {
                                                                                segment:
                                                                                    seg,
                                                                                position:
                                                                                    {
                                                                                        x: e.clientX,
                                                                                        y: e.clientY,
                                                                                    },
                                                                            }
                                                                        )
                                                                    }
                                                                    onMouseLeave={() =>
                                                                        setHoveredSegment(
                                                                            null
                                                                        )
                                                                    }
                                                                    onMouseMove={(
                                                                        e
                                                                    ) => {
                                                                        if (
                                                                            hoveredSegment
                                                                        ) {
                                                                            setHoveredSegment(
                                                                                {
                                                                                    segment:
                                                                                        seg,
                                                                                    position:
                                                                                        {
                                                                                            x: e.clientX,
                                                                                            y: e.clientY,
                                                                                        },
                                                                                }
                                                                            );
                                                                        }
                                                                    }}
                                                                >
                                                                    {width >
                                                                        6 && (
                                                                        <div className="absolute inset-0 flex items-center justify-center px-2 overflow-hidden">
                                                                            <span className="text-[11px] font-semibold text-white truncate drop-shadow-sm">
                                                                                {
                                                                                    seg.type
                                                                                }{" "}
                                                                                {toHourStr(
                                                                                    seg.totalMin
                                                                                )}

                                                                                h
                                                                            </span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        }
                                                    )}
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

            {/* 작업자별 일자 요약 테이블 */}
            {allPersons.length > 0 && (
                <div className="mt-8" style={{ width: "100%" }}>
                    <div className="flex items-center justify-between mb-4" style={{ width: "100%" }}>
                        <h3 className="text-[16px] md:text-[18px] font-semibold text-[#364153]">
                            일별 시간표
                        </h3>
                        <div className="flex items-center gap-1 text-[11px] text-[#6a7282]">
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded">
                                이동
                            </span>
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                                작업
                            </span>
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded">
                                대기
                            </span>
                        </div>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm" style={{ width: "100%" }}>
                        <table className="w-full text-[13px]" style={{ width: "100%" }}>
                            <thead>
                                <tr className="bg-gradient-to-r from-slate-100 to-slate-50">
                                    <th className="px-4 py-3 text-left font-semibold text-slate-700 border-b border-slate-200 min-w-[100px] sticky left-0 bg-gradient-to-r from-slate-100 to-slate-50">
                                        작업자
                                    </th>
                                    {allDates.map((date, idx) => {
                                        const d = new Date(date);
                                        const weekday = [
                                            "일",
                                            "월",
                                            "화",
                                            "수",
                                            "목",
                                            "금",
                                            "토",
                                        ][d.getDay()];
                                        const isSunday = d.getDay() === 0;
                                        const isSaturday = d.getDay() === 6;
                                        
                                        return (
                                            <th
                                                key={date}
                                                className={`px-3 py-2 text-center border-b border-slate-200 min-w-[140px] ${
                                                    idx > 0
                                                        ? "border-l-2 border-l-rose-300"
                                                        : ""
                                                }`}
                                            >
                                                <div className="flex flex-col items-center">
                                                <span
                                                        className={`text-[14px] font-bold ${
                                                            isSunday
                                                                ? "text-rose-500"
                                                                : isSaturday
                                                                ? "text-blue-500"
                                                                : "text-slate-700"
                                                        }`}
                                                    >
                                                        {d.getMonth() + 1}/
                                                        {d.getDate()}
                                                    </span>
                                                    <span
                                                            className={`text-[11px] ${
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
                                            </th>
                                        );
                                    })}
                                </tr>
                            </thead>
                            <tbody>
                                {allPersons.map((person, personIdx) => {
                                    return (
                                        <tr
                                            key={person}
                                            className={`${
                                                personIdx % 2 === 0
                                                    ? "bg-white"
                                                    : "bg-slate-50"
                                            } hover:bg-blue-50 transition-all`}
                                        >
                                            <td
                                                className={`px-4 py-3 font-semibold text-slate-800 border-b border-slate-100 sticky left-0 ${
                                                    personIdx % 2 === 0
                                                        ? "bg-white"
                                                        : "bg-slate-50"
                                                }`}
                                            >
                                                {person}
                                            </td>
                                            {allDates.map((date, idx) => {
                                                const key = `${date}|${person}`;
                                                const rec = dayPersonData.get(
                                                    key
                                                ) || {
                                                    작업: 0,
                                                    이동: 0,
                                                    대기: 0,
                                                };
                                                const showWait =
                                                    hasWaitByDate.get(date);
                                                const hasData =
                                                    rec.이동 > 0 ||
                                                    rec.작업 > 0 ||
                                                    rec.대기 > 0;

                                                return (
                                                    <td
                                                        key={date}
                                                        className={`px-2 py-2 border-b border-slate-100 ${
                                                            idx > 0
                                                                ? "border-l-2 border-l-rose-300"
                                                                : ""
                                                        }`}
                                                    >
                                                        {hasData ? (
                                                            <div
                                                                className={`grid ${
                                                                    showWait
                                                                        ? "grid-cols-3"
                                                                        : "grid-cols-2"
                                                                } gap-1`}
                                                            >
                                                                <div className="flex flex-col items-center p-1.5 bg-emerald-50 rounded-lg">
                                                                    <span className="text-[10px] text-emerald-600 font-medium">
                                                                        이동
                                                                    </span>
                                                                    <span className="text-[14px] font-bold text-emerald-700">
                                                                        {toHourStr(
                                                                            rec.이동
                                                                        )}
                                                                    </span>
                                                                </div>
                                                                <div className="flex flex-col items-center p-1.5 bg-blue-50 rounded-lg">
                                                                    <span className="text-[10px] text-blue-500 font-medium">
                                                                        작업
                                                                    </span>
                                                                    <span className="text-[14px] font-bold text-blue-600">
                                                                        {toHourStr(
                                                                            rec.작업
                                                                        )}
                                                                    </span>
                                                                </div>
                                                                {showWait && (
                                                                    <div className="flex flex-col items-center p-1.5 bg-amber-50 rounded-lg">
                                                                        <span className="text-[10px] text-amber-600 font-medium">
                                                                            대기
                                                                        </span>
                                                                        <span className="text-[14px] font-bold text-amber-700">
                                                                            {toHourStr(
                                                                                rec.대기
                                                                            )}
                                                                        </span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <div className="text-center text-slate-300 text-[12px] py-2">
                                                                -
                                                            </div>
                                                        )}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
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