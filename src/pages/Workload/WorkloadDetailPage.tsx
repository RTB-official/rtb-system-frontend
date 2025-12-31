import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/common/Header";
import Table from "../../components/common/Table";

// 아이콘 컴포넌트
const IconChevronDown = () => (
    <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
    >
        <path
            d="M7.41 8.59L12 13.17L16.59 8.59L18 10L12 16L6 10L7.41 8.59Z"
            fill="currentColor"
        />
    </svg>
);

const IconChevronLeft = () => (
    <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
    >
        <path
            d="M15.41 7.41L14 6L8 12L14 18L15.41 16.59L10.83 12L15.41 7.41Z"
            fill="currentColor"
        />
    </svg>
);

const IconChevronRight = () => (
    <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
    >
        <path
            d="M8.59 16.59L10 18L16 12L10 6L8.59 7.41L13.17 12L8.59 16.59Z"
            fill="currentColor"
        />
    </svg>
);

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

const IconArrowBack = () => (
    <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
    >
        <path
            d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"
            fill="currentColor"
        />
    </svg>
);

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
const detailTableData = [
    {
        id: 1,
        col1: "Text",
        col2: "Text",
        col3: "Text",
        col4: "Text",
        col5: "Text",
        col6: "Text",
        col7: "Text",
        col8: "Text",
    },
    {
        id: 2,
        col1: "Text",
        col2: "Text",
        col3: "Text",
        col4: "Text",
        col5: "Text",
        col6: "Text",
        col7: "Text",
        col8: "Text",
    },
    {
        id: 3,
        col1: "Text",
        col2: "Text",
        col3: "Text",
        col4: "Text",
        col5: "Text",
        col6: "Text",
        col7: "Text",
        col8: "Text",
    },
    {
        id: 4,
        col1: "Text",
        col2: "Text",
        col3: "Text",
        col4: "Text",
        col5: "Text",
        col6: "Text",
        col7: "Text",
        col8: "Text",
    },
    {
        id: 5,
        col1: "Text",
        col2: "Text",
        col3: "Text",
        col4: "Text",
        col5: "Text",
        col6: "Text",
        col7: "Text",
        col8: "Text",
    },
    {
        id: 6,
        col1: "Text",
        col2: "Text",
        col3: "Text",
        col4: "Text",
        col5: "Text",
        col6: "Text",
        col7: "Text",
        col8: "Text",
    },
    {
        id: 7,
        col1: "Text",
        col2: "Text",
        col3: "Text",
        col4: "Text",
        col5: "Text",
        col6: "Text",
        col7: "Text",
        col8: "Text",
    },
    {
        id: 8,
        col1: "Text",
        col2: "Text",
        col3: "Text",
        col4: "Text",
        col5: "Text",
        col6: "Text",
        col7: "Text",
        col8: "Text",
    },
    {
        id: 9,
        col1: "Text",
        col2: "Text",
        col3: "Text",
        col4: "Text",
        col5: "Text",
        col6: "Text",
        col7: "Text",
        col8: "Text",
    },
    {
        id: 10,
        col1: "Text",
        col2: "Text",
        col3: "Text",
        col4: "Text",
        col5: "Text",
        col6: "Text",
        col7: "Text",
        col8: "Text",
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
                <Sidebar
                    onClose={() => setSidebarOpen(false)}
                    activeMenu="워크로드"
                />
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <Header
                    title="워크로드"
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
                <main className="flex-1 overflow-auto px-6 lg:px-12 pt-6 pb-24">
                    <div className="flex flex-col gap-6 max-w-[1200px]">
                        {/* 요약 카드 */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* 총 작업시간 */}
                            <div className="bg-white border border-gray-200 rounded-2xl p-6">
                                <div className="flex items-center gap-2 text-gray-500 mb-2">
                                    <IconWork />
                                    <span className="text-sm">총 작업시간</span>
                                </div>
                                <p className="text-[32px] font-bold text-gray-900">
                                    {user.totalWork}
                                </p>
                            </div>

                            {/* 이동시간 */}
                            <div className="bg-white border border-gray-200 rounded-2xl p-6">
                                <div className="flex items-center gap-2 text-gray-500 mb-2">
                                    <IconDriveEta />
                                    <span className="text-sm">이동시간</span>
                                </div>
                                <p className="text-[32px] font-bold text-gray-900">
                                    {user.totalTravel}
                                </p>
                            </div>

                            {/* 대기시간 */}
                            <div className="bg-white border border-gray-200 rounded-2xl p-6">
                                <div className="flex items-center gap-2 text-gray-500 mb-2">
                                    <IconSchedule />
                                    <span className="text-sm">대기시간</span>
                                </div>
                                <p className="text-[32px] font-bold text-gray-900">
                                    {user.totalWait}
                                </p>
                            </div>
                        </div>

                        {/* 조회 기간 */}
                        <div className="flex flex-wrap items-center gap-5">
                            <h2 className="text-[28px] font-bold text-gray-700 tracking-tight">
                                조회 기간
                            </h2>
                            <div className="flex gap-2">
                                {/* 년도 선택 */}
                                <div className="relative">
                                    <button className="flex items-center gap-1 px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-800 font-semibold">
                                        {selectedYear}
                                        <IconChevronDown />
                                    </button>
                                </div>
                                {/* 월 선택 */}
                                <div className="relative">
                                    <button className="flex items-center gap-1 px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-800 font-semibold">
                                        {selectedMonth}
                                        <IconChevronDown />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* 날짜별 세부 분석 테이블 */}
                        <div className="bg-white border border-gray-200 rounded-2xl p-7">
                            <h2 className="text-[22px] font-semibold text-gray-700 tracking-tight mb-6">
                                날짜별 세부 분석
                            </h2>

                            <Table
                                columns={[
                                    { key: "col1", label: "제목" },
                                    { key: "col2", label: "제목" },
                                    { key: "col3", label: "제목" },
                                    { key: "col4", label: "제목" },
                                    { key: "col5", label: "제목" },
                                    { key: "col6", label: "제목" },
                                    { key: "col7", label: "제목" },
                                    { key: "col8", label: "제목" },
                                ]}
                                data={detailTableData}
                                rowKey="id"
                            />

                            {/* 페이지네이션 */}
                            <div className="flex items-center justify-center gap-1 mt-4">
                                <button
                                    onClick={() =>
                                        setCurrentPage(
                                            Math.max(1, currentPage - 1)
                                        )
                                    }
                                    className="w-[30px] h-[30px] flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500"
                                >
                                    <IconChevronLeft />
                                </button>
                                {[1, 2, 3].map((page) => (
                                    <button
                                        key={page}
                                        onClick={() => setCurrentPage(page)}
                                        className={`w-[30px] h-[30px] flex items-center justify-center rounded-full text-sm font-medium transition-colors ${
                                            currentPage === page
                                                ? "bg-gray-100 text-gray-900"
                                                : "text-gray-500 hover:bg-gray-50"
                                        }`}
                                    >
                                        {page}
                                    </button>
                                ))}
                                <button
                                    onClick={() =>
                                        setCurrentPage(
                                            Math.min(
                                                totalPages,
                                                currentPage + 1
                                            )
                                        )
                                    }
                                    className="w-[30px] h-[30px] flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500"
                                >
                                    <IconChevronRight />
                                </button>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
