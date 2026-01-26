// src/store/auth.tsx
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase"; // ✅ @/lib/supabase → 상대경로

// ✅ 로그인 전 username 조회용 (auth/session lock 분리)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

const supabasePublic = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // ✅ 메인 supabase 클라이언트와 lock/storageKey 충돌 방지
    storageKey: "sb-public-auth-token",
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

type Profile = {
  id: string;
  email: string | null;
  username: string | null;
  name: string | null;
  role: "admin" | "staff" | string | null;
  position: string | null;
  department: string | null;
};

type AuthContextValue = {
  loading: boolean;
  loadingProfile: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  signInWithEmail: (email: string, password: string) => Promise<{ ok: boolean; message?: string; role?: string }>;
  signInWithUsername: (username: string, password: string) => Promise<{ ok: boolean; message?: string; role?: string }>;
  signOut: () => Promise<void>;
};
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);

  const [loadingProfile, setLoadingProfile] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);

  const loadProfile = async (userId: string) => {
    setLoadingProfile(true);
    try {
      let data: any = null;
      let error: any = null;

      try {
        const res1 = await supabase
          .from("profiles")
          .select("id, email, username, name, role, position, department")
          .eq("id", userId)
          .single();

        data = res1.data;
        error = res1.error;
      } catch (e: any) {
        // AbortError면 1회 재시도
        if (e?.name === "AbortError") {
          const res2 = await supabase
            .from("profiles")
            .select("id, email, username, name, role, position, department")
            .eq("id", userId)
            .single();

          data = res2.data;
          error = res2.error;
        } else {
          throw e;
        }
      }


      if (error) {
        console.error("profiles 조회 실패:", error);
        setProfile(null);
        return null;
      }

      const nextProfile: Profile = {
        id: data.id,
        email: data.email ?? null,
        username: data.username ?? null,
        name: data.name ?? null,
        role: data.role ?? null,
        position: data.position ?? null,
        department: data.department ?? null,
      };

      setProfile(nextProfile);

      // ✅ Sidebar/초기 렌더 깜빡임 방지용 캐시
      localStorage.setItem("profile_role", nextProfile.role ?? "");
      localStorage.setItem("profile_position", nextProfile.position ?? "");

      return nextProfile;
    } finally {
      setLoadingProfile(false);
    }
  };


  useEffect(() => {
    let mounted = true;



    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!mounted) return;

      const nextSession = newSession ?? null;
      setSession(nextSession);

      if (!nextSession?.user?.id) {
        setProfile(null);
      }

      // ✅ INITIAL_SESSION 포함해서 여기서 로딩 종료
      if (event === "INITIAL_SESSION" || event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "TOKEN_REFRESHED") {
        setLoading(false);
      }
    });


    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) return;

    // ✅ session 생겼을 때 딱 1번 profile 로드 (중복 호출 방지)
    loadProfile(userId);
  }, [session?.user?.id]);

  const value = useMemo<AuthContextValue>(
    () => ({
      loading,
      loadingProfile,
      session,
      user: session?.user ?? null,
      profile,

      async signInWithEmail(email, password) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) return { ok: false, message: error.message };

        const userId = data.user?.id;
        if (!userId) return { ok: false, message: "사용자 정보를 확인할 수 없습니다." };

        const p = await loadProfile(userId);
        if (!p) return { ok: false, message: "프로필 정보를 불러오지 못했습니다." };

        return { ok: true, role: p.role ?? undefined };
      },

      async signInWithUsername(username, password) {
        const trimmedUsername = username.trim();

        // username으로 profiles 테이블에서 email 찾기
        // username이 "brian.ko_01b7a9" 형식으로 저장되어 있을 수 있으므로
        // 정확히 일치하거나, 입력한 username으로 시작하는 경우를 모두 확인
        let profile: any = null;
        let profileError: any = null;

        try {
          const res1 = await supabasePublic
            .from("profiles")
            .select("email, name, username")
            .eq("username", trimmedUsername)
            .maybeSingle();

          profile = res1.data;
          profileError = res1.error;
        } catch (e: any) {
          // AbortError면 1회 재시도
          if (e?.name === "AbortError") {
            const res2 = await supabasePublic
              .from("profiles")
              .select("email, name, username")
              .eq("username", trimmedUsername)
              .maybeSingle();

            profile = res2.data;
            profileError = res2.error;
          } else {
            throw e;
          }
        }



        // 정확히 일치하는 경우가 없으면, username으로 시작하는 경우 찾기
        if (!profile && !profileError) {
          const { data: profiles, error: searchError } = await supabasePublic
            .from("profiles")
            .select("email, name, username")
            .like("username", `${trimmedUsername}_%`)
            .limit(1);

          if (!searchError && profiles && profiles.length > 0) {
            profile = profiles[0];
          } else if (searchError) {
            profileError = searchError;
          }
        }


        if (profileError) {
          console.error("username lookup error:", profileError);
          return { ok: false, message: "사용자명 조회 중 오류가 발생했습니다." };
        }

        if (!profile || !profile.email) {
          return { ok: false, message: `사용자명 "${trimmedUsername}"을(를) 찾을 수 없습니다. 사용자명을 확인해 주세요.` };
        }

        // 찾은 email로 로그인
        const { data: signInData, error } = await supabase.auth.signInWithPassword({
          email: profile.email,
          password,
        });

        if (error) {
          // 500 에러인 경우 특별 처리
          if (error.status === 500) {
            return { ok: false, message: "서버 오류가 발생했습니다. Supabase Dashboard의 Logs를 확인해주세요." };
          }

          // 비밀번호 오류인 경우 더 명확한 메시지
          if (error.message.includes("password") || error.message.includes("Invalid login") || error.message.includes("Invalid credentials")) {
            return { ok: false, message: "비밀번호가 올바르지 않습니다." };
          }
          return { ok: false, message: error.message };
        }

        const userId = signInData.user?.id;
        if (!userId) return { ok: false, message: "사용자 정보를 확인할 수 없습니다." };

        const p = await loadProfile(userId);
        if (!p) return { ok: false, message: "프로필 정보를 불러오지 못했습니다." };

        return { ok: true, role: p.role ?? undefined };
      },

      async signOut() {
        localStorage.removeItem("profile_role");
        localStorage.removeItem("profile_position");
        setProfile(null);
        await supabase.auth.signOut();
      },
    }),
    [loading, loadingProfile, session, profile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}