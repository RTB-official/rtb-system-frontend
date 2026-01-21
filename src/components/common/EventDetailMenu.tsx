import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { IconCalendar, IconVacation, IconReport } from "../icons/Icons";
import { CalendarEvent } from "../../types";
import Button from "./Button";
import Avatar from "./Avatar";
import Chip from "../ui/Chip";
import { supabase } from "../../lib/supabase";
import { getVacationById } from "../../lib/vacationApi";
import { getWorkLogById } from "../../lib/workLogApi";

interface EventDetailMenuProps {
    isOpen: boolean;
    anchorEl: HTMLElement | null;
    position?: { x: number; y: number };
    onClose: () => void;
    event: CalendarEvent | null;
    onEdit: (event: CalendarEvent) => void;
    onDelete: (eventId: string) => void;
    currentUserId?: string; // 현재 로그인한 사용자 ID
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
}) => {
    const navigate = useNavigate();
    const menuRef = useRef<HTMLDivElement>(null);
    const [vacationData, setVacationData] = useState<any>(null);
    const [workLogData, setWorkLogData] = useState<any>(null);
    const [userProfile, setUserProfile] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    // 이벤트 타입 구분
    const eventType = event?.id.startsWith("vacation-")
        ? "vacation"
        : event?.id.startsWith("worklog-")
            ? "worklog"
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
                const vacation = await getVacationById(vacationId);

                if (vacation) {
                    setVacationData(vacation);

                    // 사용자 프로필 가져오기
                    if (vacation.user_id) {
                        const { data: profile } = await supabase
                            .from("profiles")
                            .select("name, email, position")
                            .eq("id", vacation.user_id)
                            .single();

                        if (profile) {
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
                const workLog = await getWorkLogById(parseInt(workLogId));

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
            pending: "대기 중",
            approved: "승인됨",
            rejected: "거부됨",
        };
        return statusMap[status] || status;
    };

    // 상태에 따른 Chip 색상 (휴가 관리 페이지와 동일)
    const getStatusColor = (status: string): string => {
        const colorMap: Record<string, string> = {
            pending: "blue-600",
            approved: "green-700",
            rejected: "red-700",
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
        const isAllDay = true; // 휴가는 항상 하루종일

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
                            {dateText} {isAllDay ? "하루종일" : ""}
                        </div>
                        {userProfile && (
                            <div className="flex items-center gap-2 mt-2">
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

        // 작성일 표시 (작업 기간이 아닌 작성일)
        const createdDate = workLogData?.workLog?.created_at
            ? formatDateTime(workLogData.workLog.created_at)
            : null;

        return (
            <div className="flex flex-col gap-2.5">
                <div className="flex gap-3 items-start">
                    <div className="shrink-0">
                        <IconReport className="w-6 h-6 text-gray-700" />
                    </div>
                    <div className="flex-1 flex flex-col gap-2">
                        <h3 className="text-lg font-semibold text-gray-900 leading-tight wrap-break-word text-left">
                            {title}
                        </h3>
                        {createdDate ? (
                            <div className="text-sm text-gray-500 text-left">
                                {createdDate} 작성
                            </div>
                        ) : (
                            <div className="text-sm text-gray-500 text-left">
                                작성일 정보 없음
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex gap-3">
                    <div className="w-6 shrink-0"></div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                            e.stopPropagation();
                            const workLogId = event.id.replace("worklog-", "");
                            navigate(`/reportcreate?id=${workLogId}`);
                            onClose();
                        }}
                    >
                        자세히 보기
                    </Button>
                </div>
            </div>
        );
    };

    // 일정 UI
    const renderEventUI = () => {
        const formatDateTimeRange = (
            startDate: string,
            endDate: string
        ): string => {
            const start = new Date(startDate);
            const end = new Date(endDate);

            const startTime = `${start.getHours()}시`;
            const endTime = `${end.getHours()}시`;

            const startDay = `${start.getMonth() + 1}월 ${start.getDate()}일`;
            const endDay = `${end.getMonth() + 1}월 ${end.getDate()}일`;

            if (startDate === endDate) {
                return `${startDay} ${startTime} ~ ${endTime}`;
            }
            return `${startDay} ${startTime} ~ ${endDay} ${endTime}`;
        };

        return (
            <div className="flex flex-col gap-4">
                <div className="flex gap-3 items-start">
                    <div className="shrink-0">
                        <IconCalendar className="w-6 h-6 text-gray-700" />
                    </div>
                    <div className="flex-1 flex flex-col gap-2">
                        <h3 className="text-lg font-semibold text-gray-900 leading-tight">
                            {event.title}
                        </h3>
                        <div className="text-sm text-gray-500 font-medium">
                            {formatDateTimeRange(
                                event.startDate,
                                event.endDate
                            )}
                        </div>
                        {event.attendees && event.attendees.length > 0 && (
                            <div className="flex flex-col gap-2 mt-2">
                                <span className="text-xs text-gray-500 font-medium">
                                    참여자
                                </span>
                                <div className="flex flex-col gap-2">
                                    {event.attendees.map((attendeeName, i) => (
                                        <AttendeeProfile
                                            key={i}
                                            attendeeName={attendeeName}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                {/* 생성자만 수정/삭제 버튼 표시 */}
                {event.userId === currentUserId && (
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

    // 참여자 프로필 컴포넌트
    const AttendeeProfile: React.FC<{ attendeeName: string }> = ({ attendeeName }) => {
        const [profile, setProfile] = useState<any>(null);

        useEffect(() => {
            const loadProfile = async () => {
                try {
                    const { data } = await supabase
                        .from("profiles")
                        .select("name, email, position")
                        .eq("name", attendeeName)
                        .single();

                    if (data) {
                        setProfile(data);
                    }
                } catch (error) {
                    console.error("프로필 로드 실패:", error);
                }
            };

            loadProfile();
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
