//MembersPage.tsx
import { useEffect, useMemo, useState } from "react";
import Sidebar from "../../components/Sidebar";
import { supabase } from "../../lib/supabase";
import Header from "../../components/common/Header";
import Tabs from "../../components/common/Tabs";
import ActionMenu from "../../components/common/ActionMenu";
import AddMemberModal from "../../components/modals/AddMemberModal";
import ResetPasswordModal from "../../components/modals/ResetPasswordModal";
import Table from "../../components/common/Table";
import Chip from "../../components/ui/Chip";
import { IconMore } from "../../components/icons/Icons";
import Avatar from "../../components/common/Avatar";
import MembersSkeleton from "../../components/common/MembersSkeleton";
import EmptyValueIndicator from "../../pages/Expense/components/EmptyValueIndicator";
import { useToast } from "../../components/ui/ToastProvider";

type Member = {
    id: string;

    // profiles
    name: string; // profiles.name
    username: string; // profiles.username
    team: string; // profiles.department
    role: string; // 직급: profiles.position (없으면 profiles.role fallback)
    email: string; // profiles.email

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
};

export default function MembersPage() {
    const { showSuccess, showError } = useToast();
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
    const PAGE_SIZE = 10;
    const [isAdmin, setIsAdmin] = useState(false);
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

    const toYYMMDD = (iso?: string | null) => {
        if (!iso) return "";
        // iso: "2026-01-07"
        const s = iso.slice(0, 10).replace(/-/g, ""); // YYYYMMDD
        return s.length === 8 ? s.slice(2) : s; // YYMMDD
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

    const fetchMyRole = async () => {
        const {
            data: { user },
            error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) return;

        setMyUserId(user.id);

        const { data, error } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .single();

        if (error) {
            console.error("내 role 조회 실패:", error.message);
            return;
        }

        setIsAdmin(data?.role === "admin");
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

        setLoading(true);

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

        const ids = (data ?? []).map((p: any) => p.id);

        // ✅ 여권정보는 분리 테이블에서 조회 (모든 사용자가 모든 여권정보 조회 가능)
        const { data: passportsData, error: passportsError } = await supabase
            .from("profile_passports")
            .select(
                "user_id, passport_last_name, passport_first_name, passport_number, passport_expiry_date"
            )
            .in("user_id", ids);

        if (passportsError) {
            console.error(
                "profile_passports 조회 실패:",
                passportsError.message
            );
        }

        const passportsMap = new Map<string, any>();
        (passportsData ?? []).forEach((pp: any) => {
            passportsMap.set(pp.user_id, pp);
        });

        if (error) {
            console.error("profiles 조회 실패:", error.message);
            // ✅ 기존 목록 유지(캐시/이전 데이터가 있으면 그대로 보여줌)
            setLoading(false);
            return;
        }

        const mapped: Member[] = (data ?? []).map((p: any) => {
            const pp = passportsMap.get(p.id);
            const isOwnProfile = opts?.myUserId === p.id;
            // 공사팀(스태프)이고 본인이 아닌 경우 여권정보 마스킹
            const shouldMaskPassport = opts?.isStaff && !isOwnProfile;

            return {
                id: p.id,
                name: p.name ?? "",
                username: p.username ?? "",
                team: p.department ?? "",
                role: p.position ?? p.role ?? "",
                email: p.email ?? "",

                phone: p.phone_number ?? "",
                address1: p.address ?? "",
                address2: "",

                joinDate: p.join_date ? toYYMMDD(p.join_date) : "",
                birth: p.birth_date ? toYYMMDD(p.birth_date) : "",

                // 공사팀(스태프)이고 본인이 아닌 경우 여권정보 마스킹
                passportNo: shouldMaskPassport ? "" : (pp?.passport_number ?? ""),
                passportLastName: shouldMaskPassport ? "" : (pp?.passport_last_name ?? ""),
                passportFirstName: shouldMaskPassport ? "" : (pp?.passport_first_name ?? ""),
                passportExpiry: shouldMaskPassport ? "" : (pp?.passport_expiry_date
                    ? toYYMMDD(pp.passport_expiry_date)
                    : ""),
                passportExpiryISO: shouldMaskPassport ? "" : (pp?.passport_expiry_date ?? ""),
            };
        });

        setMembers(mapped);
        try {
            localStorage.setItem(MEMBERS_CACHE_KEY, JSON.stringify(mapped));
        } catch { }
        setLoading(false);
    };

    useEffect(() => {
        const init = async () => {
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
            filtered = members.filter((m) => m.team === "공무팀");
        } else if (activeTab === "STAFF") {
            filtered = members.filter((m) => m.team === "공사팀");
        }

        // 직급 순으로 정렬 (높은 순)
        return [...filtered].sort((a, b) => {
            const orderA = roleOrder[a.role] ?? 999;
            const orderB = roleOrder[b.role] ?? 999;
            if (orderA !== orderB) return orderA - orderB;
            // 같은 직급이면 입사일 순
            return a.joinDate.localeCompare(b.joinDate);
        });
    }, [members, activeTab]);

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

                        {loading && members.length === 0 ? (
                            <MembersSkeleton />
                        ) : (
                            <div className="overflow-x-auto">
                                <div className="min-w-[980px]">
                                    <Table
                                        columns={[
                                            {
                                                key: "name",
                                                label: "이름",
                                                width: "8%",
                                                render: (_, row) => (
                                                    <div className="flex items-center gap-3">
                                                        <Avatar
                                                            email={row.email}
                                                            size={24}
                                                            position={row.role}
                                                        />
                                                        <div className="leading-tight">
                                                            <div className="text-[14px] font-semibold text-gray-900">
                                                                {row.name}
                                                            </div>
                                                            <div className="text-[12px] text-gray-500">
                                                                {row.username}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ),
                                            },
                                            {
                                                key: "role",
                                                label: "직급",
                                                width: "2%",
                                                render: (value) => (
                                                    <div className="text-[14px] text-gray-900 w-[90px] min-w-[90px]">
                                                        {value}
                                                    </div>
                                                ),
                                            },
                                            {
                                                key: "phone",
                                                label: "전화번호",
                                                width: "6%",
                                                render: (value) => (
                                                    <div className="text-[14px] text-gray-900 w-[140px] min-w-[140px]">
                                                        {value}
                                                    </div>
                                                ),
                                            },
                                            {
                                                key: "address",
                                                label: "주소",
                                                width: "24%",
                                                render: (_, row) => (
                                                    <div className="text-[14px] text-gray-900 w-[320px] min-w-[320px] max-w-[320px]">
                                                        <div className="wrap-break-word whitespace-normal">
                                                            {row.address1}
                                                        </div>
                                                        <div className="text-[12px] text-gray-500 mt-1 wrap-break-word whitespace-normal">
                                                            {row.address2}
                                                        </div>
                                                    </div>
                                                ),
                                            },
                                            {
                                                key: "joinDate",
                                                label: "입사일",
                                                width: "4%",
                                                render: (value) => (
                                                    <div className="text-[14px] text-gray-900 w-[100px] min-w-[100px]">
                                                        {value}
                                                    </div>
                                                ),
                                            },
                                            {
                                                key: "birth",
                                                label: "생년월일",
                                                width: "4%",
                                                render: (value) => (
                                                    <div className="text-[14px] text-gray-900 w-[110px] min-w-[110px]">
                                                        {value}
                                                    </div>
                                                ),
                                            },
                                            {
                                                key: "etc",
                                                label: "여권정보",
                                                width: "15%",
                                                render: (_, row) => {
                                                    // 여권 정보 확인
                                                    const hasPassportNo = !!row.passportNo;
                                                    const hasPassportName =
                                                        !!(row.passportLastName || row.passportFirstName);
                                                    const hasExpiry = !!row.passportExpiry;
                                                    const hasAnyPassportInfo = hasPassportNo || hasPassportName || hasExpiry;

                                                    // 여권 정보가 아예 없을 때만 EmptyValueIndicator 표시
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
                                                        <div className="flex items-start pr-2 w-[260px] min-w-[260px]">
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
                                                            </div>
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
                                        pagination={{
                                            currentPage: page,
                                            totalPages: pageCount,
                                            onPageChange: setPage,
                                        }}
                                    />
                                </div>
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
                        ? async () => {
                            if (!selectedMemberId) return;
                            if (!confirm("정말 삭제하시겠습니까?")) return;

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
                        }
                        : undefined
                }
                showDelete={isAdmin}
                width="w-44"
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
                        if (payload.newPassword.length < 8) {
                            showError("비밀번호는 최소 8자 이상이어야 합니다.");
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
