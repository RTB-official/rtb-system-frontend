interface NotificationItem {
    id: string;
    title: string;
    message: string;
    meta?: string;
}

interface NotificationPopupProps {
    onClose: () => void;
    items?: NotificationItem[];
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
}: NotificationPopupProps) {
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
        <div className="absolute left-[239px] top-0 -translate-y-2 -translate-x-[16px] w-[360px] bg-white rounded-xl shadow-lg border border-[#e6eef5] p-3 z-50">
            <div className="flex items-center justify-between mb-2">
                <h4 className="text-[16px] font-semibold text-[#101828]">
                    알림
                </h4>
                <div className="flex items-center gap-2">
                    <button className="text-sm text-[#6b7280] hover:text-[#101828]">
                        모두 읽음
                    </button>
                    <button
                        onClick={onClose}
                        className="p-1 rounded hover:bg-[#f3f4f6]"
                    >
                        <IconClose />
                    </button>
                </div>
            </div>

            <div className="flex flex-col gap-3 max-h-[320px] overflow-auto pr-1">
                {sampleItems.map((it) => (
                    <div
                        key={it.id}
                        className="flex flex-col gap-1 bg-[#fbfdff] rounded-lg p-3 border border-[#eef4f8]"
                    >
                        <div className="flex items-start justify-between">
                            <p className="text-[13px] font-medium text-[#0f1724]">
                                {it.title}
                            </p>
                        </div>
                        <p className="text-[13px] text-[#475569]">
                            {it.message}
                        </p>
                        {it.meta && (
                            <p className="text-[12px] text-[#9aa4b2]">
                                {it.meta}
                            </p>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
