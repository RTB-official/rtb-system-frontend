import type { ScheduleStatusOption, ScheduleStatusTone } from "./scheduleStatusOptions";

const TONE_CLASS: Record<
    ScheduleStatusTone,
    { wrap: string; icon: string }
> = {
    green: {
        wrap: "border-emerald-200 bg-emerald-50 text-emerald-700",
        icon: "text-emerald-600",
    },
    orange: {
        wrap: "border-orange-200 bg-orange-50 text-orange-600",
        icon: "text-orange-500",
    },
    gray: {
        wrap: "border-gray-200 bg-gray-100 text-gray-600",
        icon: "text-gray-500",
    },
    blue: {
        wrap: "border-sky-200 bg-sky-50 text-sky-700",
        icon: "text-sky-600",
    },
    red: {
        wrap: "border-rose-200 bg-rose-50 text-rose-600",
        icon: "text-rose-500",
    },
};

function StatusIcon({
    icon,
    className = "",
}: {
    icon: ScheduleStatusOption["icon"];
    className?: string;
}) {
    const common = `h-3.5 w-3.5 shrink-0 ${className}`;
    if (icon === "check") {
        return (
            <svg className={common} viewBox="0 0 16 16" fill="none" aria-hidden>
                <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.5" />
                <path
                    d="M5.2 8.1l1.8 1.8 3.8-3.8"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </svg>
        );
    }
    if (icon === "clock") {
        return (
            <svg className={common} viewBox="0 0 16 16" fill="none" aria-hidden>
                <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.5" />
                <path
                    d="M8 4.8V8l2.2 1.4"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </svg>
        );
    }
    if (icon === "minus") {
        return (
            <svg className={common} viewBox="0 0 16 16" fill="none" aria-hidden>
                <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.5" />
                <path
                    d="M5 8h6"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                />
            </svg>
        );
    }
    if (icon === "box") {
        return (
            <svg className={common} viewBox="0 0 16 16" fill="none" aria-hidden>
                <path
                    d="M2.8 5.2L8 2.6l5.2 2.6v5.6L8 13.4l-5.2-2.6V5.2z"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinejoin="round"
                />
                <path
                    d="M2.8 5.2L8 7.8l5.2-2.6M8 7.8V13.4"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </svg>
        );
    }
    return (
        <svg className={common} viewBox="0 0 16 16" fill="none" aria-hidden>
            <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.5" />
            <path
                d="M8 4.8v4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
            />
            <circle cx="8" cy="11.2" r="0.7" fill="currentColor" />
        </svg>
    );
}

type ScheduleStatusBadgeProps = {
    option: ScheduleStatusOption;
    className?: string;
};

export default function ScheduleStatusBadge({
    option,
    className = "",
}: ScheduleStatusBadgeProps) {
    const tone = TONE_CLASS[option.tone];
    return (
        <span
            className={`inline-flex w-[5.75rem] max-w-full items-center justify-center gap-0.5 rounded-full border px-1.5 py-1 text-[10px] font-semibold leading-none ${tone.wrap} ${className}`}
        >
            <StatusIcon icon={option.icon} className={tone.icon} />
            <span className="truncate">{option.label}</span>
        </span>
    );
}
