import { useState } from "react";
import SectionCard from "../ui/SectionCard";
import Chip from "../ui/Chip";
import TextInput from "../ui/TextInput";
import Button from "../common/Button";
import { useWorkReportStore, STAFF_DATA } from "../../store/workReportStore";
import { IconClose } from "../icons/Icons";

export default function WorkerSection() {
    const { workers, addWorker, removeWorker } = useWorkReportStore();
    const [showDirectInput, setShowDirectInput] = useState(false);
    const [inputValue, setInputValue] = useState("");

    const handleAddWorker = () => {
        if (inputValue.trim()) {
            addWorker(inputValue.trim());
            setInputValue("");
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            e.preventDefault();
            handleAddWorker();
        }
    };

    // 직급별 그룹 (인원이 있는 것만 표시)
    const staffGroups = Object.entries(STAFF_DATA).filter(
        ([, names]) => names.length > 0
    );

    return (
        <SectionCard title="작업자 명단">
            <div className="flex flex-col gap-4">
                {/* 직급별 카탈로그 */}
                {staffGroups.map(([rank, names]) => (
                    <div
                        key={rank}
                        className="border border-gray-200 border-dashed rounded-2xl p-4 flex flex-col gap-2"
                    >
                        <p className="font-semibold text-[15px] text-gray-800">
                            {rank}
                        </p>
                        <div className="flex gap-2 flex-wrap">
                            {names.map((name) => (
                                <Button
                                    key={name}
                                    size="md"
                                    variant={
                                        workers.includes(name)
                                            ? "primary"
                                            : "outline"
                                    }
                                    onClick={() =>
                                        workers.includes(name)
                                            ? removeWorker(name)
                                            : addWorker(name)
                                    }
                                >
                                    {name}
                                </Button>
                            ))}
                        </div>
                    </div>
                ))}

                {/* 직접입력 토글 */}
                <div className="flex gap-2 items-center">
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setShowDirectInput(!showDirectInput)}
                    >
                        {showDirectInput ? "직접입력 숨기기" : "직접입력"}
                    </Button>
                </div>

                {/* 직접입력 필드 */}
                {showDirectInput && (
                    <div className="flex gap-2 items-end -mt-2">
                        <div className="flex-1 relative">
                            <TextInput
                                placeholder="이름 입력 후 추가 또는 Enter"
                                value={inputValue}
                                onChange={setInputValue}
                            />
                        </div>
                        <Button
                            type="button"
                            variant="primary"
                            size="lg"
                            onClick={handleAddWorker}
                            onKeyDown={handleKeyDown}
                        >
                            추가
                        </Button>
                    </div>
                )}

                {/* 선택된 작업자 (투입 인원) */}
                <div className="border border-[#e5e7eb] rounded-xl px-4 py-3 flex flex-col gap-2 bg-white">
                    <div className="flex gap-1.5 items-center">
                        <p className="font-medium text-[15px] text-gray-900">
                            투입 인원
                        </p>
                        <p className="font-medium text-[14px] text-gray-400">
                            총 {workers.length}명
                        </p>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                        {workers.length === 0 ? (
                            <p className="text-[#99a1af] text-sm">
                                위에서 작업자를 선택해주세요
                            </p>
                        ) : (
                            workers.map((worker) => (
                                <Button
                                    key={worker}
                                    variant="secondary"
                                    size="md"
                                    onClick={() => removeWorker(worker)}
                                >
                                    {worker}
                                    <IconClose className="ml-1 w-4 h-4" />
                                </Button>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </SectionCard>
    );
}
