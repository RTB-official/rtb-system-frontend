import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
// src/pages/Creation/CreationPage.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { useWorkReportStore, LOCATIONS } from "../../store/workReportStore";
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
    const navigate = useNavigate();
    const { user } = useAuth();
    const { showSuccess, showError } = useToast();
    const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const isNavigatingRef = useRef(false);
    const {
        vessel,
        engine,
        subject,
        orderGroup,
        orderPerson,
        location,
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
        setLocation,
        setLocationCustom,
        toggleVehicle,
        setVehicles,
        addWorker,
        addExpense,
        addMaterial,
        saveWorkLogEntry,
        setWorkLogEntries,
        setCurrentEntry,
        addCurrentEntryPerson,
    } = useWorkReportStore();

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

                // 기본 정보 설정
                if (data.workLog.vessel) setVessel(data.workLog.vessel);
                if (data.workLog.engine) setEngine(data.workLog.engine);
                if (data.workLog.subject) setSubject(data.workLog.subject);
                if (data.workLog.order_group)
                    setOrderGroup(data.workLog.order_group);
                if (data.workLog.order_person)
                    setOrderPerson(data.workLog.order_person);
                if (data.workLog.location) {
                    if (
                        data.workLog.location === "OTHER" ||
                        !LOCATIONS.includes(data.workLog.location)
                    ) {
                        setLocation("OTHER");
                        if (data.workLog.location)
                            setLocationCustom(data.workLog.location);
                    } else {
                        setLocation(data.workLog.location);
                    }
                }
                if (data.workLog.vehicle) {
                    const vehicleList = data.workLog.vehicle
                        .split(", ")
                        .map((v) => v.trim())
                        .filter((v) => v);
                    setVehicles(vehicleList);
                }

                // 작업자 설정
                data.workers.forEach((worker) => addWorker(worker));

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
                    noLunch: false,
                    moveFrom: entry.moveFrom,
                    moveTo: entry.moveTo,
                }));
                setWorkLogEntries(workLogEntries);

                // 지출 내역 설정
                data.expenses.forEach((exp) => {
                    addExpense({
                        date: exp.date,
                        type: exp.type,
                        detail: exp.detail,
                        amount: exp.amount,
                    });
                });

                // 소모품 설정
                data.materials.forEach((mat) => {
                    addMaterial({
                        name: mat.name,
                        qty: mat.qty,
                        unit: mat.unit || "",
                    });
                });
            } catch (error: any) {
                console.error("Error loading work log:", error);
                showError(
                    `보고서 로드 실패: ${
                        error.message || "알 수 없는 오류가 발생했습니다."
                    }`
                );
                navigate("/report");
            } finally {
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
                location === "OTHER" ? locationCustom : location;
            const resolvedVehicle =
                vehicles.length > 0 ? vehicles.join(", ") : null;

            const workLogData = {
                author: authorName,
                vessel,
                engine,
                order_group: orderGroup || undefined,
                order_person: orderPerson || undefined,
                location: resolvedLocation || undefined,
                vehicle: resolvedVehicle || undefined,
                subject,
                workers,
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
                created_by: user?.id || undefined,
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
            if (uploadedFiles.length > 0) {
                const receipts = [];
                for (const file of uploadedFiles) {
                    try {
                        const filePath = await uploadReceiptFile(
                            file.file,
                            workLog.id,
                            file.category
                        );
                        receipts.push({
                            file_path: filePath,
                            orig_name: file.file.name,
                            mime_type: file.file.type || undefined,
                            file_size: file.file.size || undefined,
                            ext: file.file.name.split(".").pop() || undefined,
                        });
                    } catch (err) {
                        console.error("Error uploading file:", err);
                        // 파일 업로드 실패해도 계속 진행
                    }
                }

                // receipts 저장
                if (receipts.length > 0) {
                    const { error: receiptsError } = await supabase
                        .from("work_log_receipts")
                        .insert(
                            receipts.map((r) => ({
                                work_log_id: workLog.id,
                                ...r,
                            }))
                        );

                    if (receiptsError) {
                        console.error("Error saving receipts:", receiptsError);
                    }
                }
            }

            showSuccess("제출이 완료되었습니다!");
            isNavigatingRef.current = true;
            resetForm();
            setLastSavedAt(null);
            setHasUnsavedChanges(false);
            navigate("/report");
        } catch (error: any) {
            console.error("Error submitting work log:", error);
            showError(
                `제출 실패: ${
                    error.message || "알 수 없는 오류가 발생했습니다."
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
            showError("작업자를 선택해주세요.");
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
                    location === "OTHER" ? locationCustom : location;
                const resolvedVehicle =
                    vehicles.length > 0 ? vehicles.join(", ") : null;

                // 현재 사용자의 기존 임시저장 항목 조회
                const existingDraft = await getDraftWorkLog(user.id);

                const draftData = {
                    author: authorName,
                    vessel: vessel || undefined,
                    engine: engine || undefined,
                    order_group: orderGroup || undefined,
                    order_person: orderPerson || undefined,
                    location: resolvedLocation || undefined,
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
                    created_by: user.id,
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
                }
            } catch (error: any) {
                console.error("Error saving draft:", error);
                if (!silent) {
                    showError(
                        `임시저장 실패: ${
                            error.message || "알 수 없는 오류가 발생했습니다."
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
            location,
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

    // 변경사항 감지 및 자동 저장
    useEffect(() => {
        // 변경사항이 있으면 플래그 설정
        const hasChanges =
            vessel ||
            engine ||
            subject ||
            workers.length > 0 ||
            workLogEntries.length > 0 ||
            expenses.length > 0 ||
            materials.length > 0;

        if (hasChanges) {
            setHasUnsavedChanges(true);
        }

        // 자동 저장 타이머 (30초마다)
        if (hasChanges && !savingDraft && !submitting) {
            if (autoSaveTimeoutRef.current) {
                clearTimeout(autoSaveTimeoutRef.current);
            }

            autoSaveTimeoutRef.current = setTimeout(() => {
                if (hasChanges && !savingDraft && !submitting) {
                    handleDraftSave(true); // 자동 저장은 silent 모드
                }
            }, 30000); // 30초
        }

        return () => {
            if (autoSaveTimeoutRef.current) {
                clearTimeout(autoSaveTimeoutRef.current);
            }
        };
    }, [
        vessel,
        engine,
        subject,
        workers,
        workLogEntries,
        expenses,
        materials,
        savingDraft,
        submitting,
        handleDraftSave,
    ]);

    // 페이지를 떠날 때 자동 저장
    useEffect(() => {
        const handleBeforeUnload = () => {
            if (!isSubmittedWorkLog && !isNavigatingRef.current && user?.id) {
                // 화면을 벗어날 때 마지막 임시저장
                handleDraftSave(true);
            }
        };

        const handleVisibilityChange = () => {
            if (
                document.hidden &&
                !isSubmittedWorkLog &&
                !isNavigatingRef.current &&
                user?.id
            ) {
                // 탭이 숨겨질 때 (다른 탭으로 전환, 브라우저 최소화 등) 임시저장
                handleDraftSave(true);
            }
        };

        const handlePopState = () => {
            if (!isSubmittedWorkLog && !isNavigatingRef.current && user?.id) {
                // 뒤로 가기/앞으로 가기 시 자동 저장
                handleDraftSave(true);
            }
        };

        window.addEventListener("beforeunload", handleBeforeUnload);
        document.addEventListener("visibilitychange", handleVisibilityChange);
        window.addEventListener("popstate", handlePopState);

        return () => {
            window.removeEventListener("beforeunload", handleBeforeUnload);
            document.removeEventListener(
                "visibilitychange",
                handleVisibilityChange
            );
            window.removeEventListener("popstate", handlePopState);
        };
    }, [isSubmittedWorkLog, isNavigatingRef, handleDraftSave, user?.id]);

    // 뒤로가기 버튼 클릭 시 자동 저장
    const handleBackClick = async () => {
        if (!isSubmittedWorkLog && user?.id) {
            isNavigatingRef.current = true;
            await handleDraftSave(true);
        }
        navigate(-1);
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
        w-[239px] h-screen shrink-0
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
                            <FileUploadSection />

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
        </div>
    );
}
