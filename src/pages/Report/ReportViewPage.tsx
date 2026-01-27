// src/pages/Report/ReportViewPage.tsx
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/common/Header";
import CreationSkeleton from "../../components/common/CreationSkeleton";
import SectionCard from "../../components/ui/SectionCard";
import Button from "../../components/common/Button";
import { IconArrowBack } from "../../components/icons/Icons";
import EmptyValueIndicator from "../Expense/components/EmptyValueIndicator";
import { getWorkLogById } from "../../lib/workLogApi";
import { getWorkLogReceipts } from "../../lib/workLogApi";
import { useToast } from "../../components/ui/ToastProvider";
import TimelineSummarySection from "../../components/sections/TimelineSummarySection";
import { useWorkReportStore } from "../../store/workReportStore";

type ViewData = {
    workLog: any;
    workers: string[];
    entries: any[];
    expenses: any[];
    materials: any[];
};

type ReceiptItem = {
    id: number;
    category: string;
    file_url: string;
    original_name?: string;
    mime_type?: string;
};

function normalizeTime(time?: string) {
    if (!time) return "";

    const t = String(time).trim();

    // 05:00:00 -> 05:00
    const hhmmss = t.match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
    if (hhmmss) return `${hhmmss[1].padStart(2, "0")}:${hhmmss[2]}`;

    // 5:00 -> 05:00, 05:00 유지
    const hhmm = t.match(/^(\d{1,2}):(\d{2})$/);
    if (hhmm) return `${hhmm[1].padStart(2, "0")}:${hhmm[2]}`;

    // "5" -> 05:00
    const hhOnly = t.match(/^(\d{1,2})$/);
    if (hhOnly) return `${hhOnly[1].padStart(2, "0")}:00`;

    // 혹시 "5시" 같은 값이 오면 숫자만 추출해서 처리
    const hhKorean = t.match(/^(\d{1,2})\s*시/);
    if (hhKorean) return `${hhKorean[1].padStart(2, "0")}:00`;

    return "";
}


function toKoreanTime(time?: string) {
    const norm = normalizeTime(time);
    if (!norm) return "";

    const [hh, mm] = norm.split(":");
    if (!hh) return norm;
    if (!mm || mm === "00") return `${Number(hh)}시`;
    return `${Number(hh)}시 ${mm}분`;
}

function calcMinutes(params: {
    dateFrom: string;
    timeFrom?: string;
    dateTo: string;
    timeTo?: string;
}) {
    const { dateFrom, timeFrom, dateTo, timeTo } = params;

    const from = normalizeTime(timeFrom);
    const to = normalizeTime(timeTo);

    if (!dateFrom || !dateTo || !from || !to) return 0;

    const start = toDateSafe(dateFrom, from);
    const end = toDateSafe(dateTo, to);


    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
    if (end <= start) return 0;

    return Math.floor((end.getTime() - start.getTime()) / 60000);
}

function formatHoursMinutes(totalMinutes: number) {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    if (totalMinutes <= 0) return "—";
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

    return new Date(
        `${date}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00`
    );
}

// ✅ 날짜跨越 엔트리를 "날짜별 카드"로 분할(표시용)
function splitEntryByDayForDisplay(entry: any, fallbackKey: string) {
    const timeFrom = normalizeTime(entry.timeFrom) || "00:00";
    const timeTo = normalizeTime(entry.timeTo) || "00:00";

    // 같은 날이면 그대로
    if (entry.dateFrom === entry.dateTo) {
        return [
            {
                ...entry,
                __segKey: String(entry.id ?? fallbackKey),
            },
        ];
    }

    const start = toDateSafe(entry.dateFrom, timeFrom);
    const end = toDateSafe(entry.dateTo, timeTo);

    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
        return [
            {
                ...entry,
                __segKey: String(entry.id ?? fallbackKey),
            },
        ];
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
        const segTimeTo = isLast ? timeTo : "24:00"; // ✅ 중간 날짜는 24:00까지

        results.push({
            ...entry,
            dateFrom: d,
            dateTo: d,
            timeFrom: segTimeFrom,
            timeTo: segTimeTo,
            __segKey: `${entry.id ?? fallbackKey}__${d}`, // 날짜별 카드 키
        });

        cur.setDate(cur.getDate() + 1);
    }

    return results;
}

const NO_LUNCH_TEXT = "점심 안 먹고 작업진행(12:00~13:00)";

function getExpenseTypeRowClass(t?: string) {
    if (!t) return "bg-white";
    if (["조식", "중식", "석식"].includes(t)) return "bg-orange-50";
    if (t === "숙박") return "bg-blue-50";
    if (t === "유류비") return "bg-green-50";
    return "bg-pink-50";
}

function formatDate(dateString?: string) {
    if (!dateString) return "";
    const d = new Date(dateString);
    const yy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yy}.${mm}.${dd}.`;
}

function formatDateKoreanMD(dateString?: string) {
    if (!dateString) return "";
    const d = new Date(dateString);
    const m = d.getMonth() + 1;
    const day = d.getDate();
    return `${m}월 ${day}일`;
}

export default function ReportViewPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { showError } = useToast();
    const { setWorkLogEntries } = useWorkReportStore();

    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<ViewData | null>(null);

    const [receipts, setReceipts] = useState<ReceiptItem[]>([]);
    const [receiptLoading, setReceiptLoading] = useState(false);

    const [previewFile, setPreviewFile] = useState<{
        url: string;
        name: string;
        type: string;
    } | null>(null);

    const openPreview = (url: string, name: string, type: string) => {
        setPreviewFile({ url, name, type });
    };
    const closePreview = () => setPreviewFile(null);

    const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
    const toggleCard = (key: string) => {
    setExpandedCards((prev) => ({ ...prev, [key]: !prev[key] }));
    };
    
    useEffect(() => {
        const load = async () => {
            if (!id) {
                showError("보고서 ID가 없습니다.");
                navigate("/report");
                return;
            }

            setLoading(true);
            try {
                const res = await getWorkLogById(Number(id));
                if (!res) {
                    showError("보고서를 찾을 수 없습니다.");
                    navigate("/report");
                    return;
                }
                setData(res as ViewData);


// ✅ TimelineSummarySection을 위한 WorkLogEntry 형식으로 변환하여 store에 주입
try {
    const viewData = res as ViewData;

    const mapped = (viewData.entries || []).map((e: any, idx: number) => {
        const note = String(e.note ?? "");

        const noLunch =
            !!e.noLunch ||
            !!e.lunch_worked ||
            note.includes("점심 안 먹고 작업진행(12:00~13:00)") ||
            note.includes("점심 안먹고 작업진행(12:00~13:00)");

        return {
            id: e.id ?? idx + 1,
            dateFrom: e.dateFrom ?? "",
            timeFrom: e.timeFrom ?? "",
            dateTo: e.dateTo ?? "",
            timeTo: e.timeTo ?? "",
            descType: (e.descType ?? "") as "작업" | "이동" | "대기" | "",
            details: e.details ?? "",
            persons: Array.isArray(e.persons) ? e.persons : [],
            note,
            noLunch,
            moveFrom: e.moveFrom,
            moveTo: e.moveTo,
        };
    });

    setWorkLogEntries(mapped);
} catch (err) {
    console.error("Failed to set workLogEntries for timeline:", err);
}

                
                setReceiptLoading(true);
                try {
                    const list = await getWorkLogReceipts(Number(id));
                    setReceipts((list || []) as ReceiptItem[]);
                } catch (e) {
                    console.error("Error loading receipts:", e);
                    setReceipts([]);
                } finally {
                    setReceiptLoading(false);
                }

            } catch (e: any) {
                console.error("Error loading report:", e);
                showError(
                    `보고서 로드 실패: ${e?.message || "알 수 없는 오류가 발생했습니다."}`
                );
                navigate("/report");
            } finally {
                setLoading(false);
            }
        };

        load();
    }, [id]);

    const workLog = data?.workLog;

    return (
        <div className="flex h-screen bg-[#f9fafb] overflow-hidden">
            {/* Mobile Overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-20 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <div
                className={`fixed lg:static inset-y-0 left-0 z-30 w-[239px] h-screen shrink-0 transform transition-transform duration-300 ease-in-out ${
                    sidebarOpen
                        ? "translate-x-0"
                        : "-translate-x-full lg:translate-x-0"
                }`}
            >
                <Sidebar onClose={() => setSidebarOpen(false)} />
            </div>

            {/* Main */}
            <div className="flex-1 flex flex-col h-screen overflow-hidden w-full">
                <Header
                    title="출장 보고서 보기"
                    onMenuClick={() => setSidebarOpen(true)}
                    leftContent={
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => navigate("/report")}
                                className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
                                title="목록으로 돌아가기"
                            >
                                <IconArrowBack />
                            </button>
                        </div>
                    }
                    rightContent={
                        <div className="flex items-center gap-3">
                            <Button
                                variant="outline"
                                size="lg"
                                onClick={() => navigate(`/report/${id}/edit`)}
                            >
                                수정하기
                            </Button>
                    
                            <Button
                                variant="primary"
                                size="lg"
                                onClick={() => {
                                    // ✅ PDF 페이지로 이동 (ReportPdfPage.tsx는 ?id= 로 받음)
                                    window.open(`/report/pdf?id=${id}`, "_blank");
                                }}
                            >
                                <span className="inline-flex items-center gap-2">
                                    <svg
                                        width="18"
                                        height="18"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        xmlns="http://www.w3.org/2000/svg"
                                    >
                                        <path
                                            d="M4 3h12l4 4v14H4V3z"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinejoin="round"
                                        />
                                        <path
                                            d="M8 3v6h8V3"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinejoin="round"
                                        />
                                        <rect
                                            x="8"
                                            y="13"
                                            width="8"
                                            height="6"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinejoin="round"
                                        />
                                    </svg>
                                    PDF
                                </span>
                            </Button>
                        </div>
                    }
                    
                />

                {loading ? (
                    <CreationSkeleton />
                ) : (
                    <div className="flex-1 overflow-y-auto px-4 sm:px-6 md:px-12 lg:px-24 xl:px-48 py-6 md:py-9">
                        <div className="max-w-[960px] mx-auto flex flex-col gap-4 md:gap-6">
                            {/* 기본 정보 */}
                            <SectionCard title="기본 정보">
                            <div className="bg-white border border-gray-200 rounded-2xl divide-y">

                                {/* 핵심 정보 */}
                                <div className="grid grid-cols-1 md:grid-cols-[120px_220px_1fr] gap-4 p-5">
                                    <div>
                                        <p className="text-xs text-gray-400 mb-1">호선</p>
                                        <p className="text-lg font-semibold text-gray-900">
                                            {workLog?.vessel?.trim() ? workLog.vessel : <EmptyValueIndicator />}
                                        </p>
                                    </div>

                                    <div>
                                        <p className="text-xs text-gray-400 mb-1">엔진</p>
                                        <p className="text-lg font-semibold text-gray-900">
                                            {workLog?.engine?.trim() ? workLog.engine : <EmptyValueIndicator />}
                                        </p>
                                    </div>

                                    <div>
                                        <p className="text-xs text-gray-400 mb-1">목적(제목)</p>
                                        <p className="text-lg font-semibold text-gray-900">
                                            {workLog?.subject?.trim() ? workLog.subject : <EmptyValueIndicator />}
                                        </p>
                                    </div>
                                </div>

                                {/* 상세 정보 */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 p-5 text-sm">
                                    <div className="flex">
                                        <span className="w-28 text-gray-400 shrink-0">출장지</span>
                                        <span className="text-gray-900">
                                            {workLog?.location?.trim() ? workLog.location : <EmptyValueIndicator />}
                                        </span>
                                    </div>

                                    <div className="flex">
                                        <span className="w-28 text-gray-400 shrink-0">작업 지시</span>
                                        <span className="text-gray-900">
                                            {workLog?.order_group?.trim() ? workLog.order_group : <EmptyValueIndicator />}
                                        </span>
                                    </div>

                                    <div className="flex">
                                        <span className="w-28 text-gray-400 shrink-0">참관감독</span>
                                        <span className="text-gray-900">
                                            {workLog?.order_person?.trim() ? workLog.order_person : <EmptyValueIndicator />}
                                        </span>
                                    </div>

                                    <div className="flex">
                                        <span className="w-28 text-gray-400 shrink-0">차량</span>
                                        <span className="text-gray-900">
                                            {workLog?.vehicle?.trim() ? workLog.vehicle : <EmptyValueIndicator />}
                                        </span>
                                    </div>

                                {/* 작성자 / 작성일 */}
                                <div className="flex">
                                    <span className="w-28 text-gray-400 shrink-0">작성자 / 작성일</span>
                                    <span className="text-gray-900">
                                        {workLog?.author?.trim() ? workLog.author : "(작성자 없음)"}
                                        <span className="text-gray-400 ml-2">
                                            · {formatDate(workLog?.created_at)}
                                        </span>
                                    </span>
                                </div>

                                {/* 투입 인원 */}
                                <div className="flex">
                                    <span className="w-28 text-gray-400 shrink-0">투입 인원</span>
                                    <span className="text-gray-900">
                                        {data?.workers?.length
                                            ? data.workers.join(", ")
                                            : "—"}
                                    </span>
                                </div>
                                </div>
                            </div>

                            </SectionCard>

{/* 출장 업무 일지 */}
<SectionCard title="출장 업무 일지">
    {data?.entries?.length ? (
        <div className="flex flex-col gap-3">
            {(() => {
                const baseSorted = [...data.entries]
                    .sort((a: any, b: any) => {
                        const aKey = `${a.dateFrom}T${a.timeFrom || "00:00"}`;
                        const bKey = `${b.dateFrom}T${b.timeFrom || "00:00"}`;
                        return aKey.localeCompare(bKey);
                    });

                // ✅ 날짜별 표시용 분할
                const displayEntries = baseSorted.flatMap((e: any, index: number) => {
                    const fallbackKey = `${e.dateFrom}-${e.timeFrom}-${e.dateTo}-${e.timeTo}-${index}`;
                    return splitEntryByDayForDisplay(e, fallbackKey);
                }).sort((a: any, b: any) => {
                    const aKey = `${a.dateFrom}T${a.timeFrom || "00:00"}`;
                    const bKey = `${b.dateFrom}T${b.timeFrom || "00:00"}`;
                    return aKey.localeCompare(bKey);
                });

                return displayEntries.map((e: any, index: number, arr: any[]) => {
                    const key = e.__segKey;

                    const minutes = calcMinutes({
                        dateFrom: e.dateFrom,
                        timeFrom: e.timeFrom,
                        dateTo: e.dateTo,
                        timeTo: e.timeTo,
                    });
                    const hoursLabel = formatHoursMinutes(minutes);
                    const isExpanded = expandedCards[String(key)] ?? false;

                    const typeStyles = {
                        작업: {
                            gradient: "from-blue-500 to-indigo-600",
                            bg: "bg-gradient-to-br from-blue-50 to-indigo-50",
                            border: "border-blue-200",
                            badge: "bg-blue-500",
                            text: "text-blue-700",
                        },
                        이동: {
                            gradient: "from-emerald-500 to-teal-600",
                            bg: "bg-gradient-to-br from-emerald-50 to-teal-50",
                            border: "border-emerald-200",
                            badge: "bg-emerald-500",
                            text: "text-emerald-700",
                        },
                        대기: {
                            gradient: "from-amber-500 to-orange-600",
                            bg: "bg-gradient-to-br from-amber-50 to-orange-50",
                            border: "border-amber-200",
                            badge: "bg-amber-500",
                            text: "text-amber-700",
                        },
                    };

                    const style =
                        typeStyles[e.descType as keyof typeof typeStyles] ||
                        typeStyles["작업"];

                    const prev = arr[index - 1];
                    const showDateSeparator = prev && prev.dateFrom !== e.dateFrom;

                    return (
                        <div key={String(key)}>
                            {showDateSeparator && (
                                <div className="flex items-center gap-3 my-4">
                                    <div className="flex-1 h-px bg-gradient-to-r from-transparent to-rose-300" />
                                    <span className="text-[12px] font-medium text-rose-500 px-2">
                                        날짜 변경
                                    </span>
                                    <div className="flex-1 h-px bg-gradient-to-l from-transparent to-rose-300" />
                                </div>
                            )}

                            <div
                                className={`relative rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 border ${style.border} ${style.bg}`}
                            >
                                <div className={`h-1 bg-gradient-to-r ${style.gradient}`} />

                                <div
                                    className="relative p-4 cursor-pointer"
                                    onClick={() => toggleCard(String(key))}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span
                                                    className={`inline-flex items-center px-3 py-1 ${style.badge} text-white text-[13px] font-bold rounded-full shadow-sm`}
                                                >
                                                    {e.descType || "—"}
                                                </span>

                                                <span className={`text-[15px] font-bold ${style.text}`}>
                                                    {hoursLabel}
                                                </span>
                                            </div>

                                            {e.lunch_worked && (
                                                <div className="absolute bottom-3 right-3 z-20">
                                                    <span className="inline-flex items-center px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-[12px] font-semibold border border-amber-200 shadow-sm">
                                                        {NO_LUNCH_TEXT}
                                                    </span>
                                                </div>
                                            )}

                                            <div className="flex items-center gap-2 text-[13px] text-gray-600 mb-2">
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
                                                    {e.dateFrom} {toKoreanTime(e.timeFrom)}
                                                </span>
                                                <span className="text-gray-400">→</span>
                                                <span>
                                                    {e.dateTo} {toKoreanTime(e.timeTo)}
                                                </span>
                                            </div>

                                            {Array.isArray(e.persons) && (
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
                                                    <span className="font-medium">{e.persons.length}명</span>
                                                    <span className="text-gray-400">|</span>
                                                    <span className="truncate max-w-[200px]">
                                                        {e.persons.join(", ")}
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        <div
                                            className={`w-8 h-8 rounded-full bg-white/80 flex items-center justify-center shadow-sm transition-transform ${isExpanded ? "rotate-180" : ""}`}
                                        >
                                            <svg
                                                width="20"
                                                height="20"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                className="text-gray-500"
                                            >
                                                <path
                                                    d="M7 10L12 15L17 10"
                                                    stroke="currentColor"
                                                    strokeWidth="2"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                />
                                            </svg>
                                        </div>
                                    </div>
                                </div>

                                <div
                                    className={`overflow-hidden transition-all duration-300 ${
                                        isExpanded ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
                                    }`}
                                >
                                    <div className="px-4 pb-4 border-t border-white/50">
                                        <div className="pt-4 space-y-3">
                                            <div className="bg-white border border-gray-100 rounded-xl p-3">
                                                <p className="text-[13px] text-gray-500 mb-1">상세 내용</p>
                                                <p className="text-[15px] text-gray-800 whitespace-pre-line">
                                                    {e.details || "—"}
                                                </p>
                                            </div>

                                            {e.note?.trim() && (
                                                <div className="bg-white border border-gray-100 rounded-xl p-3">
                                                    <p className="text-[13px] text-gray-500 mb-1">특이 사항</p>
                                                    <p className="text-[15px] text-gray-800 whitespace-pre-line">
                                                        {e.note}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                });
            })()}

        </div>
    ) : (
        <div className="text-gray-400">업무 일지가 없습니다.</div>
    )}
</SectionCard>


{/* 경비 내역 */}
<SectionCard title="경비 내역">
    {data?.expenses?.length ? (
        <div className="overflow-x-auto">
            <table className="w-full border-collapse">
                <thead>
                    <tr className="bg-gray-100">
                        <th className="border border-gray-200 px-3 py-2 text-[13px] font-semibold text-center">
                            날짜
                        </th>
                        <th className="border border-gray-200 px-3 py-2 text-[13px] font-semibold text-center">
                            분류
                        </th>
                        <th className="border border-gray-200 px-3 py-2 text-[13px] font-semibold text-center">
                            상세내용
                        </th>
                        <th className="border border-gray-200 px-3 py-2 text-[13px] font-semibold text-center">
                            금액
                        </th>
                    </tr>
                </thead>

                <tbody>
                    {[...data.expenses]
                        .sort((a: any, b: any) => (a.date || "").localeCompare(b.date || ""))
                        .map((ex: any, idx: number) => {
                            const amountNum =
                                typeof ex.amount === "number"
                                    ? ex.amount
                                    : Number(String(ex.amount || "0").replace(/,/g, "")) || 0;

                            return (
                                <tr
                                    key={ex.id ?? `${ex.date}-${ex.type}-${idx}`}
                                    className={`${getExpenseTypeRowClass(ex.type)}`}
                                >
                                    <td className="border border-gray-200 px-3 py-2 text-[13px] text-center whitespace-nowrap">
                                        {formatDateKoreanMD(ex.date)}
                                    </td>
                                    <td className="border border-gray-200 px-3 py-2 text-[13px] text-center whitespace-nowrap font-medium">
                                        {ex.type || "—"}
                                    </td>
                                    <td className="border border-gray-200 px-3 py-2 text-[13px]">
                                        {ex.detail || "—"}
                                    </td>
                                    <td className="border border-gray-200 px-3 py-2 text-[13px] text-center whitespace-nowrap font-semibold">
                                        {amountNum.toLocaleString()}원
                                    </td>
                                </tr>
                            );
                        })}
                </tbody>

                <tfoot>
                    <tr>
                        <td
                            colSpan={3}
                            className="border border-gray-200 px-3 py-2 text-right font-semibold text-[13px]"
                        >
                            합계
                        </td>
                        <td className="border border-gray-200 px-3 py-2 text-center font-bold text-[14px] whitespace-nowrap">
                            {data.expenses
                                .reduce((sum: number, ex: any) => {
                                    const n =
                                        typeof ex.amount === "number"
                                            ? ex.amount
                                            : Number(String(ex.amount || "0").replace(/,/g, "")) || 0;
                                    return sum + n;
                                }, 0)
                                .toLocaleString()}
                            원
                        </td>
                    </tr>
                </tfoot>
            </table>
        </div>
    ) : (
        <div className="text-gray-400">경비 내역이 없습니다.</div>
    )}
</SectionCard>

{/* 소모 자재 */}
<SectionCard title="소모 자재">
    {data?.materials?.length ? (
        <div className="flex flex-wrap gap-2">
            {data.materials.map((m: any, idx: number) => {
                // 표시용 라벨 (작성 페이지 로직 반영)
                const label =
                    m.name === "보루"
                        ? `${m.name} ${Number(m.qty) * 5}kg`
                        : m.unit
                        ? `${m.name} ${m.qty}${m.unit}`
                        : `${m.name} ${m.qty}`;

                return (
                    <span
                        key={m.id ?? `${m.name}-${idx}`}
                        className="inline-flex items-center px-3 py-2 rounded-xl
                                   bg-gray-100 text-gray-800 text-sm font-medium"
                    >
                        {label}
                    </span>
                );
            })}
        </div>
    ) : (
        <div className="text-gray-400">소모 자재가 없습니다.</div>
    )}
</SectionCard>



{/* 첨부파일(사진) */}
<SectionCard title="첨부파일(사진)">
    {receiptLoading ? (
        <div className="text-gray-400">첨부파일을 불러오는 중...</div>
    ) : (
        (() => {
            const categories = [
                { key: "숙박영수증", title: "숙박 영수증" },
                { key: "자재구매영수증", title: "자재 영수증" },
                { key: "식비및유대영수증", title: "식비 및 유대 영수증" },
                { key: "기타", title: "기타 (TBM사진 등)" },
            ] as const;

            const grouped = categories.map((c) => ({
                ...c,
                items: receipts.filter((r) => r.category === c.key),
            }));

            const hasAny = grouped.some((g) => g.items.length > 0);

            if (!hasAny) {
                return (
                    <div className="text-gray-400">
                        첨부된 파일이 없습니다.
                    </div>
                );
            }

            return (
                <div className="flex flex-col gap-6">
                    {grouped.map((g) => (
                        <div
                            key={g.key}
                            className="bg-white border border-gray-200 rounded-2xl p-4 md:p-5"
                        >
                            <div className="flex items-center justify-between mb-3">
                                <div className="font-semibold text-[15px] text-gray-900">
                                    {g.title}
                                </div>
                                <div className="text-[12px] text-gray-400">
                                    {g.items.length}개
                                </div>
                            </div>

                            {g.items.length > 0 ? (
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                                    {g.items.map((item) => {
                                        const type = item.mime_type || "image/jpeg";
                                        const name = item.original_name || "첨부파일";

                                        return (
                                            <button
                                                key={item.id}
                                                type="button"
                                                onClick={() =>
                                                    openPreview(item.file_url, name, type)
                                                }
                                                className="group text-left rounded-2xl overflow-hidden border border-gray-200 bg-gray-50 hover:shadow-md transition-shadow"
                                                title="클릭하여 크게 보기"
                                            >
                                                <div className="w-full aspect-[1/1] bg-black/5 flex items-center justify-center overflow-hidden">
                                                    {type.startsWith("image/") ? (
                                                        <img
                                                            src={item.file_url}
                                                            alt={name}
                                                            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform"
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full flex flex-col items-center justify-center text-gray-600">
                                                            <div className="text-[13px] font-semibold">
                                                                PDF
                                                            </div>
                                                            <div className="text-[12px] text-gray-500 mt-1">
                                                                클릭하여 열기
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="p-3 bg-white">
                                                    <p className="text-[13px] text-gray-800 truncate">
                                                        {name}
                                                    </p>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-gray-400 text-sm py-2">
                                    해당 분류에 첨부파일이 없습니다.
                                </div>
                            )}
                        </div>
                    ))}

                    {/* 미리보기 모달 */}
                    {previewFile && (
                        <div
                            onClick={closePreview}
                            className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999] p-4"
                        >
                            <button
                                onClick={closePreview}
                                className="absolute top-4 right-4 w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white transition-colors"
                            >
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                                    <path
                                        d="M19 6.41L17.59 5L12 10.59L6.41 5L5 6.41L10.59 12L5 17.59L6.41 19L12 13.41L17.59 19L19 17.59L13.41 12L19 6.41Z"
                                        fill="currentColor"
                                    />
                                </svg>
                            </button>

                            <div
                                className="max-w-[92vw] max-h-[92vh]"
                                onClick={(e) => e.stopPropagation()}
                            >
                                {previewFile.type.startsWith("image/") ? (
                                    <img
                                        src={previewFile.url}
                                        alt={previewFile.name}
                                        className="max-w-full max-h-[85vh] rounded-xl shadow-2xl bg-white object-contain"
                                    />
                                ) : (
                                    <iframe
                                        src={previewFile.url}
                                        title={previewFile.name}
                                        className="w-[92vw] h-[85vh] bg-white rounded-xl shadow-2xl"
                                    />
                                )}
                                <p className="text-white text-center mt-3 text-[14px] truncate">
                                    {previewFile.name}
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            );
        })()
    )}
</SectionCard>

{/* 타임라인 */}
<SectionCard title="">
    <TimelineSummarySection />
</SectionCard>


                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
