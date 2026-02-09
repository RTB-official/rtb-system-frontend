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
        { value: "OTHER", label: "기타 (직접입력)" },
    ];

    const [customOrderPerson, setCustomOrderPerson] = useState("");
    const [selectedOrderPerson, setSelectedOrderPerson] = useState("");
    const customValue = "__CUSTOM__";
    const [isAddingLocation, setIsAddingLocation] = useState(false);
    const isAddingLocationRef = useRef(false);

    const orderPersonOptions = useMemo(() => {
        if (!orderGroup || orderGroup === "OTHER") return [];
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
        orderPerson &&
        !orderPersonOptions.some((opt) => opt.value === orderPerson);

    const selectOrderPersonValue = selectedOrderPerson || (isCustomSelected ? customValue : orderPerson);

    useEffect(() => {
        if (!orderGroup || orderGroup === "OTHER") return;
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

    return (
        <SectionCard title="기본 정보">
            <div className="flex flex-col gap-5 md:gap-7">
                {/* 참관감독 선택 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:items-end">
                    <Select
                        label="참관감독"
                        placeholder="그룹 선택"
                        fullWidth
                        required
                        options={orderGroupOptions}
                        value={orderGroup}
                        onChange={setOrderGroup}
                    />
                    {orderGroup === "OTHER" ? (
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
                    ) : (
                        <div className="hidden sm:block" />
                    )}
                    {(orderGroup && orderGroup !== "OTHER") &&
                        (selectOrderPersonValue === customValue || isCustomSelected) && (
                            <>
                                <div className="hidden sm:block" />
                                <TextInput
                                    placeholder="직급 없이 이름만 기입해 주세요"
                                    value={customOrderPerson || orderPerson}
                                    onChange={(val) => {
                                        setCustomOrderPerson(val);
                                        setOrderPerson(val);
                                    }}
                                    required
                                />
                            </>
                        )}
                </div>

                {/* 운행차량 */}
                <div className="flex flex-col gap-2">
                    <div className="flex items-center">
                        <label className="font-medium text-[14px] md:text-[15px] text-gray-900 leading-[1.467]">
                            운행차량 (다중 선택 가능)
                        </label>
                        <RequiredIndicator />
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {VEHICLES.map((vehicle) => (
                            <Button
                                key={vehicle}
                                size="lg"
                                variant={
                                    vehicles.includes(vehicle)
                                        ? "primary"
                                        : "outline"
                                }
                                onClick={() => toggleVehicle(vehicle)}
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

                {/* 출장목적 */}
                <TextInput
                    label="출장 목적"
                    placeholder="선박 점검 및 정비"
                    required
                    value={subject}
                    onChange={setSubject}
                />

                {/* 엔진타입 */}
                <TextInput
                    label="엔진 타입"
                    placeholder="엔진 타입을 입력해 주세요"
                    required
                    value={engine}
                    onChange={setEngine}
                    uppercase
                />
            </div>
        </SectionCard>
    );
}
