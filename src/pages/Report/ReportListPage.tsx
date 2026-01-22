// src/pages/Report/ReportListPage.tsx
import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/common/Header";
import Table from "../../components/common/Table";
import Input from "../../components/common/Input";
import YearMonthSelector from "../../components/common/YearMonthSelector";
import Button from "../../components/common/Button";
import ActionMenu from "../../components/common/ActionMenu";
import Chip from "../../components/ui/Chip";
import ReportListSkeleton from "../../components/common/ReportListSkeleton";
import { IconMore, IconPlus, IconReport } from "../../components/icons/Icons";
import EmptyValueIndicator from "../Expense/components/EmptyValueIndicator";
import { getWorkLogs, deleteWorkLog, WorkLog } from "../../lib/workLogApi";
import { useToast } from "../../components/ui/ToastProvider";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import Avatar from "../../components/common/Avatar";
import { supabase } from "../../lib/supabase";

type ReportStatus = "submitted" | "pending" | "not_submitted";

interface ReportItem {
    id: number;
    title: string;
    place: string;
    supervisor: string;
    owner: string;
    ownerEmail?: string | null;
    ownerPosition?: string | null;
    date: string;
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
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [loading, setLoading] = useState(true);
    const itemsPerPage = 10;
    const navigate = useNavigate();
    const { showSuccess, showError, showInfo } = useToast();

// 날짜 포맷팅 함수 (ISO -> YYYY.MM.DD.)
const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}.${month}.${day}.`;
};



// ✅ 기간 표기용 (끝 점 없이)
const formatYMD = (dateString: string) => {
    const d = new Date(dateString);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${mm}.${dd}`;
};


// ✅ 기간 포맷팅 (start~end)
// - WorkLog 필드명이 프로젝트마다 다를 수 있어서 여러 후보를 안전하게 확인합니다.
const formatPeriod = (start?: string | null, end?: string | null) => {
    if (!start && !end) return null;

    const fmt = (d: string) => {
        const date = new Date(d);
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${y}.${m}.${day}`;
    };

    if (start && end) return `${fmt(start)}~${fmt(end)}`;
    if (start) return `${fmt(start)}`;
    return `${fmt(end!)}`;
};

// WorkLog를 ReportItem으로 변환
const convertToReportItem = (workLog: WorkLog): ReportItem => {
    return {
        id: workLog.id,
        // ✅ title은 loadReports에서 "기간 / 호선 / 목적"으로 다시 조합할 예정
        title: workLog.subject || "(제목 없음)",
        place: workLog.location || "—",
        supervisor: workLog.order_person || "—",
        owner: workLog.author || "(작성자 없음)",
        date: formatDate(workLog.created_at),
        status: workLog.is_draft ? "pending" : "submitted",
    };
};



    // 데이터 로드
    const loadReports = async () => {
        setLoading(true);
        try {
            let workLogs = await getWorkLogs();

            // ✅ staff면: 본인이 포함된 작업(보고서)만 필터링
            try {
                const { data: authData } = await supabase.auth.getUser();
                const user = authData?.user;

                if (user) {
                    const { data: myProfile, error: myProfileError } = await supabase
                        .from("profiles")
                        .select("role, name")
                        .eq("id", user.id)
                        .single();

                    if (myProfileError) {
                        console.error("내 프로필 조회 실패:", myProfileError);
                    } else {
                        const isStaff = myProfile?.role === "staff";
                        const myName = myProfile?.name?.trim();

                        if (isStaff && myName) {
                            const workLogIds = workLogs.map((w) => w.id).filter(Boolean);

                            if (workLogIds.length > 0) {
                                // 1) 해당 workLog들의 entry id / work_log_id 조회
                                const { data: wlEntries, error: wlEntriesError } =
                                    await supabase
                                        .from("work_log_entries_with_hours")
                                        .select("id, work_log_id")
                                        .in("work_log_id", workLogIds);

                                if (wlEntriesError) {
                                    console.error("entries 조회 실패:", wlEntriesError);
                                    workLogs = []; // 실패 시 staff는 안전하게 빈 목록
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
                                        workLogs = [];
                                    } else {
                                        // 2) 본인이 참여한 entry만 조회
                                        const { data: persons, error: personsError } =
                                            await supabase
                                                .from("work_log_entry_persons")
                                                .select("entry_id, person_name")
                                                .eq("person_name", myName)
                                                .in("entry_id", entryIds);

                                        if (personsError) {
                                            console.error("entry_persons 조회 실패:", personsError);
                                            workLogs = [];
                                        } else {
                                            const allowedWorkLogIds = new Set<number>();
                                            (persons || []).forEach((p: any) => {
                                                const entryId = Number(p.entry_id);
                                                const wlId = entryIdToWorkLogId.get(entryId);
                                                if (wlId) allowedWorkLogIds.add(wlId);
                                            });

                                            workLogs = workLogs.filter((w) =>
                                                allowedWorkLogIds.has(w.id)
                                            );
                                        }
                                    }
                                }
                            } else {
                                workLogs = [];
                            }
                        }
                    }
                }
            } catch (e) {
                console.error("staff 필터 처리 중 오류:", e);
            }

            const reportItems = workLogs.map(convertToReportItem);




// ✅ WorkLog id 목록
const workLogIds = workLogs.map((w) => w.id).filter(Boolean);

// ✅ workLogId -> { start, end } 기간 맵 (entries.dateFrom/dateTo 기반)
const periodMap = new Map<number, { start?: string; end?: string }>();

if (workLogIds.length > 0) {
    // ⚠️ 테이블명이 다르면 여기만 네 DB 테이블명으로 바꿔줘야 함
    // (예: workLog_entries, worklog_entries 등)
    const { data: entries, error: entriesError } = await supabase
        .from("work_log_entries_with_hours")
        .select("work_log_id, date_from, date_to")
        .in("work_log_id", workLogIds);

    if (entriesError) {
        console.error("기간(entries) 조회 실패:", entriesError);
    } else {
        (entries || []).forEach((e: any) => {
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
}

// ✅ 제목을 "기간 / 호선(vessel) / 출장목적(subject)"으로 재조합 (라벨 없이 내용만)
const reportsWithTitle = reportItems.map((item) => {
    const wl = workLogs.find((w) => w.id === item.id) as any;

    const vessel = wl?.vessel?.trim() ? wl.vessel.trim() : "";
    const purpose = wl?.subject?.trim() ? wl.subject.trim() : "";

    const p = periodMap.get(item.id);
    const start = p?.start ? formatYMD(p.start) : "";
    const end = p?.end ? formatYMD(p.end) : "";

    const period =
        start && end
            ? start === end
                ? start
                : `${start}~${end}`
            : (start || end || "");

    const parts = [period, vessel, purpose].filter(Boolean);
    const combinedTitle = parts.length ? parts.join(" / ") : "(제목 없음)";

    return { ...item, title: combinedTitle };
});


            // 작성자 이름 목록 수집
            const ownerNames = [
                ...new Set(
                    reportsWithTitle.map((item) => item.owner).filter(Boolean)
                ),
            ];

            // profiles 테이블에서 작성자 정보 조회 (이름으로)
            const { data: profiles, error: profilesError } = await supabase
                .from("profiles")
                .select("name, email, position")
                .in("name", ownerNames);

            if (profilesError) {
                console.error("프로필 조회 실패:", profilesError);
            }

            // 이름을 키로 하는 맵 생성
            const profileMap = new Map<
                string,
                { email: string | null; position: string | null }
            >();
            (profiles || []).forEach((profile: any) => {
                profileMap.set(profile.name, {
                    email: profile.email || null,
                    position: profile.position || null,
                });
            });

            // ReportItem에 프로필 정보 추가
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
        setCurrentPage(1);
    };

    const filtered = useMemo(() => {
        return reports.filter((r) => {
            const matchSearch =
                r.title.includes(search) ||
                r.owner.includes(search) ||
                r.place.includes(search);

            // 년도 필터링 (날짜 형식: "2025.11.24.")
            const matchYear =
                year === "년도 전체" ||
                r.date.startsWith(year.replace("년", ""));

            // 월 필터링 (날짜 형식: "2025.11.24.")
            let matchMonth = true;
            if (month !== "월 전체") {
                const monthNum = month.replace("월", "");
                // "2025.11.24." 형식에서 월 추출 (두 번째 숫자)
                const dateParts = r.date.split(".");
                matchMonth = dateParts.length > 1 && dateParts[1] === monthNum;
            }

            return matchSearch && matchYear && matchMonth;
        });
    }, [reports, search, year, month]);

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
                className={`fixed lg:static inset-y-0 left-0 z-30 w-[239px] h-screen shrink-0 transform transition-transform duration-300 ease-in-out ${
                    sidebarOpen
                        ? "translate-x-0"
                        : "-translate-x-full lg:translate-x-0"
                }`}
            >
                <Sidebar onClose={() => setSidebarOpen(false)} />
            </div>

            <div className="flex-1 flex flex-col h-screen overflow-hidden w-full">
                <Header
                    title="출장 보고서"
                    onMenuClick={() => setSidebarOpen(true)}
                    rightContent={
                        <Button
                            variant="primary"
                            size="lg"
                            onClick={() => navigate("/reportcreate")}
                            icon={<IconPlus />}
                        >
                            새 보고서 작성
                        </Button>
                    }
                />

                <div className="flex-1 overflow-y-auto px-4 lg:px-12 pt-6 pb-24">
                    {loading ? (
                        <ReportListSkeleton />
                    ) : (
                        <div className="flex flex-col gap-4">
                            {/* 검색 및 필터 섹션 */}
                            <div className="bg-white p-0">
                                <div className="flex flex-wrap items-center gap-3 justify-between">
                                    <Input
                                        value={search}
                                        onChange={setSearch}
                                        placeholder="검색어를 입력해 주세요"
                                        icon={
                                            <svg
                                                width="16"
                                                height="16"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                            >
                                                <circle cx="11" cy="11" r="7" />
                                                <line
                                                    x1="16.65"
                                                    y1="16.65"
                                                    x2="21"
                                                    y2="21"
                                                />
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
                                                {
                                                    value: "년도 전체",
                                                    label: "년도 전체",
                                                },
                                                {
                                                    value: "2025년",
                                                    label: "2025년",
                                                },
                                                {
                                                    value: "2026년",
                                                    label: "2026년",
                                                },
                                            ]}
                                            monthOptions={[
                                                {
                                                    value: "월 전체",
                                                    label: "월 전체",
                                                },
                                                { value: "1월", label: "1월" },
                                                { value: "2월", label: "2월" },
                                                { value: "3월", label: "3월" },
                                                { value: "4월", label: "4월" },
                                                { value: "5월", label: "5월" },
                                                { value: "6월", label: "6월" },
                                                { value: "7월", label: "7월" },
                                                { value: "8월", label: "8월" },
                                                { value: "9월", label: "9월" },
                                                {
                                                    value: "10월",
                                                    label: "10월",
                                                },
                                                {
                                                    value: "11월",
                                                    label: "11월",
                                                },
                                                {
                                                    value: "12월",
                                                    label: "12월",
                                                },
                                            ]}
                                        />
                                        {isFilterActive && (
                                            <button
                                                onClick={handleResetFilter}
                                                className="h-12 w-12 flex items-center justify-center border border-gray-200 rounded-xl bg-white hover:bg-gray-50 text-gray-600 hover:text-gray-900 transition-colors"
                                                aria-label="필터 초기화"
                                            >
                                                <svg
                                                    width="16"
                                                    height="16"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="2"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                >
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

                            {/* 테이블 섹션 */}
                            <Table
                                className="text-[14px]"
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
                                            return <EmptyValueIndicator />;
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
                                            return <EmptyValueIndicator />;
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
                                        render: (_, row: ReportItem) => (
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
                                        
                                                            window.open(
                                                                url,
                                                                "report_pdf_window",
                                                                [
                                                                    "width=980",
                                                                    "height=820",
                                                                    "left=120",
                                                                    "top=60",
                                                                    "scrollbars=yes",
                                                                    "resizable=yes",
                                                                    "toolbar=yes",
                                                                    "menubar=yes",
                                                                    "location=yes",
                                                                    "status=no",
                                                                    "noopener=yes",
                                                                    "noreferrer=yes",
                                                                ].join(",")
                                                            );
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
                                        ),
                                        
                                    },
                                ]}
                                data={currentData}
                                rowKey="id"
                                emptyText="결과가 없습니다."
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
                            `삭제 실패: ${
                                error.message ||
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
