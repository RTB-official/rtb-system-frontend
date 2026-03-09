// CopyPreviousWorkInfoSection.tsx
import { useState, useEffect, useMemo } from "react";
import Select from "../common/Select";
import { supabase } from "../../lib/supabase";
import { getWorkLogs, type WorkLog } from "../../lib/workLogApi";
import { useWorkReportStore } from "../../store/workReportStore";
import { useUser } from "../../hooks/useUser";

interface ReportOption {
    id: number;
    title: string;
    workLog: WorkLog;
}

// 기간 포맷팅 함수 (ReportListPage와 동일)
function formatKoreanDate(dateString: string) {
    const d = new Date(dateString);
    const month = d.getMonth() + 1;
    const day = d.getDate();
    return { month, day };
}

function formatKoreanPeriod(start?: string | null, end?: string | null): string {
    if (!start && !end) return "";
    if (start && !end) {
        const s = formatKoreanDate(start);
        return `${s.month}월${s.day}일`;
    }
    if (!start && end) {
        const e = formatKoreanDate(end);
        return `${e.month}월${e.day}일`;
    }

    const s = formatKoreanDate(start as string);
    const e = formatKoreanDate(end as string);
    if (s.month === e.month) {
        if (s.day === e.day) return `${s.month}월${s.day}일`;
        return `${s.month}월${s.day}일~${e.day}일`;
    }
    return `${s.month}월${s.day}일~${e.month}월${e.day}일`;
}

export default function CopyPreviousWorkInfoSection() {
    const { currentUserId } = useUser();
    const [loading, setLoading] = useState(false);
    const [reportOptions, setReportOptions] = useState<ReportOption[]>([]);
    const [selectedReportId, setSelectedReportId] = useState<string>("");

    const {
        setVessel,
        setEngine,
        setOrderGroup,
        setOrderPerson,
        setLocations,
        setLocationCustom,
        setVehicles,
        setSubject,
        setWorkers,
    } = useWorkReportStore();

    // 보고서 목록 로드
    useEffect(() => {
        const loadReports = async () => {
            if (!currentUserId) {
                console.log("사용자 ID가 없습니다.");
                return;
            }

            console.log("보고서 목록 로드 시작, 사용자 ID:", currentUserId);
            setLoading(true);
            try {
                // 사용자 프로필 조회 (role 확인)
                const { data: profile, error: profileError } = await supabase
                    .from("profiles")
                    .select("role, name")
                    .eq("id", currentUserId)
                    .single();

                if (profileError) {
                    console.error("프로필 조회 실패:", profileError);
                    setLoading(false);
                    return;
                }

                const userRole = profile?.role;
                const userName = profile?.name;

                // 모든 보고서 조회 (제출된 것만)
                let workLogs = await getWorkLogs();
                console.log("getWorkLogs() 결과:", workLogs.length, "개");
                workLogs = workLogs.filter((log) => !log.is_draft);
                console.log("제출된 보고서 수 (is_draft=false):", workLogs.length);

                // admin이 아니면 본인이 작성하거나 참여한 보고서만 필터링
                if (userRole !== "admin" && userName) {
                    // 본인이 작성한 보고서 ID
                    const myOwnIds = new Set<number>(
                        workLogs
                            .filter((log) => log.created_by === currentUserId)
                            .map((log) => log.id)
                            .filter(Boolean)
                    );

                    console.log("본인이 작성한 보고서 ID:", Array.from(myOwnIds));
                    console.log("사용자 ID:", currentUserId);
                    console.log("사용자 이름:", userName);

                    // 본인이 참여한 보고서 ID 찾기
                    // 1) work_log_persons에서 조회 (전체 참여자)
                    const { data: workLogPersons, error: workLogPersonsError } = await supabase
                        .from("work_log_persons")
                        .select("work_log_id, person_name");

                    if (workLogPersonsError) {
                        console.error("work_log_persons 조회 실패:", workLogPersonsError);
                    }

                    const participatedFromWorkLogPersons = new Set<number>(
                        (workLogPersons || [])
                            .filter((p) => {
                                const pName = String(p.person_name || "").trim();
                                const uName = String(userName || "").trim();
                                return pName === uName;
                            })
                            .map((p) => p.work_log_id)
                            .filter(Boolean)
                    );

                    // 2) work_log_entry_persons에서도 조회 (entry별 참여자)
                    const workLogIds = workLogs.map((log) => log.id).filter(Boolean);
                    let participatedFromEntries = new Set<number>();

                    if (workLogIds.length > 0) {
                        // entry 조회
                        const { data: entries, error: entriesError } = await supabase
                            .from("work_log_entries")
                            .select("id, work_log_id")
                            .in("work_log_id", workLogIds);

                        if (entriesError) {
                            console.error("entries 조회 실패:", entriesError);
                        } else if (entries && entries.length > 0) {
                            const entryIds = entries.map((e) => e.id).filter(Boolean);
                            const entryToWorkLog = new Map<number, number>();
                            entries.forEach((e) => {
                                entryToWorkLog.set(e.id, e.work_log_id);
                            });

                            // entry_persons 조회
                            const { data: entryPersons, error: entryPersonsError } = await supabase
                                .from("work_log_entry_persons")
                                .select("entry_id, person_name")
                                .eq("person_name", userName)
                                .in("entry_id", entryIds);

                            if (entryPersonsError) {
                                console.error("entry_persons 조회 실패:", entryPersonsError);
                            } else if (entryPersons) {
                                entryPersons.forEach((ep) => {
                                    const workLogId = entryToWorkLog.get(ep.entry_id);
                                    if (workLogId) {
                                        participatedFromEntries.add(workLogId);
                                    }
                                });
                            }
                        }
                    }

                    // 합치기
                    const allParticipatedIds = new Set([
                        ...participatedFromWorkLogPersons,
                        ...participatedFromEntries,
                    ]);

                    console.log("work_log_persons에서 찾은 보고서 ID:", Array.from(participatedFromWorkLogPersons));
                    console.log("work_log_entry_persons에서 찾은 보고서 ID:", Array.from(participatedFromEntries));
                    console.log("전체 참여 보고서 ID:", Array.from(allParticipatedIds));

                    // 최종 필터링
                    const allowedIds = new Set([...myOwnIds, ...allParticipatedIds]);
                    workLogs = workLogs.filter((log) => allowedIds.has(log.id));
                    
                    console.log("필터링 후 보고서 수:", workLogs.length);
                } else if (userRole === "admin") {
                    console.log("Admin 계정: 모든 보고서 표시");
                } else {
                    console.log("사용자 이름이 없습니다:", userName);
                }

                // 최대 30개로 제한
                workLogs = workLogs.slice(0, 30);

                console.log("최종 보고서 수 (30개 제한 후):", workLogs.length);

                if (workLogs.length === 0) {
                    console.log("사용 가능한 보고서가 없습니다.");
                    setReportOptions([]);
                    setLoading(false);
                    return;
                }

                // 각 보고서의 기간 정보 조회
                const workLogIds = workLogs.map((log) => log.id);
                let entries: any[] = [];
                
                if (workLogIds.length > 0) {
                    const { data: entriesData, error: entriesError } = await supabase
                        .from("work_log_entries")
                        .select("work_log_id, date_from, date_to")
                        .in("work_log_id", workLogIds);

                    if (entriesError) {
                        console.error("기간 정보 조회 실패:", entriesError);
                    } else {
                        entries = entriesData || [];
                    }
                }

                // 기간 맵 생성
                const periodMap = new Map<number, { start?: string; end?: string }>();
                if (entries) {
                    entries.forEach((entry) => {
                        const logId = entry.work_log_id;
                        if (!periodMap.has(logId)) {
                            periodMap.set(logId, {});
                        }
                        const period = periodMap.get(logId)!;
                        if (entry.date_from && (!period.start || entry.date_from < period.start)) {
                            period.start = entry.date_from;
                        }
                        if (entry.date_to && (!period.end || entry.date_to > period.end)) {
                            period.end = entry.date_to;
                        }
                    });
                }

                // 보고서 옵션 생성 (제목 형식: "기간 / 호선 / 출장목적")
                const options: ReportOption[] = workLogs.map((log) => {
                    const period = periodMap.get(log.id);
                    const periodText = formatKoreanPeriod(period?.start, period?.end);
                    const vessel = log.vessel?.trim() || "";
                    const subject = log.subject?.trim() || "";
                    const parts = [periodText, vessel, subject].filter(Boolean);
                    const title = parts.length ? parts.join(" ") : "(제목 없음)";

                    return {
                        id: log.id,
                        title,
                        workLog: log,
                    };
                });

                // 최신순 정렬
                options.sort((a, b) => {
                    const dateA = new Date(a.workLog.created_at).getTime();
                    const dateB = new Date(b.workLog.created_at).getTime();
                    return dateB - dateA;
                });

                console.log("최종 옵션 수:", options.length);
                setReportOptions(options);
            } catch (error) {
                console.error("보고서 목록 로드 실패:", error);
                setReportOptions([]);
            } finally {
                setLoading(false);
            }
        };

        if (currentUserId) {
            loadReports();
        }
    }, [currentUserId]);

    // 선택된 보고서의 기본정보와 인원 복사
    const handleCopy = async (reportId: string) => {
        if (!reportId) return;

        const selectedOption = reportOptions.find(
            (opt) => String(opt.id) === reportId
        );
        if (!selectedOption) return;

        const workLog = selectedOption.workLog;

        // 기본정보 복사
        if (workLog.vessel) setVessel(workLog.vessel);
        if (workLog.engine) setEngine(workLog.engine);
        if (workLog.order_group) setOrderGroup(workLog.order_group);
        if (workLog.order_person) setOrderPerson(workLog.order_person);
        if (workLog.subject) setSubject(workLog.subject);

        // 출장지 복사
        if (workLog.location) {
            const locations = workLog.location.split(",").map((loc) => loc.trim()).filter(Boolean);
            setLocations(locations);
            setLocationCustom("");
        }

        // 운행차량 복사
        if (workLog.vehicle) {
            const vehicleArray = workLog.vehicle.split(",").map((v) => v.trim()).filter(Boolean);
            setVehicles(vehicleArray);
        } else {
            setVehicles([]);
        }

        // 인원 복사
        try {
            const { data: persons } = await supabase
                .from("work_log_persons")
                .select("person_name")
                .eq("work_log_id", workLog.id);

            if (persons && persons.length > 0) {
                const workerNames = Array.from(
                    new Set(persons.map((p) => p.person_name).filter(Boolean))
                );
                setWorkers(workerNames);
            }
        } catch (error) {
            console.error("인원 정보 로드 실패:", error);
        }
        
        // 복사 완료
        return Promise.resolve();
    };

    const selectOptions = useMemo(() => {
        return reportOptions.map((opt) => ({
            value: String(opt.id),
            label: opt.title,
        }));
    }, [reportOptions]);

    return (
        <div className="flex flex-col gap-2 relative z-10">
            <Select
                label="이전 작업 불러오기"
                placeholder={loading ? "로딩 중..." : "보고서 선택"}
                fullWidth
                options={selectOptions}
                value={selectedReportId}
                onChange={(value) => {
                    if (value && selectOptions.length > 0) {
                        // 선택된 값 즉시 설정 (모바일에서도 선택이 유지되도록)
                        setSelectedReportId(value);
                        // 복사 실행 (비동기로 실행하되 초기화는 하지 않음)
                        handleCopy(value).then(() => {
                            // 복사 완료 후 선택 초기화 (모바일 터치 이벤트가 완전히 끝난 후)
                            setTimeout(() => {
                                setSelectedReportId("");
                            }, 800);
                        });
                    }
                }}
                disabled={loading || selectOptions.length === 0}
            />
        </div>
    );
}
