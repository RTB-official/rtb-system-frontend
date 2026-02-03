import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { listVehicles } from "../lib/vehiclesApi";
import { getVacations } from "../lib/vacationApi";
import { useToast } from "../components/ui/ToastProvider";
import { useUser } from "./useUser";

export function useMenuNotifications() {
    const { currentUser, currentUserId, userPermissions } = useUser();
    const { showInfo } = useToast();

    const intervalMs = 24 * 60 * 60 * 1000; // 1 day

    const [notis, setNotis] = useState(() => {
        const cached = localStorage.getItem("sidebar_notis_cache");
        return cached ? JSON.parse(cached) : {
            vehicles: false,
            members: false,
            vacation: false,
        };
    });

    // Toasts are now triggered on-demand, but we need to store the messages to show
    const [pendingVehicles, setPendingVehicles] = useState<any[]>([]);
    const [pendingMembers, setPendingMembers] = useState<any[]>([]);
    const [pendingVacationCount, setPendingVacationCount] = useState(0);

    const getRemainingTimeLabel = (dateStr: string) => {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const target = new Date(dateStr);
        target.setHours(0, 0, 0, 0);
        
        const diffTime = target.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) return "오늘(D-Day)";
        if (diffDays < 0) return `${Math.abs(diffDays)}일 지남`;
        if (diffDays < 31) return `${diffDays}일`;
        
        const months = Math.floor(diffDays / 30.44);
        const remainingDays = Math.floor(diffDays % 30.44);
        
        if (remainingDays === 0) return `${months}개월`;
        return `${months}개월 ${remainingDays}일`;
    };

    const checkNotifications = async () => {
        if (!currentUserId || !userPermissions.initialized) return;
        const now = new Date();

        // 1. Vehicles
        let vehicleDot = false;
        const foundVehicles: any[] = [];
        try {
            const vehicles = await listVehicles();
            const twoMonthsInMs = 60 * 24 * 60 * 60 * 1000;

            for (const v of vehicles) {
                if (v.inspection_date) {
                    const expiry = new Date(v.inspection_date);
                    const diff = expiry.getTime() - now.getTime();
                    if (diff > 0 && diff <= twoMonthsInMs) {
                        foundVehicles.push(v);
                    }
                }
            }
        } catch (err) {
            console.error("Vehicle check failed:", err);
        }
        setPendingVehicles(foundVehicles);
        if (foundVehicles.length > 0) {
            const lastShown = localStorage.getItem("noti_toast_vehicles");
            const isExpired = !lastShown || (now.getTime() - parseInt(lastShown)) > intervalMs;
            if (isExpired) vehicleDot = true;
        }

        // 2. Members
        let memberDot = false;
        const foundMembers: any[] = [];
        const canSeePassportNotis = userPermissions.isAdmin || currentUser?.department === "공무팀";

        try {
            const { data: profiles } = await supabase.from("profiles").select("id, name");
            const { data: passports } = await supabase.from("profile_passports").select("user_id, passport_expiry_date");
            const oneYearInMs = 365 * 24 * 60 * 60 * 1000;

            for (const p of passports || []) {
                const isOwn = p.user_id === currentUserId;
                if (canSeePassportNotis || isOwn) {
                    if (p.passport_expiry_date) {
                        const expiry = new Date(p.passport_expiry_date);
                        const diff = expiry.getTime() - now.getTime();
                        if (diff > 0 && diff <= oneYearInMs) {
                            const profileName = profiles?.find(prof => prof.id === p.user_id)?.name || "구성원";
                            foundMembers.push({ ...p, profileName });
                        }
                    }
                }
            }
        } catch (err) {
            console.error("Passport check failed:", err);
        }
        setPendingMembers(foundMembers);
        if (foundMembers.length > 0) {
            const lastShown = localStorage.getItem("noti_toast_members");
            const isExpired = !lastShown || (now.getTime() - parseInt(lastShown)) > intervalMs;
            if (isExpired) memberDot = true;
        }

        // 3. Vacation
        let vacationDot = false;
        let vCount = 0;
        if (userPermissions.isCEO) {
            try {
                const pendingVacations = await getVacations(undefined, { status: "pending" });
                vCount = pendingVacations.length;
                if (vCount > 0) {
                    const lastShown = localStorage.getItem("noti_toast_vacation");
                    const isExpired = !lastShown || (now.getTime() - parseInt(lastShown)) > intervalMs;
                    if (isExpired) vacationDot = true;
                }
            } catch (err) {
                console.error("Vacation check failed:", err);
            }
        }
        setPendingVacationCount(vCount);

        const nextNotis = {
            vehicles: vehicleDot,
            members: memberDot,
            vacation: vacationDot,
        };
        setNotis(nextNotis);
        localStorage.setItem("sidebar_notis_cache", JSON.stringify(nextNotis));
    };

    useEffect(() => {
        checkNotifications();
        const interval = setInterval(checkNotifications, 1000 * 60 * 60);
        return () => clearInterval(interval);
    }, [currentUserId, userPermissions, currentUser?.department]);

    // 사용자가 메뉴를 클릭했을 때 호출될 함수
    const triggerToast = async (type: "vehicles" | "members" | "vacation") => {
        const now = new Date();

        if (type === "vehicles") {
            if (pendingVehicles.length > 0) {
                const lastShown = localStorage.getItem("noti_toast_vehicles");
                const shouldShow = !lastShown || (now.getTime() - parseInt(lastShown)) > intervalMs;
                if (shouldShow) {
                    pendingVehicles.forEach((v) => {
                        const remainingLabel = getRemainingTimeLabel(v.inspection_date);
                        showInfo(`${v.plate} 차량의 검사 주기가 ${remainingLabel} 남았습니다.`);
                    });
                    localStorage.setItem("noti_toast_vehicles", now.getTime().toString());
                }
            }
        } else if (type === "members") {
            if (pendingMembers.length > 0) {
                const lastShown = localStorage.getItem("noti_toast_members");
                const shouldShow = !lastShown || (now.getTime() - parseInt(lastShown)) > intervalMs;
                if (shouldShow) {
                    pendingMembers.forEach((p) => {
                        const remainingLabel = getRemainingTimeLabel(p.passport_expiry_date);
                        showInfo(`${p.profileName}님 여권 만료일이 ${remainingLabel} 남았습니다. 갱신해 주세요.`);
                    });
                    localStorage.setItem("noti_toast_members", now.getTime().toString());
                }
            }
        } else if (type === "vacation") {
            if (pendingVacationCount > 0) {
                const lastShown = localStorage.getItem("noti_toast_vacation");
                const shouldShow = !lastShown || (now.getTime() - parseInt(lastShown)) > intervalMs;

                if (shouldShow) {
                    showInfo(`대기 중인 휴가 신청이 ${pendingVacationCount}건 있습니다.`);
                    localStorage.setItem("noti_toast_vacation", now.getTime().toString());
                }
            }
        }
        
        // 클릭 직후 도트 즉시 갱신 (사라지게 함)
        await checkNotifications();
    };

    return { ...notis, triggerToast };
}
