// src/components/sections/EducationBasicInfoSection.tsx
import SectionCard from "../ui/SectionCard";
import TextInput from "../ui/TextInput";
import Select from "../common/Select";
import {
    useWorkReportStore,
    LOCATIONS,
} from "../../store/workReportStore";

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
        location,
        setLocation,
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
                        value={location}
                        onChange={setLocation}
                    />
                    {location === "OTHER" && (
                        <TextInput
                            placeholder="교육 장소를 직접 입력"
                            value={locationCustom}
                            onChange={setLocationCustom}
                            required
                        />
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
