// src/components/modals/AddMemberModal.tsx
import { useState, useEffect } from "react";
import BaseModal from "../ui/BaseModal";
import Button from "../common/Button";
import DatePicker from "../ui/DatePicker";
import Input from "../common/Input";
import Select from "../common/Select";
import Avatar from "../common/Avatar";

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

    const normalizeDateForPicker = (v?: string | null) => {
        const s = (v || "").trim();
        if (!s) return "";

        // 이미 ISO면 그대로
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

        // "YYYY. MM. DD." -> ISO
        const dot = s.match(/^(\d{4})\.\s?(\d{1,2})\.\s?(\d{1,2})\.?$/);
        if (dot) {
            const y = dot[1];
            const m = String(dot[2]).padStart(2, "0");
            const d = String(dot[3]).padStart(2, "0");
            return `${y}-${m}-${d}`;
        }

        // YYMMDD -> ISO(세기 자동판별: 현재 연도 기준)
        if (/^\d{6}$/.test(s)) {
            const yy = parseInt(s.slice(0, 2), 10);
            const mm = s.slice(2, 4);
            const dd = s.slice(4, 6);

            const nowYY = new Date().getFullYear() % 100;
            const century = yy > nowYY ? 1900 : 2000;

            const yyyy = String(century + yy);
            return `${yyyy}-${mm}-${dd}`;
        }

        // YYYYMMDD -> ISO
        if (/^\d{8}$/.test(s)) {
            const y = s.slice(0, 4);
            const m = s.slice(4, 6);
            const d = s.slice(6, 8);
            return `${y}-${m}-${d}`;
        }

        // 그 외는 빈값 처리( NaN 방지 )
        return "";
    };


    useEffect(() => {
        if (member) {
            setJoinDate(normalizeDateForPicker(member.joinDate));
            setBirthDate(normalizeDateForPicker(member.birth));
            setEmailPrefix(member.email || "");
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
                        <Avatar email={member.email} size={40} position={member.role} />
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
                            fullWidth
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
                            fullWidth
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
                                { value: "인턴", label: "인턴" },
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
                                onChange={(v) =>
                                    setPassportLastName(v.toUpperCase())
                                }
                                placeholder="성 (Last Name)"
                            />
                            <Input
                                label="이름 (First Name)"
                                labelClassName="text-[12px] font-medium text-gray-900"
                                value={passportFirstName}
                                onChange={(v) =>
                                    setPassportFirstName(v.toUpperCase())
                                }
                                placeholder="이름 (First Name)"
                            />
                        </div>

                        {/* 여권 번호 / 만료 기간 (2칸) */}
                        <div className="grid grid-cols-2 gap-3">
                        <Input
                                label="여권 번호"
                                labelClassName="text-[12px] font-medium text-gray-900"
                                value={passportNo}
                                onChange={(v) =>
                                    setPassportNo(v.toUpperCase())
                                }
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
