import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import PageContainer from "../../components/common/PageContainer";
import Header from "../../components/common/Header";
import Sidebar from "../../components/Sidebar";
import Table from "../../components/common/Table";
import Button from "../../components/common/Button";
import { IconInvoice } from "../../components/icons/Icons";
import { useToast } from "../../components/ui/ToastProvider";
import {
    listInvoiceDraftsByUser,
    type InvoiceDraftRow,
} from "../../lib/invoiceDraftApi";
import { PATHS } from "../../utils/paths";

export default function InvoiceDraftListPage() {
    const navigate = useNavigate();
    const { showError } = useToast();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [drafts, setDrafts] = useState<InvoiceDraftRow[]>([]);
    const [loading, setLoading] = useState(true);

    const loadDrafts = useCallback(async () => {
        setLoading(true);
        try {
            const rows = await listInvoiceDraftsByUser();
            setDrafts(rows);
        } catch (e) {
            console.error(e);
            showError(
                e instanceof Error
                    ? e.message
                    : "저장 목록을 불러오는 중 오류가 발생했습니다."
            );
        } finally {
            setLoading(false);
        }
    }, [showError]);

    useEffect(() => {
        void loadDrafts();
    }, [loadDrafts]);

    const openDraft = (row: InvoiceDraftRow) => {
        navigate(
            `${PATHS.invoiceCreate}?draftId=${encodeURIComponent(row.id)}`
        );
    };

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
                    rightContent={
                        <Button
                            variant="outline"
                            size="lg"
                            onClick={() => void loadDrafts()}
                            disabled={loading}
                        >
                            새로고침
                        </Button>
                    }
                />

                <PageContainer className="flex-1 overflow-y-auto pt-0 pb-24">
                    <div className="space-y-4">
                        <div className="bg-white border border-gray-200 rounded-2xl p-0 md:p-0 shadow-sm mt-4">
                            {loading ? (
                                <div className="py-10 text-center text-gray-500 text-sm">
                                    로딩 중...
                                </div>
                            ) : (
                                <Table
                                    className="text-[14px]"
                                    emptyText="저장된 인보이스 드래프트가 없습니다."
                                    columns={[
                                        {
                                            key: "title",
                                            label: "제목",
                                            width: "40%",
                                            render: (_: unknown, row: InvoiceDraftRow) => (
                                                <span className="text-gray-900 font-medium">
                                                    {row.title?.trim() || "(제목 없음)"}
                                                </span>
                                            ),
                                        },
                                        {
                                            key: "work_log_ids",
                                            label: "보고서",
                                            width: "12%",
                                            render: (_: unknown, row: InvoiceDraftRow) => (
                                                <span className="text-gray-600">
                                                    {row.work_log_ids.length}건
                                                </span>
                                            ),
                                        },
                                        {
                                            key: "status",
                                            label: "상태",
                                            width: "12%",
                                            render: (_: unknown, row: InvoiceDraftRow) => (
                                                <span className="text-gray-600">
                                                    {row.status === "final" ? "Final" : "Draft"}
                                                </span>
                                            ),
                                        },
                                        {
                                            key: "updated_at",
                                            label: "수정일시",
                                            width: "22%",
                                            render: (_: unknown, row: InvoiceDraftRow) => (
                                                <span className="text-gray-600">
                                                    {new Date(row.updated_at).toLocaleString(
                                                        "ko-KR"
                                                    )}
                                                </span>
                                            ),
                                        },
                                        {
                                            key: "actions",
                                            label: "",
                                            width: "14%",
                                            render: (_: unknown, row: InvoiceDraftRow) => (
                                                <Button
                                                    variant="primary"
                                                    size="sm"
                                                    icon={<IconInvoice />}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        openDraft(row);
                                                    }}
                                                >
                                                    열기
                                                </Button>
                                            ),
                                        },
                                    ]}
                                    data={drafts}
                                    rowKey="id"
                                    onRowClick={(row: InvoiceDraftRow) => openDraft(row)}
                                />
                            )}
                        </div>
                    </div>
                </PageContainer>
            </div>
        </div>
    );
}
