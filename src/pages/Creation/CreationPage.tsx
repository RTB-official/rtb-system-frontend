// src/pages/Creation/CreationPage.tsx
import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/common/Header";
import Button from "../../components/common/Button";
import BasicInfoSection from "../../components/sections/BasicInfoSection";
import WorkerSection from "../../components/sections/WorkerSection";
import WorkLogSection from "../../components/sections/WorkLogSection";
import ExpenseSection from "../../components/sections/ExpenseSection";
import ConsumablesSection from "../../components/sections/ConsumablesSection";
import FileUploadSection from "../../components/sections/FileUploadSection";
import TimelineSummarySection from "../../components/sections/TimelineSummarySection";
import CreationSkeleton from "../../components/common/CreationSkeleton";
import { useWorkReportStore } from "../../store/workReportStore";
import { IconArrowBack, IconReport } from "../../components/icons/Icons";
import {
    createWorkLog,
    uploadReceiptFile,
    getDraftWorkLog,
    updateWorkLog,
    getWorkLogById,
    type WorkLog,
} from "../../lib/workLogApi";
import { useAuth } from "../../store/auth";
import { supabase } from "../../lib/supabase";
import { useToast } from "../../components/ui/ToastProvider";
import ConfirmDialog from "../../components/ui/ConfirmDialog";

type ReceiptCategoryEnum =
    | "숙박영수증"
    | "자재구매영수증"
    | "식비및유대영수증"
    | "기타";

function mapReceiptCategory(input: string): ReceiptCategoryEnum {
    const normalized = (input || "").replace(/\s+/g, "").trim();

    // FileUploadSection에서 들어올 수 있는 값들을 최대한 흡수
    if (normalized === "숙박" || normalized === "숙박영수증") return "숙박영수증";
    if (
        normalized === "자재" ||
        normalized === "자재구매" ||
        normalized === "자재구매영수증"
    )
        return "자재구매영수증";
    if (
        normalized === "식비및유대" ||
        normalized === "식비유대" ||
        normalized === "식비" ||
        normalized === "유대" ||
        normalized === "식비및유대영수증"
    )
        return "식비및유대영수증";

    return "기타";
}



export default function CreationPage() {
    const [searchParams] = useSearchParams();
    const workLogId = searchParams.get("id");
    const isEditMode = !!workLogId;
    const [loading, setLoading] = useState(isEditMode);

    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [savingDraft, setSavingDraft] = useState(false);
    const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [isSubmittedWorkLog, setIsSubmittedWorkLog] = useState(false);
    const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false);
    const [navigateConfirmOpen, setNavigateConfirmOpen] = useState(false);




    // ✅ 최초 작성자 유지용(업데이트 시 author NOT NULL 방지)
    const [originalAuthor, setOriginalAuthor] = useState<string | null>(null);
    const [originalCreatedBy, setOriginalCreatedBy] = useState<string | null>(null);

    const navigate = useNavigate();
    const { user } = useAuth();
    const { showSuccess, showError } = useToast();

    const {
        vessel,
        engine,
        subject,
        orderGroup,
        orderPerson,
        locations,
        locationCustom,
        vehicles,
        workers,
        workLogEntries,
        expenses,
        materials,
        uploadedFiles,
        resetForm,
        setVessel,
        setEngine,
        setSubject,
        setOrderGroup,
        setOrderPerson,
        setLocations,
        setLocationCustom,
        toggleVehicle,
        setVehicles,
        setWorkers,
        setExpenses,
        setMaterials,
        saveWorkLogEntry,
        setWorkLogEntries,
        setCurrentEntry,
        addCurrentEntryPerson,
    } = useWorkReportStore();

    // ✅ 변경 감지(dirty)용 스냅샷 (store 값 선언 이후에 있어야 함)
    const initialSnapshotRef = useRef<string>("");
    const makeSnapshot = useCallback(() => {
        return JSON.stringify({
            vessel,
            engine,
            subject,
            orderGroup,
            orderPerson,
            locations,
            locationCustom,
            vehicles,
            workers,
            workLogEntries,
            expenses,
            materials,
            uploadedFiles: uploadedFiles?.map((f: any) => ({
                name: f?.file?.name,
                category: f?.category,
                isExisting: f?.isExisting,
            })),
        });
    }, [
        vessel,
        engine,
        subject,
        orderGroup,
        orderPerson,
        locations,
        locationCustom,
        vehicles,
        workers,
        workLogEntries,
        expenses,
        materials,
        uploadedFiles,
    ]);

    const [isDirty, setIsDirty] = useState(false);

    // ✅ 최신 makeSnapshot 참조용 (비동기/timeout에서도 최신값 사용)
    const makeSnapshotRef = useRef(makeSnapshot);
    useEffect(() => {
        makeSnapshotRef.current = makeSnapshot;
    }, [makeSnapshot]);


    // 새로 작성 모드일 때 폼 초기화
    useEffect(() => {
        if (!isEditMode) {
            resetForm();
            setLastSavedAt(null);
            setHasUnsavedChanges(false);
            setIsSubmittedWorkLog(false);

            // ✅ 초기 스냅샷(빈 폼 기준) 저장
            // resetForm이 store를 바로 반영하지 않을 수 있어 다음 tick에 잡음
            setTimeout(() => {
                initialSnapshotRef.current = makeSnapshotRef.current();
                setIsDirty(false);
            }, 0);
        }
    }, [isEditMode, resetForm]);


    // 수정 모드일 때 기존 데이터 로드
    useEffect(() => {
        const loadWorkLogData = async () => {
            if (!isEditMode || !workLogId) return;

            try {
                setLoading(true);

                // 수정 모드일 때는 기존 데이터를 초기화
                resetForm();

                const data = await getWorkLogById(Number(workLogId));

                if (!data) {
                    showError("보고서를 찾을 수 없습니다.");
                    navigate("/report");
                    return;
                }

                // 제출 완료된 항목인지 확인
                setIsSubmittedWorkLog(!data.workLog.is_draft);

                // ✅ 최초 작성자/생성자 보관 (수정 시 그대로 유지)
                setOriginalAuthor((data.workLog.author ?? null) as any);
                setOriginalCreatedBy((data.workLog.created_by ?? null) as any);

                // 기본 정보 설정
                if (data.workLog.vessel) setVessel(data.workLog.vessel);
                if (data.workLog.engine) setEngine(data.workLog.engine);
                if (data.workLog.subject) setSubject(data.workLog.subject);
                if (data.workLog.order_group)
                    setOrderGroup(data.workLog.order_group);
                if (data.workLog.order_person)
                    setOrderPerson(data.workLog.order_person);
                if (data.workLog.location) {
                    const parsedLocations = String(data.workLog.location)
                        .split(",")
                        .map((loc) => loc.trim())
                        .filter(Boolean);
                    setLocations(parsedLocations);
                }
                if (data.workLog.vehicle) {
                    const vehicleList = data.workLog.vehicle
                        .split(", ")
                        .map((v) => v.trim())
                        .filter((v) => v);
                    setVehicles(vehicleList);
                }

                // 작업자 설정
                setWorkers(data.workers);

                // 업무 일지 설정
                const workLogEntries = data.entries.map((entry) => ({
                    id: entry.id,
                    dateFrom: entry.dateFrom,
                    timeFrom: entry.timeFrom || "",
                    dateTo: entry.dateTo,
                    timeTo: entry.timeTo || "",
                    descType: entry.descType as "작업" | "이동" | "대기" | "",
                    details: entry.details,
                    persons: entry.persons,
                    note: entry.note || "",
                    noLunch: (entry as any).lunch_worked ?? false,
                    moveFrom: entry.moveFrom,
                    moveTo: entry.moveTo,
                }));
                setWorkLogEntries(workLogEntries);

                // 지출 내역 설정
                const expenseEntries = data.expenses.map((exp) => ({
                    id: exp.id || Date.now() + Math.random(),
                    date: exp.date,
                    type: exp.type,
                    detail: exp.detail,
                    amount: exp.amount,
                }));
                setExpenses(expenseEntries);

                // 소모품 설정
                const materialEntries = data.materials.map((mat) => ({
                    id: mat.id || Date.now() + Math.random(),
                    name: mat.name,
                    qty: mat.qty,
                    unit: mat.unit || "",
                }));
                setMaterials(materialEntries);
            } catch (error: any) {
                console.error("Error loading work log:", error);
                showError(
                    `보고서 로드 실패: ${error.message || "알 수 없는 오류가 발생했습니다."
                    }`
                );
                navigate("/report");
            } finally {
                // ✅ 로드 완료 시점을 초기 스냅샷으로 고정
                setTimeout(() => {
                    initialSnapshotRef.current = makeSnapshotRef.current();
                    setIsDirty(false);
                }, 0);

                setLoading(false);
            }
        };

        loadWorkLogData();
    }, [isEditMode, workLogId]);


    // 실제 제출 로직
    const performSubmit = async () => {
        setSubmitting(true);
        try {
            // 현재 로그인한 사용자의 이름 가져오기
            let authorName: string | undefined;
            if (user?.id) {
                try {
                    const { data: profile } = await supabase
                        .from("profiles")
                        .select("name")
                        .eq("id", user.id)
                        .single();
                    if (profile?.name) {
                        authorName = profile.name;
                    }
                } catch (err) {
                    console.error("Error fetching user profile:", err);
                }
            }

            // 출장 보고서 생성 또는 업데이트
            const resolvedLocation =
                locations.length > 0 ? locations.join(", ") : undefined;
            const resolvedVehicle =
                vehicles.length > 0 ? vehicles.join(", ") : null;

            const workLogData = {
                // ✅ 수정모드면 최초 작성자 유지 (NOT NULL + 작성자 덮어쓰기 방지)
                author: isEditMode ? (originalAuthor || authorName) : authorName,

                vessel,
                engine,
                order_group: orderGroup || undefined,
                order_person: orderPerson || undefined,
                location: resolvedLocation,
                vehicle: resolvedVehicle || undefined,
                subject,
                workers,
                entries: workLogEntries.map((entry) => ({
                    id: entry.id,
                    dateFrom: entry.dateFrom,
                    timeFrom: entry.timeFrom || undefined,
                    dateTo: entry.dateTo,
                    timeTo: entry.timeTo || undefined,
                    descType: entry.descType,
                    details: entry.details,
                    persons: entry.persons,
                    note: entry.note || undefined,
                    moveFrom: entry.moveFrom || undefined,
                    moveTo: entry.moveTo || undefined,
                    lunch_worked: !!entry.noLunch,
                })),
                expenses: expenses.map((exp) => ({
                    date: exp.date,
                    type: exp.type,
                    detail: exp.detail,
                    amount: exp.amount,
                })),
                materials: materials.map((mat) => ({
                    name: mat.name,
                    qty: mat.qty,
                    unit: mat.unit || undefined,
                })),
                is_draft: false,

                // ✅ 수정모드면 created_by도 기존 유지(원하면 생략 가능하지만, 덮어쓰기 타입이면 유지가 안전)
                created_by: isEditMode ? (originalCreatedBy || user?.id || undefined) : (user?.id || undefined),
            };


            let workLog: WorkLog;
            if (isEditMode && workLogId) {
                // 수정 모드: 기존 레코드 업데이트
                workLog = await updateWorkLog(Number(workLogId), workLogData);
            } else {
                // 생성 모드: 새 레코드 생성
                workLog = await createWorkLog(workLogData);
            }

            // 파일 업로드 처리 (work_log 생성 후)
            // 새로 업로드한 파일만 처리 (기존 영수증은 이미 DB에 있음)
            const newFiles = uploadedFiles.filter((f) => !f.isExisting && f.file);
            if (newFiles.length > 0) {
                const receipts: Array<{
                    category: ReceiptCategoryEnum;
                    storage_bucket: string;
                    storage_path: string;
                    original_name?: string;
                    mime_type?: string;
                    file_size?: number;
                    created_by?: string;
                }> = [];

                for (const file of newFiles) {
                    if (!file.file) continue;

                    try {
                        const filePath = await uploadReceiptFile(
                            file.file,
                            workLog.id,
                            file.category
                        );

                        receipts.push({
                            category: mapReceiptCategory(file.category),
                            storage_bucket: "work-log-recipts", // 버킷 이름 (기본값과 다를 수 있으므로 명시)
                            storage_path: filePath, // uploadReceiptFile가 반환하는 경로를 그대로 저장
                            original_name: file.file.name,
                            mime_type: file.file.type || undefined,
                            file_size: file.file.size || undefined,
                            created_by: user?.id || undefined, // RLS 정책을 위해 명시적으로 전달
                        });
                    } catch (err: any) {
                        console.error("Error uploading file:", err);
                        showError(
                            `영수증 파일 업로드 실패: ${err?.message || "알 수 없는 오류"}`
                        );
                        throw err; // ✅ 업로드 실패면 제출도 실패 처리(중요)
                    }
                }

                // receipts 저장
                if (receipts.length > 0) {
                    const insertDataList = receipts.map((r) => {
                        // 명시적으로 필드 지정 (스프레드 연산자 대신)
                        const insertData: any = {
                            work_log_id: workLog.id,
                            category: r.category,
                            storage_bucket: r.storage_bucket,
                            storage_path: r.storage_path,
                        };

                        // 선택적 필드 추가
                        if (r.original_name) insertData.original_name = r.original_name;
                        if (r.mime_type) insertData.mime_type = r.mime_type;
                        if (r.file_size) insertData.file_size = r.file_size;
                        if (user?.id) insertData.created_by = user.id;

                        return insertData;
                    });

                    const { error: receiptsError } = await supabase
                        .from("work_log_receipt")
                        .insert(insertDataList)
                        .select();

                    if (receiptsError) {
                        showError(`영수증 DB 저장 실패: ${receiptsError.message || "알 수 없는 오류"}`);
                        throw receiptsError; // ✅ DB 저장 실패면 제출도 실패 처리
                    }
                }
            }

            showSuccess("제출이 완료되었습니다!");
            resetForm();
            setLastSavedAt(null);
            setHasUnsavedChanges(false);
            navigate("/report");
        } catch (error: any) {
            console.error("Error submitting work log:", error);
            showError(
                `제출 실패: ${error.message || "알 수 없는 오류가 발생했습니다."
                }`
            );
        } finally {
            setSubmitting(false);
        }
    };

    // 제출 핸들러 (확인 다이얼로그 열기)
    const handleSubmit = () => {
        // 필수 항목 체크
        if (!vessel || !engine || !subject) {
            showError("기본정보(호선/엔진/목적)는 필수입니다.");
            return;
        }
        if (workers.length === 0) {
            showError("인원을을 선택해주세요.");
            return;
        }
        if (workLogEntries.length === 0) {
            showError("출장 업무 일지를 1개 이상 작성해주세요.");
            return;
        }

        setSubmitConfirmOpen(true);
    };

    // 임시저장 핸들러 (자동 저장용 - 알림 없음)
    const handleDraftSave = useCallback(
        async (silent = false) => {
            // 이미 저장 중이면 스킵
            if (savingDraft || !user?.id) return;

            // 제출 완료된 항목은 임시저장하지 않음
            if (isSubmittedWorkLog) return;

            setSavingDraft(true);
            try {
                // 현재 로그인한 사용자의 이름 가져오기
                let authorName: string | undefined;
                if (user?.id) {
                    try {
                        const { data: profile } = await supabase
                            .from("profiles")
                            .select("name")
                            .eq("id", user.id)
                            .single();
                        if (profile?.name) {
                            authorName = profile.name;
                        }
                    } catch (err) {
                        console.error("Error fetching user profile:", err);
                    }
                }

                const resolvedLocation =
                    locations.length > 0 ? locations.join(", ") : undefined;
                const resolvedVehicle =
                    vehicles.length > 0 ? vehicles.join(", ") : null;

                // 현재 사용자의 기존 임시저장 항목 조회
                const existingDraft = await getDraftWorkLog(user.id);

                const draftData = {
                    author: isEditMode ? (originalAuthor || authorName) : authorName,

                    vessel: vessel || undefined,
                    engine: engine || undefined,
                    order_group: orderGroup || undefined,
                    order_person: orderPerson || undefined,
                    location: resolvedLocation,
                    vehicle: resolvedVehicle || undefined,
                    subject: subject || undefined,
                    workers: workers || [],
                    entries: workLogEntries.map((entry) => ({
                        dateFrom: entry.dateFrom,
                        timeFrom: entry.timeFrom || undefined,
                        dateTo: entry.dateTo,
                        timeTo: entry.timeTo || undefined,
                        descType: entry.descType,
                        details: entry.details,
                        persons: entry.persons,
                        note: entry.note || undefined,
                        moveFrom: entry.moveFrom || undefined,
                        moveTo: entry.moveTo || undefined,
                        lunch_worked: !!entry.noLunch,
                    })),
                    expenses: expenses.map((exp) => ({
                        date: exp.date,
                        type: exp.type,
                        detail: exp.detail,
                        amount: exp.amount,
                    })),
                    materials: materials.map((mat) => ({
                        name: mat.name,
                        qty: mat.qty,
                        unit: mat.unit || undefined,
                    })),
                    is_draft: true,
                    created_by: isEditMode ? (originalCreatedBy || user.id) : user.id,
                };


                if (isEditMode && workLogId) {
                    // 수정 모드: 기존 레코드 업데이트
                    await updateWorkLog(Number(workLogId), draftData);
                } else if (existingDraft) {
                    // 기존 임시저장 항목 업데이트
                    await updateWorkLog(existingDraft.id, draftData);
                } else {
                    // 새 임시저장 항목 생성
                    await createWorkLog(draftData);
                }

                setLastSavedAt(new Date());
                setHasUnsavedChanges(false);

                if (!silent) {
                    showSuccess("임시저장이 완료되었습니다!");
                    navigate("/report"); // ✅ 임시저장 후 목록으로 이동
                }

            } catch (error: any) {
                console.error("Error saving draft:", error);
                if (!silent) {
                    showError(
                        `임시저장 실패: ${error.message || "알 수 없는 오류가 발생했습니다."
                        }`
                    );
                }
            } finally {
                setSavingDraft(false);
            }
        },
        [
            vessel,
            engine,
            subject,
            orderGroup,
            orderPerson,
            locations,
            locationCustom,
            vehicles,
            workers,
            workLogEntries,
            expenses,
            materials,
            user?.id,
            savingDraft,
            isEditMode,
            workLogId,
            isSubmittedWorkLog,
        ]
    );

    // 수동 임시저장 핸들러
    const handleManualDraftSave = () => {
        handleDraftSave(false);
    };

    // ✅ 변경 감지: 초기 스냅샷과 현재 스냅샷 비교
    useEffect(() => {
        const current = makeSnapshot();
        const initial = initialSnapshotRef.current;

        // 초기 스냅샷이 아직 없다면 dirty false 유지
        if (!initial) {
            setIsDirty(false);
            return;
        }

        setIsDirty(current !== initial);
    }, [makeSnapshot]);

    // ✅ dirty일 때만: 뒤로가기 / 새로고침(이탈) 확인 팝업
    useEffect(() => {
        // ✅ 로딩 중(초기 마운트/리프레시)엔 history 가드 걸지 않음
        if (loading) return;
        if (!isDirty) return;

        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            e.preventDefault();
            e.returnValue = "";
        };

        const pushState = () => {
            window.history.pushState({ __block_back: true }, "", window.location.href);
        };

        // ✅ TDZ 방지: cleanup을 먼저 선언
        const cleanup = () => {
            window.removeEventListener("beforeunload", handleBeforeUnload);
            window.removeEventListener("popstate", handlePopState);
        };

        function handlePopState() {
            setNavigateConfirmOpen(true);
        }

        window.addEventListener("beforeunload", handleBeforeUnload);
        pushState();
        window.addEventListener("popstate", handlePopState);

        return () => {
            cleanup();
        };
    }, [isDirty, loading, navigate]);





    // 뒤로가기 버튼 클릭 (dirty일 때만 확인)
    const handleBackClick = () => {
        if (isDirty) {
            setNavigateConfirmOpen(true);
            return;
        }
        navigate("/report");
    };

    return (
        <div className="flex h-screen bg-[#f9fafb] overflow-hidden">
            {/* Mobile Overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-20 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar - 데스크탑에서 고정, 모바일에서 슬라이드 */}
            <div
                className={`
        fixed lg:static inset-y-0 left-0 z-30
        w-[260px] max-w-[88vw] lg:max-w-none lg:w-[239px] h-screen shrink-0
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
      `}
            >
                <Sidebar onClose={() => setSidebarOpen(false)} />
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col h-screen overflow-hidden w-full">
                <Header
                    title="출장 보고서 작성"
                    onMenuClick={() => setSidebarOpen(true)}
                    leftContent={
                        <div className="flex items-center gap-3">
                            <button
                                onClick={handleBackClick}
                                className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
                                title="목록으로 돌아가기"
                            >
                                <IconArrowBack />
                            </button>
                        </div>
                    }
                    rightContent={
                        <div className="flex items-center gap-3">
                            {!isSubmittedWorkLog && (
                                <>
                                    {lastSavedAt && (
                                        <span className="text-sm text-gray-400 whitespace-nowrap">
                                            {lastSavedAt.toLocaleTimeString(
                                                "ko-KR",
                                                {
                                                    hour: "2-digit",
                                                    minute: "2-digit",
                                                }
                                            )}{" "}
                                            저장됨
                                        </span>
                                    )}
                                    <Button
                                        variant="outline"
                                        size="lg"
                                        onClick={handleManualDraftSave}
                                        disabled={savingDraft}
                                    >
                                        {savingDraft
                                            ? "저장 중..."
                                            : "임시 저장"}
                                    </Button>
                                </>
                            )}
                            <Button
                                variant="primary"
                                size="lg"
                                onClick={handleSubmit}
                                icon={<IconReport />}
                                disabled={submitting}
                            >
                                <span className="hidden sm:inline">
                                    {submitting ? "제출 중..." : "제출하기"}
                                </span>
                            </Button>
                        </div>
                    }
                />

                {/* Content Area - 스크롤 가능 */}
                {loading ? (
                    <CreationSkeleton />
                ) : (
                    <div className="flex-1 overflow-y-auto px-4 sm:px-6 md:px-12 lg:px-24 xl:px-48 py-6 md:py-9">
                        <div className="max-w-[960px] mx-auto flex flex-col gap-4 md:gap-6">
                            {/* 기본 정보 */}
                            <BasicInfoSection />

                            {/* 작업자 */}
                            <WorkerSection />

                            {/* 출장 업무 일지 */}
                            <WorkLogSection />

                            {/* 경비 내역 */}
                            <ExpenseSection />

                            {/* 소모품 사용량 */}
                            <ConsumablesSection />

                            {/* 첨부파일 업로드 */}
                            <FileUploadSection workLogId={isEditMode ? Number(workLogId) : null} />

                            {/* 타임라인 요약 */}
                            <TimelineSummarySection />
                        </div>
                    </div>
                )}
            </div>

            {/* 제출 확인 다이얼로그 */}
            <ConfirmDialog
                isOpen={submitConfirmOpen}
                onClose={() => setSubmitConfirmOpen(false)}
                onConfirm={async () => {
                    setSubmitConfirmOpen(false);
                    await performSubmit();
                }}
                title="제출 확인"
                message="제출하시겠습니까?"
                confirmText="제출"
                cancelText="취소"
                confirmVariant="primary"
                isLoading={submitting}
            />

            {/* 나감 확인 다이얼로그 */}
            <ConfirmDialog
                isOpen={navigateConfirmOpen}
                onClose={() => {
                    setNavigateConfirmOpen(false);
                }}
                onConfirm={() => {
                    setNavigateConfirmOpen(false);
                    navigate("/report");
                }}
                title="나가기"
                message="작성/수정된 내용이 있습니다. 정말 뒤로가시겠습니까?"
                confirmText="나가기"
                cancelText="취소"
                confirmVariant="danger"
            />
        </div>
    );
}
