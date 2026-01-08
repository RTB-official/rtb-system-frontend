import { useEffect, useMemo, useState } from "react";
import BaseModal from "./BaseModal";
import Input from "../common/Input";
import Button from "../common/Button";
import DatePicker from "./DatePicker"; // DatePicker 임포트

type LeaveType = "FULL" | "AM" | "PM";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  availableDays: number;
  onSubmit: (payload: {
    date: string;
    leaveType: LeaveType;
    reason: string;
  }) => void;
}

// formatKoreanDate 함수는 DatePicker 컴포넌트 내부에서 처리될 것이므로 제거

export default function VacationRequestModal({
  isOpen,
  onClose,
  availableDays,
  onSubmit,
}: Props) {
  const todayISO = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }, []);

  const [dateISO, setDateISO] = useState(todayISO);
  const [leaveType, setLeaveType] = useState<LeaveType>("FULL");
  const [reason, setReason] = useState("개인 사유");

  useEffect(() => {
    if (isOpen) {
      setDateISO(todayISO);
      setLeaveType("FULL");
      setReason("개인 사유");
    }
  }, [isOpen, todayISO]);

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
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-baseline gap-2">
          <span>휴가 신청</span>
          <span className="text-[13px] font-bold text-gray-400">
            총 {availableDays}일 사용 가능
          </span>
        </div>
      }
      maxWidth="max-w-[640px]"
    >
      <div className="space-y-5">
        {/* 날짜 */}
        <div>
          <DatePicker
            label="날짜"
            labelClassName="text-sm font-medium text-gray-700"
            value={dateISO}
            onChange={setDateISO}
            placeholder="년도. 월. 일."
            className="w-full"
          />
        </div>

        {/* 휴가 유형 */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-2 block">
            휴가 유형
          </label>
          <div className="grid grid-cols-3 gap-3">
            <Button
              variant={leaveType === "FULL" ? "primary" : "outline"}
              size="lg"
              onClick={() => setLeaveType("FULL")}
            >
              하루 종일
            </Button>
            <Button
              variant={leaveType === "AM" ? "primary" : "outline"}
              size="lg"
              onClick={() => setLeaveType("AM")}
            >
              오전 반차
            </Button>
            <Button
              variant={leaveType === "PM" ? "primary" : "outline"}
              size="lg"
              onClick={() => setLeaveType("PM")}
            >
              오후 반차
            </Button>
          </div>
        </div>

        {/* 상세내용 */}
        <Input
          label="상세내용"
          value={reason}
          onChange={setReason}
          placeholder="예) 개인 사유"
          required
        />

        {/* 제출 버튼 */}
        <div className="pt-2">
          <Button variant="primary" size="lg" fullWidth onClick={handleAdd}>
            추가
          </Button>
        </div>
      </div>
    </BaseModal>
  );
}
