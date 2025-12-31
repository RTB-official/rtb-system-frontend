import { useEffect, useState } from "react";
import DatePicker from "../ui/DatePicker";

type Props = {
  isOpen: boolean;
  onClose: () => void;
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

function IconClose() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path
        d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41Z"
        fill="currentColor"
      />
    </svg>
  );
}

function IconChevronDown() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path
        d="M7 10l5 5 5-5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function AddMemberModal({ isOpen, onClose, onSubmit }: Props) {
  const [selectedMember, setSelectedMember] = useState("");
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

  // 모달 열릴 때 바디 스크롤 잠금
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  // ESC 닫기
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = () => {
    const payload = {
      selectedMember,
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

  const inputBase =
    "w-full h-11 rounded-xl border border-[#e5e7eb] bg-white px-4 text-[14px] text-[#101828] outline-none";
  const selectBase =
    "w-full h-11 rounded-xl border border-[#e5e7eb] bg-white px-4 pr-10 text-[14px] text-[#101828] outline-none focus:ring-2 focus:ring-[#e5e7eb] appearance-none";

  return (
    <div className="fixed inset-0 z-50">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Modal */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-[560px] bg-white rounded-2xl shadow-xl border border-[#e5e7eb] overflow-hidden">
          {/* Header */}
          <div className="px-6 py-5 flex items-center justify-between">
            <h2 className="text-[20px] font-semibold text-[#101828]">구성원 추가</h2>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl hover:bg-[#f2f4f7] text-[#101828] flex items-center justify-center"
              aria-label="close"
            >
              <IconClose />
            </button>
          </div>

          {/* Body */}
          <div className="px-6 pb-6">
            <div className="max-h-[560px] overflow-y-auto pr-2">
              {/* 구성원 선택 */}
              <div className="p-4 rounded-2xl border border-[#e5e7eb] bg-white">
                <label className="text-[12px] font-medium text-[#101828] block mb-2">구성원 선택</label>
                <div className="relative">
                  <select
                    value={selectedMember}
                    onChange={(e) => setSelectedMember(e.target.value)}
                    className={selectBase}
                  >
                    <option value="">선택</option>
                    <option value="강민지">강민지</option>
                    <option value="홍길동">홍길동</option>
                    <option value="김철수">김철수</option>
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6a7282] pointer-events-none">
                    <IconChevronDown />
                  </div>
                </div>
              </div>

              {/* 기본 정보 */}
              <div className="mt-5">
                <div className="text-[14px] font-semibold text-[#101828] mb-3">기본 정보</div>

                {/* 입사일 */}
                <div className="mb-4">
                  <label className="text-[12px] font-medium text-[#101828] block mb-2">입사일</label>
                  <DatePicker value={joinDate} onChange={setJoinDate} placeholder="년도. 월. 일." className="w-full" />
                </div>

                {/* 생년월일 */}
                <div className="mb-4">
                  <label className="text-[12px] font-medium text-[#101828] block mb-2">생년월일</label>
                  <DatePicker value={birthDate} onChange={setBirthDate} placeholder="년도. 월. 일." className="w-full" />
                </div>

                {/* 메일 플러그 */}
                <div className="mb-4">
                  <label className="text-[12px] font-medium text-[#101828] block mb-2">메일 플러그</label>
                  <input
                    value={emailPrefix}
                    onChange={(e) => setEmailPrefix(e.target.value)}
                    placeholder="예) mj.kang"
                    className={inputBase}
                  />
                </div>

                {/* 전화번호 */}
                <div className="mb-4">
                  <label className="text-[12px] font-medium text-[#101828] block mb-2">전화번호</label>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="010-1234-5678"
                    className={inputBase}
                  />
                </div>

                {/* 주소 */}
                <div className="mb-4">
                  <label className="text-[12px] font-medium text-[#101828] block mb-2">주소</label>
                  <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="주소" className={inputBase} />
                </div>

                {/* ✅ 팀 구분 */}
                <div className="mb-4">
                  <label className="text-[12px] font-medium text-[#101828] block mb-2">팀 구분</label>
                  <div className="relative">
                    <select value={team} onChange={(e) => setTeam(e.target.value)} className={selectBase}>
                      <option value="">팀 선택</option>
                      <option value="공무팀">공무팀</option>
                      <option value="공사팀">공사팀</option>
                      <option value="영업/AI기획팀">영업/AI기획팀</option>
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6a7282] pointer-events-none">
                      <IconChevronDown />
                    </div>
                  </div>
                </div>

                {/* ✅ 직급 */}
                <div className="mb-6">
                  <label className="text-[12px] font-medium text-[#101828] block mb-2">직급</label>
                  <div className="relative">
                    <select value={position} onChange={(e) => setPosition(e.target.value)} className={selectBase}>
                      <option value="">직급 선택</option>
                      <option value="대표">대표</option>
                      <option value="감사">감사</option>
                      <option value="부장">부장</option>
                      <option value="차장">차장</option>
                      <option value="과장">과장</option>
                      <option value="대리">대리</option>
                      <option value="주임">주임</option>
                      <option value="사원">사원</option>
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6a7282] pointer-events-none">
                      <IconChevronDown />
                    </div>
                  </div>
                </div>

                {/* ✅ 여권 정보 */}
                <div className="mt-2">
                  <div className="text-[14px] font-semibold text-[#101828] mb-3">여권 정보</div>

                  {/* 이름 (2칸) */}
                  <div className="mb-4">
                    <label className="text-[12px] font-medium text-[#101828] block mb-2">이름</label>
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        value={passportLastName}
                        onChange={(e) => setPassportLastName(e.target.value)}
                        placeholder="성 (Last Name)"
                        className={inputBase}
                      />
                      <input
                        value={passportFirstName}
                        onChange={(e) => setPassportFirstName(e.target.value)}
                        placeholder="이름 (First Name)"
                        className={inputBase}
                      />
                    </div>
                  </div>

                  {/* 여권 번호 / 만료 기간 (2칸) */}
                  <div className="mb-10">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[12px] font-medium text-[#101828] block mb-2">여권 번호</label>
                        <input
                          value={passportNo}
                          onChange={(e) => setPassportNo(e.target.value)}
                          placeholder="예) M12345678"
                          className={inputBase}
                        />
                      </div>
                      <div>
                        <label className="text-[12px] font-medium text-[#101828] block mb-2">만료 기간</label>
                        <input
                          value={passportExpiry}
                          onChange={(e) => setPassportExpiry(e.target.value)}
                          placeholder="예) 251227"
                          className={inputBase}
                          inputMode="numeric"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="pt-4">
              <button
                onClick={handleSubmit}
                className="w-full h-12 rounded-xl bg-[#364153] text-white text-[14px] font-medium hover:opacity-90 transition"
              >
                추가
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
