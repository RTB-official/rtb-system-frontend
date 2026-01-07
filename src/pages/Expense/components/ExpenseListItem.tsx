import { IconUpload } from "../../../components/icons/Icons";
import Chip from "../../../components/ui/Chip";

interface ExpenseListItemProps {
    variant: "mileage" | "card";
    date: string;
    tag?: string;
    desc?: string;
    amount: string;
    img?: string | null;
    distanceLabel?: string;
    routeLabel?: string;
    submitted?: boolean;
    onRemove?: () => void;
}

export default function ExpenseListItem({
    variant,
    date,
    tag,
    desc,
    amount,
    img,
    distanceLabel,
    routeLabel,
    submitted,
    onRemove,
}: ExpenseListItemProps) {
    if (variant === "card") {
        return (
            <div className="bg-white border border-gray-200 rounded-2xl p-4 relative">
                <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-xl bg-[#f5f7fb] flex items-center justify-center overflow-hidden shrink-0">
                        {img ? (
                            <img
                                src={img}
                                alt="receipt"
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <IconUpload className="w-6 h-6 text-gray-400" />
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            {tag && (
                                <span className="inline-flex items-center px-2 py-1 rounded-lg text-[13px] font-medium text-orange-500 border border-orange-200">
                                    {tag}
                                </span>
                            )}
                            <span className="text-[15px] text-gray-400">
                                {date}
                            </span>
                            {submitted && (
                                <Chip variant="submitted">제출완료</Chip>
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-[20px] font-extrabold text-gray-900">
                                {amount}
                            </div>
                            {desc && (
                                <div className="text-sm text-gray-500 mt-1 break-words">
                                    {desc}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                {onRemove && (
                    <button
                        onClick={onRemove}
                        className="absolute top-4 right-4 w-4 h-4 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center hover:bg-gray-200 transition-colors shrink-0"
                        aria-label="삭제"
                    >
                        <svg
                            width="12"
                            height="12"
                            viewBox="0 0 12 12"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            <path
                                d="M3 3L9 9M9 3L3 9"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className="bg-white border border-gray-200 rounded-2xl p-4">
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                    <div className="text-[15px] text-gray-400">{date}</div>
                    {submitted && <Chip variant="submitted">제출완료</Chip>}
                </div>
                {onRemove && (
                    <button
                        onClick={onRemove}
                        className="w-4 h-4 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center hover:bg-gray-200 transition-colors flex-shrink-0"
                        aria-label="삭제"
                    >
                        <svg
                            width="12"
                            height="12"
                            viewBox="0 0 12 12"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            <path
                                d="M3 3L9 9M9 3L3 9"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                    </button>
                )}
            </div>

            <div className="flex items-center justify-between">
                <div>
                    <div className="text-[22px] font-extrabold text-gray-900">
                        {amount}
                    </div>
                    {routeLabel && (
                        <div className="text-sm text-gray-500 mt-1">
                            {routeLabel}
                        </div>
                    )}
                </div>
                {distanceLabel && (
                    <div className="text-sm text-gray-500">{distanceLabel}</div>
                )}
            </div>
        </div>
    );
}
