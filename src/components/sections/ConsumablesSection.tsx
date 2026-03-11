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
        setQuantity("1"); // 기본값 1로 유지

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
                <div className="flex flex-col gap-2">
                    <label className="font-medium text-[14px] md:text-[15px] text-[#101828] leading-[1.467]">
                        수량
                        <span className="text-red-600 text-sm ml-1">*</span>
                    </label>
                    <div className="relative">
                        <input
                            type="text"
                            inputMode="numeric"
                            value={quantity}
                            placeholder="예: 1, 0.5, 50ml, 1/3"
                            onChange={(e) => {
                                setQuantity(e.target.value);
                                if (errors.quantity) {
                                    setErrors((prev) => ({
                                        ...prev,
                                        quantity: undefined,
                                    }));
                                }
                            }}
                            onKeyDown={handleQuantityKeyDown}
                            className="w-full h-12 border border-gray-200 rounded-xl px-4 pr-12 text-base text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                        />
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col gap-0.5">
                            <button
                                type="button"
                                onClick={() => {
                                    const parsed = parseQuantity(quantity);
                                    if (parsed != null) {
                                        setQuantity(String(parsed + 1));
                                    } else {
                                        setQuantity("1");
                                    }
                                }}
                                className="w-6 h-5 flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-t transition-colors"
                            >
                                <svg
                                    className="w-3 h-3"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    xmlns="http://www.w3.org/2000/svg"
                                >
                                    <path
                                        d="M18 15L12 9L6 15"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                </svg>
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    const parsed = parseQuantity(quantity);
                                    if (parsed != null && parsed > 1) {
                                        setQuantity(String(parsed - 1));
                                    } else if (parsed != null && parsed <= 1) {
                                        setQuantity("1");
                                    } else {
                                        setQuantity("1");
                                    }
                                }}
                                className="w-6 h-5 flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-b transition-colors"
                            >
                                <svg
                                    className="w-3 h-3"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    xmlns="http://www.w3.org/2000/svg"
                                >
                                    <path
                                        d="M6 9L12 15L18 9"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                </svg>
                            </button>
                        </div>
                    </div>
                    {errors.quantity && (
                        <p className="text-sm text-red-500">{errors.quantity}</p>
                    )}
                </div>

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
