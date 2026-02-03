//MembersPage.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import Sidebar from "../../components/Sidebar";
import { supabase } from "../../lib/supabase";
import Header from "../../components/common/Header";
import Tabs from "../../components/common/Tabs";
import ActionMenu from "../../components/common/ActionMenu";
import AddMemberModal from "../../components/modals/AddMemberModal";
import ResetPasswordModal from "../../components/modals/ResetPasswordModal";
import Table from "../../components/common/Table";
import Chip from "../../components/ui/Chip";
import { IconDownload, IconMore } from "../../components/icons/Icons";
import EmptyValueIndicator from "../../pages/Expense/components/EmptyValueIndicator";
import Avatar from "../../components/common/Avatar";
import MembersSkeleton from "../../components/common/skeletons/MembersSkeleton";
import { useToast } from "../../components/ui/ToastProvider";
import MiniIconButton from "../../components/ui/MiniIconButton";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import {
    uploadPassportPhoto,
    uploadProfilePhoto,
} from "../../lib/memberFilesApi";

import {
    createNotificationsForUsers,
    getAdminUserIds,
} from "../../lib/notificationApi";



type Member = {
    id: string;

    // profiles
    name: string; // profiles.name
    username: string; // profiles.username
    team: string; // profiles.department
    role: string; // 직급: profiles.position (없으면 profiles.role fallback)
    email: string; // profiles.email (UI 표시용 - staff는 타인 마스킹 유지)
    avatarEmail: string; // Avatar 표시용 - staff여도 타인은 실제 이메일 사용

    phone: string; // profiles.phone_number
    address1: string; // profiles.address (한 줄로 처리)
    address2: string; // (UI용, 현재는 빈 값)

    joinDate: string; // profiles.join_date
    birth: string; // profiles.birth_date

    passportNo: string; // profiles.passport_number
    passportLastName: string; // profiles.passport_last_name
    passportFirstName: string; // profiles.passport_first_name
    passportExpiry: string; // profiles.passport_expiry_date (YYMMDD로 보여주기)
    passportExpiryISO: string; // profiles.passport_expiry_date (ISO 형식, 날짜 비교용)

    profilePhotoBucket: string;
    profilePhotoPath: string;
    profilePhotoName: string;
    passportPhotoBucket: string;
    passportPhotoPath: string;
    passportPhotoName: string;
};

export default function MembersPage() {
    const { showSuccess, showError } = useToast();
    const passportNotifyRanRef = useRef(false);
    const [activeTab, setActiveTab] = useState<"ALL" | "ADMIN" | "STAFF">(
        "ALL"
    );
    const [page, setPage] = useState(1);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [members, setMembers] = useState<Member[]>(() => {
        try {
            const raw = localStorage.getItem("members_cache_v1");
            return raw ? (JSON.parse(raw) as Member[]) : [];
        } catch {
            return [];
        }
    });
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [roleReady, setRoleReady] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    const [isStaff, setIsStaff] = useState(false);
    const PAGE_SIZE = isStaff ? 14 : 10;
    const MEMBERS_CACHE_KEY = "members_cache_v1";
    const [myUserId, setMyUserId] = useState<string | null>(null);

    // Edit Member Modal
    const [editModalOpen, setEditModalOpen] = useState(false);

    // Reset Password Modal
    const [resetPasswordModalOpen, setResetPasswordModalOpen] = useState(false);

    // ... Action Menu
    const [actionOpen, setActionOpen] = useState(false);
    const [actionAnchor, setActionAnchor] = useState<HTMLElement | null>(null);
    const [selectedMemberId, setSelectedMemberId] = useState<string | null>(
        null
    );
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

    const toYYMMDD = (iso?: string | null) => {
        if (!iso) return "";
        // iso: "2026-01-07"
        const s = iso.slice(0, 10).replace(/-/g, ""); // YYYYMMDD
        return s.length === 8 ? s.slice(2) : s; // YYMMDD
    };

    const downloadStorageFile = async (
        bucket: string,
        path: string,
        fileName: string
    ) => {
        const { data, error } = await supabase.storage
            .from(bucket)
            .download(path);
        if (error || !data) {
            throw error || new Error("파일 다운로드 실패");
        }
        const url = URL.createObjectURL(data);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName || path.split("/").pop() || "download";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    };

    const deleteStorageFile = async (bucket?: string, path?: string) => {
        if (!bucket || !path) return;
        try {
            const { error } = await supabase.storage
                .from(bucket)
                .remove([path]);
            if (error) {
                console.warn("Storage 삭제 실패:", error.message);
            }
        } catch (error: any) {
            console.warn("Storage 삭제 실패:", error?.message || error);
        }
    };

    const normalizeDateToISO = (v: string) => {
        // DatePicker가 "YYYY. MM. DD." 형태일 수도 있어서 대응
        const trimmed = (v || "").trim();
        if (!trimmed) return null;

        // YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

        // YYYY. MM. DD.
        const dot = trimmed.match(/^(\d{4})\.\s?(\d{1,2})\.\s?(\d{1,2})\.?$/);
        if (dot) {
            const y = dot[1];
            const m = String(dot[2]).padStart(2, "0");
            const d = String(dot[3]).padStart(2, "0");
            return `${y}-${m}-${d}`;
        }

        // YYMMDD
        if (/^\d{6}$/.test(trimmed)) {
            const yy = trimmed.slice(0, 2);
            const mm = trimmed.slice(2, 4);
            const dd = trimmed.slice(4, 6);
            return `20${yy}-${mm}-${dd}`;
        }

        // YYYYMMDD
        if (/^\d{8}$/.test(trimmed)) {
            const y = trimmed.slice(0, 4);
            const m = trimmed.slice(4, 6);
            const d = trimmed.slice(6, 8);
            return `${y}-${m}-${d}`;
        }

        return null;
    };

    const notifyPassportExpiryWithinOneYear = async (mappedMembers: Member[]) => {
        try {
            // admin 계정들(대표 포함) 조회
            const adminIds = await getAdminUserIds();

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const oneYearLater = new Date(today);
            oneYearLater.setFullYear(today.getFullYear() + 1);

            // 만료 1년 이내(오늘 이후 ~ 1년 이내)인 멤버만 추림
            const expiring = mappedMembers.filter((m) => {
                if (!m.passportExpiryISO) return false;
                const expiry = new Date(m.passportExpiryISO);
                if (Number.isNaN(expiry.getTime())) return false;
                expiry.setHours(0, 0, 0, 0);
                return expiry >= today && expiry <= oneYearLater;
            });

            if (expiring.length === 0) return;

            // ✅ 서버 dedupe: passport_expiry_alerts에 기록이 있으면 전송하지 않음
            const hasPassportExpiryAlertRecord = async (
                memberId: string,
                expiryISO: string
            ) => {
                // expiryISO: "2026-01-07" → date로 저장하므로 앞 10자리 사용
                const expiryDate = expiryISO.slice(0, 10);

                const { data, error } = await supabase
                    .from("passport_expiry_alerts")
                    .select("user_id")
                    .eq("user_id", memberId)
                    .eq("passport_expiry_date", expiryDate)
                    .limit(1);

                if (error) {
                    console.warn("passport_expiry_alerts 조회 실패:", error.message);
                    // 조회 실패 시에는 안전하게 '아직 안 보냄'으로 처리(원하면 true로 바꿔도 됨)
                    return false;
                }

                return (data ?? []).length > 0;
            };

            const upsertPassportExpiryAlertRecord = async (
                memberId: string,
                expiryISO: string
            ) => {
                const expiryDate = expiryISO.slice(0, 10);

                const { error } = await supabase
                    .from("passport_expiry_alerts")
                    .upsert(
                        {
                            user_id: memberId,
                            passport_expiry_date: expiryDate,
                            notified_at: new Date().toISOString(),
                        },
                        { onConflict: "user_id,passport_expiry_date" }
                    );

                if (error) {
                    console.warn("passport_expiry_alerts upsert 실패:", error.message);
                }
            };

            for (const m of expiring) {
                // ✅ 이미 보낸 기록이 있으면 스킵 (로그인/새로고침/다시 진입해도 재전송 없음)
                const alreadySent = await hasPassportExpiryAlertRecord(
                    m.id,
                    m.passportExpiryISO
                );
                if (alreadySent) continue;

                // 수신자: 당사자 + admin들 (중복 제거)
                const recipients = Array.from(new Set([m.id, ...adminIds]));

                // 보기 좋은 날짜(YY년 M월 만료)
                let label = "";
                try {
                    const d = new Date(m.passportExpiryISO);
                    const yy = String(d.getFullYear()).slice(2);
                    const mm = d.getMonth() + 1;
                    label = `${yy}년 ${mm}월`;
                } catch {
                    label = "";
                }

                // ✅ 알림 먼저 생성
                await createNotificationsForUsers(
                    recipients,
                    "여권 만료 임박",
                    `${m.name}님의 여권이 1년 이내(${label ? `${label} 만료` : "만료 임박"})에 만료됩니다.`,
                    "other",
                    JSON.stringify({
                        kind: "passport_expiry_within_1y",
                        user_id: m.id,
                        passport_expiry_date: m.passportExpiryISO,
                    })
                );

                // ✅ 성공 후 dedupe 기록 저장 (딱 1회 보장)
                await upsertPassportExpiryAlertRecord(m.id, m.passportExpiryISO);
            }
        } catch (e) {
            console.error("여권 만료 1년 이내 알림 전송 실패:", e);
        }
    };



    const fetchMyRole = async () => {
        const {
            data: { user },
            error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) return;

        setMyUserId(user.id);

        const { data, error } = await supabase
            .from("profiles")
            .select("role, department")
            .eq("id", user.id)
            .single();

        if (error) {
            console.error("내 role 조회 실패:", error.message);
            return;
        }

        setIsAdmin(data?.role === "admin" || data?.department === "공무팀");
        setIsStaff(data?.role === "staff" || data?.department === "공사팀");
    };

    const fetchMembers = async (opts?: {
        isAdmin?: boolean;
        myUserId?: string | null;
        isStaff?: boolean;
        isCEO?: boolean;
    }) => {
        setLoadError(null);
        const admin = opts?.isAdmin ?? isAdmin;
        const uid = opts?.myUserId ?? myUserId;

        // 이미 데이터가 있으면 화면은 유지하고, 백그라운드로만 갱신(깜빡임 방지)
        if (members.length === 0) setLoading(true);

        let query = supabase
            .from("profiles")
            .select(
                `
                id,
                username,
                name,
                role,
                department,
                email,
                join_date,
                birth_date,
                phone_number,
                address,
                position,
                profile_photo_bucket,
                profile_photo_path,
                profile_photo_name,
                created_at
            `
            )
            .order("created_at", { ascending: true });

        // ✅ staff도 전체 조회 (단, 화면에서 타인 여권정보는 마스킹)
        if (!uid) {
            // 로그인 정보가 없으면 최소한 안전하게 종료
            setMembers([]);
            setLoading(false);
            return;
        }

        const { data, error } = await query;

        if (error) {
            console.error("profiles 조회 실패:", error.message);
            // ✅ 기존 목록 유지(캐시/이전 데이터가 있으면 그대로 보여줌)
            setLoading(false);
            return;
        }

        const ids = (data ?? []).map((p: any) => p.id);

        // ✅ profiles와 passports를 병렬로 조회하여 성능 개선
        const [passportsResult] = await Promise.allSettled([
            supabase
                .from("profile_passports")
                .select(
                    "user_id, passport_last_name, passport_first_name, passport_number, passport_expiry_date, passport_image_bucket, passport_image_path, passport_image_name"
                )
                .in("user_id", ids),
        ]);

        let passportsData: any[] = [];
        if (passportsResult.status === "fulfilled") {
            if (passportsResult.value.error) {
                console.error(
                    "profile_passports 조회 실패:",
                    passportsResult.value.error.message
                );
            } else {
                passportsData = passportsResult.value.data ?? [];
            }
        } else {
            console.error("profile_passports 조회 실패:", passportsResult.reason);
        }

        const passportsMap = new Map<string, any>();
        passportsData.forEach((pp: any) => {
            passportsMap.set(pp.user_id, pp);
        });

        const mapped: Member[] = (data ?? []).map((p: any) => {
            const pp = passportsMap.get(p.id);

            const resolvedMyUserId = opts?.myUserId ?? myUserId;
            const resolvedIsStaff = opts?.isStaff ?? isStaff;

            const isOwnProfile = resolvedMyUserId === p.id;

            // 공사팀(스태프)이고 본인이 아닌 경우: 이름/직급/전화번호만 공개
            // (여권정보 + 주소/입사일/생년월일은 기존 방식대로 "" 처리 -> UI에서 EmptyValueIndicator 노출)
            const shouldMaskOtherFields = resolvedIsStaff && !isOwnProfile;
            const shouldMaskPassport = shouldMaskOtherFields;

            return {
                id: p.id,
                name: p.name ?? "",
                username: shouldMaskOtherFields ? "" : (p.username ?? ""),
                team: p.department ?? "",
                role: p.position ?? p.role ?? "",
                email: shouldMaskOtherFields ? "" : (p.email ?? ""),
                avatarEmail: p.email ?? "",

                phone: p.phone_number ?? "",
                address1: shouldMaskOtherFields ? "" : (p.address ?? ""),
                address2: "",

                joinDate: shouldMaskOtherFields
                    ? ""
                    : p.join_date
                    ? toYYMMDD(p.join_date)
                    : "",
                birth: shouldMaskOtherFields
                    ? ""
                    : p.birth_date
                    ? toYYMMDD(p.birth_date)
                    : "",

                // 공사팀(스태프)이고 본인이 아닌 경우 여권정보 마스킹
                passportNo: shouldMaskPassport ? "" : (pp?.passport_number ?? ""),
                passportLastName: shouldMaskPassport ? "" : (pp?.passport_last_name ?? ""),
                passportFirstName: shouldMaskPassport ? "" : (pp?.passport_first_name ?? ""),
                passportExpiry: shouldMaskPassport
                    ? ""
                    : pp?.passport_expiry_date
                    ? toYYMMDD(pp.passport_expiry_date)
                    : "",
                passportExpiryISO: shouldMaskPassport ? "" : (pp?.passport_expiry_date ?? ""),

                profilePhotoBucket: shouldMaskOtherFields
                    ? ""
                    : (p.profile_photo_bucket ?? ""),
                profilePhotoPath: shouldMaskOtherFields
                    ? ""
                    : (p.profile_photo_path ?? ""),
                profilePhotoName: shouldMaskOtherFields
                    ? ""
                    : (p.profile_photo_name ?? ""),
                passportPhotoBucket: shouldMaskPassport
                    ? ""
                    : (pp?.passport_image_bucket ?? ""),
                passportPhotoPath: shouldMaskPassport
                    ? ""
                    : (pp?.passport_image_path ?? ""),
                passportPhotoName: shouldMaskPassport
                    ? ""
                    : (pp?.passport_image_name ?? ""),
            };
        });
        // ✅ 여권 만료 1년 이내 알림 (당사자 + admin)
        if (!passportNotifyRanRef.current) {
            passportNotifyRanRef.current = true;
            await notifyPassportExpiryWithinOneYear(mapped);
        }

        setMembers(mapped);
        try {
            localStorage.setItem(MEMBERS_CACHE_KEY, JSON.stringify(mapped));
        } catch { }
        setLoading(false);
    };

    useEffect(() => {
        const init = async () => {
            setRoleReady(false);
            await fetchMyRole();
            // fetchMyRole가 state를 바로 반영하기 전에 쓸 수 있게, 다시 user를 가져와서 안전하게 전달
            const {
                data: { user },
            } = await supabase.auth.getUser();

            // 방금 role은 state로 들어갔을 수 있으니, profiles에서 다시 role 체크해서 fetchMembers에 전달(깜빡임/경쟁 방지)
            let admin = false;
            let isStaff = false;
            let isCEO = false;
            if (user) {
                const { data } = await supabase
                    .from("profiles")
                    .select("role, position, department")
                    .eq("id", user.id)
                    .single();
                admin = data?.role === "admin" || data?.department === "공무팀";
                isStaff = data?.role === "staff" || data?.department === "공사팀";
                isCEO = data?.position === "대표";
            }

            await fetchMembers({
                isAdmin: admin,
                myUserId: user?.id ?? null,
                isStaff: isStaff,
                isCEO: isCEO,
            });
            setRoleReady(true);
        };

        init();
    }, []);

    // 직급 순서 정의 (높은 순)
    const roleOrder: Record<string, number> = {
        "대표": 1,
        "감사": 2,
        "부장": 3,
        "차장": 4,
        "과장": 5,
        "대리": 6,
        "주임": 7,
        "사원": 8,
        "인턴": 9,
    };

    const filteredMembers = useMemo(() => {
        let filtered = members;

        if (activeTab === "ADMIN") {
            filtered = filtered.filter((m) => m.team === "공무팀");
        } else if (activeTab === "STAFF") {
            filtered = filtered.filter((m) => m.team === "공사팀");
        }

        // 직급 순으로 정렬 (높은 순)
        // ✅ staff일 때는 내 계정을 항상 최상단에 고정
        return [...filtered].sort((a, b) => {
            if (isStaff && myUserId) {
                const aIsMe = a.id === myUserId;
                const bIsMe = b.id === myUserId;
                if (aIsMe && !bIsMe) return -1; // a가 나면 위로
                if (!aIsMe && bIsMe) return 1;  // b가 나면 아래로
            }

            const orderA = roleOrder[a.role] ?? 999;
            const orderB = roleOrder[b.role] ?? 999;
            if (orderA !== orderB) return orderA - orderB;

            // 같은 직급이면 입사일 순
            return a.joinDate.localeCompare(b.joinDate);
        });
    }, [members, activeTab, isStaff, myUserId]);


    const totalCount = members.length;
    const adminCount = members.filter((m) => m.team === "공무팀").length;
    const staffCount = members.filter((m) => m.team === "공사팀").length;

    const pageCount = Math.max(
        1,
        Math.ceil(filteredMembers.length / PAGE_SIZE)
    );
    const pagedMembers = filteredMembers.slice(
        (page - 1) * PAGE_SIZE,
        page * PAGE_SIZE
    );

    const selectedMember = members.find((m) => m.id === selectedMemberId);

    const handleResetPassword = () => {
        setResetPasswordModalOpen(true);
    };

    return (
        <div className="flex h-screen bg-white overflow-hidden">
            {/* Mobile Overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-20 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar - 데스크탑 고정, 모바일 슬라이드 */}
            <div
                className={`
          fixed lg:static inset-y-0 left-0 z-30
          w-[239px] h-screen shrink-0
          transform transition-transform duration-300 ease-in-out
          ${sidebarOpen
                        ? "translate-x-0"
                        : "-translate-x-full lg:translate-x-0"
                    }
        `}
            >
                <Sidebar onClose={() => setSidebarOpen(false)} />
            </div>

            {/* Main */}
            <div className="flex-1 flex flex-col h-screen overflow-hidden">
                <Header
                    title="구성원 관리"
                    onMenuClick={() => setSidebarOpen(true)}
                />

                {/* Content */}
                <div
                    className="flex-1 overflow-y-scroll px-10"
                    style={{ scrollbarGutter: "stable" }}
                >
                    <div className="py-9">
                        {/* Tabs row */}
                        <div className="mb-4">
                            <Tabs
                                items={[
                                    {
                                        value: "ALL",
                                        label: `전체 ${totalCount}`,
                                    },
                                    {
                                        value: "ADMIN",
                                        label: `공무팀 ${adminCount}`,
                                    },
                                    {
                                        value: "STAFF",
                                        label: `공사팀 ${staffCount}`,
                                    },
                                ]}
                                value={activeTab}
                                onChange={(v) => {
                                    setActiveTab(
                                        v as "ALL" | "ADMIN" | "STAFF"
                                    );
                                    setPage(1);
                                }}
                            />
                        </div>

                        {/* Table Card */}
                        {loadError && (
                            <div className="mb-3 text-sm text-red-600">
                                profiles 조회 실패: {loadError}
                            </div>
                        )}

{!roleReady || (loading && members.length === 0) ? (
                            <MembersSkeleton />
                        ) : (
                            <div className="overflow-x-auto w-full">
                                    <Table
                                        columns={[
                                            {
                                                key: "name",
                                                label: "이름",
                                                width: "11%",
                                                render: (_, row) => {
                                                    const canDownload =
                                                        isAdmin ||
                                                        row.id === myUserId;
                                                    const hasPhoto =
                                                        !!row.profilePhotoBucket &&
                                                        !!row.profilePhotoPath;
                                                    return (
                                                    <div className="relative group flex items-center gap-3">
                                                        <Avatar
                                                            email={row.avatarEmail}
                                                            size={24}
                                                            position={row.role}
                                                        />
                                                        <div className="leading-tight">
                                                            <div className="text-[14px] font-semibold text-gray-900">
                                                                {row.name ? (
                                                                    row.name
                                                                ) : (
                                                                    <EmptyValueIndicator />
                                                                )}
                                                            </div>
                                                            <div className="text-[12px] text-gray-500">
                                                                {row.username ? (
                                                                    row.username
                                                                ) : isStaff && row.id !== myUserId ? null : (
                                                                    <EmptyValueIndicator />
                                                                )}
                                                            </div>
                                                        </div>
                                                        {canDownload && hasPhoto && (
                                                            <MiniIconButton
                                                                onClick={async (e) => {
                                                                    e.stopPropagation();
                                                                    try {
                                                                        await downloadStorageFile(
                                                                            row.profilePhotoBucket,
                                                                            row.profilePhotoPath,
                                                                            row.profilePhotoName ||
                                                                                "profile-photo"
                                                                        );
                                                                    } catch (error: any) {
                                                                        showError(
                                                                            error?.message ||
                                                                                "증명사진 다운로드 실패"
                                                                        );
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
                                                    if (!hasAddress1 && !hasAddress2) {
                                                        return <EmptyValueIndicator />;
                                                    }
                                                    const primaryAddress =
                                                        row.address1 || row.address2 || "";
                                                    return (
                                                        <div className="text-[14px] text-gray-900 w-full max-w-[520px]">
                                                            <div className="truncate whitespace-nowrap">
                                                                {primaryAddress}
                                                            </div>
                                                            {hasAddress1 && hasAddress2 && (
                                                                <div className="text-[12px] text-gray-500 mt-1 truncate whitespace-nowrap">
                                                                    {row.address2}
                                                                </div>
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
                                                    // 여권 정보 확인
                                                    const hasPassportNo = !!row.passportNo;
                                                    const hasPassportName =
                                                        !!(row.passportLastName || row.passportFirstName);
                                                    const hasExpiry = !!row.passportExpiry;
                                                    const hasPassportPhoto =
                                                        !!row.passportPhotoBucket &&
                                                        !!row.passportPhotoPath;
                                                    const hasAnyPassportInfo =
                                                        hasPassportNo ||
                                                        hasPassportName ||
                                                        hasExpiry ||
                                                        hasPassportPhoto;
                                                    const canDownload =
                                                        isAdmin ||
                                                        row.id === myUserId;

                                                    // 여권 정보가 아예 없을 때만 표시
                                                    if (!hasAnyPassportInfo) {
                                                        return (
                                                            <div className="flex items-start pr-2 w-[260px] min-w-[260px]">
                                                                <div className="flex-1 min-w-0">
                                                                    <EmptyValueIndicator />
                                                                </div>
                                                                {(isAdmin ||
                                                                    row.id ===
                                                                    myUserId) && (
                                                                        <button
                                                                            className="flex-none w-8 h-8 rounded-lg hover:bg-gray-100 transition flex items-center justify-center text-gray-400"
                                                                            onClick={(
                                                                                e
                                                                            ) => {
                                                                                e.stopPropagation();
                                                                                setSelectedMemberId(
                                                                                    row.id
                                                                                );
                                                                                setActionAnchor(
                                                                                    e.currentTarget
                                                                                );
                                                                                setActionOpen(
                                                                                    true
                                                                                );
                                                                            }}
                                                                            aria-label="more"
                                                                        >
                                                                            <IconMore className="w-5 h-5" />
                                                                        </button>
                                                                    )}
                                                            </div>
                                                        );
                                                    }

                                                    // 251227 -> 25년 12월 만료 형식으로 변환 (YYMMDD)
                                                    let formattedExpiry = "";
                                                    let isExpiryWithinYear = false;
                                                    if (hasExpiry && row.passportExpiry.length === 6) {
                                                        const yy = parseInt(row.passportExpiry.slice(0, 2), 10);
                                                        const mm = parseInt(row.passportExpiry.slice(2, 4), 10);
                                                        formattedExpiry = `${String(yy).padStart(2, '0')}년 ${mm}월 만료`;

                                                        // ISO 날짜가 있으면 직접 사용, 없으면 YYMMDD에서 변환
                                                        if (row.passportExpiryISO) {
                                                            const expiryDate = new Date(row.passportExpiryISO);
                                                            expiryDate.setHours(0, 0, 0, 0);

                                                            const today = new Date();
                                                            today.setHours(0, 0, 0, 0);

                                                            // 오늘로부터 1년 후 날짜 계산
                                                            const oneYearLater = new Date(today);
                                                            oneYearLater.setFullYear(today.getFullYear() + 1);

                                                            // 만료일이 오늘 이후이고 1년 이내인지 확인
                                                            isExpiryWithinYear = expiryDate >= today && expiryDate <= oneYearLater;
                                                        }
                                                    }

                                                    const passportName = `${row.passportLastName || ""} ${row.passportFirstName || ""}`.trim();

                                                    // 여권정보가 있으면 있는 정보만 표시
                                                    return (
                                                        <div className="relative group flex items-start pr-2 w-[260px] min-w-[260px]">
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-2 flex-wrap">
                                                                    {hasPassportNo && (
                                                                        <span className="text-[14px] font-semibold text-gray-900 truncate max-w-[140px]">
                                                                            {row.passportNo}
                                                                        </span>
                                                                    )}

                                                                    {formattedExpiry && (
                                                                        <Chip
                                                                            color={isExpiryWithinYear ? "red-600" : "gray-400"}
                                                                            variant="solid"
                                                                            size="sm"
                                                                        >
                                                                            {formattedExpiry}
                                                                        </Chip>
                                                                    )}
                                                                </div>

                                                                {passportName && (
                                                                    <div className="text-[12px] text-gray-500 uppercase tracking-tight mt-1">
                                                                        {passportName}
                                                                    </div>
                                                                )}
                                                                {hasPassportPhoto &&
                                                                    !hasPassportNo &&
                                                                    !passportName &&
                                                                    !formattedExpiry && (
                                                                        <div className="text-[12px] text-gray-500 mt-1">
                                                                            여권사진 다운로드
                                                                        </div>
                                                                    )}
                                                            </div>
                                                            {canDownload && hasPassportPhoto && (
                                                                <MiniIconButton
                                                                    onClick={async (e) => {
                                                                        e.stopPropagation();
                                                                        try {
                                                                            await downloadStorageFile(
                                                                                row.passportPhotoBucket,
                                                                                row.passportPhotoPath,
                                                                                row.passportPhotoName ||
                                                                                    "passport-photo"
                                                                            );
                                                                        } catch (error: any) {
                                                                            showError(
                                                                                error?.message ||
                                                                                    "여권사진 다운로드 실패"
                                                                            );
                                                                        }
                                                                    }}
                                                                    title="여권사진 다운로드"
                                                                    icon={<IconDownload className="w-3.5 h-3.5" />}
                                                                    className="relative -left-1"
                                                                />
                                                            )}
                                                            {(isAdmin ||
                                                                row.id ===
                                                                myUserId) && (
                                                                    <button
                                                                        className="ml-3 flex-none w-8 h-8 rounded-lg hover:bg-gray-100 transition flex items-center justify-center text-gray-400"
                                                                        onClick={(
                                                                            e
                                                                        ) => {
                                                                            e.stopPropagation();
                                                                            setSelectedMemberId(
                                                                                row.id
                                                                            );
                                                                            setActionAnchor(
                                                                                e.currentTarget
                                                                            );
                                                                            setActionOpen(
                                                                                true
                                                                            );
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
                                        ]}
                                        data={pagedMembers}
                                        rowKey="id"
                                        emptyText="등록된 구성원이 없습니다."
                                        pagination={{
                                            currentPage: page,
                                            totalPages: pageCount,
                                            onPageChange: setPage,
                                        }}
                                    />
                                </div>
                        )}

                        {/* 바닥 여백 */}
                        <div className="h-8" />
                    </div>
                </div>
            </div>

            {/* Edit Member Modal */}
            <AddMemberModal
                isOpen={editModalOpen}
                onClose={() => setEditModalOpen(false)}
                member={selectedMember}
                onSubmit={async (payload) => {
                    if (!selectedMemberId) return;

                    // ✅ staff는 본인만 수정 가능
                    if (!isAdmin && selectedMemberId !== myUserId) {
                        showError("본인 계정만 수정할 수 있습니다.");
                        return;
                    }

                    // 이메일 도메인은 기존 이메일에서 유지 (없으면 기본값)
                    const domain =
                        selectedMember?.email?.split("@")[1] || "rtb-kor.com";

                    // ✅ 사용자가 '@'까지 입력해도 앞부분만 사용
                    const localPart = (payload.emailPrefix || "")
                        .split("@")[0]
                        .trim();

                    const nextEmail = localPart
                        ? `${localPart}@${domain}`
                        : selectedMember?.email || "";

                    const joinISO = normalizeDateToISO(payload.joinDate);
                    const birthISO = normalizeDateToISO(payload.birthDate);
                    const passportExpiryISO = normalizeDateToISO(
                        payload.passportExpiry
                    );

                    const { error } = await supabase
                        .from("profiles")
                        .update({
                            join_date: joinISO,
                            birth_date: birthISO,
                            email: nextEmail,

                            phone_number: payload.phone,
                            address: payload.address,

                            department: payload.team,
                            position: payload.position,
                        })
                        .eq("id", selectedMemberId);

                    if (!error) {
                        if (payload.profilePhotoFile) {
                            try {
                                const prevBucket =
                                    selectedMember?.profilePhotoBucket;
                                const prevPath = selectedMember?.profilePhotoPath;
                                const uploaded = await uploadProfilePhoto(
                                    selectedMemberId,
                                    payload.profilePhotoFile
                                );
                                await supabase
                                    .from("profiles")
                                    .update({
                                        profile_photo_bucket: uploaded.bucket,
                                        profile_photo_path: uploaded.path,
                                        profile_photo_name: uploaded.name,
                                    })
                                    .eq("id", selectedMemberId);
                                if (
                                    prevBucket &&
                                    prevPath &&
                                    (prevBucket !== uploaded.bucket ||
                                        prevPath !== uploaded.path)
                                ) {
                                    await deleteStorageFile(prevBucket, prevPath);
                                }
                            } catch (e: any) {
                                showError(
                                    e?.message ||
                                        "증명사진 업로드에 실패했습니다."
                                );
                            }
                        }

                        // ✅ 여권정보는 분리 테이블에 저장
                        const { error: ppError } = await supabase
                            .from("profile_passports")
                            .upsert(
                                {
                                    user_id: selectedMemberId,
                                    passport_last_name:
                                        payload.passportLastName,
                                    passport_first_name:
                                        payload.passportFirstName,
                                    passport_number: payload.passportNo,
                                    passport_expiry_date: passportExpiryISO,
                                },
                                { onConflict: "user_id" }
                            );

                        if (ppError) {
                            console.error(
                                "여권정보 저장 실패:",
                                ppError.message
                            );
                            showError("여권정보 저장에 실패했습니다.");
                            return;
                        }

                        if (payload.passportPhotoFile) {
                            try {
                                const prevBucket =
                                    selectedMember?.passportPhotoBucket;
                                const prevPath =
                                    selectedMember?.passportPhotoPath;
                                const uploaded = await uploadPassportPhoto(
                                    selectedMemberId,
                                    payload.passportPhotoFile
                                );
                                await supabase
                                    .from("profile_passports")
                                    .upsert(
                                        {
                                            user_id: selectedMemberId,
                                            passport_image_bucket: uploaded.bucket,
                                            passport_image_path: uploaded.path,
                                            passport_image_name: uploaded.name,
                                        },
                                        { onConflict: "user_id" }
                                    );
                                if (
                                    prevBucket &&
                                    prevPath &&
                                    (prevBucket !== uploaded.bucket ||
                                        prevPath !== uploaded.path)
                                ) {
                                    await deleteStorageFile(prevBucket, prevPath);
                                }
                            } catch (e: any) {
                                showError(
                                    e?.message ||
                                        "여권사진 업로드에 실패했습니다."
                                );
                            }
                        }
                    }

                    if (error) {
                        console.error("구성원 수정 실패:", error.message);
                        showError("구성원 정보 수정에 실패했습니다.");
                        return;
                    }

                    showSuccess("구성원 정보가 수정되었습니다.");
                    setEditModalOpen(false);

                    // 목록 갱신
                    await fetchMembers();
                }}
            />

            {/* Action Menu (수정/삭제/비밀번호 재설정) */}
            <ActionMenu
                isOpen={actionOpen}
                anchorEl={actionAnchor}
                onClose={() => {
                    setActionOpen(false);
                    setActionAnchor(null);
                }}
                onEdit={() => {
                    // staff는 본인만 가능
                    if (!isAdmin && selectedMemberId !== myUserId) return;
                    setActionOpen(false);
                    setEditModalOpen(true);
                }}
                onResetPassword={() => {
                    // admin은 모든 계정, staff는 본인만 가능
                    if (!isAdmin && selectedMemberId !== myUserId) return;
                    setActionOpen(false);
                    setResetPasswordModalOpen(true);
                }}
                // ✅ admin만 삭제 가능
                onDelete={
                    isAdmin
                        ? () => {
                            if (!selectedMemberId) return;
                            setDeleteConfirmOpen(true);
                        }
                        : undefined
                }
                showDelete={isAdmin}
                width="w-44"
            />

            <ConfirmDialog
                isOpen={deleteConfirmOpen}
                onClose={() => setDeleteConfirmOpen(false)}
                onConfirm={async () => {
                    if (!selectedMemberId) return;
                    setDeleteConfirmOpen(false);

                    const { error } = await supabase
                        .from("profiles")
                        .delete()
                        .eq("id", selectedMemberId);

                    if (error) {
                        console.error("삭제 실패:", error.message);
                        showError("삭제에 실패했습니다.");
                        return;
                    }

                    showSuccess("삭제 완료");
                    setActionOpen(false);
                    setActionAnchor(null);
                    await fetchMembers();
                }}
                title="구성원 삭제"
                message="정말 삭제하시겠습니까?"
                confirmText="삭제"
                cancelText="취소"
                confirmVariant="danger"
            />

            {/* Reset Password Modal */}
            <ResetPasswordModal
                isOpen={resetPasswordModalOpen}
                memberName={selectedMember?.name}
                onClose={() => setResetPasswordModalOpen(false)}
                onSubmit={async (payload) => {
                    if (!selectedMemberId) return false;

                    // ✅ staff는 본인만 가능
                    if (!isAdmin && selectedMemberId !== myUserId) {
                        showError("본인 비밀번호만 변경할 수 있습니다.");
                        return false;
                    }

                    // 본인 비밀번호 변경 (staff 또는 admin이 본인 변경)
                    if (selectedMemberId === myUserId) {
                        const { error } = await supabase.auth.updateUser({
                            password: payload.newPassword,
                        });

                        if (error) {
                            console.error("비밀번호 변경 실패:", error.message);
                            showError("비밀번호 변경에 실패했습니다.");
                            return false;
                        }

                        showSuccess("비밀번호가 변경되었습니다.");
                        return true;
                    }

                    // ✅ admin이 타인 비밀번호 재설정
                    if (isAdmin && selectedMemberId !== myUserId) {
                        // 디버깅: admin 권한 확인
                        console.log("관리자 비밀번호 재설정 시도:", {
                            isAdmin,
                            selectedMemberId,
                            myUserId,
                        });

                        const {
                            data: { session },
                        } = await supabase.auth.getSession();

                        if (!session?.access_token) {
                            showError("로그인 정보가 없습니다.");
                            return false;
                        }

                        // 비밀번호 길이 검증 (Edge Function과 일치)
                        if (payload.newPassword.length < 6) {
                            showError("비밀번호는 최소 6자 이상이어야 합니다.");
                            return false;
                        }

                        // Edge Function을 통한 관리자 비밀번호 재설정
                        // authorization 헤더를 명시적으로 전달
                        const { data, error } = await supabase.functions.invoke(
                            "admin-reset-password",
                            {
                                body: {
                                    userId: selectedMemberId,
                                    newPassword: payload.newPassword,
                                },
                                headers: {
                                    Authorization: `Bearer ${session.access_token}`,
                                },
                            }
                        );

                        if (error) {
                            console.error("관리자 비밀번호 재설정 실패:", {
                                error,
                                errorDetails: JSON.stringify(error, null, 2),
                                data,
                            });

                            // 에러 응답 본문에서 상세 메시지 추출 시도
                            let errorMessage = "비밀번호 재설정에 실패했습니다.";
                            if (error.message) {
                                errorMessage = error.message;
                            } else if (typeof error === 'object' && 'error' in error) {
                                errorMessage = String(error.error);
                            }

                            showError(errorMessage);
                            return false;
                        }

                        console.log("비밀번호 재설정 성공:", data);
                        showSuccess("비밀번호가 재설정되었습니다.");
                        return true;
                    }

                    return false;
                }}
            />
        </div>
    );
}
