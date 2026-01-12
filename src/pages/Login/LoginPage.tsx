// src/pages/Login/LoginPage.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/store/auth";

function LoginPage() {
  const nav = useNavigate();
  const { signInWithEmail } = useAuth();

  const [username, setUsername] = useState(""); // 지금은 email로 사용(나중에 username 로그인으로 교체 가능)
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [errors, setErrors] = useState<{ username?: string; password?: string; common?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: { username?: string; password?: string; common?: string } = {};

    if (!username.trim()) newErrors.username = "사용자명을 입력해 주세요";
    if (!password.trim()) newErrors.password = "비밀번호를 입력해 주세요";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setSubmitting(true);

    // ✅ Supabase Email 로그인 (현재 username 입력칸을 email로 사용)
    const res = await signInWithEmail(username.trim(), password);

    setSubmitting(false);

    if (!res.ok) {
      setErrors({ common: res.message ?? "로그인에 실패했습니다." });
      return;
    }

    // rememberMe는 Supabase 기본 persistSession(true)로 이미 유지됨.
    // (정말 rememberMe로 분기하려면, localStorage 기반 custom 처리로 확장 가능)
    nav("/dashboard", { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#F5F5F5] font-pretendard">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-3">
          <img src="/images/RTBlogo.png" alt="RTB Logo" className="h-8 w-auto" />
          <div className="flex flex-col">
            <span className="text-[#1E3A5F] font-semibold text-sm">RTB 통합 관리 시스템</span>
            <span className="text-gray-400 text-xs">Integrated Management System</span>
          </div>
        </div>
      </header>

      <main className="flex items-center justify-center min-h-[calc(100vh-73px)] px-4">
        <div className="w-full max-w-[400px] bg-white rounded-lg shadow-sm p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Login</h1>
            <p className="text-sm text-gray-500">RTB 통합 관리 시스템에 로그인하세요</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1.5">
                사용자명
              </label>
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (errors.username) setErrors((prev) => ({ ...prev, username: undefined }));
                }}
                placeholder="(현재는 이메일을 입력해 주세요)"
                className={`w-full px-4 py-3 border rounded-md text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20 focus:border-[#1E3A5F] transition-colors ${
                  errors.username ? "border-red-500 bg-red-50" : "border-gray-300 bg-white"
                }`}
              />
              {errors.username && <p className="mt-1.5 text-xs text-red-500">{errors.username}</p>}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                비밀번호
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
                }}
                placeholder="비밀번호를 입력해 주세요"
                className={`w-full px-4 py-3 border rounded-md text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20 focus:border-[#1E3A5F] transition-colors ${
                  errors.password ? "border-red-500 bg-red-50" : "border-gray-300 bg-white"
                }`}
              />
              {errors.password && <p className="mt-1.5 text-xs text-red-500">{errors.password}</p>}
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="rememberMe"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 text-[#1E3A5F] border-gray-300 rounded focus:ring-[#1E3A5F] cursor-pointer"
              />
              <label htmlFor="rememberMe" className="ml-2 text-sm text-gray-600 cursor-pointer select-none">
                로그인 상태유지
              </label>
            </div>

            {errors.common && <div className="text-sm text-red-600">{errors.common}</div>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-[#1E3A5F] hover:bg-[#152a45] disabled:opacity-60 text-white font-medium py-3 px-4 rounded-md transition-colors duration-200 text-sm"
            >
              {submitting ? "로그인 중..." : "로그인"}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}

export default LoginPage;
