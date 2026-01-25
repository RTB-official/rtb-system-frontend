

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/common/Header";
import Button from "../../components/common/Button";
import { supabase } from "../../lib/supabase";
import { useToast } from "../../components/ui/ToastProvider";

export default function SafePhrasePage() {
  const { showError, showSuccess } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const nav = useNavigate();

  const [userId, setUserId] = useState<string | null>(null);
  const [phrase, setPhrase] = useState("");
  const [saving, setSaving] = useState(false);

  const safePhraseKey = useMemo(
    () => (userId ? `rtb:safe_phrase:${userId}` : ""),
    [userId]
  );

  const loadUser = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) {
      showError("로그인이 필요합니다.");
      return null;
    }
    setUserId(user.id);
    return user;
  }, [showError]);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  useEffect(() => {
    if (!userId) return;
    try {
      const v = localStorage.getItem(safePhraseKey);
      setPhrase(v ?? "");
    } catch {
      // ignore
    }
  }, [userId, safePhraseKey]);

  const handleSave = async () => {
    if (!userId) {
      showError("로그인이 필요합니다.");
      return;
    }
    setSaving(true);
    try {
      localStorage.setItem(safePhraseKey, phrase.trim());
      showSuccess("저장되었습니다.");
    } catch (e: any) {
      console.error(e);
      showError(e?.message ?? "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-screen bg-white font-pretendard overflow-hidden">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div
        className={`fixed lg:static inset-y-0 left-0 z-50 transform ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0 transition-transform duration-300 ease-in-out`}
      >
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header title="안전 문구 설정" onMenuClick={() => setSidebarOpen(true)} />

        <main className="flex-1 overflow-auto pt-8 pb-20 px-4 sm:px-6 lg:px-10 bg-gray-50">
          <div className="w-full max-w-none">
            <div className="mb-5 flex items-center justify-between">
              <button
                type="button"
                onClick={() => nav("/settings")}
                className="text-sm text-gray-600 hover:text-gray-900 font-semibold"
              >
                ← 설정으로
              </button>
              <div className="text-[12px] text-gray-500">{saving ? "저장 중..." : ""}</div>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-100">
                <h2 className="text-[18px] font-bold text-gray-900">안전 문구</h2>
                <p className="text-[13px] text-gray-500 mt-1">
                  예: 외부 반출 금지, 개인정보 주의 등 안내 문구를 입력하세요.
                </p>
              </div>

              <div className="px-6 py-5">
                <div className="text-[13px] font-medium text-gray-700 mb-2">문구</div>
                <textarea
                  value={phrase}
                  onChange={(e) => setPhrase(e.target.value)}
                  placeholder="안전/주의 문구를 입력해 주세요"
                  className="w-full min-h-[140px] px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                />
                <div className="mt-2 text-[12px] text-gray-500">
                  * 현재는 브라우저에 로컬 저장됩니다. (추후 DB 저장으로 쉽게 교체 가능)
                </div>
              </div>

              <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
                <Button variant="primary" size="lg" onClick={handleSave} disabled={saving}>
                  저장
                </Button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}