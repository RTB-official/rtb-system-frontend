//consumablesSection.tsx
import { useRef, useState } from "react";
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
    const [isAdding, setIsAdding] = useState(false);
    const isAddingRef = useRef(false);

    // 에러 상태
    const [errors, setErrors] = useState<{
        material?: string;
        quantity?: string;
    }>({});

    // 선택된 자재명
    const materialName =
        selectedMaterial === "OTHER" ? customMaterial : selectedMaterial;

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

    // 수량이 숫자(또는 분수)만 있으면 qty로 저장, 아니면 자유 입력(예: 50ml)으로 unit에 저장
    const getQtyAndUnit = (qtyStr: string): { qty: string; unit: string } => {
        const trimmed = qtyStr.trim();
        const parsed = parseQuantity(trimmed);
        if (parsed != null && parsed > 0) {
            const unit = selectedMaterial === "OTHER" ? "" : MATERIAL_UNITS[selectedMaterial] || "";
            return { qty: trimmed, unit };
        }
        return { qty: "1", unit: trimmed };
    };

    const handleAdd = (quantityFromEvent?: string) => {
        if (isAddingRef.current) return;
        const qtyToUse = quantityFromEvent !== undefined ? quantityFromEvent : quantity;
        const newErrors: typeof errors = {};
        if (!materialName) {
            newErrors.material = "자재명을 선택하거나 입력해주세요";
        }
        if (!qtyToUse.trim()) {
            newErrors.quantity = "수량을 입력해주세요";
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        setErrors({});
        isAddingRef.current = true;
        setIsAdding(true);

        const { qty, unit } = getQtyAndUnit(qtyToUse);
        addMaterial({
            name: materialName,
            qty,
            unit,
        });

        setSelectedMaterial("");
        setCustomMaterial("");
        setQuantity("");

        isAddingRef.current = false;
        setIsAdding(false);
    };

    const handleQuantityKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.preventDefault();
            e.stopPropagation();
            handleAdd((e.target as HTMLInputElement).value);
        }
    };

    const handleMaterialKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.preventDefault();
            e.stopPropagation();
            handleAdd();
        }
    };

    // 표시용 라벨 생성 (단위가 자유 입력(50ml 등)이면 name + unit, 아니면 name + qty + 단위)
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
        const isPresetUnit = unit && Object.values(MATERIAL_UNITS).includes(unit);
        if (isPresetUnit) return `${name} ${qty}${unit}`;
        if (unit) return `${name} ${unit}`;
        return `${name} ${qty}`;
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
                            onKeyDown={handleMaterialKeyDown}
                            error={errors.material}
                        />
                    )}
                </div>

                {/* 수량 (숫자만 또는 50ml 등 단위 포함 자유 입력) */}
                <TextInput
                    label="수량"
                    required
                    type="text"
                    value={quantity}
                    placeholder="예: 1, 0.5, 50ml, 1/3"
                    onChange={(val) => {
                        setQuantity(val);
                        if (errors.quantity) {
                            setErrors((prev) => ({
                                ...prev,
                                quantity: undefined,
                            }));
                        }
                    }}
                    onKeyDown={handleQuantityKeyDown}
                    error={errors.quantity}
                />

                {/* 추가 버튼 */}
                <Button
                    onClick={() => handleAdd()}
                    variant="primary"
                    size="lg"
                    fullWidth
                    loading={isAdding}
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
