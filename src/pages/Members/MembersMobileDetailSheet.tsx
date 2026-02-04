import Avatar from "../../components/common/Avatar";
import Chip from "../../components/ui/Chip";
import { IconClose, IconDownload } from "../../components/icons/Icons";
import MiniIconButton from "../../components/ui/MiniIconButton";
import EmptyValueIndicator from "../../pages/Expense/components/EmptyValueIndicator";
import type { Member } from "./types";
import { formatPassportExpiry } from "./utils";

interface MembersMobileDetailSheetProps {
    member: Member;
    onClose: () => void;
    onEdit: () => void;
    onResetPassword: () => void;
    onDelete: () => void;
    isAdmin: boolean;
    myUserId: string | null;
    isStaff: boolean;
    downloadStorageFile: (bucket: string, path: string, fileName: string) => Promise<void>;
    showError: (msg: string) => void;
}

export default function MembersMobileDetailSheet({
    member: row,
    onClose,
    onEdit,
    onResetPassword,
    onDelete,
    isAdmin,
    myUserId,
    isStaff,
    downloadStorageFile,
    showError,
}: MembersMobileDetailSheetProps) {
    const canDownload = isAdmin || row.id === myUserId;
    const hasPhoto = !!row.profilePhotoBucket && !!row.profilePhotoPath;
    const hasAddress1 = !!row.address1;
    const hasAddress2 = !!row.address2;
    const primaryAddress = row.address1 || row.address2 || "";
    const hasPassportNo = !!row.passportNo;
    const hasPassportName = !!(row.passportLastName || row.passportFirstName);
    const hasExpiry = !!row.passportExpiry;
    const hasPassportPhoto = !!row.passportPhotoBucket && !!row.passportPhotoPath;
    const hasAnyPassportInfo = hasPassportNo || hasPassportName || hasExpiry || hasPassportPhoto;
    const { formatted: formattedExpiry, isWithinYear } = formatPassportExpiry(row.passportExpiry, row.passportExpiryISO);
    const passportName = `${row.passportLastName || ""} ${row.passportFirstName || ""}`.trim();

    return (
        <div className="md:hidden fixed inset-0 z-50 bg-white flex flex-col">
            <header className="shrink-0 flex items-center justify-between px-4 py-4 border-b border-gray-200">
                <h2 className="text-[20px] font-semibold text-gray-900">프로필 상세</h2>
                <button
                    type="button"
                    className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600"
                    onClick={onClose}
                    aria-label="닫기"
                >
                    <IconClose className="w-5 h-5" />
                </button>
            </header>
            <div className="flex-1 overflow-y-auto px-4 py-4" style={{ scrollbarGutter: "stable" }}>
                <div className="flex items-center gap-4 pb-4 border-b border-gray-100">
                    <Avatar email={row.avatarEmail} size={56} position={row.role} />
                    <div className="min-w-0">
                        <div className="text-[18px] font-semibold text-gray-900">{row.name || <EmptyValueIndicator />}</div>
                        <div className="text-[14px] text-gray-500 mt-0.5">{row.role || "—"}</div>
                        {(row.username || (isStaff && row.id === myUserId)) && (
                            <div className="text-[13px] text-gray-400 mt-0.5">{row.username || <EmptyValueIndicator />}</div>
                        )}
                    </div>
                </div>
                <div className="mt-4 space-y-3 text-[14px]">
                    <div className="border border-gray-100 rounded-xl p-4">
                        <div className="text-[13px] font-semibold text-gray-700 mb-3">기본 정보</div>
                        <dl className="space-y-2">
                            <div className="flex gap-3">
                                <dt className="text-gray-500 w-20 shrink-0">직급</dt>
                                <dd className="text-gray-900">{row.role || <EmptyValueIndicator />}</dd>
                            </div>
                            <div className="flex gap-3">
                                <dt className="text-gray-500 w-20 shrink-0">전화</dt>
                                <dd className="text-gray-900 break-all">{row.phone || <EmptyValueIndicator />}</dd>
                            </div>
                            <div className="flex gap-3">
                                <dt className="text-gray-500 w-20 shrink-0">주소</dt>
                                <dd className="text-gray-900 min-w-0">{(hasAddress1 || hasAddress2) ? primaryAddress : <EmptyValueIndicator />}</dd>
                            </div>
                        </dl>
                    </div>

                    <div className="border border-gray-100 rounded-xl p-4">
                        <div className="text-[13px] font-semibold text-gray-700 mb-3">날짜 정보</div>
                        <dl className="space-y-2">
                            <div className="flex gap-3">
                                <dt className="text-gray-500 w-20 shrink-0">입사일</dt>
                                <dd className="text-gray-900">{row.joinDate || <EmptyValueIndicator />}</dd>
                            </div>
                            <div className="flex gap-3">
                                <dt className="text-gray-500 w-20 shrink-0">생년월일</dt>
                                <dd className="text-gray-900">{row.birth || <EmptyValueIndicator />}</dd>
                            </div>
                        </dl>
                    </div>

                    {hasAnyPassportInfo && (
                        <div className="border border-gray-100 rounded-xl p-4">
                            <div className="text-[13px] font-semibold text-gray-700 mb-3">여권 정보</div>
                            <dl>
                                <div className="flex gap-3">
                                    <dt className="text-gray-500 w-20 shrink-0">여권</dt>
                                    <dd className="text-gray-900 min-w-0 flex flex-wrap items-center gap-2">
                                        {hasPassportNo && <span className="font-medium">{row.passportNo}</span>}
                                        {formattedExpiry && (
                                            <Chip color={isWithinYear ? "red-600" : "gray-400"} variant="solid" size="sm">
                                                {formattedExpiry}
                                            </Chip>
                                        )}
                                        {passportName && <span className="text-gray-500 text-[12px] uppercase">{passportName}</span>}
                                        {canDownload && hasPassportPhoto && (
                                            <MiniIconButton
                                                onClick={async (e) => {
                                                    e.stopPropagation();
                                                    try {
                                                        await downloadStorageFile(row.passportPhotoBucket, row.passportPhotoPath, row.passportPhotoName || "passport-photo");
                                                    } catch (err: any) {
                                                        showError(err?.message || "여권사진 다운로드 실패");
                                                    }
                                                }}
                                                title="여권사진 다운로드"
                                                icon={<IconDownload className="w-3.5 h-3.5" />}
                                            />
                                        )}
                                    </dd>
                                </div>
                            </dl>
                        </div>
                    )}

                    {canDownload && hasPhoto && (
                        <div className="border border-gray-100 rounded-xl p-4">
                            <div className="text-[13px] font-semibold text-gray-700 mb-3">파일</div>
                            <div className="flex items-center gap-3">
                                <span className="text-[14px] text-gray-700">증명사진</span>
                                <button
                                    type="button"
                                    className="ml-auto inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-900 text-white text-[12px] font-medium"
                                    onClick={async () => {
                                        try {
                                            await downloadStorageFile(
                                                row.profilePhotoBucket,
                                                row.profilePhotoPath,
                                                row.profilePhotoName || "profile-photo"
                                            );
                                        } catch (err: any) {
                                            showError(err?.message || "증명사진 다운로드 실패");
                                        }
                                    }}
                                >
                                    <IconDownload className="w-3.5 h-3.5" />
                                    다운로드
                                </button>
                            </div>
                        </div>
                    )}
                </div>
                <div className="mt-6 pt-4 border-t border-gray-100 flex flex-col gap-2">
                    {(isAdmin || row.id === myUserId) && (
                        <button type="button" className="w-full py-3 rounded-xl bg-gray-100 text-gray-900 font-medium text-[15px]" onClick={onEdit}>
                            수정
                        </button>
                    )}
                    {(isAdmin || row.id === myUserId) && (
                        <button type="button" className="w-full py-3 rounded-xl bg-gray-100 text-gray-900 font-medium text-[15px]" onClick={onResetPassword}>
                            비밀번호 재설정
                        </button>
                    )}
                    {isAdmin && (
                        <button type="button" className="w-full py-3 rounded-xl bg-red-50 text-red-600 font-medium text-[15px]" onClick={onDelete}>
                            삭제
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
