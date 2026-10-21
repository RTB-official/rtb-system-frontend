import { useEffect, useMemo, useState } from "react";
import BaseModal from "../ui/BaseModal";
import Button from "../common/Button";
import TextInput from "../ui/TextInput";
import { useToast } from "../ui/ToastProvider";
import { useWorkReportStore, type StaffProfile } from "../../store/workReportStore";
import { useStaffSortMeta } from "../../hooks/useStaffSortMeta";
import { sortPeopleByRoleAndJoinDate } from "../../utils/sortPeopleByRoleAndJoinDate";
import { ROLE_ORDER } from "../../pages/Members/constants";
import { SCHEDULE_TEAM_LEADERS } from "./scheduleTableShared";

export function formatPersonalSchedulePeriod(start: string, end: string) {
    const formatDay = (dateKey: string) => {
        const [, month, day] = dateKey.split("-");
        if (!month || !day) return "";
        return `${month}/${day}`;
    };
    const from = start <= end ? start : end;
    const to = start <= end ? end : start;
    if (from === to) return formatDay(from);
    return `${formatDay(from)}~${formatDay(to)}`;
}

function constructionTeamGroups(staff: StaffProfile[]) {
    const byRole = new Map<string, string[]>();
    staff
        .filter((member) => member.department === "공사팀")
        .forEach((member) => {
            const role = member.position?.trim();
            const name = member.name?.trim();
            if (!role || !name) return;
            const names = byRole.get(role) ?? [];
            if (!names.includes(name)) names.push(name);
            byRole.set(role, names);
        });

    return [...byRole.entries()]
        .map(([label, names]) => ({
            label,
            names: [...names].sort((a, b) => a.localeCompare(b, "ko")),
        }))
        .sort(
            (a, b) =>
                (ROLE_ORDER[a.label] ?? 999) - (ROLE_ORDER[b.label] ?? 999)
        );
}

export type PersonalScheduleEntry = {
    id: string;
    start: string;
    end: string;
    names: string[];
    reason: string;
};

type Props = {
    isOpen: boolean;
    onClose: () => void;
    periodStart: string | null;
    periodEnd: string | null;
    /** 수정 시 기존 항목 */
    editingEntry?: PersonalScheduleEntry | null;
    onSubmit: (entry: PersonalScheduleEntry) => void | Promise<void>;
};

export default function PersonalScheduleModal({
    isOpen,
    onClose,
    periodStart,
    periodEnd,
    editingEntry = null,
    onSubmit,
}: Props) {
    const { showError } = useToast();
    const allStaff = useWorkReportStore((state) => state.allStaff);
    const staffLoading = useWorkReportStore((state) => state.staffLoading);
    const fetchAllStaff = useWorkReportStore((state) => state.fetchAllStaff);
    const staffSortMeta = useStaffSortMeta();
    const [selected, setSelected] = useState<string[]>([]);
    const [reason, setReason] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const isEditing = editingEntry != null;

    const effectiveStart = editingEntry?.start ?? periodStart;
    const effectiveEnd = editingEntry?.end ?? periodEnd;

    const groups = useMemo(
        () => constructionTeamGroups(allStaff),
        [allStaff]
    );

    const periodLabel = useMemo(() => {
        if (!effectiveStart) return "";
        return formatPersonalSchedulePeriod(
            effectiveStart,
            effectiveEnd ?? effectiveStart
        );
    }, [effectiveStart, effectiveEnd]);

    useEffect(() => {
        if (!isOpen) return;
        void fetchAllStaff();
        if (editingEntry) {
            setSelected([...editingEntry.names]);
            setReason(editingEntry.reason);
        } else {
            setSelected([]);
            setReason("");
        }
        setSubmitting(false);
    }, [isOpen, fetchAllStaff, editingEntry]);

    const toggleName = (name: string) => {
        setSelected((current) =>
            current.includes(name)
                ? current.filter((item) => item !== name)
                : [...current, name]
        );
    };

    const handleSubmit = async () => {
        if (!effectiveStart) {
            showError("날짜를 먼저 선택해주세요.");
            return;
        }
        if (selected.length === 0) {
            showError("인원을 선택해주세요.");
            return;
        }
        if (!reason.trim()) {
            showError("사유를 입력해주세요.");
            return;
        }

        const end = effectiveEnd ?? effectiveStart;
        const start = effectiveStart <= end ? effectiveStart : end;
        const rangeEnd = effectiveStart <= end ? end : effectiveStart;
        const members = sortPeopleByRoleAndJoinDate(selected, staffSortMeta, {
            priorityFirst: SCHEDULE_TEAM_LEADERS,
        });

        setSubmitting(true);
        try {
            await Promise.resolve(
                onSubmit({
                    id:
                        editingEntry?.id ??
                        `personal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                    start,
                    end: rangeEnd,
                    names: members,
                    reason: reason.trim(),
                })
            );
            onClose();
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <BaseModal
            isOpen={isOpen}
            onClose={onClose}
            title={
                <div className="flex flex-wrap items-baseline gap-2">
                    <span>{isEditing ? "개인 일정 수정" : "개인 일정"}</span>
                    {periodLabel ? (
                        <span className="text-[13px] font-medium text-gray-400">
                            {periodLabel}
                        </span>
                    ) : null}
                </div>
            }
            maxWidth="max-w-[640px]"
            footer={
                <div className="flex justify-end gap-2">
                    <Button
                        type="button"
                        variant="ghost"
                        size="md"
                        onClick={onClose}
                        disabled={submitting}
                    >
                        취소
                    </Button>
                    <Button
                        type="button"
                        variant="primary"
                        size="md"
                        loading={submitting}
                        onClick={() => void handleSubmit()}
                    >
                        {isEditing ? "저장" : "등록"}
                    </Button>
                </div>
            }
        >
            <div className="flex min-h-0 flex-col gap-5 overflow-y-auto">
                <div>
                    <p className="mb-2 text-sm font-medium text-gray-700">
                        공사팀 인원
                    </p>
                    {staffLoading && groups.length === 0 ? (
                        <p className="py-6 text-center text-sm text-gray-500">
                            불러오는 중…
                        </p>
                    ) : groups.length === 0 ? (
                        <p className="py-6 text-center text-sm text-gray-500">
                            공사팀 인원이 없습니다.
                        </p>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {groups.map((group) => (
                                <div
                                    key={group.label}
                                    className="flex items-start gap-2"
                                >
                                    <p className="flex h-[30px] w-12 shrink-0 items-center text-sm font-medium text-gray-800">
                                        {group.label}
                                    </p>
                                    <div className="grid min-w-0 flex-1 grid-cols-3 gap-1.5 sm:grid-cols-4 md:grid-cols-6">
                                        {group.names.map((name) => {
                                            const on = selected.includes(name);
                                            return (
                                                <Button
                                                    key={name}
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    fullWidth
                                                    className={`!px-0.5 !text-[12px] ${
                                                        on
                                                            ? "!border-blue-300 !bg-blue-100 !text-gray-900"
                                                            : ""
                                                    }`}
                                                    onClick={() => toggleName(name)}
                                                >
                                                    {name}
                                                </Button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <TextInput
                    label="사유"
                    required
                    value={reason}
                    onChange={setReason}
                    placeholder="사유를 입력하세요"
                    className="w-full"
                />
            </div>
        </BaseModal>
    );
}
