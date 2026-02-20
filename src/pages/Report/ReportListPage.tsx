// src/pages/Report/ReportListPage.tsx
import { useMemo, useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/common/Header";
import Table from "../../components/common/Table";
import Tabs from "../../components/common/Tabs";
import Input from "../../components/common/Input";
import YearMonthSelector from "../../components/common/YearMonthSelector";
import Button from "../../components/common/Button";
import ActionMenu from "../../components/common/ActionMenu";
import Chip from "../../components/ui/Chip";
import ReportListSkeleton from "../../components/common/skeletons/ReportListSkeleton";
import { IconMore, IconMoreVertical, IconPlus, IconReport } from "../../components/icons/Icons";
import { getWorkLogs, deleteWorkLog, WorkLog } from "../../lib/workLogApi";
import { useToast } from "../../components/ui/ToastProvider";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import Avatar from "../../components/common/Avatar";
import { supabase } from "../../lib/supabase";
import useIsMobile from "../../hooks/useIsMobile";

type ReportStatus = "submitted" | "pending" | "not_submitted";

interface ReportItem {
    id: number;
    title: string;
    place: string;
    supervisor: string;
    owner: string;
    ownerEmail?: string | null;
    ownerPosition?: string | null;
    ownerId?: string | null;
    date: string;
    createdAt?: string;
    periodStart?: string;
    periodEnd?: string;
    status: ReportStatus;
}

export default function ReportListPage() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [year, setYear] = useState("년도 전체");
    const [month, setMonth] = useState("월 전체");
    const [openMenuId, setOpenMenuId] = useState<number | null>(null);
    const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [reports, setReports] = useState<ReportItem[]>([]);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [isStaffRole, setIsStaffRole] = useState(false);
    const [currentUserName, setCurrentUserName] = useState<string | null>(null);
    const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [loading, setLoading] = useState(true);
    // ✅ 탭 상태 추가 ("work" | "education")
    const [activeTab, setActiveTab] = useState<"work" | "education">("work");

    const itemsPerPage = 10;
    const navigate = useNavigate();
    const { showSuccess, showError } = useToast();
    const safetyToastOnceRef = useRef(false);
    const isMobile = useIsMobile();

    // ✅ 안전문구/슬로건 토스트 (세션당 1회)
    useEffect(() => {
        if (safetyToastOnceRef.current) return;
        safetyToastOnceRef.current = true;

        // ✅ pending이 없으면 절대 안 띄움
        if (sessionStorage.getItem("rtb:safety_toast_pending") !== "1") return;

        const run = async () => {
            let resolvedUserId: string | null = null;
            let isStaffMember = false;
            let staffName = "";

            try {
                // ✅ 여기서 바로 소비
                sessionStorage.setItem("rtb:safety_toast_pending", "0");

                const { data: settings } = await supabase
                    .from("safe_settings")
                    .select("safe_phrase, slogan_path")
                    .eq("id", 1)
                    .single();

                if (settings?.slogan_path) {
                    const { data: signed } = await supabase.storage
                        .from("safe-slogans")
                        .createSignedUrl(settings.slogan_path, 60 * 60);

                    if (signed?.signedUrl) {
                        showSuccess({
                            message: "",
                            hideIcon: true,
                            imageUrl: signed.signedUrl,
                            imageAlt: "안전 슬로건",
                            duration: 6000,
                        });
                    }
                }

                showSuccess({
                    message: settings?.safe_phrase?.trim()
                        ? settings.safe_phrase
                        : "등록된 안전 문구가 없습니다.",
                    duration: 6000,
                });
            } catch (e) {
                console.error(e);
            }
        };

        run();
    }, [showSuccess]);

    // 날짜 포맷팅 함수 (ISO -> YYYY.MM.DD.)
    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}.${month}.${day}.`;
    };

    // ✅ 기간 표기용 (한국어)
    const formatKoreanDate = (dateString: string) => {
        const d = new Date(dateString);
        const month = d.getMonth() + 1;
        const day = d.getDate();
        return { month, day };
    };

    const formatKoreanPeriod = (start?: string, end?: string) => {
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
    };

    const isRowOwner = (row: ReportItem) => {
        // 모든 가능한 조건을 확인하여 하나라도 일치하면 true 반환
        if (currentUserId && row.ownerId) {
            if (row.ownerId === currentUserId) return true;
        }
        if (currentUserEmail && row.ownerEmail) {
            if (
                row.ownerEmail.trim().toLowerCase() ===
                currentUserEmail.trim().toLowerCase()
            ) {
                return true;
            }
        }
        if (currentUserName && row.owner) {
            if (
                row.owner.trim().toLowerCase() === currentUserName.trim().toLowerCase()
            ) {
                return true;
            }
        }
        return false;
    };




    // WorkLog를 ReportItem으로 변환
    const convertToReportItem = (workLog: WorkLog): ReportItem => {
        return {
            id: workLog.id,
            // ✅ title은 loadReports에서 "기간 / 호선 / 목적"으로 다시 조합할 예정
            title: workLog.subject || "(제목 없음)",
            place: workLog.location || "",
            supervisor: workLog.order_person || "",
            owner: workLog.author || "(작성자 없음)",
            ownerId: workLog.created_by || null,
            date: formatDate(workLog.created_at),
            createdAt: workLog.created_at || "",
            status: workLog.is_draft ? "pending" : "submitted",
        };
    };

    // 데이터 로드
    const loadReports = async () => {
        setLoading(true);
        let resolvedUserId: string | null = null;
        let resolvedUserName: string | null = null;
        let resolvedUserEmail: string | null = null;
        let isStaffMember = false;

        try {
            let workLogs = await getWorkLogs();

            // ✅ staff면: 본인이 포함된 작업(보고서)만 필터링
            try {
                const { data: authData } = await supabase.auth.getUser();
                const user = authData?.user;
                resolvedUserId = user?.id ?? null;
                resolvedUserEmail = user?.email ?? null;

                if (user) {
                    const { data: myProfile, error: myProfileError } = await supabase
                        .from("profiles")
                        .select("role, name")
                        .eq("id", user.id)
                        .single();

                    if (myProfileError) {
                        console.error("내 프로필 조회 실패:", myProfileError);
                    } else {
                        isStaffMember = myProfile?.role === "staff";
                        const profileName = myProfile?.name?.trim() || "";
                        resolvedUserName = profileName || null;

                        if (isStaffMember) {
                            // ✅ staff는 "내가 작성한 보고서"는 항상 보이게 + "내가 참석한 보고서"도 보이게(합집합)
                            const myId = user.id;
                        
                            const myOwnIds = new Set<number>(
                                workLogs
                                    .filter((w: any) => w.created_by === myId)
                                    .map((w) => w.id)
                                    .filter(Boolean)
                            );
                        
                            // profileName이 없으면 참석자 기반 필터링이 불가하므로, 작성한 것만 노출
                            if (!profileName) {
                                workLogs = workLogs.filter((w) => myOwnIds.has(w.id));
                            } else {
                                const workLogIds = workLogs.map((w) => w.id).filter(Boolean);
                        
                                if (workLogIds.length > 0) {
                                    // 1) 해당 workLog들의 entry id / work_log_id 조회
                                    const { data: wlEntries, error: wlEntriesError } = await supabase
                                        .from("work_log_entries_with_hours")
                                        .select("id, work_log_id")
                                        .in("work_log_id", workLogIds);
                        
                                    if (wlEntriesError) {
                                        console.error("entries 조회 실패:", wlEntriesError);
                                        // ✅ 실패해도 "내가 작성한 것"은 유지
                                        workLogs = workLogs.filter((w) => myOwnIds.has(w.id));
                                    } else {
                                        const entryIdToWorkLogId = new Map<number, number>();
                                        const entryIds: number[] = [];
                        
                                        (wlEntries || []).forEach((e: any) => {
                                            const entryId = Number(e.id);
                                            const wlId = Number(e.work_log_id);
                                            if (!entryId || !wlId) return;
                                            entryIdToWorkLogId.set(entryId, wlId);
                                            entryIds.push(entryId);
                                        });
                        
                                        if (entryIds.length === 0) {
                                            // ✅ entry가 없어도 내가 작성한 것은 보이게
                                            workLogs = workLogs.filter((w) => myOwnIds.has(w.id));
                                        } else {
                                            // 2) 본인이 참여한 entry만 조회
                                            const { data: persons, error: personsError } = await supabase
                                                .from("work_log_entry_persons")
                                                .select("entry_id, person_name")
                                                .eq("person_name", profileName)
                                                .in("entry_id", entryIds);
                        
                                            if (personsError) {
                                                console.error("entry_persons 조회 실패:", personsError);
                                                // ✅ 실패해도 내가 작성한 것은 보이게
                                                workLogs = workLogs.filter((w) => myOwnIds.has(w.id));
                                            } else {
                                                const allowedWorkLogIds = new Set<number>([...myOwnIds]);
                        
                                                (persons || []).forEach((p: any) => {
                                                    const entryId = Number(p.entry_id);
                                                    const wlId = entryIdToWorkLogId.get(entryId);
                                                    if (wlId) allowedWorkLogIds.add(wlId);
                                                });
                        
                                                workLogs = workLogs.filter((w) => allowedWorkLogIds.has(w.id));
                                            }
                                        }
                                    }
                                } else {
                                    // ✅ workLogs가 비어있으면 그대로(=어차피 없음)
                                    workLogs = [];
                                }
                            }
                        }
                    }
                }
            } catch (e) {
                console.error("staff 필터 처리 중 오류:", e);
            }

            setCurrentUserId(resolvedUserId);
            setCurrentUserName(resolvedUserName);
            setCurrentUserEmail(resolvedUserEmail);
            setIsStaffRole(isStaffMember);

            const reportItems = workLogs.map(convertToReportItem);

            // ✅ WorkLog id 목록
            const workLogIds = workLogs.map((w) => w.id).filter(Boolean);

            // ✅ workLogId -> { start, end } 기간 맵 (entries.dateFrom/dateTo 기반)
            const periodMap = new Map<number, { start?: string; end?: string }>();

            // ✅ 작성자 이름 목록 수집 (병렬 처리 준비)
            const ownerNames = [
                ...new Set(
                    reportItems.map((item) => item.owner).filter(Boolean)
                ),
            ];

            // ✅ profiles 맵 초기화 (스코프 문제 해결)
            let profileMap = new Map<
                string,
                { email: string | null; position: string | null }
            >();

            // ✅ entries와 profiles를 병렬로 조회하여 성능 개선
            if (workLogIds.length > 0) {
                const [entriesResult, profilesResult] = await Promise.allSettled([
                    supabase
                        .from("work_log_entries_with_hours")
                        .select("work_log_id, date_from, date_to")
                        .in("work_log_id", workLogIds),
                    ownerNames.length > 0
                        ? supabase
                            .from("profiles")
                            .select("name, email, position")
                            .in("name", ownerNames)
                        : Promise.resolve({ data: [], error: null }),
                ]);

                // entries 처리
                if (entriesResult.status === "fulfilled") {
                    const { data: entries, error: entriesError } = entriesResult.value;
                    if (entriesError) {
                        console.error("기간(entries) 조회 실패:", entriesError);
                    } else if (entries) {
                        entries.forEach((e: any) => {
                            const id = Number(e.work_log_id);
                            if (!id) return;

                            const s = e.date_from ? String(e.date_from) : "";
                            const t = e.date_to ? String(e.date_to) : "";

                            const prev = periodMap.get(id);

                            // start = 최소 dateFrom, end = 최대 dateTo
                            const nextStart =
                                !prev?.start || (s && s < prev.start) ? (s || prev?.start) : prev.start;
                            const nextEnd =
                                !prev?.end || (t && t > prev.end) ? (t || prev?.end) : prev.end;

                            periodMap.set(id, { start: nextStart, end: nextEnd });
                        });
                    }
                } else {
                    console.error("기간(entries) 조회 실패:", entriesResult.reason);
                }

                // profiles 처리
                if (profilesResult.status === "fulfilled") {
                    const { data: profiles, error: profilesError } = profilesResult.value;
                    if (profilesError) {
                        console.error("프로필 조회 실패:", profilesError);
                    } else if (profiles) {
                        profiles.forEach((profile: any) => {
                            profileMap.set(profile.name, {
                                email: profile.email || null,
                                position: profile.position || null,
                            });
                        });
                    }
                } else {
                    console.error("프로필 조회 실패:", profilesResult.reason);
                }
            }

            // ✅ 제목을 "기간 / 호선(vessel) / 출장목적(subject)"으로 재조합 (라벨 없이 내용만)
            const reportsWithTitle = reportItems.map((item) => {
                const wl = workLogs.find((w) => w.id === item.id) as any;

                const vessel = wl?.vessel?.trim() ? wl.vessel.trim() : "";
                const purpose = wl?.subject?.trim() ? wl.subject.trim() : "";

                const p = periodMap.get(item.id);
                const period = formatKoreanPeriod(p?.start, p?.end);

                const parts = [period, vessel, purpose].filter(Boolean);
                const combinedTitle = parts.length ? parts.join(" ") : "(제목 없음)";

                return {
                    ...item,
                    title: combinedTitle,
                    periodStart: p?.start,
                    periodEnd: p?.end,
                };
            });


            // ReportItem에 프로필 정보 추가 (profileMap은 위에서 이미 생성됨)
            const reportsWithProfiles = reportsWithTitle.map((item) => {
                const profile = profileMap.get(item.owner);
                return {
                    ...item,
                    ownerEmail: profile?.email || null,
                    ownerPosition: profile?.position || null,
                };
            });

            setReports(reportsWithProfiles);
        } catch (error) {
            console.error("Error loading reports:", error);
            showError("보고서 목록을 불러오는 중 오류가 발생했습니다.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadReports();
    }, []);

    const isFilterActive = year !== "년도 전체" || month !== "월 전체";

    const handleResetFilter = () => {
        setYear("년도 전체");
        setMonth("월 전체");
        setSearch("");
        setCurrentPage(1);
    };

    const filtered = useMemo(() => {
        // ... (getRange, overlapsMonth 함수 생략 - 기존 코드 유지)
        const getRange = (r: ReportItem) => {
            const startRaw = r.periodStart || r.periodEnd || r.createdAt || "";
            const endRaw = r.periodEnd || r.periodStart || r.createdAt || "";
            if (!startRaw || !endRaw) return null;
            const start = new Date(startRaw);
            const end = new Date(endRaw);
            if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
                return null;
            }
            if (start > end) return { start: end, end: start };
            return { start, end };
        };

        const overlapsMonth = (
            range: { start: Date; end: Date },
            monthNum: number,
            yearNum?: number
        ) => {
            if (yearNum) {
                const monthStart = new Date(yearNum, monthNum - 1, 1);
                const monthEnd = new Date(yearNum, monthNum, 0, 23, 59, 59, 999);
                return range.start <= monthEnd && range.end >= monthStart;
            }
            const cursor = new Date(range.start.getFullYear(), range.start.getMonth(), 1);
            const endMonth = new Date(range.end.getFullYear(), range.end.getMonth(), 1);
            let guard = 0;
            while (cursor <= endMonth && guard < 120) {
                if (cursor.getMonth() + 1 === monthNum) return true;
                cursor.setMonth(cursor.getMonth() + 1);
                guard += 1;
            }
            return false;
        };

        const q = search.trim().toLowerCase();
        return reports.filter((r) => {
            // 1. 교육 보고서 필터링 (제목에 '교육' 포함 여부)
            const isEducation = r.title.includes("교육");

            // 탭에 따른 필터링
            if (activeTab === "education") {
                if (!isEducation) return false;
            } else {
                // work 탭에서는 교육 보고서 제외
                if (isEducation) return false;
            }

            const matchSearch =
                q === "" ||
                r.title.toLowerCase().includes(q) ||
                r.owner.toLowerCase().includes(q) ||
                r.place.toLowerCase().includes(q);

            const range = getRange(r);

            const matchYear =
                year === "년도 전체" ||
                (range &&
                    Number(year.replace("년", "")) >= range.start.getFullYear() &&
                    Number(year.replace("년", "")) <= range.end.getFullYear());

            let matchMonth = true;
            if (month !== "월 전체") {
                const monthNum = parseInt(month.replace("월", ""), 10);
                const yearNum =
                    year === "년도 전체"
                        ? undefined
                        : Number(year.replace("년", ""));
                matchMonth = !!range && overlapsMonth(range, monthNum, yearNum);
            }

            return matchSearch && matchYear && matchMonth;
        });
    }, [reports, search, year, month, activeTab]);

    useEffect(() => {
        setCurrentPage(1);
    }, [search, year, month, activeTab]);

    const totalPages = Math.ceil(filtered.length / itemsPerPage);
    const currentData = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        return filtered.slice(startIndex, endIndex);
    }, [filtered, currentPage, itemsPerPage]);

    return (
        <div className="flex h-screen bg-white overflow-hidden">
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-20 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            <div
                className={`fixed lg:static inset-y-0 left-0 z-30 w-[260px] max-w-[88vw] lg:max-w-none lg:w-[239px] h-screen shrink-0 transform transition-transform duration-300 ease-in-out ${sidebarOpen
                    ? "translate-x-0"
                    : "-translate-x-full lg:translate-x-0"
                    }`}
            >
                <Sidebar onClose={() => setSidebarOpen(false)} />
            </div>

            <div className="flex-1 flex flex-col h-screen overflow-hidden w-full">
                <Header
                    title="보고서 목록"
                    onMenuClick={() => setSidebarOpen(true)}
                    bottomContent={
                        <div className="px-4 md:px-6">
                            <Tabs
                                items={[
                                    { value: "work", label: "출장 보고서" },
                                    { value: "education", label: "교육 보고서" },
                                ]}
                                value={activeTab}
                                onChange={(value) => setActiveTab(value as "work" | "education")}
                            />
                        </div>
                    }
                    rightContent={
                        !isMobile ? (
                            <Button
                                variant="primary"
                                size="lg"
                                onClick={() => navigate("/reportcreate")}
                                icon={<IconPlus />}
                            >
                                새 보고서 작성
                            </Button>
                        ) : undefined
                    }
                />

                <div className="flex-1 overflow-y-auto px-4 md:px-6 lg:px-12 pt-4 md:pt-6 pb-24 relative">
                    {loading ? (
                        isMobile ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-4">
                                <div className="w-10 h-10 border-2 border-gray-200 border-t-primary-500 rounded-full animate-spin" />
                                <p className="text-sm text-gray-500">로딩 중...</p>
                            </div>
                        ) : (
                            <ReportListSkeleton />
                        )
                    ) : isMobile ? (
                        <div className="flex flex-col gap-4">
                            <div className="flex flex-col gap-3">
                                <Input
                                    value={search}
                                    onChange={setSearch}
                                    placeholder="검색어를 입력해 주세요"
                                    icon={
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <circle cx="11" cy="11" r="7" />
                                            <line x1="16.65" y1="16.65" x2="21" y2="21" />
                                        </svg>
                                    }
                                    iconPosition="left"
                                    className="w-full"
                                />
                                <div className="flex items-center gap-2">
                                    <YearMonthSelector
                                        className="flex-1 min-w-0"
                                        year={year}
                                        month={month}
                                        onYearChange={(value) => {
                                            setYear(value);
                                            setCurrentPage(1);
                                        }}
                                        onMonthChange={(value) => {
                                            setMonth(value);
                                            setCurrentPage(1);
                                        }}
                                        yearOptions={[
                                            { value: "년도 전체", label: "년도 전체" },
                                            { value: "2025년", label: "2025년" },
                                            { value: "2026년", label: "2026년" },
                                        ]}
                                        monthOptions={[
                                            { value: "월 전체", label: "월 전체" },
                                            { value: "1월", label: "1월" },
                                            { value: "2월", label: "2월" },
                                            { value: "3월", label: "3월" },
                                            { value: "4월", label: "4월" },
                                            { value: "5월", label: "5월" },
                                            { value: "6월", label: "6월" },
                                            { value: "7월", label: "7월" },
                                            { value: "8월", label: "8월" },
                                            { value: "9월", label: "9월" },
                                            { value: "10월", label: "10월" },
                                            { value: "11월", label: "11월" },
                                            { value: "12월", label: "12월" },
                                        ]}
                                    />
                                    {isFilterActive && (
                                        <button
                                            onClick={handleResetFilter}
                                            className="h-12 w-12 flex items-center justify-center border border-gray-200 rounded-xl bg-white hover:bg-gray-50 text-gray-600 shrink-0"
                                            aria-label="필터 초기화"
                                        >
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                                                <path d="M21 3v5h-5" />
                                                <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                                                <path d="M3 21v-5h5" />
                                            </svg>
                                        </button>
                                    )}
                                </div>
                            </div>
                            {filtered.length === 0 ? (
                                <div className="py-10 text-center text-gray-500 text-sm">조회된 보고서가 없습니다.</div>
                            ) : (
                                <ul className="flex flex-col gap-3 pb-2">
                                    {filtered.map((row) => {
                                        const statusConfig: Record<ReportStatus, { color: string; label: string }> = {
                                            submitted: { color: "blue-500", label: "제출 완료" },
                                            pending: { color: "green-600", label: "임시저장" },
                                            not_submitted: { color: "gray-400", label: "미제출" },
                                        };
                                        const { color, label } = statusConfig[row.status];
                                        const isOwner = isRowOwner(row);
                                        const canManageRow = !(isStaffRole && !isOwner);
                                        return (
                                            <li key={row.id}>
                                                <div
                                                    className="rounded-xl border border-gray-200 bg-white p-4 active:bg-gray-50 transition-colors flex items-start gap-3"
                                                    role="button"
                                                    tabIndex={0}
                                                    onClick={() => navigate(`/report/${row.id}`)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === "Enter" || e.key === " ") {
                                                            e.preventDefault();
                                                            navigate(`/report/${row.id}`);
                                                        }
                                                    }}
                                                >
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className="text-[16px] font-semibold text-gray-900 truncate">
                                                                {row.title || "—"}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-2 mt-1.5 text-[13px] text-gray-500">
                                                            <span>{row.date}</span>
                                                            {row.place?.trim() && (
                                                                <>
                                                                    <span aria-hidden>·</span>
                                                                    <span className="truncate">{row.place}</span>
                                                                </>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                                                            <Avatar
                                                                email={row.ownerEmail ?? null}
                                                                position={row.ownerPosition ?? null}
                                                                size={20}
                                                            />
                                                            <span className="text-[13px] text-gray-600">{row.owner}</span>
                                                            <Chip color={color} variant="solid" size="sm">
                                                                {label}
                                                            </Chip>
                                                        </div>
                                                    </div>
                                                    {canManageRow && (

                                                    <button
                                                        type="button"
                                                        className="rounded-lg hover:bg-gray-100 text-gray-500 -mr-1 shrink-0"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setOpenMenuId(openMenuId === row.id ? null : row.id);
                                                            setMenuAnchor(openMenuId === row.id ? null : e.currentTarget);
                                                        }}
                                                        aria-label="메뉴"
                                                    >
                                                        <IconMoreVertical className="w-6 h-6" />
                                                    </button>

                                                    )}
                                                </div>
                                                {canManageRow && (

                                            <ActionMenu
                                                    isOpen={openMenuId === row.id}
                                                    anchorEl={menuAnchor}
                                                    onClose={() => {
                                                        setOpenMenuId(null);
                                                        setMenuAnchor(null);
                                                    }}
                                                    onEdit={() => navigate(`/report/${row.id}/edit`)}
                                                    onDelete={() => {
                                                        setDeleteTargetId(row.id);
                                                        setDeleteConfirmOpen(true);
                                                    }}
                                                    onDownload={() => {
                                                        const url = `/report/pdf?id=${row.id}&autoPrint=1`;
                                                        window.open(url, "_blank");
                                                    }}
                                                    width="w-44"
                                                >
                                                    <button
                                                        className="w-full px-3 py-2.5 text-left text-[15px] hover:bg-gray-50 active:bg-gray-100 text-gray-800 flex items-center gap-3 rounded-lg transition-colors cursor-pointer"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            navigate(`/report/${row.id}`);
                                                        }}
                                                    >
                                                        <div className="w-5 flex justify-center text-gray-500">
                                                            <IconReport />
                                                        </div>
                                                        보고서 보기
                                                    </button>
                                                </ActionMenu>

                                            )}
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4">
                            <div className="mt-3">
                                <div className="flex flex-wrap items-center gap-3 justify-between">
                                    <Input
                                        value={search}
                                        onChange={setSearch}
                                        placeholder="검색어를 입력해 주세요"
                                        icon={
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <circle cx="11" cy="11" r="7" />
                                                <line x1="16.65" y1="16.65" x2="21" y2="21" />
                                            </svg>
                                        }
                                        iconPosition="left"
                                        className="flex-1 min-w-[300px]"
                                    />
                                    <div className="flex items-center gap-2 flex-wrap justify-end">
                                        <YearMonthSelector
                                            year={year}
                                            month={month}
                                            onYearChange={(value) => {
                                                setYear(value);
                                                setCurrentPage(1);
                                            }}
                                            onMonthChange={(value) => {
                                                setMonth(value);
                                                setCurrentPage(1);
                                            }}
                                            yearOptions={[
                                                { value: "년도 전체", label: "년도 전체" },
                                                { value: "2025년", label: "2025년" },
                                                { value: "2026년", label: "2026년" },
                                            ]}
                                            monthOptions={[
                                                { value: "월 전체", label: "월 전체" },
                                                { value: "1월", label: "1월" },
                                                { value: "2월", label: "2월" },
                                                { value: "3월", label: "3월" },
                                                { value: "4월", label: "4월" },
                                                { value: "5월", label: "5월" },
                                                { value: "6월", label: "6월" },
                                                { value: "7월", label: "7월" },
                                                { value: "8월", label: "8월" },
                                                { value: "9월", label: "9월" },
                                                { value: "10월", label: "10월" },
                                                { value: "11월", label: "11월" },
                                                { value: "12월", label: "12월" },
                                            ]}
                                        />
                                        {isFilterActive && (
                                            <button
                                                onClick={handleResetFilter}
                                                className="h-12 w-12 flex items-center justify-center border border-gray-200 rounded-xl bg-white hover:bg-gray-50 text-gray-600 hover:text-gray-900 transition-colors"
                                                aria-label="필터 초기화"
                                            >
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                                                    <path d="M21 3v5h-5" />
                                                    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                                                    <path d="M3 21v-5h5" />
                                                </svg>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <Table
                                className="text-[14px]"
                                emptyText="조회된 보고서가 없습니다."
                                columns={[
                                    {
                                        key: "owner",
                                        label: "작성자",
                                        width: "12%",
                                        render: (_, row: ReportItem) => {
                                            return (
                                                <div className="flex items-center gap-2">
                                                    <Avatar
                                                        email={
                                                            row.ownerEmail ||
                                                            null
                                                        }
                                                        size={24}
                                                        position={
                                                            row.ownerPosition ||
                                                            null
                                                        }
                                                    />
                                                    <span className="text-gray-900">
                                                        {row.owner}
                                                    </span>
                                                </div>
                                            );
                                        },
                                    },
                                    {
                                        key: "title",
                                        label: "제목",
                                        width: "36%",
                                    },
                                    {
                                        key: "place",
                                        label: "출장지",
                                        width: "12%",
                                        render: (value) => {
                                            if (
                                                value &&
                                                value.trim() &&
                                                value !== "—"
                                            ) {
                                                return (
                                                    <span className="text-gray-600">
                                                        {value}
                                                    </span>
                                                );
                                            }
                                            return "";
                                        },
                                    },
                                    {
                                        key: "supervisor",
                                        label: "참관감독",
                                        width: "12%",
                                        render: (value) => {
                                            if (
                                                value &&
                                                value.trim() &&
                                                value !== "—"
                                            ) {
                                                return (
                                                    <span className="text-gray-500">
                                                        {value}
                                                    </span>
                                                );
                                            }
                                            return "";
                                        },
                                    },
                                    {
                                        key: "date",
                                        label: "작성일",
                                        width: "12%",
                                        render: (value) => (
                                            <span className="text-gray-600">
                                                {value}
                                            </span>
                                        ),
                                    },
                                    {
                                        key: "status",
                                        label: "상태",
                                        width: "10%",
                                        render: (_, row: ReportItem) => {
                                            const statusConfig: Record<
                                                ReportStatus,
                                                { color: string; label: string }
                                            > = {
                                                submitted: {
                                                    color: "blue-500",
                                                    label: "제출 완료",
                                                },
                                                pending: {
                                                    color: "green-600",
                                                    label: "임시저장",
                                                },
                                                not_submitted: {
                                                    color: "gray-400",
                                                    label: "미제출",
                                                },
                                            };

                                            const { color, label } =
                                                statusConfig[row.status];

                                            return (
                                                <Chip
                                                    color={color}
                                                    variant="solid"
                                                    size="md"
                                                >
                                                    {label}
                                                </Chip>
                                            );
                                        },
                                    },
                                    {
                                        key: "actions",
                                        label: "",
                                        width: "12%",
                                        align: "right",
                                        showEmptyIndicator: false,
                                        render: (_, row: ReportItem) => {
                                        const isOwner = isRowOwner(row);
                                        const canManageRow = !(isStaffRole && !isOwner);
                                        if (!canManageRow) {
                                            return null;
                                        }
                                        return (
                                            <div className="relative inline-flex">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setOpenMenuId(openMenuId === row.id ? null : row.id);
                                                        setMenuAnchor(openMenuId === row.id ? null : e.currentTarget);
                                                    }}
                                                    className="p-2 rounded hover:bg-gray-100 text-gray-600"
                                                    aria-label="행 메뉴"
                                                >
                                                    <IconMore className="w-[18px] h-[18px]" />
                                                </button>

                                                {/* ✅ ActionMenu 영역 클릭 시 row 클릭으로 버블링 방지 */}
                                                <div
                                                    onMouseDown={(e) => e.stopPropagation()}
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <ActionMenu
                                                        isOpen={openMenuId === row.id}
                                                        anchorEl={menuAnchor}
                                                        onClose={() => {
                                                            setOpenMenuId(null);
                                                            setMenuAnchor(null);
                                                        }}
                                                        onEdit={() => {
                                                            navigate(`/report/${row.id}/edit`);
                                                        }}
                                                        onDelete={() => {
                                                            setDeleteTargetId(row.id);
                                                            setDeleteConfirmOpen(true);
                                                        }}
                                                        onDownload={() => {
                                                            const url = `/report/pdf?id=${row.id}&autoPrint=1`;
                                                            window.open(url, "_blank");
                                                        }}
                                                        width="w-44"
                                                    >
                                                        {/* ✅ (제일 위) 보고서 보기 */}
                                                        <button
                                                            className="w-full px-3 py-2.5 text-left text-[15px] hover:bg-gray-50 active:bg-gray-100 text-gray-800 flex items-center gap-3 rounded-lg transition-colors cursor-pointer"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                navigate(`/report/${row.id}`);
                                                            }}
                                                        >
                                                            <div className="w-5 flex justify-center text-gray-500">
                                                                <IconReport />
                                                            </div>
                                                            보고서 보기
                                                        </button>
                                                    </ActionMenu>
                                                </div>
                                            </div>
                                        );
                                        },

                                    },
                                ]}
                                data={currentData}
                                rowKey="id"
                                onRowClick={(row: ReportItem) => {
                                    navigate(`/report/${row.id}`);
                                }}
                                pagination={{
                                    currentPage,
                                    totalPages,
                                    onPageChange: setCurrentPage,
                                }}
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* 모바일 전용 FAB: 새 보고서 작성 */}
            {isMobile && (
                <div className="fixed bottom-6 right-4 z-10">
                    <Button
                        variant="primary"
                        size="lg"
                        onClick={() => navigate("/reportcreate")}
                        icon={<IconPlus />}
                        className="shadow-lg rounded-full h-14 px-5"
                    >
                        새 보고서 작성
                    </Button>
                </div>
            )}

            {/* 삭제 확인 다이얼로그 */}
            <ConfirmDialog
                isOpen={deleteConfirmOpen}
                onClose={() => {
                    setDeleteConfirmOpen(false);
                    setDeleteTargetId(null);
                }}
                onConfirm={async () => {
                    if (!deleteTargetId) return;
                    setIsDeleting(true);
                    try {
                        await deleteWorkLog(deleteTargetId);
                        await loadReports();
                        showSuccess("삭제되었습니다.");
                        setDeleteConfirmOpen(false);
                        setDeleteTargetId(null);
                    } catch (error: any) {
                        console.error("Error deleting report:", error);
                        showError(
                            `삭제 실패: ${error.message ||
                            "알 수 없는 오류가 발생했습니다."
                            }`
                        );
                    } finally {
                        setIsDeleting(false);
                    }
                }}
                title="삭제 확인"
                message="정말 삭제하시겠습니까?"
                confirmText="삭제"
                cancelText="취소"
                confirmVariant="danger"
                isLoading={isDeleting}
            />
        </div>
    );
}
