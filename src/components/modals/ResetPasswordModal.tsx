import { useState } from "react";
import BaseModal from "../ui/BaseModal";
import Button from "../common/Button";
import Input from "../common/Input";
type Props = {
    isOpen: boolean;
    memberName?: string;
    onClose: () => void;
    onSubmit?: (payload: {
        newPassword: string;
        confirmPassword: string;
    }) => void;
};

export default function ResetPasswordModal({
    isOpen,
    memberName,
    onClose,
    onSubmit,
}: Props) {
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [errors, setErrors] = useState<{
        newPassword?: string;
        confirmPassword?: string;
    }>({});

    // 모달 닫을 때 상태 초기화
    const handleClose = () => {
        setNewPassword("");
        setConfirmPassword("");
        setErrors({});
        onClose();
    };

    const validate = () => {
        const newErrors: {
            newPassword?: string;
            confirmPassword?: string;
        } = {};

        if (!newPassword) {
            newErrors.newPassword = "새 비밀번호를 입력해주세요.";
        } else if (newPassword.length < 4) {
            newErrors.newPassword = "비밀번호는 최소 4자 이상이어야 합니다.";
        }

        if (!confirmPassword) {
            newErrors.confirmPassword = "비밀번호 확인을 입력해주세요.";
        } else if (newPassword !== confirmPassword) {
            newErrors.confirmPassword = "비밀번호가 일치하지 않습니다.";
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = () => {
        if (!validate()) return;

        onSubmit?.({
            newPassword,
            confirmPassword,
        });
        handleClose();
    };

    return (
        <BaseModal
            isOpen={isOpen}
            onClose={handleClose}
            title="비밀번호 재설정"
            maxWidth="max-w-md"
            footer={
                <div className="flex gap-2 w-full">
                    <Button
                        variant="outline"
                        size="lg"
                        fullWidth
                        onClick={handleClose}
                    >
                        취소
                    </Button>
                    <Button
                        variant="primary"
                        size="lg"
                        fullWidth
                        onClick={handleSubmit}
                    >
                        재설정
                    </Button>
                </div>
            }
        >
            {memberName && (
                <div className="mb-6 text-sm text-gray-600">
                    <span className="font-medium text-gray-900">
                        {memberName}
                    </span>
                    님의 비밀번호를 재설정합니다.
                </div>
            )}

            <div className="space-y-4">
                {/* 새 비밀번호 */}
                <Input
                    label="새 비밀번호"
                    type="password"
                    value={newPassword}
                    onChange={setNewPassword}
                    placeholder="새 비밀번호를 입력하세요"
                    required
                    error={errors.newPassword}
                    className="w-full"
                />

                {/* 비밀번호 확인 */}
                <Input
                    label="비밀번호 확인"
                    type="password"
                    value={confirmPassword}
                    onChange={setConfirmPassword}
                    placeholder="비밀번호를 다시 입력하세요"
                    required
                    error={errors.confirmPassword}
                    className="w-full"
                />
            </div>
        </BaseModal>
    );
}
