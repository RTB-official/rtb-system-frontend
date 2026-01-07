import { useState } from "react";
import { Link } from "react-router-dom";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from "recharts";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/common/Header";
import Table from "../../components/common/Table";
import YearMonthSelector from "../../components/common/YearMonthSelector";

// 샘플 차트 데이터
const chartData = [
    { name: "온권태", 작업: 69, 이동: 21.5, 대기: 14.5 },
    { name: "홍길동", 작업: 72, 이동: 18, 대기: 12 },
    { name: "김철수", 작업: 65, 이동: 25, 대기: 10 },
    { name: "이영희", 작업: 80, 이동: 15, 대기: 8 },
    { name: "박민수", 작업: 55, 이동: 30, 대기: 15 },
    { name: "정수진", 작업: 75, 이동: 20, 대기: 5 },
    { name: "최동욱", 작업: 60, 이동: 22, 대기: 18 },
    { name: "강미경", 작업: 70, 이동: 19, 대기: 11 },
    { name: "윤서준", 작업: 68, 이동: 24, 대기: 8 },
    { name: "임지현", 작업: 77, 이동: 16, 대기: 7 },
    { name: "한상우", 작업: 62, 이동: 28, 대기: 10 },
    { name: "오나영", 작업: 73, 이동: 17, 대기: 10 },
    { name: "신민호", 작업: 58, 이동: 32, 대기: 10 },
    { name: "조은비", 작업: 82, 이동: 12, 대기: 6 },
    { name: "권태희", 작업: 67, 이동: 23, 대기: 10 },
    { name: "문준영", 작업: 71, 이동: 20, 대기: 9 },
    { name: "배수현", 작업: 64, 이동: 26, 대기: 10 },
    { name: "송지은", 작업: 78, 이동: 14, 대기: 8 },
];

// 샘플 테이블 데이터
const tableData = [
    {
        id: 1,
        name: "홍길동",
        work: "93시간",
        travel: "21시간 30분",
        wait: "0시간",
        days: "11일",
    },
    {
        id: 2,
        name: "홍길동",
        work: "93시간",
        travel: "21시간 30분",
        wait: "0시간",
        days: "11일",
    },
    {
        id: 3,
        name: "홍길동",
        work: "93시간",
        travel: "21시간 30분",
        wait: "0시간",
        days: "11일",
    },
    {
        id: 4,
        name: "홍길동",
        work: "93시간",
        travel: "21시간 30분",
        wait: "0시간",
        days: "11일",
    },
    {
        id: 5,
        name: "홍길동",
        work: "93시간",
        travel: "21시간 30분",
        wait: "0시간",
        days: "11일",
    },
    {
        id: 6,
        name: "홍길동",
        work: "93시간",
        travel: "21시간 30분",
        wait: "0시간",
        days: "11일",
    },
    {
        id: 7,
        name: "홍길동",
        work: "93시간",
        travel: "21시간 30분",
        wait: "0시간",
        days: "11일",
    },
    {
        id: 8,
        name: "홍길동",
        work: "93시간",
        travel: "21시간 30분",
        wait: "0시간",
        days: "11일",
    },
    {
        id: 9,
        name: "홍길동",
        work: "93시간",
        travel: "21시간 30분",
        wait: "0시간",
        days: "11일",
    },
    {
        id: 10,
        name: "홍길동",
        work: "93시간",
        travel: "21시간 30분",
        wait: "0시간",
        days: "11일",
    },
];

// 커스텀 툴팁
const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-lg">
                <p className="font-semibold text-sm text-gray-900 mb-2">
                    {label}
                </p>
                <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-1.5">
                        <div className="w-3.5 h-3.5 rounded bg-[#51a2ff]" />
                        <span className="text-sm text-gray-600">
                            작업 {payload[0]?.value}시간
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-3.5 h-3.5 rounded bg-[#fd9a00]" />
                        <span className="text-sm text-gray-600">
                            이동 {payload[1]?.value}시간
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-3.5 h-3.5 rounded bg-[#d1d5dc]" />
                        <span className="text-sm text-gray-600">
                            대기 {payload[2]?.value}시간
                        </span>
                    </div>
                </div>
            </div>
        );
    }
    return null;
};

export default function WorkloadPage() {
    const [selectedYear, setSelectedYear] = useState("2025년");
    const [selectedMonth, setSelectedMonth] = useState("11월");
    const [currentPage, setCurrentPage] = useState(1);
    const [sidebarOpen, setSidebarOpen] = useState(false);

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
                    title="워크로드"
                    onMenuClick={() => setSidebarOpen(true)}
                />

                {/* Content */}
                <main className="flex-1 overflow-auto pt-9 pb-24 px-9">
                    <div className="flex flex-col gap-6 w-full">
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

                        {/* 인원별 작업시간 차트 */}
                        <div className="bg-white border border-gray-200 rounded-2xl p-7">
                            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                                <h2 className="text-[22px] font-semibold text-gray-700 tracking-tight">
                                    인원별 작업시간
                                </h2>
                                <div className="flex items-center gap-5">
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-4 h-4 rounded bg-[#51a2ff]" />
                                        <span className="text-[13px] text-gray-500">
                                            작업
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-4 h-4 rounded bg-[#fd9a00]" />
                                        <span className="text-[13px] text-gray-500">
                                            이동
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-4 h-4 rounded bg-[#d1d5dc]" />
                                        <span className="text-[13px] text-gray-500">
                                            대기
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="h-[300px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        data={chartData}
                                        margin={{
                                            top: 20,
                                            right: 20,
                                            left: 0,
                                            bottom: 5,
                                        }}
                                    >
                                        <CartesianGrid
                                            strokeDasharray="3 3"
                                            vertical={false}
                                            stroke="#e5e7eb"
                                        />
                                        <XAxis
                                            dataKey="name"
                                            tick={{
                                                fontSize: 12,
                                                fill: "#6a7282",
                                            }}
                                            axisLine={false}
                                            tickLine={false}
                                        />
                                        <YAxis
                                            tick={{
                                                fontSize: 14,
                                                fill: "#99a1af",
                                            }}
                                            axisLine={false}
                                            tickLine={false}
                                            ticks={[0, 35, 70, 105, 140]}
                                        />
                                        <Tooltip
                                            content={<CustomTooltip />}
                                            cursor={{
                                                fill: "rgba(0,0,0,0.05)",
                                            }}
                                        />
                                        <Bar
                                            dataKey="대기"
                                            stackId="a"
                                            fill="#d1d5dc"
                                            radius={[4, 4, 0, 0]}
                                        />
                                        <Bar
                                            dataKey="이동"
                                            stackId="a"
                                            fill="#fd9a00"
                                        />
                                        <Bar
                                            dataKey="작업"
                                            stackId="a"
                                            fill="#51a2ff"
                                            radius={[0, 0, 4, 4]}
                                        />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* 상세 데이터 테이블 */}
                        <div className="bg-white border border-gray-200 rounded-2xl p-7">
                            <h2 className="text-[22px] font-semibold text-gray-700 tracking-tight mb-6">
                                상세 데이터
                            </h2>

                            <Table
                                columns={[
                                    {
                                        key: "name",
                                        label: "이름",
                                        render: (_, row) => (
                                            <Link
                                                to={`/workload/detail/${row.id}`}
                                                className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                                            >
                                                {row.name}
                                            </Link>
                                        ),
                                    },
                                    {
                                        key: "work",
                                        label: "작업",
                                    },
                                    {
                                        key: "travel",
                                        label: "이동",
                                    },
                                    {
                                        key: "wait",
                                        label: "대기",
                                    },
                                    {
                                        key: "days",
                                        label: "일수",
                                    },
                                ]}
                                data={tableData}
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
