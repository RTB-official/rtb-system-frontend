import Chip from "../../../components/ui/Chip";
import Table, { type TableColumn } from "../../../components/common/Table";
import Pagination from "../../../components/common/Pagination";
import {
    inventoryStatusLabel,
    type InventoryItemListRow,
} from "../../../lib/inventoryApi";

interface InventoryListViewProps {
    items: InventoryItemListRow[];
    viewMode: "list" | "card";
    page: number;
    pageSize: number;
    onPageChange: (page: number) => void;
    onSelect: (item: InventoryItemListRow) => void;
}

function Thumb({ url, name }: { url: string | null; name: string }) {
    if (!url) {
        return (
            <div className="h-12 w-12 rounded-lg bg-gray-100 text-[10px] text-gray-400 flex items-center justify-center shrink-0">
                없음
            </div>
        );
    }
    return (
        <img
            src={url}
            alt={name}
            className="h-12 w-12 rounded-lg object-cover bg-gray-100 shrink-0"
        />
    );
}

export default function InventoryListView({
    items,
    viewMode,
    page,
    pageSize,
    onPageChange,
    onSelect,
}: InventoryListViewProps) {
    const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
    const safePage = Math.min(page, totalPages);
    const pageItems = items.slice((safePage - 1) * pageSize, safePage * pageSize);

    const columns: TableColumn<InventoryItemListRow>[] = [
        {
            key: "thumb",
            label: "사진",
            width: "8%",
            render: (_, row) => <Thumb url={row.thumbUrl} name={row.name} />,
        },
        {
            key: "name",
            label: "자재명",
            width: "16%",
            render: (_, row) => (
                <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">{row.name}</p>
                    {row.spec ? <p className="text-xs text-gray-500 truncate mt-0.5">{row.spec}</p> : null}
                </div>
            ),
        },
        {
            key: "categoryName",
            label: "카테고리",
            width: "12%",
            render: (value) => value || "—",
        },
        {
            key: "spec",
            label: "규격",
            width: "12%",
            render: (value) => value || "—",
        },
        {
            key: "totalQuantity",
            label: "수량",
            width: "8%",
            align: "right",
        },
        {
            key: "unit",
            label: "단위",
            width: "7%",
        },
        {
            key: "primaryLocationLabel",
            label: "현재 위치",
            width: "16%",
            render: (value) => <span className="text-gray-700">{value}</span>,
        },
        {
            key: "status",
            label: "상태",
            width: "11%",
            render: (_, row) => {
                const status = inventoryStatusLabel(row.status);
                return (
                    <Chip color={status.color} variant="solid" size="md">
                        {status.label}
                    </Chip>
                );
            },
        },
        {
            key: "updatedAtLabel",
            label: "최근 수정일",
            width: "10%",
        },
    ];

    if (viewMode === "card") {
        return (
            <div className="flex flex-col gap-4">
                {pageItems.length === 0 ? (
                    <div className="rounded-2xl border border-gray-200 px-4 py-12 text-center text-gray-400">
                        등록된 자재가 없습니다.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
                        {pageItems.map((item) => {
                            const status = inventoryStatusLabel(item.status);
                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => onSelect(item)}
                                    className="text-left rounded-2xl border border-gray-200 bg-white p-3 md:p-4 hover:border-gray-300 hover:shadow-sm transition"
                                >
                                    <div className="flex items-start justify-between gap-2 mb-3">
                                        <Chip color="gray-500" variant="solid" size="sm">
                                            {item.categoryName || "미분류"}
                                        </Chip>
                                        <Chip color={status.color} variant="solid" size="sm">
                                            {status.label}
                                        </Chip>
                                    </div>
                                    <div className="aspect-[4/3] rounded-xl bg-gray-50 overflow-hidden mb-3">
                                        {item.thumbUrl ? (
                                            <img
                                                src={item.thumbUrl}
                                                alt={item.name}
                                                className="h-full w-full object-cover"
                                            />
                                        ) : (
                                            <div className="h-full w-full flex items-center justify-center text-sm text-gray-400">
                                                사진 없음
                                            </div>
                                        )}
                                    </div>
                                    <p className="font-semibold text-gray-900 truncate">{item.name}</p>
                                    <p className="text-xs text-gray-500 mt-1 truncate">
                                        {item.spec || "규격 없음"}
                                    </p>
                                    <div className="mt-3 flex items-center justify-between text-sm">
                                        <span className="text-gray-700">
                                            수량 {item.totalQuantity} {item.unit}
                                        </span>
                                    </div>
                                    <p className="mt-1 text-xs text-gray-500 truncate">
                                        {item.primaryLocationLabel}
                                    </p>
                                </button>
                            );
                        })}
                    </div>
                )}
                {items.length > pageSize && (
                    <Pagination
                        currentPage={safePage}
                        totalPages={totalPages}
                        onPageChange={onPageChange}
                    />
                )}
            </div>
        );
    }

    return (
        <Table
            columns={columns}
            data={pageItems}
            rowKey="id"
            onRowClick={(row) => onSelect(row)}
            emptyText="등록된 자재가 없습니다."
            pagination={
                items.length > pageSize
                    ? {
                          currentPage: safePage,
                          totalPages,
                          onPageChange,
                      }
                    : undefined
            }
        />
    );
}
