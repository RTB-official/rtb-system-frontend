import { IconChevronLeft, IconChevronRight } from "../icons/Icons";
import { SCHEDULE_LABEL_BG, SCHEDULE_TITLE_BG } from "./scheduleTableShared";

type ScheduleExtraColumnsToggleProps = {
    open: boolean;
    onToggle: () => void;
    className?: string;
};

/** Remark 오른쪽 출입신청/자재준비 컬럼을 보이게 가로 스크롤하는 토글. */
export default function ScheduleExtraColumnsToggle({
    open,
    onToggle,
    className = "",
}: ScheduleExtraColumnsToggleProps) {
    return (
        <button
            type="button"
            onClick={onToggle}
            className={`inline-flex h-8 items-center gap-1 rounded-full border border-[#7EB6DE] px-2.5 text-[12px] font-semibold text-gray-800 transition-colors hover:brightness-95 ${className}`}
            style={{
                backgroundColor: open ? SCHEDULE_TITLE_BG : SCHEDULE_LABEL_BG,
            }}
            aria-label={open ? "추가 컬럼 접기" : "추가 컬럼 더보기"}
            title={open ? "접기" : "더보기"}
        >
            {open ? (
                <IconChevronLeft className="h-3.5 w-3.5 text-gray-700" />
            ) : (
                <IconChevronRight className="h-3.5 w-3.5 text-gray-700" />
            )}
            <span>{open ? "접기" : "더보기"}</span>
        </button>
    );
}
