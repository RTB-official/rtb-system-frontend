import React from "react";
import { IconCar, IconCalendar } from "../../../components/icons/Icons";
import DatePicker from "../../../components/ui/DatePicker";
import Input from "../../../components/common/Input";
import Button from "../../../components/common/Button";
import SectionCard from "../../../components/ui/SectionCard";

export default function MileageCard({
    onAdd,
    initialDate,
}: {
    onAdd?: (item: any) => void;
    initialDate?: string;
}) {
    const [date, setDate] = React.useState(initialDate || "");
    React.useEffect(() => {
        if (initialDate) setDate(initialDate);
    }, [initialDate]);
    const [from, setFrom] = React.useState("자택");
    const [to, setTo] = React.useState("공장/사무실");
    const [distance, setDistance] = React.useState("");
    const [note, setNote] = React.useState("");

    const chips = ["자택", "공장/사무실", "출장지"];
    const costPerKm = 250;
    const cost = Number(distance || 0) * costPerKm;
    const numericCost = cost.toLocaleString("ko-KR");
    const formattedCost = (
        <span className="text-[22px] font-extrabold text-gray-900">
            {numericCost}원
        </span>
    );

    const handleAdd = () => {
        if (onAdd) {
            onAdd({
                id: Date.now(),
                date,
                from,
                to,
                distance,
                note,
                cost,
            });
            // Reset form
            setDistance("");
            setNote("");
        }
    };

    return (
        <SectionCard
            title={
                <span className="flex items-center gap-2 text-gray-900">
                    <IconCar />
                    개인 차량 마일리지
                </span>
            }
            className="h-full border-gray-200"
        >
            <div className="flex-1 flex flex-col justify-between gap-6">
                <div className="space-y-4">
                    <DatePicker
                        label="날짜"
                        value={date}
                        onChange={setDate}
                        placeholder="연도. 월. 일"
                        icon={<IconCalendar className="w-6 h-6" />}
                        iconPosition="right"
                    />

                    <div className="grid grid-cols-2 gap-4">
                        <div className="min-w-0">
                            <label className="text-xs text-gray-500 mb-2 block">
                                출발지
                            </label>
                            <div className="flex flex-wrap gap-1.5">
                                {chips.map((c) => (
                                    <Button
                                        key={c}
                                        onClick={() => setFrom(c)}
                                        variant={
                                            from === c ? "primary" : "outline"
                                        }
                                        size="sm"
                                        className="h-8! px-2! text-xs! md:h-[30px]! md:px-2! md:text-[13px]!"
                                    >
                                        {c}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        <div className="min-w-0">
                            <label className="text-xs text-gray-500 mb-2 block">
                                도착지
                            </label>
                            <div className="flex flex-wrap gap-1.5">
                                {chips.map((c) => (
                                    <Button
                                        key={c}
                                        onClick={() => setTo(c)}
                                        variant={
                                            to === c ? "primary" : "outline"
                                        }
                                        size="sm"
                                        className="h-8! px-2! text-xs! md:h-[30px]! md:px-2! md:text-[13px]!"
                                    >
                                        {c}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div>
                        <Input
                            label="거리(km)"
                            value={distance}
                            onChange={setDistance}
                            placeholder="예) 120"
                        />
                        <div className="mt-2 flex gap-2">
                            <Button
                                variant="outline"
                                size="md"
                                onClick={() =>
                                    setDistance(
                                        String(Number(distance || 0) + 1)
                                    )
                                }
                            >
                                +1km
                            </Button>
                            <Button
                                variant="outline"
                                size="md"
                                onClick={() =>
                                    setDistance(
                                        String(Number(distance || 0) + 5)
                                    )
                                }
                            >
                                +5km
                            </Button>
                            <Button
                                variant="outline"
                                size="md"
                                onClick={() =>
                                    setDistance(
                                        String(Number(distance || 0) + 10)
                                    )
                                }
                            >
                                +10km
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="space-y-3">
                    <div>
                        <Input
                            label="호선 및 기타사항"
                            value={note}
                            onChange={setNote}
                            placeholder="호선 및 기타사항"
                        />
                    </div>
                </div>
            </div>

            <div className="mt-2">
                <div className="flex items-center justify-between mb-2">
                    <div className="text-base text-gray-500">마일리지</div>
                    <div className="text-base font-semibold">
                        {formattedCost}
                    </div>
                </div>
                <Button
                    variant="secondary"
                    size="lg"
                    fullWidth
                    onClick={handleAdd}
                >
                    추가
                </Button>
            </div>
        </SectionCard>
    );
}
