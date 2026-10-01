import { useState } from "react";
import BaseModal from "../../components/ui/BaseModal";
import Button from "../../components/common/Button";
import Chip from "../../components/ui/Chip";
import ImagePreviewModal from "../../components/ui/ImagePreviewModal";
import type { MaterialPurchaseDetail, MaterialPurchaseReceiptDetail } from "../../lib/materialPurchaseApi";

interface MaterialPurchaseDetailModalProps {
    isOpen: boolean;
    loading: boolean;
    detail: MaterialPurchaseDetail | null;
    canApprove: boolean;
    approving: boolean;
    onClose: () => void;
    onApprove: () => void;
    onRevoke: () => void;
}

function Field({ label, value }: { label: string; value: string }) {
    if (!value) return null;
    return (
        <div>
            <p className="text-xs text-gray-500">{label}</p>
            <p className="mt-1 text-sm text-gray-900 whitespace-pre-wrap break-words">{value}</p>
        </div>
    );
}

function receiptIsImage(receipt: MaterialPurchaseReceiptDetail) {
    return receipt.contentType.startsWith("image/");
}

export default function MaterialPurchaseDetailModal({
    isOpen,
    loading,
    detail,
    canApprove,
    approving,
    onClose,
    onApprove,
    onRevoke,
}: MaterialPurchaseDetailModalProps) {
    const [preview, setPreview] = useState<MaterialPurchaseReceiptDetail | null>(null);
    const costLabel = detail?.purchaseStatus === "confirmed" ? "비용" : "예상 비용";
    const showApprove = canApprove && detail?.approvalStatus === "pending";
    const showRevoke = canApprove && detail?.approvalStatus === "approved";

    const handleClose = () => {
        if (preview) {
            setPreview(null);
            return;
        }
        onClose();
    };

    return (
        <>
            <BaseModal
                isOpen={isOpen}
                onClose={handleClose}
                title="구매·가공 상세"
                maxWidth="max-w-[640px]"
                footer={
                    showApprove ? (
                        <Button variant="primary" size="lg" loading={approving} onClick={onApprove}>
                            승인
                        </Button>
                    ) : showRevoke ? (
                        <Button variant="outline" size="lg" loading={approving} onClick={onRevoke}>
                            승인 해제
                        </Button>
                    ) : undefined
                }
            >
                {loading || !detail ? (
                    <div className="py-10 text-center text-sm text-gray-500">불러오는 중...</div>
                ) : (
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-wrap items-center gap-2">
                            <Chip color={detail.kind === "personal" ? "purple-500" : "green-500"} variant="solid" size="md">
                                {detail.kind === "personal" ? "기타" : "작업 자재"}
                            </Chip>
                            <Chip color={detail.purchaseStatus === "confirmed" ? "blue-500" : "gray-500"} variant="solid" size="md">
                                {detail.purchaseStatus === "confirmed" ? "완료" : "예정"}
                            </Chip>
                            <Chip color={detail.approvalStatus === "approved" ? "green-500" : "gray-500"} variant="solid" size="md">
                                {detail.approvalStatus === "approved" ? "승인" : "미승인"}
                            </Chip>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <Field label="작성자" value={detail.author} />
                            <Field label="작성일" value={detail.createdAtLabel} />
                            <Field label="호선명" value={detail.vessel} />
                            <Field
                                label="참관감독"
                                value={[detail.orderGroupLabel, ...detail.orderPersons].filter(Boolean).join(" · ")}
                            />
                        </div>
                        <Field label="출장 목적" value={detail.tripPurpose} />

                        <div className="flex flex-col gap-3">
                            {detail.lines.map((line, index) => (
                                <div key={line.id} className="rounded-xl bg-gray-100 p-4 flex flex-col gap-3">
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm font-semibold text-gray-900">
                                            {line.materialName || `자재 ${index + 1}`}
                                        </p>
                                        {line.urgent && (
                                            <span className="shrink-0 rounded-lg border border-red-500 bg-red-500 px-2 py-0.5 text-xs font-medium text-white">
                                                긴급
                                            </span>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <Field label="구매처" value={line.vendor} />
                                        <Field label={costLabel} value={line.amountLabel} />
                                        <Field label="규격" value={line.spec} />
                                        <Field label="재질/Grade" value={line.grade} />
                                    </div>
                                    <Field label="비고" value={line.note} />
                                    {line.receipts.length > 0 && (
                                        <div className="flex flex-wrap gap-2">
                                            {line.receipts.map((receipt) => (
                                                <button
                                                    key={receipt.id}
                                                    type="button"
                                                    onClick={() => setPreview(receipt)}
                                                    className="w-16 h-16 rounded-lg overflow-hidden bg-white border border-gray-200"
                                                    aria-label={receipt.fileName}
                                                >
                                                    {receiptIsImage(receipt) ? (
                                                        <img src={receipt.url} alt={receipt.fileName} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <span className="flex h-full items-center justify-center text-xs text-gray-500">PDF</span>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </BaseModal>
            <ImagePreviewModal
                isOpen={preview != null}
                onClose={() => setPreview(null)}
                imageSrc={preview?.url ?? null}
                imageAlt={preview?.fileName}
                fileName={preview?.fileName}
                fileType={preview?.contentType}
                zIndex={10050}
            />
        </>
    );
}
