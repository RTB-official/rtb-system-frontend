import BaseModal from "./BaseModal";
import Button from "../common/Button";

interface ConfirmDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title?: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    confirmVariant?: "primary" | "danger" | "outline";
    isLoading?: boolean;
}

export default function ConfirmDialog({
    isOpen,
    onClose,
    onConfirm,
    title = "확인",
    message,
    confirmText = "확인",
    cancelText = "취소",
    confirmVariant = "primary",
    isLoading = false,
}: ConfirmDialogProps) {
    const handleConfirm = () => {
        onConfirm();
    };

    // 취소 버튼이면 자동으로 danger variant 사용 (삭제/취소 액션인 경우)
    const finalVariant = (confirmText === "삭제" || (confirmText === "취소" && title?.includes("취소")))
        ? "danger"
        : confirmVariant;

    return (
        <BaseModal
            isOpen={isOpen}
            onClose={onClose}
            title={title}
            showCloseButton={false}
            footer={
                <div className="flex gap-2 w-full">
                    <Button
                        variant="outline"
                        size="lg"
                        onClick={onClose}
                        disabled={isLoading}
                        fullWidth
                    >
                        {cancelText}
                    </Button>
                    <Button
                        variant={finalVariant}
                        size="lg"
                        onClick={handleConfirm}
                        disabled={isLoading}
                        fullWidth
                    >
                        {isLoading ? "처리 중..." : confirmText}
                    </Button>
                </div>
            }
        >
            <p className="text-gray-700 whitespace-pre-line">{message}</p>
        </BaseModal>
    );
}
