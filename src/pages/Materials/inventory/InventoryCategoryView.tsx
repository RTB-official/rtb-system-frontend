import {
    flattenInventoryCategories,
    getInventoryCategoryDescendantIds,
    type InventoryCategory,
    type InventoryItemListRow,
} from "../../../lib/inventoryApi";
import Button from "../../../components/common/Button";

interface InventoryCategoryViewProps {
    categories: InventoryCategory[];
    items: InventoryItemListRow[];
    selectedCategoryId: string | null;
    onSelectCategory: (categoryId: string | null) => void;
    onSelectItem: (item: InventoryItemListRow) => void;
    canManage?: boolean;
    onEditMasters?: () => void;
}

export default function InventoryCategoryView({
    categories,
    items,
    selectedCategoryId,
    onSelectCategory,
    onSelectItem,
    canManage = false,
    onEditMasters,
}: InventoryCategoryViewProps) {
    const flat = flattenInventoryCategories(categories);

    const countIncludingDescendants = (categoryId: string) => {
        const ids = new Set(getInventoryCategoryDescendantIds(categories, categoryId));
        return items.filter((i) => i.categoryId != null && ids.has(i.categoryId)).length;
    };

    const uncategorizedCount = items.filter((i) => !i.categoryId).length;

    const groups: Array<{
        category: InventoryCategory;
        pathLabel: string;
        items: InventoryItemListRow[];
    }> = [];

    if (selectedCategoryId === "__none__") {
        groups.push({
            category: {
                id: "__none__",
                parentId: null,
                name: "미분류",
                sortOrder: 9999,
                isActive: true,
            },
            pathLabel: "미분류",
            items: items.filter((i) => !i.categoryId),
        });
    } else if (selectedCategoryId) {
        const selectedIds = new Set(
            getInventoryCategoryDescendantIds(categories, selectedCategoryId)
        );
        const relevant = flat.filter((c) => selectedIds.has(c.id));
        for (const category of relevant) {
            const catItems = items.filter((i) => i.categoryId === category.id);
            if (catItems.length === 0) continue;
            groups.push({
                category,
                pathLabel: category.pathLabel,
                items: catItems,
            });
        }
    } else {
        // 전체: 루트 카테고리별로 하위 포함 품목 미리보기
        for (const category of flat.filter((c) => c.depth === 1)) {
            const ids = new Set(getInventoryCategoryDescendantIds(categories, category.id));
            const catItems = items.filter((i) => i.categoryId != null && ids.has(i.categoryId));
            groups.push({
                category,
                pathLabel: category.pathLabel,
                items: catItems,
            });
        }
        if (uncategorizedCount > 0) {
            groups.push({
                category: {
                    id: "__none__",
                    parentId: null,
                    name: "미분류",
                    sortOrder: 9999,
                    isActive: true,
                },
                pathLabel: "미분류",
                items: items.filter((i) => !i.categoryId),
            });
        }
    }

    return (
        <div className="flex flex-col lg:flex-row gap-4 md:gap-6">
            <aside className="lg:w-64 shrink-0 rounded-2xl border border-gray-200 bg-white p-3">
                <div className="flex items-center justify-between gap-2 px-2 py-1.5">
                    <p className="text-xs font-medium text-gray-400">카테고리</p>
                    {canManage && (
                        <button
                            type="button"
                            className="text-xs font-medium text-gray-600 hover:text-gray-900"
                            onClick={onEditMasters}
                        >
                            상세
                        </button>
                    )}
                </div>
                <button
                    type="button"
                    onClick={() => onSelectCategory(null)}
                    className={`w-full flex items-center justify-between rounded-xl px-3 py-2.5 text-sm ${
                        selectedCategoryId == null
                            ? "bg-gray-900 text-white"
                            : "text-gray-700 hover:bg-gray-50"
                    }`}
                >
                    <span>전체</span>
                    <span className={selectedCategoryId == null ? "text-white/70" : "text-gray-400"}>
                        {items.length}
                    </span>
                </button>
                {flat.map((category) => {
                    const count = countIncludingDescendants(category.id);
                    const active = selectedCategoryId === category.id;
                    const pad = (category.depth - 1) * 12;
                    return (
                        <button
                            key={category.id}
                            type="button"
                            onClick={() => onSelectCategory(category.id)}
                            style={{ paddingLeft: `${12 + pad}px` }}
                            className={`w-full flex items-center justify-between rounded-xl pr-3 py-2.5 text-sm ${
                                active ? "bg-gray-900 text-white" : "text-gray-700 hover:bg-gray-50"
                            }`}
                        >
                            <span className="truncate text-left">
                                {category.depth > 1 ? (
                                    <span className={active ? "text-white/50" : "text-gray-300"}>└ </span>
                                ) : null}
                                {category.name}
                            </span>
                            <span className={active ? "text-white/70" : "text-gray-400"}>{count}</span>
                        </button>
                    );
                })}
                {uncategorizedCount > 0 && (
                    <button
                        type="button"
                        onClick={() => onSelectCategory("__none__")}
                        className={`w-full flex items-center justify-between rounded-xl px-3 py-2.5 text-sm ${
                            selectedCategoryId === "__none__"
                                ? "bg-gray-900 text-white"
                                : "text-gray-700 hover:bg-gray-50"
                        }`}
                    >
                        <span>미분류</span>
                        <span
                            className={
                                selectedCategoryId === "__none__" ? "text-white/70" : "text-gray-400"
                            }
                        >
                            {uncategorizedCount}
                        </span>
                    </button>
                )}
            </aside>

            <div className="flex-1 min-w-0 flex flex-col gap-6">
                {groups.every((g) => g.items.length === 0) ? (
                    <div className="rounded-2xl border border-gray-200 px-4 py-12 text-center text-gray-400">
                        해당 카테고리에 자재가 없습니다.
                    </div>
                ) : (
                    groups
                        .filter((g) => g.items.length > 0)
                        .map((group) => (
                            <section key={group.category.id} className="flex flex-col gap-3">
                                <div className="flex items-center justify-between gap-2">
                                    <h3 className="text-base font-semibold text-gray-900">
                                        {group.pathLabel}{" "}
                                        <span className="text-gray-400 font-normal">
                                            {group.items.length}개
                                        </span>
                                    </h3>
                                    {selectedCategoryId == null &&
                                        group.category.id !== "__none__" &&
                                        group.items.length > 4 && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => onSelectCategory(group.category.id)}
                                            >
                                                전체 보기
                                            </Button>
                                        )}
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                                    {(selectedCategoryId == null
                                        ? group.items.slice(0, 4)
                                        : group.items
                                    ).map((item) => (
                                        <button
                                            key={item.id}
                                            type="button"
                                            onClick={() => onSelectItem(item)}
                                            className="text-left rounded-2xl border border-gray-200 bg-white p-3 hover:border-gray-300 transition"
                                        >
                                            <div className="aspect-[4/3] rounded-xl bg-gray-50 overflow-hidden mb-2">
                                                {item.thumbUrl ? (
                                                    <img
                                                        src={item.thumbUrl}
                                                        alt={item.name}
                                                        className="h-full w-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="h-full w-full flex items-center justify-center text-xs text-gray-400">
                                                        사진 없음
                                                    </div>
                                                )}
                                            </div>
                                            <p className="font-medium text-gray-900 truncate">
                                                {item.name}
                                            </p>
                                            <p className="text-xs text-gray-500 mt-1">
                                                수량 {item.totalQuantity} {item.unit}
                                            </p>
                                            <p className="text-xs text-gray-400 mt-0.5 truncate">
                                                {item.primaryLocationLabel}
                                            </p>
                                        </button>
                                    ))}
                                </div>
                            </section>
                        ))
                )}
            </div>
        </div>
    );
}
