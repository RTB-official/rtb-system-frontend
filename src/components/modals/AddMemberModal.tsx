// src/components/modals/AddMemberModal.tsx
import { useState, useEffect } from "react";
import BaseModal from "../ui/BaseModal";
import Button from "../common/Button";
import DatePicker from "../ui/DatePicker";
import Input from "../common/Input";
import Select from "../common/Select";
import Avatar from "../common/Avatar";
import { supabase } from "../../lib/supabase";

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
        profilePhotoFile?: File | null;
        passportPhotoFile?: File | null;
        signatureFile?: File | null;
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
    const [profilePhotoFile, setProfilePhotoFile] = useState<File | null>(null);
    const [passportPhotoFile, setPassportPhotoFile] = useState<File | null>(null);
    const [signatureFile, setSignatureFile] = useState<File | null>(null);
    const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
    const [signatureUrl, setSignatureUrl] = useState<string | null>(null);

    const profilePhotoLabel =
        profilePhotoFile?.name || member?.profilePhotoName || "";
    const passportPhotoLabel =
        passportPhotoFile?.name || member?.passportPhotoName || "";
    const signatureLabel =
        signatureFile?.name || member?.signatureName || "";

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
            setProfilePhotoFile(null);
            setPassportPhotoFile(null);
            setSignatureFile(null);
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
            setProfilePhotoFile(null);
            setPassportPhotoFile(null);
            setSignatureFile(null);
        }
    }, [member, isOpen]);

    // 증명사진 썸네일 URL 관리
    useEffect(() => {
        let objectUrl: string | null = null;
        let signedUrl: string | null = null;

        const loadThumbnail = async () => {
            // 새로 선택한 파일이 있으면 File 객체에서 썸네일 생성
            if (profilePhotoFile) {
                objectUrl = URL.createObjectURL(profilePhotoFile);
                setProfilePhotoUrl(objectUrl);
                return;
            }

            // 기존 파일이 있으면 Supabase에서 URL 가져오기
            if (member?.profilePhotoBucket && member?.profilePhotoPath) {
                try {
                    const { data, error } = await supabase.storage
                        .from(member.profilePhotoBucket)
                        .createSignedUrl(member.profilePhotoPath, 60 * 60); // 1시간 유효
                    
                    if (!error && data) {
                        signedUrl = data.signedUrl;
                        setProfilePhotoUrl(signedUrl);
                    } else {
                        // signed URL 실패 시 public URL 시도
                        const { data: publicData } = supabase.storage
                            .from(member.profilePhotoBucket)
                            .getPublicUrl(member.profilePhotoPath);
                        setProfilePhotoUrl(publicData.publicUrl);
                    }
                } catch (error) {
                    console.error("증명사진 URL 로드 실패:", error);
                    setProfilePhotoUrl(null);
                }
            } else {
                setProfilePhotoUrl(null);
            }
        };

        loadThumbnail();

        // cleanup: object URL 정리
        return () => {
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
        };
    }, [profilePhotoFile, member?.profilePhotoBucket, member?.profilePhotoPath]);

    // 서명 썸네일 URL 관리
    useEffect(() => {
        let objectUrl: string | null = null;
        let signedUrl: string | null = null;

        const loadThumbnail = async () => {
            // 새로 선택한 파일이 있으면 File 객체에서 썸네일 생성
            if (signatureFile) {
                objectUrl = URL.createObjectURL(signatureFile);
                setSignatureUrl(objectUrl);
                return;
            }

            // 기존 파일이 있으면 Supabase에서 URL 가져오기
            if (member?.signatureBucket && member?.signaturePath) {
                try {
                    const { data, error } = await supabase.storage
                        .from(member.signatureBucket)
                        .createSignedUrl(member.signaturePath, 60 * 60); // 1시간 유효
                    
                    if (!error && data) {
                        signedUrl = data.signedUrl;
                        setSignatureUrl(signedUrl);
                    } else {
                        // signed URL 실패 시 public URL 시도
                        const { data: publicData } = supabase.storage
                            .from(member.signatureBucket)
                            .getPublicUrl(member.signaturePath);
                        setSignatureUrl(publicData.publicUrl);
                    }
                } catch (error) {
                    console.error("서명 URL 로드 실패:", error);
                    setSignatureUrl(null);
                }
            } else {
                setSignatureUrl(null);
            }
        };

        loadThumbnail();

        // cleanup: object URL 정리
        return () => {
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
        };
    }, [signatureFile, member?.signatureBucket, member?.signaturePath]);

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
            profilePhotoFile,
            passportPhotoFile,
            signatureFile,
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
                                { value: "사원", label: "사원" },
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

                        {/* 여권사진 */}
                        <div className="mt-4">
                            <label className="text-[12px] font-medium text-gray-900 block mb-2">
                                여권사진
                            </label>
                            <input
                                type="file"
                                onChange={(e) =>
                                    setPassportPhotoFile(
                                        e.target.files?.[0] ?? null
                                    )
                                }
                                className="block w-full text-sm text-gray-700 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                            />
                            <div className="mt-1 text-[12px] text-gray-500">
                                {passportPhotoLabel
                                    ? `현재 파일: ${passportPhotoLabel}`
                                    : "현재 파일 없음"}
                            </div>
                        </div>

                        {/* 증명사진 */}
                        <div className="mt-6">
                            <label className="text-[12px] font-medium text-gray-900 block mb-2">
                                증명사진
                            </label>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={(e) =>
                                    setProfilePhotoFile(
                                        e.target.files?.[0] ?? null
                                    )
                                }
                                className="block w-full text-sm text-gray-700 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                            />
                            {profilePhotoUrl && (
                                <div className="mt-3 flex items-center gap-3">
                                    <img
                                        src={profilePhotoUrl}
                                        alt="증명사진 썸네일"
                                        className="w-20 h-20 object-cover rounded-lg border border-gray-200"
                                    />
                                    <div className="flex-1">
                                        <div className="text-[12px] font-medium text-gray-900">
                                            {profilePhotoLabel
                                                ? `현재 파일: ${profilePhotoLabel}`
                                                : "현재 파일 없음"}
                                        </div>
                                    </div>
                                </div>
                            )}
                            {!profilePhotoUrl && (
                                <div className="mt-1 text-[12px] text-gray-500">
                                    {profilePhotoLabel
                                        ? `현재 파일: ${profilePhotoLabel}`
                                        : "현재 파일 없음"}
                                </div>
                            )}
                        </div>

                        {/* 서명 */}
                        <div className="mt-6">
                            <label className="text-[12px] font-medium text-gray-900 block mb-2">
                                서명
                            </label>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={(e) =>
                                    setSignatureFile(
                                        e.target.files?.[0] ?? null
                                    )
                                }
                                className="block w-full text-sm text-gray-700 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                            />
                            {signatureUrl && (
                                <div className="mt-3 flex items-center gap-3">
                                    <img
                                        src={signatureUrl}
                                        alt="서명 썸네일"
                                        className="w-20 h-20 object-contain rounded-lg border border-gray-200 bg-white"
                                    />
                                    <div className="flex-1">
                                        <div className="text-[12px] font-medium text-gray-900">
                                            {signatureLabel
                                                ? `현재 파일: ${signatureLabel}`
                                                : "현재 파일 없음"}
                                        </div>
                                    </div>
                                </div>
                            )}
                            {!signatureUrl && (
                                <div className="mt-1 text-[12px] text-gray-500">
                                    {signatureLabel
                                        ? `현재 파일: ${signatureLabel}`
                                        : "현재 파일 없음"}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </BaseModal>
    );
}
