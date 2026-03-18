// src/components/sections/BasicInfoSection.tsx
import SectionCard from "../ui/SectionCard";
import TextInput from "../ui/TextInput";
import Select from "../common/Select";
import Button from "../common/Button";
import RequiredIndicator from "../ui/RequiredIndicator";
import { useEffect, useMemo, useRef, useState } from "react";
import { IconClose } from "../icons/Icons";
import {
    useWorkReportStore,
    ORDER_PERSONS,
    LOCATIONS,
    VEHICLES,
} from "../../store/workReportStore";
import CopyPreviousWorkInfoSection from "./CopyPreviousWorkInfoSection";

// 출장 목적 자동완성 단어 목록
const PURPOSE_OPTIONS = [
    "Replacement",
    "R&D",
    "FBIV-A",
    "Atomizer",
    "Spindle Guide",
    "Support",
    "valve",
    "Cylinder",
    "Installation",
    "cover",
    "Inspection",
    "Leakage",
    "Update",
    "Top Cover",
    "Exhasut valve",
    "Introduction",
    "Gasket",
    "Piston",
    "FBIV-M",
    "Conponent",
    "Recovery",
    "Modification",
    "Cyl' #",
    "platform",
    "Troubleshooting",
];

export default function BasicInfoSection() {
    const {
        vessel,
        setVessel,
        engine,
        setEngine,
        orderGroup,
        setOrderGroup,
        orderPerson,
        setOrderPerson,
        locations,
        addLocation,
        removeLocation,
        locationCustom,
        setLocationCustom,
        vehicles,
        toggleVehicle,
        subject,
        setSubject,
    } = useWorkReportStore();

    // 참관 감독 그룹 옵션
    const orderGroupOptions = [
        { value: "ELU", label: "Everllence-ELU" },
        { value: "PRIME", label: "Everllence-Prime" },
        { value: "MITSUI", label: "Mitsui" },
        { value: "OTHER", label: "기타 (직접입력)" },
    ];

    const [customOrderPerson, setCustomOrderPerson] = useState("");
    const [selectedOrderPerson, setSelectedOrderPerson] = useState("");
    const customValue = "__CUSTOM__";
    const [isAddingLocation, setIsAddingLocation] = useState(false);
    const isAddingLocationRef = useRef(false);
    const purposeInputRef = useRef<HTMLInputElement>(null);

    const orderPersonOptions = useMemo(() => {
        if (!orderGroup || orderGroup === "OTHER" || orderGroup === "MITSUI") return [];
        const baseOptions = (ORDER_PERSONS[orderGroup] || []).map((name) => ({
            value: name,
            label: name,
        }));
        return [
            ...baseOptions,
            { value: customValue, label: "직접입력" },
        ];
    }, [orderGroup]);

    const isCustomSelected =
        !!orderGroup &&
        orderGroup !== "OTHER" &&
        orderGroup !== "MITSUI" &&
        orderPerson &&
        !orderPersonOptions.some((opt) => opt.value === orderPerson);

    const selectOrderPersonValue = selectedOrderPerson || (isCustomSelected ? customValue : orderPerson);

    useEffect(() => {
        if (!orderGroup || orderGroup === "OTHER" || orderGroup === "MITSUI") return;
        if (isCustomSelected) {
            setSelectedOrderPerson(customValue);
            setCustomOrderPerson(orderPerson);
        } else if (orderPerson) {
            setSelectedOrderPerson(orderPerson);
            setCustomOrderPerson("");
        }
    }, [orderGroup, isCustomSelected, orderPerson]);

    // 출장지 옵션
    const locationOptions = [
        ...LOCATIONS.map((loc) => ({ value: loc, label: loc })),
        { value: "OTHER", label: "기타(직접입력)" },
    ];

    const [selectedLocation, setSelectedLocation] = useState("");

    const handleSelectLocation = (value: string) => {
        setSelectedLocation(value);
        if (value !== "OTHER") {
            addLocation(value);
            setSelectedLocation("");
        }
    };

    const handleAddCustomLocation = () => {
        if (isAddingLocationRef.current) return;
        const next = locationCustom.trim();
        if (!next) return;
        isAddingLocationRef.current = true;
        setIsAddingLocation(true);
        addLocation(next);
        setLocationCustom("");
        setSelectedLocation("");
        isAddingLocationRef.current = false;
        setIsAddingLocation(false);
    };

    const handleCustomKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.preventDefault();
            handleAddCustomLocation();
        }
    };

    const handlePurposeClick = (purpose: string) => {
        // 공백이 있으면 마지막 단어만 교체, 없으면 전체 교체
        if (subject && subject.trim().includes(" ")) {
            const parts = subject.trim().split(/\s+/);
            parts[parts.length - 1] = purpose;
            setSubject(parts.join(" "));
        } else {
            setSubject(purpose);
        }
        // 모바일에서 키보드가 사라지지 않도록 포커스 유지
        setTimeout(() => {
            purposeInputRef.current?.focus();
        }, 0);
    };

    // 입력한 텍스트와 일치하는 목적 옵션 필터링
    const filteredPurposeOptions = useMemo(() => {
        if (!subject || subject.trim() === "") {
            return [];
        }
        // 공백이 있으면 마지막 단어만 사용, 없으면 전체 텍스트 사용
        const parts = subject.trim().split(/\s+/);
        const searchText = parts[parts.length - 1].toLowerCase();
        
        if (searchText === "") {
            return [];
        }
        
        return PURPOSE_OPTIONS.filter((option) =>
            option.toLowerCase().startsWith(searchText)
        );
    }, [subject]);

    return (
        <SectionCard title="기본 정보">
            <div className="flex flex-col gap-5 md:gap-7">
                {/* 이전 작업 기본정보 복사 + 참관감독 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:items-start">
                    {/* 이전 작업 기본정보 복사 */}
                    <div className="relative z-10">
                        <CopyPreviousWorkInfoSection />
                    </div>
                    
                    {/* 참관감독 선택 */}
                    <div className="flex flex-col gap-2 relative z-0">
                        <Select
                            label="참관감독"
                            placeholder="그룹 선택"
                            fullWidth
                            required
                            options={orderGroupOptions}
                            value={orderGroup}
                            onChange={setOrderGroup}
                        />
                        {orderGroup === "OTHER" || orderGroup === "MITSUI" ? (
                            <TextInput
                                placeholder="직급 없이 이름만 기입해 주세요"
                                value={orderPerson}
                                onChange={setOrderPerson}
                                required
                            />
                        ) : orderGroup ? (
                            <Select
                                placeholder="감독 선택"
                                fullWidth
                                required
                                options={orderPersonOptions}
                                value={selectOrderPersonValue}
                                onChange={(value) => {
                                    setSelectedOrderPerson(value);
                                    if (value === customValue) {
                                        setCustomOrderPerson(orderPerson);
                                        setOrderPerson(customOrderPerson || "");
                                        return;
                                    }
                                    setOrderPerson(value);
                                    setCustomOrderPerson("");
                                }}
                            />
                        ) : null}
                        {(orderGroup && orderGroup !== "OTHER" && orderGroup !== "MITSUI") &&
                            (selectOrderPersonValue === customValue || isCustomSelected) && (
                                <TextInput
                                    placeholder="직급 없이 이름만 기입해 주세요"
                                    value={customOrderPerson || orderPerson}
                                    onChange={(val) => {
                                        setCustomOrderPerson(val);
                                        setOrderPerson(val);
                                    }}
                                    required
                                />
                            )}
                    </div>
                </div>

                {/* 운행차량 */}
                <div className="flex flex-col gap-2">
                    <div className="flex items-center">
                        <label className="font-medium text-[14px] md:text-[15px] text-gray-900 leading-[1.467]">
                            운행차량 (다중 선택 가능)
                        </label>
                        <RequiredIndicator />
                    </div>
                    <div className="grid grid-cols-4 md:flex md:flex-wrap gap-2">
                        {VEHICLES.map((vehicle) => (
                            <Button
                                key={vehicle}
                                size="md"
                                variant={
                                    vehicles.includes(vehicle)
                                        ? "primary"
                                        : "outline"
                                }
                                onClick={() => toggleVehicle(vehicle)}
                                className="w-full md:w-auto text-[13px] md:text-[16px]"
                            >
                                {vehicle}
                            </Button>
                        ))}
                    </div>
                </div>

                {/* 출장지, 호선명 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:items-start">
                    <div className="flex flex-col gap-2">
                        <Select
                            label="출장지"
                            placeholder="출장지 선택"
                            fullWidth
                            required
                            options={locationOptions}
                            value={selectedLocation}
                            onChange={handleSelectLocation}
                        />
                        {selectedLocation === "OTHER" && (
                            <div className="flex items-center gap-2 w-full">
                                <TextInput
                                    placeholder="출장지를 직접 입력"
                                    value={locationCustom}
                                    onChange={setLocationCustom}
                                    onKeyDown={handleCustomKeyDown}
                                    required
                                    className="flex-1 min-w-0"
                                />
                                <Button
                                    type="button"
                                    variant="primary"
                                    size="lg"
                                    onClick={handleAddCustomLocation}
                                    loading={isAddingLocation}
                                    className="shrink-0"
                                >
                                    추가
                                </Button>
                            </div>
                        )}
                        {locations.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {locations.map((loc) => (
                                    <Button
                                        key={loc}
                                        type="button"
                                        variant="secondary"
                                        size="md"
                                        onClick={() => removeLocation(loc)}
                                    >
                                        {loc}
                                        <IconClose className="ml-1 w-4 h-4" />
                                    </Button>
                                ))}
                            </div>
                        )}
                    </div>
                    <TextInput
                        label="호선명"
                        placeholder="예) 한국호"
                        required
                        value={vessel}
                        onChange={setVessel}
                        uppercase
                    />
                </div>

                {/* 엔진타입 */}
                <TextInput
                    label="엔진 타입"
                    placeholder="엔진 타입을 입력해 주세요"
                    required
                    value={engine}
                    onChange={setEngine}
                    uppercase
                />

                {/* 출장목적 */}
                <div className="flex flex-col gap-2">
                    <TextInput
                        label="출장 목적"
                        placeholder="선박 점검 및 정비"
                        required
                        value={subject}
                        onChange={setSubject}
                        autoComplete="off"
                        inputRef={purposeInputRef}
                    />
                    {/* 자동완성 버튼 영역 */}
                    <div className="min-h-[60px] flex flex-wrap gap-2 py-2">
                        {filteredPurposeOptions.map((purpose) => (
                            <button
                                key={purpose}
                                type="button"
                                onClick={(e) => {
                                    e.preventDefault();
                                    handlePurposeClick(purpose);
                                }}
                                onMouseDown={(e) => {
                                    // 모바일에서 포커스가 벗어나지 않도록 방지
                                    e.preventDefault();
                                }}
                                className="px-3 py-1.5 rounded-lg bg-sky-100 text-blue-700 font-medium text-sm hover:bg-sky-200 transition-colors"
                            >
                                {purpose}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </SectionCard>
    );
}
