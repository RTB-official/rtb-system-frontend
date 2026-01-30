// src/pages/Settings/WebNotificationSettingsPage.tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/common/Header";
import Button from "../../components/common/Button";
import { supabase } from "../../lib/supabase";
import { useToast } from "../../components/ui/ToastProvider";
import { useNavigate } from "react-router-dom";

import {
    IconHome,
    IconReport,
    IconCard,
    IconVacation,
    IconMembers,
  } from "../../components/icons/Icons";

type WebNotiKey =
  | "vacation_create"
  | "vacation_decision"
  | "dashboard_schedule_add"
  | "expense_create"
  | "biz_report_submit_update"
  | "member_passport_expiry";

type WebPrefsRow = {
  user_id: string;
  prefs: Record<WebNotiKey, boolean> | null;
  updated_at?: string;
};

const DEFAULT_PREFS: Record<WebNotiKey, boolean> = {
  vacation_create: true,
  vacation_decision: true,
  dashboard_schedule_add: true,
  expense_create: true,
  biz_report_submit_update: true,
  member_passport_expiry: true,
};

function safeMergePrefs(
  fromDb: WebPrefsRow["prefs"] | undefined | null
): Record<WebNotiKey, boolean> {
  return {
    ...DEFAULT_PREFS,
    ...(fromDb ?? {}),
  };
}

export default function WebNotificationSettingsPage() {
  const { showSuccess, showError } = useToast();
  const nav = useNavigate();

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [userId, setUserId] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<Record<WebNotiKey, boolean>>(DEFAULT_PREFS);

  const sections = useMemo(
    () => [
      {
        title: "홈",
        icon: <IconHome />,
        items: [
          {
            key: "dashboard_schedule_add" as const,
            label: "일정 추가 알림",
            desc: "홈에서 일정이 추가되면 웹 알림을 받습니다.",
          },
        ],
      },
      {
        title: "출장 보고서",
        icon: <IconReport />,
        items: [
          {
            key: "biz_report_submit_update" as const,
            label: "제출 및 수정 알림",
            desc: "출장 보고서 제출 또는 수정 시 웹 알림을 받습니다.",
          },
        ],
      },
      {
        title: "지출 관리",
        icon: <IconCard />,
        items: [
          {
            key: "expense_create" as const,
            label: "개인 지출 등록 알림",
            desc: "개인 지출이 등록되면 웹 알림을 받습니다.",
          },
        ],
      },
      {
        title: "휴가 관리",
        icon: <IconVacation />,
        items: [
          {
            key: "vacation_create" as const,
            label: "휴가 등록 알림",
            desc: "휴가가 등록되면 웹 알림을 받습니다.",
          },
          {
            key: "vacation_decision" as const,
            label: "휴가 승인/거절 알림",
            desc: "휴가가 승인 또는 거절되면 웹 알림을 받습니다.",
          },
        ],
      },
      {
        title: "구성원 관리",
        icon: <IconMembers />,
        items: [
          {
            key: "member_passport_expiry" as const,
            label: "여권 만료 알림",
            desc: "구성원 여권 만료 시 웹 알림을 받습니다.",
          },
        ],
      },
    ],
    []
  );


  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      if (!user) {
        showError("로그인이 필요합니다.");
        setLoading(false);
        return;
      }

      setUserId(user.id);

      const { data, error } = await supabase
        .from("notification_web_prefs")
        .select("user_id, prefs, updated_at")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("notification_web_prefs 조회 실패:", error);
        // 테이블이 없거나 권한 문제 등이어도 페이지는 열리게(기본값 유지)
        setPrefs(DEFAULT_PREFS);
        setLoading(false);
        return;
      }

      const row = (data as WebPrefsRow | null) ?? null;
      setPrefs(safeMergePrefs(row?.prefs));
    } catch (e: any) {
      console.error(e);
      showError(e?.message ?? "설정 로드 실패");
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persist = useCallback(
    async (next: Record<WebNotiKey, boolean>) => {
      if (!userId) return;
      setSaving(true);
      try {
        const payload: WebPrefsRow = {
          user_id: userId,
          prefs: next,
        };

        const { error } = await supabase
          .from("notification_web_prefs")
          .upsert(payload, { onConflict: "user_id" });

        if (error) {
          console.error("notification_web_prefs 저장 실패:", error);
          throw new Error(error.message);
        }

        showSuccess("저장되었습니다.");
      } catch (e: any) {
        console.error(e);
        showError(e?.message ?? "저장 실패");
      } finally {
        setSaving(false);
      }
    },
    [showError, showSuccess, userId]
  );

  const toggle = (k: WebNotiKey) => {
    setPrefs((p) => ({ ...p, [k]: !p[k] }));
  };

  const SettingToggleRow = ({
    label,
    desc,
    checked,
    onChange,
  }: {
    label: string;
    desc?: string;
    checked: boolean;
    onChange: (v: boolean) => void;
  }) => (
    <div className="w-full px-6 py-5 flex items-center justify-between gap-4 border-b border-gray-100 last:border-0">
      <div className="min-w-0">
        <div className="text-[15px] font-bold text-gray-900">{label}</div>
        {desc ? <div className="text-[12px] text-gray-500 mt-1">{desc}</div> : null}
      </div>

      <div className="shrink-0 flex items-center gap-3">
        <span className="text-[12px] text-gray-500 font-semibold">
          {checked ? "ON" : "OFF"}
        </span>

        <label className="inline-flex items-center cursor-pointer select-none">
          <input
            type="checkbox"
            className="sr-only"
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
          />
          <div
            className={`w-12 h-7 rounded-full relative transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              checked ? "bg-[#1E3A5F]" : "bg-gray-300"
            }`}
          >
            <div
              className={`w-6 h-6 bg-white rounded-full absolute top-0.5 transform-gpu will-change-transform transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                checked
                  ? "translate-x-5 shadow-md"
                  : "translate-x-0.5 shadow"
              }`}
            />
          </div>


        </label>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-white font-pretendard overflow-hidden">
      {/* 모바일 오버레이 */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed lg:static inset-y-0 left-0 z-50 transform ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0 transition-transform duration-300 ease-in-out`}
      >
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header title="웹 알림 설정" onMenuClick={() => setSidebarOpen(true)} />

        <main className="flex-1 overflow-auto pt-8 pb-20 px-4 sm:px-6 lg:px-10 bg-gray-50">
          <div className="w-full max-w-none mb-5 flex items-center justify-between">
            <button
              type="button"
              onClick={() => nav("/settings")}
              className="text-sm text-gray-600 hover:text-gray-900 font-semibold"
            >
              ← 설정으로
            </button>

            <div className="flex items-center gap-2">
              <div className="text-[12px] text-gray-500">{saving ? "저장 중..." : ""}</div>
              <Button
                variant="primary"
                size="lg"
                onClick={() => persist(prefs)}
                disabled={saving || !userId}
              >
                저장
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="w-full max-w-none">
              <div className="h-6 w-56 bg-gray-100 rounded animate-pulse mb-4" />
              <div className="h-36 bg-gray-100 rounded-2xl animate-pulse mb-4" />
              <div className="h-60 bg-gray-100 rounded-2xl animate-pulse" />
            </div>
          ) : (
            <div className="w-full max-w-none flex flex-col gap-5">
              {sections.map((sec) => (
                <div key={sec.title} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <div>
                    <div className="flex items-center gap-2">
                        <span className="text-gray-700">{sec.icon}</span>
                        <div className="text-[16px] font-bold text-gray-900">{sec.title}</div>
                      </div>
                      <div className="text-[12px] text-gray-500 mt-0.5"></div>
                    </div>
                  </div>

                  {sec.items.map((it) => (
                    <SettingToggleRow
                      key={it.key}
                      label={it.label}
                      desc={it.desc}
                      checked={!!prefs[it.key]}
                      onChange={() => toggle(it.key)}
                    />
                  ))}
                </div>
              ))}

              <div className="text-[12px] text-gray-500 px-1">
                * 저장 버튼을 눌러야 변경사항이 반영됩니다.
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
