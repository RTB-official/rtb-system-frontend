import { useEffect, useState } from "react";
import Button from "../../../components/common/Button";
import Input from "../../../components/common/Input";
import Select from "../../../components/common/Select";
import Chip from "../../../components/ui/Chip";
import { IconClose, IconEdit, IconPlus } from "../../../components/icons/Icons";
import { useToast } from "../../../components/ui/ToastProvider";
import {
    getInventoryCategoryDepth,
    getInventoryInheritedFormButtonGroups,
    getInventoryInheritedFormFields,
    getInventoryInheritedFormHashtags,
    inventoryInheritedDepthColor,
    isInventoryQuantityFormField,
    updateInventoryCategoryFormConfig,
    withInventoryDefaultQuantityField,
    type InventoryCategory,
    type InventoryCategoryFormButtonGroup,
    type InventoryCategoryFormButtonSelection,
    type InventoryCategoryFormField,
    type InventoryCategoryFormHashtag,
} from "../../../lib/inventoryApi";

function normalizeHashtagInput(value: string) {
    const trimmed = value.trim().replace(/^#+/, "").trim();
    return trimmed ? `#${trimmed}` : "";
}

function cloneButtonGroups(
    groups: InventoryCategoryFormButtonGroup[]
): InventoryCategoryFormButtonGroup[] {
    return groups.map((g) => ({
        ...g,
        buttons: g.buttons.map((b) => ({ ...b })),
    }));
}

function createEmptyButtonGroup(): InventoryCategoryFormButtonGroup {
    return {
        id: crypto.randomUUID(),
        name: "",
        selection: "single",
        buttons: [],
    };
}

interface InventoryCategoryFieldsSidePanelProps {
    open: boolean;
    category: InventoryCategory | null;
    categories: InventoryCategory[];
    onClose: () => void;
    onSaved: () => void;
}

export default function InventoryCategoryFieldsSidePanel({
    open,
    category,
    categories,
    onClose,
    onSaved,
}: InventoryCategoryFieldsSidePanelProps) {
    const { showError, showSuccess } = useToast();
    const [fields, setFields] = useState<InventoryCategoryFormField[]>([]);
    const [buttonGroups, setButtonGroups] = useState<InventoryCategoryFormButtonGroup[]>([]);
    const [hashtags, setHashtags] = useState<InventoryCategoryFormHashtag[]>([]);
    const [draftLabel, setDraftLabel] = useState("");
    const [draftUnit, setDraftUnit] = useState("");
    const [draftButtonLabels, setDraftButtonLabels] = useState<Record<string, string>>({});
    const [draftHashtag, setDraftHashtag] = useState("");
    const [disabledInheritedFieldIds, setDisabledInheritedFieldIds] = useState<
        string[]
    >([]);
    const [disabledInheritedButtonGroupIds, setDisabledInheritedButtonGroupIds] =
        useState<string[]>([]);
    const [disabledInheritedHashtagIds, setDisabledInheritedHashtagIds] = useState<
        string[]
    >([]);
    const [saving, setSaving] = useState(false);
    const [loadedForId, setLoadedForId] = useState<string | null>(null);
    /** 입력 폼으로 열린 그룹 id (없으면 카드 표시) */
    const [editingGroupIds, setEditingGroupIds] = useState<string[]>([]);

    const inheritedFields = category
        ? getInventoryInheritedFormFields(categories, category.id)
        : [];
    const inheritedButtonGroups = category
        ? getInventoryInheritedFormButtonGroups(categories, category.id)
        : [];
    const inheritedHashtags = category
        ? getInventoryInheritedFormHashtags(categories, category.id)
        : [];
    const disabledFieldSet = new Set(disabledInheritedFieldIds);
    const disabledGroupSet = new Set(disabledInheritedButtonGroupIds);
    const disabledHashtagSet = new Set(disabledInheritedHashtagIds);
    const ownDepth = category
        ? getInventoryCategoryDepth(categories, category.id)
        : 0;
    const ownDepthColor = inventoryInheritedDepthColor(ownDepth);

    if (open && category && loadedForId !== category.id) {
        setLoadedForId(category.id);
        const nextDisabledFields = [...category.disabledInheritedFieldIds];
        const nextDisabledFieldSet = new Set(nextDisabledFields);
        const qtyOn = getInventoryInheritedFormFields(categories, category.id).some(
            (f) => isInventoryQuantityFormField(f) && !nextDisabledFieldSet.has(f.id)
        );
        // 상위에 수량(on) 있으면 기본 수량 중복 추가 안 함
        setFields(
            qtyOn
                ? category.formFields.map((f) => ({ ...f }))
                : withInventoryDefaultQuantityField(category.formFields)
        );
        setButtonGroups(cloneButtonGroups(category.formButtonGroups));
        setEditingGroupIds([]);
        setHashtags(category.formHashtags.map((h) => ({ ...h })));
        setDisabledInheritedFieldIds(nextDisabledFields);
        setDisabledInheritedButtonGroupIds([
            ...category.disabledInheritedButtonGroupIds,
        ]);
        setDisabledInheritedHashtagIds([...category.disabledInheritedHashtagIds]);
        setDraftLabel("");
        setDraftUnit("");
        setDraftButtonLabels({});
        setDraftHashtag("");
    }
    if (!open && loadedForId != null) {
        setLoadedForId(null);
    }

    const toggleInheritedField = (fieldId: string) => {
        setDisabledInheritedFieldIds((current) =>
            current.includes(fieldId)
                ? current.filter((id) => id !== fieldId)
                : [...current, fieldId]
        );
    };

    const toggleInheritedButtonGroup = (groupId: string) => {
        setDisabledInheritedButtonGroupIds((current) =>
            current.includes(groupId)
                ? current.filter((id) => id !== groupId)
                : [...current, groupId]
        );
    };

    const toggleInheritedHashtag = (tagId: string) => {
        setDisabledInheritedHashtagIds((current) =>
            current.includes(tagId)
                ? current.filter((id) => id !== tagId)
                : [...current, tagId]
        );
    };

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape" && !saving) onClose();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, saving, onClose]);

    const addFieldAsChips = () => {
        const label = draftLabel.trim();
        const unit = draftUnit.trim();
        if (!label) {
            showError("라벨을 입력해 주세요.");
            return;
        }
        setFields((current) => [
            ...current,
            {
                id: crypto.randomUUID(),
                label,
                unit,
            },
        ]);
        setDraftLabel("");
        setDraftUnit("");
    };

    const addButtonGroup = () => {
        const next = createEmptyButtonGroup();
        setButtonGroups((current) => [...current, next]);
        setEditingGroupIds((current) => [...current, next.id]);
    };

    const updateButtonGroup = (
        groupId: string,
        partial: Partial<Pick<InventoryCategoryFormButtonGroup, "name" | "selection">>
    ) => {
        setButtonGroups((current) =>
            current.map((g) => (g.id === groupId ? { ...g, ...partial } : g))
        );
    };

    const removeButtonGroup = (groupId: string) => {
        setButtonGroups((current) => current.filter((g) => g.id !== groupId));
        setEditingGroupIds((current) => current.filter((id) => id !== groupId));
        setDraftButtonLabels((current) => {
            const next = { ...current };
            delete next[groupId];
            return next;
        });
    };

    const addButtonToGroup = (groupId: string) => {
        const label = (draftButtonLabels[groupId] ?? "").trim();
        if (!label) {
            showError("버튼명을 입력해 주세요.");
            return;
        }
        setButtonGroups((current) =>
            current.map((g) =>
                g.id === groupId
                    ? {
                          ...g,
                          buttons: [
                              ...g.buttons,
                              { id: crypto.randomUUID(), label },
                          ],
                      }
                    : g
            )
        );
        setDraftButtonLabels((current) => ({ ...current, [groupId]: "" }));
    };

    const commitButtonGroup = (groupId: string) => {
        const group = buttonGroups.find((g) => g.id === groupId);
        if (!group) return;
        const pendingLabel = (draftButtonLabels[groupId] ?? "").trim();
        const nextButtons = pendingLabel
            ? [...group.buttons, { id: crypto.randomUUID(), label: pendingLabel }]
            : group.buttons;
        if (!group.name.trim()) {
            showError("그룹명을 입력해 주세요.");
            return;
        }
        if (nextButtons.length === 0) {
            showError("버튼을 하나 이상 추가해 주세요.");
            return;
        }
        setButtonGroups((current) =>
            current.map((g) =>
                g.id === groupId ? { ...g, buttons: nextButtons } : g
            )
        );
        setDraftButtonLabels((current) => ({ ...current, [groupId]: "" }));
        setEditingGroupIds((current) => current.filter((id) => id !== groupId));
    };

    const startEditButtonGroup = (groupId: string) => {
        setEditingGroupIds((current) =>
            current.includes(groupId) ? current : [...current, groupId]
        );
    };

    const ownGroupCardClass =
        ownDepth <= 4
            ? "bg-orange-500 text-white"
            : ownDepth === 5
              ? "bg-purple-500 text-white"
              : "bg-green-700 text-white";

    const removeButtonFromGroup = (groupId: string, buttonId: string) => {
        setButtonGroups((current) =>
            current.map((g) =>
                g.id === groupId
                    ? { ...g, buttons: g.buttons.filter((b) => b.id !== buttonId) }
                    : g
            )
        );
    };

    const addHashtagAsChip = () => {
        const label = normalizeHashtagInput(draftHashtag);
        if (!label) {
            showError("해시태그를 입력해 주세요.");
            return;
        }
        if (hashtags.some((h) => h.label === label)) {
            showError("이미 추가된 해시태그입니다.");
            return;
        }
        setHashtags((current) => [
            ...current,
            {
                id: crypto.randomUUID(),
                label,
            },
        ]);
        setDraftHashtag("");
    };

    const removeField = (id: string) => {
        setFields((current) => current.filter((f) => f.id !== id));
    };

    const removeHashtag = (id: string) => {
        setHashtags((current) => current.filter((h) => h.id !== id));
    };

    const handleSave = async () => {
        if (!category) return;
        const pendingFields =
            draftLabel.trim().length > 0
                ? [
                      {
                          id: crypto.randomUUID(),
                          label: draftLabel.trim(),
                          unit: draftUnit.trim(),
                      },
                  ]
                : [];

        const groupsToSave = buttonGroups.map((group) => {
            const pendingLabel = (draftButtonLabels[group.id] ?? "").trim();
            const pendingButtons = pendingLabel
                ? [{ id: crypto.randomUUID(), label: pendingLabel }]
                : [];
            return {
                ...group,
                buttons: [...group.buttons, ...pendingButtons],
            };
        });

        const pendingHashtag = normalizeHashtagInput(draftHashtag);
        const pendingHashtags =
            pendingHashtag.length > 1
                ? [
                      {
                          id: crypto.randomUUID(),
                          label: pendingHashtag,
                      },
                  ]
                : [];
        setSaving(true);
        try {
            await updateInventoryCategoryFormConfig(category.id, {
                formFields: [...fields, ...pendingFields],
                formButtonGroups: groupsToSave,
                formHashtags: [...hashtags, ...pendingHashtags],
                disabledInheritedFieldIds,
                disabledInheritedButtonGroupIds,
                disabledInheritedHashtagIds,
            });
            showSuccess("입력 항목 설정이 저장되었습니다.");
            setDraftLabel("");
            setDraftUnit("");
            setDraftButtonLabels({});
            setDraftHashtag("");
            onSaved();
        } catch (error) {
            showError(
                error instanceof Error ? error.message : "저장에 실패했습니다."
            );
        } finally {
            setSaving(false);
        }
    };

    if (!open || !category) return null;

    return (
        <aside
            className="h-full w-[min(100vw,360px)] shrink-0 border-r border-gray-200 bg-white flex flex-col animate-[fadeSlideIn_280ms_ease-out]"
            aria-hidden={false}
        >
            <div className="flex items-center justify-between gap-2 border-b border-gray-200 px-4 py-4">
                <h3 className="min-w-0 text-lg font-semibold text-gray-900 truncate">
                    {category?.name ?? "카테고리"}
                </h3>
                <button
                    type="button"
                    className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 shrink-0"
                    onClick={onClose}
                    aria-label="닫기"
                >
                    <IconClose className="w-5 h-5" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-5">
                {/* 입력란(라벨·단위) */}
                <section className="flex flex-col gap-3">
                    <p className="text-sm font-semibold text-gray-900">입력란</p>
                    <div className="grid grid-cols-[1fr_minmax(5.5rem,7rem)] gap-2">
                        <Input
                            label="라벨"
                            value={draftLabel}
                            onChange={setDraftLabel}
                            placeholder="예: 토크"
                            disabled={saving}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    e.preventDefault();
                                    addFieldAsChips();
                                }
                            }}
                        />
                        <Input
                            label="단위"
                            value={draftUnit}
                            onChange={setDraftUnit}
                            placeholder="예: Nm"
                            disabled={saving}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    e.preventDefault();
                                    addFieldAsChips();
                                }
                            }}
                        />
                    </div>
                    <Button
                        type="button"
                        variant="outline"
                        size="md"
                        disabled={saving}
                        icon={<IconPlus className="w-4 h-4" />}
                        onClick={addFieldAsChips}
                        className="w-full"
                    >
                        추가
                    </Button>
                    {(inheritedFields.length > 0 || fields.length > 0) && (
                        <div className="flex flex-col gap-2">
                            {inheritedFields.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                    {inheritedFields.map((field) => {
                                        const on = !disabledFieldSet.has(field.id);
                                        const depthColor = inventoryInheritedDepthColor(
                                            field.sourceDepth
                                        );
                                        return (
                                            <Chip
                                                key={`inherited-${field.id}`}
                                                color={on ? depthColor : "gray-400"}
                                                variant={on ? "filled" : "outline"}
                                                size="md"
                                                className={`transition-all duration-150 ${
                                                    on
                                                        ? "hover:brightness-110 hover:shadow-sm"
                                                        : "hover:border-gray-500 hover:bg-gray-50 hover:text-gray-700"
                                                } ${saving ? "pointer-events-none opacity-60" : ""}`}
                                                onClick={
                                                    saving
                                                        ? undefined
                                                        : () =>
                                                              toggleInheritedField(
                                                                  field.id
                                                              )
                                                }
                                            >
                                                {field.unit
                                                    ? `${field.label} · ${field.unit}`
                                                    : field.label}
                                            </Chip>
                                        );
                                    })}
                                </div>
                            )}
                            {fields.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                    {fields.map((field) => (
                                        <Chip
                                            key={field.id}
                                            color={ownDepthColor}
                                            variant="filled"
                                            size="md"
                                            onRemove={
                                                saving
                                                    ? undefined
                                                    : () => removeField(field.id)
                                            }
                                        >
                                            {field.unit
                                                ? `${field.label} · ${field.unit}`
                                                : field.label}
                                        </Chip>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </section>

                <div className="border-t border-gray-200" aria-hidden />

                {/* 버튼 그룹 */}
                <section className="flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-gray-900">버튼 그룹</p>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={saving}
                            icon={<IconPlus className="w-4 h-4" />}
                            onClick={addButtonGroup}
                        >
                            그룹 추가
                        </Button>
                    </div>

                    {inheritedButtonGroups.length > 0 && (
                        <div className="flex flex-col gap-1.5">
                            {inheritedButtonGroups.map((group) => {
                                const on = !disabledGroupSet.has(group.id);
                                const depthColor = inventoryInheritedDepthColor(
                                    group.sourceDepth
                                );
                                const onBoxClass =
                                    group.sourceDepth <= 4
                                        ? "bg-orange-500 text-white hover:bg-orange-600"
                                        : group.sourceDepth === 5
                                          ? "bg-purple-500 text-white hover:bg-purple-600"
                                          : "bg-green-700 text-white hover:bg-green-800";
                                return (
                                    <button
                                        key={`inherited-group-${group.id}`}
                                        type="button"
                                        disabled={saving}
                                        onClick={() =>
                                            toggleInheritedButtonGroup(group.id)
                                        }
                                        className={`rounded-xl p-3 flex flex-col gap-2 text-left transition-all duration-150 disabled:opacity-60 ${
                                            on
                                                ? `${onBoxClass} shadow-sm`
                                                : "bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                                        }`}
                                    >
                                        <p className="text-sm font-medium">
                                            {group.name || "그룹"}
                                            <span
                                                className={`ml-1.5 text-xs font-normal ${
                                                    on ? "text-white/70" : "text-gray-400"
                                                }`}
                                            >
                                                {group.sourceDepth}단계 ·{" "}
                                                {on ? "ON" : "OFF"} ·{" "}
                                                {group.selection === "single"
                                                    ? "한 개만"
                                                    : "중복 가능"}
                                            </span>
                                        </p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {group.buttons.map((button) => (
                                                <Chip
                                                    key={button.id}
                                                    color={on ? depthColor : "gray-400"}
                                                    variant={on ? "filled" : "outline"}
                                                    size="md"
                                                    className="pointer-events-none"
                                                >
                                                    {button.label}
                                                </Chip>
                                            ))}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {buttonGroups.length > 0 && (
                        <div className="flex flex-col gap-3">
                            {buttonGroups.map((group) => {
                                const isEditing = editingGroupIds.includes(group.id);
                                if (!isEditing) {
                                    return (
                                        <div
                                            key={group.id}
                                            className={`rounded-xl p-3 flex flex-col gap-2 ${ownGroupCardClass} shadow-sm`}
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <p className="min-w-0 flex-1 text-sm font-medium">
                                                    {group.name || "그룹"}
                                                    <span className="ml-1.5 text-xs font-normal text-white/70">
                                                        {group.selection === "single"
                                                            ? "한 개만"
                                                            : "중복 가능"}
                                                    </span>
                                                </p>
                                                <div className="flex items-center gap-0.5 shrink-0">
                                                    <button
                                                        type="button"
                                                        disabled={saving}
                                                        className="p-1 rounded-md text-white/80 hover:text-white hover:bg-white/15 disabled:opacity-50"
                                                        onClick={() =>
                                                            startEditButtonGroup(group.id)
                                                        }
                                                        aria-label="그룹 수정"
                                                    >
                                                        <IconEdit className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        disabled={saving}
                                                        className="p-1 rounded-md text-white/80 hover:text-white hover:bg-white/15 disabled:opacity-50"
                                                        onClick={() =>
                                                            removeButtonGroup(group.id)
                                                        }
                                                        aria-label="그룹 삭제"
                                                    >
                                                        <IconClose className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap gap-1.5">
                                                {group.buttons.map((button) => (
                                                    <Chip
                                                        key={button.id}
                                                        color={ownDepthColor}
                                                        variant="filled"
                                                        size="md"
                                                        className="pointer-events-none ring-1 ring-white/30"
                                                    >
                                                        {button.label}
                                                    </Chip>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                }

                                return (
                                    <div
                                        key={group.id}
                                        className="rounded-xl bg-gray-50 p-3 flex flex-col gap-3"
                                    >
                                        <div className="flex flex-col gap-2 w-full">
                                            <div className="flex items-center justify-between gap-2">
                                                <label className="text-sm font-medium text-gray-700">
                                                    그룹명
                                                </label>
                                                <button
                                                    type="button"
                                                    disabled={saving}
                                                    className="p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-200/80 disabled:opacity-50"
                                                    onClick={() =>
                                                        removeButtonGroup(group.id)
                                                    }
                                                    aria-label="그룹 삭제"
                                                >
                                                    <IconClose className="w-4 h-4" />
                                                </button>
                                            </div>
                                            <Input
                                                value={group.name}
                                                onChange={(name) =>
                                                    updateButtonGroup(group.id, { name })
                                                }
                                                placeholder="예: 상태, 검교정"
                                                disabled={saving}
                                            />
                                        </div>
                                        <Select
                                            label="선택 방식"
                                            value={group.selection}
                                            onChange={(value) =>
                                                updateButtonGroup(group.id, {
                                                    selection:
                                                        value as InventoryCategoryFormButtonSelection,
                                                })
                                            }
                                            options={[
                                                {
                                                    value: "single",
                                                    label: "한 개만 선택",
                                                },
                                                {
                                                    value: "multiple",
                                                    label: "중복 선택",
                                                },
                                            ]}
                                            fullWidth
                                            disabled={saving}
                                        />
                                        <Input
                                            label="버튼명"
                                            value={draftButtonLabels[group.id] ?? ""}
                                            onChange={(v) =>
                                                setDraftButtonLabels((current) => ({
                                                    ...current,
                                                    [group.id]: v,
                                                }))
                                            }
                                            placeholder="예: 정상, 점검필요"
                                            disabled={saving}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") {
                                                    e.preventDefault();
                                                    addButtonToGroup(group.id);
                                                }
                                            }}
                                        />
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="md"
                                            disabled={saving}
                                            icon={<IconPlus className="w-4 h-4" />}
                                            onClick={() => addButtonToGroup(group.id)}
                                            className="w-full"
                                        >
                                            버튼 추가
                                        </Button>
                                        {group.buttons.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5">
                                                {group.buttons.map((button) => (
                                                    <Chip
                                                        key={button.id}
                                                        color="gray-500"
                                                        variant="outline"
                                                        size="md"
                                                        onRemove={
                                                            saving
                                                                ? undefined
                                                                : () =>
                                                                      removeButtonFromGroup(
                                                                          group.id,
                                                                          button.id
                                                                      )
                                                        }
                                                    >
                                                        {button.label}
                                                    </Chip>
                                                ))}
                                            </div>
                                        )}
                                        <Button
                                            type="button"
                                            variant="primary"
                                            size="md"
                                            disabled={saving}
                                            onClick={() => commitButtonGroup(group.id)}
                                            className="w-full"
                                        >
                                            저장
                                        </Button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>

                <div className="border-t border-gray-200" aria-hidden />

                {/* 해시태그 */}
                <section className="flex flex-col gap-3">
                    <p className="text-sm font-semibold text-gray-900">해시태그</p>
                    <Input
                        value={draftHashtag}
                        onChange={setDraftHashtag}
                        placeholder="예: 전동, 정밀"
                        disabled={saving}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                e.preventDefault();
                                addHashtagAsChip();
                            }
                        }}
                    />
                    <Button
                        type="button"
                        variant="outline"
                        size="md"
                        disabled={saving}
                        icon={<IconPlus className="w-4 h-4" />}
                        onClick={addHashtagAsChip}
                        className="w-full"
                    >
                        추가
                    </Button>
                    {(inheritedHashtags.length > 0 || hashtags.length > 0) && (
                        <div className="flex flex-col gap-2">
                            {inheritedHashtags.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                    {inheritedHashtags.map((tag) => {
                                        const on = !disabledHashtagSet.has(tag.id);
                                        const depthColor = inventoryInheritedDepthColor(
                                            tag.sourceDepth
                                        );
                                        return (
                                            <Chip
                                                key={`inherited-tag-${tag.id}`}
                                                color={on ? depthColor : "gray-400"}
                                                variant={on ? "filled" : "outline"}
                                                size="md"
                                                className={`transition-all duration-150 ${
                                                    on
                                                        ? "hover:brightness-110 hover:shadow-sm"
                                                        : "hover:border-gray-500 hover:bg-gray-50"
                                                } ${saving ? "pointer-events-none opacity-60" : ""}`}
                                                onClick={
                                                    saving
                                                        ? undefined
                                                        : () =>
                                                              toggleInheritedHashtag(
                                                                  tag.id
                                                              )
                                                }
                                            >
                                                {tag.label}
                                            </Chip>
                                        );
                                    })}
                                </div>
                            )}
                            {hashtags.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                    {hashtags.map((tag) => (
                                        <Chip
                                            key={tag.id}
                                            color={ownDepthColor}
                                            variant="filled"
                                            size="md"
                                            onRemove={
                                                saving
                                                    ? undefined
                                                    : () => removeHashtag(tag.id)
                                            }
                                        >
                                            {tag.label}
                                        </Chip>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </section>
            </div>

            <div className="border-t border-gray-200 px-4 py-4 flex gap-2 justify-end">
                <Button
                    variant="outline"
                    size="lg"
                    disabled={saving}
                    onClick={onClose}
                >
                    닫기
                </Button>
                <Button
                    variant="primary"
                    size="lg"
                    loading={saving}
                    onClick={() => void handleSave()}
                >
                    저장
                </Button>
            </div>
        </aside>
    );
}
