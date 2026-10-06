import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSidebarOpen } from "../../hooks/useSidebarOpen";
import useIsMobile from "../../hooks/useIsMobile";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/common/Header";
import PageContainer from "../../components/common/PageContainer";
import Input from "../../components/common/Input";
import Button from "../../components/common/Button";
import Table, { type TableColumn } from "../../components/common/Table";
import Pagination from "../../components/common/Pagination";
import Avatar from "../../components/common/Avatar";
import Chip from "../../components/ui/Chip";
import ActionMenu from "../../components/common/ActionMenu";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import ReportListSkeleton from "../../components/common/skeletons/ReportListSkeleton";
import SkeletonCard from "../../components/common/skeletons/SkeletonCard";
import { IconMore, IconMoreVertical, IconPlus } from "../../components/icons/Icons";
import { useToast } from "../../components/ui/ToastProvider";
import { PATHS } from "../../utils/paths";
import MaterialPurchaseDetailSidePanel from "./MaterialPurchaseDetailSidePanel";
import {
    approveMaterialPurchase,
    deleteMaterialPurchaseLine,
    fetchCurrentUserIsAdmin,
    fetchMaterialPurchaseDetail,
    fetchMaterialPurchaseList,
    revokeMaterialPurchaseApproval,
    setMaterialPurchasePurchased,
    type MaterialPurchaseDetail,
    type MaterialPurchaseListItem,
} from "../../lib/materialPurchaseApi";

const ITEMS_PER_PAGE = 10;
const SEARCH_DEBOUNCE_MS = 300;

const searchIcon = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="7" />
        <line x1="16.65" y1="16.65" x2="21" y2="21" />
    </svg>
);

function purchasedLabel(purchased: boolean) {
    return purchased ? "완료" : "예정";
}

function approvalStatusLabel(status: MaterialPurchaseListItem["approvalStatus"]) {
    return status === "approved" ? "승인" : "미승인";
}

export default function MaterialsPage({ title }: { title: string }) {
    const navigate = useNavigate();
    const isMobile = useIsMobile();
    const [sidebarOpen, setSidebarOpen] = useSidebarOpen();
    const { showError, showSuccess } = useToast();
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [items, setItems] = useState<MaterialPurchaseListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [listVersion, setListVersion] = useState(0);
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<MaterialPurchaseListItem | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [detailTarget, setDetailTarget] = useState<{ purchaseId: string; lineId: string | null } | null>(null);
    const [detail, setDetail] = useState<MaterialPurchaseDetail | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    const [approving, setApproving] = useState(false);
    const [completing, setCompleting] = useState(false);
    const hasLoadedOnceRef = useRef(false);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            setDebouncedSearch(search);
            setCurrentPage(1);
        }, SEARCH_DEBOUNCE_MS);
        return () => window.clearTimeout(timer);
    }, [search]);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            if (!hasLoadedOnceRef.current) setLoading(true);
            try {
                const next = await fetchMaterialPurchaseList();
                if (!cancelled) setItems(next);
            } catch (error) {
                console.error(error);
                if (!cancelled) {
                    setItems([]);
                    showError(error instanceof Error ? error.message : "목록을 불러오지 못했습니다.");
                }
            } finally {
                if (!cancelled) {
                    hasLoadedOnceRef.current = true;
                    setLoading(false);
                }
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, [showError, listVersion]);

    useEffect(() => {
        let cancelled = false;
        fetchCurrentUserIsAdmin()
            .then((next) => {
                if (!cancelled) setIsAdmin(next);
            })
            .catch(() => {
                if (!cancelled) setIsAdmin(false);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (!detailTarget) {
            setDetail(null);
            return;
        }
        let cancelled = false;
        setDetailLoading(true);
        fetchMaterialPurchaseDetail(detailTarget.purchaseId, detailTarget.lineId)
            .then((next) => {
                if (!cancelled) setDetail(next);
            })
            .catch((error) => {
                console.error(error);
                if (!cancelled) {
                    setDetail(null);
                    setDetailTarget(null);
                    showError(error instanceof Error ? error.message : "상세 정보를 불러오지 못했습니다.");
                }
            })
            .finally(() => {
                if (!cancelled) setDetailLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [detailTarget, showError]);

    const filteredItems = useMemo(() => {
        const keyword = debouncedSearch.trim().toLowerCase();
        if (!keyword) return items;
        return items.filter((item) => {
            const haystack = [
                item.author,
                item.kind === "personal" ? "기타" : "작업 자재",
                item.vessel,
                item.materialName,
                item.vendor,
                item.amountLabel,
                item.createdAtLabel,
                purchasedLabel(item.purchased),
                approvalStatusLabel(item.approvalStatus),
            ]
                .join(" ")
                .toLowerCase();
            return haystack.includes(keyword);
        });
    }, [debouncedSearch, items]);

    const totalPages = Math.max(1, Math.ceil(filteredItems.length / ITEMS_PER_PAGE));
    const page = Math.min(currentPage, totalPages);
    const pageItems = filteredItems.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

    const closeMenu = () => {
        setOpenMenuId(null);
        setMenuAnchor(null);
    };

    const toggleMenu = (rowId: string, anchor: HTMLElement) => {
        setOpenMenuId(openMenuId === rowId ? null : rowId);
        setMenuAnchor(openMenuId === rowId ? null : anchor);
    };

    const renderDeleteMenu = (row: MaterialPurchaseListItem) => (
        <ActionMenu
            isOpen={openMenuId === row.id}
            anchorEl={menuAnchor}
            onClose={closeMenu}
            onDelete={() => setDeleteTarget(row)}
            showLogout={false}
            width="w-44"
        />
    );

    const columns: TableColumn<MaterialPurchaseListItem>[] = [
        {
            key: "author",
            label: "작성자",
            width: "14%",
            cellClassName: "overflow-hidden",
            render: (_, row) => (
                <div className="flex items-center gap-2 min-w-0">
                    <Avatar email={row.authorEmail} size={24} position={row.authorPosition} />
                    <span className="truncate text-gray-900">{row.author}</span>
                </div>
            ),
        },
        {
            key: "kind",
            label: "구분",
            width: "8%",
            render: (_, row) => (
                <Chip
                    color={row.kind === "personal" ? "purple-500" : "green-500"}
                    variant="solid"
                    size="md"
                >
                    {row.kind === "personal" ? "기타" : "작업 자재"}
                </Chip>
            ),
        },
        {
            key: "vessel",
            label: "호선",
            width: "12%",
            cellClassName: "overflow-hidden",
            render: (value: string) =>
                value ? <span className="block truncate text-gray-600">{value}</span> : <span className="text-gray-400">—</span>,
        },
        {
            key: "materialName",
            label: "자재명",
            width: "16%",
            cellClassName: "overflow-hidden",
            render: (value: string, row) => (
                <div className="flex items-center gap-1.5 min-w-0">
                    {row.urgent && (
                        <span className="shrink-0 border border-red-500 px-1.5 py-0.5 text-xs font-medium leading-none text-red-500">
                            긴급
                        </span>
                    )}
                    {value ? (
                        <span className="block truncate text-gray-900">{value}</span>
                    ) : (
                        <span className="text-gray-400">—</span>
                    )}
                </div>
            ),
        },
        {
            key: "vendor",
            label: "구매처",
            width: "12%",
            cellClassName: "overflow-hidden",
            render: (value: string) =>
                value ? <span className="block truncate text-gray-600">{value}</span> : <span className="text-gray-400">—</span>,
        },
        {
            key: "amountLabel",
            label: "비용",
            width: "14%",
            align: "right",
            cellClassName: "overflow-hidden whitespace-nowrap",
            render: (value: string) =>
                value ? <span className="text-gray-900">{value}</span> : <span className="text-gray-400">—</span>,
        },
        {
            key: "createdAtLabel",
            label: "작성일",
            width: "12%",
            cellClassName: "overflow-hidden whitespace-nowrap",
            render: (value: string) => <span className="text-gray-600">{value || "—"}</span>,
        },
        {
            key: "approvalStatus",
            label: "승인 상태",
            width: "11%",
            render: (_, row) => (
                <Chip
                    color={row.approvalStatus === "approved" ? "green-500" : "gray-500"}
                    variant="solid"
                    size="md"
                >
                    {approvalStatusLabel(row.approvalStatus)}
                </Chip>
            ),
        },
        {
            key: "purchased",
            label: "구매상태",
            width: "11%",
            headerClassName: "whitespace-nowrap",
            cellClassName: "whitespace-nowrap",
            render: (_, row) => (
                <Chip
                    color={row.purchased ? "blue-500" : "gray-500"}
                    variant="solid"
                    size="md"
                >
                    {purchasedLabel(row.purchased)}
                </Chip>
            ),
        },
        {
            key: "actions",
            label: "",
            width: "8%",
            align: "right",
            showEmptyIndicator: false,
            render: (_, row) => (
                <div className="relative inline-flex">
                    <button
                        type="button"
                        onClick={(event) => {
                            event.stopPropagation();
                            toggleMenu(row.id, event.currentTarget);
                        }}
                        className="p-2 rounded hover:bg-gray-100 text-gray-600"
                        aria-label="행 메뉴"
                    >
                        <IconMore className="w-[18px] h-[18px]" />
                    </button>
                    <div onMouseDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
                        {renderDeleteMenu(row)}
                    </div>
                </div>
            ),
        },
    ];

    return (
        <div className="flex h-screen bg-white overflow-hidden">
            {sidebarOpen && (
                <div className="fixed inset-0 bg-black/50 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
            )}

            <div
                className={`
            fixed lg:static inset-y-0 left-0 z-30
            w-[260px] max-w-[88vw] lg:max-w-none lg:w-[239px] h-screen shrink-0
            transform transition-transform duration-300 ease-in-out
            ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
          `}
            >
                <Sidebar onClose={() => setSidebarOpen(false)} />
            </div>

            <div className="flex-1 flex flex-col h-screen overflow-hidden w-full">
                <Header
                    title={title}
                    onMenuClick={() => setSidebarOpen(true)}
                    rightContent={
                        !isMobile ? (
                            <Button
                                variant="primary"
                                size="lg"
                                onClick={() => navigate(PATHS.materialsCreate)}
                                icon={<IconPlus />}
                            >
                                등록
                            </Button>
                        ) : undefined
                    }
                />
                <div className="flex-1 overflow-y-auto" data-materials-list="true">
                    <PageContainer className="py-4 md:py-6 pb-24">
                        {isMobile ? (
                            <div className="flex flex-col gap-4">
                                <Input
                                    value={search}
                                    onChange={setSearch}
                                    placeholder="검색어를 입력해 주세요"
                                    icon={searchIcon}
                                    iconPosition="left"
                                    className="w-full"
                                />
                                {loading ? (
                                    <div className="flex flex-col gap-3">
                                        {Array.from({ length: 6 }).map((_, index) => (
                                            <SkeletonCard key={index} height="h-24" className="border border-gray-200" />
                                        ))}
                                    </div>
                                ) : pageItems.length === 0 ? (
                                    <div className="py-10 text-center text-sm text-gray-500">조회된 내역이 없습니다.</div>
                                ) : (
                                    <>
                                        <ul className="flex flex-col gap-3 pb-2">
                                            {pageItems.map((row) => {
                                                const meta = [row.createdAtLabel, row.vessel, row.vendor, row.amountLabel].filter(Boolean);
                                                return (
                                                    <li key={row.id}>
                                                        <div
                                                            className={`rounded-xl border p-4 flex items-start gap-3 cursor-pointer ${
                                                                row.urgent
                                                                    ? "border-red-200 bg-red-50"
                                                                    : "border-gray-200 bg-white"
                                                            }`}
                                                            onClick={() => setDetailTarget({ purchaseId: row.purchaseId, lineId: row.lineId })}
                                                        >
                                                            <div className="flex-1 min-w-0">
                                                                <p className="flex items-start gap-1.5 text-[15px] font-semibold text-gray-900">
                                                                    {row.urgent && (
                                                                        <span className="mt-0.5 shrink-0 border border-red-500 px-1.5 py-0.5 text-xs font-medium leading-none text-red-500">
                                                                            긴급
                                                                        </span>
                                                                    )}
                                                                    <span className="line-clamp-2 break-words">{row.materialName || "—"}</span>
                                                                </p>
                                                                {meta.length > 0 && (
                                                                    <p className="mt-1.5 text-[13px] text-gray-500 truncate">
                                                                        {meta.join(" · ")}
                                                                    </p>
                                                                )}
                                                                <div className="mt-2 flex items-center gap-2 flex-wrap">
                                                                    <Avatar
                                                                        email={row.authorEmail}
                                                                        position={row.authorPosition}
                                                                        size={20}
                                                                    />
                                                                    <span className="text-[13px] text-gray-600">{row.author}</span>
                                                                    <Chip
                                                                        color={row.kind === "personal" ? "purple-500" : "green-500"}
                                                                        variant="solid"
                                                                        size="sm"
                                                                    >
                                                                        {row.kind === "personal" ? "기타" : "작업 자재"}
                                                                    </Chip>
                                                                    <Chip
                                                                        color={row.purchased ? "blue-500" : "gray-500"}
                                                                        variant="solid"
                                                                        size="sm"
                                                                    >
                                                                        {purchasedLabel(row.purchased)}
                                                                    </Chip>
                                                                    <Chip
                                                                        color={row.approvalStatus === "approved" ? "green-500" : "gray-500"}
                                                                        variant="solid"
                                                                        size="sm"
                                                                    >
                                                                        {approvalStatusLabel(row.approvalStatus)}
                                                                    </Chip>
                                                                </div>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                className="rounded-lg hover:bg-gray-100 text-gray-500 -mr-1 shrink-0"
                                                                onClick={(event) => {
                                                                    event.stopPropagation();
                                                                    toggleMenu(row.id, event.currentTarget);
                                                                }}
                                                                aria-label="메뉴"
                                                            >
                                                                <IconMoreVertical className="w-6 h-6" />
                                                            </button>
                                                        </div>
                                                        {renderDeleteMenu(row)}
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                        {filteredItems.length > ITEMS_PER_PAGE && (
                                            <Pagination
                                                currentPage={page}
                                                totalPages={totalPages}
                                                onPageChange={setCurrentPage}
                                            />
                                        )}
                                    </>
                                )}
                            </div>
                        ) : loading ? (
                            <ReportListSkeleton />
                        ) : (
                        <div className="flex flex-col gap-4">
                            <Input
                                value={search}
                                onChange={setSearch}
                                placeholder="검색어를 입력해 주세요"
                                icon={searchIcon}
                                iconPosition="left"
                                className="w-full md:max-w-[420px]"
                            />
                            <Table
                                className="text-[14px]"
                                columns={columns}
                                data={pageItems}
                                rowKey="id"
                                emptyText="조회된 내역이 없습니다."
                                onRowClick={(row) => setDetailTarget({ purchaseId: row.purchaseId, lineId: row.lineId })}
                                rowClassName={(row) =>
                                    row.urgent ? "!bg-red-50 hover:!bg-red-100" : ""
                                }
                                pagination={
                                    filteredItems.length > ITEMS_PER_PAGE
                                        ? {
                                              currentPage: page,
                                              totalPages,
                                              onPageChange: setCurrentPage,
                                          }
                                        : undefined
                                }
                            />
                        </div>
                        )}
                    </PageContainer>
                </div>
            </div>
            {isMobile && (
                <div className="fixed bottom-6 right-4 z-10">
                    <Button
                        variant="primary"
                        size="lg"
                        onClick={() => navigate(PATHS.materialsCreate)}
                        icon={<IconPlus />}
                        className="shadow-lg rounded-full h-14 px-5"
                    >
                        등록
                    </Button>
                </div>
            )}
            <ConfirmDialog
                isOpen={deleteTarget != null}
                onClose={() => {
                    if (isDeleting) return;
                    setDeleteTarget(null);
                }}
                onConfirm={async () => {
                    if (!deleteTarget) return;
                    setIsDeleting(true);
                    try {
                        await deleteMaterialPurchaseLine({
                            purchaseId: deleteTarget.purchaseId,
                            lineId: deleteTarget.lineId,
                        });
                        showSuccess("삭제되었습니다.");
                        setDeleteTarget(null);
                        setListVersion((version) => version + 1);
                    } catch (error) {
                        showError(error instanceof Error ? error.message : "삭제에 실패했습니다.");
                    } finally {
                        setIsDeleting(false);
                    }
                }}
                title="삭제 확인"
                message="정말 삭제하시겠습니까?"
                confirmText="삭제"
                cancelText="취소"
                confirmVariant="danger"
                isLoading={isDeleting}
            />
            <MaterialPurchaseDetailSidePanel
                isOpen={detailTarget != null}
                loading={detailLoading}
                detail={detail}
                canApprove={isAdmin}
                approving={approving}
                completing={completing}
                onClose={() => {
                    if (approving || completing) return;
                    setDetailTarget(null);
                }}
                onApprove={async () => {
                    if (!detailTarget || approving) return;
                    setApproving(true);
                    try {
                        await approveMaterialPurchase(detailTarget.purchaseId);
                        setDetail((current) =>
                            current ? { ...current, approvalStatus: "approved" } : current
                        );
                        setItems((current) =>
                            current.map((item) =>
                                item.purchaseId === detailTarget.purchaseId
                                    ? { ...item, approvalStatus: "approved" }
                                    : item
                            )
                        );
                        showSuccess("승인되었습니다.");
                    } catch (error) {
                        showError(error instanceof Error ? error.message : "승인에 실패했습니다.");
                    } finally {
                        setApproving(false);
                    }
                }}
                onRevoke={async () => {
                    if (!detailTarget || approving) return;
                    setApproving(true);
                    try {
                        await revokeMaterialPurchaseApproval(detailTarget.purchaseId);
                        setDetail((current) =>
                            current ? { ...current, approvalStatus: "pending" } : current
                        );
                        setItems((current) =>
                            current.map((item) =>
                                item.purchaseId === detailTarget.purchaseId
                                    ? { ...item, approvalStatus: "pending" }
                                    : item
                            )
                        );
                        showSuccess("승인이 해제되었습니다.");
                    } catch (error) {
                        showError(error instanceof Error ? error.message : "승인 해제에 실패했습니다.");
                    } finally {
                        setApproving(false);
                    }
                }}
                onTogglePurchased={async () => {
                    if (!detailTarget || !detail || completing || approving) return;
                    const nextPurchased = !detail.purchased;
                    if (nextPurchased && (detail.lines[0]?.receipts.length ?? 0) === 0) {
                        showError("구매 완료 처리를 위해 영수증을 먼저 등록해주세요.");
                        return;
                    }
                    setCompleting(true);
                    try {
                        await setMaterialPurchasePurchased(detailTarget.purchaseId, nextPurchased);
                        setDetail((current) =>
                            current ? { ...current, purchased: nextPurchased } : current
                        );
                        setItems((current) =>
                            current.map((item) =>
                                item.purchaseId === detailTarget.purchaseId
                                    ? { ...item, purchased: nextPurchased }
                                    : item
                            )
                        );
                        showSuccess(nextPurchased ? "구매 완료되었습니다." : "구매 완료가 해제되었습니다.");
                    } catch (error) {
                        showError(
                            error instanceof Error
                                ? error.message
                                : nextPurchased
                                  ? "구매 완료 처리에 실패했습니다."
                                  : "구매 완료 해제에 실패했습니다."
                        );
                    } finally {
                        setCompleting(false);
                    }
                }}
                onSaved={async () => {
                    if (!detailTarget) return;
                    const next = await fetchMaterialPurchaseDetail(detailTarget.purchaseId, detailTarget.lineId);
                    setDetail(next);
                    const savedLine = next.lines[0];
                    setItems((current) =>
                        current.map((item) => {
                            if (item.purchaseId !== next.id) return item;
                            const shared = { kind: next.kind, vessel: next.vessel };
                            if (!savedLine || item.lineId !== savedLine.id) return { ...item, ...shared };
                            return {
                                ...item,
                                ...shared,
                                materialName: savedLine.materialName,
                                vendor: savedLine.vendor,
                                amountLabel: savedLine.amountLabel,
                                urgent: savedLine.urgent,
                            };
                        })
                    );
                }}
            />
        </div>
    );
}
