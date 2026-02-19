//workLogSection.tsx
import { useState, useMemo, useRef, useEffect } from "react";
import SectionCard from "../ui/SectionCard";
import WorkLogEntryCard from "./WorkLogEntryCard";
import Select from "../common/Select";
import DatePicker from "../ui/DatePicker";
import Button from "../common/Button";
import RequiredIndicator from "../ui/RequiredIndicator";
import {
    useWorkReportStore,
    toKoreanTime,
} from "../../store/workReportStore";
import { IconEdit, IconTrash, IconClose } from "../icons/Icons";
import ConfirmDialog from "../ui/ConfirmDialog";
import { useToast } from "../ui/ToastProvider";

// ✅ 작업 시간(분) 계산: 점심(12:00~13:00) 제외 옵션 포함
function calcWorkMinutesWithLunchRule(params: {
    dateFrom: string;
    timeFrom?: string;
    dateTo: string;
    timeTo?: string;
    descType: "작업" | "이동" | "대기" | "";
    noLunch?: boolean;
}) {
    const { dateFrom, timeFrom, dateTo, timeTo, descType, noLunch } = params;

    // 시간 없으면 0
    if (!dateFrom || !dateTo || !timeFrom || !timeTo) return 0;

    const start = toDateSafe(dateFrom, timeFrom);
    const end = toDateSafe(dateTo, timeTo);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
    if (end <= start) return 0;

    const totalMinutes = Math.floor((end.getTime() - start.getTime()) / 60000);

    // ✅ 작업이 아니면 점심 규칙 적용 X
    if (descType !== "작업") return totalMinutes;

    // ✅ "점심 안 먹음"이면 전체 시간 카운트
    if (noLunch) return totalMinutes;

    // ✅ 점심시간(12:00~13:00) 겹치는 분만큼 제외 (날짜跨越 대응)
    let lunchOverlapMinutes = 0;

    // 시작 날짜 00:00 기준으로 day loop
    const cur = new Date(`${dateFrom}T00:00:00`);
    const last = new Date(`${dateTo}T00:00:00`);

    while (cur <= last) {
        const yyyy = cur.getFullYear();
        const mm = String(cur.getMonth() + 1).padStart(2, "0");
        const dd = String(cur.getDate()).padStart(2, "0");
        const d = `${yyyy}-${mm}-${dd}`;

        const lunchStart = new Date(`${d}T12:00:00`);
        const lunchEnd = new Date(`${d}T13:00:00`);

        // 겹침 계산: [start, end] ∩ [lunchStart, lunchEnd]
        const overlapStart = start > lunchStart ? start : lunchStart;
        const overlapEnd = end < lunchEnd ? end : lunchEnd;

        if (overlapEnd > overlapStart) {
            lunchOverlapMinutes += Math.floor(
                (overlapEnd.getTime() - overlapStart.getTime()) / 60000
            );
        }

        // 다음날
        cur.setDate(cur.getDate() + 1);
    }

    const result = totalMinutes - lunchOverlapMinutes;
    return result < 0 ? 0 : result;
}

function formatHoursMinutes(totalMinutes: number) {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    if (m === 0) return `${h}시간`;
    if (h === 0) return `${m}분`;
    return `${h}시간 ${m}분`;
}



// ✅ "24:00" 같은 시간을 Date로 안전하게 변환(24시는 다음날 00시로 처리)
function toDateSafe(date: string, time: string) {
    if (!date || !time) return new Date("Invalid");
    const [hhStr, mmStr] = time.split(":");
    const hh = Number(hhStr);
    const mm = Number(mmStr ?? "0");

    // 24:00 → 다음날 00:00
    if (hh === 24) {
        const d = new Date(`${date}T00:00:00`);
        d.setDate(d.getDate() + 1);
        d.setHours(0, mm, 0, 0);
        return d;
    }

    return new Date(`${date}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00`);
}

// ✅ 날짜跨越 엔트리를 "날짜별 카드"로 분할(표시용)
function splitEntryByDayForDisplay<T extends {
    id: number;
    dateFrom: string;
    timeFrom?: string;
    dateTo: string;
    timeTo?: string;
}>(entry: T) {
    const timeFrom = entry.timeFrom || "00:00";
    const timeTo = entry.timeTo || "00:00";

    // 같은 날이면 그대로
    if (entry.dateFrom === entry.dateTo) {
        return [{
            ...entry,
            __segId: String(entry.id),      // 렌더링 key/확장 상태용
            __originId: entry.id,           // 수정/삭제는 원본 기준
        }];
    }

    const start = toDateSafe(entry.dateFrom, timeFrom);
    const end = toDateSafe(entry.dateTo, timeTo);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
        // 이상하면 안전하게 원본 1개로 표시
        return [{
            ...entry,
            __segId: String(entry.id),
            __originId: entry.id,
        }];
    }

    const results: any[] = [];

    // day cursor
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
        const segTimeTo = isLast ? timeTo : "24:00"; // ✅ 중간 날짜는 24:00까지

        results.push({
            ...entry,
            dateFrom: d,
            dateTo: d,
            timeFrom: segTimeFrom,
            timeTo: segTimeTo,
            __segId: `${entry.id}__${d}`,   // 날짜별로 다른 카드 키
            __originId: entry.id,
        });

        cur.setDate(cur.getDate() + 1);
    }

    return results;
}


const NO_LUNCH_TEXT = "점심 안 먹고 작업진행(12:00~13:00)";
const NO_DINNER_TEXT = "저녁 안 먹고 작업진행(18:00~19:00)";

function stripSpecialText(note: string, target: string) {
    return (note || "")
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line && line !== target)
        .join("\n");
}

function stripSpecialNotes(note: string) {
    return (note || "")
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line && line !== NO_LUNCH_TEXT && line !== NO_DINNER_TEXT)
        .join("\n");
}

// 시간 선택 옵션
const hourOptions = Array.from({ length: 25 }, (_, i) => ({
    value: String(i).padStart(2, "0"),
    label: `${String(i).padStart(2, "0")}시`,
}));

const minuteOptions = [
    { value: "00", label: "00분" },
    { value: "30", label: "30분" },
];

// 작업 분류 옵션
const descTypeOptionsWork = [
    { value: "작업", label: "작업" },
    { value: "이동", label: "이동" },
    { value: "대기", label: "대기" },
];

const descTypeOptionsEducation = [
    { value: "교육", label: "교육" },
    { value: "이동", label: "이동" },
];

// 이동 장소 기본 옵션
const baseMovePlaces = ["자택", "강동동 공장", "출장지", "숙소"];


export default function WorkLogSection() {
    const {
        workers,
        workLogEntries,
        editingEntryId,
        currentEntry,
        currentEntryPersons,
        setCurrentEntry,
        addCurrentEntryPerson,
        removeCurrentEntryPerson,
        addAllCurrentEntryPersons,
        addRegionPersonsToEntry,
        saveWorkLogEntry,
        deleteWorkLogEntry,
        editWorkLogEntry,
        cancelEditEntry,

        locations,
        reportType, // ✅ Report Type 추가
    } = useWorkReportStore();

    // ✅ Toast 훅 추가
    const { showError } = useToast();

    const movePlaces = useMemo(() => {
        const extras = (locations || []).filter(Boolean);
        return Array.from(new Set([...baseMovePlaces, ...extras]));
    }, [locations]);

    // 경유지 상태
    const [hasDetour, setHasDetour] = useState(false);
    const [isSavingEntry, setIsSavingEntry] = useState(false);
    const isSavingEntryRef = useRef(false);

    // 삭제 확인 모달
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);

    // 폼 영역 ref (수정 시 스크롤용)
    const formRef = useRef<HTMLDivElement>(null);

    // 에러 상태
    const [errors, setErrors] = useState<{
        dateFrom?: string;
        timeFrom?: string;
        dateTo?: string;
        timeTo?: string;
        descType?: string;
        details?: string; // ✅ 추가
        persons?: string; // ✅ 추가
    }>({});

    // 시간 분리
    const [timeFromHour, timeFromMin] = (currentEntry.timeFrom || "").split(
        ":"
    );
    const [timeToHour, timeToMin] = (currentEntry.timeTo || "").split(":");

    // ✅ 수정 진입 시: note에 문구가 있으면 체크가 자동으로 켜지게만 처리
    // ✅ 문구 생성/삭제는 체크박스로만 가능 (textarea에서 편집 불가)
    useEffect(() => {
        const hasNoLunchText = (currentEntry.note || "").includes(NO_LUNCH_TEXT);
        const hasNoDinnerText = (currentEntry.note || "").includes(NO_DINNER_TEXT);

        // 작업이 아니면: 체크 해제 + note에서 문구 제거
        if (currentEntry.descType !== "작업") {
            if (currentEntry.noLunch || hasNoLunchText || hasNoDinnerText) {
                setCurrentEntry({
                    noLunch: false,
                    note: stripSpecialNotes(currentEntry.note || ""),
                });
            }
            return;
        }

        // 작업인데 note에 문구가 있으면 체크만 켜주기(복원)
        if (hasNoLunchText && !currentEntry.noLunch) {
            setCurrentEntry({ noLunch: true });
        }
    }, [currentEntry.descType, currentEntry.noLunch, currentEntry.note, setCurrentEntry]);



    const handleTimeChange = (
        type: "from" | "to",
        part: "hour" | "min",
        value: string
    ) => {
        if (type === "from") {
            const hour = part === "hour" ? value : timeFromHour || "00";
            const min = part === "min" ? value : timeFromMin || "00";
            setCurrentEntry({ timeFrom: `${hour}:${min}` });
        } else {
            const hour = part === "hour" ? value : timeToHour || "00";
            const min = part === "min" ? value : timeToMin || "00";
            setCurrentEntry({ timeTo: `${hour}:${min}` });
        }
    };

    // 이동 상세내용 자동 생성
    const handleMovePlace = (type: "from" | "to", place: string) => {
        // ✅ From/To 동일 선택 방지 (예: 자택→자택)
        if (type === "from") {
            if (currentEntry.moveTo && place === currentEntry.moveTo) {
                showError("From과 To는 같은 장소로 선택할 수 없습니다.");
                return;
            }
            setCurrentEntry({ moveFrom: place });
            updateMoveDetails(place, currentEntry.moveTo, hasDetour);
        } else {
            if (currentEntry.moveFrom && place === currentEntry.moveFrom) {
                showError("From과 To는 같은 장소로 선택할 수 없습니다.");
                return;
            }
            setCurrentEntry({ moveTo: place });
            updateMoveDetails(currentEntry.moveFrom, place, hasDetour);
        }
    };

    // 경유지 토글
    const handleDetourToggle = () => {
        const newHasDetour = !hasDetour;
        setHasDetour(newHasDetour);
        updateMoveDetails(
            currentEntry.moveFrom,
            currentEntry.moveTo,
            newHasDetour
        );
    };

    // 상세내용 업데이트
    const updateMoveDetails = (
        from?: string,
        to?: string,
        detour?: boolean
    ) => {
        if (from && to) {
            if (detour) {
                setCurrentEntry({ details: `${from}→강동동 공장→${to} 이동.` });
            } else {
                setCurrentEntry({ details: `${from}→${to} 이동.` });
            }
        } else if (from) {
            if (detour) {
                setCurrentEntry({ details: `${from}→강동동 공장→` });
            } else {
                setCurrentEntry({ details: `${from}→` });
            }
        } else if (to) {
            if (detour) {
                setCurrentEntry({ details: `→강동동 공장→${to} 이동.` });
            } else {
                setCurrentEntry({ details: `→${to} 이동.` });
            }
        }
    };

    // 선택 가능한 작업자 (이미 추가된 인원 제외)
    const availableWorkers = workers.filter(
        (w) => !currentEntryPersons.includes(w)
    );

    // 카드 확장 상태
    const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>(
        {}
    );
    const toggleCard = (id: string) => {
        setExpandedCards((prev) => ({ ...prev, [id]: !prev[id] }));
    };

    // 엔트리를 시작 시간 기준으로 정렬
    const sortedEntries = useMemo(() => {
        return [...workLogEntries].sort((a, b) => {
            const aKey = `${a.dateFrom}T${a.timeFrom || "00:00"}`;
            const bKey = `${b.dateFrom}T${b.timeFrom || "00:00"}`;
            return aKey.localeCompare(bKey);
        });
    }, [workLogEntries]);

        // ✅ 표시용: 날짜별로 분할한 카드 리스트
        const displayEntries = useMemo(() => {
            const split = sortedEntries.flatMap((e) => splitEntryByDayForDisplay(e));
            return split.sort((a, b) => {
                const aKey = `${a.dateFrom}T${a.timeFrom || "00:00"}`;
                const bKey = `${b.dateFrom}T${b.timeFrom || "00:00"}`;
                return aKey.localeCompare(bKey);
            });
        }, [sortedEntries]);

        // ✅ YYYY-MM-DD -> MM/DD
        const formatMDFromYMD = (ymd?: string) => {
            if (!ymd) return "";
            const parts = String(ymd).split("-");
            if (parts.length !== 3) return "";
            return `${parts[1]}/${parts[2]}`;
        };

        // ✅ 날짜별 n일차 맵 (displayEntries 기준)
        const dayIndexMap = useMemo(() => {
            const map = new Map<string, number>();
            let dayNo = 0;

            for (const it of displayEntries as any[]) {
                const d = it?.dateFrom;
                if (!d) continue;
                if (!map.has(d)) {
                    dayNo += 1;
                    map.set(d, dayNo);
                }
            }
            return map;
        }, [displayEntries]);

                // ✅ [추가] 같은 날짜/시간/인원 중복 생성 방지용 (인원 순서 무관)
                const normalizePersonsKey = (persons: string[]) =>
                    [...(persons || [])].map((p) => String(p).trim()).filter(Boolean).sort().join("|");
        

    const handleSaveEntry = () => {
        if (isSavingEntryRef.current) return;

        const newErrors: typeof errors = {};
        if (!currentEntry.dateFrom) {
            newErrors.dateFrom = "시작 날짜를 선택해주세요";
        }
        if (!currentEntry.dateTo) {
            newErrors.dateTo = "종료 날짜를 선택해주세요";
        }
        if (!currentEntry.timeFrom) {
            newErrors.timeFrom = "시작 시간을 선택해주세요";
        }
        if (!currentEntry.timeTo) {
            newErrors.timeTo = "종료 시간을 선택해주세요";
        }
        if (!currentEntry.descType) {
            newErrors.descType = "작업 분류를 선택해주세요";
        }
        if (!currentEntry.details) {
            newErrors.details = "상세 내용을 입력해주세요";
        }
        if (currentEntry.descType === "작업") {
            if (currentEntryPersons.length === 0) {
                newErrors.persons = "참여 인원을 1명 이상 선택해주세요";
            }
        } else if (currentEntry.descType === "이동") {
            if (!currentEntry.moveFrom) {
                newErrors.details = "From을 선택해주세요";
            }
            if (!currentEntry.moveTo) {
                newErrors.details = "To를 선택해주세요";
            }
        }

        if (currentEntry.dateFrom && currentEntry.dateTo) {
            const start = new Date(`${currentEntry.dateFrom}T${currentEntry.timeFrom || "00:00"}:00`);
            const end = new Date(`${currentEntry.dateTo}T${currentEntry.timeTo || "00:00"}:00`);

            if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end <= start) {
                const msg = "종료 날짜 종료 시간을 확인해주세요";
                newErrors.dateTo = msg;
                newErrors.timeTo = msg;
            }
        }
        if (currentEntry.descType === "작업" && currentEntryPersons.length === 0) {
            newErrors.persons = "참여 인원을 1명 이상 선택해주세요";
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            if (formRef.current) {
                formRef.current.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                });
            }
            return;
        }

        const currentPersonsKey = normalizePersonsKey(currentEntryPersons);
        const isDuplicate = workLogEntries.some((e) => {
            if (editingEntryId && e.id === editingEntryId) return false;

            const ePersonsKey = normalizePersonsKey((e as any).persons || []);

            return (
                e.dateFrom === currentEntry.dateFrom &&
                (e.timeFrom || "") === (currentEntry.timeFrom || "") &&
                e.dateTo === currentEntry.dateTo &&
                (e.timeTo || "") === (currentEntry.timeTo || "") &&
                ePersonsKey === currentPersonsKey
            );
        });

        if (isDuplicate) {
            showError("같은 날짜/시간/인원의 일지가 이미 존재합니다. (중복 저장 불가)");
            return;
        }

        setErrors({});
        setCurrentEntry({ persons: currentEntryPersons });
        isSavingEntryRef.current = true;
        setIsSavingEntry(true);
        try {
            saveWorkLogEntry(showError);
            setHasDetour(false);
        } finally {
            isSavingEntryRef.current = false;
            setIsSavingEntry(false);
        }
    };

    return (
        <SectionCard title={reportType === "education" ? "교육 일지" : "출장 업무 일지"}>
            <div className="flex flex-col gap-5">
                {/* 입력 폼 */}
                <div ref={formRef} className="flex flex-col gap-5 scroll-mt-20">
                    {/* 시작/종료 시간 */}
                    <div className="rounded-xl overflow-hidden border border-gray-200">
                        <div className="flex flex-col md:flex-row">
                            {/* 시작 */}
                            <div className="flex-1 p-4 bg-gray-50">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="w-3 h-3 rounded-[4px] bg-green-500"></div>
                                    <p className="font-semibold text-[14px] text-gray-800">
                                        시작
                                        <RequiredIndicator />
                                    </p>
                                </div>
                                <div className="flex flex-col gap-2">
                                    <DatePicker
                                        value={currentEntry.dateFrom || ""}
                                        onChange={(val) => {
                                            setCurrentEntry({
                                                dateFrom: val,
                                                dateTo: val, // ✅ 시작 날짜 변경 시 종료 날짜도 동일하게 설정
                                            });

                                            if (errors.dateFrom) {
                                                setErrors((prev) => ({
                                                    ...prev,
                                                    dateFrom: undefined,
                                                }));
                                            }
                                        }}
                                        placeholder="날짜 선택"
                                        error={errors.dateFrom}
                                    />
                                    <div className="flex gap-2">
                                        <div className="flex-1 flex flex-col gap-1">
                                            <Select
                                                value={timeFromHour || ""}
                                                onChange={(val) => {
                                                    handleTimeChange(
                                                        "from",
                                                        "hour",
                                                        val
                                                    );
                                                    if (errors.timeFrom) {
                                                        setErrors((prev) => ({
                                                            ...prev,
                                                            timeFrom: undefined,
                                                        }));
                                                    }
                                                }}
                                                options={hourOptions}
                                                placeholder="시"
                                                className="flex-1"
                                                size="sm"
                                                fullWidth
                                                error={errors.timeFrom}
                                            />
                                        </div>
                                        <div className="flex-1 flex flex-col gap-1">
                                            <Select
                                                value={timeFromMin || "00"}
                                                onChange={(val) => {
                                                    handleTimeChange(
                                                        "from",
                                                        "min",
                                                        val
                                                    );
                                                    if (errors.timeFrom) {
                                                        setErrors((prev) => ({
                                                            ...prev,
                                                            timeFrom: undefined,
                                                        }));
                                                    }
                                                }}
                                                options={minuteOptions}
                                                className="flex-1"
                                                size="sm"
                                                fullWidth
                                                error={errors.timeFrom}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="w-px bg-gray-200 hidden md:block" />
                            <div className="h-px bg-gray-200 md:hidden" />
                            {/* 종료 */}
                            <div className="flex-1 p-4 bg-gray-50">
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="w-3 h-3 rounded-[4px] bg-red-500"></div>
                                        <p className="font-semibold text-[14px] text-gray-800">
                                            종료
                                            <RequiredIndicator />
                                        </p>
                                    </div>
                                <div className="flex flex-col gap-2">
                                    <DatePicker
                                        value={currentEntry.dateTo || ""}
                                        onChange={(val) => {
                                            setCurrentEntry({ dateTo: val });
                                            if (errors.dateTo) {
                                                setErrors((prev) => ({
                                                    ...prev,
                                                    dateTo: undefined,
                                                }));
                                            }
                                        }}
                                        placeholder="날짜 선택"
                                        error={errors.dateTo}
                                    />
                                    <div className="flex gap-2">
                                        <div className="flex-1 flex flex-col gap-1">
                                            <Select
                                                value={timeToHour || ""}
                                                onChange={(val) => {
                                                    handleTimeChange(
                                                        "to",
                                                        "hour",
                                                        val
                                                    );
                                                    if (errors.timeTo) {
                                                        setErrors((prev) => ({
                                                            ...prev,
                                                            timeTo: undefined,
                                                        }));
                                                    }
                                                }}
                                                options={hourOptions}
                                                placeholder="시"
                                                className="flex-1"
                                                size="sm"
                                                fullWidth
                                                error={errors.timeTo}
                                            />
                                        </div>
                                        <div className="flex-1 flex flex-col gap-1">
                                            <Select
                                                value={timeToMin || "00"}
                                                onChange={(val) => {
                                                    handleTimeChange(
                                                        "to",
                                                        "min",
                                                        val
                                                    );
                                                    if (errors.timeTo) {
                                                        setErrors((prev) => ({
                                                            ...prev,
                                                            timeTo: undefined,
                                                        }));
                                                    }
                                                }}
                                                options={minuteOptions}
                                                className="flex-1"
                                                size="sm"
                                                fullWidth
                                                error={errors.timeTo}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 작업 분류 */}
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center">
                            <label className="font-medium text-[14px] md:text-[15px] text-[#101828]">
                                유형
                            </label>
                            <RequiredIndicator />
                        </div>

                        <div className="flex gap-2">
                            {(reportType === "education"
                                ? descTypeOptionsEducation
                                : descTypeOptionsWork
                            ).map((opt) => (
                                <Button
                                    key={opt.value}
                                    type="button"
                                    size="lg"
                                    fullWidth
                                    variant={
                                        currentEntry.descType === opt.value
                                            ? "primary"
                                            : "outline"
                                    }
                                    onClick={() => {
                                        setCurrentEntry({
                                            descType: opt.value as any, // type assertion needed due to extended union
                                        });

                                        if (errors.descType) {
                                            setErrors((prev) => ({
                                                ...prev,
                                                descType: undefined,
                                            }));
                                        }
                                    }}
                                >
                                    {opt.label}
                                </Button>
                            ))}
                        </div>

                        {errors.descType && (
                            <p className="text-[12px] text-red-500">{errors.descType}</p>
                        )}
                    </div>

{/* 이동일 때 From/To 선택 */}
{currentEntry.descType === "이동" && (() => {
    const corePlaces = ["자택", "강동동 공장", "숙소"];

    // 선택한 출장지들 (기본 장소/출장지 라벨 제외)
    const tripPlaces = movePlaces.filter(
        (place) => place !== "출장지" && !corePlaces.includes(place)
    );

    const tripGridClass =
    tripPlaces.length === 1
        ? "grid grid-cols-1 gap-2"
        : tripPlaces.length === 2
        ? "grid grid-cols-2 gap-2"
        : tripPlaces.length === 4
        ? "grid grid-cols-4 gap-2"
        : "grid grid-cols-3 gap-2"; // 3개 기본

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 items-start">
            {/* ===================== From ===================== */}
            <div>
                <label className="font-medium text-[14px] text-[#101828] mb-2 block">
                    From
                </label>

                <div className="flex flex-col gap-2 p-3 border border-dashed border-[#e5e7eb] rounded-lg bg-white h-fit">
                    {/* 1행: 기본 */}
                    <div className="grid grid-cols-3 gap-2">
                        {corePlaces.map((place) => (
                            <Button
                                key={`from-core-${place}`}
                                size="md"
                                className="w-full"
                                variant={currentEntry.moveFrom === place ? "primary" : "outline"}
                                disabled={
                                    (!!currentEntry.moveTo && currentEntry.moveTo === place) ||
                                    (hasDetour && place === "강동동 공장")
                                }
                                onClick={() => handleMovePlace("from", place)}
                            >
                                {place}
                            </Button>
                        ))}
                    </div>

                    {/* 2행: 출장지들 */}
                    <div className={tripGridClass}>
                        {tripPlaces.map((place) => (
                            <Button
                                key={`from-trip-${place}`}
                                size="md"
                                className="w-full"
                                variant={currentEntry.moveFrom === place ? "primary" : "outline"}
                                disabled={
                                    (!!currentEntry.moveTo && currentEntry.moveTo === place) ||
                                    (hasDetour && place === "강동동 공장")
                                }
                                onClick={() => handleMovePlace("from", place)}
                            >
                                {place}
                            </Button>
                        ))}
                    </div>
                </div>
            </div>

            {/* ===================== To ===================== */}
            <div>
                <label className="font-medium text-[14px] text-[#101828] mb-2 block">
                    To
                </label>

                <div className="flex flex-col gap-2 p-3 border border-dashed border-[#e5e7eb] rounded-lg bg-white h-fit">
                    {/* 1행: 기본 */}
                    <div className="grid grid-cols-3 gap-2">
                        {corePlaces.map((place) => (
                            <Button
                                key={`to-core-${place}`}
                                size="md"
                                className="w-full"
                                variant={currentEntry.moveTo === place ? "primary" : "outline"}
                                disabled={
                                    (!!currentEntry.moveFrom && currentEntry.moveFrom === place) ||
                                    (hasDetour && place === "강동동 공장")
                                }
                                onClick={() => handleMovePlace("to", place)}
                            >
                                {place}
                            </Button>
                        ))}
                    </div>

                    {/* 2행: 강동동 공장 경유 (가로 전체) */}
                    <div className="grid grid-cols-3 gap-2">
                    <Button
                        size="md"
                        variant="outline"
                        className={`w-full col-span-3
                        !bg-sky-50 !text-sky-800 !border-sky-200
                        hover:!bg-sky-100
                        ${hasDetour ? "!bg-sky-200 !text-sky-900 !border-sky-300" : ""}
                        `}
                        onClick={handleDetourToggle}
                    >
                        강동동 공장 경유
                    </Button>
                    </div>

                    {/* 3행: 출장지들 */}
                    <div className={tripGridClass}>
                        {tripPlaces.map((place) => (
                            <Button
                                key={`to-trip-${place}`}
                                size="md"
                                className="w-full"
                                variant={currentEntry.moveTo === place ? "primary" : "outline"}
                                disabled={
                                    (!!currentEntry.moveFrom && currentEntry.moveFrom === place) ||
                                    (hasDetour && place === "강동동 공장")
                                }
                                onClick={() => handleMovePlace("to", place)}
                            >
                                {place}
                            </Button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
})()}






                    {/* 상세내용 */}
                    <div className="flex flex-col gap-2">
                        <label className="font-medium text-[14px] md:text-[15px] text-[#101828]">
                            상세 내용
                            <RequiredIndicator />
                        </label>
                        <textarea
                            placeholder="수행한 업무 내용을 자세히 기록해주세요"
                            value={currentEntry.details || ""}
                            onChange={(e) => {
                                setCurrentEntry({ details: e.target.value });
                                if (errors.details) {
                                    setErrors((prev) => ({ ...prev, details: undefined }));
                                }
                            }}
                            className={`w-full min-h-[80px] p-3 border rounded-xl text-[16px] resize-none outline-none focus:border-[#9ca3af] ${errors.details ? "border-red-500" : "border-[#e5e7eb]"
                                }`}
                        />
                        {errors.details && (
                            <p className="text-[12px] text-red-500 mt-1">{errors.details}</p>
                        )}
                    </div>

                    {/* 참여 인원 선택 */}
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center">
                            <label className="font-medium text-[14px] md:text-[15px] text-[#101828]">
                                참여 인원 선택
                            </label>
                            <RequiredIndicator />
                        </div>

                        {/* 선택 가능한 작업자 */}
                        <div className="border border-[#e5e7eb] rounded-xl p-4">
                            <p className="text-[13px] text-[#6a7282] mb-2">
                                작업자 클릭하여 추가
                            </p>
                            <div className="flex flex-wrap gap-2 min-h-[36px]">
                                {availableWorkers.length === 0 ? (
                                    <p className="text-[#99a1af] text-sm">
                                        모든 작업자가 추가됨
                                    </p>
                                ) : (
                                    availableWorkers.map((worker) => (
                                        <Button
                                            key={worker}
                                            type="button"
                                            size="md"
                                            variant="outline"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                addCurrentEntryPerson(worker);
                                            }}
                                        >
                                            {worker}
                                        </Button>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* 빠른 추가 버튼들 */}
                        <div className="flex flex-wrap gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={addAllCurrentEntryPersons}
                            >
                                모두 추가
                            </Button>
                            {/* Dynamic Region Buttons */}
                            {Array.from(new Set(useWorkReportStore.getState().allStaff.map(s => s.region)))
                                .filter(Boolean)
                                .sort()
                                .map(region => {
                                    const regionNames: Record<string, string> = {
                                        'BC': '부산/창원',
                                        'UL': '울산',
                                        'JY': '정관/양산',
                                        'GJ': '거제'
                                    };
                                    return (
                                        <Button
                                            key={region}
                                            variant="outline"
                                            size="sm"
                                            onClick={() => addRegionPersonsToEntry(region)}
                                        >
                                            {regionNames[region] || region}
                                        </Button>
                                    );
                                })
                            }
                        </div>

                        {/* 선택된 인원 */}
                        <div
                            className={`border-2 rounded-2xl px-4 py-3 mt-2 ${errors.persons ? "border-red-500" : "border-blue-300"
                                }`}
                        >
                            <div className="flex items-center gap-1 mb-3">
                                <svg
                                    width="20"
                                    height="20"
                                    viewBox="0 0 20 20"
                                    fill="none"
                                >
                                    <path
                                        d="M7.5 13.475L4.025 10L2.8375 11.175L7.5 15.8375L17.5 5.8375L16.325 4.6625L7.5 13.475Z"
                                        fill="#2b7fff"
                                    />
                                </svg>
                                <span className="font-medium text-[15px] text-[#101828]">
                                    선택된 작업자
                                </span>
                                <span className="text-[14px] text-[#99a1af]">
                                    {currentEntryPersons.length}명
                                </span>
                            </div>
                            <div className="flex flex-wrap gap-2 min-h-[36px]">
                                {currentEntryPersons.length === 0 ? (
                                    <p className="text-[#99a1af] text-sm">
                                        인원을 선택해주세요
                                    </p>

                                ) : (
                                    currentEntryPersons.map((person) => (
                                        <Button
                                            key={person}
                                            variant="secondary"
                                            size="md"
                                            onClick={() =>
                                                removeCurrentEntryPerson(person)
                                            }
                                        >
                                            {person}
                                            <IconClose className="ml-1 w-4 h-4" />
                                        </Button>
                                    ))
                                )}

                            </div>
                        </div>
                        {errors.persons && (
                            <p className="text-[12px] text-red-500 mt-2 ml-1">
                                {errors.persons}
                            </p>
                        )}
                        {/* 작업일 때 점심/저녁 체크박스 */}
                        {currentEntry.descType === "작업" && (
                            <div className="flex flex-col md:flex-row gap-2">
                                <label className="flex-1 min-w-[260px] flex items-start gap-3 p-3 border border-[#e5e7eb] rounded-xl bg-[#fffbeb] cursor-pointer hover:bg-[#fef3c7] transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={currentEntry.noLunch || false}
                                        onChange={(e) => {
                                            const checked = e.target.checked;
                                            const baseNote = stripSpecialText(currentEntry.note || "", NO_LUNCH_TEXT);

                                            if (checked) {
                                                setCurrentEntry({
                                                    noLunch: true,
                                                    note: baseNote ? `${baseNote}\n${NO_LUNCH_TEXT}` : NO_LUNCH_TEXT,
                                                });
                                            } else {
                                                setCurrentEntry({
                                                    noLunch: false,
                                                    note: baseNote,
                                                });
                                            }
                                        }}
                                        className="w-5 h-5 mt-0.5 accent-amber-500"
                                    />

                                    <div className="flex flex-col">
                                        <span className="text-[14px] font-semibold text-[#92400e]">
                                            점심 안 먹고 작업진행 (12:00~13:00)
                                        </span>
                                        <span className="text-[12px] text-[#b45309]">
                                            ※운항선 작업일 때 체크해주세요.
                                        </span>
                                    </div>
                                </label>

                                <label className="flex-1 min-w-[260px] flex items-start gap-3 p-3 border border-[#e5e7eb] rounded-xl bg-[#f0f9ff] cursor-pointer hover:bg-[#e0f2fe] transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={(currentEntry.note || "").includes(NO_DINNER_TEXT)}
                                        onChange={(e) => {
                                            const checked = e.target.checked;
                                            const baseNote = stripSpecialText(currentEntry.note || "", NO_DINNER_TEXT);

                                            if (checked) {
                                                setCurrentEntry({
                                                    note: baseNote ? `${baseNote}\n${NO_DINNER_TEXT}` : NO_DINNER_TEXT,
                                                });
                                            } else {
                                                setCurrentEntry({
                                                    note: baseNote,
                                                });
                                            }
                                        }}
                                        className="w-5 h-5 mt-0.5 accent-sky-500"
                                    />

                                    <div className="flex flex-col">
                                        <span className="text-[14px] font-semibold text-sky-900">
                                            저녁 안 먹고 작업진행 (18:00~19:00)
                                        </span>
                                        <span className="text-[12px] text-sky-800">
                                            ※운항선 작업일 때 체크해주세요.
                                        </span>
                                    </div>
                                </label>
                            </div>
                        )}
                    </div>

                    {/* 특이사항 */}
                    <div className="flex flex-col gap-2">
                        <label className="font-medium text-[14px] md:text-[15px] text-[#101828]">
                            특이 사항
                        </label>

                        {/* ✅ 점심/저녁 문구는 textarea에서 삭제/수정 불가: 칩으로만 표시 */}
                        {currentEntry.descType === "작업" && (
                            <div className="flex flex-wrap gap-2">
                                {currentEntry.noLunch && (
                                    <span className="inline-flex items-center px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-[13px] font-semibold border border-amber-200">
                                        {NO_LUNCH_TEXT}
                                    </span>
                                )}
                                {(currentEntry.note || "").includes(NO_DINNER_TEXT) && (
                                    <span className="inline-flex items-center px-3 py-1 rounded-full bg-sky-100 text-sky-800 text-[13px] font-semibold border border-sky-200">
                                        {NO_DINNER_TEXT}
                                    </span>
                                )}
                            </div>
                        )}

                        <textarea
                            placeholder="특이 사항이 있으면 입력해주세요"
                            value={stripSpecialNotes(currentEntry.note || "")}
                            onChange={(e) => {
                                const cleaned = stripSpecialNotes(e.target.value);

                                // ✅ 문구는 체크박스로만 관리되므로, textarea 입력값에는 항상 문구를 제거한 값만 반영
                                const withLunch = currentEntry.noLunch
                                    ? cleaned
                                        ? `${cleaned}\n${NO_LUNCH_TEXT}`
                                        : NO_LUNCH_TEXT
                                    : cleaned;
                                const withDinner = (currentEntry.note || "").includes(NO_DINNER_TEXT)
                                    ? withLunch
                                        ? `${withLunch}\n${NO_DINNER_TEXT}`
                                        : NO_DINNER_TEXT
                                    : withLunch;

                                setCurrentEntry({ note: withDinner });
                            }}
                            className="w-full min-h-[60px] p-3 border border-[#e5e7eb] rounded-xl text-[16px] resize-none outline-none focus:border-[#9ca3af]"
                        />
                    </div>

                </div>

                {/* 저장 버튼 */}
                <div className="flex gap-2">
                    <Button
                        onClick={handleSaveEntry}
                        variant="primary"
                        size="lg"
                        fullWidth
                        loading={isSavingEntry}
                    >
                        {editingEntryId ? "수정 저장" : "저장"}
                    </Button>
                    {editingEntryId && (
                        <Button
                            onClick={() => {
                                cancelEditEntry();
                                setHasDetour(false);
                            }}
                            variant="outline"
                            size="lg"
                            width={"10%"}
                        >
                            취소
                        </Button>
                    )}
                </div>

                {/* 저장된 일지 목록 */}
                {displayEntries.length > 0 && (
                    <div className="flex flex-col gap-3">
                        <div className="h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent" />
                        {displayEntries.map((entry: any, index) => {
                            const noLunchText = "점심 안 먹고 작업진행(12:00~13:00)";
                            const effectiveNoLunch =
                                !!entry.noLunch || (entry.note || "").includes(noLunchText);

                            const minutes = calcWorkMinutesWithLunchRule({
                                dateFrom: entry.dateFrom,
                                timeFrom: entry.timeFrom,
                                dateTo: entry.dateTo,
                                timeTo: entry.timeTo,
                                descType: entry.descType,
                                noLunch: effectiveNoLunch, // ✅ 특이사항 문구가 있으면 점심 제외 안함
                            });

                            const hoursLabel = formatHoursMinutes(minutes);
                            const isExpanded = expandedCards[entry.__segId] ?? false;

                            // 날짜 변경 체크
                            const prevEntry = displayEntries[index - 1];
                            const showDayHeader = !prevEntry || prevEntry.dateFrom !== entry.dateFrom;

                            const dayNo = dayIndexMap.get(entry.dateFrom) ?? 1;
                            const md = formatMDFromYMD(entry.dateFrom);
                            const dayHeaderText = `${dayNo}일차(${md})`;

                            return (
                                <div key={entry.__segId}>
                                    {showDayHeader && (
                                        <div className="w-full flex items-center gap-3 my-4">
                                            <div className="flex-1 border-t border-rose-300" />
                                            <span className="text-[12px] font-semibold text-rose-500 px-2 whitespace-nowrap">
                                                {dayHeaderText}
                                            </span>
                                            <div className="flex-1 border-t border-rose-300" />
                                        </div>
                                    )}
                                    <WorkLogEntryCard
                                        descType={entry.descType as any}
                                        hoursLabel={hoursLabel}
                                        title={entry.title}
                                        meta={
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-2 text-[13px] text-gray-600">
                                                    <svg
                                                        width="16"
                                                        height="16"
                                                        viewBox="0 0 24 24"
                                                        fill="currentColor"
                                                        className="text-gray-400"
                                                    >
                                                        <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z" />
                                                    </svg>
                                                    <span>
                                                        {entry.dateFrom} {toKoreanTime(entry.timeFrom)}
                                                    </span>
                                                    <span className="text-gray-400">→</span>
                                                    <span>
                                                        {entry.dateTo} {toKoreanTime(entry.timeTo)}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2 text-[13px] text-gray-600">
                                                    <svg
                                                        width="16"
                                                        height="16"
                                                        viewBox="0 0 24 24"
                                                        fill="currentColor"
                                                        className="text-gray-400"
                                                    >
                                                        <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
                                                    </svg>
                                                    <span className="font-medium">{entry.persons.length}명</span>
                                                    <span className="text-gray-400">|</span>
                                                    <div className="flex-1 min-w-0 text-gray-600 text-[13px] leading-5 break-words">
                                                        {Array.isArray(entry.persons) && entry.persons.length > 0
                                                            ? entry.persons.join(", ")
                                                            : "—"}
                                                    </div>
                                                </div>
                                            </div>
                                        }
                                        showNoLunch={entry.descType === "작업" && effectiveNoLunch}
                                        noLunchText={NO_LUNCH_TEXT}
                                        isExpanded={isExpanded}
                                        onToggle={() => toggleCard(entry.__segId)}
                                    >
                                        <div className="bg-white border border-gray-100 rounded-xl p-3">
                                            <p className="text-[13px] text-gray-500 mb-1">상세 내용</p>
                                            <p className="text-[15px] text-gray-800">
                                                {entry.details || "-"}
                                            </p>
                                        </div>

                                        {entry.note && (
                                            <div className="bg-white border border-gray-100 rounded-xl p-3">
                                                <p className="text-[13px] text-gray-500 mb-1">특이 사항</p>
                                                <p className="text-[15px] text-gray-800">
                                                    {entry.note}
                                                </p>
                                            </div>
                                        )}

                                        <div className="flex gap-2 pt-2">
                                            <Button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    editWorkLogEntry(entry.__originId);
                                                    setTimeout(() => {
                                                        formRef.current?.scrollIntoView({
                                                            behavior: "smooth",
                                                            block: "start",
                                                        });
                                                    }, 100);
                                                }}
                                                variant="outline"
                                                size="md"
                                                fullWidth
                                                icon={<IconEdit className="w-4 h-4" />}
                                            >
                                                수정
                                            </Button>
                                            <Button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setDeleteTargetId(entry.__originId);
                                                    setDeleteConfirmOpen(true);
                                                }}
                                                variant="outline"
                                                size="md"
                                                fullWidth
                                                icon={<IconTrash className="w-4 h-4" />}
                                                className="text-red-600 border-red-200 hover:bg-red-50"
                                            >
                                                삭제
                                            </Button>
                                        </div>
                                    </WorkLogEntryCard>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* 삭제 확인 다이얼로그 */}
            <ConfirmDialog
                isOpen={deleteConfirmOpen}
                onClose={() => {
                    setDeleteConfirmOpen(false);
                    setDeleteTargetId(null);
                }}
                onConfirm={() => {
                    if (deleteTargetId !== null) {
                        deleteWorkLogEntry(deleteTargetId);
                        setDeleteConfirmOpen(false);
                        setDeleteTargetId(null);
                    }
                }}
                title="삭제 확인"
                message="해당 출장 업무 일지를 삭제하시겠습니까?"
                confirmText="삭제"
                cancelText="취소"
                confirmVariant="danger"
            />
        </SectionCard>
    );
}
