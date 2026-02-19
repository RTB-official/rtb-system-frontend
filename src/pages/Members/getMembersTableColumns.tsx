import type { TableColumn } from "../../components/common/Table";
import Avatar from "../../components/common/Avatar";
import Chip from "../../components/ui/Chip";
import { IconDownload, IconMore } from "../../components/icons/Icons";
import EmptyValueIndicator from "../../pages/Expense/components/EmptyValueIndicator";
import MiniIconButton from "../../components/ui/MiniIconButton";
import type { Member } from "./types";
import { formatPassportExpiry } from "./utils";

export interface MembersTableColumnOpts {
    isAdmin: boolean;
    myUserId: string | null;
    isStaff: boolean;
    downloadStorageFile: (bucket: string, path: string, fileName: string) => Promise<void>;
    showError: (msg: string) => void;
    setSelectedMemberId: (id: string | null) => void;
    setActionAnchor: (el: HTMLElement | null) => void;
    setActionOpen: (open: boolean) => void;
}

export function getMembersTableColumns(opts: MembersTableColumnOpts): TableColumn<Member>[] {
    const {
        isAdmin,
        myUserId,
        isStaff,
        downloadStorageFile,
        showError,
        setSelectedMemberId,
        setActionAnchor,
        setActionOpen,
    } = opts;

    return [
        {
            key: "name",
            label: "이름",
            width: "11%",
            render: (_, row) => {
                const canDownload = isAdmin || row.id === myUserId;
                const hasPhoto = !!row.profilePhotoBucket && !!row.profilePhotoPath;
                return (
                    <div className="relative group flex items-center gap-3">
                        <Avatar email={row.avatarEmail} size={24} position={row.role} />
                        <div className="leading-tight">
                            <div className="text-[14px] font-semibold text-gray-900">
                                {row.name ? row.name : <EmptyValueIndicator />}
                            </div>
                            <div className="text-[12px] text-gray-500">
                                {row.username ? row.username : isStaff && row.id !== myUserId ? null : <EmptyValueIndicator />}
                            </div>
                        </div>
                        {canDownload && hasPhoto && (
                            <MiniIconButton
                                onClick={async (e) => {
                                    e.stopPropagation();
                                    try {
                                        await downloadStorageFile(row.profilePhotoBucket, row.profilePhotoPath, row.profilePhotoName || "profile-photo");
                                    } catch (error: any) {
                                        showError(error?.message || "증명사진 다운로드 실패");
                                    }
                                }}
                                title="증명사진 다운로드"
                                icon={<IconDownload className="w-3.5 h-3.5" />}
                                className="-ml-1"
                            />
                        )}
                    </div>
                );
            },
        },
        {
            key: "role",
            label: "직급",
            width: "6%",
            render: (value) => (
                <div className="text-[14px] text-gray-900 w-[60px] min-w-[60px]">
                    {value ? <span>{value}</span> : <EmptyValueIndicator />}
                </div>
            ),
        },
        {
            key: "phone",
            label: "전화번호",
            width: "10%",
            render: (value) => (
                <div className="text-[14px] text-gray-900 w-[140px] min-w-[140px]">
                    {value ? <span>{value}</span> : <EmptyValueIndicator />}
                </div>
            ),
        },
        {
            key: "address",
            label: "주소",
            width: "30%",
            render: (_, row) => {
                const hasAddress1 = !!row.address1;
                const hasAddress2 = !!row.address2;
                if (!hasAddress1 && !hasAddress2) return <EmptyValueIndicator />;
                const primaryAddress = row.address1 || row.address2 || "";
                return (
                    <div className="text-[14px] text-gray-900 w-full max-w-[520px]">
                        <div className="truncate whitespace-nowrap">{primaryAddress}</div>
                        {hasAddress1 && hasAddress2 && (
                            <div className="text-[12px] text-gray-500 mt-1 truncate whitespace-nowrap">{row.address2}</div>
                        )}
                    </div>
                );
            },
        },
        {
            key: "joinDate",
            label: "입사일",
            width: "8%",
            render: (value) => (
                <div className="text-[14px] text-gray-900 w-[90px] min-w-[90px]">
                    {value ? <span>{value}</span> : <EmptyValueIndicator />}
                </div>
            ),
        },
        {
            key: "birth",
            label: "생년월일",
            width: "8%",
            render: (value) => (
                <div className="text-[14px] text-gray-900 w-[90px] min-w-[90px]">
                    {value ? <span>{value}</span> : <EmptyValueIndicator />}
                </div>
            ),
        },
        {
            key: "etc",
            label: "여권정보",
            width: "10%",
            render: (_, row) => {
                const hasPassportNo = !!row.passportNo;
                const hasPassportName = !!(row.passportLastName || row.passportFirstName);
                const hasExpiry = !!row.passportExpiry;
                const hasPassportPhoto = !!row.passportPhotoBucket && !!row.passportPhotoPath;
                const hasAnyPassportInfo = hasPassportNo || hasPassportName || hasExpiry || hasPassportPhoto;
                const canDownload = isAdmin || row.id === myUserId;

                if (!hasAnyPassportInfo) {
                    return (
                        <div className="flex items-start pr-2 w-[260px] min-w-[260px]">
                            <div className="flex-1 min-w-0">
                                <EmptyValueIndicator />
                            </div>
                            {(isAdmin || row.id === myUserId) && (
                                <button
                                    className="flex-none w-8 h-8 rounded-lg hover:bg-gray-100 transition flex items-center justify-center text-gray-400"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedMemberId(row.id);
                                        setActionAnchor(e.currentTarget);
                                        setActionOpen(true);
                                    }}
                                    aria-label="more"
                                >
                                    <IconMore className="w-5 h-5" />
                                </button>
                            )}
                        </div>
                    );
                }

                const { formatted: formattedExpiry, isWithinYear } = formatPassportExpiry(row.passportExpiry, row.passportExpiryISO);
                const passportName = `${row.passportLastName || ""} ${row.passportFirstName || ""}`.trim();

                return (
                    <div className="relative group flex items-start pr-2 w-[260px] min-w-[260px]">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                {hasPassportNo && (
                                    <span className="text-[14px] font-semibold text-gray-900 truncate max-w-[140px]">{row.passportNo}</span>
                                )}
                                {formattedExpiry && (
                                    <Chip color={isWithinYear ? "red-600" : "gray-400"} variant="solid" size="sm">
                                        {formattedExpiry}
                                    </Chip>
                                )}
                            </div>
                            {passportName && (
                                <div className="text-[12px] text-gray-500 uppercase tracking-tight mt-1">{passportName}</div>
                            )}
                            {hasPassportPhoto && !hasPassportNo && !passportName && !formattedExpiry && (
                                <div className="text-[12px] text-gray-500 mt-1">여권사진 다운로드</div>
                            )}
                        </div>
                        {canDownload && hasPassportPhoto && (
                            <MiniIconButton
                                onClick={async (e) => {
                                    e.stopPropagation();
                                    try {
                                        await downloadStorageFile(row.passportPhotoBucket, row.passportPhotoPath, row.passportPhotoName || "passport-photo");
                                    } catch (error: any) {
                                        showError(error?.message || "여권사진 다운로드 실패");
                                    }
                                }}
                                title="여권사진 다운로드"
                                icon={<IconDownload className="w-3.5 h-3.5" />}
                                className="relative -left-1"
                            />
                        )}
                        {(isAdmin || row.id === myUserId) && (
                            <button
                                className="ml-3 flex-none w-8 h-8 rounded-lg hover:bg-gray-100 transition flex items-center justify-center text-gray-400"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedMemberId(row.id);
                                    setActionAnchor(e.currentTarget);
                                    setActionOpen(true);
                                }}
                                aria-label="more"
                            >
                                <IconMore className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                );
            },
        },
    ];
}
