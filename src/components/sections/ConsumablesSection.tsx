import { useState } from "react";
import SectionCard from "../ui/SectionCard";
import Select from "../common/Select";
import Chip from "../ui/Chip";
import {
    useWorkReportStore,
    MATERIALS,
    MATERIAL_UNITS,
} from "../../store/workReportStore";

export default function ConsumablesSection() {
    const { materials, addMaterial, removeMaterial } = useWorkReportStore();

    const [selectedMaterial, setSelectedMaterial] = useState("");
    const [customMaterial, setCustomMaterial] = useState("");
    const [quantity, setQuantity] = useState("1");

    // 선택된 자재명
    const materialName =
        selectedMaterial === "OTHER" ? customMaterial : selectedMaterial;

    // 단위
    const unit =
        selectedMaterial === "OTHER"
            ? ""
            : MATERIAL_UNITS[selectedMaterial] || "";

    // 자재 옵션
    const materialOptions = [
        ...MATERIALS.map((m) => ({ value: m, label: m })),
        { value: "OTHER", label: "기타(직접입력)" },
    ];

    const handleAdd = () => {
        if (!materialName) {
            alert("자재명을 선택하거나 입력하세요.");
            return;
        }
        const qty = Number(quantity);
        if (qty <= 0) {
            alert("수량을 입력하세요.");
            return;
        }

        addMaterial({
            name: materialName,
            qty,
            unit,
        });

        setSelectedMaterial("");
        setCustomMaterial("");
        setQuantity("1");
    };

    // 표시용 라벨 생성
    const formatLabel = (name: string, qty: number, unit: string) => {
        if (name === "보루") {
            return `${name} ${qty * 5}kg`;
        }
        return unit ? `${name} ${qty}${unit}` : `${name} ${qty}`;
    };

    return (
        <SectionCard title="소모 자재">
            <div className="flex flex-col gap-5">
                {/* 자재명 선택 */}
                <div className="flex flex-col gap-2">
                    <Select
                        label="자재명"
                        placeholder="선택"
                        options={materialOptions}
                        value={selectedMaterial}
                        onChange={(v) => {
                            setSelectedMaterial(v);
                            if (v !== "OTHER") setCustomMaterial("");
                        }}
                    />
                    {selectedMaterial === "OTHER" && (
                        <input
                            type="text"
                            placeholder="자재명을 직접 입력"
                            value={customMaterial}
                            onChange={(e) => setCustomMaterial(e.target.value)}
                            className="h-12 px-4 border border-[#e5e7eb] rounded-xl text-[16px]"
                        />
                    )}
                </div>

                {/* 수량 */}
                <div className="flex flex-col gap-2">
                    <label className="font-medium text-[14px] text-[#101828]">
                        수량
                    </label>
                    <div className="relative">
                        <input
                            type="number"
                            min="1"
                            value={quantity}
                            onChange={(e) => setQuantity(e.target.value)}
                            className="w-full h-12 px-4 pr-16 border border-[#e5e7eb] rounded-xl text-[16px]"
                        />
                        {unit && (
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[14px] text-[#6a7282] bg-[#f9fafb] px-2 py-1 rounded-lg border border-[#e5e7eb]">
                                {unit}
                            </span>
                        )}
                    </div>
                </div>

                {/* 추가 버튼 */}
                <button
                    onClick={handleAdd}
                    className="h-12 bg-[#364153] rounded-xl flex items-center justify-center text-white font-medium text-[16px] hover:bg-[#1f2937] transition-colors"
                >
                    추가
                </button>

                {/* 추가된 자재 목록 */}
                {materials.length > 0 && (
                    <div className="flex flex-col gap-3">
                        <div className="h-px bg-[#e5e7eb]" />
                        <div className="flex flex-wrap gap-2 p-4 border border-dashed border-[#e5e7eb] rounded-xl min-h-[60px]">
                            {materials.map((item) => (
                                <Chip
                                    key={item.id}
                                    variant="tag"
                                    onRemove={() => {
                                        if (confirm("삭제하시겠습니까?"))
                                            removeMaterial(item.id);
                                    }}
                                >
                                    {formatLabel(
                                        item.name,
                                        item.qty,
                                        item.unit
                                    )}
                                </Chip>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </SectionCard>
    );
}
