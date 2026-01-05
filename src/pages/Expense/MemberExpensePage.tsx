import { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/common/Header";
import Table, { TableColumn } from "../../components/common/Table";
import ExpenseFilterBar from "../../components/common/ExpenseFilterBar";

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
        name: "MK 강민지",
        initials: "MK",
        mileage: 150000,
        distance: 600,
        cardExpense: 60000,
        total: 210000,
        count: 6,
    },
    {
        id: 3,
        name: "MK 강민지",
        initials: "MK",
        mileage: 150000,
        distance: 600,
        cardExpense: 60000,
        total: 210000,
        count: 6,
    },
    {
        id: 4,
        name: "MK 강민지",
        initials: "MK",
        mileage: 150000,
        distance: 600,
        cardExpense: 60000,
        total: 210000,
        count: 6,
    },
    {
        id: 5,
        name: "MK 강민지",
        initials: "MK",
        mileage: 150000,
        distance: 600,
        cardExpense: 60000,
        total: 210000,
        count: 6,
    },
    {
        id: 6,
        name: "MK 강민지",
        initials: "MK",
        mileage: 150000,
        distance: 600,
        cardExpense: 60000,
        total: 210000,
        count: 6,
    },
    {
        id: 7,
        name: "MK 강민지",
        initials: "MK",
        mileage: 150000,
        distance: 600,
        cardExpense: 60000,
        total: 210000,
        count: 6,
    },
    {
        id: 8,
        name: "MK 강민지",
        initials: "MK",
        mileage: 150000,
        distance: 600,
        cardExpense: 60000,
        total: 210000,
        count: 6,
    },
    {
        id: 9,
        name: "MK 강민지",
        initials: "MK",
        mileage: 150000,
        distance: 600,
        cardExpense: 60000,
        total: 210000,
        count: 6,
    },
    {
        id: 10,
        name: "MK 강민지",
        initials: "MK",
        mileage: 150000,
        distance: 600,
        cardExpense: 60000,
        total: 210000,
        count: 6,
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
};

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

    // 페이지네이션 계산
    const totalPages = Math.ceil(MOCK_DATA.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentData = MOCK_DATA.slice(startIndex, endIndex);

    // 금액 포맷팅
    const formatCurrency = (amount: number) => {
        return amount.toLocaleString("ko-KR") + "원";
    };

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
            w-[239px] h-screen shrink-0
            transform transition-transform duration-300 ease-in-out
            ${
                sidebarOpen
                    ? "translate-x-0"
                    : "-translate-x-full lg:translate-x-0"
            }
          `}
            >
                <Sidebar onClose={() => setSidebarOpen(false)} />
            </div>

            {/* ✅ Main Content */}
            <div className="flex-1 flex flex-col h-screen overflow-hidden w-full">
                <Header
                    title="구성원 지출 관리"
                    onMenuClick={() => setSidebarOpen(true)}
                />

                <div className="flex-1 overflow-y-auto mx-9 px-4 lg:px-12 py-6">
                    <div className="flex flex-col gap-4">
                        <ExpenseFilterBar
                            year={year}
                            month={month}
                            user={user}
                            onYearChange={setYear}
                            onMonthChange={setMonth}
                            onUserChange={setUser}
                        />

                        {/* 직원별 집계 섹션 */}
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

                                    const selectedEmployee = MOCK_DATA.find(
                                        (emp) => emp.id === selectedEmployeeId
                                    );
                                    if (!selectedEmployee) return null;

                                    const mileageDetails =
                                        MOCK_MILEAGE_DETAILS[
                                            selectedEmployeeId
                                        ] || [];
                                    const cardDetails =
                                        MOCK_CARD_DETAILS[selectedEmployeeId] ||
                                        [];

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
                                                        {displayName}님의 청구서
                                                    </h2>
                                                    <p className="text-sm text-gray-500 mt-1">
                                                        {year} {month}
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        alert("PDF 다운로드");
                                                    }}
                                                    className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 transition-colors"
                                                >
                                                    PDF 다운로드
                                                </button>
                                            </div>

                                            {/* 탭 */}
                                            <div className="flex gap-1 border-b border-gray-200 mb-6">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setActiveTab("mileage");
                                                    }}
                                                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                                                        activeTab === "mileage"
                                                            ? "text-gray-900 border-b-2 border-gray-900"
                                                            : "text-gray-500 hover:text-gray-700"
                                                    }`}
                                                >
                                                    마일리지 내역
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setActiveTab("card");
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
                                                <div className="overflow-auto border border-gray-200 rounded-xl">
                                                    <table className="min-w-full text-sm text-gray-800">
                                                        <thead className="bg-gray-50 border-b border-gray-200">
                                                            <tr>
                                                                <th className="px-4 py-3 font-semibold text-gray-600 text-left">
                                                                    날짜
                                                                </th>
                                                                <th className="px-4 py-3 font-semibold text-gray-600 text-left">
                                                                    경로
                                                                </th>
                                                                <th className="px-4 py-3 font-semibold text-gray-600 text-left">
                                                                    거리
                                                                </th>
                                                                <th className="px-4 py-3 font-semibold text-gray-600 text-left">
                                                                    금액
                                                                </th>
                                                                <th className="px-4 py-3 font-semibold text-gray-600 text-left">
                                                                    상세 내용
                                                                </th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {mileageDetails.length >
                                                            0 ? (
                                                                mileageDetails.map(
                                                                    (
                                                                        detail
                                                                    ) => (
                                                                        <tr
                                                                            key={
                                                                                detail.id
                                                                            }
                                                                            className="border-b border-gray-100"
                                                                        >
                                                                            <td className="px-4 py-3 text-gray-900">
                                                                                {
                                                                                    detail.date
                                                                                }
                                                                            </td>
                                                                            <td className="px-4 py-3 text-gray-900">
                                                                                {
                                                                                    detail.route
                                                                                }
                                                                            </td>
                                                                            <td className="px-4 py-3 text-gray-900">
                                                                                {
                                                                                    detail.distance
                                                                                }
                                                                                km
                                                                            </td>
                                                                            <td className="px-4 py-3 text-gray-900">
                                                                                {formatCurrency(
                                                                                    detail.amount
                                                                                )}
                                                                            </td>
                                                                            <td className="px-4 py-3 text-gray-900">
                                                                                {
                                                                                    detail.details
                                                                                }
                                                                            </td>
                                                                        </tr>
                                                                    )
                                                                )
                                                            ) : (
                                                                <tr>
                                                                    <td
                                                                        colSpan={
                                                                            5
                                                                        }
                                                                        className="px-4 py-10 text-center text-gray-500"
                                                                    >
                                                                        마일리지
                                                                        내역이
                                                                        없습니다.
                                                                    </td>
                                                                </tr>
                                                            )}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}

                                            {/* 카드 지출 내역 테이블 */}
                                            {activeTab === "card" && (
                                                <div className="overflow-auto border border-gray-200 rounded-xl">
                                                    <table className="min-w-full text-sm text-gray-800">
                                                        <thead className="bg-gray-50 border-b border-gray-200">
                                                            <tr>
                                                                <th className="px-4 py-3 font-semibold text-gray-600 text-left">
                                                                    날짜
                                                                </th>
                                                                <th className="px-4 py-3 font-semibold text-gray-600 text-left">
                                                                    가맹점
                                                                </th>
                                                                <th className="px-4 py-3 font-semibold text-gray-600 text-left">
                                                                    카테고리
                                                                </th>
                                                                <th className="px-4 py-3 font-semibold text-gray-600 text-left">
                                                                    금액
                                                                </th>
                                                                <th className="px-4 py-3 font-semibold text-gray-600 text-left">
                                                                    상세 내용
                                                                </th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {cardDetails.length >
                                                            0 ? (
                                                                cardDetails.map(
                                                                    (
                                                                        detail
                                                                    ) => (
                                                                        <tr
                                                                            key={
                                                                                detail.id
                                                                            }
                                                                            className="border-b border-gray-100"
                                                                        >
                                                                            <td className="px-4 py-3 text-gray-900">
                                                                                {
                                                                                    detail.date
                                                                                }
                                                                            </td>
                                                                            <td className="px-4 py-3 text-gray-900">
                                                                                {
                                                                                    detail.merchant
                                                                                }
                                                                            </td>
                                                                            <td className="px-4 py-3 text-gray-900">
                                                                                {
                                                                                    detail.category
                                                                                }
                                                                            </td>
                                                                            <td className="px-4 py-3 text-gray-900">
                                                                                {formatCurrency(
                                                                                    detail.amount
                                                                                )}
                                                                            </td>
                                                                            <td className="px-4 py-3 text-gray-900">
                                                                                {
                                                                                    detail.details
                                                                                }
                                                                            </td>
                                                                        </tr>
                                                                    )
                                                                )
                                                            ) : (
                                                                <tr>
                                                                    <td
                                                                        colSpan={
                                                                            5
                                                                        }
                                                                        className="px-4 py-10 text-center text-gray-500"
                                                                    >
                                                                        카드
                                                                        지출
                                                                        내역이
                                                                        없습니다.
                                                                    </td>
                                                                </tr>
                                                            )}
                                                        </tbody>
                                                    </table>
                                                </div>
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
                                            onClick={() => setCurrentPage(page)}
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
                    </div>
                </div>
            </div>
        </div>
    );
}
