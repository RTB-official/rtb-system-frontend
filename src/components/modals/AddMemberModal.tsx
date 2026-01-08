import { useState, useEffect } from "react";
import BaseModal from "../ui/BaseModal";
import Button from "../common/Button";
import DatePicker from "../ui/DatePicker";
import Input from "../common/Input";
import Select from "../common/Select";

type Props = {
    isOpen: boolean;
    onClose: () => void;
    member?: any;
    onSubmit?: (payload: {
        selectedMember: string;
        joinDate: string;
        birthDate: string;
        emailPrefix: string;
        phone: string;
        address: string;
        team: string;
        position: string;
        passportLastName: string;
        passportFirstName: string;
        passportNo: string;
        passportExpiry: string; // YYMMDD (예: 251227)
    }) => void;
};

export default function AddMemberModal({
    isOpen,
    onClose,
    member,
    onSubmit,
}: Props) {
    const [joinDate, setJoinDate] = useState("");
    const [birthDate, setBirthDate] = useState("");
    const [emailPrefix, setEmailPrefix] = useState("");
    const [phone, setPhone] = useState("");
    const [address, setAddress] = useState("");

    const [team, setTeam] = useState("");
    const [position, setPosition] = useState("");

    const [passportLastName, setPassportLastName] = useState("");
    const [passportFirstName, setPassportFirstName] = useState("");
    const [passportNo, setPassportNo] = useState("");
    const [passportExpiry, setPassportExpiry] = useState("");

    useEffect(() => {
        if (member) {
            setJoinDate(member.joinDate || "");
            setBirthDate(member.birth || "");
            setEmailPrefix(member.username || "");
            setPhone(member.phone || "");
            setAddress(member.address1 || "");
            setTeam(member.team || "");
            setPosition(member.role || "");
            setPassportLastName(member.passportLastName || "");
            setPassportFirstName(member.passportFirstName || "");
            setPassportNo(member.passportNo || "");
            setPassportExpiry(member.passportExpiry || "");
        } else {
            setJoinDate("");
            setBirthDate("");
            setEmailPrefix("");
            setPhone("");
            setAddress("");
            setTeam("");
            setPosition("");
            setPassportLastName("");
            setPassportFirstName("");
            setPassportNo("");
            setPassportExpiry("");
        }
    }, [member, isOpen]);

    const handleSubmit = () => {
        const payload = {
            selectedMember: member?.name || "",
            joinDate,
            birthDate,
            emailPrefix,
            phone,
            address,
            team,
            position,
            passportLastName,
            passportFirstName,
            passportNo,
            passportExpiry,
        };
        onSubmit?.(payload);
        onClose();
    };

    return (
        <BaseModal
            isOpen={isOpen}
            onClose={onClose}
            title="구성원 정보 수정"
            maxWidth="max-w-[540px]"
            footer={
                <Button
                    variant="primary"
                    size="lg"
                    fullWidth
                    onClick={handleSubmit}
                >
                    수정 완료
                </Button>
            }
        >
            <div className="max-h-[480px] overflow-y-auto pr-2">
                {/* 수정 중인 구성원 표시 */}
                {member && (
                    <div className="p-4 rounded-2xl border border-blue-100 bg-blue-50/50 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white text-[14px] font-semibold shrink-0">
                            {member.name?.slice(0, 1) || "U"}
                        </div>
                        <div>
                            <div className="text-[14px] font-bold text-gray-900">
                                {member.name}
                            </div>
                            <div className="text-[12px] text-gray-500">
                                {member.username} · {member.role}
                            </div>
                        </div>
                    </div>
                )}

                {/* 기본 정보 */}
                <div className="mt-4">
                    <div className="text-[14px] font-semibold text-gray-900 mb-3">
                        기본 정보
                    </div>

                    {/* 입사일 */}
                    <div className="mb-3">
                        <label className="text-[12px] font-medium text-gray-900 block mb-2">
                            입사일
                        </label>
                        <DatePicker
                            value={joinDate}
                            onChange={setJoinDate}
                            placeholder="년도. 월. 일."
                            className="w-full"
                        />
                    </div>

                    {/* 생년월일 */}
                    <div className="mb-3">
                        <label className="text-[12px] font-medium text-gray-900 block mb-2">
                            생년월일
                        </label>
                        <DatePicker
                            value={birthDate}
                            onChange={setBirthDate}
                            placeholder="년도. 월. 일."
                            className="w-full"
                        />
                    </div>

                    {/* 메일 플러그 */}
                    <div className="mb-3">
                        <Input
                            label="메일 플러그"
                            labelClassName="text-[12px] font-medium text-gray-900"
                            value={emailPrefix}
                            onChange={setEmailPrefix}
                            placeholder="예) mj.kang"
                        />
                    </div>

                    {/* 전화번호 */}
                    <div className="mb-3">
                        <Input
                            label="전화번호"
                            labelClassName="text-[12px] font-medium text-gray-900"
                            value={phone}
                            onChange={setPhone}
                            placeholder="010-1234-5678"
                        />
                    </div>

                    {/* 주소 */}
                    <div className="mb-3">
                        <Input
                            label="주소"
                            labelClassName="text-[12px] font-medium text-gray-900"
                            value={address}
                            onChange={setAddress}
                            placeholder="주소"
                        />
                    </div>

                    {/* ✅ 팀 구분 */}
                    <div className="mb-3">
                        <Select
                            label="팀 구분"
                            labelClassName="text-[12px] font-medium text-gray-900"
                            value={team}
                            onChange={setTeam}
                            options={[
                                { value: "공무팀", label: "공무팀" },
                                { value: "공사팀", label: "공사팀" },
                                {
                                    value: "영업/AI기획팀",
                                    label: "영업/AI기획팀",
                                },
                            ]}
                            placeholder="팀 선택"
                        />
                    </div>

                    {/* ✅ 직급 */}
                    <div className="mb-6">
                        <Select
                            label="직급"
                            labelClassName="text-[12px] font-medium text-gray-900"
                            value={position}
                            onChange={setPosition}
                            options={[
                                { value: "대표", label: "대표" },
                                { value: "감사", label: "감사" },
                                { value: "부장", label: "부장" },
                                { value: "차장", label: "차장" },
                                { value: "과장", label: "과장" },
                                { value: "대리", label: "대리" },
                                { value: "주임", label: "주임" },
                                { value: "사원", label: "사원" },
                            ]}
                            placeholder="직급 선택"
                        />
                    </div>

                    {/* ✅ 여권 정보 */}
                    <div className="mt-6">
                        <div className="text-[14px] font-semibold text-gray-900 mb-3">
                            여권 정보
                        </div>

                        {/* 이름 (2칸) */}
                        <div className="mb-3 grid grid-cols-2 gap-3">
                            <Input
                                label="성 (Last Name)"
                                labelClassName="text-[12px] font-medium text-gray-900"
                                value={passportLastName}
                                onChange={setPassportLastName}
                                placeholder="성 (Last Name)"
                            />
                            <Input
                                label="이름 (First Name)"
                                labelClassName="text-[12px] font-medium text-gray-900"
                                value={passportFirstName}
                                onChange={setPassportFirstName}
                                placeholder="이름 (First Name)"
                            />
                        </div>

                        {/* 여권 번호 / 만료 기간 (2칸) */}
                        <div className="grid grid-cols-2 gap-3">
                            <Input
                                label="여권 번호"
                                labelClassName="text-[12px] font-medium text-gray-900"
                                value={passportNo}
                                onChange={setPassportNo}
                                placeholder="예) M12345678"
                            />
                            <Input
                                label="만료 기간"
                                labelClassName="text-[12px] font-medium text-gray-900"
                                value={passportExpiry}
                                onChange={setPassportExpiry}
                                placeholder="예) 251227"
                                inputMode="numeric"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </BaseModal>
    );
}
