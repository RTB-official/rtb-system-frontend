import { useMemo } from "react";
import BaseModal from "../ui/BaseModal";
import Button from "../common/Button";
import { IconCheck } from "../icons/Icons";
import type { StaffProfile } from "../../store/workReportStore";

/** 투입 인원 선택란과 같은 직급 순서 */
const ROLE_ORDER: Record<string, number> = {
    "대표": 1,
    "감사": 2,
    "부장": 3,
    "차장": 4,
    "과장": 5,
    "대리": 6,
    "주임": 7,
    "사원": 8,
    "인턴": 9,
};

function compareByRoleThenName(a: StaffProfile, b: StaffProfile) {
    const orderA = ROLE_ORDER[a.position] ?? 999;
    const orderB = ROLE_ORDER[b.position] ?? 999;
    if (orderA !== orderB) return orderA - orderB;
    return a.name.localeCompare(b.name, "ko");
}

interface WorkLogEditPermissionModalProps {
    isOpen: boolean;
    loading: boolean;
    saving: boolean;
    staff: StaffProfile[];
    selectedIds: string[];
    onToggle: (userId: string) => void;
    onClose: () => void;
    onSave: () => void;
}

export default function WorkLogEditPermissionModal({
    isOpen,
    loading,
    saving,
    staff,
    selectedIds,
    onToggle,
    onClose,
    onSave,
}: WorkLogEditPermissionModalProps) {
    const sortedStaff = useMemo(() => {
        const list = staff.filter((member) => member.id && member.name.trim());
        const regular = list.filter((member) => member.department !== "공무팀");
        const adminTeam = list.filter((member) => member.department === "공무팀");
        return [...regular.sort(compareByRoleThenName), ...adminTeam.sort(compareByRoleThenName)];
    }, [staff]);

    return (
        <BaseModal
            isOpen={isOpen}
            onClose={onClose}
            title="수정 권한"
            maxWidth="max-w-[520px]"
            footer={
                <>
                    <Button type="button" variant="outline" size="md" onClick={onClose} disabled={saving}>
                        취소
                    </Button>
                    <Button
                        type="button"
                        variant="primary"
                        size="md"
                        onClick={onSave}
                        loading={saving}
                        disabled={loading || saving}
                    >
                        저장
                    </Button>
                </>
            }
        >
            <div className="flex flex-col gap-3">
                <p className="text-sm text-gray-500">
                    투입 인원에 선택된 사람만 목록에 표시됩니다.
                </p>
                <div className="max-h-[360px] overflow-y-auto rounded-xl border border-gray-200">
                    {loading ? (
                        <p className="px-4 py-8 text-center text-sm text-gray-500">불러오는 중…</p>
                    ) : sortedStaff.length === 0 ? (
                        <p className="px-4 py-8 text-center text-sm text-gray-500">
                            투입 인원에 선택된 사람이 없습니다.
                        </p>
                    ) : (
                        <ul className="divide-y divide-gray-100">
                            {sortedStaff.map((member) => {
                                const checked = selectedIds.includes(member.id);
                                return (
                                    <li key={member.id}>
                                        <button
                                            type="button"
                                            onClick={() => onToggle(member.id)}
                                            className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50"
                                        >
                                            {checked ? (
                                                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-[rgb(81,162,255)]">
                                                    <IconCheck className="h-2.5 w-2.5 text-white" />
                                                </span>
                                            ) : (
                                                <span className="h-4 w-4 shrink-0 rounded border border-gray-300" />
                                            )}
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate text-sm font-medium text-gray-900">
                                                    {member.name}
                                                </span>
                                                <span className="block truncate text-xs text-gray-500">
                                                    {[member.department, member.position].filter(Boolean).join(" · ") || "계정"}
                                                </span>
                                            </span>
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
                <p className="text-xs text-gray-400">선택 {selectedIds.length}명</p>
            </div>
        </BaseModal>
    );
}
