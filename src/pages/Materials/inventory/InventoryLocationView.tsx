import Chip from "../../../components/ui/Chip";
import {
    inventoryStatusLabel,
    type InventoryItemListRow,
    type InventoryLocation,
} from "../../../lib/inventoryApi";

interface InventoryLocationViewProps {
    locations: InventoryLocation[];
    items: InventoryItemListRow[];
    selectedLocationId: string | null;
    onSelectLocation: (locationId: string | null) => void;
    onSelectItem: (item: InventoryItemListRow) => void;
    canManage?: boolean;
    onEditMasters?: () => void;
}

export default function InventoryLocationView({
    locations,
    items,
    selectedLocationId,
    onSelectLocation,
    onSelectItem,
    canManage = false,
    onEditMasters,
}: InventoryLocationViewProps) {
    const rootLocations = locations.filter((l) => !l.parentId);

    const countForLocation = (locationId: string | null) => {
        if (locationId == null) {
            return items.filter(
                (item) =>
                    item.stocks.length === 0 || item.stocks.some((s) => !s.locationId && s.quantity > 0)
            ).length;
        }
        return items.filter((item) => item.stocks.some((s) => s.locationId === locationId)).length;
    };

    const groups =
        selectedLocationId === "__unlocated__"
            ? [
                  {
                      id: "__unlocated__",
                      name: "위치 미지정",
                      items: items.filter(
                          (item) =>
                              item.stocks.length === 0 ||
                              item.stocks.some((s) => !s.locationId && s.quantity > 0)
                      ),
                  },
              ]
            : selectedLocationId
              ? [
                    {
                        id: selectedLocationId,
                        name:
                            locations.find((l) => l.id === selectedLocationId)?.name || "선택 위치",
                        items: items.filter((item) =>
                            item.stocks.some((s) => s.locationId === selectedLocationId)
                        ),
                    },
                ]
              : [
                    ...rootLocations.map((loc) => ({
                        id: loc.id,
                        name: loc.name,
                        items: items.filter((item) =>
                            item.stocks.some((s) => s.locationId === loc.id)
                        ),
                    })),
                    {
                        id: "__unlocated__",
                        name: "위치 미지정",
                        items: items.filter(
                            (item) =>
                                item.stocks.length === 0 ||
                                item.stocks.some((s) => !s.locationId && s.quantity > 0)
                        ),
                    },
                ];

    return (
        <div className="flex flex-col lg:flex-row gap-4 md:gap-6">
            <aside className="lg:w-56 shrink-0 rounded-2xl border border-gray-200 bg-white p-3">
                <div className="flex items-center justify-between gap-2 px-2 py-1.5">
                    <p className="text-xs font-medium text-gray-400">보관 위치</p>
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
                    onClick={() => onSelectLocation(null)}
                    className={`w-full flex items-center justify-between rounded-xl px-3 py-2.5 text-sm ${
                        selectedLocationId == null
                            ? "bg-gray-900 text-white"
                            : "text-gray-700 hover:bg-gray-50"
                    }`}
                >
                    <span>전체 위치</span>
                    <span className={selectedLocationId == null ? "text-white/70" : "text-gray-400"}>
                        {items.length}
                    </span>
                </button>
                {rootLocations.map((loc) => {
                    const count = countForLocation(loc.id);
                    const active = selectedLocationId === loc.id;
                    return (
                        <button
                            key={loc.id}
                            type="button"
                            onClick={() => onSelectLocation(loc.id)}
                            className={`w-full flex items-center justify-between rounded-xl px-3 py-2.5 text-sm ${
                                active ? "bg-gray-900 text-white" : "text-gray-700 hover:bg-gray-50"
                            }`}
                        >
                            <span className="truncate">{loc.name}</span>
                            <span className={active ? "text-white/70" : "text-gray-400"}>{count}</span>
                        </button>
                    );
                })}
                <button
                    type="button"
                    onClick={() => onSelectLocation("__unlocated__")}
                    className={`w-full flex items-center justify-between rounded-xl px-3 py-2.5 text-sm ${
                        selectedLocationId === "__unlocated__"
                            ? "bg-gray-900 text-white"
                            : "text-gray-700 hover:bg-gray-50"
                    }`}
                >
                    <span>위치 미지정</span>
                    <span
                        className={
                            selectedLocationId === "__unlocated__" ? "text-white/70" : "text-gray-400"
                        }
                    >
                        {countForLocation(null)}
                    </span>
                </button>
            </aside>

            <div className="flex-1 min-w-0 flex flex-col gap-4">
                {groups.every((g) => g.items.length === 0) ? (
                    <div className="rounded-2xl border border-gray-200 px-4 py-12 text-center text-gray-400">
                        해당 위치에 자재가 없습니다.
                    </div>
                ) : (
                    groups
                        .filter((g) => g.items.length > 0)
                        .map((group) => (
                            <details
                                key={group.id}
                                open
                                className="rounded-2xl border border-gray-200 bg-white overflow-hidden"
                            >
                                <summary className="cursor-pointer list-none px-4 py-3 md:px-5 flex items-center justify-between gap-2 border-b border-gray-100">
                                    <span className="font-semibold text-gray-900">
                                        {group.name}{" "}
                                        <span className="text-gray-400 font-normal">
                                            {group.items.length}개
                                        </span>
                                    </span>
                                </summary>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="text-left text-gray-500 border-b border-gray-100">
                                                <th className="px-4 py-2.5 font-medium">사진</th>
                                                <th className="px-4 py-2.5 font-medium">자재명</th>
                                                <th className="px-4 py-2.5 font-medium">규격</th>
                                                <th className="px-4 py-2.5 font-medium text-right">
                                                    수량
                                                </th>
                                                <th className="px-4 py-2.5 font-medium">단위</th>
                                                <th className="px-4 py-2.5 font-medium">상태</th>
                                                <th className="px-4 py-2.5 font-medium">상세 위치</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {group.items.map((item) => {
                                                const status = inventoryStatusLabel(item.status);
                                                const stock =
                                                    group.id === "__unlocated__"
                                                        ? item.stocks.find((s) => !s.locationId)
                                                        : item.stocks.find(
                                                              (s) => s.locationId === group.id
                                                          );
                                                return (
                                                    <tr
                                                        key={item.id}
                                                        className="border-b border-gray-50 last:border-0 hover:bg-gray-50 cursor-pointer"
                                                        onClick={() => onSelectItem(item)}
                                                    >
                                                        <td className="px-4 py-2.5">
                                                            {item.thumbUrl ? (
                                                                <img
                                                                    src={item.thumbUrl}
                                                                    alt={item.name}
                                                                    className="h-10 w-10 rounded-lg object-cover"
                                                                />
                                                            ) : (
                                                                <div className="h-10 w-10 rounded-lg bg-gray-100" />
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-2.5 font-medium text-gray-900">
                                                            {item.name}
                                                        </td>
                                                        <td className="px-4 py-2.5 text-gray-600">
                                                            {item.spec || "—"}
                                                        </td>
                                                        <td className="px-4 py-2.5 text-right">
                                                            {stock?.quantity ?? item.totalQuantity}
                                                        </td>
                                                        <td className="px-4 py-2.5">{item.unit}</td>
                                                        <td className="px-4 py-2.5">
                                                            <Chip
                                                                color={status.color}
                                                                variant="solid"
                                                                size="sm"
                                                            >
                                                                {status.label}
                                                            </Chip>
                                                        </td>
                                                        <td className="px-4 py-2.5 text-gray-600">
                                                            {stock?.slotCode ||
                                                                item.primaryLocationLabel}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </details>
                        ))
                )}
            </div>
        </div>
    );
}
