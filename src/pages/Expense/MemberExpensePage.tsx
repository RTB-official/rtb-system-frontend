import { useState, useEffect, useMemo } from "react";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/common/Header";
import Table, { TableColumn } from "../../components/common/Table";
import ExpenseFilterBar from "../../components/common/ExpenseFilterBar";
import Button from "../../components/common/Button";
import {
    getAllUsersExpenseSummary,
    getUserMileageDetails,
    getUserCardExpenseDetails,
    type EmployeeExpenseSummary,
    type EmployeeMileageDetail,
    type EmployeeCardExpenseDetail,
} from "../../lib/personalExpenseApi";
import { TableSkeleton } from "./components/TableSkeleton";
import { DetailSkeleton } from "./components/DetailSkeleton";
import EmployeeDetailView from "./components/EmployeeDetailView";
import BaseModal from "../../components/ui/BaseModal";

export default function MemberExpensePage() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const currentDate = new Date();
    const [year, setYear] = useState(`${currentDate.getFullYear()}년`);
    const [month, setMonth] = useState(`${currentDate.getMonth() + 1}월`);
    const [user, setUser] = useState("전체");
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(
        null
    );
    const [activeTab, setActiveTab] = useState<"mileage" | "card">("mileage");
    const [expandedRowKeys, setExpandedRowKeys] = useState<(string | number)[]>(
        []
    );
    const [expandedRowDetails, setExpandedRowDetails] = useState<
        Map<
            string,
            {
                mileage: EmployeeMileageDetail[];
                card: EmployeeCardExpenseDetail[];
            }
        >
    >(new Map());
    const [expandedRowActiveTab, setExpandedRowActiveTab] = useState<
        Map<string, "mileage" | "card">
    >(new Map());
    const itemsPerPage = 10;

    const [loading, setLoading] = useState(false);
    const [expenseSummary, setExpenseSummary] = useState<
        EmployeeExpenseSummary[]
    >([]);
    const [mileageDetails, setMileageDetails] = useState<
        EmployeeMileageDetail[]
    >([]);
    const [cardDetails, setCardDetails] = useState<EmployeeCardExpenseDetail[]>(
        []
    );
    const [selectedReceipt, setSelectedReceipt] = useState<string | null>(null);

    // ✅ 사이드바 열려있을 때 모바일에서 body 스크롤 잠금
    useEffect(() => {
        document.body.style.overflow = sidebarOpen ? "hidden" : "";
        return () => {
            document.body.style.overflow = "";
        };
    }, [sidebarOpen]);

    // 데이터 로드
    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                const yearNum = parseInt(year.replace("년", ""));
                const monthNum = parseInt(month.replace("월", "")) - 1;

                const filter: { year: number; month: number; userId?: string } =
                    {
                        year: yearNum,
                        month: monthNum,
                    };

                if (user !== "전체") {
                    // 선택한 사용자 찾기
                    const selectedUser = expenseSummary.find((emp) => {
                  const nameWithoutInitials = emp.name.replace(
                      /^[A-Z]{2,3} /,
                      ""
                  );
                        return (
                            nameWithoutInitials === user || emp.name === user
                        );
                    });
                    if (selectedUser) {
                        filter.userId = selectedUser.id;
                    }
                }

                const summary = await getAllUsersExpenseSummary(filter);
                setExpenseSummary(summary);
            } catch (error) {
                console.error("데이터 로드 실패:", error);
                alert("데이터를 불러오는데 실패했습니다.");
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [year, month]); // user 제외 - user 필터는 클라이언트에서 처리

    // 선택한 사용자의 상세 내역 로드
    useEffect(() => {
        if (!selectedEmployeeId) {
            setMileageDetails([]);
            setCardDetails([]);
            return;
        }

        const loadDetails = async () => {
            try {
                const yearNum = parseInt(year.replace("년", ""));
                const monthNum = parseInt(month.replace("월", "")) - 1;

                const [mileageData, cardData] = await Promise.all([
                    getUserMileageDetails(selectedEmployeeId, {
                        year: yearNum,
                        month: monthNum,
                    }),
                    getUserCardExpenseDetails(selectedEmployeeId, {
                        year: yearNum,
                        month: monthNum,
                    }),
                ]);

                setMileageDetails(mileageData);
                setCardDetails(cardData);
            } catch (error) {
                console.error("상세 내역 로드 실패:", error);
                alert("상세 내역을 불러오는데 실패했습니다.");
            }
        };

        loadDetails();
    }, [selectedEmployeeId, year, month]);

    // 사용자 필터링
    const filteredData = useMemo(() => {
        if (user === "전체") {
            return expenseSummary;
        }
        return expenseSummary.filter((emp) => {
            const nameWithoutInitials = emp.name.replace(/^[A-Z]{2,3} /, "");
                  return nameWithoutInitials === user || emp.name === user;
              });
    }, [expenseSummary, user]);

    // 페이지네이션 계산
    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentData = filteredData.slice(startIndex, endIndex);

    // 사용자 옵션 생성 (중복 제거)
    const userOptions = useMemo(() => {
        return [
        { value: "전체", label: "전체" },
        ...Array.from(
            new Set(
                    expenseSummary.map((emp) => {
                    const nameWithoutInitials = emp.name.replace(
                        /^[A-Z]{2,3} /,
                        ""
                    );
                    return nameWithoutInitials;
                })
            )
        ).map((name) => ({ value: name, label: name })),
    ];
    }, [expenseSummary]);

    // 금액 포맷팅
    const formatCurrency = (amount: number) => {
        return amount.toLocaleString("ko-KR") + "원";
    };

    // 마일리지 내역 테이블 컬럼
    const mileageColumns: TableColumn<EmployeeMileageDetail>[] = [
        {
            key: "date",
            label: "날짜",
        },
        {
            key: "route",
            label: "경로",
        },
        {
            key: "distance",
            label: "거리",
            render: (value) => `${value}km`,
        },
        {
            key: "amount",
            label: "금액",
            render: (value) => formatCurrency(value),
        },
        {
            key: "details",
            label: "상세 내용",
        },
    ];

    // 카드 지출 내역 테이블 컬럼
    const cardColumns: TableColumn<EmployeeCardExpenseDetail>[] = [
        {
            key: "date",
            label: "날짜",
        },
        {
            key: "category",
            label: "카테고리",
        },
        {
            key: "amount",
            label: "금액",
            render: (value) => formatCurrency(value),
        },
        {
            key: "details",
            label: "상세 내용",
        },
        {
            key: "receipt_path",
            label: "영수증",
            render: (value, row) => {
                if (row.receipt_path) {
                    return (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setSelectedReceipt(row.receipt_path || null);
                            }}
                            className="text-blue-600 underline cursor-pointer hover:text-blue-800"
                        >
                            영수증보기
                        </button>
                    );
                }
                return <span className="text-gray-400">-</span>;
            },
        },
    ];

    // 드롭다운 행의 상세 데이터 로드
    const loadExpandedRowDetails = async (rowId: string) => {
        try {
            const yearNum = parseInt(year.replace("년", ""));
            const monthNum = parseInt(month.replace("월", "")) - 1;

            const [mileageData, cardData] = await Promise.all([
                getUserMileageDetails(rowId, {
                    year: yearNum,
                    month: monthNum,
                }),
                getUserCardExpenseDetails(rowId, {
                    year: yearNum,
                    month: monthNum,
                }),
            ]);

            setExpandedRowDetails((prev) => {
                const newMap = new Map(prev);
                newMap.set(rowId, { mileage: mileageData, card: cardData });
                return newMap;
            });

            setExpandedRowActiveTab((prev) => {
                const newMap = new Map(prev);
                if (!newMap.has(rowId)) {
                    newMap.set(rowId, "mileage");
                }
                return newMap;
            });
        } catch (error) {
            console.error("드롭다운 상세 내역 로드 실패:", error);
        }
    };

    // 행 확장/축소 토글
    const toggleRowExpand = (rowId: string) => {
        setExpandedRowKeys((prev) => {
            if (prev.includes(rowId)) {
                return prev.filter((id) => id !== rowId);
            } else {
                loadExpandedRowDetails(rowId);
                return [...prev, rowId];
            }
        });
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
                    <span
                        className="text-gray-900 cursor-pointer hover:text-blue-600 hover:underline"
                        onClick={(e) => {
                            e.stopPropagation();
                            setSelectedEmployeeId(row.id);
                            setUser(row.name.replace(/^[A-Z]{2,3} /, ""));
                            setActiveTab("mileage");
                        }}
                    >
                        {row.name}
                    </span>
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

    // 선택한 사용자 정보
    const selectedEmployee = useMemo(() => {
        if (!selectedEmployeeId) return null;
        return expenseSummary.find((emp) => emp.id === selectedEmployeeId);
    }, [expenseSummary, selectedEmployeeId]);

    return (
        <div className="flex h-screen bg-white overflow-hidden">
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

                <div className="flex-1 overflow-y-auto px-9 py-6">
                    <div className="flex flex-col gap-4">
                        <ExpenseFilterBar
                            year={year}
                            month={month}
                            user={user}
                            onYearChange={setYear}
                            onMonthChange={setMonth}
                            onUserChange={(selectedUser) => {
                                setUser(selectedUser);
                                setCurrentPage(1); // 사용자 변경 시 첫 페이지로
                                // 사용자 선택 시 해당 사용자 ID 찾기
                                if (selectedUser !== "전체") {
                                    const selectedEmp = expenseSummary.find(
                                        (emp) => {
                                            const nameWithoutInitials =
                                                emp.name.replace(
                                                    /^[A-Z]{2,3} /,
                                                    ""
                                                );
                                            return (
                                                nameWithoutInitials ===
                                                    selectedUser ||
                                                emp.name === selectedUser
                                            );
                                        }
                                    );
                                    if (selectedEmp) {
                                        setSelectedEmployeeId(selectedEmp.id);
                                        setActiveTab("mileage");
                                    }
                                } else {
                                    setSelectedEmployeeId(null);
                                }
                            }}
                            userOptions={userOptions}
                        />

                        {/* 사용자 한 명 선택 시 상세 내역 표시 */}
                        {user !== "전체" &&
                        selectedEmployeeId &&
                        selectedEmployee ? (
                            loading &&
                            mileageDetails.length === 0 &&
                            cardDetails.length === 0 ? (
                                <div className="bg-white border border-gray-200 rounded-2xl p-4 lg:p-6">
                                    <DetailSkeleton />
                                </div>
                            ) : (
                                <EmployeeDetailView
                                    employeeName={selectedEmployee.name.replace(
                                        /^[A-Z]{2,3} /,
                                        ""
                                    )}
                                    year={year}
                                    month={month}
                                    mileageDetails={mileageDetails}
                                    cardDetails={cardDetails}
                                    activeTab={activeTab}
                                    onTabChange={setActiveTab}
                                    mileageColumns={mileageColumns}
                                    cardColumns={cardColumns}
                                />
                            )
                        ) : loading && expenseSummary.length === 0 ? (
                            <div className="bg-white border border-gray-200 rounded-2xl p-4 lg:p-6">
                                <div className="animate-pulse space-y-6">
                                    <div className="h-7 bg-gray-100 rounded w-40 mb-2"></div>
                                    <div className="h-5 bg-gray-100 rounded w-80 mb-8"></div>
                                    <TableSkeleton rows={5} />
                                </div>
                                    </div>
                        ) : (
                            /* 전체 선택 시 직원별 집계 테이블 표시 */
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
                                        toggleRowExpand(row.id);
                                    }}
                                    expandableRowRender={(row) => {
                                        const details = expandedRowDetails.get(
                                            row.id
                                        );
                                        const rowTab =
                                            expandedRowActiveTab.get(row.id) ||
                                            "mileage";

                                        if (!details) {
                                            return (
                                                <div className="p-6">
                                                    <TableSkeleton rows={3} />
                                                </div>
                                            );
                                        }

                                        return (
                                            <EmployeeDetailView
                                                employeeName={row.name.replace(
                                                    /^[A-Z]{2,3} /,
                                                    ""
                                                )}
                                                year={year}
                                                month={month}
                                                mileageDetails={details.mileage}
                                                cardDetails={details.card}
                                                activeTab={rowTab}
                                                onTabChange={(tab) => {
                                                    setExpandedRowActiveTab(
                                                        (prev) => {
                                                            const newMap =
                                                                new Map(prev);
                                                            newMap.set(
                                                                row.id,
                                                                tab
                                                            );
                                                            return newMap;
                                                        }
                                                    );
                                                }}
                                                mileageColumns={mileageColumns}
                                                cardColumns={cardColumns}
                                                variant="dropdown"
                                            />
                                        );
                                    }}
                                    expandedRowKeys={expandedRowKeys}
                                    emptyText="데이터가 없습니다."
                                    className="border-gray-200"
                                />

                                {/* 페이지네이션 */}
                                {totalPages > 1 && (
                                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                                        <div className="text-sm text-gray-500">
                                            총 {filteredData.length}명 중{" "}
                                            {startIndex + 1}-
                                            {Math.min(
                                                endIndex,
                                                filteredData.length
                                            )}
                                            명 표시
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                        onClick={() =>
                                                    setCurrentPage((p) =>
                                                        Math.max(1, p - 1)
                                            )
                                        }
                                        disabled={currentPage === 1}
                                    >
                                                이전
                                            </Button>
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
                                                        className={`px-3 py-1 text-sm rounded ${
                                                    currentPage === page
                                                                ? "bg-gray-900 text-white"
                                                                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                                }`}
                                            >
                                                {page}
                                            </button>
                                        ))}
                                    </div>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                        onClick={() =>
                                                    setCurrentPage((p) =>
                                                        Math.min(
                                                            totalPages,
                                                            p + 1
                                                        )
                                                    )
                                                }
                                                disabled={
                                                    currentPage === totalPages
                                                }
                                            >
                                                다음
                                            </Button>
                                        </div>
                                </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* 영수증 모달 */}
            {selectedReceipt && (
                <BaseModal
                    isOpen={!!selectedReceipt}
                    onClose={() => setSelectedReceipt(null)}
                    title="영수증 원본"
                    maxWidth="max-w-[90vw]"
                >
                    <div className="flex justify-center bg-gray-50 rounded-xl overflow-hidden mb-2">
                        <img
                            src={selectedReceipt}
                            alt="receipt full"
                            className="max-w-full h-auto max-h-[70vh] object-contain"
                        />
                    </div>
                </BaseModal>
            )}
        </div>
    );
}
