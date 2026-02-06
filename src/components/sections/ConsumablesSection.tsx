//consumablesSection.tsx
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

    // 에러 상태
    const [errors, setErrors] = useState<{
        material?: string;
        quantity?: string;
    }>({});

    // 선택된 자재명
    const materialName =
        selectedMaterial === "OTHER" ? customMaterial : selectedMaterial;

    // 단위
    const unit =
        selectedMaterial === "OTHER"
            ? ""
            : MATERIAL_UNITS[selectedMaterial] || "";

    // 자재 옵션
    const getMaterialLabel = (name: string) => {
        if (name === "보루") return "보루/5kg";
        const unitLabel = MATERIAL_UNITS[name];
        if (unitLabel && unitLabel !== "EA") return `${name}/${unitLabel}`;
        return name;
    };

    const materialOptions = [
        ...MATERIALS.map((m) => ({ value: m, label: getMaterialLabel(m) })),
        { value: "OTHER", label: "기타(직접입력)" },
    ];

    const parseQuantity = (value: string) => {
        const raw = value.trim();
        if (!raw) return null;
        if (/^\d+(\.\d+)?$/.test(raw)) return Number(raw);
        const fractionMatch = raw.match(/^(\d+)\s*\/\s*(\d+)$/);
        if (fractionMatch) {
            const numerator = Number(fractionMatch[1]);
            const denominator = Number(fractionMatch[2]);
            if (!denominator) return null;
            return numerator / denominator;
        }
        return null;
    };

    const handleAdd = () => {
        // 유효성 검사
        const newErrors: typeof errors = {};
        if (!materialName) {
            newErrors.material = "자재명을 선택하거나 입력해주세요";
        }
        const parsedQty = parseQuantity(quantity);
        if (!parsedQty || parsedQty <= 0) {
            newErrors.quantity = "수량을 입력해주세요";
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        setErrors({});

        addMaterial({
            name: materialName,
            qty: quantity.trim(),
            unit,
        });

        setSelectedMaterial("");
        setCustomMaterial("");
        setQuantity("1");
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.preventDefault();
            handleAdd();
        }
    };

    // 표시용 라벨 생성
    const formatLabel = (name: string, qty: string, unit: string) => {
        if (name === "보루") {
            const parsedQty = parseQuantity(qty) ?? 0;
            const kgValue = parsedQty * 5;
            const kgLabel =
                Number.isFinite(kgValue) && kgValue % 1 !== 0
                    ? kgValue.toFixed(2).replace(/\.?0+$/, "")
                    : String(kgValue);
            return `${name} ${kgLabel}kg`;
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
                        fullWidth
                        required
                        options={materialOptions}
                        value={selectedMaterial}
                        onChange={(v) => {
                            setSelectedMaterial(v);
                            if (v !== "OTHER") setCustomMaterial("");
                            if (errors.material) {
                                setErrors((prev) => ({
                                    ...prev,
                                    material: undefined,
                                }));
                            }
                        }}
                        error={selectedMaterial !== "OTHER" ? errors.material : undefined}
                    />
                    {selectedMaterial === "OTHER" && (
                        <TextInput
                            placeholder="자재명을 직접 입력"
                            value={customMaterial}
                            onChange={(val) => {
                                setCustomMaterial(val);
                                if (errors.material) {
                                    setErrors((prev) => ({
                                        ...prev,
                                        material: undefined,
                                    }));
                                }
                            }}
                            onKeyDown={handleKeyDown}
                            error={errors.material}
                        />
                    )}
                </div>

                {/* 수량 */}
                <TextInput
                    label="수량"
                    required
                    type="text"
                    value={quantity}
                    placeholder="예: 1, 0.5, 1/3"
                    onChange={(val) => {
                        setQuantity(val);
                        if (errors.quantity) {
                            setErrors((prev) => ({
                                ...prev,
                                quantity: undefined,
                            }));
                        }
                    }}
                    onKeyDown={handleKeyDown}
                    className="relative"
                    icon={
                        unit ? (
                            <span className="text-[14px] text-[#6a7282] bg-[#f9fafb] px-2 py-1 rounded-lg border border-[#e5e7eb]">
                                {unit}
                            </span>
                        ) : undefined
                    }
                    error={errors.quantity}
                />

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
                        <div className="flex flex-wrap gap-2">
                            {materials.map((item) => (
                                <Button
                                    key={item.id}
                                    variant="secondary"
                                    size="md"
                                    onClick={() => {
                                        removeMaterial(item.id);
                                    }}
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
