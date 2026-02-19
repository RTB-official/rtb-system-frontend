// src/pages/TBM/TbmListPage.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/common/Header";
import Table from "../../components/common/Table";
import Input from "../../components/common/Input";
import YearMonthSelector from "../../components/common/YearMonthSelector";
import Button from "../../components/common/Button";
import ActionMenu from "../../components/common/ActionMenu";
import { IconMore, IconPlus } from "../../components/icons/Icons";
import { useToast } from "../../components/ui/ToastProvider";
import { deleteTbm, getTbmList, TbmRecord } from "../../lib/tbmApi";
import { generateTbmPdf } from "../../lib/pdfUtils";
import Chip from "../../components/ui/Chip";
import TbmListSkeleton from "../../components/common/skeletons/TbmListSkeleton";
import useIsMobile from "../../hooks/useIsMobile";

interface TbmListItem extends TbmRecord {
    participant_total: number;
    participant_signed: number;
}

export default function TbmListPage() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [year, setYear] = useState("년도 전체");
    const [month, setMonth] = useState("월 전체");
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    const navigate = useNavigate();
    const { showError, showSuccess } = useToast();
    const [loading, setLoading] = useState(true);
    const [tbmList, setTbmList] = useState<TbmListItem[]>([]);
    const isMobile = useIsMobile();
    const handleDownloadPdf = async (tbmId: string) => {
        await generateTbmPdf({
            tbmId,
            onError: showError,
        });
    };

    useEffect(() => {
        const load = async () => {
            try {
                setLoading(true);
                const { tbmList: list, participants } = await getTbmList();
                const countMap = new Map<
                    string,
                    { total: number; signed: number }
                >();

                (participants || []).forEach((p: any) => {
                    const entry = countMap.get(p.tbm_id) || { total: 0, signed: 0 };
                    entry.total += 1;
                    if (p.signed_at) entry.signed += 1;
                    countMap.set(p.tbm_id, entry);
                });

                const mapped = list.map((t) => {
                    const counts = countMap.get(t.id) || { total: 0, signed: 0 };
                    return {
                        ...t,
                        participant_total: counts.total,
                        participant_signed: counts.signed,
                    };
                });
                setTbmList(mapped);
            } catch (e: any) {
                showError(e?.message || "TBM 목록을 불러오지 못했습니다.");
            } finally {
                setLoading(false);
            }
        };

        load();
    }, [showError]);

    const handleDeleteTbm = async (tbmId: string) => {
        if (!window.confirm("\u0054\u0042\u004d\uC744 \uC0AD\uC81C\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?")) return;

        try {
            await deleteTbm(tbmId);
            setTbmList((prev) => prev.filter((t) => t.id !== tbmId));
            showSuccess("\u0054\u0042\u004d\uC774 \uC0AD\uC81C\uB418\uC5C8\uC2B5\uB2C8\uB2E4.");
        } catch (e: any) {
            showError(e?.message || "\u0054\u0042\u004d \uC0AD\uC81C\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.");
        } finally {
            setOpenMenuId(null);
            setMenuAnchor(null);
        }
    };

    const filtered = useMemo(() => {
        return tbmList.filter((r) => {
            const matchSearch =
                (r.work_name || "").includes(search) ||
                (r.created_by_name || "").includes(search) ||
                (r.location || "").includes(search);

            const matchYear =
                year === "년도 전체" ||
                (r.tbm_date || "").startsWith(year.replace("년", ""));

            let matchMonth = true;
            if (month !== "월 전체") {
                const monthNum = month.replace("월", "");
                const dateParts = (r.tbm_date || "").split("-");
                matchMonth = dateParts.length > 1 && dateParts[1] === monthNum.padStart(2, "0");
            }

            return matchSearch && matchYear && matchMonth;
        });
    }, [tbmList, search, year, month]);

    const totalPages = Math.ceil(filtered.length / itemsPerPage);
    const currentData = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        return filtered.slice(startIndex, endIndex);
    }, [filtered, currentPage, itemsPerPage]);

    return (
        <div className="flex h-screen bg-white overflow-hidden">
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-20 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            <div
                className={`fixed lg:static inset-y-0 left-0 z-30 w-[260px] max-w-[88vw] lg:max-w-none lg:w-[239px] h-screen shrink-0 transform transition-transform duration-300 ease-in-out ${sidebarOpen
                    ? "translate-x-0"
                    : "-translate-x-full lg:translate-x-0"
                    }`}
            >
                <Sidebar onClose={() => setSidebarOpen(false)} />
            </div>

            <div className="flex-1 flex flex-col h-screen overflow-hidden w-full">
                <Header
                    title="TBM 목록"
                    onMenuClick={() => setSidebarOpen(true)}
                    rightContent={
                        !isMobile ? (
                            <Button
                                variant="primary"
                                size="lg"
                                onClick={() => navigate("/tbm/create")}
                                icon={<IconPlus />}
                            >
                                TBM 작성
                            </Button>
                        ) : undefined
                    }
                />

                <div className="flex-1 overflow-y-auto px-4 md:px-6 lg:px-12 pt-4 md:pt-6 pb-24 relative">
                    {loading ? (
                        <TbmListSkeleton />
                    ) : isMobile ? (
                        <div className="flex flex-col gap-4">
                            <div className="flex flex-col gap-3">
                                <Input
                                    value={search}
                                    onChange={setSearch}
                                    placeholder="검색어를 입력해 주세요"
                                    icon={
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <circle cx="11" cy="11" r="7" />
                                            <line x1="16.65" y1="16.65" x2="21" y2="21" />
                                        </svg>
                                    }
                                    iconPosition="left"
                                    className="w-full"
                                />
                                <div className="flex items-center gap-2">
                                    <YearMonthSelector
                                        className="flex-1 min-w-0"
                                        year={year}
                                        month={month}
                                        onYearChange={(val) => {
                                            setYear(val);
                                            setCurrentPage(1);
                                        }}
                                        onMonthChange={(val) => {
                                            setMonth(val);
                                            setCurrentPage(1);
                                        }}
                                        yearOptions={[
                                            { value: "년도 전체", label: "년도 전체" },
                                            { value: "2025년", label: "2025년" },
                                            { value: "2026년", label: "2026년" },
                                        ]}
                                        monthOptions={[
                                            { value: "월 전체", label: "월 전체" },
                                            { value: "1월", label: "1월" },
                                            { value: "2월", label: "2월" },
                                            { value: "3월", label: "3월" },
                                            { value: "4월", label: "4월" },
                                            { value: "5월", label: "5월" },
                                            { value: "6월", label: "6월" },
                                            { value: "7월", label: "7월" },
                                            { value: "8월", label: "8월" },
                                            { value: "9월", label: "9월" },
                                            { value: "10월", label: "10월" },
                                            { value: "11월", label: "11월" },
                                            { value: "12월", label: "12월" },
                                        ]}
                                    />
                                </div>
                            </div>

                            {filtered.length === 0 ? (
                                <div className="py-10 text-center text-gray-500 text-sm">결과가 없습니다.</div>
                            ) : (
                                <ul className="flex flex-col gap-3 pb-2">
                                    {filtered.map((row) => {
                                        const isComplete = row.participant_total > 0 && row.participant_total === row.participant_signed;
                                        const dateText = row.tbm_date ? String(row.tbm_date).replace(/-/g, ".") + "." : "-";
                                        const hasLine = Boolean(row.line_name);
                                        return (
                                            <li key={row.id}>
                                                <div
                                                    className="rounded-xl border border-gray-200 bg-white p-4 active:bg-gray-50 transition-colors flex items-start gap-3"
                                                    role="button"
                                                    tabIndex={0}
                                                    onClick={() => navigate(`/tbm/${row.id}`)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === "Enter" || e.key === " ") {
                                                            e.preventDefault();
                                                            navigate(`/tbm/${row.id}`);
                                                        }
                                                    }}
                                                >
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className="text-[16px] font-semibold text-gray-900 truncate">
                                                                {row.work_name || "-"}
                                                            </span>
                                                            <Chip
                                                                color={isComplete ? "blue-500" : "gray-400"}
                                                                variant="solid"
                                                                size="sm"
                                                            >
                                                                {isComplete ? "완료" : "진행중"}
                                                            </Chip>
                                                        </div>
                                                        <div className="flex items-center gap-2 mt-1.5 text-[13px] text-gray-500">
                                                            <span>{hasLine ? `호선 ${row.line_name}` : dateText}</span>
                                                            <span aria-hidden>·</span>
                                                            <span className="truncate">{row.location || "-"}</span>
                                                        </div>
                                                        {hasLine && (
                                                            <div className="text-[12px] text-gray-400 mt-1">{dateText}</div>
                                                        )}
                                                    </div>
                                                    <button
                                                        type="button"
                                                        className="rounded-lg hover:bg-gray-100 text-gray-500 -mr-1 shrink-0"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setOpenMenuId(openMenuId === row.id ? null : row.id);
                                                            setMenuAnchor(openMenuId === row.id ? null : e.currentTarget);
                                                        }}
                                                        aria-label="메뉴"
                                                    >
                                                        <IconMore className="w-6 h-6" />
                                                    </button>
                                                </div>
                                                <ActionMenu
                                                    isOpen={openMenuId === row.id}
                                                    anchorEl={menuAnchor}
                                                    onClose={() => {
                                                        setOpenMenuId(null);
                                                        setMenuAnchor(null);
                                                    }}
                                                    onEdit={() => navigate(`/tbm/create?edit=${row.id}`)}
                                                    onPdf={() => handleDownloadPdf(row.id)}
                                                    pdfLabel="PDF 저장"
                                                    onDelete={() => handleDeleteTbm(row.id)}
                                                    showPdf
                                                    showDelete
                                                    showLogout={false}
                                                    width="w-44"
                                                />
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4">
                            <div className="bg-white p-0">
                                <div className="flex gap-3 items-center">
                                    <Input
                                        value={search}
                                        onChange={setSearch}
                                        placeholder="검색어를 입력해 주세요"
                                        icon={
                                            <svg
                                                width="16"
                                                height="16"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                            >
                                                <circle cx="11" cy="11" r="7" />
                                                <line x1="16.65" y1="16.65" x2="21" y2="21" />
                                            </svg>
                                        }
                                        iconPosition="left"
                                        className="min-w-[300px] flex-1"
                                    />
                                    <YearMonthSelector
                                        className="shrink-0"
                                        year={year}
                                        month={month}
                                        onYearChange={(val) => {
                                            setYear(val);
                                            setCurrentPage(1);
                                        }}
                                        onMonthChange={(val) => {
                                            setMonth(val);
                                            setCurrentPage(1);
                                        }}
                                        yearOptions={[
                                            { value: "년도 전체", label: "년도 전체" },
                                            { value: "2025년", label: "2025년" },
                                            { value: "2026년", label: "2026년" },
                                        ]}
                                        monthOptions={[
                                            { value: "월 전체", label: "월 전체" },
                                            { value: "1월", label: "1월" },
                                            { value: "2월", label: "2월" },
                                            { value: "3월", label: "3월" },
                                            { value: "4월", label: "4월" },
                                            { value: "5월", label: "5월" },
                                            { value: "6월", label: "6월" },
                                            { value: "7월", label: "7월" },
                                            { value: "8월", label: "8월" },
                                            { value: "9월", label: "9월" },
                                            { value: "10월", label: "10월" },
                                            { value: "11월", label: "11월" },
                                            { value: "12월", label: "12월" },
                                        ]}
                                    />
                                </div>
                            </div>

                            <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
                                <Table
                                    className="text-[14px] min-w-[600px]"
                                    columns={[
                                        {
                                            key: "tbm_date",
                                            label: "TBM 일시",
                                            width: "110px",
                                            render: (value) =>
                                                value
                                                    ? String(value).replace(/-/g, ".") + "."
                                                    : "-",
                                        },
                                        { key: "line_name", label: "호선명", width: "150px" },
                                        { key: "work_name", label: "작업명" },
                                        { key: "location", label: "장소", width: "150px" },
                                        {
                                            key: "created_by_name",
                                            label: "작성자",
                                            width: "90px",
                                        },
                                        {
                                            key: "status",
                                            label: "상태",
                                            width: "100px",
                                            align: "center",
                                            render: (_, row: TbmListItem) => {
                                                const isComplete = row.participant_total > 0 && row.participant_total === row.participant_signed;
                                                return (
                                                    <Chip
                                                        color={isComplete ? "blue-500" : "gray-400"}
                                                        variant="solid"
                                                        size="md"
                                                    >
                                                        {isComplete ? "완료" : "진행중"}
                                                    </Chip>
                                                );
                                            },
                                        },
                                        {
                                            key: "actions",
                                            label: "",
                                            width: "60px",
                                            align: "right",
                                            render: (_, row: TbmListItem) => (
                                                <div className="relative inline-flex">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setOpenMenuId(
                                                                openMenuId === row.id
                                                                    ? null
                                                                    : row.id
                                                            );
                                                            setMenuAnchor(
                                                                openMenuId === row.id
                                                                    ? null
                                                                    : e.currentTarget
                                                            );
                                                        }}
                                                        className="p-2 rounded hover:bg-gray-100 text-gray-600"
                                                        aria-label="메뉴"
                                                    >
                                                        <IconMore className="w-[18px] h-[18px]" />
                                                    </button>

                                                    <div
                                                        onMouseDown={(e) =>
                                                            e.stopPropagation()
                                                        }
                                                        onClick={(e) =>
                                                            e.stopPropagation()
                                                        }
                                                    >
                                                        <ActionMenu
                                                            isOpen={
                                                                openMenuId === row.id
                                                            }
                                                            anchorEl={menuAnchor}
                                                            onClose={() => {
                                                                setOpenMenuId(null);
                                                                setMenuAnchor(null);
                                                            }}
                                                            onEdit={() => navigate(`/tbm/create?edit=${row.id}`)}
                                                            onPdf={() => handleDownloadPdf(row.id)}
                                                            pdfLabel="PDF 저장"
                                                            onDelete={() => handleDeleteTbm(row.id)}
                                                            showPdf
                                                            showDelete
                                                            showLogout={false}
                                                            width="w-44"
                                                        />
                                                    </div>
                                                </div>
                                            ),
                                        },
                                    ]}
                                    data={currentData}
                                    rowKey="id"
                                    emptyText={"결과가 없습니다."}
                                    onRowClick={(row: TbmListItem) => navigate(`/tbm/${row.id}`)}
                                    pagination={{
                                        currentPage,
                                        totalPages,
                                        onPageChange: setCurrentPage,
                                    }}
                                />
                            </div>
                        </div>
                    )}
                </div>

                {isMobile && (
                    <div className="fixed bottom-6 right-4 z-10 lg:hidden">
                        <Button
                            variant="primary"
                            size="lg"
                            onClick={() => navigate("/tbm/create")}
                            icon={<IconPlus />}
                            className="shadow-lg rounded-full h-14 px-5"
                        >
                            TBM 작성
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
