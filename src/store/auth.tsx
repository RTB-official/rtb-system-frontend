// src/store/auth.tsx
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase"; // ✅ @/lib/supabase → 상대경로

type AuthContextValue = {
  loading: boolean;
  session: Session | null;
  user: User | null;
  signInWithEmail: (email: string, password: string) => Promise<{ ok: boolean; message?: string }>;
  signInWithUsername: (username: string, password: string) => Promise<{ ok: boolean; message?: string }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    let mounted = true;

    // 초기 세션 로드 (병렬 처리 최적화)
    const initSession = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;
        setSession(data.session ?? null);
        setLoading(false);
      } catch (error) {
        console.error("세션 로드 실패:", error);
        if (!mounted) return;
        setLoading(false);
      }
    };

    initSession();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) return;
      setSession(newSession ?? null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      loading,
      session,
      user: session?.user ?? null,

      async signInWithEmail(email, password) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) return { ok: false, message: error.message };
        return { ok: true };
      },

      async signInWithUsername(username, password) {
        const trimmedUsername = username.trim();
        
        // username으로 profiles 테이블에서 email 찾기
        // username이 "brian.ko_01b7a9" 형식으로 저장되어 있을 수 있으므로
        // 정확히 일치하거나, 입력한 username으로 시작하는 경우를 모두 확인
        let { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("email, name, username")
          .eq("username", trimmedUsername)
          .maybeSingle();

        // 정확히 일치하는 경우가 없으면, username으로 시작하는 경우 찾기
        if (!profile && !profileError) {
          const { data: profiles, error: searchError } = await supabase
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
          return { ok: false, message: "사용자명 조회 중 오류가 발생했습니다." };
        }

        if (!profile || !profile.email) {
          return { ok: false, message: `사용자명 "${trimmedUsername}"을(를) 찾을 수 없습니다. 사용자명을 확인해 주세요.` };
        }

        // 찾은 email로 로그인
        const { error } = await supabase.auth.signInWithPassword({
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

        return { ok: true };
      },

      async signOut() {
        await supabase.auth.signOut();
      },
    }),
    [loading, session]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}