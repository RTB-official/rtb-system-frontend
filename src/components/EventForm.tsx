import React, { useState, useEffect } from "react";
import { IconCalendar, IconClock, IconClose } from "./icons/Icons";
import DatePicker from "./ui/DatePicker";
import Button from "./common/Button";
import Input from "./common/Input";
import Select from "./common/Select";
import { CalendarEvent } from "../types";
import { supabase } from "../lib/supabase";
import { useToast } from "./ui/ToastProvider";

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
        attendees: string[];
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
    const [attendeeInput, setAttendeeInput] = useState("");
    const [attendees, setAttendees] = useState<string[]>(
        editingEvent?.attendees || []
    );
    const [showResults, setShowResults] = useState(false);
    const [allMembers, setAllMembers] = useState<Array<{ name: string; username: string }>>([]);

    // 회원 정보 가져오기
    useEffect(() => {
        const fetchMembers = async () => {
            try {
                const { data, error } = await supabase
                    .from("profiles")
                    .select("name, username")
                    .order("name", { ascending: true });

                if (error) {
                    console.error("Error fetching members:", error);
                    return;
                }

                if (data) {
                    setAllMembers(data.map((p) => ({ name: p.name || "", username: p.username || "" })));
                }
            } catch (error) {
                console.error("Error fetching members:", error);
            }
        };

        fetchMembers();
    }, []);

    const filteredMembers = allMembers.filter(
        (m) =>
            (m.name.includes(attendeeInput) || m.username.includes(attendeeInput)) &&
            !attendees.includes(m.name) &&
            attendeeInput.length > 0
    );

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

    const [startDate, setStartDate] = useState<string>(
        initialDate ? formatDateForInput(initialDate) : ""
    );
    const [startHour, setStartHour] = useState<string>("09");
    const [startMinute, setStartMinute] = useState<string>("00");

    const [endDate, setEndDate] = useState<string>(
        initialEndDate
            ? formatDateForInput(initialEndDate)
            : initialDate
                ? formatDateForInput(initialDate)
                : ""
    );
    const [endHour, setEndHour] = useState<string>("18");
    const [endMinute, setEndMinute] = useState<string>("00");

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
        if (editingEvent) {
            setTitle(editingEvent.title);
            setStartDate(formatDateForInput(editingEvent.startDate));
            setEndDate(formatDateForInput(editingEvent.endDate));
            setAttendees(editingEvent.attendees || []);
            setAllDay(editingEvent.allDay ?? false);
            if (editingEvent.startTime) {
                const [h, m] = editingEvent.startTime.split(":");
                setStartHour(h ?? "09");
                setStartMinute(m ?? "00");
            }
            if (editingEvent.endTime) {
                const [h, m] = editingEvent.endTime.split(":");
                setEndHour(h ?? "18");
                setEndMinute(m ?? "00");
            }
        }
    }, [editingEvent]);

    const handleAddAttendee = (member?: { name: string; username: string } | string) => {
        let targetName: string;

        if (typeof member === "object" && member) {
            targetName = member.name;
        } else if (typeof member === "string") {
            targetName = member;
        } else {
            targetName = attendeeInput;
        }

        if (targetName && !attendees.includes(targetName)) {
            setAttendees((prev) => [...prev, targetName]);
            setAttendeeInput("");
            setShowResults(false);
        }
    };

    const handleRemoveAttendee = (attendeeToRemove: string) => {
        setAttendees((prev) =>
            prev.filter((attendee) => attendee !== attendeeToRemove)
        );
    };

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
                    className="w-4 h-4 text-blue-500 border-gray-300 rounded focus:ring-blue-400 cursor-pointer"
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
                        <div className="flex-1">
                            <DatePicker
                                value={startDate}
                                onChange={(date) => {
                                    setStartDate(formatDateForInput(date));
                                }}
                                placeholder="연도. 월. 일."
                                icon={<IconCalendar className="w-4 h-4" />}
                                iconPosition="right"
                            />
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
                        <div className="flex-1">
                            <DatePicker
                                value={endDate}
                                onChange={(date) => {
                                    setEndDate(formatDateForInput(date));
                                }}
                                placeholder="연도. 월. 일."
                                icon={<IconCalendar className="w-4 h-4" />}
                                iconPosition="right"
                            />
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

            <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 block">
                    참가자
                </label>
                <div className="relative">
                    <div className="flex gap-2">
                        <Input
                            value={attendeeInput}
                            onChange={(val) => {
                                setAttendeeInput(val);
                                setShowResults(true);
                            }}
                            placeholder="참가자 이름 입력"
                            className="flex-1"
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    e.preventDefault();
                                    if (filteredMembers.length > 0) {
                                        handleAddAttendee(filteredMembers[0]);
                                    } else if (attendeeInput.trim()) {
                                        handleAddAttendee(attendeeInput.trim());
                                    }
                                }
                            }}
                            onFocus={() => setShowResults(true)}
                        />
                        <Button
                            type="button"
                            variant="primary"
                            size="lg"
                            onClick={() => handleAddAttendee()}
                        >
                            추가
                        </Button>
                    </div>

                    {showResults && filteredMembers.length > 0 && (
                        <div className="absolute z-[60] top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                            {filteredMembers.map((member) => (
                                <div
                                    key={member.username || member.name}
                                    className="px-4 py-2 hover:bg-gray-50 cursor-pointer text-sm text-gray-700"
                                    onClick={() => handleAddAttendee(member)}
                                >
                                    {member.name}
                                    {member.username && (
                                        <span className="text-gray-400 ml-2">
                                            ({member.username})
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div className="flex flex-wrap gap-2">
                    {attendees.map((attendee) => (
                        <Button
                            key={attendee}
                            variant="secondary"
                            size="md"
                            onClick={() => handleRemoveAttendee(attendee)}
                        >
                            {attendee}
                            <IconClose className="ml-1 w-4 h-4" />
                        </Button>
                    ))}
                </div>
            </div>

            <div className="flex justify-end gap-3 w-full pt-2">
                <Button variant="outline" fullWidth size="lg" onClick={onClose}>
                    취소
                </Button>
                <Button
                    variant="primary"
                    fullWidth
                    size="lg"
                    onClick={() => {
                        if (!title || !startDate || !endDate) {
                            showError("일정 제목, 시작일, 종료일을 입력해주세요.");
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
                            attendees,
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
