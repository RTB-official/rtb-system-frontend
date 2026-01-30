// src/pages/TBM/TbmPdfPage.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Button from "../../components/common/Button";
import { IconDownload } from "../../components/icons/Icons";
import { getTbmDetail, TbmParticipant, TbmRecord } from "../../lib/tbmApi";

const normalizeList = (items?: string[] | null, fallback?: string | null) => {
    if (items && items.length > 0) {
        return items.map((value) => value.trim()).filter(Boolean);
    }
    if (fallback) {
        return fallback
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean);
    }
    return [];
};

const badgeClasses = ["bg-yellow-200 text-[#9a6c00]", "bg-emerald-100 text-[#1a5b40]"];

const getBadgeClass = (idx: number) => badgeClasses[idx % badgeClasses.length];

const buildParticipantPairs = (participants: TbmParticipant[]) => {
    const rows: Array<[TbmParticipant | null, TbmParticipant | null]> = [];
    for (let i = 0; i < participants.length; i += 2) {
        rows.push([participants[i] || null, participants[i + 1] || null]);
    }
    if (rows.length === 0) rows.push([null, null]);
    return rows;
};

export default function TbmPdfPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [tbm, setTbm] = useState<TbmRecord | null>(null);
    const [participants, setParticipants] = useState<TbmParticipant[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!id) {
            setError("TBM ID가 필요합니다.");
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(null);
        getTbmDetail(id)
            .then(({ tbm, participants }) => {
                setTbm(tbm);
                setParticipants(participants);
            })
            .catch((e: any) => {
                setError(e?.message || "TBM 정보를 불러오지 못했습니다.");
            })
            .finally(() => setLoading(false));
    }, [id]);

    const processRows = useMemo(() => {
        if (!tbm) return [];
        const processes = normalizeList(tbm.process_items, tbm.process);
        const hazards = normalizeList(tbm.hazard_items, tbm.hazard);
        const measures = normalizeList(tbm.measure_items, tbm.measure);
        const maxLen = Math.max(processes.length, hazards.length, measures.length);
        return Array.from({ length: maxLen }, (_, idx) => ({
            process: processes[idx] || "-",
            hazard: hazards[idx] || "-",
            measure: measures[idx] || "-",
        }));
    }, [tbm]);

    const participantRows = useMemo(() => buildParticipantPairs(participants), [participants]);

    const printPdf = () => {
        window.print();
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#f4f6fb] flex items-center justify-center">
                <p className="text-sm text-gray-600">PDF를 준비 중입니다…</p>
            </div>
        );
    }

    if (error || !tbm) {
        return (
            <div className="min-h-screen bg-[#f4f6fb] flex items-center justify-center">
                <div className="bg-white px-6 py-4 rounded-xl shadow-md">
                    <p className="text-sm text-red-600">{error || "TBM을 찾을 수 없습니다."}</p>
                    <button
                        onClick={() => navigate("/tbm")}
                        className="mt-3 text-sm text-blue-600 underline"
                    >
                        TBM 목록으로 돌아가기
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f4f6fb] pb-10">
            <div className="max-w-[920px] mx-auto">
                <div className="flex justify-end pt-6 px-4">
                    <Button
                        variant="primary"
                        size="md"
                        icon={<IconDownload />}
                        onClick={printPdf}
                    >
                        PDF로 저장
                    </Button>
                </div>
                <div className="bg-white border border-[#dfe3ea] rounded-[28px] shadow-[0_24px_70px_rgba(15,23,42,0.08)] mt-4 mx-4 pb-8 print:shadow-none">
                    <div className="py-6 text-center text-xl font-semibold">TBM 회의록</div>
                    <div className="px-6">
                        <table className="w-full text-sm border border-[#dfe3ea] rounded-xl overflow-hidden">
                            <tbody>
                                {[
                                    ["TBM 일시", tbm.tbm_date ? `${tbm.tbm_date.replace(/-/g, ".")}.` : "-"],
                                    ["호선명", tbm.line_name || "-"],
                                    ["작업명", tbm.work_name || "-"],
                                    ["작업내용", tbm.work_content || "-"],
                                    ["TBM 장소", tbm.location || "-"],
                                    [
                                        "위험성평가 실시여부",
                                        tbm.risk_assessment === null ? "예" : tbm.risk_assessment ? "예" : "아니오",
                                    ],
                                ].map(([label, value]) => (
                                    <tr key={label} className="border-b border-[#dfe3ea] last:border-none">
                                        <th className="text-left px-4 py-3 bg-[#f8f8f8] w-[35%]">{label}</th>
                                        <td className="px-4 py-3">{value}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <div className="mt-6 text-sm">
                            <div className="font-semibold mb-2">공정 · 잠재적 위험요인 · 대책</div>
                            <div className="w-full border border-[#dfe3ea] rounded-[14px] overflow-hidden">
                                <div className="grid grid-cols-[auto_1fr_auto] text-center text-xs font-semibold bg-[#f0f2f7] text-[#3f3f3f]">
                                    <div className="px-3 py-2 border-r border-[#dfe3ea]">공정</div>
                                    <div className="px-3 py-2 border-r border-[#dfe3ea]">잠재적 위험요인</div>
                                    <div className="px-3 py-2">대책</div>
                                </div>
                                <div>
                                    {processRows.length ? (
                                        processRows.map((row, idx) => (
                                            <div
                                                key={`${row.process}-${idx}`}
                                                className="grid grid-cols-[auto_1fr_auto] text-xs text-[#3f3f3f] even:bg-[#fbfbfb]"
                                            >
                                                <div className="px-3 py-3 border-t border-[#dfe3ea] border-r border-[#dfe3ea]">
                                                    <span className="px-3 py-1 rounded-full bg-[#fbe8b7] text-[#9d6900]">
                                                        {row.process}
                                                    </span>
                                                </div>
                                                <div className="px-3 py-3 border-t border-[#dfe3ea] border-r border-[#dfe3ea]">
                                                    <span className="px-3 py-1 rounded-full bg-[#dff7e4] text-[#1e5f3b]">
                                                        {row.hazard}
                                                    </span>
                                                </div>
                                                <div className="px-3 py-3 border-t border-[#dfe3ea]">
                                                    <span className="px-3 py-1 rounded-full bg-[#fcebb8] text-[#9d6900]">
                                                        {row.measure}
                                                    </span>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="px-3 py-3">
                                            <p className="text-gray-500">정보가 없습니다.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 text-sm">
                            <div className="font-semibold mb-1">작업 중 위험요인 안전점검 및 실시 결과</div>
                            <p className="border border-[#dfe3ea] rounded-2xl px-4 py-5 min-h-[60px]">
                                {tbm.during_result || "-"}
                            </p>
                        </div>

                        <div className="mt-6 text-sm">
                            <div className="font-semibold mb-1">작업 종료 후 미팅</div>
                            <p className="border border-[#dfe3ea] rounded-2xl px-4 py-5 min-h-[60px]">
                                {tbm.after_meeting || "-"}
                            </p>
                        </div>

                        <div className="mt-6 text-sm">
                            <div className="font-semibold mb-3">참석자 확인</div>
                            <div className="w-full border border-[#dfe3ea] rounded-[18px] overflow-hidden">
                                <div className="flex text-sm font-semibold bg-[#f0f2f7] text-[#433f3f]">
                                    <div className="w-1/4 px-3 py-2 border-r border-[#dfe3ea]">이름</div>
                                    <div className="w-1/4 px-3 py-2 border-r border-[#dfe3ea]">서명</div>
                                    <div className="w-1/4 px-3 py-2 border-r border-[#dfe3ea]">이름</div>
                                    <div className="w-1/4 px-3 py-2">서명</div>
                                </div>
                                <div className="">
                                    {participantRows.map((row, idx) => (
                                        <div
                                            key={`participant-row-${idx}`}
                                            className="flex text-sm even:bg-[#fbfbfb] text-[#3c3c3c]"
                                        >
                                            <div className="w-1/4 px-3 py-3 border-r border-[#dfe3ea]">
                                                {row[0]?.name || "-"}
                                            </div>
                                            <div className="w-1/4 px-3 py-3 border-r border-[#dfe3ea]">
                                                {row[0]?.signed_at ? "✔︎" : ""}
                                            </div>
                                            <div className="w-1/4 px-3 py-3 border-r border-[#dfe3ea]">
                                                {row[1]?.name || "-"}
                                            </div>
                                            <div className="w-1/4 px-3 py-3">
                                                {row[1]?.signed_at ? "✔︎" : ""}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
