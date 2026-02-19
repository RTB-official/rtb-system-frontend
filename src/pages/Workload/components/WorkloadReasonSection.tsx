import Button from "../../../components/common/Button";

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
}: WorkloadReasonSectionProps) {
    const boxClass = isMobile ? "" : "rounded-2xl border border-gray-200 bg-white";
    return (
        <div
            className={[
                boxClass,
                "overflow-hidden px-4 md:px-7 transition-all duration-300 ease-out",
                reasonTargetName
                    ? "max-h-[260px] opacity-100 translate-y-0 py-4 md:py-6"
                    : "max-h-0 opacity-0 -translate-y-2 py-0 border-transparent",
            ].filter(Boolean).join(" ")}
        >
            {reasonTargetName && (
                <>
                    <div className="flex items-center justify-between gap-3 mb-3">
                        <h2 className="text-lg font-semibold text-gray-800">
                            {reasonTargetName} 사유 ({selectedMonthNum}월)
                        </h2>

                        <div className="flex items-center gap-2">
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

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                </>
            )}
        </div>
    );
}
