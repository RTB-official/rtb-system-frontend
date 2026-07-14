import SectionCard from "../ui/SectionCard";
import { useWorkReportStore } from "../../store/workReportStore";

type MemoSectionProps = {
    /** true면 보기 전용 (작성/수정 store 미사용) */
    readOnly?: boolean;
    /** readOnly일 때 표시할 메모 값 */
    value?: string | null;
};

/**
 * 보고서 작성/수정/보기용 메모지 섹션
 */
export default function MemoSection({
    readOnly = false,
    value = null,
}: MemoSectionProps) {
    const { memo, setMemo } = useWorkReportStore();
    const displayMemo = readOnly ? String(value ?? "") : memo;
    const trimmed = displayMemo.trim();

    return (
        <SectionCard
            title={
                <span className="inline-flex items-baseline gap-2">
                    메모
                    {!readOnly && (
                        <span className="text-[13px] md:text-[14px] font-medium text-gray-400">
                            (선택)
                        </span>
                    )}
                </span>
            }
        >
            <div className="rounded-xl border border-yellow-300 bg-[#FEF08A] shadow-sm">
                {readOnly ? (
                    <div className="min-h-[120px] px-4 py-4 text-[15px] leading-relaxed text-gray-800 whitespace-pre-wrap break-words">
                        {trimmed || (
                            <span className="text-yellow-700/50">등록된 메모가 없습니다.</span>
                        )}
                    </div>
                ) : (
                    <textarea
                        value={memo}
                        onChange={(e) => setMemo(e.target.value)}
                        placeholder="선택 사항입니다. 필요하면 메모를 입력해 주세요"
                        rows={5}
                        className="w-full min-h-[120px] resize-none rounded-xl bg-transparent px-4 py-4 text-[15px] leading-relaxed text-gray-800 placeholder:text-yellow-700/50 focus:outline-none"
                    />
                )}
            </div>
        </SectionCard>
    );
}
