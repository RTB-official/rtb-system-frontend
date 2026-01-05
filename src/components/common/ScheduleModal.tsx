import React, { useState } from "react";
import Input from "./Input";
import Button from "./Button";

type SchedulePayload = {
  title: string;
  startDate?: string;
  startTime?: string;
  endDate?: string;
  endTime?: string;
};

type ScheduleModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (payload: SchedulePayload) => void;
};

export default function ScheduleModal({ isOpen, onClose, onSave }: ScheduleModalProps) {
  const [title, setTitle] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [startTime, setStartTime] = useState<string>("09:00");
  const [endDate, setEndDate] = useState<string>("");
  const [endTime, setEndTime] = useState<string>("18:00");

  if (!isOpen) return null;

  const handleSave = () => {
    onSave({
      title,
      startDate,
      startTime,
      endDate,
      endTime,
    });
    // reset after save
    setTitle("");
    setStartDate("");
    setStartTime("09:00");
    setEndDate("");
    setEndTime("18:00");
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
        <div className="text-lg font-semibold mb-4">일정 추가</div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="일정 제목" value={title} onChange={setTitle} placeholder="제목 입력" />
          <Input label="시작 날짜" type="date" value={startDate} onChange={e => setStartDate((e.target as HTMLInputElement).value)} />
          <Input label="시작 시간" type="time" value={startTime} onChange={e => setStartTime((e.target as HTMLInputElement).value)} />
          <Input label="종료 날짜" type="date" value={endDate} onChange={e => setEndDate((e.target as HTMLInputElement).value)} />
          <Input label="종료 시간" type="time" value={endTime} onChange={e => setEndTime((e.target as HTMLInputElement).value)} />
        </div>
        <div className="flex justify-end mt-6 gap-2">
          <Button variant="ghost" onClick={onClose}>취소</Button>
          <Button onClick={handleSave}>저장</Button>
        </div>
      </div>
    </div>
  );
}


