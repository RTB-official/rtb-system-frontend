import { useMemo, useRef, type ReactNode } from "react";
import Button from "../../../components/common/Button";
import Input from "../../../components/common/Input";
import Select from "../../../components/common/Select";
import { IconPlus } from "../../../components/icons/Icons";
import {
    flattenInventoryCategories,
    flattenInventoryCategoryFormButtons,
    isInventoryQuantityFormField,
    resolveInventoryCategoryFormButtonGroups,
    resolveInventoryCategoryFormFields,
    type InventoryCategory,
    type InventoryCategoryFormButtonGroup,
    type InventoryCategoryFormField,
    type InventoryLocation,
} from "../../../lib/inventoryApi";

function normalizeCategoryText(value: string) {
    return value.trim().toLowerCase().replace(/\s+/g, "");
}

function scoreCategoryMatch(
    query: string,
    cat: { name: string; pathLabel: string; depth: number }
) {
    const q = normalizeCategoryText(query);
    if (!q) return 0;
    const name = normalizeCategoryText(cat.name);
    const path = normalizeCategoryText(cat.pathLabel);
    let score = 0;
    if (name === q) score = 100;
    else if (name.includes(q) || q.includes(name)) score = 80;
    else if (path.includes(q)) score = 55;

    const tokens = query
        .trim()
        .toLowerCase()
        .split(/[\s\-_/·,]+/)
        .filter((t) => t.length >= 2);
    for (const token of tokens) {
        const t = normalizeCategoryText(token);
        if (!t) continue;
        if (name === t) score = Math.max(score, 95);
        else if (name.includes(t) || t.includes(name)) score = Math.max(score, 75);
        else if (path.includes(t)) score = Math.max(score, 45);
    }

    // 구체적(깊은) 카테고리를 조금 더 우선
    if (score > 0) score += Math.min(cat.depth, 6);
    return score;
}

type FlatCategory = InventoryCategory & { depth: number; pathLabel: string };

type MiniOrgNode = {
    id: string;
    name: string;
    selectable: boolean;
    children: MiniOrgNode[];
};

const MINI_ORG_CARD_HEIGHT = 34;
const MINI_ORG_GUTTER = 14;
const MINI_ORG_ELBOW = MINI_ORG_CARD_HEIGHT / 2;
/** 한눈에 보이도록 표시 단수 상한 (말단 포함) */
const MINI_ORG_MAX_LEVELS = 3;

function miniOrgTreeDepth(node: MiniOrgNode): number {
    if (node.children.length === 0) return 1;
    return 1 + Math.max(...node.children.map(miniOrgTreeDepth));
}

/** 상단부터 잘라 최대 단수 이하로 */
function trimMiniOrgFromTop(node: MiniOrgNode, maxLevels: number): MiniOrgNode[] {
    if (miniOrgTreeDepth(node) <= maxLevels) return [node];
    if (node.children.length === 0) return [node];
    return node.children.flatMap((child) => trimMiniOrgFromTop(child, maxLevels));
}

/**
 * 가로 스크롤을 줄이기 위해 공통 1단계 생략 + 최대 3단으로 압축
 */
function compressMiniOrgForest(forest: MiniOrgNode[]): MiniOrgNode[] {
    if (forest.length === 0) return [];
    let next = forest;
    // 단일 루트(공통 상위)는 1단계 생략
    if (next.length === 1 && next[0].children.length > 0) {
        next = next[0].children;
    }
    return next.flatMap((node) => trimMiniOrgFromTop(node, MINI_ORG_MAX_LEVELS));
}

/** 제안된 말단 + 조상만으로 미니 조직도 트리 구성 */
function buildMiniOrgForest(
    flatCategories: FlatCategory[],
    leafIds: string[]
): MiniOrgNode[] {
    if (leafIds.length === 0) return [];
    const byId = new Map(flatCategories.map((c) => [c.id, c]));
    const leafSet = new Set(leafIds);
    const keep = new Set<string>();
    for (const id of leafIds) {
        let cur: string | null | undefined = id;
        while (cur) {
            keep.add(cur);
            cur = byId.get(cur)?.parentId ?? null;
        }
    }

    const children = new Map<string | null, FlatCategory[]>();
    for (const cat of flatCategories) {
        if (!keep.has(cat.id)) continue;
        const parentInKeep =
            cat.parentId && keep.has(cat.parentId) ? cat.parentId : null;
        const list = children.get(parentInKeep) ?? [];
        list.push(cat);
        children.set(parentInKeep, list);
    }
    for (const list of children.values()) {
        list.sort(
            (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "ko")
        );
    }

    const walk = (parentId: string | null): MiniOrgNode[] =>
        (children.get(parentId) ?? []).map((cat) => ({
            id: cat.id,
            name: cat.name,
            selectable: leafSet.has(cat.id),
            children: walk(cat.id),
        }));

    return compressMiniOrgForest(walk(null));
}

function MiniOrgBranchRow({
    isFirst,
    isLast,
    showSpine,
    children,
}: {
    isFirst: boolean;
    isLast: boolean;
    showSpine: boolean;
    children: ReactNode;
}) {
    return (
        <div className={`relative ${isLast ? "" : "pb-2"}`}>
            <div
                className="absolute left-0 top-0 bottom-0 pointer-events-none"
                style={{ width: MINI_ORG_GUTTER }}
                aria-hidden
            >
                {showSpine &&
                    (isFirst && isLast ? null : isFirst ? (
                        <div
                            className="absolute left-0 w-px bg-gray-300"
                            style={{ top: MINI_ORG_ELBOW, bottom: 0 }}
                        />
                    ) : isLast ? (
                        <div
                            className="absolute left-0 top-0 w-px bg-gray-300"
                            style={{ height: MINI_ORG_ELBOW }}
                        />
                    ) : (
                        <div className="absolute left-0 top-0 bottom-0 w-px bg-gray-300" />
                    ))}
                <div
                    className="absolute left-0 right-0 h-px bg-gray-300"
                    style={{ top: MINI_ORG_ELBOW }}
                />
            </div>
            <div className="min-w-0" style={{ paddingLeft: MINI_ORG_GUTTER }}>
                {children}
            </div>
        </div>
    );
}

function MiniOrgNodeView({
    node,
    selectedId,
    disabled,
    onSelect,
}: {
    node: MiniOrgNode;
    selectedId: string;
    disabled: boolean;
    onSelect: (id: string) => void;
}) {
    const isSelected = selectedId === node.id;
    const hasChildren = node.children.length > 0;

    return (
        <div className="flex items-start">
            <div className="relative shrink-0">
                <button
                    type="button"
                    disabled={disabled || !node.selectable}
                    title={node.name}
                    onClick={() => {
                        if (!node.selectable || disabled) return;
                        onSelect(isSelected ? "" : node.id);
                    }}
                    style={{ height: MINI_ORG_CARD_HEIGHT }}
                    className={`rounded-lg border px-2 min-w-[72px] max-w-[104px] text-center flex items-center justify-center transition-all duration-150 ${
                        node.selectable
                            ? isSelected
                                ? "border-gray-900 bg-gray-900 text-white shadow-sm cursor-pointer"
                                : "border-gray-200 bg-white text-gray-900 hover:border-gray-400 hover:bg-gray-50 cursor-pointer"
                            : "border-transparent bg-white/70 text-gray-500 cursor-default"
                    } disabled:opacity-50`}
                >
                    <span className="font-medium text-[11px] leading-tight truncate w-full">
                        {node.name}
                    </span>
                </button>
                {hasChildren && (
                    <div
                        className="absolute left-full h-px bg-gray-300 pointer-events-none"
                        style={{ top: MINI_ORG_ELBOW, width: MINI_ORG_GUTTER }}
                        aria-hidden
                    />
                )}
            </div>
            {hasChildren && (
                <div
                    className="flex flex-col"
                    style={{ marginLeft: MINI_ORG_GUTTER }}
                >
                    {node.children.map((child, index) => (
                        <MiniOrgBranchRow
                            key={child.id}
                            isFirst={index === 0}
                            isLast={index === node.children.length - 1}
                            showSpine={node.children.length > 1}
                        >
                            <MiniOrgNodeView
                                node={child}
                                selectedId={selectedId}
                                disabled={disabled}
                                onSelect={onSelect}
                            />
                        </MiniOrgBranchRow>
                    ))}
                </div>
            )}
        </div>
    );
}

export type InventoryItemStockDraft = {
    key: string;
    id?: string;
    locationId: string;
    slotCode: string;
    quantity: string;
};

export type InventoryItemFormValues = {
    name: string;
    spec: string;
    categoryId: string;
    unit: string;
    minQuantity: string;
    note: string;
    /** 카테고리 formFields 입력값 */
    fieldValues: Record<string, string>;
    /** 선택된 카테고리 버튼 id 목록 */
    activeButtonIds: string[];
    stocks: InventoryItemStockDraft[];
    newPhotos: File[];
    newPreviews: string[];
    existingPhotos: Array<{ id: string; url: string }>;
    removePhotoIds: string[];
};

export function createEmptyInventoryItemFormValues(): InventoryItemFormValues {
    return {
        name: "",
        spec: "",
        categoryId: "",
        unit: "EA",
        minQuantity: "0",
        note: "",
        fieldValues: {},
        activeButtonIds: [],
        stocks: [
            {
                key: `new-${Date.now()}`,
                locationId: "",
                slotCode: "",
                quantity: "1",
            },
        ],
        newPhotos: [],
        newPreviews: [],
        existingPhotos: [],
        removePhotoIds: [],
    };
}

interface InventoryItemFormProps {
    values: InventoryItemFormValues;
    onChange: (next: InventoryItemFormValues) => void;
    categories: InventoryCategory[];
    locations: InventoryLocation[];
    disabled?: boolean;
}

export default function InventoryItemForm({
    values,
    onChange,
    categories,
    locations,
    disabled = false,
}: InventoryItemFormProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const flatCategories = flattenInventoryCategories(categories);
    const visibleExisting = values.existingPhotos.filter(
        (p) => !values.removePhotoIds.includes(p.id)
    );
    const selectedCategory = flatCategories.find((c) => c.id === values.categoryId) ?? null;
    // 4단계+ 조상 설정 상속 + 기본 수량·EA
    const categoryFields = resolveInventoryCategoryFormFields(
        selectedCategory,
        categories
    );
    const categoryButtonGroups = resolveInventoryCategoryFormButtonGroups(
        selectedCategory,
        categories
    );
    const quantityField =
        categoryFields.find(isInventoryQuantityFormField) ?? null;

    const suggestedOrgForest = useMemo(() => {
        const query = values.name.trim();
        if (query.length < 1) return [];
        // 말단(하위 없는) 카테고리만 제안
        const parentIds = new Set(
            flatCategories.map((c) => c.parentId).filter((id): id is string => !!id)
        );
        const leaves = flatCategories
            .filter((cat) => !parentIds.has(cat.id))
            .map((cat) => ({ cat, score: scoreCategoryMatch(query, cat) }))
            .filter((row) => row.score > 0)
            .sort(
                (a, b) =>
                    b.score - a.score ||
                    b.cat.depth - a.cat.depth ||
                    a.cat.pathLabel.localeCompare(b.cat.pathLabel, "ko")
            )
            .slice(0, 16)
            .map((row) => row.cat);
        return buildMiniOrgForest(
            flatCategories,
            leaves.map((c) => c.id)
        );
    }, [flatCategories, values.name]);

    const patch = (partial: Partial<InventoryItemFormValues>) => {
        onChange({ ...values, ...partial });
    };

    const applyCategoryId = (categoryId: string) => {
        if (!categoryId) {
            patch({
                categoryId: "",
                fieldValues: {},
                activeButtonIds: [],
            });
            return;
        }
        const cat = flatCategories.find((c) => c.id === categoryId) ?? null;
        const fields = resolveInventoryCategoryFormFields(cat, categories);
        const groups = resolveInventoryCategoryFormButtonGroups(cat, categories);
        const qty = fields.find(isInventoryQuantityFormField);
        const nextValues: Record<string, string> = {};
        for (const field of fields) {
            if (isInventoryQuantityFormField(field)) {
                nextValues[field.id] =
                    values.fieldValues[field.id] ??
                    values.stocks[0]?.quantity ??
                    "1";
                continue;
            }
            nextValues[field.id] = values.fieldValues[field.id] ?? "";
        }
        const nextUnit = qty?.unit?.trim() || values.unit || "EA";
        const nextStocks =
            values.stocks.length > 0
                ? values.stocks.map((s, i) =>
                      i === 0
                          ? {
                                ...s,
                                quantity:
                                    nextValues[qty?.id ?? ""] || s.quantity || "1",
                            }
                          : s
                  )
                : values.stocks;
        patch({
            categoryId,
            unit: nextUnit,
            fieldValues: nextValues,
            stocks: nextStocks,
            activeButtonIds: values.activeButtonIds.filter((id) =>
                flattenInventoryCategoryFormButtons(groups).some((b) => b.id === id)
            ),
        });
    };

    const setFieldValue = (field: InventoryCategoryFormField, value: string) => {
        const nextFieldValues = { ...values.fieldValues, [field.id]: value };
        if (isInventoryQuantityFormField(field)) {
            const nextStocks =
                values.stocks.length > 0
                    ? values.stocks.map((s, i) =>
                          i === 0 ? { ...s, quantity: value } : s
                      )
                    : [
                          {
                              key: `new-${Date.now()}`,
                              locationId: "",
                              slotCode: "",
                              quantity: value || "0",
                          },
                      ];
            patch({
                fieldValues: nextFieldValues,
                stocks: nextStocks,
                unit: field.unit.trim() || values.unit || "EA",
            });
            return;
        }
        patch({ fieldValues: nextFieldValues });
    };

    const toggleGroupButton = (
        group: InventoryCategoryFormButtonGroup,
        buttonId: string
    ) => {
        const active = values.activeButtonIds.includes(buttonId);
        const groupButtonIds = new Set(group.buttons.map((b) => b.id));
        if (group.selection === "single") {
            const withoutGroup = values.activeButtonIds.filter(
                (id) => !groupButtonIds.has(id)
            );
            patch({
                activeButtonIds: active
                    ? withoutGroup
                    : [...withoutGroup, buttonId],
            });
            return;
        }
        patch({
            activeButtonIds: active
                ? values.activeButtonIds.filter((id) => id !== buttonId)
                : [...values.activeButtonIds, buttonId],
        });
    };

    const updateStock = (index: number, partial: Partial<InventoryItemStockDraft>) => {
        const nextStocks = values.stocks.map((s, i) =>
            i === index ? { ...s, ...partial } : s
        );
        const nextFieldValues = { ...values.fieldValues };
        if (index === 0 && partial.quantity != null && quantityField) {
            nextFieldValues[quantityField.id] = partial.quantity;
        }
        patch({ stocks: nextStocks, fieldValues: nextFieldValues });
    };

    const addStock = () => {
        patch({
            stocks: [
                ...values.stocks,
                {
                    key: `new-${Date.now()}`,
                    locationId: "",
                    slotCode: "",
                    quantity: "0",
                },
            ],
        });
    };

    const removeStock = (index: number) => {
        if (values.stocks.length <= 1) return;
        patch({ stocks: values.stocks.filter((_, i) => i !== index) });
    };

    const handleFiles = (fileList: FileList | null) => {
        if (!fileList || fileList.length === 0) return;
        const files = Array.from(fileList);
        patch({
            newPhotos: [...values.newPhotos, ...files],
            newPreviews: [
                ...values.newPreviews,
                ...files.map((f) => URL.createObjectURL(f)),
            ],
        });
    };

    const removeNewPhoto = (index: number) => {
        URL.revokeObjectURL(values.newPreviews[index]);
        patch({
            newPhotos: values.newPhotos.filter((_, i) => i !== index),
            newPreviews: values.newPreviews.filter((_, i) => i !== index),
        });
    };

    return (
        <div className="flex flex-col gap-3">
            <Input
                label="자재명"
                required
                value={values.name}
                onChange={(name) => patch({ name })}
                placeholder="자재명"
                disabled={disabled}
            />
            <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                    <p className="text-sm font-medium text-gray-700">카테고리</p>
                    {selectedCategory && (
                        <button
                            type="button"
                            disabled={disabled}
                            className="text-xs text-gray-400 hover:text-gray-700 disabled:opacity-50"
                            onClick={() => applyCategoryId("")}
                        >
                            선택 해제
                        </button>
                    )}
                </div>
                <div
                    className={`min-h-[88px] rounded-xl bg-gray-50 px-3 py-3 overflow-hidden ${
                        disabled ? "opacity-70" : ""
                    }`}
                >
                    {selectedCategory && (
                        <p className="mb-2 text-xs text-gray-500 truncate" title={selectedCategory.pathLabel}>
                            선택:{" "}
                            <span className="font-medium text-gray-800">
                                {selectedCategory.pathLabel}
                            </span>
                        </p>
                    )}

                    {!values.name.trim() ? (
                        <p className="text-sm text-gray-400 py-2">
                            자재명을 입력하면 관련 카테고리 조직도가 표시됩니다.
                        </p>
                    ) : suggestedOrgForest.length === 0 ? (
                        <p className="text-sm text-gray-400 py-2">
                            관련 카테고리가 없습니다.
                        </p>
                    ) : (
                        <div className="flex flex-col gap-2 py-0.5">
                            {suggestedOrgForest.map((root) => (
                                <MiniOrgNodeView
                                    key={root.id}
                                    node={root}
                                    selectedId={values.categoryId}
                                    disabled={disabled}
                                    onSelect={applyCategoryId}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {selectedCategory &&
                (categoryFields.length > 0 || categoryButtonGroups.length > 0) && (
                <div className="flex flex-col gap-3">
                    {categoryFields.length > 0 && (
                        <div className="flex flex-col gap-3">
                            <p className="text-sm font-medium text-gray-700">입력란</p>
                            {categoryFields.map((field) => {
                                const isQty = isInventoryQuantityFormField(field);
                                const fieldValue = isQty
                                    ? values.fieldValues[field.id] ??
                                      values.stocks[0]?.quantity ??
                                      ""
                                    : values.fieldValues[field.id] ?? "";
                                return (
                                    <div
                                        key={field.id}
                                        className="grid grid-cols-[1fr_minmax(4.5rem,6rem)] gap-2 items-end"
                                    >
                                        <Input
                                            label={field.label}
                                            value={fieldValue}
                                            onChange={(v) => setFieldValue(field, v)}
                                            placeholder={field.label}
                                            disabled={disabled}
                                        />
                                        <Input
                                            label="단위"
                                            value={
                                                isQty
                                                    ? values.unit || field.unit || "EA"
                                                    : field.unit
                                            }
                                            onChange={(unit) => {
                                                if (isQty) patch({ unit });
                                            }}
                                            disabled={disabled || !isQty}
                                            placeholder="단위"
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    {categoryButtonGroups.map((group) =>
                        group.buttons.length === 0 ? null : (
                            <div key={group.id} className="flex flex-col gap-2">
                                <p className="text-sm font-medium text-gray-700">
                                    {group.name || "버튼"}
                                    <span className="ml-1.5 text-xs font-normal text-gray-400">
                                        {group.selection === "single"
                                            ? "한 개만"
                                            : "중복 가능"}
                                    </span>
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {group.buttons.map((btn) => {
                                        const active =
                                            values.activeButtonIds.includes(btn.id);
                                        return (
                                            <Button
                                                key={btn.id}
                                                type="button"
                                                variant={active ? "primary" : "outline"}
                                                size="sm"
                                                disabled={disabled}
                                                onClick={() =>
                                                    toggleGroupButton(group, btn.id)
                                                }
                                            >
                                                {btn.label}
                                            </Button>
                                        );
                                    })}
                                </div>
                            </div>
                        )
                    )}
                </div>
            )}

            <div>
                <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-gray-700">
                        보관 위치
                        {quantityField?.unit || values.unit
                            ? ` · 수량(${quantityField?.unit || values.unit})`
                            : ""}
                    </p>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={disabled}
                        icon={<IconPlus className="w-4 h-4" />}
                        onClick={addStock}
                    >
                        위치 추가
                    </Button>
                </div>
                <div className="flex flex-col gap-3">
                    {values.stocks.map((stock, index) => (
                        <div
                            key={stock.key}
                            className="rounded-xl border border-gray-200 p-3 flex flex-col gap-2"
                        >
                            <Select
                                label="위치"
                                placeholder="미지정"
                                value={stock.locationId}
                                onChange={(locationId) => updateStock(index, { locationId })}
                                options={locations.map((l) => ({
                                    value: l.id,
                                    label: l.name,
                                }))}
                                fullWidth
                                disabled={disabled}
                            />
                            <div className="grid grid-cols-2 gap-2">
                                <Input
                                    label="칸 번호"
                                    value={stock.slotCode}
                                    onChange={(slotCode) => updateStock(index, { slotCode })}
                                    placeholder="예: A-01-03"
                                    disabled={disabled}
                                />
                                <Input
                                    label="수량"
                                    value={stock.quantity}
                                    onChange={(quantity) => updateStock(index, { quantity })}
                                    disabled={disabled}
                                />
                            </div>
                            {values.stocks.length > 1 && (
                                <button
                                    type="button"
                                    className="text-xs text-red-500 self-end disabled:opacity-50"
                                    disabled={disabled}
                                    onClick={() => removeStock(index)}
                                >
                                    이 위치 삭제
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            <div>
                <p className="text-sm font-medium text-gray-700 mb-2">사진</p>
                <div className="flex flex-wrap gap-2 mb-2">
                    {visibleExisting.map((photo) => (
                        <div key={photo.id} className="relative h-16 w-16">
                            <img
                                src={photo.url}
                                alt=""
                                className="h-16 w-16 rounded-lg object-cover border border-gray-200"
                            />
                            <button
                                type="button"
                                disabled={disabled}
                                className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-gray-900 text-white text-xs disabled:opacity-50"
                                onClick={() =>
                                    patch({
                                        removePhotoIds: [...values.removePhotoIds, photo.id],
                                    })
                                }
                            >
                                ×
                            </button>
                        </div>
                    ))}
                    {values.newPreviews.map((url, index) => (
                        <div key={url} className="relative h-16 w-16">
                            <img
                                src={url}
                                alt=""
                                className="h-16 w-16 rounded-lg object-cover border border-gray-200"
                            />
                            <button
                                type="button"
                                disabled={disabled}
                                className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-gray-900 text-white text-xs disabled:opacity-50"
                                onClick={() => removeNewPhoto(index)}
                            >
                                ×
                            </button>
                        </div>
                    ))}
                </div>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                        handleFiles(e.target.files);
                        e.target.value = "";
                    }}
                />
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={disabled}
                    onClick={() => fileInputRef.current?.click()}
                >
                    + 사진 추가
                </Button>
            </div>

            <div className="flex flex-col gap-2">
                <label className="font-medium text-[14px] text-[#101828]">비고</label>
                <textarea
                    value={values.note}
                    onChange={(e) => patch({ note: e.target.value })}
                    placeholder="메모"
                    rows={3}
                    disabled={disabled}
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-base text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-y disabled:bg-gray-50"
                />
            </div>
        </div>
    );
}
