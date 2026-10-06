import { useState, useRef } from "react";
import SectionCard from "../ui/SectionCard";
import TextInput from "../ui/TextInput";
import Button from "../common/Button";
import { useWorkReportStore } from "../../store/workReportStore";
import { IconClose, IconEdit } from "../icons/Icons";
import { useToast } from "../ui/ToastProvider";
import { useUser } from "../../hooks/useUser";
import WorkLogEditPermissionModal from "./WorkLogEditPermissionModal";
import {
    fetchWorkLogEditorIds,
    saveWorkLogEditors,
} from "../../lib/workLogEditorsApi";

// 직급 순서 정의 (높은 순)
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

interface WorkerSectionProps {
    title?: string;
    /** 저장된 보고서가 있으면 권한을 바로 반영한다. */
    workLogId?: number | null;
    /** 최초 작성자만 수정 권한을 부여할 수 있다. 작성 화면은 본인이 작성자다. */
    canManageEditPermission?: boolean;
}

export default function WorkerSection({
    title = "전체 인원",
    workLogId = null,
    canManageEditPermission = true,
}: WorkerSectionProps) {
    const {
        workers,
        addWorker,
        removeWorker,
        allStaff,
        staffLoading: loading,
        editPermissionUserIds,
        setEditPermissionUserIds,
    } = useWorkReportStore();
    const { currentUserId } = useUser();
    const { showSuccess, showError } = useToast();
    const [permissionOpen, setPermissionOpen] = useState(false);
    const [permissionLoading, setPermissionLoading] = useState(false);
    const [permissionSaving, setPermissionSaving] = useState(false);
    const [permissionLoadFailed, setPermissionLoadFailed] = useState(false);
    const [draftEditorIds, setDraftEditorIds] = useState<string[]>([]);
    const [showDirectInput, setShowDirectInput] = useState(false);
    const [adminTeamOpen, setAdminTeamOpen] = useState(false); // 공무팀 기본 숨김(접힘)
    const [inputValue, setInputValue] = useState("");
    const [isAdding, setIsAdding] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleAddWorker = () => {
        if (isAdding) return; // 이미 추가 중이면 무시
        const trimmed = inputValue.trim();
        if (!trimmed) return;
        
        setIsAdding(true);
        const valueToAdd = trimmed;
        
        // 입력 필드 즉시 비우기
        setInputValue("");
        if (inputRef.current) {
            inputRef.current.value = "";
        }
        
        addWorker(valueToAdd);
        // 다음 이벤트 루프에서 다시 추가 가능하도록
        setTimeout(() => setIsAdding(false), 0);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.preventDefault();
            e.stopPropagation();
            // 입력 필드 즉시 비우기 (상태와 DOM 모두)
            setInputValue("");
            if (inputRef.current) {
                inputRef.current.value = "";
            }
            handleAddWorker();
        }
    };

    // 공무팀과 일반 직원 분리
    const adminTeamMembers = allStaff.filter(
        (m) => m.department === "공무팀"
    );
    const regularMembers = allStaff.filter(
        (m) => m.department !== "공무팀"
    );

    // 공무팀: 직급 높은 순 → 이름순 정렬
    const sortedAdminTeamMembers = [...adminTeamMembers].sort((a, b) => {
        const orderA = ROLE_ORDER[a.position] ?? 999;
        const orderB = ROLE_ORDER[b.position] ?? 999;

        if (orderA !== orderB) {
            return orderA - orderB; // 직급 높은 순
        }
        return a.name.localeCompare(b.name); // 같은 직급이면 이름순
    });


    // 직급별 그룹화
    const roleGroups = regularMembers.reduce(
        (acc, member) => {
            const role = member.position || "";
            if (!role) return acc;

            if (!acc[role]) {
                acc[role] = [];
            }
            acc[role].push(member.name);
            acc[role].sort((a, b) => a.localeCompare(b, "ko"));
            return acc;
        },
        {} as Record<string, string[]>
    );

    // 직급 순서대로 정렬된 그룹 배열 (인원이 있는 것만 표시, 사원은 예외)
    const staffGroups = Object.entries(roleGroups)
        .filter(([role, names]) => {
            // 사원인 경우: 인원이 있을 때만 표시
            if (role === "사원") {
                return names.length > 0;
            }
            // 기타 직급: 인원이 있을 때만 표시
            return names.length > 0;
        })
        .sort(([roleA], [roleB]) => {
            const orderA = ROLE_ORDER[roleA] ?? 999;
            const orderB = ROLE_ORDER[roleB] ?? 999;
            return orderA - orderB;
        });

    const staffByName = new Map(
        allStaff.map((member) => [member.name.trim().toLowerCase(), member])
    );
    const sortedWorkers = [...workers].sort((a, b) => {
        const profileA = staffByName.get(a.trim().toLowerCase());
        const profileB = staffByName.get(b.trim().toLowerCase());
        const group = (profile: (typeof allStaff)[number] | undefined) => {
            if (!profile) return 2;
            return profile.department === "공무팀" ? 1 : 0;
        };
        const groupA = group(profileA);
        const groupB = group(profileB);
        if (groupA !== groupB) return groupA - groupB;
        const orderA = profileA ? (ROLE_ORDER[profileA.position] ?? 999) : 999;
        const orderB = profileB ? (ROLE_ORDER[profileB.position] ?? 999) : 999;
        if (orderA !== orderB) return orderA - orderB;
        return a.localeCompare(b, "ko");
    });

    const openPermissionModal = async () => {
        setPermissionOpen(true);
        setPermissionLoadFailed(false);
        if (!workLogId) {
            setDraftEditorIds(editorIdsInWorkers(editPermissionUserIds));
            return;
        }

        setPermissionLoading(true);
        try {
            const ids = editorIdsInWorkers(await fetchWorkLogEditorIds(workLogId));
            setEditPermissionUserIds(ids);
            setDraftEditorIds(ids);
        } catch (error) {
            console.error(error);
            setPermissionLoadFailed(true);
            setDraftEditorIds(editorIdsInWorkers(editPermissionUserIds));
            showError("수정 권한을 불러오지 못했습니다.");
        } finally {
            setPermissionLoading(false);
        }
    };

    const workerAccountIds = allStaff
        .filter((member) => {
            const name = member.name.trim().toLowerCase();
            return (
                !!member.id &&
                workers.some((worker) => worker.trim().toLowerCase() === name)
            );
        })
        .map((member) => member.id);

    const editorIdsInWorkers = (ids: string[]) =>
        ids.filter((id) => workerAccountIds.includes(id) && id !== currentUserId);

    const permissionStaff = allStaff.filter(
        (member) => workerAccountIds.includes(member.id) && member.id !== currentUserId
    );

    const editPermissionNames = new Set(
        allStaff
            .filter((member) => editPermissionUserIds.includes(member.id))
            .map((member) => member.name.trim().toLowerCase())
    );

    const toggleDraftEditor = (userId: string) => {
        setDraftEditorIds((prev) =>
            prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
        );
    };

    const savePermission = async () => {
        if (permissionLoadFailed) {
            showError("수정 권한을 불러오지 못해 저장할 수 없습니다.");
            return;
        }

        const nextIds = editorIdsInWorkers(draftEditorIds);
        setEditPermissionUserIds(nextIds);
        setDraftEditorIds(nextIds);
        if (!workLogId) {
            showSuccess("보고서를 저장하면 수정 권한이 적용됩니다.");
            setPermissionOpen(false);
            return;
        }

        setPermissionSaving(true);
        try {
            await saveWorkLogEditors(workLogId, nextIds);
            showSuccess("수정 권한을 저장했습니다.");
            setPermissionOpen(false);
        } catch (error) {
            console.error(error);
            showError(error instanceof Error ? error.message : "수정 권한 저장에 실패했습니다.");
        } finally {
            setPermissionSaving(false);
        }
    };

    const editPermissionList = sortedWorkers
        .filter((worker) => editPermissionNames.has(worker.trim().toLowerCase()))
        .join(", ");

    return (
        <SectionCard
            title={title}
            headerContent={
                canManageEditPermission ? (
                    <button
                        type="button"
                        onClick={() => void openPermissionModal()}
                        className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
                    >
                        수정 권한
                    </button>
                ) : null
            }
        >
            <div className="flex flex-col gap-4">
                {loading ? (
                    <div className="text-center text-gray-500 py-4">
                        구성원 정보를 불러오는 중...
                    </div>
                ) : (
                    <>

                        {/* 직급별 카탈로그 */}
                        {staffGroups.map(([rank, names]) => (
                            <div
                                key={rank}
                                className="border border-gray-200 border-dashed rounded-2xl p-4 flex flex-col gap-2"
                            >
                                <p className="font-semibold text-[15px] text-gray-800">
                                    {rank}
                                </p>
                                <div className="grid grid-cols-4 md:flex md:flex-wrap gap-2">
                                    {names.map((name) => (
                                        <Button
                                            key={name}
                                            size="md"
                                            variant={
                                                workers.includes(name)
                                                    ? "primary"
                                                    : "outline"
                                            }
                                            onClick={() =>
                                                workers.includes(name)
                                                    ? removeWorker(name)
                                                    : addWorker(name)
                                            }
                                            className="w-full md:w-auto text-[13px] md:text-[14px]"
                                        >
                                            {name}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        ))}

                        {/* 공무팀 (맨 아래 / 박스 전체 클릭 토글 / 기본 숨김) */}
                        {adminTeamMembers.length > 0 && (
                            <div
                                onClick={() => setAdminTeamOpen((v) => !v)}
                                className="border border-blue-200 border-dashed rounded-2xl p-4 flex flex-col gap-2 bg-blue-50/30 cursor-pointer"
                            >
                                {/* 헤더 */}
                                <div className="flex items-center justify-between">
                                    <p className="font-semibold text-[15px] text-blue-800">
                                        공무팀
                                    </p>
                                    <span className="text-[13px] text-blue-600">
                                        {adminTeamOpen ? "숨기기" : "보기"} ({adminTeamMembers.length})
                                    </span>
                                </div>

                                {/* 인원 목록 */}
                                {adminTeamOpen && (
                                    <div
                                        className="grid grid-cols-4 md:flex md:flex-wrap gap-2 mt-1"
                                        onClick={(e) => e.stopPropagation()} // 👈 버튼 클릭 시 토글 방지
                                    >
                                            {sortedAdminTeamMembers.map((member) => (
                                            <Button
                                                key={member.name}
                                                size="md"
                                                variant={
                                                    workers.includes(member.name)
                                                        ? "primary"
                                                        : "outline"
                                                }
                                                onClick={() =>
                                                    workers.includes(member.name)
                                                        ? removeWorker(member.name)
                                                        : addWorker(member.name)
                                                }
                                                className="w-full md:w-auto text-[13px] md:text-[14px]"
                                            >
                                                {member.name}
                                            </Button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}



                    </>
                )}

                {/* 직접입력 토글 */}
                <div className="flex gap-2 items-center">
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setShowDirectInput(!showDirectInput)}
                    >
                        {showDirectInput ? "직접입력 숨기기" : "직접입력"}
                    </Button>
                </div>

                {/* 직접입력 필드 */}
                {showDirectInput && (
                    <div className="flex flex-col gap-2 items-stretch -mt-2 sm:flex-row sm:items-end">
                        <div className="flex-1 relative">
                            <TextInput
                                placeholder="이름 입력 후 추가 또는 Enter"
                                value={inputValue}
                                onChange={setInputValue}
                                onKeyDown={handleKeyDown}
                                inputRef={inputRef}
                            />
                        </div>
                        <Button
                            type="button"
                            variant="primary"
                            size="md"
                            onClick={handleAddWorker}
                            className="w-full sm:w-auto md:h-12 md:px-4 md:text-[16px] md:rounded-[10px]"
                            loading={isAdding}
                        >
                            추가
                        </Button>
                    </div>
                )}

                {/* 선택된 작업자 (투입 인원) */}
                <div className="border border-[#e5e7eb] rounded-xl px-4 py-3 flex flex-col gap-2 bg-white">
                    <div className="flex flex-wrap gap-x-1.5 gap-y-1 items-center">
                        <p className="font-medium text-[15px] text-gray-900">
                            투입 인원
                        </p>
                        <p className="font-medium text-[14px] text-gray-400">
                            총{workers.length}명
                            {editPermissionList
                                ? ` / 수정 권한 : ${editPermissionList}`
                                : ""}
                        </p>
                    </div>
                    <div className="grid grid-cols-4 md:flex md:flex-wrap gap-2">
                        {workers.length === 0 ? (
                            <p className="text-[#99a1af] text-sm col-span-4 md:col-span-1">
                                위에서 작업자를 선택해주세요
                            </p>
                        ) : (
                            sortedWorkers.map((worker) => {
                                const hasEditPermission = editPermissionNames.has(
                                    worker.trim().toLowerCase()
                                );
                                return (
                                    <span key={worker} className="relative w-full md:w-auto">
                                        {hasEditPermission ? (
                                            <span
                                                className="absolute -left-1 -top-1 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-[#3b82f6] text-white"
                                                title="수정 권한"
                                            >
                                                <IconEdit className="h-2.5 w-2.5" />
                                            </span>
                                        ) : null}
                                        <Button
                                            variant="secondary"
                                            size="md"
                                            onClick={() => removeWorker(worker)}
                                            className="w-full md:w-auto text-[11px] md:text-[13px] px-2 md:px-3 py-1.5 md:py-2"
                                        >
                                            {worker}
                                            <IconClose className="ml-1 w-3 h-3 md:w-3.5 md:h-3.5" />
                                        </Button>
                                    </span>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>
            <WorkLogEditPermissionModal
                isOpen={permissionOpen}
                loading={permissionLoading}
                saving={permissionSaving}
                staff={permissionStaff}
                selectedIds={draftEditorIds.filter((id) => id !== currentUserId)}
                onToggle={toggleDraftEditor}
                onClose={() => {
                    if (permissionSaving) return;
                    setPermissionOpen(false);
                }}
                onSave={() => void savePermission()}
            />
        </SectionCard>
    );
}
