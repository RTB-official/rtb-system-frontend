import { useState } from "react";
import { IconUpload, IconCheck } from "../../../components/icons/Icons";
import Chip from "../../../components/ui/Chip";
import BaseModal from "../../../components/ui/BaseModal";

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
    const [isImageModalOpen, setIsImageModalOpen] = useState(false);

    if (variant === "card") {
        return (
            <>
                <div className="bg-white border border-gray-200 rounded-2xl p-4 relative">
                    <div className="flex items-start gap-4">
                        <div
                            className={`w-14 h-14 rounded-xl bg-[#f5f7fb] flex items-center justify-center overflow-hidden shrink-0 ${
                                img ? "cursor-pointer" : ""
                            }`}
                            onClick={() => img && setIsImageModalOpen(true)}
                        >
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
                                    <Chip
                                        color={
                                            tag === "주유"
                                                ? "orange-500"
                                                : tag === "통행료"
                                                ? "blue-500"
                                                : tag === "식비"
                                                ? "green-500"
                                                : tag === "자재구매"
                                                ? "purple-500"
                                                : "gray-500"
                                        }
                                        variant="filled"
                                        size="sm"
                                    >
                                        {tag}
                                    </Chip>
                                )}
                                <span className="text-[15px] text-gray-400">
                                    {date}
                                </span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <div className="text-[20px] font-extrabold text-gray-900">
                                        {amount}
                                    </div>
                                    {submitted ? (
                                        <Chip
                                            color="blue-500"
                                            variant="solid"
                                            size="sm"
                                            icon={
                                                <IconCheck className="w-3 h-3" />
                                            }
                                        >
                                            제출 완료
                                        </Chip>
                                    ) : (
                                        <Chip
                                            color="red-600"
                                            variant="solid"
                                            size="sm"
                                        >
                                            제출 전
                                        </Chip>
                                    )}
                                </div>
                                {desc && (
                                    <div className="text-sm text-gray-500 mt-1 wrap-break-word">
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

                {img && (
                    <BaseModal
                        isOpen={isImageModalOpen}
                        onClose={() => setIsImageModalOpen(false)}
                        title="영수증 원본"
                        maxWidth="max-w-[90vw]"
                    >
                        <div className="flex justify-center bg-gray-50 rounded-xl overflow-hidden mb-2">
                            <img
                                src={img}
                                alt="receipt full"
                                className="max-w-full h-auto max-h-[70vh] object-contain"
                            />
                        </div>
                    </BaseModal>
                )}
            </>
        );
    }

    return (
        <div className="bg-white border border-gray-200 rounded-2xl p-4">
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                    <div className="text-[15px] text-gray-400">{date}</div>
                </div>
                {onRemove && (
                    <button
                        onClick={onRemove}
                        className="w-4 h-4 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center hover:bg-gray-200 transition-colors shrink-0"
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
                    <div className="flex items-center gap-2">
                        <div className="text-[22px] font-extrabold text-gray-900">
                            {amount}
                        </div>
                        {submitted ? (
                            <Chip
                                color="blue-500"
                                variant="solid"
                                size="sm"
                                icon={<IconCheck className="w-3 h-3" />}
                            >
                                제출 완료
                            </Chip>
                        ) : (
                            <Chip color="red-600" variant="solid" size="sm">
                                제출 전
                            </Chip>
                        )}
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
