// src/pages/TBM/TbmCreatePage.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/common/Header";
import Button from "../../components/common/Button";
import { IconArrowBack, IconClose } from "../../components/icons/Icons";
import DatePicker from "../../components/ui/DatePicker";
import Select from "../../components/common/Select";
import { useToast } from "../../components/ui/ToastProvider";
import { supabase } from "../../lib/supabase";
import { createTbm, getTbmDetail, getTbmListForImport, type TbmRecord, updateTbm } from "../../lib/tbmApi";
import Chip from "../../components/ui/Chip";
import { PURPOSE_AUTOCOMPLETE_OPTIONS } from "../../constants/purposeAutocompleteOptions";
import { useWorkReportStore, type StaffProfile } from "../../store/workReportStore";
import { useAuth } from "../../store/auth";

const LOCATION_QUICK_INSERTS = ["EMD #", "ECR", "E/R"] as const;

/** WorkerSection과 동일 — 직급 정렬 */
const STAFF_ROLE_ORDER: Record<string, number> = {
    대표: 1,
    감사: 2,
    부장: 3,
    차장: 4,
    과장: 5,
    대리: 6,
    주임: 7,
    사원: 8,
    인턴: 9,
};

export default function TbmCreatePage() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { showError, showSuccess } = useToast();
    const allStaff = useWorkReportStore((s) => s.allStaff);
    const staffLoading = useWorkReportStore((s) => s.staffLoading);
    const fetchAllStaff = useWorkReportStore((s) => s.fetchAllStaff);
    const { user: authUser } = useAuth();
    const [isSaving, setIsSaving] = useState(false);
    const [tbmDate, setTbmDate] = useState("");
    const [lineName, setLineName] = useState("");
    const [workName, setWorkName] = useState("");
    const workNameInputRef = useRef<HTMLInputElement>(null);
    const [workContent, setWorkContent] = useState("");
    /** TBM 불러오기로 채운 작업내용일 때 테두리·지우기 버튼 표시 */
    const [workContentFromImport, setWorkContentFromImport] = useState(false);
    const [location, setLocation] = useState("");
    const [riskAssessment, setRiskAssessment] = useState<boolean | null>(null);
    const [processId, setProcessId] = useState("");
    const [hazardId, setHazardId] = useState("");
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

    const [tbmImportOptions, setTbmImportOptions] = useState<TbmRecord[]>([]);
    const [tbmImportLoading, setTbmImportLoading] = useState(false);
    const [selectedTbmImportId, setSelectedTbmImportId] = useState("");

    const editId = searchParams.get("edit");
    const isEdit = !!editId;

    const [participants, setParticipants] = useState<
        Array<{ name: string; userId: string | null }>
    >(() => Array.from({ length: 12 }, () => ({ name: "", userId: null })));
    const [adminTeamOpen, setAdminTeamOpen] = useState(false);

    useEffect(() => {
        fetchAllStaff();
    }, [fetchAllStaff]);

    /** 신규 작성 시 작성자 본인을 참석자에 자동 포함 */
    useEffect(() => {
        if (isEdit) return;
        let cancelled = false;
        (async () => {
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (!user || cancelled) return;
            const { data: profile } = await supabase
                .from("profiles")
                .select("name")
                .eq("id", user.id)
                .single();
            if (cancelled || !profile?.name?.trim()) return;
            const nm = profile.name.trim();
            setParticipants((prev) => {
                if (prev.some((p) => p.userId === user.id)) return prev;
                const idx = prev.findIndex((p) => !(p.name || "").trim());
                if (idx === -1) return prev;
                const next = [...prev];
                next[idx] = { name: nm, userId: user.id };
                return next;
            });
        })();
        return () => {
            cancelled = true;
        };
    }, [isEdit]);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setTbmImportLoading(true);
            try {
                const list = await getTbmListForImport(isEdit ? editId : null);
                if (!cancelled) setTbmImportOptions(list);
            } catch (e) {
                console.error("TBM 불러오기 목록:", e);
                if (!cancelled) setTbmImportOptions([]);
            } finally {
                if (!cancelled) setTbmImportLoading(false);
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, [isEdit, editId]);

    const tbmImportSelectOptions = useMemo(
        () =>
            tbmImportOptions.map((r) => {
                const date = (r.tbm_date || "").trim();
                const line = (r.line_name || "").trim();
                const work = (r.work_name || "").trim();
                const parts = [date, line, work].filter(Boolean);
                const label =
                    parts.length > 0 ? parts.join(" · ") : `TBM ${String(r.id).slice(0, 8)}…`;
                return { value: r.id, label };
            }),
        [tbmImportOptions]
    );

    const appendLocationQuickInsert = (token: string) => {
        setLocation((prev) => {
            const t = prev.trim();
            if (!t) return token;
            return `${t} ${token}`;
        });
    };

    const handleWorkNameAutocompleteClick = (purpose: string) => {
        if (workName && workName.trim().includes(" ")) {
            const parts = workName.trim().split(/\s+/);
            parts[parts.length - 1] = purpose;
            setWorkName(parts.join(" "));
        } else {
            setWorkName(purpose);
        }
        setTimeout(() => {
            workNameInputRef.current?.focus();
        }, 0);
    };

    const filteredWorkNameAutocompleteOptions = useMemo(() => {
        if (!workName || workName.trim() === "") {
            return [];
        }
        const parts = workName.trim().split(/\s+/);
        const searchText = parts[parts.length - 1].toLowerCase();
        if (searchText === "") {
            return [];
        }
        return PURPOSE_AUTOCOMPLETE_OPTIONS.filter((option) =>
            option.toLowerCase().startsWith(searchText)
        );
    }, [workName]);

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
                setLineName((record.line_name || "").toUpperCase());
                setWorkName(record.work_name || "");
                setWorkContent(record.work_content || "");
                setWorkContentFromImport(false);
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

                // 코드 접두사 제거 함수 (TbmDetailSheet와 동일하게)
                const stripCodePrefix = (value: string) =>
                    value.replace(/^[A-Z0-9]+(?:-[A-Z0-9]+)+\s+/, "");

                const normalizeList = (items: string[] | null, fallback: string | null) => {
                    if (items && items.length > 0) {
                        return items.map(stripCodePrefix);
                    }
                    if (fallback) {
                        return fallback
                            .split(",")
                            .map((v) => v.trim())
                            .filter(Boolean)
                            .map(stripCodePrefix);
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
        };

        fetchHazards();
    }, [processId, processOptions, showError]);
    useEffect(() => {
        const fetchMeasures = async () => {
            if (!hazardId) {
                setMeasureOptions([]);
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
        };

        fetchMeasures();
    }, [hazardId, hazardOptions, showError]);

    const { adminTeamMembers, sortedAdminTeamMembers, staffGroupsByRank } = useMemo(() => {
        const adminTeam = allStaff.filter((m) => m.department === "공무팀");
        const regular = allStaff.filter((m) => m.department !== "공무팀");
        const sortedAdmin = [...adminTeam].sort((a, b) => {
            const orderA = STAFF_ROLE_ORDER[a.position] ?? 999;
            const orderB = STAFF_ROLE_ORDER[b.position] ?? 999;
            if (orderA !== orderB) return orderA - orderB;
            return a.name.localeCompare(b.name);
        });
        const byRole = new Map<string, StaffProfile[]>();
        for (const member of regular) {
            const role = member.position || "";
            if (!role) continue;
            if (!byRole.has(role)) byRole.set(role, []);
            byRole.get(role)!.push(member);
        }
        const groups = Array.from(byRole.entries())
            .filter(([, members]) => members.length > 0)
            .sort(
                ([roleA], [roleB]) =>
                    (STAFF_ROLE_ORDER[roleA] ?? 999) - (STAFF_ROLE_ORDER[roleB] ?? 999)
            )
            .map(([rank, members]) => ({
                rank,
                members: [...members].sort((a, b) => a.name.localeCompare(b.name, "ko")),
            }));
        return {
            adminTeamMembers: adminTeam,
            sortedAdminTeamMembers: sortedAdmin,
            staffGroupsByRank: groups,
        };
    }, [allStaff]);

    const toggleStaffParticipant = (member: StaffProfile) => {
        const id = member.id;
        const name = (member.name || "").trim();
        if (!id || !name) return;

        setParticipants((prev) => {
            const idx = prev.findIndex((p) => p.userId === id);
            if (idx !== -1) {
                return prev.map((row, i) =>
                    i === idx ? { name: "", userId: null } : row
                );
            }
            const emptyIdx = prev.findIndex((p) => !(p.name || "").trim());
            if (emptyIdx === -1) {
                showError("참석자는 최대 12명까지 선택할 수 있습니다.");
                return prev;
            }
            const next = [...prev];
            next[emptyIdx] = { name, userId: id };
            return next;
        });
    };

    const isStaffParticipantSelected = (member: StaffProfile) =>
        participants.some((p) => p.userId === member.id);

    const isAuthorSignatureRow = (row: { name: string; userId: string | null } | undefined) =>
        !!(authUser?.id && row?.userId && row.userId === authUser.id);

    const handleAddProcess = (value: string) => {
        setProcessId(value);
        setHazardId("");
    };

    const handleAddHazard = (value: string) => {
        setHazardId(value);
    };

    const toggleMeasureForCurrentCombo = (measureIdValue: string) => {
        if (!processId || !hazardId || !measureIdValue) return;

        const process = processOptions.find((p) => p.id === processId);
        const hazard = hazardOptions.find((h) => h.id === hazardId);
        const measure = measureOptions.find((m) => m.id === measureIdValue);
        if (!process || !hazard || !measure) return;

        setSelectedCombos((prev) => {
            const exists = prev.some(
                (c) =>
                    c.processId === process.id &&
                    c.hazardId === hazard.id &&
                    c.measureId === measure.id
            );
            if (exists) {
                return prev.filter(
                    (c) =>
                        !(
                            c.processId === process.id &&
                            c.hazardId === hazard.id &&
                            c.measureId === measure.id
                        )
                );
            }
            return [
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
            ];
        });
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
                process: selectedCombos.map((c) => c.processLabel).join(", "),
                hazard: selectedCombos.map((c) => c.hazardLabel).join(", "),
                measure: selectedCombos.map((c) => c.measureLabel).join(", "),
                process_items: selectedCombos.map((c) => c.processLabel),
                hazard_items: selectedCombos.map((c) => c.hazardLabel),
                measure_items: selectedCombos.map((c) => c.measureLabel),
                combo_items: selectedCombos.map((c) => ({
                    process: c.processLabel,
                    hazard: c.hazardLabel,
                    measure: c.measureLabel,
                  })),                  
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
                process: selectedCombos.map((c) => c.processLabel).join(", "),
                hazard: selectedCombos.map((c) => c.hazardLabel).join(", "),
                measure: selectedCombos.map((c) => c.measureLabel).join(", "),
                process_items: selectedCombos.map((c) => c.processLabel),
                hazard_items: selectedCombos.map((c) => c.hazardLabel),
                measure_items: selectedCombos.map((c) => c.measureLabel),
                combo_items: selectedCombos.map((c) => ({
                    process: c.processLabel,
                    hazard: c.hazardLabel,
                    measure: c.measureLabel,
                  })),                  
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
                            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
                            title="목록으로 돌아가기"
                        >
                            <IconArrowBack className="w-5 h-5" />
                        </button>
                    }
                    rightContent={
                        <div className="flex gap-2">
                            <Button
                                variant="primary"
                                size="sm"
                                onClick={handleSave}
                                disabled={isSaving}
                            >
                                {isEdit ? "수정" : "제출하기"}
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

                            <table className="w-full text-sm border-collapse table-fixed">
                                <colgroup>
                                    <col className="w-[100px] md:w-[120px]" />
                                    <col />
                                </colgroup>
                                <tbody>
                                    <tr className="border-b border-gray-300">
                                        <th className="bg-gray-50 text-left px-2 py-2 md:px-3 md:py-2 border-r border-gray-300 whitespace-nowrap align-top">
                                            TBM 불러오기
                                        </th>
                                        <td className="px-2 py-2 md:px-3 md:py-2 min-w-0">
                                            <Select
                                                size="sm"
                                                placeholder={
                                                    tbmImportLoading
                                                        ? "로딩 중..."
                                                        : tbmImportSelectOptions.length === 0
                                                          ? "불러올 TBM 없음"
                                                          : "이전 TBM 선택"
                                                }
                                                fullWidth
                                                options={tbmImportSelectOptions}
                                                value={selectedTbmImportId}
                                                onChange={(value) => {
                                                    if (!value || tbmImportSelectOptions.length === 0) return;
                                                    setSelectedTbmImportId(value);
                                                    const rec = tbmImportOptions.find((x) => x.id === value);
                                                    if (rec) {
                                                        setLineName((rec.line_name || "").toUpperCase());
                                                        setWorkName(rec.work_name || "");
                                                        setWorkContent(rec.work_content || "");
                                                        setWorkContentFromImport(!!(rec.work_content || "").trim());
                                                    }
                                                    setTimeout(() => setSelectedTbmImportId(""), 800);
                                                }}
                                                disabled={
                                                    tbmImportLoading || tbmImportSelectOptions.length === 0
                                                }
                                            />
                                        </td>
                                    </tr>
                                    <tr className="border-b border-gray-300">
                                        <th className="bg-gray-50 text-left px-2 py-2 md:px-3 md:py-2 border-r border-gray-300 whitespace-nowrap">
                                            TBM 일시
                                        </th>
                                        <td className="px-2 py-2 md:px-3 md:py-2 min-w-0">
                                            <div className="flex items-stretch sm:items-center gap-2 min-w-0">
                                                <div className="flex-1 min-w-0">
                                                    <DatePicker
                                                        value={tbmDate}
                                                        onChange={setTbmDate}
                                                        placeholder="날짜 선택"
                                                        className="w-full"
                                                    />
                                                </div>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    className="shrink-0 self-center"
                                                    onClick={() => {
                                                        const today = new Date();
                                                        setTbmDate(
                                                            `${today.getFullYear()}-${String(
                                                                today.getMonth() + 1
                                                            ).padStart(2, "0")}-${String(
                                                                today.getDate()
                                                            ).padStart(2, "0")}`
                                                        );
                                                    }}
                                                >
                                                    오늘
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>

                                    <tr className="border-b border-gray-300">
                                        <th className="bg-gray-50 text-left px-2 py-2 md:px-3 md:py-2 border-r border-gray-300 whitespace-nowrap">
                                            {"\uD638\uC120\uBA85"}
                                        </th>
                                        <td className="px-2 py-2 md:px-3 md:py-2 min-w-0">
                                            <input
                                                type="text"
                                                className="w-full bg-transparent outline-none min-w-0"
                                                placeholder={"\uD638\uC120\uBA85\uC744 \uC785\uB825\uD558\uC138\uC694"}
                                                value={lineName}
                                                onChange={(e) =>
                                                    setLineName(e.target.value.toUpperCase())
                                                }
                                            />
                                        </td>
                                    </tr>

                                    <tr className="border-b border-gray-300">
                                        <th className="bg-gray-50 text-left px-2 py-2 md:px-3 md:py-2 border-r border-gray-300 whitespace-nowrap">
                                            작업명
                                        </th>
                                        <td className="px-2 py-2 md:px-3 md:py-2 min-w-0">
                                            <input
                                                ref={workNameInputRef}
                                                type="text"
                                                className="w-full bg-transparent outline-none"
                                                placeholder="작업명을 입력하세요"
                                                value={workName}
                                                onChange={(e) => setWorkName(e.target.value)}
                                                autoComplete="off"
                                            />
                                        </td>
                                    </tr>

                                    <tr className="border-b border-gray-300">
                                        <td
                                            colSpan={2}
                                            className="px-2 py-2 md:px-3 md:py-2 min-w-0 align-top"
                                        >
                                            <div className="min-h-[44px] flex flex-wrap gap-1.5 py-1.5">
                                                {filteredWorkNameAutocompleteOptions.map((purpose) => (
                                                    <button
                                                        key={purpose}
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            handleWorkNameAutocompleteClick(purpose);
                                                        }}
                                                        onMouseDown={(e) => {
                                                            e.preventDefault();
                                                        }}
                                                        className="px-2 py-1 rounded-md bg-sky-100 text-blue-700 font-medium text-xs hover:bg-sky-200 transition-colors"
                                                    >
                                                        {purpose}
                                                    </button>
                                                ))}
                                            </div>
                                        </td>
                                    </tr>

                                    <tr className="border-b border-gray-300">
                                        <th className="bg-gray-50 text-left px-2 py-2 md:px-3 md:py-2 border-r border-gray-300 whitespace-nowrap">
                                            작업내용
                                        </th>
                                        <td className="px-2 py-2 md:px-3 md:py-2 min-w-0">
                                            <div
                                                className={
                                                    workContentFromImport && workContent.trim()
                                                        ? "relative rounded-lg border border-blue-200 bg-sky-50 p-2 pr-8"
                                                        : ""
                                                }
                                            >
                                                {workContentFromImport && workContent.trim() ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setWorkContent("");
                                                            setWorkContentFromImport(false);
                                                        }}
                                                        className="absolute top-1 right-1 z-10 p-0.5 rounded-md text-blue-600 hover:bg-blue-100 hover:text-blue-800 transition-colors"
                                                        title="작업내용 전체 삭제"
                                                        aria-label="작업내용 전체 삭제"
                                                    >
                                                        <IconClose className="w-3.5 h-3.5" />
                                                    </button>
                                                ) : null}
                                                <textarea
                                                    rows={3}
                                                    className="w-full bg-transparent outline-none resize-none min-w-0"
                                                    placeholder="작업내용을 입력하세요"
                                                    value={workContent}
                                                    onChange={(e) => {
                                                        const v = e.target.value;
                                                        setWorkContent(v);
                                                        if (!v) setWorkContentFromImport(false);
                                                    }}
                                                />
                                            </div>
                                        </td>
                                    </tr>

                                    <tr className="border-b border-gray-300">
                                        <th className="bg-gray-50 text-left px-2 py-2 md:px-3 md:py-2 border-r border-gray-300 whitespace-nowrap">
                                            TBM 장소
                                        </th>
                                        <td className="px-2 py-2 md:px-3 md:py-2 min-w-0">
                                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 min-w-0">
                                                <input
                                                    type="text"
                                                    className="w-full flex-1 min-w-0 bg-transparent outline-none"
                                                    placeholder="장소를 입력하세요"
                                                    value={location}
                                                    onChange={(e) => setLocation(e.target.value)}
                                                />
                                                <div className="flex flex-wrap gap-1.5 shrink-0 justify-end sm:justify-start">
                                                    {LOCATION_QUICK_INSERTS.map((label) => (
                                                        <Button
                                                            key={label}
                                                            type="button"
                                                            variant="outline"
                                                            size="xs"
                                                            className="!h-[26px] px-2 text-[11px]"
                                                            onClick={() => appendLocationQuickInsert(label)}
                                                        >
                                                            {label}
                                                        </Button>
                                                    ))}
                                                </div>
                                            </div>
                                        </td>
                                    </tr>

                                    <tr className="border-b border-gray-300">
                                        <th className="bg-gray-50 text-left px-2 py-2 md:px-3 md:py-2 border-r border-gray-300 align-top leading-snug">
                                            위험성평가
                                            <br />
                                            실시 여부
                                        </th>
                                        <td className="px-2 py-2 md:px-3 md:py-2 min-w-0">
                                            <div className="flex gap-3 md:gap-6 items-center flex-wrap min-w-0">
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
                                        <td className="px-2 py-2 md:px-3 md:py-2 min-w-0">
                                            <div className="flex flex-col gap-2 min-w-0">
                                                <Select
                                                    size="sm"
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
                                        <td className="px-2 py-2 md:px-3 md:py-2 min-w-0">
                                            <div className="flex flex-col gap-2 min-w-0">
                                                <Select
                                                    size="sm"
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
                                        <td className="px-2 py-2 md:px-3 md:py-2 min-w-0">
                                            <div className="flex flex-col gap-2 min-w-0">
                                                {!hazardId ? (
                                                    <p className="text-xs text-gray-400 py-1">
                                                        잠재적 위험요인을 먼저 선택하세요
                                                    </p>
                                                ) : measureOptions.length === 0 ? (
                                                    <p className="text-xs text-gray-400 py-1">
                                                        선택한 위험요인에 등록된 대책이 없습니다
                                                    </p>
                                                ) : (
                                                    <div className="rounded-lg border border-gray-200 bg-gray-50/50 px-2 py-2">
                                                        <p className="text-[11px] text-gray-500 px-0.5 pb-2">
                                                            대책을 여러 개 선택할 수 있습니다
                                                        </p>
                                                        <div className="flex flex-col gap-y-1">
                                                            {measureOptions.map((m) => {
                                                                const checked = selectedCombos.some(
                                                                    (c) =>
                                                                        c.processId === processId &&
                                                                        c.hazardId === hazardId &&
                                                                        c.measureId === m.id
                                                                );
                                                                return (
                                                                    <label
                                                                        key={m.id}
                                                                        className="flex items-start gap-2 cursor-pointer rounded-md px-1.5 py-1 hover:bg-white/80 text-sm text-gray-900 min-w-0"
                                                                    >
                                                                        <input
                                                                            type="checkbox"
                                                                            className="mt-0.5 shrink-0"
                                                                            checked={checked}
                                                                            onChange={() =>
                                                                                toggleMeasureForCurrentCombo(m.id)
                                                                            }
                                                                        />
                                                                        <span className="leading-snug min-w-0 break-words">
                                                                            {m.label}
                                                                        </span>
                                                                    </label>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}
                                                {selectedCombos.length > 0 && (
                                                    <div className="flex flex-wrap gap-2 min-w-0">
                                                        {selectedCombos.map((c) => (
                                                            <Chip
                                                                key={`${c.processId}-${c.hazardId}-${c.measureId}`}
                                                                color={c.colorClass}
                                                                variant="filled"
                                                                size="sm"
                                                                onRemove={() =>
                                                                    handleRemoveCombo(
                                                                        c.processId,
                                                                        c.hazardId,
                                                                        c.measureId
                                                                    )
                                                                }
                                                                className="!whitespace-normal max-w-full min-w-0"
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
                                <div className="px-2 py-2 border-b border-gray-200 bg-gray-50/60">
                                    {staffLoading ? (
                                        <p className="text-[11px] text-gray-500 text-center py-1">
                                            구성원 정보를 불러오는 중...
                                        </p>
                                    ) : (
                                        <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 items-start">
                                            {staffGroupsByRank.map(({ rank, members }) => (
                                                <div
                                                    key={rank}
                                                    className="flex flex-wrap items-center gap-x-1.5 gap-y-1 min-w-0"
                                                >
                                                    <span className="text-[10px] font-semibold text-gray-600 shrink-0 w-9 leading-tight">
                                                        {rank}
                                                    </span>
                                                    <div className="flex flex-wrap gap-1 flex-1 min-w-0">
                                                        {members.map((m) => (
                                                            <Button
                                                                key={m.id}
                                                                type="button"
                                                                size="xs"
                                                                variant={
                                                                    isStaffParticipantSelected(m)
                                                                        ? "primary"
                                                                        : "outline"
                                                                }
                                                                className="!h-[24px] !px-1.5 !text-[11px] !rounded-md"
                                                                onClick={() => toggleStaffParticipant(m)}
                                                            >
                                                                {m.name}
                                                            </Button>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                            {adminTeamMembers.length > 0 && (
                                                <div className="pt-1 mt-1 border-t border-dashed border-gray-200">
                                                    <button
                                                        type="button"
                                                        onClick={() => setAdminTeamOpen((v) => !v)}
                                                        className="flex w-full items-center justify-between text-left text-[11px] font-semibold text-blue-800 py-0.5"
                                                    >
                                                        <span>공무팀</span>
                                                        <span className="font-normal text-blue-600">
                                                            {adminTeamOpen
                                                                ? "접기"
                                                                : `펼치기 (${adminTeamMembers.length})`}
                                                        </span>
                                                    </button>
                                                    {adminTeamOpen && (
                                                        <div className="flex flex-wrap gap-1 pt-1">
                                                            {sortedAdminTeamMembers.map((m) => (
                                                                <Button
                                                                    key={m.id}
                                                                    type="button"
                                                                    size="xs"
                                                                    variant={
                                                                        isStaffParticipantSelected(m)
                                                                            ? "primary"
                                                                            : "outline"
                                                                    }
                                                                    className="!h-[24px] !px-1.5 !text-[11px] !rounded-md"
                                                                    onClick={() => toggleStaffParticipant(m)}
                                                                >
                                                                    {m.name}
                                                                </Button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            <p className="text-xs font-medium text-gray-700 pt-0.5">
                                                참여인원 :{" "}
                                                {
                                                    participants.filter((p) => (p.name || "").trim().length > 0)
                                                        .length
                                                }
                                                명
                                            </p>
                                        </div>
                                    )}
                                </div>
                                <table className="w-full table-fixed text-sm border-collapse">
                                    <colgroup>
                                        <col style={{ width: "38%" }} />
                                        <col style={{ width: "12%" }} />
                                        <col style={{ width: "38%" }} />
                                        <col style={{ width: "12%" }} />
                                    </colgroup>
                                    <thead>
                                        <tr className="border-b border-gray-300 bg-gray-50">
                                            <th className="py-1.5 px-2 text-xs font-medium border-r border-gray-300 align-middle">
                                                이름
                                            </th>
                                            <th className="py-1.5 px-1 text-xs font-medium border-r border-gray-300 align-middle text-center">
                                                서명
                                            </th>
                                            <th className="py-1.5 px-2 text-xs font-medium border-r border-gray-300 align-middle">
                                                이름
                                            </th>
                                            <th className="py-1.5 px-1 text-xs font-medium align-middle text-center">
                                                서명
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {Array.from({ length: 6 }).map((_, rowIndex) => {
                                            const leftIndex = rowIndex * 2;
                                            const rightIndex = rowIndex * 2 + 1;
                                            const leftRow = participants[leftIndex];
                                            const rightRow = participants[rightIndex];
                                            return (
                                                <tr
                                                    key={rowIndex}
                                                    className="border-b border-gray-300 last:border-b-0"
                                                >
                                                    <td className="px-2 py-1.5 border-r border-gray-300 align-top min-w-0">
                                                        <span
                                                            className={`block text-xs leading-snug break-words ${
                                                                (leftRow?.name || "").trim()
                                                                    ? "text-gray-900"
                                                                    : "text-gray-300"
                                                            }`}
                                                        >
                                                            {(leftRow?.name || "").trim() || "—"}
                                                        </span>
                                                    </td>
                                                    <td className="px-1 py-1.5 border-r border-gray-300 text-center align-middle">
                                                        <input
                                                            type="checkbox"
                                                            disabled
                                                            checked={isAuthorSignatureRow(leftRow)}
                                                            className="align-middle"
                                                        />
                                                    </td>
                                                    <td className="px-2 py-1.5 border-r border-gray-300 align-top min-w-0">
                                                        <span
                                                            className={`block text-xs leading-snug break-words ${
                                                                (rightRow?.name || "").trim()
                                                                    ? "text-gray-900"
                                                                    : "text-gray-300"
                                                            }`}
                                                        >
                                                            {(rightRow?.name || "").trim() || "—"}
                                                        </span>
                                                    </td>
                                                    <td className="px-1 py-1.5 text-center align-middle">
                                                        <input
                                                            type="checkbox"
                                                            disabled
                                                            checked={isAuthorSignatureRow(rightRow)}
                                                            className="align-middle"
                                                        />
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
