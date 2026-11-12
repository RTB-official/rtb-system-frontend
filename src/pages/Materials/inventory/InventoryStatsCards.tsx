import type { InventoryStats } from "../../../lib/inventoryApi";

interface InventoryStatsCardsProps {
    stats: InventoryStats;
    loading?: boolean;
}

function StatCard({
    label,
    value,
    valueClassName = "text-gray-900",
}: {
    label: string;
    value: number | string;
    valueClassName?: string;
}) {
    return (
        <div className="rounded-2xl border border-gray-200 bg-white px-4 py-4 md:px-5 md:py-5">
            <p className="text-xs md:text-sm text-gray-500">{label}</p>
            <p className={`mt-2 text-2xl md:text-3xl font-semibold tracking-tight ${valueClassName}`}>
                {value}
            </p>
        </div>
    );
}

export default function InventoryStatsCards({ stats, loading }: InventoryStatsCardsProps) {
    if (loading) {
        return (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div
                        key={i}
                        className="h-[88px] rounded-2xl border border-gray-200 bg-gray-50 animate-pulse"
                    />
                ))}
            </div>
        );
    }

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            <StatCard label="전체 자재" value={stats.totalItems} />
            <StatCard label="재고 부족 자재" value={stats.lowStockItems} />
            <StatCard label="위치 미지정" value={stats.unlocatedItems} />
            <StatCard label="카테고리 수" value={stats.categoryCount} />
        </div>
    );
}
