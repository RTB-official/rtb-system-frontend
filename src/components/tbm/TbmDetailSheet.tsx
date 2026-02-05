import { useMemo } from "react";
import Chip from "../ui/Chip";
import EmptyValueIndicator from "../../pages/Expense/components/EmptyValueIndicator";
import { TbmParticipant, TbmRecord } from "../../lib/tbmApi";
import useIsMobile from "../../hooks/useIsMobile";

type TbmDetailSheetProps = {
    tbm: TbmRecord;
    participants: TbmParticipant[];
    variant?: "screen" | "pdf";
    currentUserId?: string | null;
    onSign?: (participant: TbmParticipant) => void;
};

const stripCodePrefix = (value: string) =>
    value.replace(/^[A-Z0-9]+(?:-[A-Z0-9]+)+\s+/, "");

const processColorMap: Record<string, string> = {
    "\uBD84\uD574\uC870\uB9BD(\uAE30\uBCF8)": "orange-500",
    "\uC720\uC555": "green-500",
    "\uCC54\uBC84": "blue-500",
    "\uC808\uB2E8/\uD654\uAE30": "red-600",
};

const getProcessBadgeClass = (name: string) =>
    processColorMap[name] || "gray-500";

const normalizeList = (items: string[] | null, fallback: string | null) => {
    if (items && items.length > 0) {
        return items.map(stripCodePrefix);
    }
    if (fallback) {
        return fallback
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean)
            .map(stripCodePrefix);
    }
    return [] as string[];
};

const buildRows = (record: TbmRecord) => {
    const processList = normalizeList(record.process_items, record.process);
    const hazardList = normalizeList(record.hazard_items, record.hazard);
    const measureList = normalizeList(record.measure_items, record.measure);
    const rowCount = Math.max(
        processList.length,
        hazardList.length,
        measureList.length
    );

    return Array.from({ length: rowCount }, (_, idx) => {
        const processLabel = processList[idx] || "";
        const badgeClass = getProcessBadgeClass(processLabel);
        return {
            key: `${processLabel}-${hazardList[idx] || ""}-${measureList[idx] || ""}-${idx}`,
            process: processLabel,
            hazard: hazardList[idx] || "",
            measure: measureList[idx] || "",
            badgeClass,
        };
    });
};

const badgeBgMap: Record<string, string> = {
    "orange-500": "#f97316",
    "green-500": "#22c55e",
    "blue-500": "#3b82f6",
    "red-600": "#dc2626",
    "gray-500": "#6b7280",
};

const renderBadge = (
    label: string,
    color: string,
    variant: "screen" | "pdf",
    usePlainText?: boolean
) => {
    if (!label) {
        return <EmptyValueIndicator />;
    }
    if (variant === "pdf") {
        const bgColor = badgeBgMap[color] ?? "#6b7280";
        return (
            <span
                style={{
                    backgroundColor: bgColor,
                    color: "#ffffff",
                    padding: "0px 12px 12px 12px",
                    borderRadius: "6px",
                    fontSize: "13px",
                    fontWeight: 500,
                    lineHeight: 1.3,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    maxWidth: "100%",
                    whiteSpace: "normal",
                    wordBreak: "keep-all",
                    textAlign: "center",
                    verticalAlign: "middle",
                }}
            >
                {label}
            </span>
        );
    }
    if (usePlainText) {
        return (
            <span className="block text-left text-gray-900 text-sm leading-relaxed break-keep">
                {label}
            </span>
        );
    }
    return (
        <Chip color={color} variant="filled" size="lg">
            {label}
        </Chip>
    );
};

const renderPdfText = (value: string | null | undefined) => {
    if (!value) {
        return (
            <span style={{ display: "inline-block" }}>
                <EmptyValueIndicator />
            </span>
        );
    }
    return value;
};

export default function TbmDetailSheet({
    tbm,
    participants,
    variant = "screen",
    currentUserId,
    onSign,
}: TbmDetailSheetProps) {
    const isMobile = useIsMobile();
    const detailRows = useMemo(() => buildRows(tbm), [tbm]);
    const groupedParticipants = useMemo(() => {
        const rows: Array<[TbmParticipant | null, TbmParticipant | null]> = [];
        for (let i = 0; i < participants.length; i += 2) {
            rows.push([participants[i] || null, participants[i + 1] || null]);
        }
        if (rows.length === 0) {
            rows.push([null, null]);
        }
        return rows;
    }, [participants]);

    const renderSignatureCell = (participant: TbmParticipant | null) => {
        if (variant === "pdf") {
            return (
                <div className="flex items-center justify-center text-[16px] -mt-2 font-bold text-gray-900">
                    {participant?.signed_at ? "✓" : ""}
                </div>
            );
        }

        const canSign =
            !!participant &&
            participant.user_id === currentUserId &&
            !participant.signed_at;

        return (
            <div className="flex items-center justify-center">
                <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-gray-200 text-blue-600 focus:ring-blue-500"
                    checked={!!participant?.signed_at}
                    disabled={!canSign}
                    onChange={() => participant && onSign?.(participant)}
                />
            </div>
        );
    };

    const pdfBorderStyle = {
        border: "1px solid #e5e7eb",
        fontFamily: '"Pretendard JP", sans-serif',
        verticalAlign: "middle" as const,
    };
    const pdfBgGrayHead = { backgroundColor: "#f3f4f6", ...pdfBorderStyle };
    const pdfBgGraySubHead = { backgroundColor: "#f9fafb", ...pdfBorderStyle };
    const pdfThStyle = {
        ...pdfBgGraySubHead,
        color: "#374151",
        textAlign: "left" as const,
        paddingTop: "4px",
        paddingRight: "20px",
        paddingBottom: "18px",
        paddingLeft: "20px",
        lineHeight: 1.4,
        verticalAlign: "middle" as const,
    };
    const pdfTdStyle = {
        ...pdfBorderStyle,
        textAlign: "left" as const,
        paddingTop: "4px",
        paddingRight: "20px",
        paddingBottom: "18px",
        paddingLeft: "20px",
        color: "#111827",
        lineHeight: 1.4,
        verticalAlign: "middle" as const,
    };

    if (variant === "pdf") {
        return (
            <div data-tbm-sheet style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact", fontFamily: '"Pretendard JP", sans-serif' }}>
                <table className="w-full text-sm border-collapse table-fixed" style={{ borderCollapse: "collapse" }}>
                    <tbody>
                        {/* Title Row */}
                        <tr>
                            <td
                                colSpan={4}
                                className="text-center font-semibold -mt-10"
                                style={{
                                    ...pdfBgGrayHead,
                                    paddingTop: "10px",
                                    paddingRight: "20px",
                                    paddingBottom: "30px",
                                    paddingLeft: "20px",
                                    fontSize: "22px",
                                }}
                            >
                                TBM 회의록
                            </td>
                        </tr>

                        {/* Basic Info Rows */}
                        <tr>
                            <th style={{ ...pdfThStyle, width: "150px" }}>TBM 일시</th>
                            <td colSpan={3} style={pdfTdStyle}>
                                {tbm.tbm_date ? String(tbm.tbm_date).replace(/-/g, ".") + "." : renderPdfText("")}
                            </td>
                        </tr>
                        <tr>
                            <th style={pdfThStyle}>{"\uD638\uC120\uBA85"}</th>
                            <td colSpan={3} style={pdfTdStyle}>{renderPdfText(tbm.line_name)}</td>
                        </tr>
                        <tr>
                            <th style={pdfThStyle}>작업명</th>
                            <td colSpan={3} style={pdfTdStyle}>{renderPdfText(tbm.work_name)}</td>
                        </tr>
                        <tr>
                            <th style={pdfThStyle}>작업내용</th>
                            <td colSpan={3} style={{ ...pdfTdStyle, whiteSpace: "pre-line", lineHeight: 1.6 }}>
                                {renderPdfText(tbm.work_content)}
                            </td>
                        </tr>
                        <tr>
                            <th style={pdfThStyle}>TBM 장소</th>
                            <td colSpan={3} style={pdfTdStyle}>{renderPdfText(tbm.location)}</td>
                        </tr>
                        <tr>
                            <th style={{ ...pdfThStyle, width: "150px", whiteSpace: "normal", lineHeight: 1.4 }}>
                                위험성평가
                                <br />
                                실시 여부
                            </th>
                            <td colSpan={3} style={pdfTdStyle}>
                                {tbm.risk_assessment === null ? renderPdfText("") : tbm.risk_assessment ? "예" : "아니오"}
                            </td>
                        </tr>

                        {/* Hazard Analysis Headers */}
                        <tr style={pdfBgGraySubHead}>
                            <th
                                className="text-center font-bold"
                                style={{ ...pdfBorderStyle, paddingTop: "4px", paddingBottom: "18px", paddingLeft: "10px", paddingRight: "10px", width: "150px" }}
                            >
                                {"\uACF5\uC815"}
                            </th>
                            <th
                                className="text-center font-bold"
                                style={{ ...pdfBorderStyle, paddingTop: "4px", paddingBottom: "18px", paddingLeft: "10px", paddingRight: "10px", width: "35%" }}
                            >
                                {"\uC7A0\uC7AC\uC801 \uC704\uD5D8\uC694\uC778"}
                            </th>
                            <th
                                colSpan={2}
                                className="text-center font-bold"
                                style={{ ...pdfBorderStyle, paddingTop: "4px", paddingBottom: "18px", paddingLeft: "10px", paddingRight: "10px" }}
                            >
                                {"\uB300\uCC45"}
                            </th>
                        </tr>

                        {/* Hazard Analysis Rows */}
                        {detailRows.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="py-8 text-center text-gray-500" style={pdfBorderStyle}>정보가 없습니다.</td>
                            </tr>
                        ) : (
                            detailRows.map((row) => (
                                <tr key={row.key}>
                                    <td className="text-center align-middle" style={{ ...pdfBorderStyle, paddingTop: "6px", paddingBottom: "14px", paddingLeft: "8px", paddingRight: "8px" }}>
                                        {renderBadge(row.process, row.badgeClass, "pdf")}
                                    </td>
                                    <td className="text-center align-middle" style={{ ...pdfBorderStyle, paddingTop: "6px", paddingBottom: "14px", paddingLeft: "8px", paddingRight: "8px" }}>
                                        {renderBadge(row.hazard, row.badgeClass, "pdf")}
                                    </td>
                                    <td colSpan={2} className="text-center align-middle" style={{ ...pdfBorderStyle, paddingTop: "6px", paddingBottom: "14px", paddingLeft: "8px", paddingRight: "8px" }}>
                                        {renderBadge(row.measure, row.badgeClass, "pdf")}
                                    </td>
                                </tr>
                            ))
                        )}

                        {/* Result Sections */}
                        <tr>
                            <td
                                colSpan={4}
                                className="text-center font-bold"
                                style={{ ...pdfBgGraySubHead, paddingTop: "4px", paddingBottom: "18px", paddingLeft: "10px", paddingRight: "10px", color: "#1f2937" }}
                            >
                                작업 중 위험요인 안전점검 및 실시 결과
                            </td>
                        </tr>
                        <tr>
                            <td colSpan={4} className="px-8 py-4 min-h-[60px]" style={{ ...pdfTdStyle, paddingTop: "8px", paddingRight: "32px", paddingBottom: "22px", paddingLeft: "32px" }}>
                                {renderPdfText(tbm.during_result)}
                            </td>
                        </tr>

                        <tr>
                            <td
                                colSpan={4}
                                className="text-center font-bold"
                                style={{ ...pdfBgGraySubHead, paddingTop: "4px", paddingBottom: "18px", paddingLeft: "10px", paddingRight: "10px", color: "#1f2937" }}
                            >
                                작업 종료 후 미팅
                            </td>
                        </tr>
                        <tr>
                            <td colSpan={4} className="px-8 py-4 min-h-[60px]" style={{ ...pdfTdStyle, paddingTop: "8px", paddingRight: "32px", paddingBottom: "22px", paddingLeft: "32px" }}>
                                {renderPdfText(tbm.after_meeting)}
                            </td>
                        </tr>

                        {/* Participant Section Header */}
                        <tr>
                            <td
                                colSpan={4}
                                className="text-center font-bold"
                                style={{ ...pdfBgGraySubHead, paddingTop: "4px", paddingBottom: "18px", paddingLeft: "10px", paddingRight: "10px", color: "#1f2937" }}
                            >
                                참석자 확인
                            </td>
                        </tr>
                        <tr style={pdfBgGraySubHead}>
                            <th className="text-center font-bold" style={{ ...pdfBorderStyle, paddingTop: "4px", paddingBottom: "18px", paddingLeft: "10px", paddingRight: "10px" }}>이름</th>
                            <th className="text-center font-bold" style={{ ...pdfBorderStyle, paddingTop: "4px", paddingBottom: "18px", paddingLeft: "10px", paddingRight: "10px" }}>서명</th>
                            <th className="text-center font-bold" style={{ ...pdfBorderStyle, paddingTop: "4px", paddingBottom: "18px", paddingLeft: "10px", paddingRight: "10px" }}>이름</th>
                            <th className="text-center font-bold" style={{ ...pdfBorderStyle, paddingTop: "4px", paddingBottom: "18px", paddingLeft: "10px", paddingRight: "10px" }}>서명</th>
                        </tr>

                        {/* Participant Rows */}
                        {groupedParticipants.map(([left, right], idx) => (
                            <tr key={idx}>
                                <td style={{ ...pdfTdStyle, paddingTop: "4px", paddingRight: "32px", paddingBottom: "18px", paddingLeft: "32px", fontWeight: 500 }}>
                                    {renderPdfText(left?.name)}
                                </td>
                                <td style={{ ...pdfBorderStyle, textAlign: "center", verticalAlign: "middle" }}>
                                    {renderSignatureCell(left)}
                                </td>
                                <td style={{ ...pdfTdStyle, paddingTop: "4px", paddingRight: "32px", paddingBottom: "18px", paddingLeft: "32px", fontWeight: 500 }}>
                                    {renderPdfText(right?.name)}
                                </td>
                                <td style={{ ...pdfBorderStyle, textAlign: "center", verticalAlign: "middle" }}>
                                    {renderSignatureCell(right)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    }

    return (
        <div
            className="border rounded-xl overflow-hidden bg-white border-gray-200"
            data-tbm-sheet
        >
            <div className="text-center font-semibold py-4 md:py-6 border-b border-gray-200 bg-gray-50/30 text-lg md:text-xl min-w-0">
                TBM 회의록
            </div>

            <table className="w-full text-sm border-collapse table-fixed">
                <colgroup>
                    <col className="w-[100px] md:w-[140px]" />
                    <col />
                </colgroup>
                <tbody>
                    <tr className="border-b border-gray-200">
                        <th className="text-left px-3 py-2 md:px-5 md:py-3 border-r border-gray-200 font-semibold bg-gray-50/80 text-gray-700">
                            TBM 일시
                        </th>
                        <td className="px-3 py-2 md:px-5 md:py-3 text-gray-900">
                            {tbm.tbm_date ? String(tbm.tbm_date).replace(/-/g, ".") + "." : <EmptyValueIndicator />}
                        </td>
                    </tr>
                    <tr className="border-b border-gray-200">
                        <th className="text-left px-3 py-2 md:px-5 md:py-3 border-r border-gray-200 font-semibold bg-gray-50/80 text-gray-700 min-w-0">
                            {"\uD638\uC120\uBA85"}
                        </th>
                        <td className="px-3 py-2 md:px-5 md:py-3 text-gray-900">
                            {tbm.line_name ? tbm.line_name : <EmptyValueIndicator />}
                        </td>
                    </tr>
                    <tr className="border-b border-gray-200">
                        <th className="text-left px-3 py-2 md:px-5 md:py-3 border-r border-gray-200 font-semibold bg-gray-50/80 text-gray-700 min-w-0">
                            작업명
                        </th>
                        <td className="px-3 py-2 md:px-5 md:py-3 text-gray-900">
                            {tbm.work_name ? tbm.work_name : <EmptyValueIndicator />}
                        </td>
                    </tr>
                    <tr className="border-b border-gray-200">
                        <th className="text-left px-3 py-2 md:px-5 md:py-3 border-r border-gray-200 font-semibold bg-gray-50/80 text-gray-700 min-w-0">
                            작업내용
                        </th>
                        <td className="px-3 py-2 md:px-5 md:py-3 text-gray-900 whitespace-pre-line leading-relaxed">
                            {tbm.work_content ? tbm.work_content : <EmptyValueIndicator />}
                        </td>
                    </tr>
                    <tr className="border-b border-gray-200">
                        <th className="text-left px-3 py-2 md:px-5 md:py-3 border-r border-gray-200 font-semibold bg-gray-50/80 text-gray-700 min-w-0">
                            TBM 장소
                        </th>
                        <td className="px-3 py-2 md:px-5 md:py-3 text-gray-900">
                            {tbm.location ? tbm.location : <EmptyValueIndicator />}
                        </td>
                    </tr>
                    <tr className="border-b border-gray-200">
                        <th className="text-left px-3 py-2 md:px-5 md:py-3 border-r border-gray-200 font-semibold bg-gray-50/80 text-gray-700 align-top leading-snug">
                            위험성평가
                            <br />
                            실시 여부
                        </th>
                        <td className="px-3 py-2 md:px-5 md:py-3 text-gray-900">
                            {tbm.risk_assessment === null ? <EmptyValueIndicator /> : tbm.risk_assessment ? "예" : "아니오"}
                        </td>
                    </tr>
                    <tr>
                        <td className="p-0" colSpan={2}>
                            <div className="overflow-x-auto -mx-px">
                                <table className="w-full text-sm border-collapse min-w-[480px]" style={{ tableLayout: "fixed" }}>
                                    <thead>
                                        <tr className="border-b bg-gray-50 border-gray-200">
                                            <th className="w-[100px] md:w-[140px] text-center px-2 py-1.5 md:px-3 md:py-2 border-r border-gray-200 text-xs md:text-sm font-bold text-gray-800 whitespace-nowrap">
                                                {"\uACF5\uC815"}
                                            </th>
                                            <th className="text-center px-2 py-1.5 md:px-3 md:py-2 border-r border-gray-200 text-xs md:text-sm font-bold text-gray-800 whitespace-nowrap">
                                                {"\uC7A0\uC7AC\uC801 \uC704\uD5D8\uC694\uC778"}
                                            </th>
                                            <th className="text-center px-2 py-1.5 md:px-3 md:py-2 text-xs md:text-sm font-bold text-gray-800 whitespace-nowrap">
                                                {"\uB300\uCC45"}
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {detailRows.length === 0 ? (
                                            <tr>
                                                <td className="px-2 py-3 md:px-3 md:py-4 text-gray-500 text-center text-xs md:text-sm" colSpan={3}>정보가 없습니다.</td>
                                            </tr>
                                        ) : (
                                            detailRows.map((row) => (
                                                <tr key={row.key} className="border-b border-gray-200 last:border-0">
                                                    <td className="px-1.5 py-2 md:px-2 md:py-3 border-r border-gray-200 align-middle text-center">
                                                        {renderBadge(row.process, row.badgeClass, "screen", isMobile)}
                                                    </td>
                                                    <td className="px-2 py-2 md:px-3 md:py-3 border-r border-gray-200 align-middle text-center min-w-[120px]">
                                                        {renderBadge(row.hazard, row.badgeClass, "screen", isMobile)}
                                                    </td>
                                                    <td className="px-2 py-2 md:px-3 md:py-3 align-middle text-center min-w-[120px]">
                                                        {renderBadge(row.measure, row.badgeClass, "screen", isMobile)}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>

            <div className="border-t border-gray-200">
                <div className="text-center font-bold py-2 md:py-2.5 border-b border-gray-200 bg-gray-50/50 text-gray-800 text-sm md:text-base">
                    작업 중 위험요인 안전점검 및 실시 결과
                </div>
                <div className="p-3 px-4 md:p-4 md:px-6 text-gray-900 whitespace-pre-line leading-relaxed min-h-[48px] md:min-h-[60px] text-sm md:text-base">
                    {tbm.during_result ? tbm.during_result : <EmptyValueIndicator />}
                </div>
            </div>

            <div className="border-t border-gray-200">
                <div className="text-center font-bold py-2 md:py-2.5 border-b border-gray-200 bg-gray-50/50 text-gray-800 text-sm md:text-base">
                    작업 종료 후 미팅
                </div>
                <div className="p-3 px-4 md:p-4 md:px-6 text-gray-900 whitespace-pre-line leading-relaxed min-h-[48px] md:min-h-[60px] text-sm md:text-base">
                    {tbm.after_meeting ? tbm.after_meeting : <EmptyValueIndicator />}
                </div>
            </div>

            <div className="border-t border-gray-200">
                <div className="text-center font-bold py-2 md:py-2.5 border-b border-gray-200 bg-gray-50/50 text-gray-800 text-sm md:text-base">
                    참석자 확인
                </div>
                <table className="w-full text-xs md:text-sm border-collapse table-fixed">
                    <thead>
                        <tr className="border-b border-gray-200 bg-gray-50/80">
                            <th className="py-2 md:py-2.5 border-r border-gray-200 font-bold text-gray-700">이름</th>
                            <th className="py-2 md:py-2.5 border-r border-gray-200 font-bold text-gray-700">서명</th>
                            <th className="py-2 md:py-2.5 border-r border-gray-200 font-bold text-gray-700">이름</th>
                            <th className="py-2 md:py-2.5 font-bold text-gray-700">서명</th>
                        </tr>
                    </thead>
                    <tbody>
                        {groupedParticipants.map(([left, right], idx) => (
                            <tr key={idx} className="border-b border-gray-200 last:border-b-0">
                                <td className="px-3 py-2 md:px-6 md:py-3 border-r border-gray-200 text-left font-medium text-gray-900">
                                    {left?.name ? left.name : <EmptyValueIndicator />}
                                </td>
                                <td className="px-2 py-2 md:px-4 md:py-3 border-r border-gray-200 align-middle">{renderSignatureCell(left)}</td>
                                <td className="px-3 py-2 md:px-6 md:py-3 border-r border-gray-200 text-left font-medium text-gray-900">
                                    {right?.name ? right.name : <EmptyValueIndicator />}
                                </td>
                                <td className="px-2 py-2 md:px-4 md:py-3 align-middle">{renderSignatureCell(right)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
