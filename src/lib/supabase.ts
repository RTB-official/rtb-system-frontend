// src/lib/supabase.ts
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

const REMEMBER_ME_KEY = "rtb:remember_me";

export function setRememberMe(remember: boolean) {
  if (remember) localStorage.setItem(REMEMBER_ME_KEY, "1");
  else localStorage.removeItem(REMEMBER_ME_KEY);
}

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase environment variables. Please check your .env.local file."
  );
}

// ✅ 핵심: supabase 클라이언트 생성 + named export
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

/** Supabase auth lock / fetch 중단 등 일시적 AbortError 판별 */
export function isSupabaseAbortError(err: unknown): boolean {
  if (err instanceof DOMException && err.name === "AbortError") return true;
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return msg.includes("signal is aborted") || msg.includes("aborted without reason");
  }
  return false;
}

/** AbortError 등 일시적 네트워크/락 오류 시 짧게 재시도 */
export async function withSupabaseRetry<T>(
  fn: () => Promise<T>,
  options?: { maxAttempts?: number; delayMs?: number }
): Promise<T> {
  const maxAttempts = options?.maxAttempts ?? 3;
  const delayMs = options?.delayMs ?? 300;
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (!isSupabaseAbortError(err) || attempt >= maxAttempts - 1) {
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs * (attempt + 1)));
    }
  }

  throw lastError;
}

export function formatSupabaseErrorMessage(err: unknown, fallback = "알 수 없는 오류가 발생했습니다."): string {
  if (isSupabaseAbortError(err)) {
    return "요청이 중단되었습니다. 잠시 후 다시 시도해 주세요.";
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}
