import { useState, useRef, useEffect } from "react";
import SectionCard from "../ui/SectionCard";
import TextInput from "../ui/TextInput";
import Button from "../common/Button";
import { useWorkReportStore } from "../../store/workReportStore";
import { IconClose } from "../icons/Icons";
import { supabase } from "../../lib/supabase";

// 직급 순서 정의 (높은 순)
const ROLE_ORDER: Record<string, number> = {
    "대표": 1,
    "감사": 2,
    "부장": 3,
    "차장": 4,
    "과장": 5,
    "대리": 6,
    "주임": 7,
    "사원": 8,
    "인턴": 9,
};

type StaffMember = {
    name: string;
    position: string;
    department: string;
};

export default function WorkerSection() {
    const { workers, addWorker, removeWorker } = useWorkReportStore();
    const [showDirectInput, setShowDirectInput] = useState(false);
    const [inputValue, setInputValue] = useState("");
    const [isAdding, setIsAdding] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
    const [loading, setLoading] = useState(true);

    const handleAddWorker = () => {
        if (isAdding) return; // 이미 추가 중이면 무시
        const trimmed = inputValue.trim();
        if (!trimmed) return;
        
        setIsAdding(true);
        const valueToAdd = trimmed;
        
        // 입력 필드 즉시 비우기
        setInputValue("");
        if (inputRef.current) {
            inputRef.current.value = "";
        }
        
        addWorker(valueToAdd);
        // 다음 이벤트 루프에서 다시 추가 가능하도록
        setTimeout(() => setIsAdding(false), 0);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.preventDefault();
            e.stopPropagation();
            // 입력 필드 즉시 비우기 (상태와 DOM 모두)
            setInputValue("");
            if (inputRef.current) {
                inputRef.current.value = "";
            }
            handleAddWorker();
        }
    };

    // 구성원 데이터 로드
    useEffect(() => {
        const fetchStaffMembers = async () => {
            try {
                setLoading(true);
                const { data, error } = await supabase
                    .from("profiles")
                    .select("name, position, department")
                    .not("name", "is", null)
                    .neq("name", "");

                if (error) {
                    console.error("구성원 데이터 로드 실패:", error);
                    return;
                }

                const members: StaffMember[] = (data || []).map((p: any) => ({
                    name: p.name ?? "",
                    position: p.position ?? p.role ?? "",
                    department: p.department ?? "",
                }));

                setStaffMembers(members);
            } catch (err) {
                console.error("구성원 데이터 로드 중 오류:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchStaffMembers();
    }, []);

    // 공무팀과 일반 직원 분리
    const adminTeamMembers = staffMembers.filter(
        (m) => m.department === "공무팀"
    );
    const regularMembers = staffMembers.filter(
        (m) => m.department !== "공무팀"
    );

    // 직급별 그룹화
    const roleGroups = regularMembers.reduce(
        (acc, member) => {
            const role = member.position || "";
            if (!role) return acc;

            if (!acc[role]) {
                acc[role] = [];
            }
            acc[role].push(member.name);
            return acc;
        },
        {} as Record<string, string[]>
    );

    // 직급 순서대로 정렬된 그룹 배열 (인원이 있는 것만 표시, 사원은 예외)
    const staffGroups = Object.entries(roleGroups)
        .filter(([role, names]) => {
            // 사원인 경우: 인원이 있을 때만 표시
            if (role === "사원") {
                return names.length > 0;
            }
            // 기타 직급: 인원이 있을 때만 표시
            return names.length > 0;
        })
        .sort(([roleA], [roleB]) => {
            const orderA = ROLE_ORDER[roleA] ?? 999;
            const orderB = ROLE_ORDER[roleB] ?? 999;
            return orderA - orderB;
        });

    return (
        <SectionCard title="작업자 명단">
            <div className="flex flex-col gap-4">
                {loading ? (
                    <div className="text-center text-gray-500 py-4">
                        구성원 정보를 불러오는 중...
                    </div>
                ) : (
                    <>
                        {/* 공무팀 (항상 표시) */}
                        {adminTeamMembers.length > 0 && (
                            <div className="border border-blue-200 border-dashed rounded-2xl p-4 flex flex-col gap-2 bg-blue-50/30">
                                <p className="font-semibold text-[15px] text-blue-800">
                                    공무팀
                                </p>
                                <div className="flex gap-2 flex-wrap">
                                    {adminTeamMembers.map((member) => (
                                        <Button
                                            key={member.name}
                                            size="md"
                                            variant={
                                                workers.includes(member.name)
                                                    ? "primary"
                                                    : "outline"
                                            }
                                            onClick={() =>
                                                workers.includes(member.name)
                                                    ? removeWorker(
                                                          member.name
                                                      )
                                                    : addWorker(member.name)
                                            }
                                        >
                                            {member.name}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        )}

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
                    </>
                )}

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
                                onKeyDown={handleKeyDown}
                                inputRef={inputRef}
                            />
                        </div>
                        <Button
                            type="button"
                            variant="primary"
                            size="lg"
                            onClick={handleAddWorker}
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
