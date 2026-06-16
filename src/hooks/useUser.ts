import { useEffect, useState, useRef } from "react";
import { supabase } from "../lib/supabase";

export interface User {
    displayName: string;
    email: string;
    position?: string | null;
    role?: string | null;
    department?: string | null;
}

export interface UserPermissions {
    isCEO: boolean;
    isAdmin: boolean;
    isStaff: boolean;
    showHomeMenu: boolean;
    showVacationMenu: boolean;
    initialized: boolean;
}

export function useUser() {
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [currentUser, setCurrentUser] = useState<User | null>(() => {
        const cachedEmail = localStorage.getItem("sidebarEmail") || "";
        const cachedId = localStorage.getItem("sidebarLoginId") || "";
        const cachedPosition = localStorage.getItem("sidebarPosition") || "";
        const cachedRole = localStorage.getItem("sidebarRole");
        const cachedDepartment = localStorage.getItem("sidebarDepartment");

        if (!cachedEmail && !cachedId) return null;

        return {
            displayName: cachedId || "",
            email: cachedEmail,
            position: cachedPosition || null,
            role: cachedRole || null,
            department: cachedDepartment || null,
        };
    });

    const [sidebarLoginId, setSidebarLoginId] = useState<string>(() => {
        return localStorage.getItem("sidebarLoginId") || "";
    });

    // role과 department를 별도로 관리하여 한 번 설정되면 유지
    const [userRole, setUserRole] = useState<string | null>(() => {
        const cached = localStorage.getItem("sidebarRole");
        return cached || null;
    });

    const [userDepartment, setUserDepartment] = useState<string | null>(() => {
        const cached = localStorage.getItem("sidebarDepartment");
        return cached || null;
    });

    // 사용자 권한 정보를 ref로 저장하여 절대 변경되지 않도록 보장
    const userPermissionsRef = useRef<{
        isCEO: boolean;
        isAdmin: boolean;
        isStaff: boolean;
        showHomeMenu: boolean;
        showVacationMenu: boolean;
        initialized: boolean;
    }>({
        isCEO: false,
        isAdmin: false,
        isStaff: false,
        showHomeMenu: false,
        showVacationMenu: false,
        initialized: false,
    });

    const [userPermissions, setUserPermissions] = useState<UserPermissions>(() => {
        const role = localStorage.getItem("sidebarRole");
        const position = localStorage.getItem("sidebarPosition");
        const id = localStorage.getItem("sidebarLoginId");

        const isCEO = position === "대표";
        const isAdmin = role === "admin";
        const isStaff = role === "staff";
        const showHomeMenu = isCEO || isAdmin;
        const showVacationMenu = isCEO || !isStaff;

        return {
            isCEO,
            isAdmin,
            isStaff,
            showHomeMenu,
            showVacationMenu,
            initialized: !!id, // If we have an ID, we at least have cached info
        };
    });

    const fetchUserRef = useRef<(() => Promise<void>) | null>(null);

    // 사용자 정보 로드
    useEffect(() => {
        const fetchUser = async () => {
            try {
                const {
                    data: { user },
                    error: authError,
                } = await supabase.auth.getUser();

                if (authError || !user) {
                    console.error("유저 세션 없음:", authError?.message);
                    setCurrentUser(null);
                    setCurrentUserId(null);
                    return;
                }

                setCurrentUserId(user.id);

                const sessionEmail = (user.email ?? "").toString();
                const sessionId = sessionEmail ? sessionEmail.split("@")[0] : "";

                // 새로고침 직후에도 즉시 동일하게 보이도록 캐시
                if (sessionEmail) localStorage.setItem("sidebarEmail", sessionEmail);
                if (sessionId) {
                    setSidebarLoginId(sessionId);
                    localStorage.setItem("sidebarLoginId", sessionId);
                }

                // 프로필 조회를 먼저 수행 (가장 빠르게 직급 정보 확보)
                const { data, error } = await supabase
                    .from("profiles")
                    .select("name, email, username, position, role, department")
                    .eq("id", user.id)
                    .single();

                if (error) {
                    console.error("유저 정보 조회 실패:", error.message);
                    const email = (user.email ?? "").toString();
                    const id = email ? email.split("@")[0] : "";
                    const cachedPosition = localStorage.getItem("sidebarPosition") || "";

                    setCurrentUser({
                        displayName: user.email ?? "사용자",
                        email,
                        position: cachedPosition || null,
                        role: userRole,
                        department: userDepartment,
                    });

                    if (id) {
                        setSidebarLoginId(id);
                        localStorage.setItem("sidebarLoginId", id);
                    }
                    return;
                }

                const email = (data.email ?? user.email ?? "").toString();
                if (email) localStorage.setItem("sidebarEmail", email);
                const id = email ? email.split("@")[0] : "";

                const pos = (data?.position ?? "").toString();
                if (pos) localStorage.setItem("sidebarPosition", pos);
                else localStorage.removeItem("sidebarPosition");

                // role과 department를 별도 state에 저장 (한 번 설정되면 유지)
                setUserRole(data?.role ?? null);
                setUserDepartment(data?.department ?? null);

                if (data?.role !== null && data?.role !== undefined) {
                    localStorage.setItem("sidebarRole", data.role);
                }
                if (data?.department !== null && data?.department !== undefined) {
                    localStorage.setItem("sidebarDepartment", data.department);
                }

                setCurrentUser({
                    displayName: data?.username ?? data?.name ?? (user.email ?? "사용자"),
                    email,
                    position: data?.position ?? null,
                    role: data?.role ?? null,
                    department: data?.department ?? null,
                });

                if (id) {
                    setSidebarLoginId(id);
                    localStorage.setItem("sidebarLoginId", id);
                }
            } catch (error) {
                console.error("사용자 정보 로드 중 오류:", error);
            }
        };

        fetchUserRef.current = fetchUser;
        void fetchUser();

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((event) => {
            if (
                event === "SIGNED_IN" ||
                event === "TOKEN_REFRESHED" ||
                event === "INITIAL_SESSION"
            ) {
                void fetchUserRef.current?.();
            }

            if (event === "SIGNED_OUT") {
                setCurrentUser(null);
                setCurrentUserId(null);
            }
        });

        return () => {
            subscription.unsubscribe();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // 초기 마운트 시에만 실행

    // 사용자 권한 계산
    useEffect(() => {
        if (userPermissionsRef.current.initialized) {
            return;
        }

        if (!currentUserId || !currentUser) {
            return;
        }

        const position = currentUser.position;
        const role =
            userRole !== null && userRole !== undefined
                ? userRole
                : currentUser.role || localStorage.getItem("sidebarRole");

        // 권한 계산 (한 번만 계산하고 절대 변경되지 않음)
        // 대표는 예외로 모든 권한 가짐
        const isCEO = position === "대표";
        // role만으로 판단 (공무팀/공사팀 구분 제거)
        const isAdmin = role === "admin";
        const isStaff = role === "staff";
        const showHomeMenu = isCEO || isAdmin;
        const showVacationMenu = isCEO || !isStaff;

        // ref에 저장 (절대 변경되지 않음)
        userPermissionsRef.current = {
            isCEO,
            isAdmin,
            isStaff,
            showHomeMenu,
            showVacationMenu,
            initialized: true,
        };

        // state 업데이트 (한 번만)
        setUserPermissions({
            isCEO,
            isAdmin,
            isStaff,
            showHomeMenu,
            showVacationMenu,
            initialized: true,
        });
    }, [currentUser, userRole, userDepartment]);

    const handleLogout = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) {
            console.error("로그아웃 실패:", error.message);
            return;
        }
        localStorage.removeItem("sidebarLoginId");
        localStorage.removeItem("sidebarEmail");
        localStorage.removeItem("sidebarPosition");
        localStorage.removeItem("sidebarRole");
        localStorage.removeItem("sidebarDepartment");
    };

    return {
        currentUser,
        currentUserId,
        sidebarLoginId,
        userPermissions,
        handleLogout,
    };
}
