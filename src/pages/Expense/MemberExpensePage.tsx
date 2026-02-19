// MemberExpensePage.tsx
import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/common/Header";
import Table, { TableColumn } from "../../components/common/Table";
import ExpenseFilterBar from "../../components/common/ExpenseFilterBar";
import Button from "../../components/common/Button";
import {
    getAllUsersExpenseSummary,
    getUserMileageDetails,
    getUserCardExpenseDetails,
    getPersonalExpenseReceiptUrl,
    type EmployeeExpenseSummary,
    type EmployeeMileageDetail,
    type EmployeeCardExpenseDetail,
} from "../../lib/personalExpenseApi";

import { TableSkeleton } from "./components/TableSkeleton";
import { DetailSkeleton } from "./components/DetailSkeleton";
import EmployeeDetailView from "./components/EmployeeDetailView";
import ExpandableDetailPanel from "../../components/common/ExpandableDetailPanel";
import ImagePreviewModal from "../../components/ui/ImagePreviewModal";
import Avatar from "../../components/common/Avatar";
import { IconChevronRight } from "../../components/icons/Icons";
import { useUser } from "../../hooks/useUser";
import { supabase } from "../../lib/supabase";
import { useToast } from "../../components/ui/ToastProvider";
import useIsMobile from "../../hooks/useIsMobile";

export default function MemberExpensePage() {
    const navigate = useNavigate();
    const { showError } = useToast();
    const isMobile = useIsMobile();
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
    const [employeeProfiles, setEmployeeProfiles] = useState<
        Map<string, { email: string | null; position: string | null }>
    >(() => {
        // ✅ 초기 렌더링 시 localStorage에서 캐시된 프로필 정보 로드 (깜빡임 방지)
        try {
            const cached = localStorage.getItem("employeeProfiles_cache");
            if (cached) {
                const parsed = JSON.parse(cached);
                const profileMap = new Map<
                    string,
                    { email: string | null; position: string | null }
                >();
                Object.entries(parsed).forEach(([name, profile]: [string, any]) => {
                    profileMap.set(name, {
                        email: profile.email || null,
                        position: profile.position || null,
                    });
                });
                return profileMap;
            }
        } catch {
            // 캐시 파싱 실패 시 빈 Map 반환
        }
        return new Map();
    });
    const summaryCacheRef = useRef<Map<string, EmployeeExpenseSummary[]>>(new Map());
    const loadRequestIdRef = useRef(0);

    // ✅ 사이드바 열려있을 때 모바일에서 body 스크롤 잠금
    // 권한 체크: 공사팀(스태프)은 접근 불가
    const { userPermissions } = useUser();
    useEffect(() => {
        // useUser 훅에서 이미 권한 정보를 가져왔으므로 추가 API 호출 불필요
        if (userPermissions.isStaff && !userPermissions.isCEO && !userPermissions.isAdmin) {
            navigate("/report", { replace: true });
        }
    }, [userPermissions, navigate]);

    useEffect(() => {
        document.body.style.overflow = sidebarOpen ? "hidden" : "";
        return () => {
            document.body.style.overflow = "";
        };
    }, [sidebarOpen]);

    // 데이터 로드
    useEffect(() => {
        const loadData = async () => {
            const yearNum = parseInt(year.replace("년", ""));
            const monthNum = parseInt(month.replace("월", "")) - 1;
            const cacheKey = `${yearNum}-${monthNum}`;
            const cached = summaryCacheRef.current.get(cacheKey);

            if (cached && cached.length > 0) {
                setExpenseSummary(cached);
                setLoading(false);
            } else {
                setLoading(true);
            }

            const requestId = ++loadRequestIdRef.current;
            try {
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

                // ✅ 지출 요약 조회
                const summary = await getAllUsersExpenseSummary(filter);
                if (loadRequestIdRef.current !== requestId) return;
                summaryCacheRef.current.set(cacheKey, summary);
                setExpenseSummary(summary);
            } catch (error) {
                console.error("데이터 로드 실패:", error);
                showError("데이터를 불러오는데 실패했습니다.");
            } finally {
                if (loadRequestIdRef.current === requestId) {
                    setLoading(false);
                }
            }
        };

        loadData();
    }, [year, month]); // user 제외 - user 필터는 클라이언트에서 처리

    // 프로필 정보는 요약 로딩 후 백그라운드로 갱신
    useEffect(() => {
        if (expenseSummary.length === 0) return;
        const employeeNames = [...new Set(expenseSummary.map((emp) => emp.name))];
        let cancelled = false;

        const loadProfiles = async () => {
            // ✅ 캐시된 프로필 정보 먼저 확인
            const profileMap = new Map<
                string,
                { email: string | null; position: string | null }
            >();

            try {
                const cached = localStorage.getItem("employeeProfiles_cache");
                if (cached) {
                    const parsed = JSON.parse(cached);
                    employeeNames.forEach((name) => {
                        if (parsed[name]) {
                            profileMap.set(name, parsed[name]);
                        }
                    });
                }
            } catch {
                // 캐시 파싱 실패 시 무시
            }

            const uncachedNames = employeeNames.filter((name) => !profileMap.has(name));
            if (uncachedNames.length > 0) {
                const { data: profiles, error: profilesError } = await supabase
                    .from("profiles")
                    .select("name, email, position")
                    .in("name", uncachedNames);

                if (!profilesError && profiles) {
                    profiles.forEach((profile: any) => {
                        profileMap.set(profile.name, {
                            email: profile.email || null,
                            position: profile.position || null,
                        });
                    });
                }
            }

            if (cancelled) return;
            setEmployeeProfiles(profileMap);

            try {
                const cacheObject: Record<
                    string,
                    { email: string | null; position: string | null }
                > = {};
                profileMap.forEach((profile, name) => {
                    cacheObject[name] = profile;
                });
                localStorage.setItem(
                    "employeeProfiles_cache",
                    JSON.stringify(cacheObject)
                );
            } catch {
                // localStorage 저장 실패 시 무시
            }
        };

        loadProfiles();
        return () => {
            cancelled = true;
        };
    }, [expenseSummary]);

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
                showError("상세 내역을 불러오는데 실패했습니다.");
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
            label: "호선 및 기타사항",
            render: (value) => {
                if (value && value.trim()) {
                    return <span className="text-gray-700">{value}</span>;
                }
                return "";
            },
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
            render: (value) => {
                if (value && value.trim()) {
                    return <span className="text-gray-700">{value}</span>;
                }
                return "";
            },
        },
        {
            key: "receipt_path",
            label: "영수증",
            render: (_value, row) => {
                if (row.receipt_path) {
                    return (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setSelectedReceipt(
                                    row.receipt_path
                                        ? getPersonalExpenseReceiptUrl(row.receipt_path)
                                        : null
                                );
                            }}
                            className="text-blue-500 underline cursor-pointer hover:text-blue-700"
                        >
                            영수증보기
                        </button>
                    );
                }
                return "";
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

    // 모바일: 카드 클릭 시 상세 모달 열기 및 데이터 로드
    const columns: TableColumn<EmployeeExpenseSummary>[] = [
        {
            key: "name",
            label: "직원 명",
            render: (_, row) => {
                const profile = employeeProfiles.get(row.name);
                return (
                    <div className="flex items-center gap-2">
                        <Avatar
                            email={profile?.email || null}
                            size={24}
                            position={profile?.position || null}
                        />
                        <span className="text-gray-900">{row.name}</span>
                    </div>
                );
            },
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
            w-[260px] max-w-[88vw] lg:max-w-none lg:w-[239px] h-screen shrink-0
            transform transition-transform duration-300 ease-in-out
            ${sidebarOpen
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

                <div className="flex-1 overflow-y-auto px-4 md:px-6 lg:px-9 py-4 md:py-6">
                    <div className="flex flex-col gap-4">
                        <ExpenseFilterBar
                            className={isMobile ? "flex flex-nowrap items-center gap-1.5 overflow-x-auto pb-1" : ""}
                            titleClassName={isMobile ? "text-sm shrink-0" : ""}
                            compactLabels={isMobile}
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
                                <div className={isMobile ? "bg-white p-0" : "bg-white border border-gray-200 rounded-2xl p-4 lg:p-6"}>
                                    {isMobile ? (
                                        <div className="flex flex-col items-center justify-center py-16 gap-4">
                                            <div className="w-10 h-10 border-2 border-gray-200 border-t-gray-800 rounded-full animate-spin" />
                                            <p className="text-sm text-gray-500">로딩 중...</p>
                                        </div>
                                    ) : (
                                        <DetailSkeleton />
                                    )}
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
                            <div className={isMobile ? "bg-white p-0" : "bg-white border border-gray-200 rounded-2xl p-4 lg:p-6"}>
                                {isMobile ? (
                                    <div className="flex flex-col items-center justify-center py-16 gap-4">
                                        <div className="w-10 h-10 border-2 border-gray-200 border-t-gray-800 rounded-full animate-spin" />
                                        <p className="text-sm text-gray-500">로딩 중...</p>
                                    </div>
                                ) : (
                                    <div className="animate-pulse space-y-6">
                                        <div className="h-7 bg-gray-100 rounded w-40 mb-2"></div>
                                        <div className="h-5 bg-gray-100 rounded w-80 mb-8"></div>
                                        <TableSkeleton rows={5} />
                                    </div>
                                )}
                            </div>
                        ) : isMobile ? (
                            <div className="bg-white p-0">
                                <h2 className="text-lg font-semibold text-gray-800 mb-1">
                                    직원별 집계
                                </h2>
                                <p className="text-sm text-gray-500 mb-4">
                                    클릭하여 상세 내역을 확인하세요
                                </p>
                                {filteredData.length === 0 ? (
                                    <p className="py-8 text-center text-gray-500 text-sm">
                                        해당 기간의 직원별 지출 내역이 없습니다.
                                    </p>
                                ) : (
                                    <ul className="flex flex-col gap-3 pb-4">
                                        {currentData.map((row) => {
                                            const profile = employeeProfiles.get(row.name);
                                            const isExpanded = expandedRowKeys.includes(row.id);
                                            const details = expandedRowDetails.get(row.id);
                                            const rowTab = expandedRowActiveTab.get(row.id) || "mileage";
                                            return (
                                                <li key={row.id} className="rounded-xl overflow-hidden border border-gray-200">
                                                    <button
                                                        type="button"
                                                        className="w-full rounded-xl bg-transparent p-4 flex items-center gap-3 text-left active:bg-gray-50 transition-colors"
                                                        onClick={() => toggleRowExpand(row.id)}
                                                    >
                                                        <Avatar
                                                            email={profile?.email ?? null}
                                                            size={40}
                                                            position={profile?.position ?? null}
                                                        />
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-medium text-gray-900 truncate">{row.name.replace(/^[A-Z]{2,3} /, "")}</p>
                                                            <p className="text-sm text-gray-500 mt-0.5">
                                                                마일리지 {formatCurrency(row.mileage)} · 카드 {formatCurrency(row.cardExpense)} · 합계 {formatCurrency(row.total)}
                                                            </p>
                                                        </div>
                                                        <IconChevronRight
                                                            className={`w-5 h-5 text-gray-400 shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                                                        />
                                                    </button>
                                                    {isExpanded && (
                                                        <ExpandableDetailPanel>
                                                            {!details ? (
                                                                <div className="py-4">
                                                                    <div className="w-8 h-8 border-2 border-gray-200 border-t-gray-800 rounded-full animate-spin mx-auto" />
                                                                </div>
                                                            ) : (
                                                                <EmployeeDetailView
                                                                    employeeName={row.name.replace(/^[A-Z]{2,3} /, "")}
                                                                    year={year}
                                                                    month={month}
                                                                    mileageDetails={details.mileage}
                                                                    cardDetails={details.card}
                                                                    activeTab={rowTab}
                                                                    onTabChange={(tab) => {
                                                                        setExpandedRowActiveTab((prev) => {
                                                                            const next = new Map(prev);
                                                                            next.set(row.id, tab);
                                                                            return next;
                                                                        });
                                                                    }}
                                                                    mileageColumns={mileageColumns}
                                                                    cardColumns={cardColumns}
                                                                    variant="dropdown"
                                                                    onReceiptClick={(path) => setSelectedReceipt(getPersonalExpenseReceiptUrl(path))}
                                                                />
                                                            )}
                                                        </ExpandableDetailPanel>
                                                    )}
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                                {totalPages > 1 && (
                                    <div className="flex items-center justify-between mt-4 pt-4 flex-wrap gap-2">
                                        <span className="text-sm text-gray-500">
                                            총 {filteredData.length}명
                                        </span>
                                        <div className="flex gap-2">
                                            <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>
                                                이전
                                            </Button>
                                            <span className="px-3 py-1 text-sm text-gray-700">
                                                {currentPage} / {totalPages}
                                            </span>
                                            <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                                                다음
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            /* 데스크톱: 직원별 집계 테이블 */
                            <div className="bg-white border border-gray-200 rounded-2xl p-4 lg:p-6">
                                <h2 className="text-lg font-semibold text-gray-800 mb-1">
                                    직원별 집계
                                </h2>
                                <p className="text-sm text-gray-500 mb-4">
                                    클릭하여 상세 내역을 확인하세요
                                </p>

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
                                                <ExpandableDetailPanel>
                                                    <div className="p-2">
                                                        <TableSkeleton rows={3} />
                                                    </div>
                                                </ExpandableDetailPanel>
                                            );
                                        }

                                        return (
                                            <ExpandableDetailPanel>
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
                                                    onHeaderClick={() => {
                                                        const employeeNameWithoutInitials =
                                                            row.name.replace(
                                                                /^[A-Z]{2,3} /,
                                                                ""
                                                            );
                                                        setSelectedEmployeeId(
                                                            row.id
                                                        );
                                                        setUser(
                                                            employeeNameWithoutInitials
                                                        );
                                                        setActiveTab("mileage");
                                                        setExpandedRowKeys((prev) =>
                                                            prev.filter(
                                                                (id) =>
                                                                    id !== row.id
                                                            )
                                                        );
                                                    }}
                                                />
                                            </ExpandableDetailPanel>
                                        );
                                    }}
                                    expandedRowKeys={expandedRowKeys}
                                    emptyText="해당 기간의 직원별 지출 내역이 없습니다."
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
                                                        className={`px-3 py-1 text-sm rounded ${currentPage === page
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
                <ImagePreviewModal
                    isOpen={!!selectedReceipt}
                    onClose={() => setSelectedReceipt(null)}
                    imageSrc={selectedReceipt}
                    imageAlt="영수증 원본"
                />
            )}
        </div>
    );
}
