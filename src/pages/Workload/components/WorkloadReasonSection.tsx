import { useEffect, useState } from "react";
import Button from "../../../components/common/Button";
import WorkloadDailyDetailAnalysis from "./WorkloadDailyDetailAnalysis";
import type { WorkloadDetailEntry } from "../../../lib/workloadDetailApi";

interface WorkloadReasonSectionProps {
    isMobile?: boolean;
    reasonTargetName: string | null;
    selectedMonthNum: number;
    reasonText: string;
    reasonGovText: string;
    onReasonTextChange: (value: string) => void;
    onReasonGovTextChange: (value: string) => void;
    onSave: () => void;
    onClose: () => void;
    reasonDetailEntries: WorkloadDetailEntry[];
    reasonDetailLoading: boolean;
    reasonDetailPage: number;
    onReasonDetailPageChange: (page: number) => void;
    onReasonDetailRowClick: (row: WorkloadDetailEntry) => void;
}

export default function WorkloadReasonSection({
    isMobile = false,
    reasonTargetName,
    selectedMonthNum,
    reasonText,
    reasonGovText,
    onReasonTextChange,
    onReasonGovTextChange,
    onSave,
    onClose,
    reasonDetailEntries,
    reasonDetailLoading,
    reasonDetailPage,
    onReasonDetailPageChange,
    onReasonDetailRowClick,
}: WorkloadReasonSectionProps) {
    /** 막대 클릭 직후·인원 변경 시 기본 접힘; 제목 클릭으로 펼침 */
    const [reasonExpanded, setReasonExpanded] = useState(false);

    useEffect(() => {
        if (reasonTargetName) {
            setReasonExpanded(false);
        }
    }, [reasonTargetName]);

    const boxClass = isMobile ? "" : "rounded-2xl border border-gray-200 bg-white";
    return (
        <div
            className={[
                boxClass,
                "overflow-hidden px-4 md:px-7 transition-all duration-300 ease-out",
                reasonTargetName
                    ? "max-h-[12000px] opacity-100 translate-y-0 py-4 md:py-6"
                    : "max-h-0 opacity-0 -translate-y-2 py-0 border-transparent",
            ].filter(Boolean).join(" ")}
        >
            {reasonTargetName && (
                <div className="flex flex-col gap-3 md:gap-4">
                    <div
                        className={`flex flex-col ${reasonExpanded ? "gap-4" : "gap-0"}`}
                    >
                        <div className="flex items-start justify-between gap-3">
                            <button
                                type="button"
                                aria-expanded={reasonExpanded}
                                onClick={() => setReasonExpanded((v) => !v)}
                                className="group flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1.5 py-1.5 text-left -mx-1.5 -my-0.5 transition-colors hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-300"
                            >
                                <svg
                                    viewBox="0 0 20 20"
                                    fill="currentColor"
                                    aria-hidden
                                    className={`h-5 w-5 shrink-0 text-gray-500 transition-transform duration-200 group-hover:text-gray-700 ${
                                        reasonExpanded ? "rotate-90" : ""
                                    }`}
                                >
                                    <path
                                        fillRule="evenodd"
                                        d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                                        clipRule="evenodd"
                                    />
                                </svg>
                                <span className="min-w-0 truncate text-lg font-semibold text-gray-800 group-hover:text-gray-900">
                                    {reasonTargetName} 사유 ({selectedMonthNum}월)
                                </span>
                            </button>

                            <div className="flex items-center gap-2 shrink-0 pt-0.5">
                                <Button
                                    variant="primary"
                                    size="md"
                                    onClick={onSave}
                                >
                                    저장
                                </Button>
                                <Button
                                    variant="outline"
                                    size="md"
                                    onClick={onClose}
                                >
                                    닫기
                                </Button>
                            </div>
                        </div>

                        <div
                            className={[
                                "grid grid-cols-1 gap-4 overflow-hidden transition-[max-height,opacity] duration-300 ease-in-out md:grid-cols-2",
                                reasonExpanded
                                    ? "max-h-[520px] opacity-100"
                                    : "max-h-0 opacity-0 pointer-events-none",
                            ].join(" ")}
                        >
                            <div className="flex flex-col gap-2">
                                <div className="text-sm font-semibold text-gray-700">
                                    개인 사유
                                </div>
                                <textarea
                                    value={reasonText}
                                    onChange={(e) => onReasonTextChange(e.target.value)}
                                    placeholder="개인 사유를 입력하세요."
                                    className="w-full h-[140px] resize-none rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200"
                                />
                            </div>

                            <div className="flex flex-col gap-2">
                                <div className="text-sm font-semibold text-gray-700">
                                    공무팀 사유
                                </div>
                                <textarea
                                    value={reasonGovText}
                                    onChange={(e) => onReasonGovTextChange(e.target.value)}
                                    placeholder="공무팀 사유를 입력하세요."
                                    className="w-full h-[140px] resize-none rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="pt-3 md:pt-4 border-t border-gray-200">
                        <WorkloadDailyDetailAnalysis
                            entries={reasonDetailEntries}
                            isMobile={isMobile}
                            loading={reasonDetailLoading}
                            currentPage={reasonDetailPage}
                            onPageChange={onReasonDetailPageChange}
                            onRowClick={onReasonDetailRowClick}
                            bordered={false}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
