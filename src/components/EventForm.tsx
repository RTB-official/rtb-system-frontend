import React, { useState, useEffect, useRef } from "react";
import { IconCalendar } from "./icons/Icons";
import { IconClock } from "./icons/Icons";
import DatePickerPanel from "./DatePickerPanel";
import Button from "./common/Button";
import Input from "./common/Input";
import Select from "./common/Select";

interface CalendarEvent {
    id: string;
    title: string;
    color: string;
    startDate: string;
    endDate: string;
}

interface EventFormProps {
    onClose?: () => void;
    initialDate?: string;
    initialEndDate?: string;
    editingEvent?: CalendarEvent | null;
    onSave?: (data: {
        title: string;
        startDate: string;
        startTime?: string;
        endDate: string;
        endTime?: string;
        allDay: boolean;
    }) => void;
}

export default function EventForm({
    onClose,
    initialDate,
    initialEndDate,
    editingEvent,
    onSave,
}: EventFormProps) {
    const [title, setTitle] = useState(editingEvent?.title || "");
    const [allDay, setAllDay] = useState(false);

    const pad = (n: number) => (n < 10 ? "0" + n : String(n));

    const hourOptions = Array.from({ length: 25 }, (_, i) => pad(i)); // 00 ~ 24
    const minuteOptions = ["00", "30"];

    const formatDateForInput = (dateStr: string) => {
        if (!dateStr) return "";
        // "YYYY-MM-DD" 형식으로 변환
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr;
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
            date.getDate()
        )}`;
    };

    const formatDateForDisplay = (dateStr: string) => {
        if (!dateStr) return "";
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr;
        return `${date.getFullYear()}. ${pad(date.getMonth() + 1)}. ${pad(
            date.getDate()
        )}.`;
    };

    const [startDate, setStartDate] = useState<string>(
        initialDate ? formatDateForInput(initialDate) : ""
    );
    const [startHour, setStartHour] = useState<string>("09");
    const [startMinute, setStartMinute] = useState<string>("00");
    const [startDatePickerOpen, setStartDatePickerOpen] = useState(false);
    const startDatePickerRef = useRef<HTMLDivElement>(null);

    const [endDate, setEndDate] = useState<string>(
        initialEndDate
            ? formatDateForInput(initialEndDate)
            : initialDate
            ? formatDateForInput(initialDate)
            : ""
    );
    const [endHour, setEndHour] = useState<string>("18");
    const [endMinute, setEndMinute] = useState<string>("00");
    const [endDatePickerOpen, setEndDatePickerOpen] = useState(false);
    const endDatePickerRef = useRef<HTMLDivElement>(null);

    // 외부 클릭 시 날짜 선택 패널 닫기
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                startDatePickerRef.current &&
                !startDatePickerRef.current.contains(event.target as Node)
            ) {
                setStartDatePickerOpen(false);
            }
            if (
                endDatePickerRef.current &&
                !endDatePickerRef.current.contains(event.target as Node)
            ) {
                setEndDatePickerOpen(false);
            }
        };

        if (startDatePickerOpen || endDatePickerOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [startDatePickerOpen, endDatePickerOpen]);

    // initialDate가 변경되면 시작일과 종료일 업데이트
    React.useEffect(() => {
        if (initialDate) {
            const formatted = formatDateForInput(initialDate);
            setStartDate(formatted);
            if (!endDate) {
                setEndDate(formatted);
            }
        }
    }, [initialDate]);

    React.useEffect(() => {
        if (initialEndDate) {
            setEndDate(formatDateForInput(initialEndDate));
        }
    }, [initialEndDate]);

    React.useEffect(() => {
        if (editingEvent) {
            setTitle(editingEvent.title);
            setStartDate(formatDateForInput(editingEvent.startDate));
            setEndDate(formatDateForInput(editingEvent.endDate));
        }
    }, [editingEvent]);

    return (
        <div className="space-y-4">
            <Input
                label="일정 제목"
                value={title}
                onChange={setTitle}
                placeholder="일정 제목을 입력해주세요"
                required
            />

            <div className="flex items-center">
                <input
                    type="checkbox"
                    id="allDay"
                    checked={allDay}
                    onChange={(e) => setAllDay(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                />
                <label
                    htmlFor="allDay"
                    className="ml-2 text-sm text-gray-700 cursor-pointer select-none"
                >
                    하루종일
                </label>
            </div>

            <div className="space-y-4">
                <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                        시작
                    </label>
                    <div className="flex gap-2 items-center">
                        <div
                            className="relative flex-1"
                            ref={startDatePickerRef}
                        >
                            <Input
                                value={
                                    startDate
                                        ? formatDateForDisplay(startDate)
                                        : ""
                                }
                                onClick={() => {
                                    setEndDatePickerOpen(false);
                                    setStartDatePickerOpen(
                                        !startDatePickerOpen
                                    );
                                }}
                                placeholder="연도. 월. 일."
                                icon={<IconCalendar className="w-4 h-4" />}
                                iconPosition="right"
                                readOnly
                            />
                            {startDatePickerOpen && (
                                <div className="absolute z-50 top-full left-0 mt-1">
                                    <DatePickerPanel
                                        selected={startDate}
                                        onSelect={(date) => {
                                            setStartDate(date);
                                            setStartDatePickerOpen(false);
                                        }}
                                    />
                                </div>
                            )}
                        </div>
                        {!allDay && (
                            <div className="flex gap-1 items-center">
                                <Select
                                    value={startHour}
                                    onChange={setStartHour}
                                    options={hourOptions.map((h) => ({
                                        value: h,
                                        label: `${h}시`,
                                    }))}
                                    className="w-[80px]"
                                />
                                <span className="text-gray-400">:</span>
                                <Select
                                    value={startMinute}
                                    onChange={setStartMinute}
                                    options={minuteOptions.map((m) => ({
                                        value: m,
                                        label: `${m}분`,
                                    }))}
                                    className="w-[80px]"
                                />
                                <IconClock className="w-4 h-4 text-gray-400 ml-1" />
                            </div>
                        )}
                    </div>
                </div>

                <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                        종료
                    </label>
                    <div className="flex gap-2 items-center">
                        <div className="relative flex-1" ref={endDatePickerRef}>
                            <Input
                                value={
                                    endDate ? formatDateForDisplay(endDate) : ""
                                }
                                onClick={() => {
                                    setStartDatePickerOpen(false);
                                    setEndDatePickerOpen(!endDatePickerOpen);
                                }}
                                placeholder="연도. 월. 일."
                                icon={<IconCalendar className="w-4 h-4" />}
                                iconPosition="right"
                                readOnly
                            />
                            {endDatePickerOpen && (
                                <div className="absolute z-50 top-full left-0 mt-1">
                                    <DatePickerPanel
                                        selected={endDate}
                                        onSelect={(date) => {
                                            setEndDate(date);
                                            setEndDatePickerOpen(false);
                                        }}
                                    />
                                </div>
                            )}
                        </div>
                        {!allDay && (
                            <div className="flex gap-1 items-center">
                                <Select
                                    value={endHour}
                                    onChange={setEndHour}
                                    options={hourOptions.map((h) => ({
                                        value: h,
                                        label: `${h}시`,
                                    }))}
                                    className="w-[80px]"
                                />
                                <span className="text-gray-400">:</span>
                                <Select
                                    value={endMinute}
                                    onChange={setEndMinute}
                                    options={minuteOptions.map((m) => ({
                                        value: m,
                                        label: `${m}분`,
                                    }))}
                                    className="w-[80px]"
                                />
                                <IconClock className="w-4 h-4 text-gray-400 ml-1" />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <Input label="참가자" placeholder="참가자" />

            <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" onClick={onClose}>
                    취소
                </Button>
                <Button
                    variant="primary"
                    onClick={() => {
                        if (!title || !startDate || !endDate) {
                            alert("일정 제목, 시작일, 종료일을 입력해주세요.");
                            return;
                        }
                        const startTime = allDay
                            ? undefined
                            : `${startHour}:${startMinute}`;
                        const endTime = allDay
                            ? undefined
                            : `${endHour}:${endMinute}`;
                        onSave?.({
                            title,
                            startDate,
                            startTime,
                            endDate,
                            endTime,
                            allDay,
                        });
                        onClose?.();
                    }}
                >
                    저장
                </Button>
            </div>
        </div>
    );
}
