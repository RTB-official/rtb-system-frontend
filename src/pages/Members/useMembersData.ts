import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import {
    createNotificationsForUsers,
    getAdminUserIds,
} from "../../lib/notificationApi";
import { useToast } from "../../components/ui/ToastProvider";
import type { Member } from "./types";
import { MEMBERS_CACHE_KEY } from "./constants";
import { toYYMMDD } from "./utils";

export function useMembersData() {
    const { showSuccess } = useToast();
    const [members, setMembers] = useState<Member[]>(() => {
        try {
            const raw = localStorage.getItem(MEMBERS_CACHE_KEY);
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
    const [myUserId, setMyUserId] = useState<string | null>(null);
    const passportNotifyRanRef = useRef(false);

    const notifyPassportExpiryWithinOneYear = async (
        mappedMembers: Member[],
    ) => {
        try {
            const adminIds = await getAdminUserIds();
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const oneYearLater = new Date(today);
            oneYearLater.setFullYear(today.getFullYear() + 1);
            const expiring = mappedMembers.filter((m) => {
                if (!m.passportExpiryISO) return false;
                const expiry = new Date(m.passportExpiryISO);
                if (Number.isNaN(expiry.getTime())) return false;
                expiry.setHours(0, 0, 0, 0);
                return expiry >= today && expiry <= oneYearLater;
            });
            if (expiring.length === 0) return;

            const hasPassportExpiryAlertRecord = async (
                memberId: string,
                expiryISO: string,
            ) => {
                const expiryDate = expiryISO.slice(0, 10);
                const { data, error } = await supabase
                    .from("passport_expiry_alerts")
                    .select("user_id")
                    .eq("user_id", memberId)
                    .eq("passport_expiry_date", expiryDate)
                    .limit(1);
                if (error) return false;
                return (data ?? []).length > 0;
            };

            const upsertPassportExpiryAlertRecord = async (
                memberId: string,
                expiryISO: string,
            ) => {
                const expiryDate = expiryISO.slice(0, 10);
                await supabase.from("passport_expiry_alerts").upsert(
                    {
                        user_id: memberId,
                        passport_expiry_date: expiryDate,
                        notified_at: new Date().toISOString(),
                    },
                    { onConflict: "user_id,passport_expiry_date" },
                );
            };

            for (const m of expiring) {
                const alreadySent = await hasPassportExpiryAlertRecord(
                    m.id,
                    m.passportExpiryISO,
                );
                if (alreadySent) continue;
                const recipients = Array.from(new Set([m.id, ...adminIds]));
                let label = "";
                try {
                    const d = new Date(m.passportExpiryISO);
                    label = `${String(d.getFullYear()).slice(2)}년 ${d.getMonth() + 1}월`;
                } catch {}
                await createNotificationsForUsers(
                    recipients,
                    "여권 만료 임박",
                    `${m.name}님의 여권이 1년 이내(${label ? `${label} 만료` : "만료 임박"})에 만료됩니다.`,
                    "other",
                    JSON.stringify({
                        kind: "passport_expiry_within_1y",
                        user_id: m.id,
                        passport_expiry_date: m.passportExpiryISO,
                    }),
                );
                await upsertPassportExpiryAlertRecord(
                    m.id,
                    m.passportExpiryISO,
                );
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
    }) => {
        setLoadError(null);
        const uid = opts?.myUserId ?? myUserId;
        if (members.length === 0) setLoading(true);
        if (!uid) {
            setMembers([]);
            setLoading(false);
            return;
        }

        const { data, error } = await supabase
            .from("profiles")
            .select(
                `
                id, username, name, role, department, email, join_date, birth_date, phone_number, address, position,
                profile_photo_bucket, profile_photo_path, profile_photo_name,
                signature_bucket, signature_path, signature_name, created_at
            `,
            )
            .order("created_at", { ascending: true });

        if (error) {
            console.error("profiles 조회 실패:", error.message);
            setLoadError(error.message);
            setLoading(false);
            return;
        }

        const ids = (data ?? []).map((p: any) => p.id);
        const [passportsResult] = await Promise.allSettled([
            supabase
                .from("profile_passports")
                .select(
                    "user_id, passport_last_name, passport_first_name, passport_number, passport_expiry_date, passport_image_bucket, passport_image_path, passport_image_name",
                )
                .in("user_id", ids),
        ]);

        let passportsData: any[] = [];
        if (
            passportsResult.status === "fulfilled" &&
            !passportsResult.value.error
        ) {
            passportsData = passportsResult.value.data ?? [];
        }
        const passportsMap = new Map<string, any>();
        passportsData.forEach((pp: any) => passportsMap.set(pp.user_id, pp));

        const resolvedIsStaff = opts?.isStaff ?? isStaff;
        const mapped: Member[] = (data ?? []).map((p: any) => {
            const pp = passportsMap.get(p.id);
            const resolvedMyUserId = opts?.myUserId ?? myUserId;
            const isOwnProfile = resolvedMyUserId === p.id;
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
                passportNo: shouldMaskPassport
                    ? ""
                    : (pp?.passport_number ?? ""),
                passportLastName: shouldMaskPassport
                    ? ""
                    : (pp?.passport_last_name ?? ""),
                passportFirstName: shouldMaskPassport
                    ? ""
                    : (pp?.passport_first_name ?? ""),
                passportExpiry: shouldMaskPassport
                    ? ""
                    : pp?.passport_expiry_date
                      ? toYYMMDD(pp.passport_expiry_date)
                      : "",
                passportExpiryISO: shouldMaskPassport
                    ? ""
                    : (pp?.passport_expiry_date ?? ""),
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
                signatureBucket: shouldMaskOtherFields
                    ? ""
                    : (p.signature_bucket ?? ""),
                signaturePath: shouldMaskOtherFields
                    ? ""
                    : (p.signature_path ?? ""),
                signatureName: shouldMaskOtherFields
                    ? ""
                    : (p.signature_name ?? ""),
            };
        });

        if (!passportNotifyRanRef.current) {
            passportNotifyRanRef.current = true;
            await notifyPassportExpiryWithinOneYear(mapped);
        }
        setMembers(mapped);
        try {
            localStorage.setItem(MEMBERS_CACHE_KEY, JSON.stringify(mapped));
        } catch {}
        setLoading(false);
    };

    useEffect(() => {
        let cancelled = false;
        const init = async () => {
            setRoleReady(false);
            await fetchMyRole();
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (cancelled) return;
            let isStaffVal = false;
            let adminVal = false;
            if (user) {
                const { data } = await supabase
                    .from("profiles")
                    .select("role, position, department")
                    .eq("id", user.id)
                    .single();
                adminVal =
                    data?.role === "admin" || data?.department === "공무팀";
                isStaffVal =
                    data?.role === "staff" || data?.department === "공사팀";
            }
            await fetchMembers({
                isAdmin: adminVal,
                myUserId: user?.id ?? null,
                isStaff: isStaffVal,
            });
            if (!cancelled) setRoleReady(true);
        };
        init();
        return () => {
            cancelled = true;
        };
    }, []);

    const downloadStorageFile = async (
        bucket: string,
        path: string,
        fileName: string,
    ) => {
        const { data, error } = await supabase.storage
            .from(bucket)
            .download(path);
        if (error || !data) throw error || new Error("파일 다운로드 실패");
        const url = URL.createObjectURL(data);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName || path.split("/").pop() || "download";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        showSuccess("다운로드되었습니다.");
    };

    const deleteStorageFile = async (bucket?: string, path?: string) => {
        if (!bucket || !path) return;
        try {
            await supabase.storage.from(bucket).remove([path]);
        } catch (e: any) {
            console.warn("Storage 삭제 실패:", e?.message || e);
        }
    };

    return {
        members,
        setMembers,
        loading,
        loadError,
        roleReady,
        isAdmin,
        isStaff,
        myUserId,
        fetchMembers,
        downloadStorageFile,
        deleteStorageFile,
    };
}
