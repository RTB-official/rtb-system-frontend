// src/pages/Report/ReportPdfPage.tsx
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
    getReportPdfData,
    PdfEntry,
    PdfExpense,
    PdfMaterial,
    PdfReceipt,
} from "../../lib/reportPdfData";
import TimelineSummarySection from "../../components/sections/TimelineSummarySection";
import { useWorkReportStore } from "../../store/workReportStore";

function toHM(t?: string | null) {
    if (!t) return "";
    const parts = String(t).split(":");
    const hh = String(parts[0] ?? "0").padStart(2, "0");
    const mm = String(parts[1] ?? "0").padStart(2, "0");
    return `${hh}:${mm}`;
}

function weekday_kr(ymd?: string | null) {
    if (!ymd) return "";
    const w = ["일", "월", "화", "수", "목", "금", "토"];
    const d = new Date(ymd);
    if (Number.isNaN(d.getTime())) return "";
    return w[d.getDay()];
}

function toLocalYMD(d: Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}
function enumerate_dates(startYmd?: string | null, endYmd?: string | null) {
    if (!startYmd) return [];
    const s = new Date(startYmd);
    const e = endYmd ? new Date(endYmd) : s;
    if (Number.isNaN(s.getTime())) return [];
    const out: string[] = [];
    const cur = new Date(s);
    const end = Number.isNaN(e.getTime()) ? s : e;
    while (cur <= end) {
        const y = cur.getFullYear();
        const m = String(cur.getMonth() + 1).padStart(2, "0");
        const d = String(cur.getDate()).padStart(2, "0");
        out.push(`${y}-${m}-${d}`);
        cur.setDate(cur.getDate() + 1);
    }
    return out;
}

function formatWon(n: number) {
    return n.toLocaleString("ko-KR");
}

function formatPdfFilename(
    start?: string | null,
    end?: string | null,
    vessel?: string | null,
    subject?: string | null
) {
    if (!start) return "출장보고서";

    const fmt = (ymd: string) => {
        const d = new Date(ymd);
        if (Number.isNaN(d.getTime())) return "";
        const m = d.getMonth() + 1;
        const day = String(d.getDate()).padStart(2, "0");
        return `${m}월${day}일`;
    };

    const s = fmt(start);
    const e = end ? fmt(end) : s;

    const vesselText = vessel ? `${vessel}` : "";
    const subjectText = subject ? subject.trim() : "";

    // ✅ 하루짜리면 "~" 구간 제거
    const datePart = !end || start === end ? `${s}` : `${s}~${e}`;

    return `${datePart} ${vesselText} ${subjectText}`.trim();
}



// ✅ 고정 양력 공휴일(음력은 브라우저에서 계산이 어려워 제외)
function kr_fixed_holidays(year: number) {
    const y = year;
    return [
        `${y}-01-01`,
        `${y}-03-01`,
        `${y}-05-05`,
        `${y}-06-06`,
        `${y}-08-15`,
        `${y}-10-03`,
        `${y}-10-09`,
        `${y}-12-25`,
    ];
}


export default function ReportPdfPage() {
    const [params] = useSearchParams();
    const id = Number(params.get("id") ?? 0);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [log, setLog] = useState<any>(null);
    const [persons, setPersons] = useState<string[]>([]);
    const [entries, setEntries] = useState<PdfEntry[]>([]);
    const [entryPersonsMap, setEntryPersonsMap] = useState<
        Record<number, string[]>
    >({});
    const [materials, setMaterials] = useState<PdfMaterial[]>([]);
    const [expenses, setExpenses] = useState<PdfExpense[]>([]);
    const [receipts, setReceipts] = useState<PdfReceipt[]>([]);
    const [imageErrors, setImageErrors] = useState<Set<number>>(new Set());
    const { setWorkLogEntries } = useWorkReportStore();
    

    const [printReceiptSrcMap, setPrintReceiptSrcMap] = useState<Record<number, string>>({});
    const [isPreparingPrint, setIsPreparingPrint] = useState(false);
    
    // ✅ 인쇄용 영수증 이미지 압축 (리사이즈 + JPEG 변환)
    // - maxWidth: 1200px 권장 (A4 인쇄에 충분)
    // - quality: 0.7 권장
    async function compressImageToJpegDataUrl(
      url: string,
      maxWidth = 1200,
      quality = 0.7
    ): Promise<string | null> {
      try {
        const img = new Image();
        // ⚠️ CORS 허용이 없으면 canvas 변환이 실패할 수 있습니다.
        img.crossOrigin = "anonymous";
    
        const loaded = await new Promise<HTMLImageElement>((resolve, reject) => {
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error("image load fail"));
          img.src = url;
        });
    
        const w0 = loaded.naturalWidth || loaded.width;
        const h0 = loaded.naturalHeight || loaded.height;
        if (!w0 || !h0) return null;
    
        const scale = Math.min(1, maxWidth / w0);
        const w = Math.max(1, Math.round(w0 * scale));
        const h = Math.max(1, Math.round(h0 * scale));
    
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
    
        const ctx = canvas.getContext("2d");
        if (!ctx) return null;
    
        ctx.imageSmoothingEnabled = true;
        // @ts-ignore
        ctx.imageSmoothingQuality = "high";
    
        ctx.drawImage(loaded, 0, 0, w, h);
    
        // PNG 포함 모두 JPEG로 압축
        return canvas.toDataURL("image/jpeg", quality);
      } catch {
        return null;
      }
    }
    
    async function buildPrintReceiptMap(
      items: { id: number; url: string }[],
      maxWidth = 1200,
      quality = 0.7
    ) {
      const out: Record<number, string> = {};
      for (const it of items) {
        const dataUrl = await compressImageToJpegDataUrl(it.url, maxWidth, quality);
        if (dataUrl) out[it.id] = dataUrl;
      }
      return out;
    }
    
    // ✅ 인쇄 완료 후 정리(메모리 절약)
    useEffect(() => {
      const onAfterPrint = () => {
        setIsPreparingPrint(false);
        setPrintReceiptSrcMap({});
      };
      window.addEventListener("afterprint", onAfterPrint);
      return () => window.removeEventListener("afterprint", onAfterPrint);
    }, []);



    useEffect(() => {
        if (!id) {
            setError("잘못된 id");
            setLoading(false);
            return;
        }
        (async () => {
            try {
                setLoading(true);
                const data = await getReportPdfData(id);
                setLog(data.log);
                setPersons(data.persons);
                setEntries(data.entries);
                setEntryPersonsMap(data.entryPersonsMap);
                setMaterials(data.materials);
                setExpenses(data.expenses);
                setReceipts(data.receipts);
                setImageErrors(new Set()); // 영수증 데이터 로드 시 에러 상태 초기화

                // TimelineSummarySection을 위한 WorkLogEntry 형식으로 변환
                const workLogEntries = data.entries.map((entry: PdfEntry) => {
                    const note = String(entry.note ?? "");
                    const noLunch =
                        note.includes("점심 안 먹고 작업진행(12:00~13:00)") ||
                        note.includes("점심 안먹고 작업진행(12:00~13:00)");
                    
                    // moveFrom, moveTo 추출 (note에서 패턴 찾기)
                    let moveFrom: string | undefined;
                    let moveTo: string | undefined;
                    const moveMatch = note.match(/(?:이동|move)[:：\s]*([^→→\s]+)\s*[→→]\s*([^\s]+)/i);
                    if (moveMatch) {
                        moveFrom = moveMatch[1];
                        moveTo = moveMatch[2];
                    }

                    return {
                        id: entry.id,
                        dateFrom: entry.date_from ?? "",
                        timeFrom: entry.time_from ?? "",
                        dateTo: entry.date_to ?? "",
                        timeTo: entry.time_to ?? "",
                        descType: (entry.desc_type ?? "") as '작업' | '이동' | '대기' | '',
                        details: entry.details ?? "",
                        persons: data.entryPersonsMap[entry.id] ?? [],
                        note: note,
                        noLunch: noLunch,
                        moveFrom: moveFrom,
                        moveTo: moveTo,
                    };
                });
                setWorkLogEntries(workLogEntries);
            } catch (e: any) {
                setError(e?.message ?? "PDF 데이터 로드 실패");
            } finally {
                setLoading(false);
            }
        })();
    }, [id]);

    // ✅ 기간/rows 계산 (신형 PHP의 상세정보 테이블과 동일한 구조)
    const { workPeriodText, rows, holidaysByYear } = useMemo(() => {
        const sorted = [...entries].sort((a, b) => {
            const ak = `${a.date_from ?? ""}T${a.time_from ?? "00:00"}`;
            const bk = `${b.date_from ?? ""}T${b.time_from ?? "00:00"}`;
            return ak.localeCompare(bk);
        });

        // 전체 엔트리 시작~종료(날짜만)
        let workStart: number | null = null;
        let workEnd: number | null = null;

        for (const e of sorted) {
            const s = `${e.date_from ?? ""} ${e.time_from ?? ""}`.trim();
            const t = `${e.date_to ?? ""} ${e.time_to ?? ""}`.trim();
            if (s) {
                const ts = new Date(s.replace(" ", "T")).getTime();
                if (!Number.isNaN(ts)) {
                    if (workStart === null || ts < workStart) workStart = ts;
                }
            }
            if (t) {
                const tt = new Date(t.replace(" ", "T")).getTime();
                if (!Number.isNaN(tt)) {
                    if (workEnd === null || tt > workEnd) workEnd = tt;
                }
            }
        }

        const startStr = workStart ? toLocalYMD(new Date(workStart)) : "";
        const endStr = workEnd ? toLocalYMD(new Date(workEnd)) : "";
        const workPeriodText =
            (startStr || endStr)
                ? `${startStr}${(startStr || endStr) ? " ~ " : ""}${endStr}`
                : "";

        // 공휴일 year set
        const years = new Set<number>();
        for (const e of sorted) {
            if (e.date_from) years.add(Number(e.date_from.slice(0, 4)));
            if (e.date_to) years.add(Number(e.date_to.slice(0, 4)));
        }
        if (years.size === 0) years.add(new Date().getFullYear());

        const holidaysByYear: Record<number, Set<string>> = {};
        for (const y of years) {
            holidaysByYear[y] = new Set(kr_fixed_holidays(y));
        }

        type Row = {
            y: string;
            m: string;
            d: string;
            w: string;
            type: string;
            from: string;
            to: string;
            desc: string;
            note: string;
            rmk: string;
            dateKey: string; // YYYY-m-d (중복표시 판단용)
            dateStr: string; // YYYY-mm-dd (휴일색)
        };

        const rows: Row[] = [];

        // 시간 라벨(구형과 동일: 총분 -> 0.5 단위)
        const hours_half_label_with_lunch = (e: PdfEntry) => {
            const df = e.date_from ?? "";
            const tf = e.time_from ?? "";
            const dt = e.date_to ?? "";
            const tt = e.time_to ?? "";
            const from = `${df} ${tf}`.trim();
            const to = `${dt} ${tt}`.trim();
            if (!from || !to) return "";
            const ft = new Date(from.replace(" ", "T")).getTime();
            const tts = new Date(to.replace(" ", "T")).getTime();
            if (Number.isNaN(ft) || Number.isNaN(tts) || tts <= ft) return "";

            let totalMins = Math.floor((tts - ft) / 60000);

            const descType = String(e.desc_type ?? "").trim();
            const note = String(e.note ?? "");

            // ✅ 작업과 대기가 아니면 점심 규칙 적용 X
            if (descType !== "작업" && descType !== "대기") {
                const h = Math.floor(totalMins / 60);
                const m = totalMins % 60;
                return `${h}${m >= 30 ? ".5" : ""}`;
            }

            // ✅ 작업: "점심 안 먹음"이면 점심시간 차감 안함
            if (descType === "작업") {
                if (
                    note.includes("점심 안 먹고 작업진행(12:00~13:00)") ||
                    note.includes("점심 안먹고 작업진행(12:00~13:00)")
                ) {
                    const h = Math.floor(totalMins / 60);
                    const m = totalMins % 60;
                    return `${h}${m >= 30 ? ".5" : ""}`;
                }
            }
            // ✅ 대기는 무조건 점심시간 차감

            // 동일 일자만 점심 차감
            const sameDay = df && dt && df === dt;
            if (sameDay) {
                const lunchStart = new Date(`${df}T12:00`).getTime();
                const lunchEnd = new Date(`${df}T13:00`).getTime();
                const s = Math.max(ft, lunchStart);
                const eov = Math.min(tts, lunchEnd);
                const ov = Math.max(0, Math.floor((eov - s) / 60000));
                if (ov >= 60) totalMins -= 60;
            }

            const h = Math.floor(totalMins / 60);
            const m = totalMins % 60;
            return `${h}${m >= 30 ? ".5" : ""}`;
        };

        // 전체 인원 목록(비고 전원 처리용)
        const workerSet = Array.from(new Set(persons.map((p) => p.trim()).filter(Boolean))).sort();

        for (const e of sorted) {
            const eid = e.id;
            const ppl = (entryPersonsMap[eid] ?? []).map((x) => x.trim()).filter(Boolean);

            const hoursDisp = hours_half_label_with_lunch(e);

            const startDate = e.date_from ?? e.date_to ?? "";
            const endDate = e.date_to ?? startDate;
            const dates = startDate ? enumerate_dates(startDate, endDate) : [""];

            // 비고(인원 우선, 3명 단위 줄바꿈 / 전원(N명) 처리)
            let rmk = "";
            if (ppl.length) {
                const remarkList = ppl;
                const remarkSet = Array.from(new Set(remarkList)).sort();
                const workerSetSorted = [...workerSet].sort();
                const same =
                    workerSetSorted.length > 1 &&
                    remarkSet.length === workerSetSorted.length &&
                    remarkSet.every((v, i) => v === workerSetSorted[i]);

                if (same) {
                    rmk = `전원(${workerSetSorted.length}명)`;
                } else {
                    const lines: string[] = [];
                    for (let i = 0; i < remarkList.length; i += 3) {
                        lines.push(remarkList.slice(i, i + 3).join(", "));
                    }
                    rmk = lines.join("\n");
                }
            }

            const firstDate = dates[0] ?? "";
            const lastDate = dates[dates.length - 1] ?? "";

            for (const dYmd of dates) {
                const isFirst = dYmd === firstDate;
                const isLast = dYmd === lastDate;

                const dt = dYmd ? new Date(dYmd) : null;
                const y = dt ? String(dt.getFullYear()) : "";
                const m = dt ? String(dt.getMonth() + 1) : "";
                const d = dt ? String(dt.getDate()) : "";
                const w = dYmd ? weekday_kr(dYmd) : "";

                const baseType = String(e.desc_type ?? "");
                const type = baseType + (hoursDisp ? `(${hoursDisp})` : "");

                const dateKey = `${y}-${m}-${d}`;
                const dateStr = dYmd || "";

                rows.push({
                    y,
                    m,
                    d,
                    w,
                    type,
                    from: isFirst ? toHM(e.time_from ?? "") : "",
                    to: isLast ? toHM(e.time_to ?? "") : "",
                    desc: String(e.details ?? "").trim(),
                    note: String(e.note ?? ""),
                    rmk,
                    dateKey,
                    dateStr,
                });
            }
        }

        // 완전 빈 행 제거
        const filtered = rows.filter((r) => {
            const emptyDate = (!r.y || r.y === "0") && (!r.m || r.m === "0") && (!r.d || r.d === "0");
            return !(
                emptyDate &&
                !r.type.trim() &&
                !r.from.trim() &&
                !r.to.trim() &&
                !r.desc.trim() &&
                !r.rmk.trim()
            );
        });



        return { workPeriodText, rows: filtered, holidaysByYear };
    }, [entries, entryPersonsMap, persons]);

    const expenseSum = useMemo(() => {
        return expenses.reduce((acc, x) => acc + (Number(x.amount ?? 0) || 0), 0);
    }, [expenses]);

    // ✅ 웹페이지 제목을 PDF 파일명 규칙과 동일하게 설정
    useEffect(() => {
        if (!log || !workPeriodText) return;

        const [start, end] = workPeriodText.split(" ~ ");

        const title = formatPdfFilename(
            start,
            end || start,
            log.vessel,
            log.subject
        );

        document.title = title;
    }, [log, workPeriodText]);

    if (loading) return <div className="p-6 text-sm text-gray-600">PDF 로딩중…</div>;
    if (error || !log) return <div className="p-6 text-sm text-red-600">{error ?? "오류"}</div>;

    // 영수증 URL 결정(테이블에 file_url이 있으면 그걸 우선 사용)
    const receiptImgs = (receipts ?? [])
        .map((r, index) => {
            // 각 영수증이 고유한 id를 가지도록 보장
            const uniqueId = r.id ?? (index + 1000000); // id가 없으면 큰 숫자로 고유값 생성
            const fileUrl = (r.file_url ?? "").trim();
            const storagePath = r.storage_path ?? r.path ?? "";
            
            // 디버깅: 같은 URL이 여러 영수증에 할당되는지 확인
            if (process.env.NODE_ENV === 'development') {
                console.log(`Receipt ${uniqueId}:`, {
                    id: r.id,
                    uniqueId,
                    fileUrl,
                    storagePath,
                    fileName: r.file_name,
                });
            }
            
            return {
                id: uniqueId,
                url: fileUrl,
                name: (r.file_name ?? "").trim(),
                storagePath: storagePath,
                category: r.category ?? "",
            };
        })
        .filter((x) => Boolean(x.url));

    // 이미지 로드 에러 핸들러
    const handleImageError = (receiptId: number) => {
        setImageErrors((prev) => new Set(prev).add(receiptId));
    };

        return (
            <div>
                {/* ✅ 브라우저 우측 상단 고정 버튼 (내용과 완전 분리) */}
                <div className="pdf-save-fixed">
                <button
                className="pdf-save-btn"
                onClick={async () => {
                    // ✅ 파일명 규칙 적용
                    const filename = formatPdfFilename(
                    workPeriodText.split(" ~ ")[0] || log?.date_from,
                    workPeriodText.split(" ~ ")[1] || log?.date_to,
                    log?.vessel,
                    log?.subject
                    );

                    const prevTitle = document.title;

                    // ✅ 인쇄용(저용량) 영수증 이미지 준비
                    setIsPreparingPrint(true);
                    try {
                    // 5~30장 기준: 1200px + quality 0.7 추천
                    const map = await buildPrintReceiptMap(
                        receiptImgs.map((r) => ({ id: r.id, url: r.url })),
                        1200,
                        0.7
                    );
                    setPrintReceiptSrcMap(map);
                    } catch {
                    // 실패해도 원본으로 인쇄 진행
                    }

                    document.title = filename;

                    // 렌더 반영을 위해 한 틱 양보
                    setTimeout(() => {
                    window.print();

                    // 인쇄 후 원래 타이틀 복구 (안전)
                    setTimeout(() => {
                        document.title = prevTitle;
                    }, 300);
                    }, 50);
                }}
                type="button"
                >

                        {/* 디스크 아이콘 (심플) */}
                        <svg
                            width="16"
                            height="16"
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
                        <span>PDF로 저장</span>
                    </button>
                </div>

                {/* ✅ 신형 PDF CSS (public 기준으로 폰트 경로만 조정) */}
                <style>{`
    html, body {
      page-break-inside: auto;
      page-break-before: auto;
      page-break-after: auto;
    }
    
    @font-face{
      font-family:'NanumGothic';
      src:url('/fonts/NanumGothic.ttf') format('truetype');
      font-weight:400; font-style:normal;
    }
    @font-face{
      font-family:'NanumGothic';
      src:url('/fonts/NanumGothicBold.ttf') format('truetype');
      font-weight:700; font-style:normal;
    }
    
    @page { size: A4 portrait; margin: 12mm 10mm; }
    body { font-family:'NanumGothic', sans-serif; color:#1b1d22; font-size:11.5pt; }
    
    :root{
      --ink:#1b1d22; --muted:#6b7280; --line:#e6e8ee; --soft:#f7f8fb;
      --brand:#800020; --work:#2563eb; --move:#10b981; --wait:#f59e0b;
    }
    
    /* ✅ A4 내용폭 고정 */
    .sheet{
      width: 190mm;
      margin: 0 auto;
    }
    
    /* ✅ 우측 상단 고정 PDF 저장 버튼 (내용과 완전 분리) */
    .pdf-save-fixed{
      position: fixed;
      top: 16px;
      right: 16px;
      z-index: 9999;
    }

    .pdf-save-btn{
      background: #2563eb;
      color: #fff;
      border: none;
      border-radius: 12px;
      padding: 10px 14px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 10px 18px rgba(0,0,0,0.18);
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }
    .pdf-save-btn:hover{ background:#1d4ed8; }

    /* 인쇄 시 버튼 숨김 */
    @media print{
      .pdf-save-fixed{ display:none !important; }
    }

    /* ✅ 미리보기 모달 */
    .preview-overlay{
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 99999;
      padding: 16px;
    }

    .preview-body{
      max-width: 92vw;
      max-height: 92vh;
    }

    .preview-img{
      max-width: 92vw;
      max-height: 85vh;
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 20px 40px rgba(0,0,0,0.35);
      object-fit: contain;
      display: block;
    }

    .preview-caption{
      color: #fff;
      text-align: center;
      margin-top: 10px;
      font-size: 13px;
      max-width: 92vw;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .preview-close{
      position: fixed;
      top: 16px;
      right: 16px;
      width: 40px;
      height: 40px;
      border-radius: 9999px;
      background: rgba(255,255,255,0.2);
      border: none;
      color: #fff;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .preview-close:hover{ background: rgba(255,255,255,0.3); }

    @media print{
      .preview-overlay{ display:none !important; }
      .preview-close{ display:none !important; }
    }


    /* Header */
    .head-table{ width:100%; border-collapse:collapse; }
    .head-table td{ vertical-align:top; border:none; padding:0; }
    
    .brand-row{ width:auto; border-collapse:collapse; margin:0 auto; }
    .brand-row td{ padding:0; border:none; vertical-align:middle; }
    .brand-row .logo-cell{ white-space:nowrap; }
    .brand-row .title-cell{ padding-left:10px; white-space:nowrap; }
    .logo{ object-fit:contain; }
    
    .doc-title{ font-size:20pt; font-weight:700; color:var(--brand); line-height:1.2; }
    
    /* Sections */
    .section{ 
      margin:12px 0 16px; 
      page-break-inside: avoid;
    }
    .section h2{
      font-size:12.5pt; margin:0 0 8px; color:#222;
      border-left:3px solid var(--brand); padding-left:8px;
      page-break-after: avoid;
    }
    
    /* 기본정보 Remaster — gap 최소화 */
    .kvx{
      width:100%;
      border-collapse:collapse;
      background:transparent;
      font-size:10pt;
      table-layout:auto;
    }
    .kvx tr{ border-bottom:1px solid var(--line); }
    .kvx tr:last-child{ border-bottom:none; }
    .kvx th{
      border:none;
      background:transparent;
      color:#6b7280;
      font-weight:700;
      text-align:left;
      white-space:nowrap;
      padding:8px 0;
      width:0.01%;
    }
    .kvx th::after{ content:":"; color:#6b7280; }
    .kvx td{
      border:none;
      padding:8px 0;
      color:#111827;
      word-break:break-word;
    }
    .kvx td::before{ content:"\\00a0\\00a0"; }
    .kvx tr:first-child td:nth-child(2){ white-space:nowrap; }
    
    .muted{ color:var(--muted); }
    .right{ text-align:right; }
    .center{ text-align:center; }
    
    /* =========================
       상세정보 (완전 신규)
       ========================= */
    .detail-wrap{ width:100%; }

    .detail-table{
      width:100%;
      border-collapse:collapse;
      table-layout:fixed;
      font-size:8.5pt;
      background:#fff;
    }

    .detail-table th,
    .detail-table td{
      border:1px solid #111;
      padding:4px 5px;
      vertical-align:top;
      word-break:break-word;
      overflow-wrap:anywhere;
    }



    .detail-table thead{
      page-break-inside: avoid;
      page-break-after: avoid;
    }
    .detail-table thead th{
      background:#eef3ff;
      text-align:center;
      vertical-align:middle;
      white-space:nowrap;
      font-weight:700;
    }
    .detail-table tbody tr{
      page-break-inside: avoid;
    }

    /* ✅ A4 안정 폭(mm 고정) */
    .dcol-y{ width:10mm; }
    .dcol-m{ width:7mm; }
    .dcol-d{ width:7mm; }
    .dcol-w{ width:7mm; }
    .dcol-type{ width:14mm; }   /* ✅ 구분 줄임 */
    .dcol-from{ width:14mm; }
    .dcol-to{ width:14mm; }
    .dcol-desc{ width:auto; }
    .dcol-rmk{ width:32mm; }    /* ✅ 비고 늘림 */

    .detail-center{ text-align:center; }
    .detail-right{ text-align:right; }


        /* ✅ 년도(YYYY)만 폰트 줄이기 */
    .detail-year{
      font-size:7pt;
      line-height:1.05;
      letter-spacing:-0.2px;
    }

    .detail-date-red  { color:#d32f2f !important; font-weight:700; }
    .detail-date-blue { color:#2563eb !important; font-weight:700; }

    /* ✅ 날짜 변경 구분선(테이블 깨짐 방지: border 제거) */
    .detail-sep{
      page-break-inside: avoid;
    }
    .detail-sep td{
      padding:0 !important;
      height:3px;
      background:#0ea5e9;
      border:none !important;
    }

    /* ✅ 반복 날짜 셀: 내용만 비워도 높이 유지 */
    .detail-date-empty{
      color:transparent;
    }

    /* ✅ Description 줄바꿈 */
    .detail-pre{
      white-space:pre-wrap;
    }

    .detail-note{
      margin-top:4px;
      color:#d00000;
    }

    /* ✅ 타임라인 섹션: 다른 섹션과 동일한 A4 폭(=sheet 내부 100%)로 고정 */
    .timeline-section{
      width:100%;
      display:block;
      page-break-inside: avoid;
    }
    .timeline-section .timeline-root{
      width:100% !important;
      max-width:none !important;
      margin:0 !important;
    }
    /* 타임라인 내부에서 max-width/mx-auto가 폭을 줄이는 경우 방지 */
    .timeline-section .timeline-root [class*="max-w-"]{
      max-width:none !important;
    }
    .timeline-section .timeline-root [class*="mx-auto"]{
      margin-left:0 !important;
      margin-right:0 !important;
    }

    /* ✅ PDF에서 '일별 시간표'만 70%로 축소 */
    .timeline-section .daily-timesheet{
      transform: scale(0.8);
      transform-origin: top left;
      width: calc(100% / 0.7); /* 줄어든 만큼 가로폭 보정 */
      page-break-inside: avoid; /* 라벨과 테이블이 함께 유지되도록 */
    }
    /* 일별 시간표 라벨과 테이블이 함께 유지되도록 */
    .timeline-section .daily-timesheet h3{
      page-break-after: avoid;
    }
    .timeline-section .daily-timesheet > div{
      page-break-inside: avoid;
    }
    .timeline-section .daily-timesheet table{
      page-break-before: avoid;
    }
    .timeline-section .daily-timesheet table tbody tr{
      page-break-inside: avoid;
    }
    .timeline-section .daily-timesheet table thead{
      page-break-inside: avoid;
      page-break-after: avoid;
    }
    .timeline-section .daily-timesheet table tfoot{
      page-break-inside: avoid;
      page-break-before: avoid;
    }

    
    
    /* Generic table */
    .table{
      width:100%;
      border-collapse:collapse;
      background:#fff;
      font-size:8pt;
      table-layout:fixed;
    }
    .table thead{
      page-break-inside: avoid;
      page-break-after: avoid;
    }
    .table tbody tr{
      page-break-inside: avoid;
    }
    .table th,.table td{
      border:1px solid var(--line);
      padding:7px 6px;
      word-break:break-word;
      overflow-wrap:anywhere;
    }

        /* ✅ 지출내역: 상세내용(3번째 컬럼) 이름이 글자 단위로 쪼개지지 않게 */
    .table.expenses td:nth-child(3){
      word-break: keep-all;     /* '이종훈' 같은 단어를 쪼개지 않음 */
      overflow-wrap: normal;    /* anywhere로 강제 쪼개는 것 방지 */
      white-space: normal;
    }

    .table th{ background:#eef1f6; color:#364152; font-weight:700; }
    .table tbody tr:nth-child(odd){ background:#fbfcfe; }
    
    /* 소모 자재 4열 균등 */
    .table.materials { table-layout:fixed; width:100%; }
    .table.materials th, .table.materials td { width:25%; }
    
/* 영수증 크게 표시 (1열) */
/* 영수증 : 가로 1개 + 거의 정사각형 */
.receipts-table{
  width:100%;
  border-collapse:separate;
  border-spacing:0 14px;
  table-layout:fixed;
}

.receipts-table tr{
  page-break-inside: avoid;
}

.receipts-table td{
  width:100%;
  vertical-align:top;
}

.receipt-card{
  border:1px solid var(--line);
  background:#fff;
  border-radius:10px;
  padding:10px;
  page-break-inside:avoid;
  overflow:hidden;

  /* 🔥 정사각형 느낌 핵심 */
  aspect-ratio: 1 / 1;
}

/* 이미지 꽉 차게 */
.receipt-img{
  width:100%;
  height:100%;
  object-fit:cover;        /* 🔥 여백 제거 */
  border:1px solid #f0f2f6;
}


    
    @media print {
      html, body { background:#fff; }

      /* ✅ 인쇄 프리뷰에서 색상/배경색이 빠지는 현상 최소화 */
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }

      /* ✅ 타임라인/일별시간표 섹션은 특히 강제 */
      .timeline-section, .timeline-section * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
    }
                `}</style>
    
                {/* ✅ A4 폭 적용 범위 */}
                <div className="sheet">
                    {/* 헤더 */}
                    <table className="head-table">
                        <tbody>
                            <tr>
                                <td colSpan={2} align="center">
                                    <table className="brand-row">
                                        <tbody>
                                            <tr>
                                                <td className="logo-cell">
                                                    <img
                                                        src="/images/RTBlogo.png"
                                                        alt="RTB"
                                                        className="logo"
                                                        style={{
                                                            width: "10mm",
                                                            height: "10mm",
                                                        }}
                                                    />
                                                </td>
                                                <td className="title-cell">
                                                     <div className="doc-title">
                                                         {log?.subject?.includes("[교육]") ? "교육 보고서" : "출장 보고서"}
                                                     </div>
                                                 </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </td>
                            </tr>
                        </tbody>
                    </table>
    
                    {/* 기본정보 */}
                    <div className="section">
                        <h2>기본정보</h2>
                        <table className="kvx">
                            <colgroup>
                                <col className="l" />
                                <col className="v" />
                                <col className="l" />
                                <col className="v" />
                            </colgroup>
                            <tbody>
                                {(() => {
                                    const isEducation = log?.subject?.includes("[교육]");
                                    if (isEducation) {
                                        return (
                                            <>
                                                <tr>
                                                    <th>기간</th>
                                                    <td>{workPeriodText}</td>
                                                    <th>작성자</th>
                                                    <td>{String(log.author ?? "")}</td>
                                                </tr>
                                                <tr>
                                                    <th>교육 장소</th>
                                                    <td>{String(log.location ?? "")}</td>
                                                    <th>교육 강사</th>
                                                    <td>{String(log.order_person ?? "")}</td>
                                                </tr>
                                                <tr>
                                                    <th>교육 내용</th>
                                                    <td colSpan={3} style={{ whiteSpace: "pre-wrap" }}>
                                                        {String(log.subject ?? "")}
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <th>참석 인원</th>
                                                    <td colSpan={3}>
                                                        {persons.length ? (
                                                            `${persons.join(", ")} (${persons.length}명)`
                                                        ) : (
                                                            <span className="muted">없음</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            </>
                                        );
                                    }
                                    return (
                                        <>
                                            <tr>
                                                <th>기간</th>
                                                <td>{workPeriodText}</td>
                                                <th>작성자</th>
                                                <td>{String(log.author ?? "")}</td>
                                            </tr>
                                            <tr>
                                                <th>출장지</th>
                                                <td>{String(log.location ?? "")}</td>
                                                <th>호선</th>
                                                <td>{String(log.vessel ?? "")}</td>
                                            </tr>
                                            <tr>
                                                <th>엔진타입</th>
                                                <td>{String(log.engine ?? "").toUpperCase()}</td>
                                                <th>참관감독</th>
                                                <td>
                                                    {String(
                                                        `${log.order_group ?? ""}-${log.order_person ?? ""}`
                                                    ).replace(/^-|-$/g, "")}
                                                </td>
                                            </tr>
                                            <tr>
                                                <th>출장목적</th>
                                                <td colSpan={3} style={{ whiteSpace: "pre-wrap" }}>
                                                    {String(log.subject ?? "")}
                                                </td>
                                            </tr>
                                            <tr>
                                                <th>인원</th>
                                                <td colSpan={3}>
                                                    {persons.length ? (
                                                        `${persons.join(", ")} (${persons.length}명)`
                                                    ) : (
                                                        <span className="muted">없음</span>
                                                    )}
                                                </td>
                                            </tr>
                                        </>
                                    );
                                })()}
                            </tbody>
                        </table>
                    </div>
    
                    {/* 상세정보 */}
                    <div className="section">
                        <h2>상세정보</h2>
                        {!rows.length ? (
                            <p className="muted">등록된 상세정보가 없습니다.</p>
                        ) : (
                            <div className="detail-wrap">
                                <table className="detail-table">
                                    <colgroup>
                                        <col className="dcol-y" />
                                        <col className="dcol-m" />
                                        <col className="dcol-d" />
                                        <col className="dcol-w" />
                                        <col className="dcol-type" />
                                        <col className="dcol-from" />
                                        <col className="dcol-to" />
                                        <col className="dcol-desc" />
                                        <col className="dcol-rmk" />
                                    </colgroup>

                                    <thead>
                                        <tr>
                                            <th>년</th>
                                            <th>월</th>
                                            <th>일</th>
                                            <th>요일</th>
                                            <th>구분</th>
                                            <th>From</th>
                                            <th>To</th>
                                            <th>작업내용(Description)</th>
                                            <th>비고(Remark)</th>
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {(() => {
                                            let lastDateKey: string | null = null;
                                            const printed = new Set<string>();
                                            const out: React.ReactNode[] = [];

                                            rows.forEach((r, idx) => {
                                                const drawSep =
                                                    lastDateKey !== null &&
                                                    r.dateKey &&
                                                    r.dateKey !== lastDateKey &&
                                                    r.y !== "";

                                                if (r.y) lastDateKey = r.dateKey || lastDateKey;

                                                const dateStr = r.dateStr;
                                                const y = dateStr ? Number(dateStr.slice(0, 4)) : NaN;
                                                const dow = dateStr ? new Date(dateStr).getDay() : -1;

                                                const isSat = dow === 6;
                                                const isSun = dow === 0;

                                                const holidaySet = Number.isNaN(y) ? null : holidaysByYear[y];
                                                const isHolidayFixed = holidaySet ? holidaySet.has(dateStr) : false;

                                                const dateCls = isSat
                                                    ? "detail-date-blue"
                                                    : isSun || isHolidayFixed
                                                    ? "detail-date-red"
                                                    : "";

                                                const showDate =
                                                    r.dateKey &&
                                                    !printed.has(r.dateKey) &&
                                                    r.y !== "";

                                                if (showDate) printed.add(r.dateKey);

                                                // ✅ 날짜 변경 구분선
                                                if (drawSep) {
                                                    out.push(
                                                        <tr key={`sep-${idx}`} className="detail-sep">
                                                            <td colSpan={9} />
                                                        </tr>
                                                    );
                                                }

                                                out.push(
                                                    <tr key={`row-${idx}`}>
                                                        {showDate ? (
                                                            <>
                                                                <td className={`detail-center detail-year ${dateCls}`}>{r.y}</td>
                                                                <td className={`detail-center ${dateCls}`}>{r.m}</td>
                                                                <td className={`detail-center ${dateCls}`}>{r.d}</td>
                                                                <td className={`detail-center ${dateCls}`}>{r.w}</td>

                                                            </>
                                                        ) : (
                                                            <>
                                                                {/* ✅ 반복 날짜: 셀은 유지, 내용만 비움(테이블 폭/라인 유지) */}
                                                                <td className="detail-date-empty">-</td>
                                                                <td className="detail-date-empty">-</td>
                                                                <td className="detail-date-empty">-</td>
                                                                <td className="detail-date-empty">-</td>
                                                            </>
                                                        )}

                                                        <td className="detail-center">{r.type}</td>
                                                        <td className="detail-center">{r.from}</td>
                                                        <td className="detail-center">{r.to}</td>

                                                        <td className="detail-pre">
                                                            {r.desc}
                                                            {r.note?.trim() ? (
                                                                <div className="detail-note">
                                                                    특이사항 : {r.note}
                                                                </div>
                                                            ) : null}
                                                        </td>

                                                        <td className="detail-pre">{r.rmk}</td>
                                                    </tr>
                                                );
                                            });

                                            return out;
                                        })()}
                                    </tbody>
                                    </table>
                            </div>
                        )}
                    </div>

                    {/* 타임라인 */}
                    <div className="section timeline-section">

                    <div className="timeline-root">
                        <TimelineSummarySection showWorkTimeRange />
                    </div>
                    </div>

                    {/* 소모 자재 */}
                    <div className="section">
                        <h2>소모 자재</h2>
                        {!materials.length ? (
                            <p className="muted">없음</p>
                        ) : (
                            <table className="table materials">
                                <thead>
                                    <tr>
                                        <th>자재명</th>
                                        <th className="right">수량</th>
                                        <th>자재명</th>
                                        <th className="right">수량</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {Array.from({
                                        length: Math.ceil(materials.length / 2),
                                    }).map((_, i) => {
                                        const a = materials[i * 2];
                                        const b = materials[i * 2 + 1];
                                        return (
                                            <tr key={i}>
                                                <td>{a?.material_name ?? ""}</td>
                                                <td className="right">
                                                    {a ? `${String(a.qty ?? "")} ${a.unit ?? ""}` : ""}
                                                </td>
    
                                                <td>{b?.material_name ?? ""}</td>
                                                <td className="right">
                                                    {b ? `${String(b.qty ?? "")} ${b.unit ?? ""}` : ""}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
    
                    {/* 지출내역 */}
                    <div className="section">
                        <h2>지출내역</h2>
                        {!expenses.length ? (
                            <p className="muted">없음</p>
                        ) : (
                            <table className="table expenses">
                                <thead>
                                    <tr>
                                        <th>날짜</th>
                                        <th>분류</th>
                                        <th>상세내용</th>
                                        <th className="right">금액(￦)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {expenses.map((x, idx) => (
                                        <tr key={idx}>
                                            <td>{x.expense_date ?? ""}</td>
                                            <td>{x.expense_type ?? ""}</td>
                                            <td>{x.detail ?? ""}</td>
                                            <td className="right">
                                                {formatWon(Number(x.amount ?? 0))}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr>
                                        <td
                                            colSpan={3}
                                            className="right"
                                            style={{ fontWeight: 700 }}
                                        >
                                            합계
                                        </td>
                                        <td
                                            className="right"
                                            style={{ fontWeight: 700 }}
                                        >
                                            {formatWon(expenseSum)}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        )}
                    </div>
    
                    {/* 영수증 */}
                    <div className="section">
                        <h2>영수증</h2>

                        {(() => {
                            const categories = [
                                { key: "숙박영수증", title: "숙박 영수증" },
                                { key: "자재구매영수증", title: "자재 영수증" },
                                { key: "식비및유대영수증", title: "식비 및 유대 영수증" },
                                { key: "기타", title: "기타" },
                            ] as const;

                            const grouped = categories.map((c) => ({
                                ...c,
                                items: receiptImgs.filter((r) => r.category === c.key),
                            }));

                            const hasAny = grouped.some((g) => g.items.length > 0);

                            if (!hasAny) {
                                return <p className="muted">없음</p>;
                            }

                            return (
                                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                                    {grouped.map((g) => (
                                        <div key={g.key}>
                                            {/* 카테고리 제목 + 개수 */}
                                            <div
                                                style={{
                                                    display: "flex",
                                                    justifyContent: "space-between",
                                                    alignItems: "center",
                                                    margin: "6px 0 8px",
                                                }}
                                            >
                                                <div style={{ fontWeight: 700, fontSize: "11pt" }}>
                                                    {g.title}
                                                </div>
                                                <div style={{ fontSize: "9pt", color: "#6b7280" }}>
                                                    {g.items.length}개
                                                </div>
                                            </div>

                                            {g.items.length === 0 ? (
                                                <div className="muted" style={{ fontSize: "9pt" }}>
                                                    해당 분류에 첨부파일이 없습니다.
                                                </div>
                                            ) : (
                                                <table className="receipts-table">
                                                    <tbody>
                                                        {Array.from({
                                                            length: Math.ceil(g.items.length / 2),
                                                        }).map((_, i) => {
                                                            const a = g.items[i * 2];
                                                            const b = g.items[i * 2 + 1];

                                                            return (
                                                                <tr key={`${g.key}-${i}`}>
                                                                    <td>
                                                                        {a ? (
                                                                            <div
                                                                                className="receipt-card"
                                                                                style={{ position: "relative" }}
                                                                            >
                                                                                {imageErrors.has(a.id) ? (
                                                                                    <div
                                                                                        className="receipt-img"
                                                                                        style={{
                                                                                            display: "flex",
                                                                                            alignItems: "center",
                                                                                            justifyContent: "center",
                                                                                            backgroundColor: "#f3f4f6",
                                                                                            color: "#6b7280",
                                                                                            fontSize: "12px",
                                                                                            textAlign: "center",
                                                                                            padding: "20px",
                                                                                        }}
                                                                                    >
                                                                                        <div>
                                                                                            <div>이미지를</div>
                                                                                            <div>불러올 수 없습니다</div>
                                                                                        </div>
                                                                                    </div>
                                                                                ) : (
                                                                                    <img
                                                                                        key={`receipt-${a.id}-${a.storagePath}`}
                                                                                        className="receipt-img"
                                                                                        src={(isPreparingPrint && printReceiptSrcMap[a.id]) ? printReceiptSrcMap[a.id] : a.url}
                                                                                        alt={a.name || "receipt"}
                                                                                        onError={() => handleImageError(a.id)}
                                                                                        style={{ display: "block" }}
                                                                                    />
                                                                                )}

                                                                                <div
                                                                                    className="receipt-caption"
                                                                                    style={{
                                                                                        marginTop: "8px",
                                                                                        fontSize: "10px",
                                                                                        color: "#6b7280",
                                                                                    }}
                                                                                >
                                                                                    {a.name || a.url.split("/").pop()}
                                                                                </div>
                                                                            </div>
                                                                        ) : null}
                                                                    </td>

                                                                    <td>
                                                                        {b ? (
                                                                            <div
                                                                                className="receipt-card"
                                                                                style={{ position: "relative" }}
                                                                            >
                                                                                {imageErrors.has(b.id) ? (
                                                                                    <div
                                                                                        className="receipt-img"
                                                                                        style={{
                                                                                            display: "flex",
                                                                                            alignItems: "center",
                                                                                            justifyContent: "center",
                                                                                            backgroundColor: "#f3f4f6",
                                                                                            color: "#6b7280",
                                                                                            fontSize: "12px",
                                                                                            textAlign: "center",
                                                                                            padding: "20px",
                                                                                        }}
                                                                                    >
                                                                                        <div>
                                                                                            <div>이미지를</div>
                                                                                            <div>불러올 수 없습니다</div>
                                                                                        </div>
                                                                                    </div>
                                                                                ) : (
                                                                                    <img
                                                                                        key={`receipt-${b.id}-${b.storagePath}`}
                                                                                        className="receipt-img"
                                                                                        src={(isPreparingPrint && printReceiptSrcMap[b.id]) ? printReceiptSrcMap[b.id] : b.url}
                                                                                        alt={b.name || "receipt"}
                                                                                        onError={() => handleImageError(b.id)}
                                                                                        style={{ display: "block" }}
                                                                                    />
                                                                                )}

                                                                                <div
                                                                                    className="receipt-caption"
                                                                                    style={{
                                                                                        marginTop: "8px",
                                                                                        fontSize: "10px",
                                                                                        color: "#6b7280",
                                                                                    }}
                                                                                >
                                                                                    {b.name || b.url.split("/").pop()}
                                                                                </div>
                                                                            </div>
                                                                        ) : null}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            );
                        })()}
                    </div>


                </div>
            </div>
        );
    }
    
