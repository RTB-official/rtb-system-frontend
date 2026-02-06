// src/components/sections/EducationBasicInfoSection.tsx
import SectionCard from "../ui/SectionCard";
import TextInput from "../ui/TextInput";
import Select from "../common/Select";
import Button from "../common/Button";
import { IconClose } from "../icons/Icons";
import {
    useWorkReportStore,
    LOCATIONS,
} from "../../store/workReportStore";
import { useRef, useState } from "react";

const EDUCATION_LOCATION_BLACKLIST = [
    "PNC",
    "PNIT",
    "HPNT",
    "BNCT",
    "HJNC",
];

export default function EducationBasicInfoSection() {
    const {
        instructor,
        setInstructor,
        locations,
        addLocation,
        removeLocation,
        locationCustom,
        setLocationCustom,
        subject,
        setSubject,
    } = useWorkReportStore();

    const educationLocations = LOCATIONS.filter(
        (loc) => !EDUCATION_LOCATION_BLACKLIST.includes(loc)
    );

    const locationOptions = [
        ...educationLocations.map((loc) => ({ value: loc, label: loc })),
        { value: "OTHER", label: "기타(직접입력)" },
    ];

    const [selectedLocation, setSelectedLocation] = useState("");
    const [isAddingLocation, setIsAddingLocation] = useState(false);
    const isAddingLocationRef = useRef(false);

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
                {/* 교육 강사 */}
                <TextInput
                    label="교육 강사"
                    placeholder="강사명을 입력해 주세요"
                    required
                    value={instructor}
                    onChange={setInstructor}
                />

                {/* 교육 장소 (출장지 로직 재사용) */}
                <div className="flex flex-col gap-2">
                    <Select
                        label="교육 장소"
                        placeholder="장소 선택"
                        fullWidth
                        required
                        options={locationOptions}
                        value={selectedLocation}
                        onChange={handleSelectLocation}
                    />
                    {selectedLocation === "OTHER" && (
                        <div className="flex items-center gap-2">
                            <TextInput
                                placeholder="교육 장소를 직접 입력"
                                value={locationCustom}
                                onChange={setLocationCustom}
                                onKeyDown={handleCustomKeyDown}
                                required
                            />
                            <Button
                                type="button"
                                variant="secondary"
                                size="md"
                                onClick={handleAddCustomLocation}
                                loading={isAddingLocation}
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
                                    className="text-blue-600"
                                >
                                    {loc}
                                    <IconClose className="ml-1 w-4 h-4" />
                                </Button>
                            ))}
                        </div>
                    )}
                </div>

                {/* 교육 내용 (Subject 재사용) */}
                <TextInput
                    label="교육 내용"
                    placeholder="교육 내용을 입력해 주세요"
                    required
                    value={subject}
                    onChange={setSubject}
                />
            </div>
        </SectionCard>
    );
}
