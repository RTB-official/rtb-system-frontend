import BaseModal from "../ui/BaseModal";

interface TimesheetCellDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    sectionTitle: string;
    day: string;
    dateFormatted: string;
    timeFrom: string;
    timeTo: string;
    description: string;
    weekdayNormal: string;
    weekdayAfter: string;
    weekendNormal: string;
    weekendAfter: string;
    travelWeekday: string;
    travelWeekend: string;
}

export default function TimesheetCellDetailModal({
    isOpen,
    onClose,
    sectionTitle,
    day,
    dateFormatted,
    timeFrom,
    timeTo,
    description,
    weekdayNormal,
    weekdayAfter,
    weekendNormal,
    weekendAfter,
    travelWeekday,
    travelWeekend,
}: TimesheetCellDetailModalProps) {
    return (
        <BaseModal
            isOpen={isOpen}
            onClose={onClose}
            title={`${sectionTitle} 상세`}
            maxWidth="max-w-[520px]"
        >
            <div className="space-y-4 text-sm text-gray-900">
                <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-gray-200 p-3">
                        <div className="text-xs font-semibold text-gray-500">
                            Day / Date
                        </div>
                        <div className="mt-1">
                            {day} / {dateFormatted}
                        </div>
                    </div>
                    <div className="rounded-lg border border-gray-200 p-3">
                        <div className="text-xs font-semibold text-gray-500">
                            Time
                        </div>
                        <div className="mt-1">
                            {timeFrom} ~ {timeTo}
                        </div>
                    </div>
                </div>

                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <div className="text-xs font-semibold text-gray-600">
                        Split of Hours
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                        <div className="rounded-lg border border-gray-200 bg-white p-3">
                            <div className="text-xs font-semibold text-gray-500">
                                Weekday Normal Working
                            </div>
                            <div className="mt-1 text-lg font-bold">
                                {weekdayNormal || "-"}
                            </div>
                        </div>
                        <div className="rounded-lg border border-gray-200 bg-white p-3">
                            <div className="text-xs font-semibold text-gray-500">
                                Weekday After Normal Working
                            </div>
                            <div className="mt-1 text-lg font-bold">
                                {weekdayAfter || "-"}
                            </div>
                        </div>
                        <div className="rounded-lg border border-gray-200 bg-white p-3">
                            <div className="text-xs font-semibold text-gray-500">
                                Weekend / Holiday Normal Working
                            </div>
                            <div className="mt-1 text-lg font-bold">
                                {weekendNormal || "-"}
                            </div>
                        </div>
                        <div className="rounded-lg border border-gray-200 bg-white p-3">
                            <div className="text-xs font-semibold text-gray-500">
                                Weekend / Holiday After Normal Working
                            </div>
                            <div className="mt-1 text-lg font-bold">
                                {weekendAfter || "-"}
                            </div>
                        </div>
                        <div className="rounded-lg border border-gray-200 bg-white p-3">
                            <div className="text-xs font-semibold text-gray-500">
                                Travel Hours Weekday
                            </div>
                            <div className="mt-1 text-lg font-bold">
                                {travelWeekday || "-"}
                            </div>
                        </div>
                        <div className="rounded-lg border border-gray-200 bg-white p-3">
                            <div className="text-xs font-semibold text-gray-500">
                                Travel Hours Weekend / Holiday
                            </div>
                            <div className="mt-1 text-lg font-bold">
                                {travelWeekend || "-"}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="rounded-lg border border-gray-200 p-3">
                    <div className="text-xs font-semibold text-gray-500">
                        Description
                    </div>
                    <div className="mt-1 whitespace-pre-wrap break-words">
                        {description}
                    </div>
                </div>
            </div>
        </BaseModal>
    );
}
