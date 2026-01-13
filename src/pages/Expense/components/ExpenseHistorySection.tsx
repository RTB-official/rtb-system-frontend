import SectionCard from "../../../components/ui/SectionCard";
import ExpenseListItem from "./ExpenseListItem";

export interface ExpenseHistoryItem {
    id: number;
    variant: "mileage" | "card";
    date: string;
    amount: string;
    routeLabel?: string;
    distanceLabel?: string;
    tag?: string;
    desc?: string;
    img?: string | null;
    isSubmitted?: boolean;
}

interface ExpenseHistorySectionProps {
    title: string;
    items: ExpenseHistoryItem[];
    emptyMessage: string;
    submittedIds?: number[]; // deprecated, isSubmitted 사용
    onRemove?: (id: number) => void;
}

export default function ExpenseHistorySection({
    title,
    items,
    emptyMessage,
    submittedIds,
    onRemove,
}: ExpenseHistorySectionProps) {
    return (
        <SectionCard title={title} className="h-full">
            {items.length === 0 ? (
                <div className="text-gray-400 py-12 text-center rounded-2xl border border-dashed border-gray-200 bg-white">
                    {emptyMessage}
                </div>
            ) : (
                <div className="flex flex-col gap-3">
                    {items.map((item) => (
                        <ExpenseListItem
                            key={item.id}
                            variant={item.variant}
                            date={item.date}
                            amount={item.amount}
                            routeLabel={item.routeLabel}
                            distanceLabel={item.distanceLabel}
                            tag={item.tag}
                            desc={item.desc}
                            img={item.img}
                            submitted={item.isSubmitted ?? submittedIds?.includes(item.id) ?? false}
                            onRemove={
                                onRemove ? () => onRemove(item.id) : undefined
                            }
                        />
                    ))}
                </div>
            )}
        </SectionCard>
    );
}
