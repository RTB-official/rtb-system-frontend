// EventDetailMenu.tsx
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { IconCalendar, IconVacation, IconReport, IconDownload, IconStar } from "../icons/Icons";
import { CalendarEvent } from "../../types";
import Button from "./Button";
import Avatar from "./Avatar";
import Chip from "../ui/Chip";
import { supabase } from "../../lib/supabase";
import { getVacationById } from "../../lib/vacationApi";
import { getWorkLogByIdCached } from "../../lib/workLogApi";
import { formatDateRange } from "../../utils/calendarUtils";

interface EventDetailMenuProps {
    isOpen: boolean;
    anchorEl: HTMLElement | null;
    position?: { x: number; y: number };
    onClose: () => void;
    event: CalendarEvent | null;
    onEdit: (event: CalendarEvent) => void;
    onDelete: (eventId: string) => void;
    currentUserId?: string; // 현재 로그인한 사용자 ID
    isAdmin?: boolean; // ✅ 관리자 여부
}

const EventDetailMenu: React.FC<EventDetailMenuProps> = ({
    isOpen,
    anchorEl,
    position,
    onClose,
    event,
    onEdit,
    onDelete,
    currentUserId,
    isAdmin,
}) => {
    const navigate = useNavigate();
    const menuRef = useRef<HTMLDivElement>(null);
    const vacationCacheRef = useRef<Map<string, any>>(new Map());
    const profileCacheRef = useRef<Map<string, any>>(new Map());
    const attendeeProfileCacheRef = useRef<Map<string, any>>(new Map()); // ✅ 참여자 캐시
    const [vacationData, setVacationData] = useState<any>(null);
    const [workLogData, setWorkLogData] = useState<any>(null);
    const [userProfile, setUserProfile] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    // 이벤트 타입 구분
    const eventType = event?.id.startsWith("vacation-")
        ? "vacation"
        : event?.id.startsWith("worklog-")
            ? "worklog"
            : event?.id.startsWith("holiday-")
                ? "holiday"
                : event?.id.startsWith("event-")
                    ? "event"
                    : null;

    // 휴가 데이터 로드
    useEffect(() => {
        if (!isOpen || !event || eventType !== "vacation") return;

        const loadVacationData = async () => {
            setLoading(true);
            try {
                const vacationId = event.id.replace("vacation-", "");
                const cachedVacation = vacationCacheRef.current.get(vacationId);
                if (cachedVacation) {
                    setVacationData(cachedVacation);
                    if (cachedVacation.user_id) {
                        const cachedProfile = profileCacheRef.current.get(
                            cachedVacation.user_id
                        );
                        if (cachedProfile) {
                            setUserProfile(cachedProfile);
                        }
                    }
                    setLoading(false);
                    return;
                }
                const vacation = await getVacationById(vacationId);

                if (vacation) {
                    vacationCacheRef.current.set(vacationId, vacation);
                    setVacationData(vacation);

                    // 사용자 프로필 가져오기
                    if (vacation.user_id) {
                        const cachedProfile = profileCacheRef.current.get(
                            vacation.user_id
                        );
                        if (cachedProfile) {
                            setUserProfile(cachedProfile);
                            setLoading(false);
                            return;
                        }
                        const { data: profile } = await supabase
                            .from("profiles")
                            .select("name, email, position")
                            .eq("id", vacation.user_id)
                            .single();

                        if (profile) {
                            profileCacheRef.current.set(vacation.user_id, profile);
                            setUserProfile(profile);
                        }
                    }
                }
            } catch (error) {
                console.error("휴가 데이터 로드 실패:", error);
            } finally {
                setLoading(false);
            }
        };

        loadVacationData();
    }, [isOpen, event, eventType]);

    // 보고서 데이터 로드
    useEffect(() => {
        if (!isOpen || !event || eventType !== "worklog") return;

        const loadWorkLogData = async () => {
            setLoading(true);
            try {
                const workLogId = event.id.replace("worklog-", "");
                const workLog = await getWorkLogByIdCached(parseInt(workLogId));

                if (workLog) {
                    setWorkLogData(workLog);
                }
            } catch (error) {
                console.error("보고서 데이터 로드 실패:", error);
            } finally {
                setLoading(false);
            }
        };

        loadWorkLogData();
    }, [isOpen, event, eventType]);

    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as Node;
            if (menuRef.current?.contains(target)) return;
            if (anchorEl?.contains(target)) return;
            onClose();
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () =>
            document.removeEventListener("mousedown", handleClickOutside);
    }, [isOpen, anchorEl, onClose]);

    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen || (!anchorEl && !position) || !event) return null;

    let top = 0;
    let left = 0;

    if (position) {
        top = position.y;
        left = position.x;
    } else if (anchorEl) {
        const rect = anchorEl.getBoundingClientRect();
        top = rect.bottom + 8;
        left = rect.left;
    }

    // 화면 밖으로 나가는 것 방지
    const menuWidth = 320;
    const menuHeight = 400;

    // 가로 보정
    if (left + menuWidth > window.innerWidth - 12) {
        left = window.innerWidth - menuWidth - 12;
    }
    if (left < 12) left = 12;

    // 세로 보정 (바닥 뚫림 방지)
    if (top + menuHeight > window.innerHeight - 12) {
        top = window.innerHeight - menuHeight - 12;
    }
    if (top < 12) top = 12;

    // 날짜 포맷팅
    const formatDate = (dateStr: string): string => {
        const date = new Date(dateStr);
        return `${date.getMonth() + 1}월 ${date.getDate()}일`;
    };

    const formatDateTime = (dateStr: string): string => {
        const date = new Date(dateStr);
        return `${date.getMonth() + 1}월 ${date.getDate()}일`;
    };

    // 상태 태그 텍스트
    const getStatusText = (status: string) => {
        const statusMap: Record<string, string> = {
            pending: "승인 대기",
            approved: "승인 완료",
            rejected: "반려됨",
        };
        return statusMap[status] || status;
    };

    // 상태에 따른 Chip 색상 (휴가 관리 페이지와 동일)
    const getStatusColor = (status: string): string => {
        const colorMap: Record<string, string> = {
            pending: "gray-500",
            approved: "green-700",
            rejected: "red-600",
        };
        return colorMap[status] || "gray-500";
    };

    // 휴가 UI
    const renderVacationUI = () => {
        if (loading) {
            return (
                <div className="flex items-center justify-center py-8">
                    <div className="text-sm text-gray-500">로딩 중...</div>
                </div>
            );
        }

        if (!vacationData) return null;

        const dateText = formatDate(vacationData.date);
        const leaveTypeLabel =
            vacationData.leave_type === "AM"
                ? "오전 반차"
                : vacationData.leave_type === "PM"
                    ? "오후 반차"
                    : "하루 종일";

        return (
            <div className="flex flex-col gap-4">
                <div className="flex gap-3 items-start">
                    <div className="shrink-0">
                        <IconVacation className="w-6 h-6 text-gray-700" />
                    </div>
                    <div className="flex-1 flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                            <h3 className="text-lg font-semibold text-gray-900">
                                휴가
                            </h3>
                            <Chip color={getStatusColor(vacationData.status)} variant="solid" size="sm">
                                {getStatusText(vacationData.status)}
                            </Chip>
                        </div>
                        <div className="text-sm text-gray-500">
                            {dateText} {leaveTypeLabel}
                        </div>
                        {userProfile && (
                            <div className="flex items-center gap-2 my-1">
                                <Avatar
                                    email={userProfile.email || null}
                                    size={24}
                                    position={userProfile.position || null}
                                />
                                <span className="text-base font-medium text-gray-700">
                                    {userProfile.name}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    // 보고서 UI
    const renderWorkLogUI = () => {
        if (loading) {
            return (
                <div className="flex items-center justify-center py-8">
                    <div className="text-sm text-gray-500">로딩 중...</div>
                </div>
            );
        }

        // 제목에서 "출장보고서 - " 접두사 제거 (설명에서는 제목만 표시)
        let title = event.title || "";
        if (title.startsWith("출장보고서 - ")) {
            title = title.replace("출장보고서 - ", "");
        }
        if (!title) {
            title = "출장 보고서";
        }

        const entries = workLogData?.entries || [];
        const dateCandidates = entries.flatMap((entry: any) => [
            entry.dateFrom || null,
            entry.dateTo || null,
        ]).filter(Boolean) as string[];
        const periodStart = dateCandidates.length > 0 ? dateCandidates.reduce((a, b) => (a < b ? a : b)) : null;
        const periodEnd = dateCandidates.length > 0 ? dateCandidates.reduce((a, b) => (a > b ? a : b)) : null;
        const workPeriod = periodStart ? formatDateRange(periodStart, periodEnd || periodStart) : null;

        return (
            <div className="flex flex-col gap-2.5">
                <div className="flex gap-3 items-start">
                    <div className="shrink-0">
                        <IconReport className="w-6 h-6 text-gray-700" />
                    </div>
                    <div className="flex-1 flex flex-col gap-2 min-w-0">
                        <h3 className="text-lg font-semibold text-gray-900 leading-tight break-words text-left">
                            {title}
                        </h3>
                        {workPeriod ? (
                            <div className="text-sm text-gray-500 text-left">
                                {workPeriod}
                            </div>
                        ) : (
                            <div className="text-sm text-gray-500 text-left">
                                출장기간 정보 없음
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex gap-3">
                    <div className="w-6 shrink-0"></div>
                    <div className="flex gap-2 flex-1">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                                e.stopPropagation();
                                const workLogId = event.id.replace("worklog-", "");
                                navigate(`/report/${workLogId}`);
                                onClose();
                            }}
                        >
                            자세히 보기
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                                e.stopPropagation();
                                const workLogId = event.id.replace("worklog-", "");
                                // PDF 페이지를 새 창으로 열기
                                const url = `/report/pdf?id=${workLogId}&autoPrint=1`;
                                window.open(url, "report_pdf_window", [
                                    "width=980",
                                    "height=820",
                                    "left=120",
                                    "top=60",
                                    "scrollbars=yes",
                                    "resizable=yes",
                                    "toolbar=yes",
                                    "menubar=yes",
                                    "location=yes",
                                    "status=no",
                                    "noopener=yes",
                                    "noreferrer=yes",
                                ].join(","));
                                onClose();
                            }}
                            icon={<IconDownload className="w-4 h-4" />}
                        >
                            PDF 저장
                        </Button>
                    </div>
                </div>
            </div>
        );
    };

    // 일정 UI
    const renderEventUI = () => {
        const formatDay = (dateStr: string) => {
            const d = new Date(dateStr + "T12:00:00");
            return `${d.getMonth() + 1}월 ${d.getDate()}일`;
        };
        const formatTimeLabel = (timeStr: string) => {
            if (!timeStr) return "";
            const [h, m] = timeStr.split(":").map(Number);
            if (!m || m === 0) return `${h}시`;
            return `${h}시 ${m}분`;
        };

        const dateRangeText =
            event.allDay === true
                ? event.startDate === event.endDate
                    ? `${formatDay(event.startDate)} 하루 종일`
                    : `${formatDay(event.startDate)} ~ ${formatDay(event.endDate)}`
                : event.startTime && event.endTime
                    ? event.startDate === event.endDate
                        ? `${formatDay(event.startDate)} ${formatTimeLabel(event.startTime)} ~ ${formatTimeLabel(event.endTime)}`
                        : `${formatDay(event.startDate)} ${formatTimeLabel(event.startTime)} ~ ${formatDay(event.endDate)} ${formatTimeLabel(event.endTime)}`
                    : `${formatDay(event.startDate)}${event.startTime ? ` ${formatTimeLabel(event.startTime)}` : ""} ~ ${formatDay(event.endDate)}${event.endTime ? ` ${formatTimeLabel(event.endTime)}` : ""}`;

        return (
            <div className="flex flex-col gap-4">
                <div className="flex gap-3 items-start">
                    <div className="shrink-0">
                        <IconCalendar className="w-6 h-6 text-gray-700" />
                    </div>
                    <div className="flex-1 flex flex-col gap-2 min-w-0">
                        <h3 className="text-lg font-semibold text-gray-900 leading-tight break-words">
                            {event.title}
                        </h3>
                        <div className="text-sm text-gray-500 font-medium">
                            {dateRangeText}
                        </div>
                        {event.attendees && event.attendees.length > 0 && (
                            <div className="flex flex-col gap-2 mt-2">
                                <span className="text-xs text-gray-500 font-medium">
                                    참여자
                                </span>
                                <div className="flex flex-col gap-2">
                                {event.attendees.map((attendeeName) => (
                                        <AttendeeProfile
                                            key={attendeeName} // ✅ 고정 key
                                            attendeeName={attendeeName}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                {/* 생성자 또는 관리자만 수정/삭제 버튼 표시 */}
                {(event.userId === currentUserId || isAdmin) && (
                    <div className="flex gap-2 mt-2">
                        <Button
                            variant="outline"
                            size="sm"
                            fullWidth
                            onClick={(e) => {
                                e.stopPropagation();
                                onEdit(event);
                                onClose();
                            }}
                        >
                            수정
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            fullWidth
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete(event.id);
                                onClose();
                            }}
                        >
                            삭제
                        </Button>
                    </div>
                )}
            </div>
        );
    };

    // 공휴일 UI
    const renderHolidayUI = () => {
        const holidayRange = formatDateRange(event.startDate, event.endDate);
        return (
            <div className="flex flex-col gap-4">
                <div className="flex gap-3 items-start">
                    <div className="shrink-0">
                        <IconStar className="w-6 h-6 text-red-500" />
                    </div>
                    <div className="flex-1 flex flex-col gap-2 min-w-0">
                        <h3 className="text-lg font-semibold text-gray-900 leading-tight break-words">
                            {event.title}
                        </h3>
                        <div className="text-sm text-gray-500 font-medium">
                            대한민국 공휴일
                        </div>
                        <div className="text-sm text-gray-500 font-medium">
                            {holidayRange}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // 참여자 프로필 컴포넌트
    const AttendeeProfile: React.FC<{ attendeeName: string }> = ({ attendeeName }) => {
        const [profile, setProfile] = useState<any>(() => {
            return attendeeProfileCacheRef.current.get(attendeeName) || null;
        });

        useEffect(() => {
            let cancelled = false;

            const loadProfile = async () => {
                try {
                    // ✅ 캐시 먼저 확인
                    const cached = attendeeProfileCacheRef.current.get(attendeeName);
                    if (cached) {
                        if (!cancelled) setProfile(cached);
                        return;
                    }

                    const { data } = await supabase
                        .from("profiles")
                        .select("name, email, position")
                        .eq("name", attendeeName)
                        .single();

                    if (data) {
                        attendeeProfileCacheRef.current.set(attendeeName, data); // ✅ 캐시에 저장
                        if (!cancelled) setProfile(data);
                    }
                } catch (error) {
                    if (!cancelled) {
                        console.error("프로필 로드 실패:", error);
                    }
                }
            };

            loadProfile();

            return () => {
                cancelled = true;
            };
        }, [attendeeName]);


        if (!profile) {
            // 프로필을 찾지 못한 경우 이름만 표시
            return (
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">
                        {attendeeName}
                    </span>
                </div>
            );
        }

        return (
            <div className="flex items-center gap-2">
                <Avatar
                    email={profile.email || null}
                    size={24}
                    position={profile.position || null}
                />
                <span className="text-base font-medium text-gray-700">
                    {profile.name}
                </span>
            </div>
        );
    };

    return createPortal(
        <div
            ref={menuRef}
            className="fixed z-9999 w-80 bg-white rounded-2xl shadow-lg border border-gray-200 p-4"
            style={{ top, left }}
        >
            {eventType === "vacation" && renderVacationUI()}
            {eventType === "worklog" && renderWorkLogUI()}
            {eventType === "holiday" && renderHolidayUI()}
            {eventType === "event" && renderEventUI()}
            {!eventType && (
                <div className="text-sm text-gray-500">
                    알 수 없는 이벤트 타입
                </div>
            )}
        </div>,
        document.body
    );
};

export default EventDetailMenu;
