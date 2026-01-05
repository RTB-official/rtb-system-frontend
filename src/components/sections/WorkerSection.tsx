import { useState } from "react";
import SectionCard from "../ui/SectionCard";
import Chip from "../ui/Chip";
import TextInput from "../ui/TextInput";
import { useWorkReportStore, STAFF_DATA } from "../../store/workReportStore";

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
                        className="border border-[#e5e7eb] border-dashed rounded-lg p-4 flex flex-col gap-2 bg-white"
                    >
                        <p className="font-semibold text-[14px] text-[#374151]">
                            {rank}
                        </p>
                        <div className="flex gap-2 flex-wrap">
                            {names.map((name) => (
                                <Chip
                                    key={name}
                                    variant={
                                        workers.includes(name)
                                            ? "selected"
                                            : "default"
                                    }
                                    onClick={() =>
                                        workers.includes(name)
                                            ? removeWorker(name)
                                            : addWorker(name)
                                    }
                                >
                                    {name}
                                </Chip>
                            ))}
                        </div>
                    </div>
                ))}

                {/* 직접입력 토글 */}
                <div className="flex gap-2 items-center">
                    <button
                        type="button"
                        onClick={() => setShowDirectInput(!showDirectInput)}
                        className="px-3 py-1.5 border border-[#e5e7eb] rounded-lg text-sm hover:bg-[#f3f4f6] transition-colors"
                    >
                        {showDirectInput ? "직접입력 숨기기" : "직접입력"}
                    </button>
                </div>

                {/* 직접입력 필드 */}
                {showDirectInput && (
                    <div className="flex gap-2 items-end">
                        <div className="flex-1 relative">
                            <TextInput
                                placeholder="이름 입력 후 추가 또는 Enter"
                                value={inputValue}
                                onChange={setInputValue}
                            />
                        </div>
                        <button
                            type="button"
                            onClick={handleAddWorker}
                            onKeyDown={handleKeyDown}
                            className="h-12 px-4 border border-[#e5e7eb] rounded-xl hover:bg-[#f3f4f6] transition-colors font-medium"
                        >
                            추가
                        </button>
                    </div>
                )}

                {/* 선택된 작업자 (투입 인원) */}
                <div className="border border-[#e5e7eb] rounded-lg p-4 flex flex-col gap-2 bg-white">
                    <div className="flex gap-1.5 items-center">
                        <p className="font-medium text-[15px] text-[#101828] leading-[1.467]">
                            투입 인원
                        </p>
                        <p className="font-medium text-[14px] text-[#6a7282] leading-[1.429]">
                            총 {workers.length}명
                        </p>
                    </div>
                    <div className="flex gap-2 flex-wrap min-h-[48px]">
                        {workers.length === 0 ? (
                            <p className="text-[#99a1af] text-sm">
                                위에서 작업자를 선택해주세요
                            </p>
                        ) : (
                            workers.map((worker) => (
                                <Chip
                                    key={worker}
                                    variant="tag"
                                    onRemove={() => removeWorker(worker)}
                                    draggable
                                    onDragStart={(e) =>
                                        e.dataTransfer.setData(
                                            "text/plain",
                                            worker
                                        )
                                    }
                                >
                                    {worker}
                                </Chip>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </SectionCard>
    );
}
