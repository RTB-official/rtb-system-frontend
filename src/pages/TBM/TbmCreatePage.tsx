// src/pages/TBM/TbmCreatePage.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/common/Header";
import Button from "../../components/common/Button";
import { IconArrowBack } from "../../components/icons/Icons";
import DatePicker from "../../components/ui/DatePicker";
import Select from "../../components/common/Select";
import { useToast } from "../../components/ui/ToastProvider";
import { supabase } from "../../lib/supabase";
import { createTbm, getTbmDetail, updateTbm } from "../../lib/tbmApi";
import Chip from "../../components/ui/Chip";

export default function TbmCreatePage() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { showError, showSuccess } = useToast();
    const [isSaving, setIsSaving] = useState(false);
    const [tbmDate, setTbmDate] = useState("");
    const [lineName, setLineName] = useState("");
    const [workName, setWorkName] = useState("");
    const [workContent, setWorkContent] = useState("");
    const [location, setLocation] = useState("");
    const [riskAssessment, setRiskAssessment] = useState<boolean | null>(null);
    const [processId, setProcessId] = useState("");
    const [hazardId, setHazardId] = useState("");
    const [measureId, setMeasureId] = useState("");
    const [processOptions, setProcessOptions] = useState<
        Array<{ id: string; code: string; name: string; label: string; colorClass: string }>
    >([]);
    const [hazardOptions, setHazardOptions] = useState<
        Array<{
            id: string;
            code: string;
            name: string;
            label: string;
            processId: string;
            colorClass: string;
        }>
    >([]);
    const [measureOptions, setMeasureOptions] = useState<
        Array<{
            id: string;
            code: string;
            name: string;
            label: string;
            hazardId: string;
            colorClass: string;
        }>
    >([]);
    const [selectedCombos, setSelectedCombos] = useState<
        Array<{
            processId: string;
            processLabel: string;
            hazardId: string;
            hazardLabel: string;
            measureId: string;
            measureLabel: string;
            colorClass: string;
        }>
    >([]);
    const [duringResult, setDuringResult] = useState("");
    const [afterMeeting, setAfterMeeting] = useState("");

    const editId = searchParams.get("edit");
    const isEdit = !!editId;

    const [allMembers, setAllMembers] = useState<
        Array<{ id: string; name: string; username: string }>
    >([]);
    const [showResults, setShowResults] = useState(false);
    const [activeRow, setActiveRow] = useState<number | null>(null);
    const [participants, setParticipants] = useState<
        Array<{ name: string; userId: string | null }>
    >(() => Array.from({ length: 12 }, () => ({ name: "", userId: null })));

    useEffect(() => {
        const fetchMembers = async () => {
            try {
                const { data, error } = await supabase
                    .from("profiles")
                    .select("id, name, username")
                    .order("name", { ascending: true });

                if (error) {
                    console.error("members fetch error:", error);
                    return;
                }

                if (data) {
                    setAllMembers(
                        data.map((p) => ({
                            id: p.id,
                            name: p.name || "",
                            username: p.username || "",
                        }))
                    );
                }
            } catch (e) {
                console.error("members fetch error:", e);
            }
        };

        fetchMembers();
    }, []);

    const processColorMap: Record<string, string> = {
        P1: "orange-500",
        P2: "green-500",
        P3: "blue-500",
        P4: "red-600",
    };

    const processColorByName: Record<string, string> = {
        "\uBD84\uD574\uC870\uB9BD(\uAE30\uBCF8)": "orange-500",
        "\uC720\uC555": "green-500",
        "\uCC54\uBC84": "blue-500",
        "\uC808\uB2E8/\uD654\uAE30": "red-600",
    };

    const getProcessColor = (value: string) =>
        processColorMap[value] || processColorByName[value] || "bg-gray-100 text-gray-700";
    useEffect(() => {
        const fetchProcesses = async () => {
            const { data, error } = await supabase
                .from("tbm_processes")
                .select("id, code, name")
                .eq("is_active", true)
                .order("sort_order", { ascending: true })
                .order("code", { ascending: true });

            if (error) {
                showError("TBM ?? ??? ???? ?????.");
                return;
            }

            setProcessOptions(
                (data || []).map((row) => ({
                    id: row.id,
                    code: row.code,
                    name: row.name,
                    label: row.name,
                    colorClass: getProcessColor(row.code),
                }))
            );
        };

        fetchProcesses();
    }, [showError]);

    useEffect(() => {
        const loadEdit = async () => {
            if (!editId) return;
            try {
                const data = await getTbmDetail(editId);
                const record = data.tbm;
                setTbmDate(record.tbm_date || "");
                setLineName(record.line_name || "");
                setWorkName(record.work_name || "");
                setWorkContent(record.work_content || "");
                setLocation(record.location || "");
                setRiskAssessment(record.risk_assessment ?? null);
                setDuringResult(record.during_result || "");
                setAfterMeeting(record.after_meeting || "");

                const baseParticipants = Array.from({ length: 12 }, () => ({
                    name: "",
                    userId: null as string | null,
                }));
                data.participants.forEach((p, i) => {
                    if (i >= baseParticipants.length) return;
                    baseParticipants[i] = {
                        name: p.name || "",
                        userId: p.user_id,
                    };
                });
                setParticipants(baseParticipants);

                const normalizeList = (items: string[] | null, fallback: string | null) => {
                    if (items && items.length > 0) return items;
                    if (fallback) {
                        return fallback
                            .split(",")
                            .map((v) => v.trim())
                            .filter(Boolean);
                    }
                    return [] as string[];
                };

                const processList = normalizeList(record.process_items, record.process);
                const hazardList = normalizeList(record.hazard_items, record.hazard);
                const measureList = normalizeList(record.measure_items, record.measure);
                const rowCount = Math.max(processList.length, hazardList.length, measureList.length);

                const existingCombos = Array.from({ length: rowCount }, (_, idx) => {
                    const processLabel = processList[idx] || "";
                    const hazardLabel = hazardList[idx] || "";
                    const measureLabel = measureList[idx] || "";
                    return {
                        processId: `existing-process-${idx}`,
                        processLabel,
                        hazardId: `existing-hazard-${idx}`,
                        hazardLabel,
                        measureId: `existing-measure-${idx}`,
                        measureLabel,
                        colorClass: getProcessColor(processLabel),
                    };
                }).filter((c) => c.processLabel || c.hazardLabel || c.measureLabel);

                setSelectedCombos(existingCombos);
            } catch (e: any) {
                showError(e?.message || "TBM 조회 실패");
            }
        };

        loadEdit();
    }, [editId, showError]);
    useEffect(() => {
        const fetchHazards = async () => {
            if (!processId) {
                setHazardOptions([]);
                setHazardId("");
                setMeasureOptions([]);
                setMeasureId("");
                return;
            }

            const { data, error } = await supabase
                .from("tbm_hazards")
                .select("id, code, name, process_id")
                .eq("process_id", processId)
                .eq("is_active", true)
                .order("sort_order", { ascending: true })
                .order("code", { ascending: true });

            if (error) {
                showError("TBM ???? ??? ???? ?????.");
                return;
            }

            const processColorById = new Map(
                processOptions.map((p) => [p.id, p.colorClass])
            );

            setHazardOptions(
                (data || []).map((row) => ({
                    id: row.id,
                    code: row.code,
                    name: row.name,
                    label: row.name || row.code,
                    processId: row.process_id,
                    colorClass: processColorById.get(row.process_id) || "bg-gray-100 text-gray-700",
                }))
            );
            setHazardId("");
            setMeasureOptions([]);
            setMeasureId("");
        };

        fetchHazards();
    }, [processId, processOptions, showError]);
    useEffect(() => {
        const fetchMeasures = async () => {
            if (!hazardId) {
                setMeasureOptions([]);
                setMeasureId("");
                return;
            }

            const { data, error } = await supabase
                .from("tbm_measures")
                .select("id, code, name, hazard_id")
                .eq("hazard_id", hazardId)
                .eq("is_active", true)
                .order("sort_order", { ascending: true })
                .order("code", { ascending: true });

            if (error) {
                showError("TBM ?? ??? ???? ?????.");
                return;
            }

            const hazardColorById = new Map(
                hazardOptions.map((h) => [h.id, h.colorClass])
            );

            setMeasureOptions(
                (data || []).map((row) => ({
                    id: row.id,
                    code: row.code,
                    name: row.name,
                    label: row.name || row.code,
                    hazardId: row.hazard_id,
                    colorClass: hazardColorById.get(row.hazard_id) || "bg-gray-100 text-gray-700",
                }))
            );
            setMeasureId("");
        };

        fetchMeasures();
    }, [hazardId, hazardOptions, showError]);

    const activeInput = activeRow === null ? "" : participants[activeRow]?.name || "";
    const filteredMembers = useMemo(() => {
        if (!activeInput.trim()) return [];
        const selectedIds = new Set(
            participants.map((p) => p.userId).filter(Boolean) as string[]
        );
        const selectedNames = new Set(
            participants.map((p) => p.name).filter(Boolean)
        );
        return allMembers.filter(
            (m) =>
                (m.name.includes(activeInput) ||
                    m.username.includes(activeInput)) &&
                !selectedIds.has(m.id) &&
                !selectedNames.has(m.name)
        );
    }, [activeInput, allMembers, participants]);

    const handleSelectMember = (rowIndex: number, member: { id: string; name: string }) => {
        setParticipants((prev) =>
            prev.map((row, idx) =>
                idx === rowIndex
                    ? { name: member.name, userId: member.id }
                    : row
            )
        );
        setShowResults(false);
        setActiveRow(null);
    };

    const handleParticipantChange = (rowIndex: number, value: string) => {
        setParticipants((prev) =>
            prev.map((row, idx) =>
                idx === rowIndex ? { name: value, userId: null } : row
            )
        );
    };

    const handleAddProcess = (value: string) => {
        setProcessId(value);
        setHazardId("");
        setMeasureId("");
    };

    const handleAddHazard = (value: string) => {
        setHazardId(value);
        setMeasureId("");
    };

    const handleAddMeasure = (value: string) => {
        setMeasureId(value);
        if (!value || !processId || !hazardId) return;

        const process = processOptions.find((p) => p.id === processId);
        const hazard = hazardOptions.find((h) => h.id === hazardId);
        const measure = measureOptions.find((m) => m.id === value);
        if (!process || !hazard || !measure) return;

        setSelectedCombos((prev) =>
            prev.some(
                (c) =>
                    c.processId === process.id &&
                    c.hazardId === hazard.id &&
                    c.measureId === measure.id
            )
                ? prev
                : [
                    ...prev,
                    {
                        processId: process.id,
                        processLabel: process.label,
                        hazardId: hazard.id,
                        hazardLabel: hazard.label,
                        measureId: measure.id,
                        measureLabel: measure.label,
                        colorClass: process.colorClass,
                    },
                ]
        );
        setHazardId("");
        setMeasureId("");
    };

    const handleRemoveCombo = (processIdValue: string, hazardIdValue: string, measureIdValue: string) => {
        setSelectedCombos((prev) =>
            prev.filter(
                (c) =>
                    !(
                        c.processId === processIdValue &&
                        c.hazardId === hazardIdValue &&
                        c.measureId === measureIdValue
                    )
            )
        );
    };

    const handleSave = async () => {
        if (!tbmDate) {
            showError("TBM 일시를 선택해 주세요.");
            return;
        }
        if (!workName.trim()) {
            showError("작업명을 입력해 주세요.");
            return;
        }
        const selectedParticipants = participants.filter((p) => (p.name || "").trim().length > 0);

        setIsSaving(true);
        try {
            const tbm = await (isEdit && editId ? updateTbm({
                id: editId,
                tbm_date: tbmDate,
                line_name: lineName.trim(),
                work_name: workName.trim(),
                work_content: workContent.trim(),
                location: location.trim(),
                risk_assessment: riskAssessment,
                process: Array.from(
                    new Set(selectedCombos.map((c) => c.processLabel))
                ).join(", "),
                hazard: Array.from(
                    new Set(selectedCombos.map((c) => c.hazardLabel))
                ).join(", "),
                measure: Array.from(
                    new Set(selectedCombos.map((c) => c.measureLabel))
                ).join(", "),
                process_items: Array.from(
                    new Set(selectedCombos.map((c) => c.processLabel))
                ),
                hazard_items: Array.from(
                    new Set(selectedCombos.map((c) => c.hazardLabel))
                ),
                measure_items: Array.from(
                    new Set(selectedCombos.map((c) => c.measureLabel))
                ),
                during_result: duringResult.trim(),
                after_meeting: afterMeeting.trim(),
                participants: selectedParticipants.map((p) => ({
                    user_id: p.userId || null,
                    name: p.name,
                })),
            }) : createTbm({
                tbm_date: tbmDate,
                line_name: lineName.trim(),
                work_name: workName.trim(),
                work_content: workContent.trim(),
                location: location.trim(),
                risk_assessment: riskAssessment,
                process: Array.from(
                    new Set(selectedCombos.map((c) => c.processLabel))
                ).join(", "),
                hazard: Array.from(
                    new Set(selectedCombos.map((c) => c.hazardLabel))
                ).join(", "),
                measure: Array.from(
                    new Set(selectedCombos.map((c) => c.measureLabel))
                ).join(", "),
                process_items: Array.from(
                    new Set(selectedCombos.map((c) => c.processLabel))
                ),
                hazard_items: Array.from(
                    new Set(selectedCombos.map((c) => c.hazardLabel))
                ),
                measure_items: Array.from(
                    new Set(selectedCombos.map((c) => c.measureLabel))
                ),
                during_result: duringResult.trim(),
                after_meeting: afterMeeting.trim(),
                participants: selectedParticipants.map((p) => ({
                    user_id: p.userId || null,
                    name: p.name,
                })),
            }));
            showSuccess(isEdit ? "TBM 수정이 완료되었습니다." : "TBM이 저장되었습니다.");
            navigate(`/tbm/${tbm.id}`);
        } catch (e: any) {
            showError(e?.message || "TBM 저장에 실패했습니다.");
        } finally {
            setIsSaving(false);
        }
    };

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
                    title="TBM 작성"
                    onMenuClick={() => setSidebarOpen(true)}
                    leftContent={
                        <button
                            onClick={() => navigate("/tbm")}
                            className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
                            title="목록으로 돌아가기"
                        >
                            <IconArrowBack />
                        </button>
                    }
                    rightContent={
                        <div className="flex gap-2">
                            <Button variant="primary" size="lg" onClick={handleSave} disabled={isSaving}>
                                {isEdit ? "수정" : "저장"}
                            </Button>
                        </div>
                    }
                />

                <div className="flex-1 overflow-y-auto px-4 md:px-6 lg:px-12 pt-4 md:pt-6 pb-24">
                    <div className="max-w-[900px] mx-auto">
                        <div className="border border-gray-300 rounded-lg overflow-hidden bg-white">
                            <div className="text-center font-semibold py-3 px-2 md:px-3 border-b border-gray-300 text-sm md:text-base">
                                TBM 회의록
                            </div>

                            <table className="w-full text-sm border-collapse">
                                <tbody>
                                    <tr className="border-b border-gray-300">
                                        <th className="w-[120px] min-w-[100px] bg-gray-50 text-left px-2 py-2 md:px-3 md:py-2 border-r border-gray-300 whitespace-nowrap">
                                            TBM 일시
                                        </th>
                                        <td className="px-2 py-2 md:px-3 md:py-2">
                                            <DatePicker
                                                value={tbmDate}
                                                onChange={setTbmDate}
                                                placeholder="날짜 선택"
                                                className="w-full"
                                            />
                                        </td>
                                    </tr>

                                    <tr className="border-b border-gray-300">
                                        <th className="bg-gray-50 text-left px-2 py-2 md:px-3 md:py-2 border-r border-gray-300 whitespace-nowrap">
                                            {"\uD638\uC120\uBA85"}
                                        </th>
                                        <td className="px-2 py-2 md:px-3 md:py-2">
                                            <input
                                                type="text"
                                                className="w-full bg-transparent outline-none"
                                                placeholder={"\uD638\uC120\uBA85\uC744 \uC785\uB825\uD558\uC138\uC694"}
                                                value={lineName}
                                                onChange={(e) => setLineName(e.target.value)}
                                            />
                                        </td>
                                    </tr>

                                    <tr className="border-b border-gray-300">
                                        <th className="bg-gray-50 text-left px-2 py-2 md:px-3 md:py-2 border-r border-gray-300 whitespace-nowrap">
                                            작업명
                                        </th>
                                        <td className="px-2 py-2 md:px-3 md:py-2">
                                            <input
                                                type="text"
                                                className="w-full bg-transparent outline-none"
                                                placeholder="작업명을 입력하세요"
                                                value={workName}
                                                onChange={(e) => setWorkName(e.target.value)}
                                            />
                                        </td>
                                    </tr>

                                    <tr className="border-b border-gray-300">
                                        <th className="bg-gray-50 text-left px-2 py-2 md:px-3 md:py-2 border-r border-gray-300 whitespace-nowrap">
                                            작업내용
                                        </th>
                                        <td className="px-2 py-2 md:px-3 md:py-2">
                                            <textarea
                                                rows={3}
                                                className="w-full bg-transparent outline-none resize-none"
                                                placeholder="작업내용을 입력하세요"
                                                value={workContent}
                                                onChange={(e) => setWorkContent(e.target.value)}
                                            />
                                        </td>
                                    </tr>

                                    <tr className="border-b border-gray-300">
                                        <th className="bg-gray-50 text-left px-2 py-2 md:px-3 md:py-2 border-r border-gray-300 whitespace-nowrap">
                                            TBM 장소
                                        </th>
                                        <td className="px-2 py-2 md:px-3 md:py-2">
                                            <input
                                                type="text"
                                                className="w-full bg-transparent outline-none"
                                                placeholder="장소를 입력하세요"
                                                value={location}
                                                onChange={(e) => setLocation(e.target.value)}
                                            />
                                        </td>
                                    </tr>

                                    <tr className="border-b border-gray-300">
                                        <th className="bg-gray-50 text-left px-2 py-2 md:px-3 md:py-2 border-r border-gray-300 whitespace-nowrap">
                                            위험성평가 실시여부
                                        </th>
                                        <td className="px-2 py-2 md:px-3 md:py-2">
                                            <div className="flex gap-3 md:gap-6 items-center flex-wrap">
                                                <label className="flex items-center gap-2">
                                                    <input
                                                        type="radio"
                                                        name="riskAssessment"
                                                        checked={riskAssessment === true}
                                                        onChange={() => setRiskAssessment(true)}
                                                    />
                                                    예
                                                </label>
                                                <label className="flex items-center gap-2">
                                                    <input
                                                        type="radio"
                                                        name="riskAssessment"
                                                        checked={riskAssessment === false}
                                                        onChange={() => setRiskAssessment(false)}
                                                    />
                                                    아니오
                                                </label>
                                            </div>
                                        </td>
                                    </tr>

                                    <tr className="border-b border-gray-300">
                                        <th className="bg-gray-50 text-left px-2 py-2 md:px-3 md:py-2 border-r border-gray-300 whitespace-nowrap">
                                            공정
                                        </th>
                                        <td className="px-2 py-2 md:px-3 md:py-2">
                                            <div className="flex flex-col gap-2">
                                                <Select
                                                    options={processOptions.map((p) => ({
                                                        value: p.id,
                                                        label: p.label,
                                                    }))}
                                                    value={processId}
                                                    onChange={handleAddProcess}
                                                    fullWidth
                                                    placeholder="공정을 선택하세요"
                                                />
                                            </div>
                                        </td>
                                    </tr>

                                    <tr className="border-b border-gray-300">
                                        <th className="bg-gray-50 text-left px-2 py-2 md:px-3 md:py-2 border-r border-gray-300 whitespace-nowrap">
                                            잠재적 위험요인
                                        </th>
                                        <td className="px-2 py-2 md:px-3 md:py-2">
                                            <div className="flex flex-col gap-2">
                                                <Select
                                                    options={hazardOptions.map((h) => ({
                                                        value: h.id,
                                                        label: h.label,
                                                    }))}
                                                    value={hazardId}
                                                    onChange={handleAddHazard}
                                                    fullWidth
                                                    placeholder="잠재적 위험요인을 선택하세요"
                                                    disabled={!processId}
                                                />
                                            </div>
                                        </td>
                                    </tr>

                                    <tr className="">
                                        <th className="bg-gray-50 text-left px-2 py-2 md:px-3 md:py-2 border-r border-gray-300 whitespace-nowrap">
                                            대책
                                        </th>
                                        <td className="px-2 py-2 md:px-3 md:py-2">
                                            <div className="flex flex-col gap-2">
                                                <Select
                                                    options={measureOptions.map((m) => ({
                                                        value: m.id,
                                                        label: m.label,
                                                    }))}
                                                    value={measureId}
                                                    onChange={handleAddMeasure}
                                                    fullWidth
                                                    placeholder="대책을 선택하세요"
                                                    disabled={!hazardId}
                                                />
                                                {selectedCombos.length > 0 && (
                                                    <div className="flex flex-wrap gap-2">
                                                        {selectedCombos.map((c) => (
                                                            <Chip
                                                                key={`${c.processId}-${c.hazardId}-${c.measureId}`}
                                                                color={c.colorClass}
                                                                variant="filled"
                                                                size="md"
                                                                onRemove={() =>
                                                                    handleRemoveCombo(
                                                                        c.processId,
                                                                        c.hazardId,
                                                                        c.measureId
                                                                    )
                                                                }
                                                            >
                                                                {`${c.processLabel} > ${c.hazardLabel} > ${c.measureLabel}`}
                                                            </Chip>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>

                            <div className="border-t border-gray-300">
                                <div className="text-center font-semibold py-2 border-b border-gray-300">
                                    작업 중 위험요인 안전점검 및 실시 결과
                                </div>
                                <div className="p-3">
                                    <textarea
                                        rows={5}
                                        className="w-full bg-transparent outline-none resize-none"
                                        placeholder="점검 및 실시 결과를 입력하세요"
                                        value={duringResult}
                                        onChange={(e) => setDuringResult(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="border-t border-gray-300">
                                <div className="text-center font-semibold py-2 border-b border-gray-300">
                                    작업 종료 후 미팅
                                </div>
                                <div className="p-3">
                                    <textarea
                                        rows={4}
                                        className="w-full bg-transparent outline-none resize-none"
                                        placeholder="작업 종료 후 미팅 내용을 입력하세요"
                                        value={afterMeeting}
                                        onChange={(e) => setAfterMeeting(e.target.value)}
                                    />
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
                                        {Array.from({ length: 6 }).map((_, rowIndex) => {
                                            const leftIndex = rowIndex * 2;
                                            const rightIndex = rowIndex * 2 + 1;
                                            const leftRow = participants[leftIndex];
                                            const rightRow = participants[rightIndex];
                                            return (
                                                <tr key={rowIndex} className="border-b border-gray-300 last:border-b-0">
                                                    <td className="px-3 py-2 border-r border-gray-300 relative">
                                                        <input
                                                            type="text"
                                                            className="w-full bg-transparent outline-none"
                                                            placeholder="이름 입력"
                                                            value={leftRow?.name || ""}
                                                            onChange={(e) =>
                                                                handleParticipantChange(leftIndex, e.target.value)
                                                            }
                                                            onFocus={() => {
                                                                setActiveRow(leftIndex);
                                                                setShowResults(true);
                                                            }}
                                                            onKeyDown={(e) => {
                                                                if (e.key === "Enter" && filteredMembers.length > 0) {
                                                                    e.preventDefault();
                                                                    handleSelectMember(leftIndex, filteredMembers[0]);
                                                                }
                                                            }}
                                                        />
                                                        {showResults && activeRow === leftIndex && filteredMembers.length > 0 && (
                                                            <div className="absolute z-[60] top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                                                                {filteredMembers.map((member) => (
                                                                    <div
                                                                        key={member.id}
                                                                        className="px-4 py-2 hover:bg-gray-50 cursor-pointer text-sm text-gray-700"
                                                                        onClick={() => handleSelectMember(leftIndex, member)}
                                                                    >
                                                                        {member.name}
                                                                        {member.username && (
                                                                            <span className="text-gray-400 ml-2">
                                                                                ({member.username})
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-2 border-r border-gray-300 text-center">
                                                        <input type="checkbox" disabled />
                                                    </td>
                                                    <td className="px-3 py-2 border-r border-gray-300 relative">
                                                        <input
                                                            type="text"
                                                            className="w-full bg-transparent outline-none"
                                                            placeholder="이름 입력"
                                                            value={rightRow?.name || ""}
                                                            onChange={(e) =>
                                                                handleParticipantChange(rightIndex, e.target.value)
                                                            }
                                                            onFocus={() => {
                                                                setActiveRow(rightIndex);
                                                                setShowResults(true);
                                                            }}
                                                            onKeyDown={(e) => {
                                                                if (e.key === "Enter" && filteredMembers.length > 0) {
                                                                    e.preventDefault();
                                                                    handleSelectMember(rightIndex, filteredMembers[0]);
                                                                }
                                                            }}
                                                        />
                                                        {showResults && activeRow === rightIndex && filteredMembers.length > 0 && (
                                                            <div className="absolute z-[60] top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                                                                {filteredMembers.map((member) => (
                                                                    <div
                                                                        key={member.id}
                                                                        className="px-4 py-2 hover:bg-gray-50 cursor-pointer text-sm text-gray-700"
                                                                        onClick={() => handleSelectMember(rightIndex, member)}
                                                                    >
                                                                        {member.name}
                                                                        {member.username && (
                                                                            <span className="text-gray-400 ml-2">
                                                                                ({member.username})
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-2 text-center">
                                                        <input type="checkbox" disabled />
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
