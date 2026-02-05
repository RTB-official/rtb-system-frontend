import { useEffect, useMemo, useState } from "react";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/common/Header";
import Table from "../../components/common/Table";
import ActionMenu from "../../components/common/ActionMenu";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import VehiclesSkeleton from "../../components/common/VehiclesSkeleton";
import { IconMore, IconMoreVertical, IconPlus } from "../../components/icons/Icons";
import BaseModal from "../../components/ui/BaseModal";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import DatePicker from "../../components/ui/DatePicker";
import { useToast } from "../../components/ui/ToastProvider";
import useIsMobile from "../../hooks/useIsMobile";
import { useUser } from "../../hooks/useUser";
import {
    VehicleForm,
    listVehicles,
    createVehicle,
    updateVehicle,
    deleteVehicle,
    mapRecordToForm,
    uploadVehicleRegistration,
    deleteVehicleRegistration,
    getVehicleRegistrationUrl,
} from "../../lib/vehiclesApi";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type VehicleRow = { id: string; form: VehicleForm };

type SortKey =
    | "type"
    | "color"
    | "primaryUser"
    | "insurer"
    | "rentalStart"
    | "contractEnd"
    | "inspection"
    | "engineOil";

type SortDir = "asc" | "desc";

// -----------------------------------------------------------------------------
// Constants & helpers
// -----------------------------------------------------------------------------

const PAGE_SIZE = 10;

const emptyForm: VehicleForm = {
    type: "",
    plate: "",
    color: "",
    primaryUser: "",
    rentalStart: "",
    contractEnd: "",
    insurer: "",
    inspection: "",
    engineOil: "",
    engineOilKm: "",
    repair: "",
    registrationBucket: "",
    registrationPath: "",
    registrationName: "",
};

const onlyDigits = (value: string) => value.replace(/\D/g, "");

const formatWithCommas = (value?: string) => {
    if (!value) return "";
    const digits = onlyDigits(value);
    if (!digits) return "";
    return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

function VehicleDetailRow({
    label,
    value,
}: {
    label: string;
    value: React.ReactNode;
}) {
    return (
        <p className="flex gap-3 text-sm">
            <span className="shrink-0 text-gray-500">{label}</span>
            <span className="font-medium text-gray-900">{value}</span>
        </p>
    );
}

export default function VehiclesPage() {
    const { showError, showSuccess } = useToast();
    const { userPermissions } = useUser();
    const isMobile = useIsMobile();
    const canManage =
        userPermissions.isAdmin ||
        userPermissions.isStaff ||
        userPermissions.isCEO;

    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [page, setPage] = useState(1);
    const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [actionOpen, setActionOpen] = useState(false);
    const [actionAnchor, setActionAnchor] = useState<HTMLElement | null>(null);
    const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
    const [expandedVehicleId, setExpandedVehicleId] = useState<string | null>(null);

    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editForm, setEditForm] = useState<VehicleForm | null>(null);
    const [editMode, setEditMode] = useState<"create" | "edit">("create");
    const [registrationFile, setRegistrationFile] = useState<File | null>(null);
    const [sortKey, setSortKey] = useState<SortKey>("type");
    const [sortDir, setSortDir] = useState<SortDir>("asc");
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

    const sortedVehicles = useMemo(() => {
        const next = [...vehicles];
        const getText = (row: VehicleRow, key: SortKey) => {
            if (key === "type") return row.form.type;
            if (key === "color") return row.form.color;
            if (key === "primaryUser") return row.form.primaryUser;
            return row.form.insurer;
        };
        const getDateValue = (row: VehicleRow, key: SortKey) => {
            const value =
                key === "rentalStart"
                    ? row.form.rentalStart
                    : key === "contractEnd"
                        ? row.form.contractEnd
                        : key === "inspection"
                            ? row.form.inspection
                            : row.form.engineOil;
            if (!value) return Number.NEGATIVE_INFINITY;
            return new Date(value).getTime();
        };
        next.sort((a, b) => {
            let result = 0;
            if (
                sortKey === "type" ||
                sortKey === "color" ||
                sortKey === "primaryUser" ||
                sortKey === "insurer"
            ) {
                const left = getText(a, sortKey) || "";
                const right = getText(b, sortKey) || "";
                result = left.localeCompare(right, "ko-KR");
            } else {
                const left = getDateValue(a, sortKey);
                const right = getDateValue(b, sortKey);
                result = left - right;
            }
            return sortDir === "asc" ? result : -result;
        });
        return next;
    }, [vehicles, sortKey, sortDir]);

    const pageCount = Math.max(
        1,
        Math.ceil(sortedVehicles.length / PAGE_SIZE)
    );
    const pagedVehicles = sortedVehicles.slice(
        (page - 1) * PAGE_SIZE,
        page * PAGE_SIZE
    );

    const handleSortChange = (key: SortKey) => {
        if (sortKey === key) {
            setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
        } else {
            setSortKey(key);
            setSortDir("asc");
        }
        setPage(1);
    };

    const renderSortLabel = (label: string, key: SortKey) => {
        const active = sortKey === key;
        const isAsc = sortDir === "asc";
        return (
            <button
                type="button"
                onClick={() => handleSortChange(key)}
                className={`inline-flex items-center gap-2 text-left ${active ? "text-gray-900" : "text-gray-600"
                    }`}
                aria-label={`${label} 정렬`}
            >
                {label}
                <span
                    className={`inline-flex flex-col leading-[8px] text-[9px] ${active ? "text-gray-800" : "text-gray-400"
                        }`}
                    aria-hidden="true"
                >
                    <span className={active && isAsc ? "text-gray-900" : ""}>
                        ▲
                    </span>
                    <span className={active && !isAsc ? "text-gray-900" : ""}>
                        ▼
                    </span>
                </span>
            </button>
        );
    };

    const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId);

    const openEditModal = (vehicle?: VehicleRow) => {
        if (vehicle) {
            setEditMode("edit");
            setEditForm({ ...vehicle.form });
            setSelectedVehicleId(vehicle.id);
        } else {
            setEditMode("create");
            setEditForm({ ...emptyForm });
            setSelectedVehicleId(null);
        }
        setRegistrationFile(null);
        setEditModalOpen(true);
    };

    const loadVehicles = async () => {
        if (!canManage) return;
        setLoading(true);
        try {
            const data = await listVehicles();
            const mapped = data.map((record) => ({
                id: record.id,
                form: mapRecordToForm(record),
            }));
            setVehicles(mapped);
        } catch (error: any) {
            console.error("차량 목록 조회 실패:", error?.message || error);
            showError("차량 목록을 불러오지 못했습니다.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadVehicles();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [canManage]);

    const handleSaveEdit = async () => {
        if (!editForm) return;
        if (!editForm.type.trim() || !editForm.plate.trim()) {
            showError("차종과 차량번호는 필수입니다.");
            return;
        }
        try {
            let nextForm = { ...editForm };
            if (registrationFile) {
                const prevBucket = editForm.registrationBucket;
                const prevPath = editForm.registrationPath;
                const { bucket, path, name } =
                    await uploadVehicleRegistration(registrationFile);
                nextForm = {
                    ...nextForm,
                    registrationBucket: bucket,
                    registrationPath: path,
                    registrationName: name,
                };
                if (
                    editMode === "edit" &&
                    prevBucket &&
                    prevPath &&
                    (prevBucket !== bucket || prevPath !== path)
                ) {
                    try {
                        await deleteVehicleRegistration(prevBucket, prevPath);
                    } catch (error) {
                        console.warn(
                            "기존 차량 등록증 삭제 실패:",
                            (error as any)?.message || error
                        );
                    }
                }
            }
            if (editMode === "create") {
                await createVehicle(nextForm);
                showSuccess("차량이 추가되었습니다.");
            } else if (selectedVehicleId) {
                await updateVehicle(selectedVehicleId, nextForm);
                showSuccess("차량 정보가 수정되었습니다.");
            }
            await loadVehicles();
            setEditModalOpen(false);
            setEditForm(null);
            setRegistrationFile(null);
        } catch (error: any) {
            console.error("차량 저장 실패:", error?.message || error);
            showError("차량 저장에 실패했습니다.");
        }
    };

    const handleDelete = async () => {
        if (!selectedVehicleId) return;
        setDeleteConfirmOpen(true);
    };

    const confirmDelete = async () => {
        if (!selectedVehicleId) return;
        setDeleteConfirmOpen(false);
        try {
            await deleteVehicle(selectedVehicleId);
            showSuccess("차량이 삭제되었습니다.");
            await loadVehicles();
        } catch (error: any) {
            console.error("차량 삭제 실패:", error?.message || error);
            showError("차량 삭제에 실패했습니다.");
        }
    };

    const handleDownloadRegistration = async () => {
        if (!selectedVehicle) return;
        const { registrationBucket, registrationPath, registrationName } =
            selectedVehicle.form;
        if (!registrationBucket || !registrationPath) {
            showError("등록증 파일이 없습니다.");
            return;
        }
        try {
            const url = await getVehicleRegistrationUrl(
                registrationBucket,
                registrationPath
            );
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error("파일 다운로드 실패");
            }
            const blob = await response.blob();
            const objectUrl = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = objectUrl;
            link.download =
                registrationName ||
                registrationPath.split("/").pop() ||
                "registration";
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(objectUrl);
            showSuccess("다운로드되었습니다.");
        } catch (error: any) {
            console.error("등록증 다운로드 실패:", error?.message || error);
            showError("등록증 다운로드에 실패했습니다.");
        }
    };

    return (
        <div className="flex h-screen bg-white overflow-hidden">
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-20 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            <div
                className={`fixed lg:static inset-y-0 left-0 z-30 w-[260px] max-w-[88vw] lg:max-w-none lg:w-[239px] h-screen shrink-0 transform transition-transform duration-300 ease-in-out ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
            >
                <Sidebar onClose={() => setSidebarOpen(false)} />
            </div>

            <div className="flex-1 flex flex-col h-screen overflow-hidden">
                <Header
                    title="차량 관리"
                    onMenuClick={() => setSidebarOpen(true)}
                    rightContent={
                        canManage ? (
                            <Button
                                variant="primary"
                                size={isMobile ? "md" : "lg"}
                                onClick={() => openEditModal()}
                            >
                                {!isMobile && <IconPlus />}
                                차량 추가
                            </Button>
                        ) : undefined
                    }
                />

                <div
                    className="flex-1 overflow-y-scroll px-4 md:px-10"
                    style={{ scrollbarGutter: "stable" }}
                >
                    <div className="py-6 md:py-9">
                        {!canManage && (
                            <div className="text-sm text-gray-500">
                                접근 권한이 없습니다.
                            </div>
                        )}

                        {loading && canManage && <div className="mb-3" />}

                        <div className="overflow-x-auto w-full">
                            {loading ? (
                                <VehiclesSkeleton />
                            ) : isMobile && canManage ? (
                                <>
                                    <ul className="flex flex-col gap-2">
                                        {pagedVehicles.length === 0 ? (
                                            <p className="py-10 text-center text-gray-500 text-sm rounded-2xl border border-dashed border-gray-200 bg-gray-50">
                                                등록된 차량이 없습니다.
                                            </p>
                                        ) : (
                                            pagedVehicles.map((row) => {
                                                const isExpanded = expandedVehicleId === row.id;
                                                return (
                                                    <li
                                                        key={row.id}
                                                        className="rounded-xl border border-gray-200 bg-white overflow-hidden"
                                                    >
                                                    <div
                                                        className="flex items-center justify-between gap-2 p-4"
                                                        onClick={() => setExpandedVehicleId((id) => (id === row.id ? null : row.id))}
                                                        role="button"
                                                        tabIndex={0}
                                                        onKeyDown={(e) => {
                                                            if (e.key === "Enter" || e.key === " ") {
                                                                e.preventDefault();
                                                                setExpandedVehicleId((id) => (id === row.id ? null : row.id));
                                                            }
                                                        }}
                                                        aria-expanded={isExpanded}
                                                    >
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-[13px] text-gray-500">{row.form.type || "—"}</p>
                                                            <p className="text-base font-semibold text-gray-900 mt-0.5">{row.form.plate || "—"}</p>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            className="p-2 rounded hover:bg-gray-100 text-gray-500 shrink-0 -mr-1 disabled:opacity-50"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setSelectedVehicleId(row.id);
                                                                setActionAnchor(e.currentTarget);
                                                                setActionOpen(true);
                                                            }}
                                                            aria-label="메뉴"
                                                            disabled={!canManage}
                                                        >
                                                            <IconMoreVertical className="w-5 h-5" />
                                                        </button>
                                                    </div>
                                                    {isExpanded && (
                                                        <div className="space-y-2 border-t border-gray-100 px-4 py-4">
                                                            {row.form.color && <VehicleDetailRow label="색상" value={row.form.color} />}
                                                            {row.form.primaryUser && <VehicleDetailRow label="주 사용자" value={row.form.primaryUser} />}
                                                            {(row.form.rentalStart || row.form.contractEnd) && (
                                                                <VehicleDetailRow
                                                                    label="대여"
                                                                    value={`${row.form.rentalStart || "—"} ~ ${row.form.contractEnd || "—"}`}
                                                                />
                                                            )}
                                                            {row.form.insurer && <VehicleDetailRow label="보험사" value={row.form.insurer} />}
                                                            {row.form.inspection && <VehicleDetailRow label="검사 만료일" value={row.form.inspection} />}
                                                            {row.form.engineOil && <VehicleDetailRow label="엔진오일 정비" value={row.form.engineOil} />}
                                                            {row.form.engineOilKm && <VehicleDetailRow label="정비 km" value={formatWithCommas(row.form.engineOilKm)} />}
                                                            {row.form.repair && <VehicleDetailRow label="기타수리" value={row.form.repair} />}
                                                        </div>
                                                    )}
                                                </li>
                                                );
                                            })
                                        )}
                                    </ul>
                                    {pageCount > 1 && (
                                        <div className="flex items-center justify-center gap-2 py-4">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                                disabled={page === 1}
                                            >
                                                이전
                                            </Button>
                                            <span className="text-sm text-gray-600">{page} / {pageCount}</span>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                                                disabled={page === pageCount}
                                            >
                                                다음
                                            </Button>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <Table
                                    className="min-w-[1250px]"
                                    columns={[
                                        {
                                            key: "type",
                                            label: renderSortLabel("차종", "type"),
                                            width: "100px",
                                            render: (_, row: VehicleRow) =>
                                                row.form.type ?? "",
                                        },
                                        {
                                            key: "plate",
                                            label: "차량번호",
                                            width: "120px",
                                            render: (_, row: VehicleRow) =>
                                                row.form.plate ?? "",
                                        },
                                        {
                                            key: "color",
                                            label: renderSortLabel("색상", "color"),
                                            width: "80px",
                                            render: (_, row: VehicleRow) =>
                                                row.form.color ?? "",
                                        },
                                        {
                                            key: "primaryUser",
                                            label: renderSortLabel(
                                                "주 사용자",
                                                "primaryUser"
                                            ),
                                            width: "100px",
                                            render: (_, row: VehicleRow) =>
                                                row.form.primaryUser ?? "",
                                        },
                                        {
                                            key: "rentalStart",
                                            label: renderSortLabel(
                                                "대여 개시일",
                                                "rentalStart"
                                            ),
                                            width: "110px",
                                            render: (_, row: VehicleRow) =>
                                                row.form.rentalStart ?? "",
                                        },
                                        {
                                            key: "contractEnd",
                                            label: renderSortLabel(
                                                "계약 만료일",
                                                "contractEnd"
                                            ),
                                            width: "110px",
                                            render: (_, row: VehicleRow) =>
                                                row.form.contractEnd ?? "",
                                        },
                                        {
                                            key: "insurer",
                                            label: renderSortLabel("보험사", "insurer"),
                                            width: "110px",
                                            render: (_, row: VehicleRow) =>
                                                row.form.insurer ?? "",
                                        },
                                        {
                                            key: "inspection",
                                            label: renderSortLabel("검사 만료일", "inspection"),
                                            width: "110px",
                                            render: (_, row: VehicleRow) =>
                                                row.form.inspection ?? "",
                                        },
                                        {
                                            key: "engineOil",
                                            label: renderSortLabel("엔진오일 정비", "engineOil"),
                                            width: "110px",
                                            render: (_, row: VehicleRow) =>
                                                row.form.engineOil ?? "",
                                        },
                                        {
                                            key: "engineOilKm",
                                            label: "정비 km",
                                            width: "100px",
                                            render: (_, row: VehicleRow) =>
                                                formatWithCommas(row.form.engineOilKm),
                                        },
                                        {
                                            key: "repair",
                                            label: "기타수리",
                                            width: "120px",
                                            render: (_, row: VehicleRow) =>
                                                row.form.repair ?? "",
                                        },
                                        {
                                            key: "actions",
                                            label: "",
                                            width: "60px",
                                            render: (_, row: VehicleRow) => (
                                                <button
                                                    className="w-8 h-8 rounded-lg hover:bg-gray-100 transition flex items-center justify-center text-gray-400"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedVehicleId(
                                                            row.id
                                                        );
                                                        setActionAnchor(
                                                            e.currentTarget
                                                        );
                                                        setActionOpen(true);
                                                    }}
                                                    aria-label="more"
                                                    disabled={!canManage}
                                                >
                                                    <IconMore className="w-5 h-5" />
                                                </button>
                                            ),
                                        },
                                    ]}
                                    data={canManage ? pagedVehicles : []}
                                    rowKey="id"
                                    emptyText="등록된 차량이 없습니다."
                                    pagination={{
                                        currentPage: page,
                                        totalPages: pageCount,
                                        onPageChange: setPage,
                                    }}
                                />
                            )}
                        </div>

                        <div className="h-8" />
                    </div>
                </div>
            </div>

            <ActionMenu
                isOpen={actionOpen}
                anchorEl={actionAnchor}
                onClose={() => {
                    setActionOpen(false);
                    setActionAnchor(null);
                }}
                onEdit={() => {
                    if (!selectedVehicle) return;
                    openEditModal(selectedVehicle);
                }}
                onDownload={handleDownloadRegistration}
                downloadLabel="자동차 등록증"
                onDelete={handleDelete}
                showDelete={true}
                width="w-44"
            />

            {editModalOpen && editForm && (
                <BaseModal
                    isOpen={editModalOpen}
                    onClose={() => setEditModalOpen(false)}
                    title={editMode === "create" ? "차량 추가" : "차량 정보 수정"}
                    maxWidth="max-w-2xl"
                    footer={
                        <div className="flex gap-2 w-full">
                            <Button
                                variant="outline"
                                size="lg"
                                fullWidth
                                onClick={() => setEditModalOpen(false)}
                            >
                                취소
                            </Button>
                            <Button
                                variant="primary"
                                size="lg"
                                fullWidth
                                onClick={handleSaveEdit}
                            >
                                {editMode === "create" ? "추가" : "저장"}
                            </Button>
                        </div>
                    }
                >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input
                            label="차종"
                            value={editForm.type}
                            onChange={(v) =>
                                setEditForm({ ...editForm, type: v })
                            }
                            placeholder="예) 소나타, 그랜저"
                        />
                        <Input
                            label="차량번호"
                            value={editForm.plate}
                            onChange={(v) =>
                                setEditForm({ ...editForm, plate: v })
                            }
                            placeholder="예) 12가 3456"
                        />
                        <Input
                            label="색상"
                            value={editForm.color}
                            onChange={(v) =>
                                setEditForm({ ...editForm, color: v })
                            }
                            placeholder="예) 흰색, 검정"
                        />
                        <Input
                            label="주 사용자"
                            value={editForm.primaryUser}
                            onChange={(v) =>
                                setEditForm({ ...editForm, primaryUser: v })
                            }
                            placeholder="예) 홍길동"
                        />
                        <DatePicker
                            label="대여 개시일"
                            value={editForm.rentalStart}
                            onChange={(v) =>
                                setEditForm({ ...editForm, rentalStart: v })
                            }
                            placeholder="연도-월-일"
                            minYear={2021}
                            maxYear={2035}
                        />
                        <DatePicker
                            label="계약 만료일"
                            value={editForm.contractEnd}
                            onChange={(v) =>
                                setEditForm({ ...editForm, contractEnd: v })
                            }
                            placeholder="연도-월-일"
                            minYear={2021}
                            maxYear={2035}
                        />
                        <Input
                            label="보험사"
                            value={editForm.insurer}
                            onChange={(v) =>
                                setEditForm({ ...editForm, insurer: v })
                            }
                            placeholder="예) 삼성화재, 현대해상"
                        />
                        <DatePicker
                            label="검사 만료일"
                            value={editForm.inspection}
                            onChange={(v) =>
                                setEditForm({ ...editForm, inspection: v })
                            }
                            placeholder="연도-월-일"
                            minYear={2021}
                            maxYear={2035}
                        />
                        <DatePicker
                            label="엔진오일 정비"
                            value={editForm.engineOil}
                            onChange={(v) =>
                                setEditForm({ ...editForm, engineOil: v })
                            }
                            placeholder="연도-월-일"
                            minYear={2021}
                            maxYear={2035}
                        />
                        <Input
                            label="엔진오일 정비 km"
                            value={formatWithCommas(editForm.engineOilKm)}
                            onChange={(v) =>
                                setEditForm({
                                    ...editForm,
                                    engineOilKm: onlyDigits(v),
                                })
                            }
                            placeholder="예) 120000"
                        />
                        <Input
                            label="기타수리"
                            value={editForm.repair}
                            onChange={(v) =>
                                setEditForm({ ...editForm, repair: v })
                            }
                            placeholder="예) 타이어 교체, 브레이크 패드"
                            className="md:col-span-2"
                        />
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                자동차 등록증
                            </label>
                            <input
                                type="file"
                                accept="image/*,application/pdf"
                                onChange={(e) =>
                                    setRegistrationFile(
                                        e.target.files?.[0] ?? null
                                    )
                                }
                                className="block w-full text-sm text-gray-700 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                            />
                            <div className="mt-1 text-[12px] text-gray-500">
                                {(() => {
                                    const name =
                                        registrationFile?.name ||
                                        editForm.registrationName ||
                                        (editForm.registrationPath
                                            ? editForm.registrationPath.split("/").pop() || editForm.registrationPath
                                            : null);
                                    return name ? `현재 파일: ${name}` : "현재 파일 없음";
                                })()}
                            </div>
                        </div>
                    </div>
                </BaseModal>
            )}

            <ConfirmDialog
                isOpen={deleteConfirmOpen}
                onClose={() => setDeleteConfirmOpen(false)}
                onConfirm={confirmDelete}
                title="차량 삭제"
                message="선택한 차량을 삭제하시겠습니까?"
                confirmText="삭제"
                cancelText="취소"
                confirmVariant="danger"
            />
        </div>
    );
}
