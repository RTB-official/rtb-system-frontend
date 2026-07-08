import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import PageContainer from "../../components/common/PageContainer";
import Header from "../../components/common/Header";
import Sidebar from "../../components/Sidebar";
import Table from "../../components/common/Table";
import Input from "../../components/common/Input";
import { useToast } from "../../components/ui/ToastProvider";
import BaseModal from "../../components/ui/BaseModal";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import { IconTrash } from "../../components/icons/Icons";
import {
    deleteInvoiceDraft,
    type InvoiceDraftRow,
} from "../../lib/invoiceDraftApi";
import {
    fetchInvoiceDraftsByVesselGroup,
    fetchInvoiceDraftVesselGroups,
    type InvoiceDraftVesselGroupItem,
} from "../../lib/invoiceDraftListApi";
import { PATHS } from "../../utils/paths";
import { useUser } from "../../hooks/useUser";

function formatInvoiceDraftModifiedAt(value: string): {
    date: string;
    time: string;
} {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return { date: "-", time: "" };
    }

    const date = new Intl.DateTimeFormat("ko-KR", {
        year: "numeric",
        month: "numeric",
        day: "numeric",
    }).format(parsed);

    const parts = new Intl.DateTimeFormat("ko-KR", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
    }).formatToParts(parsed);

    const dayPeriod =
        parts.find((part) => part.type === "dayPeriod")?.value ?? "";
    const hour = parts.find((part) => part.type === "hour")?.value ?? "";
    const minute = parts.find((part) => part.type === "minute")?.value ?? "";
    const time =
        dayPeriod && hour && minute ? `${dayPeriod} ${hour}:${minute}` : "";

    return { date, time };
}

function vesselGroupMatchesSearch(vessel: string, query: string): boolean {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return false;
    return vessel.toLowerCase().includes(normalized);
}

export default function InvoiceDraftListPage() {
    const navigate = useNavigate();
    const { showError, showSuccess } = useToast();
    const { userPermissions } = useUser();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [vesselGroups, setVesselGroups] = useState<InvoiceDraftVesselGroupItem[]>(
        []
    );
    const [loading, setLoading] = useState(true);
    const [selectedVessel, setSelectedVessel] = useState<string | null>(null);
    const [modalDrafts, setModalDrafts] = useState<InvoiceDraftRow[]>([]);
    const [modalLoading, setModalLoading] = useState(false);
    const [draftDeleteTarget, setDraftDeleteTarget] =
        useState<InvoiceDraftRow | null>(null);
    const [deletingDraftId, setDeletingDraftId] = useState<string | null>(null);
    const [search, setSearch] = useState("");

    const showErrorRef = useRef(showError);
    showErrorRef.current = showError;

    const searchQuery = search.trim();
    const isSearchActive = searchQuery.length > 0;

    const loadVesselGroups = useCallback(async () => {
        setLoading(true);
        try {
            const rows = await fetchInvoiceDraftVesselGroups();
            setVesselGroups(rows);
        } catch (e) {
            console.error(e);
            showErrorRef.current(
                e instanceof Error
                    ? e.message
                    : "저장 목록을 불러오는 중 오류가 발생했습니다."
            );
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadVesselGroups();
    }, [loadVesselGroups]);

    const loadModalDrafts = useCallback(async (vessel: string) => {
        setModalLoading(true);
        try {
            const rows = await fetchInvoiceDraftsByVesselGroup(vessel);
            setModalDrafts(rows);
            if (rows.length === 0) {
                setSelectedVessel(null);
            }
        } catch (e) {
            console.error(e);
            showErrorRef.current(
                e instanceof Error
                    ? e.message
                    : "드래프트 목록을 불러오는 중 오류가 발생했습니다."
            );
        } finally {
            setModalLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!selectedVessel) {
            setModalDrafts([]);
            return;
        }
        void loadModalDrafts(selectedVessel);
    }, [loadModalDrafts, selectedVessel]);

    const selectedGroup = useMemo(
        () =>
            selectedVessel
                ? vesselGroups.find((group) => group.vessel === selectedVessel) ??
                  null
                : null,
        [selectedVessel, vesselGroups]
    );

    useEffect(() => {
        if (selectedVessel && !selectedGroup && !modalLoading) {
            setSelectedVessel(null);
        }
    }, [modalLoading, selectedGroup, selectedVessel]);

    const closeVesselModal = useCallback(() => {
        setSelectedVessel(null);
        setModalDrafts([]);
    }, []);

    const openDraft = useCallback(
        (row: InvoiceDraftRow) => {
            navigate(
                `${PATHS.invoiceCreate}?draftId=${encodeURIComponent(row.id)}`
            );
        },
        [navigate]
    );

    const handleConfirmDeleteDraft = useCallback(async () => {
        if (!draftDeleteTarget || deletingDraftId) {
            return;
        }

        const draftId = draftDeleteTarget.id;
        const vesselForReload = selectedVessel;
        setDeletingDraftId(draftId);
        try {
            await deleteInvoiceDraft(draftId);
            showSuccess("드래프트를 삭제했습니다.");
            setDraftDeleteTarget(null);
            await loadVesselGroups();
            if (vesselForReload) {
                await loadModalDrafts(vesselForReload);
            }
        } catch (error) {
            console.error(error);
            showError(
                error instanceof Error
                    ? error.message
                    : "드래프트를 삭제하지 못했습니다."
            );
        } finally {
            setDeletingDraftId(null);
        }
    }, [
        deletingDraftId,
        draftDeleteTarget,
        loadModalDrafts,
        loadVesselGroups,
        selectedVessel,
        showError,
        showSuccess,
    ]);

    const draftTableColumns = useMemo(
        () => [
            ...(userPermissions.isAdmin
                ? [
                      {
                          key: "creator_name",
                          label: "작성자",
                          width: "88px",
                          headerClassName: "px-3",
                          cellClassName: "px-3 min-w-0",
                          render: (_: unknown, row: InvoiceDraftRow) => (
                              <span className="block truncate text-gray-600">
                                  {row.creator_name?.trim() || "-"}
                              </span>
                          ),
                      },
                  ]
                : []),
            {
                key: "title",
                label: "제목",
                headerClassName: "px-3",
                cellClassName: "px-3 min-w-0",
                render: (_: unknown, row: InvoiceDraftRow) => (
                    <span
                        className="block truncate font-medium text-gray-900"
                        title={row.title?.trim() || "(제목 없음)"}
                    >
                        {row.title?.trim() || "(제목 없음)"}
                    </span>
                ),
            },
            {
                key: "work_log_ids",
                label: "보고서",
                width: "64px",
                align: "right" as const,
                headerClassName: "whitespace-nowrap px-2",
                cellClassName: "px-2",
                render: (_: unknown, row: InvoiceDraftRow) => (
                    <span className="text-gray-600 whitespace-nowrap">
                        {row.work_log_ids.length}건
                    </span>
                ),
            },
            {
                key: "updated_at",
                label: "수정일시",
                width: "116px",
                align: "right" as const,
                headerClassName: "whitespace-nowrap px-2",
                cellClassName: "px-2",
                render: (_: unknown, row: InvoiceDraftRow) => {
                    const { date, time } = formatInvoiceDraftModifiedAt(
                        row.updated_at
                    );
                    return (
                        <span className="inline-block text-right text-gray-600">
                            <span className="block whitespace-nowrap">{date}</span>
                            {time ? (
                                <span className="block whitespace-nowrap">
                                    {time}
                                </span>
                            ) : null}
                        </span>
                    );
                },
            },
            {
                key: "actions",
                label: "",
                width: "56px",
                align: "center" as const,
                headerClassName: "pl-1 pr-3",
                cellClassName: "pl-1 pr-3",
                render: (_: unknown, row: InvoiceDraftRow) => (
                    <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-500 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 focus-visible:opacity-100 disabled:pointer-events-none disabled:opacity-40"
                        aria-label="드래프트 삭제"
                        disabled={deletingDraftId === row.id}
                        onClick={(event) => {
                            event.stopPropagation();
                            setDraftDeleteTarget(row);
                        }}
                    >
                        <IconTrash className="w-5 h-5" />
                    </button>
                ),
            },
        ],
        [deletingDraftId, userPermissions.isAdmin]
    );

    return (
        <div className="flex h-screen bg-[#f9fafb] overflow-hidden">
            <div
                className={`fixed lg:static inset-y-0 left-0 z-30 w-[260px] max-w-[88vw] lg:max-w-none lg:w-[239px] h-screen shrink-0 transform transition-transform duration-300 ease-in-out ${
                    sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
                }`}
            >
                <Sidebar onClose={() => setSidebarOpen(false)} />
            </div>

            <div className="flex-1 flex flex-col h-screen overflow-hidden w-full">
                <Header
                    title="저장 목록"
                    onMenuClick={() => setSidebarOpen(true)}
                />

                <PageContainer className="flex-1 overflow-y-auto pt-0 pb-24">
                    <div className="mt-4">
                        <Input
                            value={search}
                            onChange={setSearch}
                            placeholder="호선 검색"
                            icon={
                                <svg
                                    width="16"
                                    height="16"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    aria-hidden="true"
                                >
                                    <circle cx="11" cy="11" r="7" />
                                    <line x1="16.65" y1="16.65" x2="21" y2="21" />
                                </svg>
                            }
                            iconPosition="left"
                        />
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        {loading ? (
                            <div className="col-span-full bg-white border border-gray-200 rounded-2xl py-10 text-center text-gray-500 text-sm shadow-sm">
                                로딩 중...
                            </div>
                        ) : vesselGroups.length === 0 ? (
                            <div className="col-span-full bg-white border border-gray-200 rounded-2xl py-10 text-center text-gray-500 text-sm shadow-sm">
                                저장된 인보이스 드래프트가 없습니다.
                            </div>
                        ) : (
                            vesselGroups.map((group) => {
                                const latestLabel = group.latestUpdatedAt
                                    ? new Date(
                                          group.latestUpdatedAt
                                      ).toLocaleString("ko-KR")
                                    : "";
                                const isSearchMatch =
                                    isSearchActive &&
                                    vesselGroupMatchesSearch(
                                        group.vessel,
                                        searchQuery
                                    );

                                return (
                                    <button
                                        key={group.vessel}
                                        type="button"
                                        onClick={() =>
                                            setSelectedVessel(group.vessel)
                                        }
                                        className={`flex min-w-0 flex-col rounded-2xl border px-4 py-4 text-left shadow-sm transition-colors ${
                                            isSearchMatch
                                                ? "border-blue-400 bg-blue-50 ring-2 ring-blue-200 hover:border-blue-500 hover:bg-blue-100/80"
                                                : isSearchActive
                                                  ? "border-gray-200 bg-white opacity-45 hover:opacity-70"
                                                  : "border-gray-200 bg-white hover:border-blue-200 hover:bg-blue-50/40"
                                        }`}
                                    >
                                        <p className="text-[15px] font-semibold text-gray-900 truncate lg:text-[16px]">
                                            {group.vessel}
                                        </p>
                                        <p className="mt-1 text-[12px] text-gray-500 line-clamp-2">
                                            {group.draftCount}건
                                            {latestLabel ? ` · ${latestLabel}` : ""}
                                        </p>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </PageContainer>
            </div>

            <BaseModal
                isOpen={selectedVessel !== null}
                onClose={closeVesselModal}
                title={
                    selectedVessel
                        ? `${selectedVessel} · 총 ${modalDrafts.length}건`
                        : "드래프트 목록"
                }
                maxWidth="max-w-4xl"
            >
                {selectedVessel && (
                    <div className="min-w-0 overflow-hidden rounded-xl border border-gray-200">
                        {modalLoading ? (
                            <div className="py-10 text-center text-sm text-gray-500">
                                로딩 중...
                            </div>
                        ) : (
                            <Table
                                className="text-[14px] table-fixed"
                                columns={draftTableColumns}
                                data={modalDrafts}
                                rowKey="id"
                                rowClassName={() => "group"}
                                outerBorder={false}
                                scrollX={false}
                                onRowClick={(row: InvoiceDraftRow) =>
                                    openDraft(row)
                                }
                            />
                        )}
                    </div>
                )}
            </BaseModal>

            <ConfirmDialog
                isOpen={draftDeleteTarget !== null}
                onClose={() => {
                    if (!deletingDraftId) {
                        setDraftDeleteTarget(null);
                    }
                }}
                onConfirm={() => void handleConfirmDeleteDraft()}
                title="드래프트 삭제"
                message={
                    draftDeleteTarget
                        ? `"${draftDeleteTarget.title?.trim() || "(제목 없음)"}" 드래프트를 삭제할까요?`
                        : "이 드래프트를 삭제할까요?"
                }
                confirmText="삭제"
                cancelText="취소"
                isLoading={deletingDraftId !== null}
            />
        </div>
    );
}
