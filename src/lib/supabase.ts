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
