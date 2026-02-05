import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/common/Header";
import Tabs from "../../components/common/Tabs";
import Button from "../../components/common/Button";
import { useWorkReportStore } from "../../store/workReportStore";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import { useToast } from "../../components/ui/ToastProvider";
import { createWorkLog, uploadReceiptFile } from "../../lib/workLogApi";
import { supabase } from "../../lib/supabase";
import { IconArrowBack, IconReport } from "../../components/icons/Icons";
import useIsMobile from "../../hooks/useIsMobile";

// Sections (Existing & New)
import BasicInfoSection from "../../components/sections/BasicInfoSection";
import EducationBasicInfoSection from "../../components/sections/EducationBasicInfoSection";
import WorkerSection from "../../components/sections/WorkerSection";
import WorkLogSection from "../../components/sections/WorkLogSection";
import ExpenseSection from "../../components/sections/ExpenseSection";
import ConsumablesSection from "../../components/sections/ConsumablesSection";
import FileUploadSection from "../../components/sections/FileUploadSection";
import TimelineSummarySection from "../../components/sections/TimelineSummarySection";
import SectionCard from "../../components/ui/SectionCard";
import WorkloadLegend from "../../components/common/WorkloadLegend";

export default function ReportCreatePage() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const navigate = useNavigate();
    const { showError, showSuccess } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form Dirty State Handling
    const [isDirty, setIsDirty] = useState(false);
    const initialSnapshotRef = useRef<string>("");
    const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

    // Store State
    const {
        reportType,
        setReportType,
        resetForm,

        // Form Data
        author,
        instructor,
        vessel,
        engine,
        orderGroup,
        orderPerson,
        location,
        locationCustom,
        vehicles,
        subject,
        workers,
        workLogEntries,
        expenses,
        materials,
        uploadedFiles,
        fetchAllStaff,
    } = useWorkReportStore();

    // Snapshot Function
    const makeSnapshot = useCallback(() => {
        return JSON.stringify({
            reportType,
            author,
            instructor,
            vessel,
            engine,
            orderGroup,
            orderPerson,
            location,
            locationCustom,
            vehicles,
            subject,
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
        reportType, author, instructor, vessel, engine, orderGroup, orderPerson,
        location, locationCustom, vehicles, subject, workers,
        workLogEntries, expenses, materials, uploadedFiles
    ]);

    const makeSnapshotRef = useRef(makeSnapshot);
    useEffect(() => {
        makeSnapshotRef.current = makeSnapshot;
    }, [makeSnapshot]);

    // 작성자 자동 설정 (로그인 유저)
    const setInitialAuthor = async () => {
        const { data } = await supabase.auth.getUser();
        if (data?.user) {
            const { data: profile } = await supabase.from("profiles").select("name").eq("id", data.user.id).single();
            if (profile?.name) {
                useWorkReportStore.getState().setAuthor(profile.name);
            }
        }
        // Baseline snapshot after ALL initialization is done
        setTimeout(() => {
            initialSnapshotRef.current = makeSnapshotRef.current();
            setIsDirty(false);
        }, 0);
    };

    // Initial Load
    useEffect(() => {
        resetForm();
        setReportType("work");
        setActiveTab("work");
        setInitialAuthor();
        fetchAllStaff();

        return () => resetForm();
    }, [setReportType, resetForm]);

    // Update isDirty on change
    useEffect(() => {
        const current = makeSnapshot();
        const initial = initialSnapshotRef.current;
        if (!initial) {
            setIsDirty(false);
            return;
        }
        setIsDirty(current !== initial);
    }, [makeSnapshot]);

    // Tab State
    const [activeTab, setActiveTab] = useState<"work" | "education">("work");

    // Warning Modal State
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [pendingAction, setPendingAction] = useState<"switch_tab" | "go_back" | null>(null);
    const [pendingTab, setPendingTab] = useState<"work" | "education" | null>(null);

    // Handle Tab Change Request
    const handleTabChange = (value: string) => {
        const targetTab = value as "work" | "education";
        if (targetTab === activeTab) return;

        // Only warn if there are changes
        if (isDirty) {
            setPendingTab(targetTab);
            setPendingAction("switch_tab");
            setConfirmOpen(true);
        } else {
            // Switch immediately
            setReportType(targetTab);
            setActiveTab(targetTab);
            // After clean switch, we should not mark as dirty. 
            // The isDirty effect will trigger, but current should match initial if switched without edits.
            // Wait, if we switch reportType, the snapshot changes (reportType is included).
            // So we need to RE-SNAPSHOT after a clean switch.
            setTimeout(() => {
                initialSnapshotRef.current = makeSnapshotRef.current();
                setIsDirty(false);
            }, 0);
        }
    };

    // Confirm Change (Both Tab Switch & Back)
    const handleConfirmAction = () => {
        if (pendingAction === "switch_tab" && pendingTab) {
            resetForm();
            setReportType(pendingTab);
            setActiveTab(pendingTab);
            setInitialAuthor();
        } else if (pendingAction === "go_back") {
            navigate("/report");
        }

        setConfirmOpen(false);
        setPendingTab(null);
        setPendingAction(null);
    };

    // Back button confirmation
    const handleBackClick = () => {
        if (isDirty) {
            setPendingAction("go_back");
            setConfirmOpen(true);
            return;
        }
        navigate("/report");
    };

    // 저장 로직 (임시저장/제출)
    const handleSave = async (isDraft: boolean) => {
        if (isSubmitting) return;

        // 유효성 검사
        if (!subject.trim()) {
            showError("제목(목적/내용)을 입력해주세요.");
            return;
        }
        if (reportType === "work") {
            if (!vessel.trim()) { showError("호선명을 입력해주세요."); return; }
        } else {
            if (!instructor.trim()) { showError("강사명을 입력해주세요."); return; }
        }

        try {
            setIsSubmitting(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("로그인이 필요합니다.");

            // 데이터 매핑
            const finalSubject = reportType === "education"
                ? (subject.includes("교육") ? subject : `[교육] ${subject}`)
                : subject;

            const finalOrderPerson = reportType === "education" ? instructor : orderPerson;
            const finalLocation = location === "OTHER" ? locationCustom : location;

            // 1. Log 생성
            const newLog = await createWorkLog({
                author: author,
                vessel: reportType === "work" ? vessel : undefined,
                engine: reportType === "work" ? engine : undefined,
                order_group: reportType === "work" ? orderGroup : undefined,
                order_person: finalOrderPerson,
                location: finalLocation,
                vehicle: vehicles.join(","),
                subject: finalSubject,
                workers: workers,
                entries: workLogEntries.map(e => ({
                    id: e.id,
                    dateFrom: e.dateFrom,
                    timeFrom: e.timeFrom,
                    dateTo: e.dateTo,
                    timeTo: e.timeTo,
                    descType: e.descType,
                    details: e.details,
                    persons: e.persons,
                    note: e.note,
                    moveFrom: e.moveFrom,
                    moveTo: e.moveTo,
                    lunch_worked: e.noLunch
                })),
                expenses: expenses,
                materials: materials,
                receipts: [],
                is_draft: isDraft,
                created_by: user.id
            });

            // 2. 파일 업로드
            const newFiles = uploadedFiles.filter(f => !f.isExisting && f.file);

            if (newFiles.length > 0) {
                await Promise.all(newFiles.map(async (f) => {
                    if (!f.file) return;
                    await uploadReceiptFile(f.file, newLog.id, f.category);
                }));
            }

            setLastSavedAt(new Date());
            showSuccess(isDraft ? "임시저장 되었습니다." : "보고서가 제출되었습니다.");

            if (!isDraft) {
                navigate("/report");
            } else {
                // Update snapshot to current state to mark as not dirty after save
                initialSnapshotRef.current = makeSnapshotRef.current();
                setIsDirty(false);
            }

        } catch (e: any) {
            console.error(e);
            showError(e.message || "저장 중 오류가 발생했습니다.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex h-screen bg-white font-pretendard overflow-hidden">
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            <div
                className={`
        fixed lg:static inset-y-0 left-0 z-50
        transform ${sidebarOpen ? "translate-x-0" : "-translate-x-full"
                    } lg:translate-x-0
        transition-transform duration-300 ease-in-out
      `}
            >
                <Sidebar onClose={() => setSidebarOpen(false)} />
            </div>

            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <Header
                    title="보고서 작성"
                    onMenuClick={() => setSidebarOpen(true)}
                    leftContent={
                        <div className="flex items-center gap-3">
                            <button
                                onClick={handleBackClick}
                                className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
                            >
                                <IconArrowBack />
                            </button>
                        </div>
                    }
                    bottomContent={
                        <div className="px-4 md:px-6">
                            <Tabs
                                items={[
                                    { value: "work", label: "출장 보고서" },
                                    { value: "education", label: "교육 보고서" },
                                ]}
                                value={activeTab}
                                onChange={handleTabChange}
                            />
                        </div>
                    }
                    rightContent={
                        <div className="flex items-center gap-2 md:gap-3 flex-wrap justify-end">
                            {lastSavedAt && !isMobile && (
                                <span className="text-sm text-gray-400 whitespace-nowrap">
                                    {lastSavedAt.toLocaleTimeString("ko-KR", {
                                        hour: "2-digit",
                                        minute: "2-digit"
                                    })} 저장됨
                                </span>
                            )}
                            <Button
                                variant="outline"
                                size="md"
                                onClick={() => handleSave(true)}
                                disabled={isSubmitting}
                                className="md:h-12 md:px-4 md:text-base"
                            >
                                임시 저장
                            </Button>
                            <Button
                                variant="primary"
                                size="md"
                                onClick={() => handleSave(false)}
                                disabled={isSubmitting}
                                className="md:h-12 md:px-4 md:text-base"
                            >
                                제출하기
                            </Button>
                        </div>
                    }
                />

                <main className="flex-1 overflow-auto px-4 md:px-6 lg:px-12 pt-6 md:pt-10 pb-28 bg-gray-50/50">
                    <div className="max-w-[800px] mx-auto flex flex-col gap-5">

                        {/* Sections based on Report Type */}
                        {activeTab === "work" ? (
                            <>
                                <BasicInfoSection />
                                <WorkerSection title="투입 인원" />
                                <WorkLogSection />
                                <ExpenseSection />
                                <ConsumablesSection />
                                <FileUploadSection />
                                <SectionCard
                                    title="타임라인"
                                    headerContent={
                                        <WorkloadLegend
                                            items={[
                                                { key: "work", label: "작업", color: "#3b82f6" },
                                                { key: "move", label: "이동", color: "#10b981" },
                                                { key: "wait", label: "대기", color: "#f59e0b" },
                                            ]}
                                            className="flex items-center gap-4"
                                            itemClassName="flex items-center gap-1.5"
                                            labelClassName="text-[12px] text-[#6a7282]"
                                            swatchClassName="w-[14px] h-[14px] rounded-md"
                                        />
                                    }
                                >
                                    <TimelineSummarySection />
                                </SectionCard>
                            </>
                        ) : (
                            <>
                                <EducationBasicInfoSection />
                                <WorkerSection title="교육 참석자" />
                                <WorkLogSection />
                                <ExpenseSection />
                                <FileUploadSection />
                            </>
                        )}

                        <div className="h-10" /> {/* Bottom Spacer */}
                    </div>
                </main>
            </div>

            {/* Confirmation Modal */}
            <ConfirmDialog
                isOpen={confirmOpen}
                onClose={() => {
                    setConfirmOpen(false);
                    setPendingTab(null);
                    setPendingAction(null);
                }}
                onConfirm={handleConfirmAction}
                title={pendingAction === "go_back" ? "나가기" : "작성 중인 내용 취소"}
                message={
                    pendingAction === "go_back"
                        ? "작성/수정된 내용이 있습니다. 정말 뒤로 가시겠습니까?"
                        : "보고서 종류를 변경하면 작성 중인 내용이 모두 사라집니다.\n계속하시겠습니까?"
                }
                confirmText={pendingAction === "go_back" ? "나가기" : "변경하기"}
                cancelText="취소"
            />
        </div>
    );
}
