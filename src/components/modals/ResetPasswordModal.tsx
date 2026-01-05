import { useEffect, useState } from "react";
import Input from "../common/Input";

type Props = {
    isOpen: boolean;
    memberName?: string;
    onClose: () => void;
    onSubmit?: (payload: { newPassword: string; confirmPassword: string }) => void;
};

function IconClose() {
    return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path
                d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41Z"
                fill="currentColor"
            />
        </svg>
    );
}

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

    // 모달 열릴 때 바디 스크롤 잠금
    useEffect(() => {
        if (!isOpen) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = prev;
        };
    }, [isOpen]);

    // ESC 닫기
    useEffect(() => {
        if (!isOpen) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                handleClose();
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [isOpen]);

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

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50">
            {/* Overlay */}
            <div className="absolute inset-0 bg-black/40" onClick={handleClose} />

            {/* Modal */}
            <div className="absolute inset-0 flex items-center justify-center p-4">
                <div className="w-full max-w-[480px] bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
                    {/* Header */}
                    <div className="px-6 py-5 flex items-center justify-between border-b border-gray-200">
                        <h2 className="text-[20px] font-semibold text-gray-900">
                            비밀번호 재설정
                        </h2>
                        <button
                            onClick={handleClose}
                            className="w-9 h-9 rounded-xl hover:bg-gray-100 text-gray-700 flex items-center justify-center transition-colors"
                            aria-label="close"
                        >
                            <IconClose />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="px-6 py-6">
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
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
                        <button
                            onClick={handleClose}
                            className="flex-1 h-11 rounded-xl border border-gray-300 text-gray-700 text-[14px] font-medium hover:bg-gray-50 transition-colors"
                        >
                            취소
                        </button>
                        <button
                            onClick={handleSubmit}
                            className="flex-1 h-11 rounded-xl bg-gray-900 text-white text-[14px] font-medium hover:opacity-90 transition-opacity"
                        >
                            재설정
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

