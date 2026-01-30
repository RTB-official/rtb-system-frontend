// src/pages/TBM/TbmDetailPage.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/common/Header";
import Button from "../../components/common/Button";
import { useToast } from "../../components/ui/ToastProvider";
import { getTbmDetail, signTbm, TbmParticipant, TbmRecord } from "../../lib/tbmApi";
import { useUser } from "../../hooks/useUser";

export default function TbmDetailPage() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const navigate = useNavigate();
    const { id } = useParams();
    const { showError, showSuccess } = useToast();
    const { currentUserId } = useUser();
    const [loading, setLoading] = useState(true);
    const [tbm, setTbm] = useState<TbmRecord | null>(null);
    const [participants, setParticipants] = useState<TbmParticipant[]>([]);

    useEffect(() => {
        const load = async () => {
            if (!id) return;
            try {
                setLoading(true);
                const data = await getTbmDetail(id);
                setTbm(data.tbm);
                setParticipants(data.participants);
            } catch (e: any) {
                showError(e?.message || "TBM을 불러오지 못했습니다.");
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [id, showError]);

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

    const handleSign = async (participant: TbmParticipant) => {
        if (!id || !currentUserId) return;
        if (participant.user_id !== currentUserId) return;
        if (participant.signed_at) return;

        try {
            await signTbm(id, currentUserId);
            setParticipants((prev) =>
                prev.map((p) =>
                    p.user_id === currentUserId
                        ? { ...p, signed_at: new Date().toISOString() }
                        : p
                )
            );
            showSuccess("서명 처리되었습니다.");
        } catch (e: any) {
            showError(e?.message || "서명 처리에 실패했습니다.");
        }
    };

    const stripCodePrefix = (value: string) =>
        value.replace(/^[A-Z0-9]+(?:-[A-Z0-9]+)+\s+/, "");

    const processColorMap: Record<string, string> = {
        "\uBD84\uD574\uC870\uB9BD(\uAE30\uBCF8)": "bg-yellow-200 text-gray-800",
        "\uC720\uC555": "bg-green-200 text-gray-800",
        "\uCC54\uBC84": "bg-blue-200 text-gray-800",
        "\uC808\uB2E8/\uD654\uAE30": "bg-red-200 text-gray-800",
    };

    const getProcessBadgeClass = (name: string) =>
        processColorMap[name] || "bg-gray-100 text-gray-700";

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

    const renderBadge = (label: string, badgeClass: string) => {
        if (!label) {
            return <span className="text-gray-500">-</span>;
        }
        return (
            <span
                className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${badgeClass}`}
            >
                {label}
            </span>
        );
    };

    const detailRows = tbm ? buildRows(tbm) : [];

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
                    title="TBM 상세"
                    onMenuClick={() => setSidebarOpen(true)}
                    rightContent={
                        <Button
                            variant="outline"
                            size="lg"
                            onClick={() => navigate("/tbm")}
                        >
                            목록
                        </Button>
                    }
                />

                <div className="flex-1 overflow-y-auto px-4 lg:px-12 pt-6 pb-24">
                    {loading || !tbm ? (
                        <div className="text-sm text-gray-500">로딩 중...</div>
                    ) : (
                        <div className="max-w-[900px] mx-auto">
                            <div className="border border-gray-300 rounded-lg overflow-hidden bg-white">
                                <div className="text-center font-semibold py-3 border-b border-gray-300">
                                    TBM 회의록
                                </div>

                                <table className="w-full text-sm border-collapse table-fixed">
                                    <tbody>
                                        <tr className="border-b border-gray-300">
                                            <th className="w-[140px] bg-gray-50 text-left px-3 py-2 border-r border-gray-300">
                                                TBM 일시
                                            </th>
                                            <td className="px-3 py-2">
                                                {tbm.tbm_date
                                                    ? String(tbm.tbm_date).replaceAll("-", ".") + "."
                                                    : "-"}
                                            </td>
                                        </tr>

                                        <tr className="border-b border-gray-300">
                                            <th className="bg-gray-50 text-left px-3 py-2 border-r border-gray-300">
                                                {"\uD638\uC120\uBA85"}
                                            </th>
                                            <td className="px-3 py-2">
                                                {tbm.line_name || "-"}
                                            </td>
                                        </tr>

                                        <tr className="border-b border-gray-300">
                                            <th className="bg-gray-50 text-left px-3 py-2 border-r border-gray-300">
                                                작업명
                                            </th>
                                            <td className="px-3 py-2">
                                                {tbm.work_name || "-"}
                                            </td>
                                        </tr>
                                        <tr className="border-b border-gray-300">
                                            <th className="bg-gray-50 text-left px-3 py-2 border-r border-gray-300">
                                                작업내용
                                            </th>
                                            <td className="px-3 py-2 whitespace-pre-line">
                                                {tbm.work_content || "-"}
                                            </td>
                                        </tr>
                                        <tr className="border-b border-gray-300">
                                            <th className="bg-gray-50 text-left px-3 py-2 border-r border-gray-300">
                                                TBM 장소
                                            </th>
                                            <td className="px-3 py-2">
                                                {tbm.location || "-"}
                                            </td>
                                        </tr>
                                        <tr className="border-b border-gray-300">
                                            <th className="bg-gray-50 text-left px-3 py-2 border-r border-gray-300">
                                                위험성평가 실시여부
                                            </th>
                                            <td className="px-3 py-2">
                                                {tbm.risk_assessment === null
                                                    ? "-"
                                                    : tbm.risk_assessment
                                                        ? "예"
                                                        : "아니오"}
                                            </td>
                                        </tr>
                                        <tr className="border-b border-gray-300">
                                            <td className="p-0" colSpan={2}>
                                                <table className="w-full text-sm border-collapse">
                                                    <thead>
                                                        <tr className="bg-gray-50 border-b border-gray-300">
                                                            <th className="w-[140px] text-left px-3 py-2 border-r border-gray-300 text-sm font-semibold text-gray-900">
                                                                {"\uACF5\uC815"}
                                                            </th>
                                                            <th className="text-left px-3 py-2 border-r border-gray-300 text-sm font-semibold text-gray-900">
                                                                {"\uC7A0\uC7AC\uC801 \uC704\uD5D8\uC694\uC778"}
                                                            </th>
                                                            <th className="text-left px-3 py-2 text-sm font-semibold text-gray-900">
                                                                {"\uB300\uCC45"}
                                                            </th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {detailRows.length === 0 ? (
                                                            <tr>
                                                                <td
                                                                    className="px-3 py-2 text-gray-500"
                                                                    colSpan={3}
                                                                >
                                                                    -
                                                                </td>
                                                            </tr>
                                                        ) : (
                                                            detailRows.map((row) => (
                                                                <tr
                                                                    key={row.key}
                                                                    className="border-b border-gray-200"
                                                                >
                                                                    <td className="px-3 py-2 border-r border-gray-300 align-top">
                                                                        {renderBadge(row.process, row.badgeClass)}
                                                                    </td>
                                                                    <td className="px-3 py-2 border-r border-gray-300 align-top">
                                                                        {renderBadge(row.hazard, row.badgeClass)}
                                                                    </td>
                                                                    <td className="px-3 py-2 align-top">
                                                                        {renderBadge(row.measure, row.badgeClass)}
                                                                    </td>
                                                                </tr>
                                                            ))
                                                        )}
                                                    </tbody>
                                                </table>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>

                                <div className="border-t border-gray-300">
                                    <div className="text-center font-semibold py-2 border-b border-gray-300">
                                        작업 중 위험요인 안전점검 및 실시 결과
                                    </div>
                                    <div className="p-3 whitespace-pre-line">
                                        {tbm.during_result || "-"}
                                    </div>
                                </div>

                                <div className="border-t border-gray-300">
                                    <div className="text-center font-semibold py-2 border-b border-gray-300">
                                        작업 종료 후 미팅
                                    </div>
                                    <div className="p-3 whitespace-pre-line">
                                        {tbm.after_meeting || "-"}
                                    </div>
                                </div>

                                <div className="border-t border-gray-300">
                                    <div className="text-center font-semibold py-2 border-b border-gray-300">
                                        참석자 확인
                                    </div>
                                    <table className="w-full text-sm border-collapse">
                                        <thead>
                                            <tr className="border-b border-gray-300 bg-gray-50">
                                                <th className="py-2 border-r border-gray-300">이름</th>
                                                <th className="py-2 border-r border-gray-300">서명</th>
                                                <th className="py-2 border-r border-gray-300">이름</th>
                                                <th className="py-2">서명</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {groupedParticipants.map(([left, right], idx) => (
                                                <tr key={idx} className="border-b border-gray-300">
                                                    <td className="px-3 py-2 border-r border-gray-300">
                                                        {left?.name || "-"}
                                                    </td>
                                                    <td className="px-3 py-2 border-r border-gray-300 text-center">
                                                        <input
                                                            type="checkbox"
                                                            checked={!!left?.signed_at}
                                                            disabled={
                                                                !left ||
                                                                left.user_id !== currentUserId ||
                                                                !!left.signed_at
                                                            }
                                                            onChange={() => left && handleSign(left)}
                                                        />
                                                    </td>
                                                    <td className="px-3 py-2 border-r border-gray-300">
                                                        {right?.name || "-"}
                                                    </td>
                                                    <td className="px-3 py-2 text-center">
                                                        <input
                                                            type="checkbox"
                                                            checked={!!right?.signed_at}
                                                            disabled={
                                                                !right ||
                                                                right.user_id !== currentUserId ||
                                                                !!right.signed_at
                                                            }
                                                            onChange={() => right && handleSign(right)}
                                                        />
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
