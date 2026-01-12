import { useMemo, useState } from "react";
import {
    useWorkReportStore,
    calcDurationHours,
    REGION_GROUPS,
} from "../../store/workReportStore";
import Button from "../common/Button";

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

    // 전체 시간 계산 (점심시간 차감 포함)
    let totalMin = Math.round((end.getTime() - start.getTime()) / 60000);
    if (entry.descType === "작업" && !entry.noLunch) {
        // 점심시간 겹침 체크
        const checkLunch = (s: Date, e: Date) => {
            for (let d = new Date(s); d < e; d.setDate(d.getDate() + 1)) {
                const lunchStart = new Date(
                    d.getFullYear(),
                    d.getMonth(),
                    d.getDate(),
                    12,
                    0
                );
                const lunchEnd = new Date(
                    d.getFullYear(),
                    d.getMonth(),
                    d.getDate(),
                    13,
                    0
                );
                if (s < lunchEnd && e > lunchStart) return true;
            }
            return false;
        };
        if (checkLunch(start, end)) totalMin = Math.max(0, totalMin - 60);
    }

    const result: DaySegment[] = [];
    let cur = new Date(start);

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
            const minutes = seg.endMin - seg.startMin;

            // 점심시간 차감
            let adjMinutes = minutes;
            if (seg.type === "작업" && !entry.noLunch) {
                const lunchStart = 12 * 60;
                const lunchEnd = 13 * 60;
                if (seg.startMin < lunchEnd && seg.endMin > lunchStart) {
                    adjMinutes = Math.max(0, minutes - 60);
                }
            }

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

// 인원 → 지역 클래스
const getRegionClass = (name: string) => {
    for (const [key, names] of Object.entries(REGION_GROUPS)) {
        if (names.includes(name)) {
            if (key === "BC") return "bg-blue-50";
            if (key === "UL") return "bg-emerald-50";
            if (key === "JY") return "bg-amber-50";
            if (key === "GJ") return "bg-violet-50";
        }
    }
    return "";
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

interface TimelineSummarySectionProps {
    onDraftSave?: () => void;
    onSubmit?: () => void;
}

export default function TimelineSummarySection({
    onDraftSave,
    onSubmit,
}: TimelineSummarySectionProps) {
    const { workLogEntries } = useWorkReportStore();
    const [hoveredSegment, setHoveredSegment] = useState<{
        segment: DaySegment;
        position: { x: number; y: number };
    } | null>(null);

    // 일별 세그먼트 수집
    const daySegments = useMemo(() => {
        const map = new Map<string, DaySegment[]>();
        workLogEntries.forEach((entry) => {
            const segments = splitEntryByDay(entry);
            segments.forEach((seg) => {
                if (!map.has(seg.dateKey)) map.set(seg.dateKey, []);
                map.get(seg.dateKey)!.push(seg);
            });
        });
        return map;
    }, [workLogEntries]);

    const sortedDates = Array.from(daySegments.keys()).sort();

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

    if (sortedDates.length === 0) {
        return (
            <div className="bg-white border border-[#e5e7eb] rounded-2xl p-4 md:p-7">
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

    return (
        <div className="bg-white border border-[#e5e7eb] rounded-2xl p-4 md:p-7">
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

            {/* 일별 타임라인 */}
            <div className="flex flex-col gap-6">
                {sortedDates.map((dateKey) => {
                    const segments = daySegments.get(dateKey) || [];
                    const labels = renderTimeLabels(segments);

                    // 겹치는 세그먼트를 레인으로 분배
                    const assignLanes = (
                        segs: DaySegment[]
                    ): (DaySegment & { lane: number })[] => {
                        const sorted = [...segs].sort(
                            (a, b) =>
                                a.startMin - b.startMin || a.endMin - b.endMin
                        );
                        const lanes: number[] = []; // 각 레인의 종료 시간

                        return sorted.map((seg) => {
                            // 사용 가능한 레인 찾기
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

                    const lanesSegments = assignLanes(segments);
                    const laneCount = Math.max(
                        1,
                        ...lanesSegments.map((s) => s.lane + 1)
                    );
                    const trackHeight = Math.max(36, laneCount * 32 + 8);

                    // 날짜 포맷팅
                    const d = new Date(dateKey);
                    const weekday = ["일", "월", "화", "수", "목", "금", "토"][
                        d.getDay()
                    ];
                    const isWeekend = d.getDay() === 0 || d.getDay() === 6;

                    return (
                        <div key={dateKey} className="flex flex-col gap-1">
                            {/* 날짜 라벨 - 상단 좌측 */}
                            <div className="flex items-center gap-2 mb-1">
                                <span
                                    className={`text-[14px] font-semibold ${
                                        isWeekend
                                            ? "text-rose-500"
                                            : "text-slate-700"
                                    }`}
                                >
                                    {dateKey}
                                </span>
                                <span
                                    className={`text-[12px] ${
                                        isWeekend
                                            ? "text-rose-400"
                                            : "text-slate-400"
                                    }`}
                                >
                                    ({weekday})
                                </span>
                            </div>

                            {/* 트랙 - 전체 너비 사용 */}
                            <div
                                className="relative border border-[#e5e7eb] rounded-xl overflow-visible w-full mt-5"
                                style={{
                                    height: `${trackHeight}px`,
                                    background: `
                    linear-gradient(90deg, rgba(17,24,39,0.04) 1px, transparent 1px) 0 0 / calc(100%/24) 100%,
                    linear-gradient(to bottom, #f8fafc, #fff)
                  `,
                                }}
                            >
                                {/* 시간 라벨 - 카드 시작/종료 시간만 표시 */}
                                {labels.map((label, idx) => (
                                    <div
                                        key={idx}
                                        className={`absolute -top-5 text-[10px] text-slate-500 font-medium whitespace-nowrap ${
                                            label.isStart
                                                ? ""
                                                : "transform -translate-x-full"
                                        }`}
                                        style={{ left: `${label.left}%` }}
                                    >
                                        {minutesToLabel(label.min)}시
                                    </div>
                                ))}

                                {/* 세그먼트 막대 - 레인별로 배치 */}
                                {lanesSegments.map((seg, idx) => {
                                    const left = (seg.startMin / 1440) * 100;
                                    const width = Math.max(
                                        ((seg.endMin - seg.startMin) / 1440) *
                                            100,
                                        0.5
                                    );
                                    const color = getTypeColor(seg.type);
                                    const laneHeight = 28;
                                    const topOffset =
                                        4 + seg.lane * (laneHeight + 4);

                                    return (
                                        <div
                                            key={`${seg.entryId}-${idx}`}
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
                                            onMouseEnter={(e) =>
                                                setHoveredSegment({
                                                    segment: seg,
                                                    position: {
                                                        x: e.clientX,
                                                        y: e.clientY,
                                                    },
                                                })
                                            }
                                            onMouseLeave={() =>
                                                setHoveredSegment(null)
                                            }
                                            onMouseMove={(e) => {
                                                if (hoveredSegment) {
                                                    setHoveredSegment({
                                                        segment: seg,
                                                        position: {
                                                            x: e.clientX,
                                                            y: e.clientY,
                                                        },
                                                    });
                                                }
                                            }}
                                        >
                                            {/* 막대 내 라벨 */}
                                            {width > 6 && (
                                                <div className="absolute inset-0 flex items-center justify-center px-2 overflow-hidden">
                                                    <span className="text-[11px] font-semibold text-white truncate drop-shadow-sm">
                                                        {seg.type}{" "}
                                                        {toHourStr(
                                                            seg.totalMin
                                                        )}
                                                        h
                                                    </span>
                                                </div>
                                            )}
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
                <div className="mt-8">
                    <div className="flex items-center justify-between mb-4">
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

                    <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
                        <table className="w-full text-[13px]">
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
                                        const isWeekend =
                                            d.getDay() === 0 ||
                                            d.getDay() === 6;
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
                                                            isWeekend
                                                                ? "text-rose-500"
                                                                : "text-slate-700"
                                                        }`}
                                                    >
                                                        {d.getMonth() + 1}/
                                                        {d.getDate()}
                                                    </span>
                                                    <span
                                                        className={`text-[11px] ${
                                                            isWeekend
                                                                ? "text-rose-400"
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

            {/* 하단 액션바 */}
            <div className="mt-6 p-4 bg-[#f9fafb] border border-[#e5e7eb] rounded-xl flex justify-between items-center">
                <Button
                    onClick={onDraftSave}
                    variant="outline"
                    className="rounded-full px-6"
                >
                    임시저장
                </Button>
                <Button
                    onClick={onSubmit}
                    variant="primary"
                    className="rounded-full px-8"
                >
                    제출하기
                </Button>
            </div>
        </div>
    );
}
