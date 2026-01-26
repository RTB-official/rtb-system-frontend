// src/pages/Login/LoginPage.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../store/auth";
import { IconEye, IconEyeOff } from "../../components/icons/Icons";
import Input from "../../components/common/Input";
import Button from "../../components/common/Button";

function LoginPage() {
  const nav = useNavigate();
  const { signInWithUsername } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [errors, setErrors] = useState<{ username?: string; password?: string; common?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: { username?: string; password?: string; common?: string } = {};
    if (!username.trim()) newErrors.username = "사용자명을 입력해 주세요";
    if (!password.trim()) {
      newErrors.password = "비밀번호를 입력해 주세요";
    } else if (password.length < 6) {
      newErrors.password = "비밀번호는 최소 6자 이상이어야 합니다.";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setSubmitting(true);

    const res = await signInWithUsername(username.trim(), password);

    setSubmitting(false);

    if (!res.ok) {
      setErrors({ common: res.message ?? "로그인에 실패했습니다." });
      return;
    }

    // rememberMe는 Supabase 기본 persistSession(true)로 이미 유지됨.
    // (정말 rememberMe로 분기하려면, localStorage 기반 custom 처리로 확장 가능)

    // ✅ 로그인 성공 시: 안전 토스트를 "딱 1회" 띄우기 위한 pending 플래그
    sessionStorage.setItem("rtb:safety_toast_pending", "1");

    const nextRole = res.role;
    if (nextRole === "admin") {
      nav("/dashboard", { replace: true });
    } else {
      nav("/report", { replace: true });
    }

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

      <main className="flex items-center justify-center min-h-[calc(100vh-100px)] px-4">
        <div className="w-full max-w-[400px] bg-white rounded-2xl p-8 border border-gray-200">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Login</h1>
            <p className="text-base text-gray-500">RTB 통합 관리 시스템에 로그인하세요</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              label="사용자명"
              value={username}
              placeholder="사용자명을 입력해 주세요 (예: ck.kim)"
              autoComplete="username"
              error={errors.username}
              onChange={(val) => {
                const lower = val.toLowerCase();
                setUsername(lower);
                if (errors.username) setErrors((prev) => ({ ...prev, username: undefined }));
              }}
              // 기존 input과 비슷한 느낌 유지
              labelClassName="mb-0"
            />

            {/* ✅ Password Input + 클릭 가능한 아이콘 */}
            <Input
              label="비밀번호"
              type={showPassword ? "text" : "password"}
              value={password}
              placeholder="비밀번호를 입력해 주세요"
              autoComplete="current-password"
              error={errors.password}
              onChange={(val) => {
                setPassword(val);
                if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
              }}
              icon={showPassword ? <IconEyeOff className="w-5 h-5" /> : <IconEye className="w-5 h-5" />}
              iconPosition="right"
              iconClickable
              iconAriaLabel={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
              onIconClick={() => setShowPassword((v) => !v)}
            />

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

            {/* ✅ Button 컴포넌트 적용 */}
            <Button
              type="submit"
              disabled={submitting}
              fullWidth
              size="lg"
              className="bg-[#1E3A5F] hover:bg-[#152a45] focus:ring-[#1E3A5F]"
            >
              {submitting ? "로그인 중..." : "로그인"}
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}

export default LoginPage;