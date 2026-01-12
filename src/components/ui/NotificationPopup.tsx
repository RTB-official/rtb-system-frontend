import { useEffect, useRef } from "react";

interface NotificationItem {
    id: string;
    title: string;
    message: string;
    meta?: string;
}

interface NotificationPopupProps {
    onClose: () => void;
    items?: NotificationItem[];
    anchorEl?: HTMLElement | null;
}

const IconClose = () => (
    <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
    >
        <path
            d="M19 6.41L17.59 5L12 10.59L6.41 5L5 6.41L10.59 12L5 17.59L6.41 19L12 13.41L17.59 19L19 17.59L13.41 12L19 6.41Z"
            fill="currentColor"
        />
    </svg>
);

export default function NotificationPopup({
    onClose,
    items,
    anchorEl,
}: NotificationPopupProps) {
    const popupRef = useRef<HTMLDivElement>(null);

    // 바깥 클릭 닫기
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as Node;
            if (
                popupRef.current &&
                !popupRef.current.contains(target) &&
                (!anchorEl || !anchorEl.contains(target))
            ) {
                onClose();
            }
        };

        // mousedown 대신 click을 사용하면 버튼 클릭 시의 상태와 충돌할 수 있으므로
        // 약간의 지연을 주거나 mousedown을 사용합니다.
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [onClose]);

    const sampleItems: NotificationItem[] = items ?? [
        {
            id: "1",
            title: "캡션",
            message:
                "알림의 내용이 들어갑니다. 내용이 길어지면 다음 줄로 넘어가요.",
            meta: "날짜 또는 부가 정보",
        },
        {
            id: "2",
            title: "캡션",
            message:
                "알림의 내용이 들어갑니다. 내용이 길어지면 다음 줄로 넘어가요.",
            meta: "날짜 또는 부가 정보",
        },
        {
            id: "3",
            title: "캡션",
            message:
                "알림의 내용이 들어갑니다. 내용이 길어지면 다음 줄로 넘어가요.",
            meta: "날짜 또는 부가 정보",
        },
    ];

    return (
        <div
            ref={popupRef}
            className="absolute left-[239px] top-0 -translate-y-4 -translate-x-[16px] w-[360px] bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-50 animate-in fade-in slide-in-from-left-4 duration-200"
        >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-50">
                <h4 className="text-[20px] font-bold text-[#1e293b]">알림</h4>
                <button className="text-[14px] text-gray-400 hover:text-gray-600 font-medium transition-colors">
                    모두 읽음
                </button>
            </div>

            {/* Notification List */}
            <div className="max-h-[480px] overflow-y-auto custom-scrollbar">
                {sampleItems.map((it) => (
                    <div
                        key={it.id}
                        className="flex flex-col gap-1 px-5 py-4 bg-white hover:bg-[#f0f7ff] transition-colors cursor-pointer relative group border-b border-gray-50 last:border-0"
                    >
                        <div className="flex items-start justify-between">
                            <p className="text-[14px] font-semibold text-[#475569]">
                                {it.title}
                            </p>
                            <button
                                className="text-gray-400 hover:text-gray-600 p-0.5 transition-colors"
                                onClick={(e) => {
                                    e.stopPropagation();
                                }}
                            >
                                <IconClose />
                            </button>
                        </div>
                        <p className="text-[14px] text-[#64748b] leading-relaxed pr-6">
                            {it.message}
                        </p>
                        {it.meta && (
                            <p className="text-[13px] text-gray-400 mt-1">
                                {it.meta}
                            </p>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
