import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Button from "../../../components/common/Button";
import Chip from "../../../components/ui/Chip";
import ConfirmDialog from "../../../components/ui/ConfirmDialog";
import { IconClose } from "../../../components/icons/Icons";
import { useToast } from "../../../components/ui/ToastProvider";
import { useAuth } from "../../../store/auth";
import {
    createInventoryItem,
    deleteInventoryItem,
    fetchInventoryItemDetail,
    flattenInventoryCategories,
    inventoryStatusLabel,
    isInventoryQuantityFormField,
    resolveInventoryCategoryFormButtonGroups,
    resolveInventoryCategoryFormFields,
    updateInventoryItem,
    type InventoryCategory,
    type InventoryItemDetail,
    type InventoryLocation,
} from "../../../lib/inventoryApi";
import InventoryItemForm, {
    createEmptyInventoryItemFormValues,
    type InventoryItemFormValues,
} from "./InventoryItemForm";

interface InventoryItemSidePanelProps {
    /** 상세/수정: 아이템 id. 등록 모드일 때는 null */
    itemId: string | null;
    /** true면 등록 사이드패널 오픈 */
    createMode: boolean;
    categories: InventoryCategory[];
    locations: InventoryLocation[];
    isAdmin: boolean;
    onClose: () => void;
    onChanged: () => void;
}

function detailToFormValues(detail: InventoryItemDetail): InventoryItemFormValues {
    return {
        name: detail.name,
        spec: detail.spec,
        categoryId: detail.categoryId ?? "",
        unit: detail.unit,
        minQuantity: String(detail.minQuantity),
        note: detail.note,
        fieldValues: { ...detail.formData.fieldValues },
        activeButtonIds: [...detail.formData.activeButtonIds],
        stocks:
            detail.stocks.length > 0
                ? detail.stocks.map((s) => ({
                      key: s.id,
                      id: s.id,
                      locationId: s.locationId ?? "",
                      slotCode: s.slotCode,
                      quantity: String(s.quantity),
                  }))
                : [
                      {
                          key: `new-${Date.now()}`,
                          locationId: "",
                          slotCode: "",
                          quantity: "0",
                      },
                  ],
        newPhotos: [],
        newPreviews: [],
        existingPhotos: detail.photos.map((p) => ({ id: p.id, url: p.url })),
        removePhotoIds: [],
    };
}

function revokePreviews(values: InventoryItemFormValues) {
    values.newPreviews.forEach((url) => URL.revokeObjectURL(url));
}

export default function InventoryItemSidePanel({
    itemId,
    createMode,
    categories,
    locations,
    isAdmin,
    onClose,
    onChanged,
}: InventoryItemSidePanelProps) {
    const { user } = useAuth();
    const { showError, showSuccess } = useToast();
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [detail, setDetail] = useState<InventoryItemDetail | null>(null);
    const [editing, setEditing] = useState(false);
    const [form, setForm] = useState<InventoryItemFormValues>(
        createEmptyInventoryItemFormValues
    );
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const isOpen = createMode || !!itemId;
    const isCreate = createMode;
    const canDelete =
        !!detail && (isAdmin || (!!user?.id && detail.createdBy === user.id));

    useEffect(() => {
        if (createMode) {
            setDetail(null);
            setEditing(true);
            setForm(createEmptyInventoryItemFormValues());
            setLoading(false);
            return;
        }
        if (!itemId) {
            setDetail(null);
            setEditing(false);
            return;
        }
        let cancelled = false;
        setLoading(true);
        setEditing(false);
        fetchInventoryItemDetail(itemId)
            .then((next) => {
                if (cancelled) return;
                setDetail(next);
            })
            .catch((error) => {
                if (cancelled) return;
                showError(error instanceof Error ? error.message : "상세를 불러오지 못했습니다.");
                onClose();
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [itemId, createMode, onClose, showError]);

    useEffect(() => {
        return () => {
            revokePreviews(form);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps -- unmount cleanup only
    }, []);

    const startEdit = () => {
        if (!detail) return;
        revokePreviews(form);
        setForm(detailToFormValues(detail));
        setEditing(true);
    };

    const cancelEdit = () => {
        revokePreviews(form);
        if (isCreate) {
            setForm(createEmptyInventoryItemFormValues());
            onClose();
            return;
        }
        setForm(createEmptyInventoryItemFormValues());
        setEditing(false);
    };

    const handleFormChange = (next: InventoryItemFormValues) => {
        setForm(next);
    };

    const save = async () => {
        if (!form.name.trim()) {
            showError("자재명을 입력해 주세요.");
            return;
        }
        for (const stock of form.stocks) {
            const qty = Number(stock.quantity.replace(/,/g, ""));
            if (!Number.isFinite(qty) || qty < 0) {
                showError("수량을 확인해 주세요.");
                return;
            }
        }

        setSaving(true);
        try {
            if (isCreate) {
                await createInventoryItem({
                    name: form.name,
                    spec: form.spec,
                    categoryId: form.categoryId || null,
                    unit: form.unit,
                    minQuantity: Number(form.minQuantity) || 0,
                    note: form.note,
                    formData: {
                        fieldValues: form.fieldValues,
                        activeButtonIds: form.activeButtonIds,
                    },
                    stocks: form.stocks.map((s) => ({
                        locationId: s.locationId || null,
                        slotCode: s.slotCode,
                        quantity: Number(s.quantity.replace(/,/g, "")) || 0,
                    })),
                    photos: form.newPhotos,
                });
                showSuccess("자재가 등록되었습니다.");
                revokePreviews(form);
                setForm(createEmptyInventoryItemFormValues());
                onChanged();
                onClose();
                return;
            }

            if (!detail) return;
            await updateInventoryItem(detail.id, {
                name: form.name,
                spec: form.spec,
                categoryId: form.categoryId || null,
                unit: form.unit,
                minQuantity: Number(form.minQuantity) || 0,
                note: form.note,
                formData: {
                    fieldValues: form.fieldValues,
                    activeButtonIds: form.activeButtonIds,
                },
                stocks: form.stocks.map((s) => ({
                    id: s.id,
                    locationId: s.locationId || null,
                    slotCode: s.slotCode,
                    quantity: Number(s.quantity.replace(/,/g, "")) || 0,
                })),
                newPhotos: form.newPhotos,
                removePhotoIds: form.removePhotoIds,
            });
            const refreshed = await fetchInventoryItemDetail(detail.id);
            revokePreviews(form);
            setDetail(refreshed);
            setForm(createEmptyInventoryItemFormValues());
            setEditing(false);
            showSuccess("저장되었습니다.");
            onChanged();
        } catch (error) {
            showError(
                error instanceof Error
                    ? error.message
                    : isCreate
                      ? "등록에 실패했습니다."
                      : "저장에 실패했습니다."
            );
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!detail) return;
        setDeleting(true);
        try {
            await deleteInventoryItem(detail.id);
            showSuccess("삭제되었습니다.");
            setDeleteOpen(false);
            onChanged();
            onClose();
        } catch (error) {
            showError(error instanceof Error ? error.message : "삭제에 실패했습니다.");
        } finally {
            setDeleting(false);
        }
    };

    const status = detail ? inventoryStatusLabel(detail.status) : null;
    const title = isCreate
        ? "자재 등록"
        : detail?.name || "자재 상세";
    const showForm = isCreate || editing;
    const detailCategory = detail?.categoryId
        ? flattenInventoryCategories(categories).find((c) => c.id === detail.categoryId) ??
          null
        : null;
    const detailFields = resolveInventoryCategoryFormFields(
        detailCategory,
        categories
    );
    const detailButtonGroups = resolveInventoryCategoryFormButtonGroups(
        detailCategory,
        categories
    );

    return createPortal(
        <>
            <button
                type="button"
                className={`fixed inset-0 z-[90] bg-black/30 transition-opacity duration-300 ease-in-out ${
                    isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
                }`}
                aria-label="닫기"
                aria-hidden={!isOpen}
                tabIndex={isOpen ? 0 : -1}
                onClick={() => {
                    if (saving || (!isCreate && editing) || !isOpen) return;
                    onClose();
                }}
            />
            <aside
                className={`fixed inset-y-0 right-0 z-[91] w-full sm:w-[480px] md:w-[560px] bg-white shadow-xl flex flex-col border-l border-gray-200 transition-transform duration-300 ease-in-out ${
                    isOpen
                        ? "translate-x-0"
                        : "translate-x-full pointer-events-none"
                }`}
                aria-hidden={!isOpen}
            >
                <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-4 py-4 sm:px-6">
                    <div className="min-w-0">
                        <h2 className="text-lg font-semibold text-gray-900 truncate">
                            {title}
                        </h2>
                        {!isCreate && status && (
                            <div className="mt-1">
                                <Chip color={status.color} variant="solid" size="sm">
                                    {status.label}
                                </Chip>
                            </div>
                        )}
                    </div>
                    <button
                        type="button"
                        className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
                        onClick={() => {
                            if (saving) return;
                            if (showForm) cancelEdit();
                            else onClose();
                        }}
                    >
                        <IconClose className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
                    {!isCreate && (loading || !detail) ? (
                        <div className="text-gray-400 py-10 text-center">불러오는 중...</div>
                    ) : showForm ? (
                        <InventoryItemForm
                            values={form}
                            onChange={handleFormChange}
                            categories={categories}
                            locations={locations}
                            disabled={saving}
                        />
                    ) : detail ? (
                        <div className="flex flex-col gap-5">
                            {detail.photos.length > 0 ? (
                                <div className="grid grid-cols-2 gap-2">
                                    {detail.photos.map((photo) => (
                                        <img
                                            key={photo.id}
                                            src={photo.url}
                                            alt=""
                                            className="w-full aspect-square rounded-xl object-cover bg-gray-50"
                                        />
                                    ))}
                                </div>
                            ) : (
                                <div className="rounded-xl bg-gray-50 py-10 text-center text-sm text-gray-400">
                                    등록된 사진이 없습니다.
                                </div>
                            )}
                            <dl className="grid grid-cols-1 gap-3 text-sm">
                                <div>
                                    <dt className="text-gray-500">카테고리</dt>
                                    <dd className="mt-1 font-medium text-gray-900">
                                        {detailCategory?.pathLabel ||
                                            detail.categoryName ||
                                            "미분류"}
                                    </dd>
                                </div>
                                {detailFields.length > 0 && (
                                    <div className="flex flex-col gap-2">
                                        <dt className="text-gray-500">입력란</dt>
                                        {detailFields.map((field) => {
                                            const isQty =
                                                isInventoryQuantityFormField(field);
                                            const raw = isQty
                                                ? detail.formData.fieldValues[field.id]
                                                      ?.trim() ||
                                                  String(detail.totalQuantity)
                                                : detail.formData.fieldValues[
                                                      field.id
                                                  ]?.trim() || "";
                                            const value = raw || "—";
                                            const unit = isQty
                                                ? detail.unit || field.unit
                                                : field.unit;
                                            return (
                                                <dd
                                                    key={field.id}
                                                    className="rounded-xl border border-gray-100 px-3 py-2 flex justify-between gap-2"
                                                >
                                                    <span className="text-gray-600">
                                                        {field.label}
                                                    </span>
                                                    <span className="font-medium text-gray-900 shrink-0">
                                                        {value}
                                                        {unit && value !== "—"
                                                            ? ` ${unit}`
                                                            : ""}
                                                    </span>
                                                </dd>
                                            );
                                        })}
                                    </div>
                                )}
                                {detailButtonGroups.map((group) =>
                                    group.buttons.length === 0 ? null : (
                                        <div key={group.id}>
                                            <dt className="text-gray-500 mb-2">
                                                {group.name}
                                            </dt>
                                            <dd className="flex flex-wrap gap-1.5">
                                                {group.buttons.map((btn) => {
                                                    const active =
                                                        detail.formData.activeButtonIds.includes(
                                                            btn.id
                                                        );
                                                    return (
                                                        <Chip
                                                            key={btn.id}
                                                            color={
                                                                active
                                                                    ? "blue-600"
                                                                    : "gray-400"
                                                            }
                                                            variant={
                                                                active ? "filled" : "outline"
                                                            }
                                                            size="sm"
                                                        >
                                                            {btn.label}
                                                        </Chip>
                                                    );
                                                })}
                                            </dd>
                                        </div>
                                    )
                                )}
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <dt className="text-gray-500">총 수량</dt>
                                        <dd className="mt-1 font-medium text-gray-900">
                                            {detail.totalQuantity} {detail.unit}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt className="text-gray-500">최소 수량</dt>
                                        <dd className="mt-1 font-medium text-gray-900">
                                            {detail.minQuantity}
                                        </dd>
                                    </div>
                                </div>
                                <div>
                                    <dt className="text-gray-500 mb-2">보관 위치</dt>
                                    <dd className="flex flex-col gap-2">
                                        {detail.stocks.length === 0 ? (
                                            <span className="font-medium text-gray-900">
                                                위치 미지정
                                            </span>
                                        ) : (
                                            detail.stocks.map((stock) => (
                                                <div
                                                    key={stock.id}
                                                    className="rounded-xl border border-gray-100 px-3 py-2 flex justify-between gap-2"
                                                >
                                                    <span className="text-gray-800">
                                                        {stock.locationName || "위치 미지정"}
                                                        {stock.slotCode
                                                            ? ` · ${stock.slotCode}`
                                                            : ""}
                                                    </span>
                                                    <span className="font-medium text-gray-900 shrink-0">
                                                        {stock.quantity} {detail.unit}
                                                    </span>
                                                </div>
                                            ))
                                        )}
                                    </dd>
                                </div>
                                {detail.note ? (
                                    <div>
                                        <dt className="text-gray-500">비고</dt>
                                        <dd className="mt-1 text-gray-900 whitespace-pre-wrap">
                                            {detail.note}
                                        </dd>
                                    </div>
                                ) : null}
                                <div>
                                    <dt className="text-gray-500">최근 수정일</dt>
                                    <dd className="mt-1 text-gray-900">{detail.updatedAtLabel}</dd>
                                </div>
                            </dl>
                        </div>
                    ) : null}
                </div>

                <div className="border-t border-gray-200 px-4 py-4 sm:px-6 flex flex-wrap gap-2 justify-end">
                    {showForm ? (
                        <>
                            <Button
                                variant="outline"
                                size="lg"
                                disabled={saving}
                                onClick={cancelEdit}
                            >
                                취소
                            </Button>
                            <Button
                                variant="primary"
                                size="lg"
                                loading={saving}
                                onClick={() => void save()}
                            >
                                {isCreate ? "등록" : "저장"}
                            </Button>
                        </>
                    ) : (
                        <>
                            {canDelete && (
                                <Button
                                    variant="outline"
                                    size="lg"
                                    className="text-red-600! border-red-200!"
                                    onClick={() => setDeleteOpen(true)}
                                >
                                    삭제
                                </Button>
                            )}
                            <Button variant="primary" size="lg" onClick={startEdit}>
                                수정
                            </Button>
                        </>
                    )}
                </div>
            </aside>

            <ConfirmDialog
                isOpen={deleteOpen}
                onClose={() => {
                    if (deleting) return;
                    setDeleteOpen(false);
                }}
                onConfirm={handleDelete}
                title="삭제 확인"
                message="이 자재를 삭제하시겠습니까?"
                confirmText="삭제"
                cancelText="취소"
                confirmVariant="danger"
                isLoading={deleting}
            />
        </>,
        document.body
    );
}
