import { useState } from "react";
import SectionCard from "../ui/SectionCard";
import Select from "../common/Select";
import Chip from "../ui/Chip";
import Button from "../common/Button";
import TextInput from "../ui/TextInput";
import {
    useWorkReportStore,
    MATERIALS,
    MATERIAL_UNITS,
} from "../../store/workReportStore";
import { IconClose } from "../icons/Icons";

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
                        <TextInput
                            placeholder="자재명을 직접 입력"
                            value={customMaterial}
                            onChange={setCustomMaterial}
                        />
                    )}
                </div>

                {/* 수량 */}
                <div className="flex flex-col gap-2">
                    <TextInput
                        label="수량"
                        type="number"
                        value={quantity}
                        onChange={setQuantity}
                        className="relative"
                        icon={
                            unit ? (
                                <span className="text-[14px] text-[#6a7282] bg-[#f9fafb] px-2 py-1 rounded-lg border border-[#e5e7eb]">
                                    {unit}
                                </span>
                            ) : undefined
                        }
                    />
                </div>

                {/* 추가 버튼 */}
                <Button
                    onClick={handleAdd}
                    variant="primary"
                    size="lg"
                    fullWidth
                >
                    추가
                </Button>

                {/* 추가된 자재 목록 */}
                {materials.length > 0 && (
                    <div className="flex flex-col gap-3">
                        <div className="flex flex-wrap gap-2 p-4 border border-dashed border-[#e5e7eb] rounded-xl min-h-[60px]">
                            {materials.map((item) => (
                                <Button
                                    key={item.id}
                                    variant="secondary"
                                    size="md"
                                    onClick={() => {
                                        if (confirm("삭제하시겠습니까?"))
                                            removeMaterial(item.id);
                                    }}
                                    className="text-[15px] font-semibold"
                                >
                                    {formatLabel(
                                        item.name,
                                        item.qty,
                                        item.unit
                                    )}
                                    <IconClose className="ml-1 w-4 h-4" />
                                </Button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </SectionCard>
    );
}
