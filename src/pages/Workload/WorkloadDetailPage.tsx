import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/common/Header";
import Table from "../../components/common/Table";
import YearMonthSelector from "../../components/common/YearMonthSelector";
import { IconArrowBack } from "../../components/icons/Icons";
const IconWork = () => (
    <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
    >
        <path
            d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z"
            fill="currentColor"
        />
    </svg>
);
const IconDriveEta = () => (
    <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
    >
        <path
            d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"
            fill="currentColor"
        />
    </svg>
);
const IconSchedule = () => (
    <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
    >
        <path
            d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"
            fill="currentColor"
        />
    </svg>
);

// 이모지는 제거하고 아이콘으로 복구합니다.

// 샘플 사용자 데이터
const userData: Record<
    string,
    { name: string; totalWork: string; totalTravel: string; totalWait: string }
> = {
    "1": {
        name: "홍길동",
        totalWork: "101시간",
        totalTravel: "20시간 30분",
        totalWait: "0시간",
    },
    "2": {
        name: "김철수",
        totalWork: "95시간",
        totalTravel: "18시간 45분",
        totalWait: "2시간",
    },
    "3": {
        name: "이영희",
        totalWork: "110시간",
        totalTravel: "15시간 20분",
        totalWait: "1시간",
    },
};

// 샘플 테이블 데이터
interface WorkloadDetailRow {
    id: number;
    date: string;
    vesselName: string;
    workTime: string;
    timeRange: string;
    travelTime: string;
    waitTime: string;
}

const detailTableData: WorkloadDetailRow[] = [
    {
        id: 1,
        date: "2025.11.01",
        vesselName: "SH8218",
        workTime: "8시간",
        timeRange: "09:00-17:00",
        travelTime: "1시간 30분",
        waitTime: "0시간",
    },
    {
        id: 2,
        date: "2025.11.02",
        vesselName: "SH8218",
        workTime: "7시간 30분",
        timeRange: "08:30-16:00",
        travelTime: "2시간",
        waitTime: "30분",
    },
    {
        id: 3,
        date: "2025.11.03",
        vesselName: "SH8219",
        workTime: "9시간",
        timeRange: "09:00-18:00",
        travelTime: "1시간",
        waitTime: "0시간",
    },
    {
        id: 4,
        date: "2025.11.04",
        vesselName: "SH8218",
        workTime: "8시간",
        timeRange: "09:00-17:00",
        travelTime: "1시간 30분",
        waitTime: "0시간",
    },
    {
        id: 5,
        date: "2025.11.05",
        vesselName: "SH8220",
        workTime: "7시간",
        timeRange: "10:00-17:00",
        travelTime: "2시간 30분",
        waitTime: "1시간",
    },
    {
        id: 6,
        date: "2025.11.06",
        vesselName: "SH8218",
        workTime: "8시간 30분",
        timeRange: "08:30-17:00",
        travelTime: "1시간",
        waitTime: "0시간",
    },
    {
        id: 7,
        date: "2025.11.07",
        vesselName: "SH8219",
        workTime: "9시간",
        timeRange: "09:00-18:00",
        travelTime: "1시간 30분",
        waitTime: "30분",
    },
    {
        id: 8,
        date: "2025.11.08",
        vesselName: "SH8218",
        workTime: "8시간",
        timeRange: "09:00-17:00",
        travelTime: "2시간",
        waitTime: "0시간",
    },
    {
        id: 9,
        date: "2025.11.09",
        vesselName: "SH8220",
        workTime: "7시간 30분",
        timeRange: "09:30-17:00",
        travelTime: "1시간 30분",
        waitTime: "0시간",
    },
    {
        id: 10,
        date: "2025.11.10",
        vesselName: "SH8218",
        workTime: "8시간",
        timeRange: "09:00-17:00",
        travelTime: "1시간",
        waitTime: "0시간",
    },
];

export default function WorkloadDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [selectedYear, setSelectedYear] = useState("2025년");
    const [selectedMonth, setSelectedMonth] = useState("11월");
    const [currentPage, setCurrentPage] = useState(1);
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const user = userData[id || "1"] || userData["1"];
    const totalPages = 3;

    return (
        <div className="flex h-screen bg-white font-pretendard">
            {/* 모바일 오버레이 */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <div
                className={`
        fixed lg:static inset-y-0 left-0 z-50
        transform ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0
        transition-transform duration-300 ease-in-out
      `}
            >
                <Sidebar onClose={() => setSidebarOpen(false)} />
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <Header
                    title={`${user.name} 작업자 워크로드`}
                    onMenuClick={() => setSidebarOpen(true)}
                    leftContent={
                        <button
                            onClick={() => navigate("/workload")}
                            className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
                            title="목록으로 돌아가기"
                        >
                            <IconArrowBack />
                        </button>
                    }
                />

                {/* Content */}
                <main className="flex-1 overflow-auto pt-6 pb-24 px-9">
                    <div className="flex flex-col gap-6 w-full">
                        {/* 요약 카드 (Icon 기반) */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {[
                                {
                                    label: "총 작업시간",
                                    value: user.totalWork,
                                    color: "text-gray-900",
                                },
                                {
                                    label: "이동시간",
                                    value: user.totalTravel,
                                    color: "text-gray-900",
                                },
                                {
                                    label: "대기시간",
                                    value: user.totalWait,
                                    color: "text-gray-900",
                                },
                            ].map((card) => (
                                <div
                                    key={card.label}
                                    className="bg-gray-50 rounded-2xl p-5"
                                >
                                    <div className="flex items-center gap-2 text-gray-500 mb-2">
                                        {card.label === "총 작업시간" ? (
                                            <IconWork />
                                        ) : card.label === "이동시간" ? (
                                            <IconDriveEta />
                                        ) : (
                                            <IconSchedule />
                                        )}
                                        <span className="text-sm">
                                            {card.label}
                                        </span>
                                    </div>
                                    <div
                                        className={`mt-2 text-[26px] font-bold ${card.color}`}
                                    >
                                        {card.value}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* 조회 기간 */}
                        <div className="flex flex-wrap items-center gap-5">
                            <h2 className="text-[24px] font-semibold text-gray-900">
                                조회 기간
                            </h2>
                            <YearMonthSelector
                                year={selectedYear}
                                month={selectedMonth}
                                onYearChange={setSelectedYear}
                                onMonthChange={setSelectedMonth}
                            />
                        </div>

                        {/* 날짜별 세부 분석 테이블 */}
                        <div className="bg-white border border-gray-200 rounded-2xl p-7">
                            <h2 className="text-[22px] font-semibold text-gray-700 tracking-tight mb-6">
                                날짜별 세부 분석
                            </h2>

                            <Table
                                columns={[
                                    {
                                        key: "date",
                                        label: "날짜",
                                        render: (value: string) => {
                                            const date = new Date(
                                                value.replace(/\./g, "-")
                                            );
                                            if (isNaN(date.getTime()))
                                                return value;

                                            const days = [
                                                "일",
                                                "월",
                                                "화",
                                                "수",
                                                "목",
                                                "금",
                                                "토",
                                            ];
                                            const dayOfWeek = date.getDay();
                                            const dayLabel = days[dayOfWeek];

                                            // 2025. 12. 18.(목) 형식
                                            const formattedDate = `${date.getFullYear()}. ${
                                                date.getMonth() + 1
                                            }. ${date.getDate()}.(${dayLabel})`;

                                            let colorClass = "text-gray-800";
                                            if (dayOfWeek === 0)
                                                colorClass =
                                                    "text-red-600"; // 일요일
                                            else if (dayOfWeek === 6)
                                                colorClass = "text-blue-600"; // 토요일

                                            return (
                                                <span
                                                    className={`font-medium ${colorClass}`}
                                                >
                                                    {formattedDate}
                                                </span>
                                            );
                                        },
                                    },
                                    { key: "vesselName", label: "호선명" },
                                    { key: "workTime", label: "작업시간" },
                                    { key: "timeRange", label: "시간대" },
                                    { key: "travelTime", label: "이동시간" },
                                    { key: "waitTime", label: "대기시간" },
                                ]}
                                data={detailTableData}
                                rowKey="id"
                                pagination={{
                                    currentPage,
                                    totalPages,
                                    onPageChange: setCurrentPage,
                                }}
                            />
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
