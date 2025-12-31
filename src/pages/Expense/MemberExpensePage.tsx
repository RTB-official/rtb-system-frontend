import { useState, useEffect, useMemo } from "react";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/common/Header";
import Table, { TableColumn } from "../../components/common/Table";

interface EmployeeExpenseSummary {
    id: number;
    name: string;
    initials: string;
    mileage: number;
    distance: number;
    cardExpense: number;
    total: number;
    count: number;
}

interface MileageDetail {
    id: number;
    date: string;
    route: string;
    distance: number;
    amount: number;
    details: string;
}

interface CardExpenseDetail {
    id: number;
    date: string;
    merchant: string;
    amount: number;
    category: string;
    details: string;
}

// Mock 데이터: 직원별 집계
const MOCK_DATA: EmployeeExpenseSummary[] = [
    {
        id: 1,
        name: "MK 강민지",
        initials: "MK",
        mileage: 150000,
        distance: 600,
        cardExpense: 60000,
        total: 210000,
        count: 6,
    },
    {
        id: 2,
        name: "HK 홍길동",
        initials: "HK",
        mileage: 120000,
        distance: 500,
        cardExpense: 70000,
        total: 190000,
        count: 4,
    },
    {
        id: 3,
        name: "KC 김철수",
        initials: "KC",
        mileage: 80000,
        distance: 300,
        cardExpense: 30000,
        total: 110000,
        count: 2,
    },
    {
        id: 4,
        name: "LY 이영희",
        initials: "LY",
        mileage: 200000,
        distance: 800,
        cardExpense: 100000,
        total: 300000,
        count: 8,
    },
    {
        id: 5,
        name: "PM 박민수",
        initials: "PM",
        mileage: 90000,
        distance: 350,
        cardExpense: 40000,
        total: 130000,
        count: 3,
    },
    {
        id: 6,
        name: "JS 정수진",
        initials: "JS",
        mileage: 110000,
        distance: 450,
        cardExpense: 55000,
        total: 165000,
        count: 5,
    },
    {
        id: 7,
        name: "CD 최동욱",
        initials: "CD",
        mileage: 130000,
        distance: 550,
        cardExpense: 65000,
        total: 195000,
        count: 7,
    },
    {
        id: 8,
        name: "YS 윤서준",
        initials: "YS",
        mileage: 100000,
        distance: 400,
        cardExpense: 50000,
        total: 150000,
        count: 4,
    },
    {
        id: 9,
        name: "IJ 임지현",
        initials: "IJ",
        mileage: 160000,
        distance: 650,
        cardExpense: 75000,
        total: 235000,
        count: 6,
    },
    {
        id: 10,
        name: "HS 한상우",
        initials: "HS",
        mileage: 140000,
        distance: 580,
        cardExpense: 62000,
        total: 202000,
        count: 5,
    },
];

// Mock 데이터: 마일리지 내역
const MOCK_MILEAGE_DETAILS: Record<number, MileageDetail[]> = {
    1: [
        {
            id: 1,
            date: "12월 29일 (월)",
            route: "공장 → 자택",
            distance: 30,
            amount: 20120,
            details: "통행료 1000원 포함",
        },
        {
            id: 2,
            date: "12월 29일 (월)",
            route: "공장 → 자택",
            distance: 30,
            amount: 20120,
            details: "S oil 레포트작성",
        },
        {
            id: 3,
            date: "12월 29일 (월)",
            route: "공장 → 자택",
            distance: 30,
            amount: 20120,
            details: "SH8218 승선작업통행료포함",
        },
    ],
    2: [
        {
            id: 4,
            date: "12월 28일 (일)",
            route: "집 → 회사",
            distance: 20,
            amount: 15000,
            details: "톨비 포함",
        },
        {
            id: 5,
            date: "12월 28일 (일)",
            route: "회사 → 출장지",
            distance: 50,
            amount: 35000,
            details: "고속도로 통행료 포함",
        },
    ],
    3: [
        {
            id: 6,
            date: "12월 27일 (토)",
            route: "자택 → 공장",
            distance: 25,
            amount: 18000,
            details: "주유 포함",
        },
    ],
    4: [
        {
            id: 7,
            date: "12월 29일 (월)",
            route: "공장 → 현장",
            distance: 45,
            amount: 28000,
            details: "SH8218 승선작업",
        },
        {
            id: 8,
            date: "12월 29일 (월)",
            route: "현장 → 공장",
            distance: 45,
            amount: 28000,
            details: "SH8218 승선작업",
        },
    ],
    5: [
        {
            id: 9,
            date: "12월 28일 (일)",
            route: "집 → 회사",
            distance: 18,
            amount: 12000,
            details: "일반 통행",
        },
        {
            id: 10,
            date: "12월 28일 (일)",
            route: "회사 → 고객사",
            distance: 35,
            amount: 22000,
            details: "고객 미팅",
        },
    ],
    6: [
        {
            id: 11,
            date: "12월 29일 (월)",
            route: "공장 → 자택",
            distance: 32,
            amount: 21000,
            details: "야근 후 귀가",
        },
        {
            id: 12,
            date: "12월 29일 (월)",
            route: "자택 → 공장",
            distance: 32,
            amount: 21000,
            details: "출근",
        },
    ],
    7: [
        {
            id: 13,
            date: "12월 29일 (월)",
            route: "공장 → 자택",
            distance: 28,
            amount: 19000,
            details: "일반 통행",
        },
        {
            id: 14,
            date: "12월 29일 (월)",
            route: "자택 → 공장",
            distance: 28,
            amount: 19000,
            details: "출근",
        },
    ],
    8: [
        {
            id: 15,
            date: "12월 28일 (일)",
            route: "집 → 회사",
            distance: 22,
            amount: 15000,
            details: "주말 근무",
        },
        {
            id: 16,
            date: "12월 28일 (일)",
            route: "회사 → 집",
            distance: 22,
            amount: 15000,
            details: "귀가",
        },
    ],
    9: [
        {
            id: 17,
            date: "12월 29일 (월)",
            route: "공장 → 자택",
            distance: 38,
            amount: 25000,
            details: "SH8218 승선작업",
        },
        {
            id: 18,
            date: "12월 29일 (월)",
            route: "자택 → 공장",
            distance: 38,
            amount: 25000,
            details: "출근",
        },
    ],
    10: [
        {
            id: 19,
            date: "12월 29일 (월)",
            route: "공장 → 자택",
            distance: 35,
            amount: 23000,
            details: "야근 후 귀가",
        },
        {
            id: 20,
            date: "12월 29일 (월)",
            route: "자택 → 공장",
            distance: 35,
            amount: 23000,
            details: "출근",
        },
    ],
};

// Mock 데이터: 카드 지출 내역
const MOCK_CARD_DETAILS: Record<number, CardExpenseDetail[]> = {
    1: [
        {
            id: 1,
            date: "12월 29일 (월)",
            merchant: "GS25",
            amount: 15000,
            category: "식비",
            details: "점심 식사",
        },
        {
            id: 2,
            date: "12월 29일 (월)",
            merchant: "주유소",
            amount: 45000,
            category: "교통비",
            details: "주유",
        },
    ],
    2: [
        {
            id: 3,
            date: "12월 28일 (일)",
            merchant: "스타벅스",
            amount: 5000,
            category: "식비",
            details: "커피",
        },
        {
            id: 4,
            date: "12월 28일 (일)",
            merchant: "맥도날드",
            amount: 8000,
            category: "식비",
            details: "저녁 식사",
        },
    ],
    3: [
        {
            id: 5,
            date: "12월 27일 (토)",
            merchant: "CU",
            amount: 3000,
            category: "식비",
            details: "간식",
        },
    ],
    4: [
        {
            id: 6,
            date: "12월 29일 (월)",
            merchant: "GS25",
            amount: 12000,
            category: "식비",
            details: "점심 식사",
        },
        {
            id: 7,
            date: "12월 29일 (월)",
            merchant: "주유소",
            amount: 50000,
            category: "교통비",
            details: "주유",
        },
    ],
    5: [
        {
            id: 8,
            date: "12월 28일 (일)",
            merchant: "이마트",
            amount: 25000,
            category: "식비",
            details: "식자재 구매",
        },
    ],
    6: [
        {
            id: 9,
            date: "12월 29일 (월)",
            merchant: "GS25",
            amount: 10000,
            category: "식비",
            details: "점심 식사",
        },
        {
            id: 10,
            date: "12월 29일 (월)",
            merchant: "주유소",
            amount: 40000,
            category: "교통비",
            details: "주유",
        },
    ],
    7: [
        {
            id: 11,
            date: "12월 29일 (월)",
            merchant: "스타벅스",
            amount: 6000,
            category: "식비",
            details: "커피",
        },
        {
            id: 12,
            date: "12월 29일 (월)",
            merchant: "맥도날드",
            amount: 9000,
            category: "식비",
            details: "저녁 식사",
        },
    ],
    8: [
        {
            id: 13,
            date: "12월 28일 (일)",
            merchant: "CU",
            amount: 4000,
            category: "식비",
            details: "간식",
        },
        {
            id: 14,
            date: "12월 28일 (일)",
            merchant: "주유소",
            amount: 35000,
            category: "교통비",
            details: "주유",
        },
    ],
    9: [
        {
            id: 15,
            date: "12월 29일 (월)",
            merchant: "GS25",
            amount: 13000,
            category: "식비",
            details: "점심 식사",
        },
        {
            id: 16,
            date: "12월 29일 (월)",
            merchant: "주유소",
            amount: 48000,
            category: "교통비",
            details: "주유",
        },
    ],
    10: [
        {
            id: 17,
            date: "12월 29일 (월)",
            merchant: "스타벅스",
            amount: 5500,
            category: "식비",
            details: "커피",
        },
        {
            id: 18,
            date: "12월 29일 (월)",
            merchant: "GS25",
            amount: 11000,
            category: "식비",
            details: "저녁 식사",
        },
    ],
};

// 저장 아이콘
const IconDownload = () => (
    <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
    >
        <path
            d="M19 12V19H5V12H3V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V12H19ZM13 12.67L15.59 10.09L17 11.5L12 16.5L7 11.5L8.41 10.09L11 12.67V3H13V12.67Z"
            fill="currentColor"
        />
    </svg>
);

export default function MemberExpensePage() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [year, setYear] = useState("2025년");
    const [month, setMonth] = useState("12월");
    const [user, setUser] = useState("전체");
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(
        null
    );
    const [activeTab, setActiveTab] = useState<"mileage" | "card">("mileage");
    const itemsPerPage = 10;

    // ✅ 사이드바 열려있을 때 모바일에서 body 스크롤 잠금
    useEffect(() => {
        document.body.style.overflow = sidebarOpen ? "hidden" : "";
        return () => {
            document.body.style.overflow = "";
        };
    }, [sidebarOpen]);

    // 사용자 목록 추출 (고유한 이름 목록)
    const userList = useMemo(() => {
        const uniqueNames = Array.from(
            new Set(MOCK_DATA.map((item) => item.name))
        );
        return uniqueNames;
    }, []);

    // 사용자별로 그룹화하여 합계 계산 (전체일 때)
    const aggregatedData = useMemo(() => {
        const grouped = MOCK_DATA.reduce((acc, item) => {
            if (!acc[item.name]) {
                acc[item.name] = {
                    ...item,
                    mileage: 0,
                    distance: 0,
                    cardExpense: 0,
                    total: 0,
                    count: 0,
                };
            }
            acc[item.name].mileage += item.mileage;
            acc[item.name].distance += item.distance;
            acc[item.name].cardExpense += item.cardExpense;
            acc[item.name].total += item.total;
            acc[item.name].count += item.count;
            return acc;
        }, {} as Record<string, EmployeeExpenseSummary>);
        return Object.values(grouped);
    }, []);

    // 사용자 필터링된 데이터
    const filteredData = useMemo(() => {
        if (user === "전체") {
            return aggregatedData;
        }
        // 특정 사용자 선택 시 해당 사용자의 모든 데이터를 합산하여 단일 항목으로 반환
        const userItems = MOCK_DATA.filter((item) => item.name === user);
        if (userItems.length === 0) return [];

        const aggregated = userItems.reduce(
            (acc, item) => {
                acc.mileage += item.mileage;
                acc.distance += item.distance;
                acc.cardExpense += item.cardExpense;
                acc.total += item.total;
                acc.count += item.count;
                return acc;
            },
            {
                ...userItems[0],
                id: userItems[0].id, // 첫 번째 항목의 id 사용
                mileage: 0,
                distance: 0,
                cardExpense: 0,
                total: 0,
                count: 0,
            }
        );
        return [aggregated];
    }, [user, aggregatedData]);

    // 페이지네이션 계산
    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentData = filteredData.slice(startIndex, endIndex);

    // 특정 사용자 선택 시 첫 번째 데이터 자동 선택
    useEffect(() => {
        if (user !== "전체" && filteredData.length > 0) {
            setSelectedEmployeeId(filteredData[0].id);
            setActiveTab("mileage");
        } else {
            setSelectedEmployeeId(null);
        }
        setCurrentPage(1);
    }, [user, filteredData]);

    // 금액 포맷팅
    const formatCurrency = (amount: number) => {
        return amount.toLocaleString("ko-KR") + "원";
    };

    // 마일리지 상세 테이블 컬럼 정의
    const mileageDetailColumns: TableColumn<MileageDetail>[] = [
        { key: "date", label: "날짜" },
        { key: "route", label: "경로" },
        {
            key: "distance",
            label: "거리",
            align: "left",
            render: (distance) => `${distance}km`,
        },
        {
            key: "amount",
            label: "금액",
            align: "left",
            render: (amount) => formatCurrency(amount),
        },
        { key: "details", label: "상세 내용" },
    ];

    // 카드 지출 상세 테이블 컬럼 정의 (가맹점 제거, 카테고리를 유형으로 변경)
    const cardDetailColumns: TableColumn<CardExpenseDetail>[] = [
        { key: "date", label: "날짜" },
        { key: "category", label: "유형" },
        {
            key: "amount",
            label: "금액",
            align: "left",
            render: (amount) => formatCurrency(amount),
        },
        { key: "details", label: "상세 내용" },
    ];

    const columns: TableColumn<EmployeeExpenseSummary>[] = [
        {
            key: "name",
            label: "직원 명",
            render: (_, row) => (
                <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-orange-100 text-[11px] text-orange-600 font-semibold">
                        {row.initials}
                    </span>
                    <span className="text-gray-900">{row.name}</span>
                </div>
            ),
        },
        {
            key: "mileage",
            label: "마일리지",
            render: (value) => formatCurrency(value),
        },
        {
            key: "distance",
            label: "거리",
            render: (value) => `${value}km`,
        },
        {
            key: "cardExpense",
            label: "카드지출",
            render: (value) => formatCurrency(value),
        },
        {
            key: "total",
            label: "합계",
            render: (value) => (
                <span className="font-semibold">{formatCurrency(value)}</span>
            ),
        },
        {
            key: "count",
            label: "건수",
            render: (value) => `${value}건`,
        },
    ];

    return (
        <div className="flex h-screen bg-[#f4f5f7] overflow-hidden">
            {/* ✅ Mobile Overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-20 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* ✅ Sidebar - 데스크탑 고정, 모바일 슬라이드 */}
            <div
                className={`
            fixed lg:static inset-y-0 left-0 z-30
            w-[239px] h-screen flex-shrink-0
            transform transition-transform duration-300 ease-in-out
            ${
                sidebarOpen
                    ? "translate-x-0"
                    : "-translate-x-full lg:translate-x-0"
            }
          `}
            >
                <Sidebar
                    onClose={() => setSidebarOpen(false)}
                    activeMenu="지출 관리"
                    activeSubMenu="구성원 지출 관리"
                />
            </div>

            {/* ✅ Main Content */}
            <div className="flex-1 flex flex-col h-screen overflow-hidden w-full">
                <Header
                    title="구성원 지출 관리"
                    onMenuClick={() => setSidebarOpen(true)}
                />

                <div className="flex-1 overflow-y-auto px-4 lg:px-12 py-6">
                    <div className="flex flex-col gap-4">
                        {/* 필터 섹션 */}
                        <div className="bg-white border border-gray-200 rounded-2xl p-4 lg:p-6">
                            <div className="flex flex-wrap items-center gap-3">
                                <span className="text-base font-semibold text-gray-700">
                                    조회 기간
                                </span>
                                <select
                                    value={year}
                                    onChange={(e) => setYear(e.target.value)}
                                    className="rounded-lg border border-gray-200 px-4 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                                >
                                    <option>2025년</option>
                                    <option>2024년</option>
                                    <option>2026년</option>
                                </select>
                                <select
                                    value={month}
                                    onChange={(e) => setMonth(e.target.value)}
                                    className="rounded-lg border border-gray-200 px-4 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                                >
                                    <option>12월</option>
                                    <option>1월</option>
                                    <option>2월</option>
                                    <option>3월</option>
                                    <option>4월</option>
                                    <option>5월</option>
                                    <option>6월</option>
                                    <option>7월</option>
                                    <option>8월</option>
                                    <option>9월</option>
                                    <option>10월</option>
                                    <option>11월</option>
                                </select>
                                <span className="text-base font-semibold text-gray-700 ml-4">
                                    사용자
                                </span>
                                <select
                                    value={user}
                                    onChange={(e) => setUser(e.target.value)}
                                    className="rounded-lg border border-gray-200 px-4 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                                >
                                    <option value="전체">전체</option>
                                    {userList.map((userName) => (
                                        <option key={userName} value={userName}>
                                            {userName.replace(
                                                /^[A-Z]{2,3} /,
                                                ""
                                            )}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* 직원별 집계 섹션 또는 청구서 상세 */}
                        {user === "전체" ? (
                            <div className="bg-white border border-gray-200 rounded-2xl p-4 lg:p-6">
                                <h2 className="text-lg font-semibold text-gray-800 mb-1">
                                    직원별 집계
                                </h2>
                                <p className="text-sm text-gray-500 mb-4">
                                    클릭하여 상세 내역을 확인하세요
                                </p>

                                {/* 테이블 */}
                                <Table
                                    columns={columns}
                                    data={currentData}
                                    rowKey="id"
                                    onRowClick={(row) => {
                                        setSelectedEmployeeId(
                                            selectedEmployeeId === row.id
                                                ? null
                                                : row.id
                                        );
                                        setActiveTab("mileage");
                                    }}
                                    expandedRowKeys={
                                        selectedEmployeeId
                                            ? [selectedEmployeeId]
                                            : []
                                    }
                                    expandableRowRender={(row) => {
                                        if (selectedEmployeeId !== row.id)
                                            return null;

                                        const selectedEmployee =
                                            filteredData.find(
                                                (emp) =>
                                                    emp.id ===
                                                    selectedEmployeeId
                                            );
                                        if (!selectedEmployee) return null;

                                        const mileageDetails =
                                            MOCK_MILEAGE_DETAILS[
                                                selectedEmployeeId
                                            ] || [];
                                        const cardDetails =
                                            MOCK_CARD_DETAILS[
                                                selectedEmployeeId
                                            ] || [];

                                        // 이름에서 "MK " 제거
                                        const displayName =
                                            selectedEmployee.name.replace(
                                                /^[A-Z]{2,3} /,
                                                ""
                                            );

                                        return (
                                            <div className="p-4 lg:p-6">
                                                {/* 헤더 */}
                                                <div className="flex items-center justify-between mb-6">
                                                    <div>
                                                        <h2 className="text-lg font-semibold text-gray-800">
                                                            {displayName}님의
                                                            청구서
                                                        </h2>
                                                        <p className="text-sm text-gray-500 mt-1">
                                                            {year} {month}
                                                        </p>
                                                    </div>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            alert(
                                                                "PDF 다운로드"
                                                            );
                                                        }}
                                                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 transition-colors"
                                                    >
                                                        <IconDownload />
                                                        Pdf 다운로드
                                                    </button>
                                                </div>

                                                {/* 탭 */}
                                                <div className="flex gap-1 border-b border-gray-200 mb-6">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setActiveTab(
                                                                "mileage"
                                                            );
                                                        }}
                                                        className={`px-4 py-2 text-sm font-medium transition-colors ${
                                                            activeTab ===
                                                            "mileage"
                                                                ? "text-gray-900 border-b-2 border-gray-900"
                                                                : "text-gray-500 hover:text-gray-700"
                                                        }`}
                                                    >
                                                        마일리지 내역
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setActiveTab(
                                                                "card"
                                                            );
                                                        }}
                                                        className={`px-4 py-2 text-sm font-medium transition-colors ${
                                                            activeTab === "card"
                                                                ? "text-gray-900 border-b-2 border-gray-900"
                                                                : "text-gray-500 hover:text-gray-700"
                                                        }`}
                                                    >
                                                        카드 지출 내역
                                                    </button>
                                                </div>

                                                {/* 마일리지 내역 테이블 */}
                                                {activeTab === "mileage" && (
                                                    <Table
                                                        columns={
                                                            mileageDetailColumns
                                                        }
                                                        data={mileageDetails}
                                                        emptyText="마일리지 내역이 없습니다."
                                                    />
                                                )}

                                                {/* 카드 지출 내역 테이블 */}
                                                {activeTab === "card" && (
                                                    <Table
                                                        columns={
                                                            cardDetailColumns
                                                        }
                                                        data={cardDetails}
                                                        emptyText="카드 지출 내역이 없습니다."
                                                    />
                                                )}
                                            </div>
                                        );
                                    }}
                                />

                                {/* 페이지네이션 */}
                                <div className="flex items-center justify-center gap-2 mt-4 text-sm text-gray-600">
                                    <button
                                        onClick={() =>
                                            setCurrentPage((prev) =>
                                                Math.max(1, prev - 1)
                                            )
                                        }
                                        disabled={currentPage === 1}
                                        className="px-2 py-1 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        &lt;
                                    </button>
                                    <div className="flex items-center gap-1">
                                        {Array.from(
                                            { length: totalPages },
                                            (_, i) => i + 1
                                        ).map((page) => (
                                            <button
                                                key={page}
                                                onClick={() =>
                                                    setCurrentPage(page)
                                                }
                                                className={`w-8 h-8 flex items-center justify-center rounded-full font-medium ${
                                                    currentPage === page
                                                        ? "bg-gray-100 text-gray-800"
                                                        : "hover:bg-gray-100"
                                                }`}
                                            >
                                                {page}
                                            </button>
                                        ))}
                                    </div>
                                    <button
                                        onClick={() =>
                                            setCurrentPage((prev) =>
                                                Math.min(totalPages, prev + 1)
                                            )
                                        }
                                        disabled={currentPage === totalPages}
                                        className="px-2 py-1 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        &gt;
                                    </button>
                                </div>
                            </div>
                        ) : (
                            /* 특정 사용자 선택 시 청구서 상세 직접 표시 */
                            filteredData.length > 0 && (
                                <div className="bg-white border border-gray-200 rounded-2xl p-4 lg:p-6">
                                    {(() => {
                                        const selectedEmployee =
                                            filteredData[0];
                                        if (!selectedEmployee) return null;

                                        // 특정 사용자의 모든 상세 내역 합치기
                                        const userItemIds = MOCK_DATA.filter(
                                            (item) => item.name === user
                                        ).map((item) => item.id);

                                        const mileageDetails =
                                            userItemIds.reduce((acc, id) => {
                                                const details =
                                                    MOCK_MILEAGE_DETAILS[id] ||
                                                    [];
                                                return [...acc, ...details];
                                            }, [] as MileageDetail[]);

                                        const cardDetails = userItemIds.reduce(
                                            (acc, id) => {
                                                const details =
                                                    MOCK_CARD_DETAILS[id] || [];
                                                return [...acc, ...details];
                                            },
                                            [] as CardExpenseDetail[]
                                        );

                                        // 이름에서 "MK " 제거
                                        const displayName =
                                            selectedEmployee.name.replace(
                                                /^[A-Z]{2,3} /,
                                                ""
                                            );

                                        return (
                                            <>
                                                {/* 헤더 */}
                                                <div className="flex items-center justify-between mb-6">
                                                    <div>
                                                        <h2 className="text-lg font-semibold text-gray-800">
                                                            {displayName}님의
                                                            청구서
                                                        </h2>
                                                        <p className="text-sm text-gray-500 mt-1">
                                                            {year} {month}
                                                        </p>
                                                    </div>
                                                    <button
                                                        onClick={() =>
                                                            alert(
                                                                "PDF 다운로드"
                                                            )
                                                        }
                                                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 transition-colors"
                                                    >
                                                        <IconDownload />
                                                        Pdf 다운로드
                                                    </button>
                                                </div>

                                                {/* 탭 */}
                                                <div className="flex gap-1 border-b border-gray-200 mb-6">
                                                    <button
                                                        onClick={() =>
                                                            setActiveTab(
                                                                "mileage"
                                                            )
                                                        }
                                                        className={`px-4 py-2 text-sm font-medium transition-colors ${
                                                            activeTab ===
                                                            "mileage"
                                                                ? "text-gray-900 border-b-2 border-gray-900"
                                                                : "text-gray-500 hover:text-gray-700"
                                                        }`}
                                                    >
                                                        마일리지 내역
                                                    </button>
                                                    <button
                                                        onClick={() =>
                                                            setActiveTab("card")
                                                        }
                                                        className={`px-4 py-2 text-sm font-medium transition-colors ${
                                                            activeTab === "card"
                                                                ? "text-gray-900 border-b-2 border-gray-900"
                                                                : "text-gray-500 hover:text-gray-700"
                                                        }`}
                                                    >
                                                        카드 지출 내역
                                                    </button>
                                                </div>

                                                {/* 마일리지 내역 테이블 */}
                                                {activeTab === "mileage" && (
                                                    <Table
                                                        columns={
                                                            mileageDetailColumns
                                                        }
                                                        data={mileageDetails}
                                                        emptyText="마일리지 내역이 없습니다."
                                                    />
                                                )}

                                                {/* 카드 지출 내역 테이블 */}
                                                {activeTab === "card" && (
                                                    <Table
                                                        columns={
                                                            cardDetailColumns
                                                        }
                                                        data={cardDetails}
                                                        emptyText="카드 지출 내역이 없습니다."
                                                    />
                                                )}
                                            </>
                                        );
                                    })()}
                                </div>
                            )
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
