//SafePhrase.tsx
import { useCallback, useEffect, useState } from "react";
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

  // ✅ 안전슬로건 이미지
  const [sloganImage, setSloganImage] = useState<string>("");

  const [saving, setSaving] = useState(false);



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

    const load = async () => {
      try {
        const { data, error } = await supabase
        .from("safe_settings")
        .select("safe_phrase, slogan_path")
        .eq("id", 1)
        .maybeSingle();

        if (error) {
          console.error(error);
          showError("안전 설정을 불러오지 못했습니다.");
          return;
        }

        setPhrase(data?.safe_phrase ?? "");

        const path = data?.slogan_path;
        if (path) {
          const { data: signed, error: signErr } = await supabase.storage
            .from("safe-slogans")
            .createSignedUrl(path, 60 * 60); // 1시간

          if (signErr) {
            console.error(signErr);
            setSloganImage("");
          } else {
            setSloganImage(signed.signedUrl);
          }
        } else {
          setSloganImage("");
        }
      } catch (e) {
        console.error(e);
        showError("안전 설정 로드 중 오류가 발생했습니다.");
      }
    };

    load();
  }, [userId, showError]);


  const handleSloganImageChange = async (file: File | null) => {
    if (!userId) {
      showError("로그인이 필요합니다.");
      return;
    }
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showError("이미지 파일만 업로드할 수 있습니다.");
      return;
    }

    setSaving(true);
    try {
// 1) Storage 업로드 (공용 경로)
const objectPath = `global/slogan.png`;


      // ✅ 1) 먼저 upload 시도 → 이미 있으면 update로 재시도
      let upErr: any = null;

      const uploadRes = await supabase.storage
        .from("safe-slogans")
        .upload(objectPath, file, {
          contentType: file.type,
        });

      upErr = uploadRes.error;

      // 파일이 이미 존재하면 update로 교체 업로드
      if (upErr) {
        const updateRes = await supabase.storage
          .from("safe-slogans")
          .update(objectPath, file, { contentType: file.type });

        upErr = updateRes.error;
      }

      if (upErr) {
        console.error(upErr);
        showError(upErr.message ?? "이미지 업로드에 실패했습니다.");
        return;
      }



      // 2) DB에 경로 저장 (버킷 내부 경로로 저장)
      const { error: dbErr } = await supabase
      .from("safe_settings")
      .upsert(
        {
          id: 1,
          slogan_path: objectPath,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );
    

      if (dbErr) {
        console.error(dbErr);
        showError("이미지 경로 저장에 실패했습니다.");
        return;
      }

      // 3) signed url로 표시
      const { data: signed, error: signErr } = await supabase.storage
        .from("safe-slogans")
        .createSignedUrl(objectPath, 60 * 60);

      if (signErr) {
        console.error(signErr);
        showError("이미지 표시용 URL 생성 실패");
        return;
      }

      setSloganImage(signed.signedUrl);
      showSuccess("이미지가 저장되었습니다.");
    } catch (e: any) {
      console.error(e);
      showError(e?.message ?? "이미지 저장 실패");
    } finally {
      setSaving(false);
    }
  };



  const handleSloganImageRemove = async () => {
    if (!userId) {
      showError("로그인이 필요합니다.");
      return;
    }

    setSaving(true);
    try {
      const objectPath = `global/slogan.png`;

      // 1) Storage 파일 삭제(없어도 에러 안 나올 수 있음)
      const { error: delErr } = await supabase.storage
        .from("safe-slogans")
        .remove([objectPath]);

      if (delErr) {
        console.error(delErr);
        // 파일이 없을 수도 있으니 진행은 계속
      }

      // 2) DB 경로 제거
      const { error: dbErr } = await supabase
      .from("safe_settings")
      .upsert(
        {
          id: 1,
          slogan_path: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );
    

      if (dbErr) {
        console.error(dbErr);
        showError("DB 업데이트 실패");
        return;
      }

      setSloganImage("");
      showSuccess("이미지가 삭제되었습니다.");
    } catch (e: any) {
      console.error(e);
      showError(e?.message ?? "이미지 삭제 실패");
    } finally {
      setSaving(false);
    }
  };


  const handleSave = async () => {
    if (!userId) {
      showError("로그인이 필요합니다.");
      return;
    }

    setSaving(true);
    try {
      const next = phrase.trim();

      // (옵션) 기존 값 읽어서 변경 여부 확인
      const { data: prev, error: prevErr } = await supabase
      .from("safe_settings")
      .select("safe_phrase")
      .eq("id", 1)
      .single();
    

      if (prevErr) {
        console.error(prevErr);
      }

      // 1) 현재값 upsert
      const { error: upErr } = await supabase
      .from("safe_settings")
      .upsert(
        {
          id: 1,
          safe_phrase: next,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );

      if (upErr) {
        console.error(upErr);
        showError("저장 실패");
        return;
      }

      // 2) 변경되었을 때만 히스토리 저장(권장)
      if ((prev?.safe_phrase ?? "") !== next) {
        const { error: histErr } = await supabase
          .from("safe_phrase_history")
          .insert({ user_id: userId, phrase: next });

        if (histErr) {
          console.error(histErr);
          // 히스토리 실패는 치명적이지 않게 처리 가능
        }
      }

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
                {/* ✅ 안전슬로건 이미지 섹션 */}
                <div className="mt-6">
                  <div className="text-[13px] font-medium text-gray-700 mb-2">
                    안전슬로건 이미지
                  </div>

                  <div className="flex items-center gap-3">
                    <label className="inline-flex items-center justify-center px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-800 hover:bg-gray-50 cursor-pointer">
                      이미지 업로드
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) =>
                          handleSloganImageChange(e.target.files?.[0] ?? null)
                        }
                      />
                    </label>

                    {sloganImage && (
                      <button
                        type="button"
                        onClick={handleSloganImageRemove}
                        className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                      >
                        삭제
                      </button>
                    )}
                  </div>

                  {sloganImage ? (
                    <div className="mt-3 border border-gray-200 rounded-2xl overflow-hidden bg-gray-50">
                      <img
                        src={sloganImage}
                        alt="안전슬로건"
                        className="w-full max-h-[260px] object-contain bg-white"
                      />
                    </div>
                  ) : (
                    <div className="mt-3 text-[12px] text-gray-500">
                      * 업로드한 이미지는 브라우저에 로컬 저장됩니다.
                    </div>
                  )}
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