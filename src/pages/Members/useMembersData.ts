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

/** 동일 여권 만료 알림 재발송 최소 간격 (2주) */
const PASSPORT_NOTIFY_INTERVAL_MS = 14 * 24 * 60 * 60 * 1000;

function getPassportNotifyStorageKey(memberId: string, expiryISO: string) {
    return `passport_expiry_notify:${memberId}:${expiryISO.slice(0, 10)}`;
}

type ProfilePassportRow = {
    passport_last_name?: string | null;
    passport_first_name?: string | null;
    passport_number?: string | null;
    passport_expiry_date?: string | null;
    passport_image_bucket?: string | null;
    passport_image_path?: string | null;
    passport_image_name?: string | null;
};

type ProfileWithPassportRow = {
    id: string;
    username?: string | null;
    name?: string | null;
    role?: string | null;
    department?: string | null;
    email?: string | null;
    join_date?: string | null;
    birth_date?: string | null;
    phone_number?: string | null;
    address?: string | null;
    position?: string | null;
    profile_photo_bucket?: string | null;
    profile_photo_path?: string | null;
    profile_photo_name?: string | null;
    signature_bucket?: string | null;
    signature_path?: string | null;
    signature_name?: string | null;
    created_at?: string | null;
    profile_passports?: ProfilePassportRow | ProfilePassportRow[] | null;
};

function getNestedPassport(
    row: ProfileWithPassportRow,
): ProfilePassportRow | undefined {
    const nested = row.profile_passports;
    if (!nested) return undefined;
    return Array.isArray(nested) ? nested[0] : nested;
}

const MEMBERS_PROFILE_SELECT = `
    id, username, name, role, department, email, join_date, birth_date, phone_number, address, position,
    profile_photo_bucket, profile_photo_path, profile_photo_name,
    signature_bucket, signature_path, signature_name, created_at,
    profile_passports (
        passport_last_name, passport_first_name, passport_number, passport_expiry_date,
        passport_image_bucket, passport_image_path, passport_image_name
    )
`;

function mapProfileRowsToMembers(
    rows: ProfileWithPassportRow[],
    myUserId: string,
    isStaff: boolean,
): Member[] {
    return rows.map((p) => {
        const pp = getNestedPassport(p);
        const isOwnProfile = myUserId === p.id;
        const shouldMaskOtherFields = isStaff && !isOwnProfile;
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
            passportNo: shouldMaskPassport ? "" : (pp?.passport_number ?? ""),
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
}

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

            const wasPassportExpiryNotifiedRecently = async (
                memberId: string,
                expiryISO: string,
            ) => {
                const storageKey = getPassportNotifyStorageKey(memberId, expiryISO);
                const stored = localStorage.getItem(storageKey);
                if (stored) {
                    const last = parseInt(stored, 10);
                    if (
                        !Number.isNaN(last) &&
                        Date.now() - last < PASSPORT_NOTIFY_INTERVAL_MS
                    ) {
                        return true;
                    }
                }

                const expiryDate = expiryISO.slice(0, 10);
                const { data, error } = await supabase
                    .from("passport_expiry_alerts")
                    .select("notified_at")
                    .eq("user_id", memberId)
                    .eq("passport_expiry_date", expiryDate)
                    .maybeSingle();

                if (error || !data?.notified_at) return false;

                const lastNotified = new Date(data.notified_at).getTime();
                if (
                    !Number.isNaN(lastNotified) &&
                    Date.now() - lastNotified < PASSPORT_NOTIFY_INTERVAL_MS
                ) {
                    localStorage.setItem(storageKey, String(lastNotified));
                    return true;
                }
                return false;
            };

            const markPassportExpiryNotified = async (
                memberId: string,
                expiryISO: string,
            ) => {
                const now = Date.now();
                localStorage.setItem(
                    getPassportNotifyStorageKey(memberId, expiryISO),
                    String(now),
                );

                const expiryDate = expiryISO.slice(0, 10);
                await supabase.from("passport_expiry_alerts").upsert(
                    {
                        user_id: memberId,
                        passport_expiry_date: expiryDate,
                        notified_at: new Date(now).toISOString(),
                    },
                    { onConflict: "user_id,passport_expiry_date" },
                );
            };

            for (const m of expiring) {
                const recentlyNotified = await wasPassportExpiryNotifiedRecently(
                    m.id,
                    m.passportExpiryISO,
                );
                if (recentlyNotified) continue;
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
                await markPassportExpiryNotified(m.id, m.passportExpiryISO);
            }
        } catch (e) {
            console.error("여권 만료 1년 이내 알림 전송 실패:", e);
        }
    };

    const fetchMembers = async () => {
        setLoadError(null);
        if (members.length === 0) setLoading(true);

        const {
            data: { user },
            error: userError,
        } = await supabase.auth.getUser();
        if (userError || !user) {
            setMembers([]);
            setLoading(false);
            return;
        }

        setMyUserId(user.id);

        const { data, error } = await supabase
            .from("profiles")
            .select(MEMBERS_PROFILE_SELECT)
            .order("created_at", { ascending: true });

        if (error) {
            console.error("profiles 조회 실패:", error.message);
            setLoadError(error.message);
            setLoading(false);
            return;
        }

        const rows = (data ?? []) as ProfileWithPassportRow[];
        const myProfile = rows.find((p) => p.id === user.id);
        const adminVal =
            myProfile?.role === "admin" || myProfile?.department === "공무팀";
        const isStaffVal =
            myProfile?.role === "staff" || myProfile?.department === "공사팀";

        setIsAdmin(adminVal);
        setIsStaff(isStaffVal);

        const mapped = mapProfileRowsToMembers(rows, user.id, isStaffVal);

        setMembers(mapped);
        try {
            localStorage.setItem(MEMBERS_CACHE_KEY, JSON.stringify(mapped));
        } catch {}
        setLoading(false);

        if (!passportNotifyRanRef.current) {
            passportNotifyRanRef.current = true;
            void notifyPassportExpiryWithinOneYear(mapped);
        }
    };

    useEffect(() => {
        let cancelled = false;
        const init = async () => {
            setRoleReady(false);
            await fetchMembers();
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
