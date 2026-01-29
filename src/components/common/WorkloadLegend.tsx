type LegendItem = {
    key: string;
    label: string;
    color: string;
};

interface WorkloadLegendProps {
    items?: LegendItem[];
    className?: string;
    itemClassName?: string;
    labelClassName?: string;
    swatchClassName?: string;
}

const DEFAULT_ITEMS: LegendItem[] = [
    { key: "work", label: "작업", color: "#51a2ff" },
    { key: "move", label: "이동", color: "#fd9a00" },
    { key: "wait", label: "대기", color: "#d1d5dc" },
];

export default function WorkloadLegend({
    items = DEFAULT_ITEMS,
    className = "flex items-center gap-5",
    itemClassName = "flex items-center gap-1.5",
    labelClassName = "text-[13px] text-gray-500",
    swatchClassName = "w-4 h-4 rounded",
}: WorkloadLegendProps) {
    return (
        <div className={className}>
            {items.map((item) => (
                <span key={item.key} className={itemClassName}>
                    <span
                        className={swatchClassName}
                        style={{ backgroundColor: item.color }}
                    />
                    <span className={labelClassName}>{item.label}</span>
                </span>
            ))}
        </div>
    );
}
