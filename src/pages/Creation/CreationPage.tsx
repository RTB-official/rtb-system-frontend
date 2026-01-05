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
import { useWorkReportStore } from "../../store/workReportStore";

export default function CreationPage() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const navigate = useNavigate();
    const {
        author,
        vessel,
        engine,
        subject,
        workers,
        workLogEntries,
        expenses,
        materials,
    } = useWorkReportStore();

    // 제출 핸들러
    const handleSubmit = () => {
        // 필수 항목 체크
        if (!author || !vessel || !engine || !subject) {
            alert("기본정보(작성자/호선/엔진/목적)는 필수입니다.");
            return;
        }
        if (workers.length === 0) {
            alert("작업자를 선택해주세요.");
            return;
        }
        if (workLogEntries.length === 0) {
            alert("출장 업무 일지를 1개 이상 작성해주세요.");
            return;
        }

        if (!confirm("제출하시겠습니까?")) return;

        // 실제 서버 연동 시 여기에 API 호출
        const payload = {
            basic: {
                author,
                vessel,
                engine,
                subject,
                workers,
            },
            entries: workLogEntries,
            expenses,
            materials,
        };

        console.log("제출 데이터:", payload);
        alert("제출 완료! (콘솔에서 데이터 확인)");
    };

    // 임시저장 핸들러
    const handleDraftSave = () => {
        const payload = {
            basic: {
                author,
                vessel,
                engine,
                subject,
                workers,
            },
            entries: workLogEntries,
            expenses,
            materials,
        };

        console.log("임시저장 데이터:", payload);
        alert("임시저장 완료! (콘솔에서 데이터 확인)");
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
                        <button
                            onClick={() => navigate(-1)}
                            className="hidden sm:block hover:bg-gray-100 rounded-lg transition-colors p-1"
                            aria-label="뒤로가기"
                        >
                            <svg
                                width="36"
                                height="36"
                                viewBox="0 0 36 36"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                            >
                                <path
                                    d="M22.5 9L13.5 18L22.5 27"
                                    stroke="#d1d5dc"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </svg>
                        </button>
                    }
                    rightContent={
                        <>
                            <Button
                                variant="outline"
                                size="md"
                                onClick={handleDraftSave}
                            >
                                임시 저장
                            </Button>
                            <Button
                                variant="primary"
                                size="md"
                                onClick={handleSubmit}
                                icon={
                                    <svg
                                        width="16"
                                        height="16"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        xmlns="http://www.w3.org/2000/svg"
                                    >
                                        <path
                                            d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2ZM16 18H8V16H16V18ZM16 14H8V12H16V14ZM13 9V3.5L18.5 9H13Z"
                                            fill="currentColor"
                                        />
                                    </svg>
                                }
                            >
                                <span className="hidden sm:inline">
                                    제출하기
                                </span>
                            </Button>
                        </>
                    }
                />

                {/* Content Area - 스크롤 가능 */}
                <div className="flex-1 overflow-y-auto px-4 sm:px-6 md:px-12 lg:px-24 xl:px-48 py-6 md:py-9">
                    <div className="max-w-[817px] mx-auto flex flex-col gap-4 md:gap-6">
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
                        <TimelineSummarySection
                            onDraftSave={handleDraftSave}
                            onSubmit={handleSubmit}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
