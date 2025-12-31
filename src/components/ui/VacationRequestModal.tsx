import { useEffect, useMemo, useState } from "react";

type LeaveType = "FULL" | "AM" | "PM";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  availableDays: number; // "총 12일 사용 가능" 표시용
  onSubmit: (payload: {
    date: string;      // YYYY-MM-DD
    leaveType: LeaveType;
    reason: string;
  }) => void;
  initialDate?: string;
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function formatKoreanDate(dateISO: string) {
  // YYYY-MM-DD -> 2025. 12. 19.(금) 형태로 가볍게 표시 (요일은 브라우저 locale로)
  const [y, m, d] = dateISO.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const weekday = dt.toLocaleDateString("ko-KR", { weekday: "short" }); // "금"
  return `${y}. ${pad2(m)}. ${pad2(d)}.(${weekday})`;
}

export default function VacationRequestModal({
  isOpen,
  onClose,
  availableDays,
  onSubmit,
  initialDate,
}: Props) {
  const todayISO = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
  }, []);

  const [dateISO, setDateISO] = useState(todayISO);
  const [leaveType, setLeaveType] = useState<LeaveType>("FULL");
  const [reason, setReason] = useState("개인 사유");

  // 열릴 때 기본값 세팅(초기 날짜가 있으면 우선 사용)
  useEffect(() => {
    if (isOpen) {
      setDateISO(initialDate ?? todayISO);
      setLeaveType("FULL");
      setReason("개인 사유");
    }
  }, [isOpen, initialDate, todayISO]);

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

  const handleAdd = () => {
    if (!dateISO) return alert("날짜를 선택해주세요.");
    if (!reason.trim()) return alert("상세내용을 입력해주세요.");

    onSubmit({
      date: dateISO,
      leaveType,
      reason: reason.trim(),
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center"
      aria-modal="true"
      role="dialog"
    >
      {/* overlay */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />

      {/* modal */}
      <div className="relative w-[640px] max-w-[calc(100vw-32px)] bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        <div className="p-6">
          {/* header */}
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-baseline gap-2">
                <h2 className="text-[22px] font-extrabold text-gray-900">
                  휴가 신청
                </h2>
                <span className="text-[13px] font-bold text-gray-400">
                  총 {availableDays}일 사용 가능
                </span>
              </div>
            </div>

            <button
              type="button"
              className="w-10 h-10 rounded-xl hover:bg-gray-100 text-gray-500 font-black"
              onClick={onClose}
              aria-label="close"
            >
              ✕
            </button>
          </div>

          {/* divider */}
          <div className="mt-4 h-px bg-gray-100" />

          {/* date */}
          <div className="mt-5">
            <div className="text-[13px] font-extrabold text-gray-800 mb-2">
              날짜
            </div>

            <div className="relative">
              {/* 실제 입력은 date */}
              <input
                type="date"
                value={dateISO}
                onChange={(e) => setDateISO(e.target.value)}
                className="w-full h-12 rounded-xl border border-gray-200 px-4 pr-12 font-bold text-gray-900 bg-white outline-none focus:ring-2 focus:ring-gray-200"
              />

               {/* 표시용 텍스트 (피그마처럼 보이게) */}
               <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-[14px] font-bold text-gray-900">
                {formatKoreanDate(dateISO)}
              </div>

              {/* 아이콘 느낌 */}
              <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-gray-500">
                📅
              </div>

              {/* date input 기본 텍스트 숨기기용: 브라우저마다 다름 */}
              <style>
                {`
                  input[type="date"]::-webkit-datetime-edit { opacity: 0; }
                  input[type="date"]::-webkit-calendar-picker-indicator { opacity: 0; }
                `}
              </style>
            </div>
          </div>

          {/* leave type buttons */}
          <div className="mt-4 grid grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => setLeaveType("FULL")}
              className={`h-12 rounded-xl border font-extrabold ${
                leaveType === "FULL"
                  ? "bg-[#2F3A4A] text-white border-[#2F3A4A]"
                  : "bg-white text-gray-800 border-gray-200 hover:bg-gray-50"
              }`}
            >
              하루 종일
            </button>

            <button
              type="button"
              onClick={() => setLeaveType("AM")}
              className={`h-12 rounded-xl border font-extrabold ${
                leaveType === "AM"
                  ? "bg-[#2F3A4A] text-white border-[#2F3A4A]"
                  : "bg-white text-gray-800 border-gray-200 hover:bg-gray-50"
              }`}
            >
              오전 반차
            </button>

            <button
              type="button"
              onClick={() => setLeaveType("PM")}
              className={`h-12 rounded-xl border font-extrabold ${
                leaveType === "PM"
                  ? "bg-[#2F3A4A] text-white border-[#2F3A4A]"
                  : "bg-white text-gray-800 border-gray-200 hover:bg-gray-50"
              }`}
            >
              오후 반차
            </button>
          </div>

          {/* reason */}
          <div className="mt-5">
            <div className="text-[13px] font-extrabold text-gray-800 mb-2">
              상세내용
            </div>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="예) 개인 사유"
              className="w-full h-12 rounded-xl border border-gray-200 px-4 font-bold text-gray-900 bg-white outline-none focus:ring-2 focus:ring-gray-200"
            />
          </div>

          {/* submit */}
          <button
            type="button"
            onClick={handleAdd}
            className="mt-6 w-full h-12 rounded-xl bg-[#2F3A4A] text-white font-extrabold hover:opacity-95 active:translate-y-[1px]"
          >
            추가
          </button>
        </div>
      </div>
    </div>
  );
}