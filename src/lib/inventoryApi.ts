import { supabase } from "./supabase";
import { compressReceiptImage } from "./workLogApi";

const PHOTO_BUCKET = "inventory-item-photos";

export type InventoryLocationKind = "zone" | "shelf" | "other";
export type InventoryItemStatus = "normal" | "low" | "unlocated";

export interface InventoryCategoryFormField {
    id: string;
    label: string;
    unit: string;
}

export interface InventoryCategoryFormButton {
    id: string;
    label: string;
}

/** 그룹 내 버튼 선택 방식: single=한 개만 on, multiple=중복 선택 */
export type InventoryCategoryFormButtonSelection = "single" | "multiple";

export interface InventoryCategoryFormButtonGroup {
    id: string;
    name: string;
    selection: InventoryCategoryFormButtonSelection;
    buttons: InventoryCategoryFormButton[];
}

export interface InventoryCategoryFormHashtag {
    id: string;
    label: string;
}

export interface InventoryCategory {
    id: string;
    parentId: string | null;
    name: string;
    sortOrder: number;
    isActive: boolean;
    /** 말단 카테고리 자재 입력란 정의 (metadata.formFields) */
    formFields: InventoryCategoryFormField[];
    /** 말단 카테고리 버튼 그룹 (metadata.formButtonGroups) */
    formButtonGroups: InventoryCategoryFormButtonGroup[];
    /** 말단 카테고리 해시태그 정의 (metadata.formHashtags) */
    formHashtags: InventoryCategoryFormHashtag[];
    /** 상위 상속 입력란 중 off 한 id (metadata.disabledInheritedFieldIds) */
    disabledInheritedFieldIds: string[];
    /** 상위 상속 버튼 그룹 중 off 한 id */
    disabledInheritedButtonGroupIds: string[];
    /** 상위 상속 해시태그 중 off 한 id */
    disabledInheritedHashtagIds: string[];
}

export function flattenInventoryCategoryFormButtons(
    groups: InventoryCategoryFormButtonGroup[]
): InventoryCategoryFormButton[] {
    return groups.flatMap((g) => g.buttons);
}

function parseCategoryFormFields(metadata: unknown): InventoryCategoryFormField[] {
    if (!metadata || typeof metadata !== "object") return [];
    const raw = (metadata as { formFields?: unknown }).formFields;
    if (!Array.isArray(raw)) return [];
    return raw
        .map((row, index) => {
            if (!row || typeof row !== "object") return null;
            const item = row as { id?: unknown; label?: unknown; unit?: unknown };
            const label = typeof item.label === "string" ? item.label.trim() : "";
            if (!label) return null;
            return {
                id:
                    typeof item.id === "string" && item.id
                        ? item.id
                        : `field-${index}`,
                label,
                unit: typeof item.unit === "string" ? item.unit.trim() : "",
            };
        })
        .filter((row): row is InventoryCategoryFormField => row != null);
}

function parseLegacyFlatFormButtons(raw: unknown): InventoryCategoryFormButton[] {
    if (!Array.isArray(raw)) return [];
    return raw
        .map((row, index) => {
            if (!row || typeof row !== "object") return null;
            const item = row as { id?: unknown; label?: unknown };
            const label = typeof item.label === "string" ? item.label.trim() : "";
            if (!label) return null;
            return {
                id:
                    typeof item.id === "string" && item.id
                        ? item.id
                        : `button-${index}`,
                label,
            };
        })
        .filter((row): row is InventoryCategoryFormButton => row != null);
}

function parseCategoryFormButtonGroups(
    metadata: unknown
): InventoryCategoryFormButtonGroup[] {
    if (!metadata || typeof metadata !== "object") return [];
    const meta = metadata as {
        formButtonGroups?: unknown;
        formButtons?: unknown;
    };

    if (Array.isArray(meta.formButtonGroups)) {
        return meta.formButtonGroups
            .map((row, index) => {
                if (!row || typeof row !== "object") return null;
                const item = row as {
                    id?: unknown;
                    name?: unknown;
                    selection?: unknown;
                    buttons?: unknown;
                };
                const name =
                    typeof item.name === "string" ? item.name.trim() : "";
                const buttons = parseLegacyFlatFormButtons(item.buttons);
                const selection: InventoryCategoryFormButtonSelection =
                    item.selection === "single" ? "single" : "multiple";
                // 이름·버튼 모두 비어 있으면 스킵
                if (!name && buttons.length === 0) return null;
                return {
                    id:
                        typeof item.id === "string" && item.id
                            ? item.id
                            : `button-group-${index}`,
                    name: name || `그룹 ${index + 1}`,
                    selection,
                    buttons,
                };
            })
            .filter((row): row is InventoryCategoryFormButtonGroup => row != null);
    }

    // 구버전 flat formButtons → 단일 그룹으로 승격
    const legacy = parseLegacyFlatFormButtons(meta.formButtons);
    if (legacy.length === 0) return [];
    return [
        {
            id: "legacy-button-group",
            name: "버튼",
            selection: "multiple",
            buttons: legacy,
        },
    ];
}

function normalizeHashtagLabel(value: string) {
    const trimmed = value.trim().replace(/^#+/, "").trim();
    return trimmed ? `#${trimmed}` : "";
}

function parseIdList(raw: unknown): string[] {
    if (!Array.isArray(raw)) return [];
    return raw.filter((id): id is string => typeof id === "string" && !!id);
}

function parseDisabledInheritedFieldIds(metadata: unknown): string[] {
    if (!metadata || typeof metadata !== "object") return [];
    return parseIdList((metadata as { disabledInheritedFieldIds?: unknown }).disabledInheritedFieldIds);
}

function parseDisabledInheritedButtonGroupIds(metadata: unknown): string[] {
    if (!metadata || typeof metadata !== "object") return [];
    return parseIdList(
        (metadata as { disabledInheritedButtonGroupIds?: unknown })
            .disabledInheritedButtonGroupIds
    );
}

function parseDisabledInheritedHashtagIds(metadata: unknown): string[] {
    if (!metadata || typeof metadata !== "object") return [];
    return parseIdList(
        (metadata as { disabledInheritedHashtagIds?: unknown }).disabledInheritedHashtagIds
    );
}

function parseCategoryFormHashtags(metadata: unknown): InventoryCategoryFormHashtag[] {
    if (!metadata || typeof metadata !== "object") return [];
    const raw = (metadata as { formHashtags?: unknown }).formHashtags;
    if (!Array.isArray(raw)) return [];
    return raw
        .map((row, index) => {
            if (!row || typeof row !== "object") return null;
            const item = row as { id?: unknown; label?: unknown };
            const label =
                typeof item.label === "string" ? normalizeHashtagLabel(item.label) : "";
            if (!label) return null;
            return {
                id:
                    typeof item.id === "string" && item.id
                        ? item.id
                        : `hashtag-${index}`,
                label,
            };
        })
        .filter((row): row is InventoryCategoryFormHashtag => row != null);
}

/** 카테고리 깊이: 1=루트(공구/자재 등), 공구 하위 4단계 포함 최대 5 */
export const INVENTORY_CATEGORY_MAX_DEPTH = 6;

/** 입력란·버튼 설정 패널/상속이 시작되는 깊이 (4단계~) */
export const INVENTORY_FORM_CONFIG_MIN_DEPTH = 4;

export function getInventoryCategoryDepth(
    categories: InventoryCategory[],
    categoryId: string | null | undefined
): number {
    if (!categoryId) return 0;
    const byId = new Map(categories.map((c) => [c.id, c]));
    let depth = 0;
    let current: string | null | undefined = categoryId;
    const seen = new Set<string>();
    while (current) {
        if (seen.has(current)) break;
        seen.add(current);
        depth += 1;
        current = byId.get(current)?.parentId ?? null;
        if (depth > INVENTORY_CATEGORY_MAX_DEPTH + 2) break;
    }
    return depth;
}

export function getInventoryCategoryPathLabel(
    categories: InventoryCategory[],
    categoryId: string | null | undefined
): string {
    if (!categoryId) return "";
    const byId = new Map(categories.map((c) => [c.id, c]));
    const parts: string[] = [];
    let current: string | null | undefined = categoryId;
    const seen = new Set<string>();
    while (current) {
        if (seen.has(current)) break;
        seen.add(current);
        const node = byId.get(current);
        if (!node) break;
        parts.unshift(node.name);
        current = node.parentId;
    }
    return parts.join(" › ");
}

/** 선택 카테고리 + 하위 전체 id */
export function getInventoryCategoryDescendantIds(
    categories: InventoryCategory[],
    categoryId: string
): string[] {
    const children = new Map<string | null, InventoryCategory[]>();
    for (const c of categories) {
        const key = c.parentId;
        const list = children.get(key) ?? [];
        list.push(c);
        children.set(key, list);
    }
    const result: string[] = [categoryId];
    const stack = [categoryId];
    while (stack.length > 0) {
        const id = stack.pop()!;
        for (const child of children.get(id) ?? []) {
            result.push(child.id);
            stack.push(child.id);
        }
    }
    return result;
}

/** 트리 순서로 flat 목록 (들여쓰기용 depth 포함) */
export function flattenInventoryCategories(
    categories: InventoryCategory[]
): Array<InventoryCategory & { depth: number; pathLabel: string }> {
    const children = new Map<string | null, InventoryCategory[]>();
    for (const c of categories) {
        const key = c.parentId;
        const list = children.get(key) ?? [];
        list.push(c);
        children.set(key, list);
    }
    for (const list of children.values()) {
        list.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "ko"));
    }
    const out: Array<InventoryCategory & { depth: number; pathLabel: string }> = [];
    const walk = (parentId: string | null, depth: number, prefix: string[]) => {
        for (const node of children.get(parentId) ?? []) {
            const path = [...prefix, node.name];
            out.push({
                ...node,
                depth,
                pathLabel: path.join(" › "),
            });
            if (depth < INVENTORY_CATEGORY_MAX_DEPTH) {
                walk(node.id, depth + 1, path);
            }
        }
    };
    walk(null, 1, []);
    return out;
}

export interface InventoryLocation {
    id: string;
    parentId: string | null;
    name: string;
    kind: InventoryLocationKind;
    sortOrder: number;
}

export interface InventoryPhoto {
    id: string;
    storagePath: string;
    fileName: string;
    contentType: string;
    sortOrder: number;
    url: string;
}

export interface InventoryStock {
    id: string;
    locationId: string | null;
    locationName: string | null;
    slotCode: string;
    quantity: number;
}

export interface InventoryItemFormData {
    /** 카테고리 formFields 입력값 (fieldId → value) */
    fieldValues: Record<string, string>;
    /** 선택된 카테고리 버튼 id 목록 */
    activeButtonIds: string[];
}

export interface InventoryItemListRow {
    id: string;
    name: string;
    spec: string;
    categoryId: string | null;
    categoryName: string | null;
    unit: string;
    minQuantity: number;
    note: string;
    createdBy: string | null;
    updatedAt: string;
    updatedAtLabel: string;
    totalQuantity: number;
    hasUnlocated: boolean;
    primaryLocationLabel: string;
    status: InventoryItemStatus;
    thumbUrl: string | null;
    stocks: InventoryStock[];
    formData: InventoryItemFormData;
}

export interface InventoryItemDetail extends InventoryItemListRow {
    photos: InventoryPhoto[];
}

export function parseInventoryItemFormData(metadata: unknown): InventoryItemFormData {
    if (!metadata || typeof metadata !== "object") {
        return { fieldValues: {}, activeButtonIds: [] };
    }
    const raw = metadata as {
        fieldValues?: unknown;
        activeButtonIds?: unknown;
    };
    const fieldValues: Record<string, string> = {};
    if (raw.fieldValues && typeof raw.fieldValues === "object" && !Array.isArray(raw.fieldValues)) {
        for (const [key, value] of Object.entries(raw.fieldValues as Record<string, unknown>)) {
            if (typeof value === "string") fieldValues[key] = value;
            else if (value != null) fieldValues[key] = String(value);
        }
    }
    const activeButtonIds = Array.isArray(raw.activeButtonIds)
        ? raw.activeButtonIds.filter((id): id is string => typeof id === "string" && !!id)
        : [];
    return { fieldValues, activeButtonIds };
}

export const INVENTORY_DEFAULT_QUANTITY_FIELD: InventoryCategoryFormField = {
    id: "default-quantity",
    label: "수량",
    unit: "EA",
};

export function isInventoryQuantityFormField(field: InventoryCategoryFormField) {
    return (
        field.id === INVENTORY_DEFAULT_QUANTITY_FIELD.id ||
        field.label.trim() === "수량"
    );
}

/** 카테고리 상세와 동일하게 기본 수량·EA 입력란을 포함 */
export function withInventoryDefaultQuantityField(
    fields: InventoryCategoryFormField[]
): InventoryCategoryFormField[] {
    if (fields.length === 0) return [{ ...INVENTORY_DEFAULT_QUANTITY_FIELD }];
    const hasQuantity = fields.some(isInventoryQuantityFormField);
    if (hasQuantity) return fields.map((f) => ({ ...f }));
    return [{ ...INVENTORY_DEFAULT_QUANTITY_FIELD }, ...fields.map((f) => ({ ...f }))];
}

/** 루트→자신 순 조상 체인 */
export function getInventoryCategoryAncestorChain(
    categories: InventoryCategory[],
    categoryId: string
): InventoryCategory[] {
    const byId = new Map(categories.map((c) => [c.id, c]));
    const chain: InventoryCategory[] = [];
    let current: string | null | undefined = categoryId;
    const seen = new Set<string>();
    while (current) {
        if (seen.has(current)) break;
        seen.add(current);
        const node = byId.get(current);
        if (!node) break;
        chain.unshift(node);
        current = node.parentId;
    }
    return chain;
}

/** 4단계 이상 조상+자신의 설정만 (얕은→깊은) */
function getFormConfigContributors(
    categories: InventoryCategory[],
    categoryId: string
): InventoryCategory[] {
    return getInventoryCategoryAncestorChain(categories, categoryId).filter(
        (c) => getInventoryCategoryDepth(categories, c.id) >= INVENTORY_FORM_CONFIG_MIN_DEPTH
    );
}

export type InventoryInheritedFormField = InventoryCategoryFormField & {
    sourceDepth: number;
    sourceName: string;
};

export type InventoryInheritedFormButtonGroup = InventoryCategoryFormButtonGroup & {
    sourceDepth: number;
    sourceName: string;
};

export type InventoryInheritedFormHashtag = InventoryCategoryFormHashtag & {
    sourceDepth: number;
    sourceName: string;
};

/** 상위 상속 칩 색 (4단계 / 5단계 / 그 외) */
export function inventoryInheritedDepthColor(depth: number): string {
    if (depth <= 4) return "orange-500";
    if (depth === 5) return "purple-500";
    return "green-700";
}

/** 자신 제외, 4단계+ 조상에서만 상속되는 입력란 (출처 깊이 포함) */
export function getInventoryInheritedFormFields(
    categories: InventoryCategory[],
    categoryId: string
): InventoryInheritedFormField[] {
    const ancestors = getFormConfigContributors(categories, categoryId).filter(
        (c) => c.id !== categoryId
    );
    const out: InventoryInheritedFormField[] = [];
    const indexByKey = new Map<string, number>();
    for (const ancestor of ancestors) {
        const sourceDepth = getInventoryCategoryDepth(categories, ancestor.id);
        for (const field of ancestor.formFields) {
            const labelKey = field.label.trim().toLowerCase();
            if (!labelKey) continue;
            const key = field.id || `label:${labelKey}`;
            const existing =
                indexByKey.get(key) ?? indexByKey.get(`label:${labelKey}`);
            const next: InventoryInheritedFormField = {
                ...field,
                sourceDepth,
                sourceName: ancestor.name,
            };
            if (existing != null) {
                out[existing] = next;
                indexByKey.set(key, existing);
                indexByKey.set(`label:${labelKey}`, existing);
                continue;
            }
            indexByKey.set(key, out.length);
            indexByKey.set(`label:${labelKey}`, out.length);
            out.push(next);
        }
    }
    return out;
}

/** 자신 제외, 4단계+ 조상에서만 상속되는 버튼 그룹 (출처 깊이 포함) */
export function getInventoryInheritedFormButtonGroups(
    categories: InventoryCategory[],
    categoryId: string
): InventoryInheritedFormButtonGroup[] {
    const ancestors = getFormConfigContributors(categories, categoryId).filter(
        (c) => c.id !== categoryId
    );
    const byId = new Map<string, InventoryInheritedFormButtonGroup>();
    const order: string[] = [];
    for (const ancestor of ancestors) {
        const sourceDepth = getInventoryCategoryDepth(categories, ancestor.id);
        for (const group of ancestor.formButtonGroups) {
            if (!byId.has(group.id)) order.push(group.id);
            byId.set(group.id, {
                ...group,
                buttons: group.buttons.map((b) => ({ ...b })),
                sourceDepth,
                sourceName: ancestor.name,
            });
        }
    }
    return order.map((id) => byId.get(id)!);
}

/** 자신 제외, 4단계+ 조상에서만 상속되는 해시태그 (출처 깊이 포함) */
export function getInventoryInheritedFormHashtags(
    categories: InventoryCategory[],
    categoryId: string
): InventoryInheritedFormHashtag[] {
    const ancestors = getFormConfigContributors(categories, categoryId).filter(
        (c) => c.id !== categoryId
    );
    const out: InventoryInheritedFormHashtag[] = [];
    const seen = new Set<string>();
    for (const ancestor of ancestors) {
        const sourceDepth = getInventoryCategoryDepth(categories, ancestor.id);
        for (const tag of ancestor.formHashtags) {
            const key = tag.label.trim().toLowerCase();
            if (!key) continue;
            if (seen.has(key)) {
                const idx = out.findIndex(
                    (t) => t.label.trim().toLowerCase() === key
                );
                if (idx >= 0) {
                    out[idx] = {
                        ...tag,
                        sourceDepth,
                        sourceName: ancestor.name,
                    };
                }
                continue;
            }
            seen.add(key);
            out.push({
                ...tag,
                sourceDepth,
                sourceName: ancestor.name,
            });
        }
    }
    return out;
}

function mergeInheritedFormFields(
    layers: InventoryCategoryFormField[][]
): InventoryCategoryFormField[] {
    const out: InventoryCategoryFormField[] = [];
    const indexByKey = new Map<string, number>();
    for (const fields of layers) {
        for (const field of fields) {
            const labelKey = field.label.trim().toLowerCase();
            const key = field.id || `label:${labelKey}`;
            const existing = indexByKey.get(key) ?? indexByKey.get(`label:${labelKey}`);
            if (existing != null) {
                out[existing] = { ...field };
                indexByKey.set(key, existing);
                indexByKey.set(`label:${labelKey}`, existing);
                continue;
            }
            indexByKey.set(key, out.length);
            indexByKey.set(`label:${labelKey}`, out.length);
            out.push({ ...field });
        }
    }
    return out;
}

function mergeInheritedButtonGroups(
    layers: InventoryCategoryFormButtonGroup[][]
): InventoryCategoryFormButtonGroup[] {
    const byId = new Map<string, InventoryCategoryFormButtonGroup>();
    const order: string[] = [];
    for (const groups of layers) {
        for (const group of groups) {
            if (!byId.has(group.id)) order.push(group.id);
            byId.set(group.id, {
                ...group,
                buttons: group.buttons.map((b) => ({ ...b })),
            });
        }
    }
    return order.map((id) => byId.get(id)!);
}

function mergeInheritedHashtags(
    layers: InventoryCategoryFormHashtag[][]
): InventoryCategoryFormHashtag[] {
    const out: InventoryCategoryFormHashtag[] = [];
    const seen = new Set<string>();
    for (const tags of layers) {
        for (const tag of tags) {
            const key = tag.label.trim().toLowerCase();
            if (!key || seen.has(key)) continue;
            seen.add(key);
            out.push({ ...tag });
        }
    }
    return out;
}

/**
 * 등록/상세용 입력란.
 * allCategories를 주면 4단계 이상 조상 설정을 하위로 상속·병합한다.
 */
export function resolveInventoryCategoryFormFields(
    category: InventoryCategory | null | undefined,
    allCategories?: InventoryCategory[]
): InventoryCategoryFormField[] {
    if (!category) return withInventoryDefaultQuantityField([]);
    if (!allCategories?.length) {
        return withInventoryDefaultQuantityField(category.formFields);
    }
    const disabled = new Set(category.disabledInheritedFieldIds);
    const ancestors = getFormConfigContributors(allCategories, category.id).filter(
        (c) => c.id !== category.id
    );
    const inherited = mergeInheritedFormFields(ancestors.map((c) => c.formFields)).filter(
        (f) => !disabled.has(f.id)
    );
    const merged = mergeInheritedFormFields([inherited, category.formFields]);
    return withInventoryDefaultQuantityField(merged);
}

/**
 * 등록/상세용 버튼 그룹.
 * allCategories를 주면 4단계 이상 조상 설정을 하위로 상속·병합한다.
 */
export function resolveInventoryCategoryFormButtonGroups(
    category: InventoryCategory | null | undefined,
    allCategories?: InventoryCategory[]
): InventoryCategoryFormButtonGroup[] {
    if (!category) return [];
    if (!allCategories?.length) {
        return category.formButtonGroups.map((g) => ({
            ...g,
            buttons: g.buttons.map((b) => ({ ...b })),
        }));
    }
    const disabled = new Set(category.disabledInheritedButtonGroupIds);
    const ancestors = getFormConfigContributors(allCategories, category.id).filter(
        (c) => c.id !== category.id
    );
    const inherited = mergeInheritedButtonGroups(
        ancestors.map((c) => c.formButtonGroups)
    ).filter((g) => !disabled.has(g.id));
    return mergeInheritedButtonGroups([inherited, category.formButtonGroups]);
}

/** 등록/상세용 해시태그 (4단계+ 상속) */
export function resolveInventoryCategoryFormHashtags(
    category: InventoryCategory | null | undefined,
    allCategories?: InventoryCategory[]
): InventoryCategoryFormHashtag[] {
    if (!category) return [];
    if (!allCategories?.length) {
        return category.formHashtags.map((h) => ({ ...h }));
    }
    const disabled = new Set(category.disabledInheritedHashtagIds);
    const ancestors = getFormConfigContributors(allCategories, category.id).filter(
        (c) => c.id !== category.id
    );
    const inherited = mergeInheritedHashtags(ancestors.map((c) => c.formHashtags)).filter(
        (h) => !disabled.has(h.id)
    );
    return mergeInheritedHashtags([inherited, category.formHashtags]);
}

export interface InventoryStats {
    totalItems: number;
    lowStockItems: number;
    unlocatedItems: number;
    categoryCount: number;
}

export interface InventoryListFilters {
    search?: string;
    categoryId?: string | null;
    locationId?: string | null;
    status?: InventoryItemStatus | "all" | null;
}

export interface CreateInventoryItemInput {
    name: string;
    spec?: string;
    categoryId?: string | null;
    unit?: string;
    minQuantity?: number;
    note?: string;
    formData?: InventoryItemFormData;
    /** 단일 재고(하위 호환). stocks가 있으면 무시 */
    quantity?: number;
    locationId?: string | null;
    slotCode?: string;
    stocks?: Array<{
        locationId: string | null;
        slotCode: string;
        quantity: number;
    }>;
    photos?: File[];
}

export interface UpdateInventoryItemInput {
    name: string;
    spec: string;
    categoryId: string | null;
    unit: string;
    minQuantity: number;
    note: string;
    formData?: InventoryItemFormData;
    stocks: Array<{
        id?: string;
        locationId: string | null;
        slotCode: string;
        quantity: number;
    }>;
    newPhotos?: File[];
    removePhotoIds?: string[];
}

function fileExtension(file: File) {
    const ext = file.name.includes(".") ? file.name.split(".").pop() || "" : "";
    const safe = ext.replace(/[^a-zA-Z0-9]/g, "");
    return safe || "bin";
}

function formatDateLabel(dateString: string) {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return "";
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}.${m}.${d}`;
}

function toNumber(value: unknown) {
    const n = typeof value === "number" ? value : Number(value);
    return Number.isFinite(n) ? n : 0;
}

export function computeItemStatus(
    totalQuantity: number,
    minQuantity: number,
    hasUnlocated: boolean
): InventoryItemStatus {
    if (hasUnlocated) return "unlocated";
    if (totalQuantity <= minQuantity) return "low";
    return "normal";
}

export function inventoryStatusLabel(status: InventoryItemStatus) {
    if (status === "low") return { label: "부족", color: "red-500" };
    if (status === "unlocated") return { label: "위치 미지정", color: "orange-500" };
    return { label: "정상", color: "green-500" };
}

function locationLabel(locationName: string | null, slotCode: string) {
    const slot = slotCode.trim();
    if (locationName && slot) return `${locationName} ${slot}`;
    if (locationName) return locationName;
    if (slot) return slot;
    return "위치 미지정";
}

async function signPaths(paths: string[]) {
    const map = new Map<string, string>();
    if (paths.length === 0) return map;
    const { data } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(paths, 60 * 60);
    for (const row of data ?? []) {
        if (row.path && row.signedUrl) map.set(row.path, row.signedUrl);
    }
    return map;
}

export async function fetchInventoryCategories(): Promise<InventoryCategory[]> {
    const { data, error } = await supabase
        .from("inventory_categories")
        .select("id, parent_id, name, sort_order, is_active, metadata")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
    if (error) throw new Error(error.message || "카테고리를 불러오지 못했습니다.");
    return (data ?? []).map((row) => ({
        id: row.id,
        parentId: row.parent_id ?? null,
        name: row.name,
        sortOrder: row.sort_order ?? 0,
        isActive: row.is_active !== false,
        formFields: parseCategoryFormFields(row.metadata),
        formButtonGroups: parseCategoryFormButtonGroups(row.metadata),
        formHashtags: parseCategoryFormHashtags(row.metadata),
        disabledInheritedFieldIds: parseDisabledInheritedFieldIds(row.metadata),
        disabledInheritedButtonGroupIds: parseDisabledInheritedButtonGroupIds(row.metadata),
        disabledInheritedHashtagIds: parseDisabledInheritedHashtagIds(row.metadata),
    }));
}

export async function createInventoryCategory(
    name: string,
    parentId?: string | null
): Promise<InventoryCategory> {
    const trimmed = name.trim();
    if (!trimmed) throw new Error("카테고리명을 입력해 주세요.");

    const categories = await fetchInventoryCategories();
    if (parentId) {
        const parent = categories.find((c) => c.id === parentId);
        if (!parent) throw new Error("상위 카테고리를 찾을 수 없습니다.");
        const parentDepth = getInventoryCategoryDepth(categories, parentId);
        if (parentDepth >= INVENTORY_CATEGORY_MAX_DEPTH) {
            throw new Error(`카테고리는 최대 ${INVENTORY_CATEGORY_MAX_DEPTH}단계까지 만들 수 있습니다.`);
        }
    }

    const { data, error } = await supabase
        .from("inventory_categories")
        .insert({
            name: trimmed,
            parent_id: parentId || null,
            sort_order: 999,
        })
        .select("id, parent_id, name, sort_order, is_active")
        .single();
    if (error || !data) throw new Error(error?.message || "카테고리 추가에 실패했습니다.");
    return {
        id: data.id,
        parentId: data.parent_id ?? null,
        name: data.name,
        sortOrder: data.sort_order ?? 0,
        isActive: data.is_active !== false,
        formFields: [],
        formButtonGroups: [],
        formHashtags: [],
        disabledInheritedFieldIds: [],
        disabledInheritedButtonGroupIds: [],
        disabledInheritedHashtagIds: [],
    };
}

export async function updateInventoryCategoryFormConfig(
    categoryId: string,
    config: {
        formFields: InventoryCategoryFormField[];
        formButtonGroups: InventoryCategoryFormButtonGroup[];
        formHashtags: InventoryCategoryFormHashtag[];
        disabledInheritedFieldIds?: string[];
        disabledInheritedButtonGroupIds?: string[];
        disabledInheritedHashtagIds?: string[];
    }
): Promise<{
    formFields: InventoryCategoryFormField[];
    formButtonGroups: InventoryCategoryFormButtonGroup[];
    formHashtags: InventoryCategoryFormHashtag[];
    disabledInheritedFieldIds: string[];
    disabledInheritedButtonGroupIds: string[];
    disabledInheritedHashtagIds: string[];
}> {
    const formFields = config.formFields
        .map((field) => ({
            id: field.id || crypto.randomUUID(),
            label: field.label.trim(),
            unit: field.unit.trim(),
        }))
        .filter((field) => field.label.length > 0);

    const formButtonGroups = config.formButtonGroups
        .map((group, index) => {
            const name = group.name.trim() || `그룹 ${index + 1}`;
            const buttons = group.buttons
                .map((button) => ({
                    id: button.id || crypto.randomUUID(),
                    label: button.label.trim(),
                }))
                .filter((button) => button.label.length > 0);
            return {
                id: group.id || crypto.randomUUID(),
                name,
                selection:
                    group.selection === "single"
                        ? ("single" as const)
                        : ("multiple" as const),
                buttons,
            };
        })
        .filter((group) => group.name.length > 0);

    const formHashtags = config.formHashtags
        .map((tag) => ({
            id: tag.id || crypto.randomUUID(),
            label: normalizeHashtagLabel(tag.label),
        }))
        .filter((tag) => tag.label.length > 1);

    const { data: existing, error: fetchError } = await supabase
        .from("inventory_categories")
        .select("metadata")
        .eq("id", categoryId)
        .single();
    if (fetchError) throw new Error(fetchError.message || "카테고리를 불러오지 못했습니다.");

    const prevMeta =
        existing?.metadata && typeof existing.metadata === "object"
            ? { ...(existing.metadata as Record<string, unknown>) }
            : {};
    // formButtons(구버전)는 제거해 이중 저장 방지
    const { formButtons: _legacyButtons, ...restMeta } = prevMeta as Record<
        string,
        unknown
    > & { formButtons?: unknown };
    void _legacyButtons;
    const disabledInheritedFieldIds = parseIdList(config.disabledInheritedFieldIds);
    const disabledInheritedButtonGroupIds = parseIdList(
        config.disabledInheritedButtonGroupIds
    );
    const disabledInheritedHashtagIds = parseIdList(config.disabledInheritedHashtagIds);
    const nextMeta = {
        ...restMeta,
        formFields,
        formButtonGroups,
        formHashtags,
        disabledInheritedFieldIds,
        disabledInheritedButtonGroupIds,
        disabledInheritedHashtagIds,
    };

    const { error } = await supabase
        .from("inventory_categories")
        .update({
            metadata: nextMeta,
            updated_at: new Date().toISOString(),
        })
        .eq("id", categoryId);
    if (error) throw new Error(error.message || "입력 항목 설정 저장에 실패했습니다.");
    return {
        formFields,
        formButtonGroups,
        formHashtags,
        disabledInheritedFieldIds,
        disabledInheritedButtonGroupIds,
        disabledInheritedHashtagIds,
    };
}

/** @deprecated updateInventoryCategoryFormConfig 사용 */
export async function updateInventoryCategoryFormFields(
    categoryId: string,
    formFields: InventoryCategoryFormField[]
): Promise<InventoryCategoryFormField[]> {
    const { data: existing, error: fetchError } = await supabase
        .from("inventory_categories")
        .select("metadata")
        .eq("id", categoryId)
        .single();
    if (fetchError) throw new Error(fetchError.message || "카테고리를 불러오지 못했습니다.");
    const formButtonGroups = parseCategoryFormButtonGroups(existing?.metadata);
    const formHashtags = parseCategoryFormHashtags(existing?.metadata);
    const result = await updateInventoryCategoryFormConfig(categoryId, {
        formFields,
        formButtonGroups,
        formHashtags,
    });
    return result.formFields;
}

export async function updateInventoryCategoryName(
    categoryId: string,
    name: string
): Promise<InventoryCategory> {
    const trimmed = name.trim();
    if (!trimmed) throw new Error("카테고리명을 입력해 주세요.");

    const { data, error } = await supabase
        .from("inventory_categories")
        .update({ name: trimmed, updated_at: new Date().toISOString() })
        .eq("id", categoryId)
        .select("id, parent_id, name, sort_order, is_active, metadata")
        .single();
    if (error || !data) throw new Error(error?.message || "카테고리명 변경에 실패했습니다.");
    return {
        id: data.id,
        parentId: data.parent_id ?? null,
        name: data.name,
        sortOrder: data.sort_order ?? 0,
        isActive: data.is_active !== false,
        formFields: parseCategoryFormFields(data.metadata),
        formButtonGroups: parseCategoryFormButtonGroups(data.metadata),
        formHashtags: parseCategoryFormHashtags(data.metadata),
        disabledInheritedFieldIds: parseDisabledInheritedFieldIds(data.metadata),
        disabledInheritedButtonGroupIds: parseDisabledInheritedButtonGroupIds(
            data.metadata
        ),
        disabledInheritedHashtagIds: parseDisabledInheritedHashtagIds(data.metadata),
    };
}

export async function deleteInventoryCategory(categoryId: string): Promise<void> {
    const { error } = await supabase.from("inventory_categories").delete().eq("id", categoryId);
    if (error) throw new Error(error.message || "카테고리 삭제에 실패했습니다.");
}

/** 같은 부모(형제) 안에서 위/아래로 순서 교환 */
export async function moveInventoryCategory(
    categoryId: string,
    direction: "up" | "down"
): Promise<void> {
    const categories = await fetchInventoryCategories();
    const current = categories.find((c) => c.id === categoryId);
    if (!current) throw new Error("카테고리를 찾을 수 없습니다.");

    const siblings = categories
        .filter((c) => c.parentId === current.parentId)
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "ko"));

    const index = siblings.findIndex((c) => c.id === categoryId);
    if (index < 0) throw new Error("카테고리를 찾을 수 없습니다.");

    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= siblings.length) {
        throw new Error(
            direction === "up" ? "더 이상 위로 이동할 수 없습니다." : "더 이상 아래로 이동할 수 없습니다."
        );
    }

    const reordered = [...siblings];
    [reordered[index], reordered[swapIndex]] = [reordered[swapIndex], reordered[index]];

    for (let i = 0; i < reordered.length; i += 1) {
        const { error } = await supabase
            .from("inventory_categories")
            .update({ sort_order: (i + 1) * 10 })
            .eq("id", reordered[i].id);
        if (error) throw new Error(error.message || "카테고리 순서 변경에 실패했습니다.");
    }
}

export async function fetchInventoryLocations(): Promise<InventoryLocation[]> {
    const { data, error } = await supabase
        .from("inventory_locations")
        .select("id, parent_id, name, kind, sort_order")
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
    if (error) throw new Error(error.message || "보관 위치를 불러오지 못했습니다.");
    return (data ?? []).map((row) => ({
        id: row.id,
        parentId: row.parent_id,
        name: row.name,
        kind: (row.kind as InventoryLocationKind) || "zone",
        sortOrder: row.sort_order ?? 0,
    }));
}

export async function createInventoryLocation(input: {
    name: string;
    kind?: InventoryLocationKind;
    parentId?: string | null;
}): Promise<InventoryLocation> {
    const trimmed = input.name.trim();
    if (!trimmed) throw new Error("위치명을 입력해 주세요.");
    const { data, error } = await supabase
        .from("inventory_locations")
        .insert({
            name: trimmed,
            kind: input.kind || "zone",
            parent_id: input.parentId || null,
            sort_order: 999,
        })
        .select("id, parent_id, name, kind, sort_order")
        .single();
    if (error || !data) throw new Error(error?.message || "위치 추가에 실패했습니다.");
    return {
        id: data.id,
        parentId: data.parent_id,
        name: data.name,
        kind: (data.kind as InventoryLocationKind) || "zone",
        sortOrder: data.sort_order ?? 0,
    };
}

export async function deleteInventoryLocation(locationId: string): Promise<void> {
    const { error } = await supabase.from("inventory_locations").delete().eq("id", locationId);
    if (error) throw new Error(error.message || "보관 위치 삭제에 실패했습니다.");
}

type RawItem = {
    id: string;
    name: string;
    spec: string | null;
    category_id: string | null;
    unit: string | null;
    min_quantity: number | string | null;
    note: string | null;
    metadata?: unknown;
    created_by: string | null;
    updated_at: string;
    inventory_categories: { id: string; name: string } | { id: string; name: string }[] | null;
    inventory_stocks: Array<{
        id: string;
        location_id: string | null;
        slot_code: string | null;
        quantity: number | string | null;
        inventory_locations: { id: string; name: string } | { id: string; name: string }[] | null;
    }> | null;
    inventory_item_photos: Array<{
        id: string;
        storage_path: string;
        file_name: string | null;
        content_type: string | null;
        sort_order: number | null;
    }> | null;
};

function categoryFromJoin(
    join: RawItem["inventory_categories"]
): { id: string; name: string } | null {
    if (!join) return null;
    return Array.isArray(join) ? join[0] ?? null : join;
}

function locationFromJoin(
    join: { id: string; name: string } | { id: string; name: string }[] | null | undefined
): { id: string; name: string } | null {
    if (!join) return null;
    return Array.isArray(join) ? join[0] ?? null : join;
}

function mapRawItem(row: RawItem, signedByPath: Map<string, string>): InventoryItemListRow {
    const category = categoryFromJoin(row.inventory_categories);
    const stocks: InventoryStock[] = (row.inventory_stocks ?? []).map((stock) => {
        const loc = locationFromJoin(stock.inventory_locations);
        return {
            id: stock.id,
            locationId: stock.location_id,
            locationName: loc?.name ?? null,
            slotCode: stock.slot_code?.trim() || "",
            quantity: toNumber(stock.quantity),
        };
    });
    const totalQuantity = stocks.reduce((sum, s) => sum + s.quantity, 0);
    const hasUnlocated =
        stocks.length === 0 || stocks.some((s) => s.quantity > 0 && !s.locationId);
    const minQuantity = toNumber(row.min_quantity);
    const finalStatus = computeItemStatus(totalQuantity, minQuantity, hasUnlocated);

    const primaryStock =
        stocks.find((s) => s.locationId) ?? stocks[0] ?? null;
    const primary = primaryStock
        ? locationLabel(primaryStock.locationName, primaryStock.slotCode)
        : "위치 미지정";

    const photos = [...(row.inventory_item_photos ?? [])].sort(
        (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
    );
    const thumbPath = photos[0]?.storage_path ?? null;

    return {
        id: row.id,
        name: row.name,
        spec: row.spec?.trim() || "",
        categoryId: category?.id ?? row.category_id,
        categoryName: category?.name ?? null,
        unit: row.unit?.trim() || "EA",
        minQuantity,
        note: row.note?.trim() || "",
        createdBy: row.created_by,
        updatedAt: row.updated_at,
        updatedAtLabel: formatDateLabel(row.updated_at),
        totalQuantity,
        hasUnlocated: stocks.some((s) => !s.locationId) || stocks.length === 0,
        primaryLocationLabel: primary,
        status: finalStatus,
        thumbUrl: thumbPath ? signedByPath.get(thumbPath) ?? null : null,
        stocks,
        formData: parseInventoryItemFormData(row.metadata),
    };
}

const ITEM_SELECT = `
  id, name, spec, category_id, unit, min_quantity, note, created_by, updated_at,
  inventory_categories ( id, name ),
  inventory_stocks (
    id, location_id, slot_code, quantity,
    inventory_locations ( id, name )
  ),
  inventory_item_photos ( id, storage_path, file_name, content_type, sort_order )
`;

const ITEM_DETAIL_SELECT = `
  id, name, spec, category_id, unit, min_quantity, note, metadata, created_by, updated_at,
  inventory_categories ( id, name ),
  inventory_stocks (
    id, location_id, slot_code, quantity,
    inventory_locations ( id, name )
  ),
  inventory_item_photos ( id, storage_path, file_name, content_type, sort_order )
`;

export async function fetchInventoryItems(
    filters: InventoryListFilters = {}
): Promise<InventoryItemListRow[]> {
    const { data, error } = await supabase
        .from("inventory_items")
        .select(ITEM_SELECT)
        .order("updated_at", { ascending: false });

    if (error) throw new Error(error.message || "자재 목록을 불러오지 못했습니다.");

    const rows = (data ?? []) as unknown as RawItem[];
    const photoPaths = [
        ...new Set(
            rows.flatMap((row) =>
                (row.inventory_item_photos ?? []).map((p) => p.storage_path).filter(Boolean)
            )
        ),
    ];
    const signed = await signPaths(photoPaths);
    const categories = await fetchInventoryCategories();
    let items = rows.map((row) => {
        const mapped = mapRawItem(row, signed);
        return {
            ...mapped,
            categoryName: mapped.categoryId
                ? getInventoryCategoryPathLabel(categories, mapped.categoryId) || mapped.categoryName
                : null,
        };
    });

    const search = filters.search?.trim().toLowerCase();
    if (search) {
        items = items.filter(
            (item) =>
                item.name.toLowerCase().includes(search) ||
                item.spec.toLowerCase().includes(search) ||
                (item.categoryName ?? "").toLowerCase().includes(search) ||
                item.primaryLocationLabel.toLowerCase().includes(search)
        );
    }
    if (filters.categoryId) {
        // 상위 선택 시 하위 카테고리 품목도 포함
        const ids = new Set(getInventoryCategoryDescendantIds(categories, filters.categoryId));
        items = items.filter((item) => item.categoryId != null && ids.has(item.categoryId));
    }
    if (filters.locationId) {
        items = items.filter((item) =>
            item.stocks.some((s) => s.locationId === filters.locationId)
        );
    }
    if (filters.status && filters.status !== "all") {
        items = items.filter((item) => item.status === filters.status);
    }

    return items;
}

export async function fetchInventoryStats(items?: InventoryItemListRow[]): Promise<InventoryStats> {
    const list = items ?? (await fetchInventoryItems());
    const { count: categoryCount } = await supabase
        .from("inventory_categories")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true);

    return {
        totalItems: list.length,
        lowStockItems: list.filter((i) => i.status === "low").length,
        unlocatedItems: list.filter((i) => i.status === "unlocated").length,
        categoryCount: categoryCount ?? 0,
    };
}

export async function fetchInventoryItemDetail(itemId: string): Promise<InventoryItemDetail> {
    let data: unknown = null;
    let error: { message?: string } | null = null;

    const withMeta = await supabase
        .from("inventory_items")
        .select(ITEM_DETAIL_SELECT)
        .eq("id", itemId)
        .single();
    if (withMeta.error && /metadata/i.test(withMeta.error.message || "")) {
        const fallback = await supabase
            .from("inventory_items")
            .select(ITEM_SELECT)
            .eq("id", itemId)
            .single();
        data = fallback.data;
        error = fallback.error;
    } else {
        data = withMeta.data;
        error = withMeta.error;
    }

    if (error || !data) throw new Error(error?.message || "자재 상세를 불러오지 못했습니다.");

    const row = data as unknown as RawItem;
    const photoRows = [...(row.inventory_item_photos ?? [])].sort(
        (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
    );
    const signed = await signPaths(photoRows.map((p) => p.storage_path));
    const base = mapRawItem(row, signed);
    const categories = await fetchInventoryCategories();
    const categoryName = base.categoryId
        ? getInventoryCategoryPathLabel(categories, base.categoryId) || base.categoryName
        : null;

    return {
        ...base,
        categoryName,
        photos: photoRows.map((p) => ({
            id: p.id,
            storagePath: p.storage_path,
            fileName: p.file_name || "사진",
            contentType: p.content_type || "image/jpeg",
            sortOrder: p.sort_order ?? 0,
            url: signed.get(p.storage_path) || "",
        })),
    };
}

async function uploadItemPhotos(userId: string, itemId: string, files: File[]) {
    const rows: Array<{
        item_id: string;
        storage_path: string;
        file_name: string;
        content_type: string;
        sort_order: number;
    }> = [];
    const uploaded: string[] = [];

    try {
        for (let i = 0; i < files.length; i += 1) {
            const file = files[i];
            const uploadFile = await compressReceiptImage(file);
            const path = `${userId}/${itemId}/${Date.now()}_${Math.random().toString(36).slice(2, 10)}.${fileExtension(uploadFile)}`;
            const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, uploadFile, {
                contentType: uploadFile.type || "image/jpeg",
                upsert: false,
            });
            if (error) throw new Error(error.message || "사진 업로드에 실패했습니다.");
            uploaded.push(path);
            rows.push({
                item_id: itemId,
                storage_path: path,
                file_name: file.name,
                content_type: uploadFile.type || "image/jpeg",
                sort_order: i,
            });
        }
        if (rows.length > 0) {
            const { error } = await supabase.from("inventory_item_photos").insert(rows);
            if (error) throw new Error(error.message || "사진 저장에 실패했습니다.");
        }
    } catch (err) {
        if (uploaded.length > 0) {
            await supabase.storage.from(PHOTO_BUCKET).remove(uploaded);
        }
        throw err;
    }
}

export async function createInventoryItem(input: CreateInventoryItemInput): Promise<string> {
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("로그인 정보를 확인할 수 없습니다.");

    const name = input.name.trim();
    if (!name) throw new Error("자재명을 입력해 주세요.");

    const stockRows =
        input.stocks && input.stocks.length > 0
            ? input.stocks.map((s) => ({
                  location_id: s.locationId || null,
                  slot_code: s.slotCode.trim() || "",
                  quantity: toNumber(s.quantity),
              }))
            : [
                  {
                      location_id: input.locationId || null,
                      slot_code: input.slotCode?.trim() || "",
                      quantity: toNumber(input.quantity ?? 0),
                  },
              ];

    for (const row of stockRows) {
        if (row.quantity < 0) throw new Error("수량은 0 이상이어야 합니다.");
    }

    const formData = input.formData ?? { fieldValues: {}, activeButtonIds: [] };
    const { data: item, error } = await supabase
        .from("inventory_items")
        .insert({
            name,
            spec: input.spec?.trim() || "",
            category_id: input.categoryId || null,
            unit: input.unit?.trim() || "EA",
            min_quantity: input.minQuantity ?? 0,
            note: input.note?.trim() || "",
            metadata: {
                fieldValues: formData.fieldValues,
                activeButtonIds: formData.activeButtonIds,
            },
            created_by: user.id,
        })
        .select("id")
        .single();

    if (error || !item) throw new Error(error?.message || "자재 등록에 실패했습니다.");

    const { error: stockError } = await supabase.from("inventory_stocks").insert(
        stockRows.map((row) => ({ ...row, item_id: item.id }))
    );
    if (stockError) {
        await supabase.from("inventory_items").delete().eq("id", item.id);
        throw new Error(stockError.message || "재고 등록에 실패했습니다.");
    }

    if (input.photos && input.photos.length > 0) {
        try {
            await uploadItemPhotos(user.id, item.id, input.photos);
        } catch (photoError) {
            await supabase.from("inventory_items").delete().eq("id", item.id);
            throw photoError;
        }
    }

    return item.id;
}

export async function updateInventoryItem(
    itemId: string,
    input: UpdateInventoryItemInput
): Promise<void> {
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("로그인 정보를 확인할 수 없습니다.");

    const name = input.name.trim();
    if (!name) throw new Error("자재명을 입력해 주세요.");

    const formData = input.formData ?? { fieldValues: {}, activeButtonIds: [] };
    const { error } = await supabase
        .from("inventory_items")
        .update({
            name,
            spec: input.spec.trim(),
            category_id: input.categoryId,
            unit: input.unit.trim() || "EA",
            min_quantity: input.minQuantity,
            note: input.note.trim(),
            metadata: {
                fieldValues: formData.fieldValues,
                activeButtonIds: formData.activeButtonIds,
            },
            updated_at: new Date().toISOString(),
        })
        .eq("id", itemId);

    if (error) throw new Error(error.message || "자재 수정에 실패했습니다.");

    const { data: existingStocks, error: stockFetchError } = await supabase
        .from("inventory_stocks")
        .select("id")
        .eq("item_id", itemId);
    if (stockFetchError) throw new Error(stockFetchError.message || "재고 정보를 불러오지 못했습니다.");

    const keepIds = new Set(input.stocks.map((s) => s.id).filter(Boolean) as string[]);
    const toDelete = (existingStocks ?? []).filter((s) => !keepIds.has(s.id)).map((s) => s.id);
    if (toDelete.length > 0) {
        const { error: delError } = await supabase.from("inventory_stocks").delete().in("id", toDelete);
        if (delError) throw new Error(delError.message || "재고 삭제에 실패했습니다.");
    }

    for (const stock of input.stocks) {
        if (stock.id) {
            const { error: updError } = await supabase
                .from("inventory_stocks")
                .update({
                    location_id: stock.locationId,
                    slot_code: stock.slotCode.trim(),
                    quantity: toNumber(stock.quantity),
                    updated_at: new Date().toISOString(),
                })
                .eq("id", stock.id);
            if (updError) throw new Error(updError.message || "재고 수정에 실패했습니다.");
        } else {
            const { error: insError } = await supabase.from("inventory_stocks").insert({
                item_id: itemId,
                location_id: stock.locationId,
                slot_code: stock.slotCode.trim(),
                quantity: toNumber(stock.quantity),
            });
            if (insError) throw new Error(insError.message || "재고 추가에 실패했습니다.");
        }
    }

    if (input.removePhotoIds && input.removePhotoIds.length > 0) {
        const { data: photos } = await supabase
            .from("inventory_item_photos")
            .select("id, storage_path")
            .in("id", input.removePhotoIds);
        const paths = (photos ?? []).map((p) => p.storage_path).filter(Boolean);
        if (paths.length > 0) {
            await supabase.storage.from(PHOTO_BUCKET).remove(paths);
        }
        await supabase.from("inventory_item_photos").delete().in("id", input.removePhotoIds);
    }

    if (input.newPhotos && input.newPhotos.length > 0) {
        const { count } = await supabase
            .from("inventory_item_photos")
            .select("id", { count: "exact", head: true })
            .eq("item_id", itemId);
        // upload appends with sort starting at 0; reorder not critical for phase 1
        void count;
        await uploadItemPhotos(user.id, itemId, input.newPhotos);
    }
}

export async function deleteInventoryItem(itemId: string): Promise<void> {
    const { data: photos } = await supabase
        .from("inventory_item_photos")
        .select("storage_path")
        .eq("item_id", itemId);
    const paths = (photos ?? []).map((p) => p.storage_path).filter(Boolean);
    if (paths.length > 0) {
        await supabase.storage.from(PHOTO_BUCKET).remove(paths);
    }
    const { error } = await supabase.from("inventory_items").delete().eq("id", itemId);
    if (error) throw new Error(error.message || "자재 삭제에 실패했습니다.");
}
