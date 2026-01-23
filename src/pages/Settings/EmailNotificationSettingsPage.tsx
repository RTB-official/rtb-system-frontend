// src/pages/Settings/EmailNotificationSettingsPage.tsx
import { useEffect, useMemo, useState } from "react";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/common/Header";
import Button from "../../components/common/Button";
import Avatar from "../../components/common/Avatar";
import { supabase } from "../../lib/supabase";
import { useToast } from "../../components/ui/ToastProvider";

type NotiType = "report" | "vacation" | "schedule";

type EmailPref = {
  id: string; // local id
  email: string;
  enabled: boolean;
  types: Record<NotiType, boolean>;
};

type PrefRow = {
  user_id: string;
  // ✅ DB jsonb targets 가정: notification_email_prefs(user_id, targets)
  targets: Array<{
    email: string;
    enabled: boolean;
    types: NotiType[];
  }> | null;
  updated_at?: string;
};

const TYPE_LABEL: Record<NotiType, string> = {
  report: "보고서",
  vacation: "휴가",
  schedule: "일정",
};

const makeId = () => `t-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const typesToArray = (t: Record<NotiType, boolean>): NotiType[] =>
  (Object.keys(t) as NotiType[]).filter((k) => t[k]);

const arrayToTypes = (arr?: NotiType[] | null): Record<NotiType, boolean> => ({
  report: !!arr?.includes("report"),
  vacation: !!arr?.includes("vacation"),
  schedule: !!arr?.includes("schedule"),
});

const defaultTypes = (): Record<NotiType, boolean> => ({
  report: true,
  vacation: true,
  schedule: true,
});

// ✅ 직급 순서 (높은 순)
const POSITION_ORDER: Record<string, number> = {
    "대표": 1,
    "감사": 2,
    "부장": 3,
    "차장": 4,
    "과장": 5,
    "대리": 6,
    "주임": 7,
    "사원": 8,
    "인턴": 9,
  };

export default function EmailNotificationSettingsPage() {
  const { showSuccess, showError } = useToast();

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [userId, setUserId] = useState<string | null>(null);

  // 목록(카드)
  const [list, setList] = useState<EmailPref[]>([]);

  // ✅ 관리자(공무팀 + admin) 전용 명단 섹션
  const [canSeeAdminList, setCanSeeAdminList] = useState(false);
  const [adminMembers, setAdminMembers] = useState<
    Array<{ id: string; name: string; username: string; email: string; position: string }>
  >([]);
  const [adminMembersLoading, setAdminMembersLoading] = useState(false);

  // 1) 이메일 추가 섹션 폼
  const [newEmail, setNewEmail] = useState("");
  const [newEnabled, setNewEnabled] = useState(true);
  const [newTypes, setNewTypes] = useState<Record<NotiType, boolean>>(defaultTypes());

  // 2) 편집 모달(카드 클릭 시)
  const [editOpen, setEditOpen] = useState(false);
  const [editItem, setEditItem] = useState<EmailPref | null>(null);

  const normalizedNewEmail = useMemo(() => newEmail.trim().toLowerCase(), [newEmail]);

  const hasAnyType = (types: Record<NotiType, boolean>) =>
    (Object.keys(types) as NotiType[]).some((k) => types[k]);

  const isValidEmail = (email: string) => {
    // 너무 빡빡하게 안 잡고 기본 형식만
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  // DB 저장/로드 (targets jsonb 가정)
  const loadPrefs = async () => {
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

            // ✅ 현재 사용자 권한 체크: 공무팀 + admin 일 때만 우측 명단 섹션 표시
            const { data: myProfile, error: myProfileErr } = await supabase
            .from("profiles")
            .select("role, department")
            .eq("id", user.id)
            .single();
    
          if (myProfileErr) {
            console.error("내 profiles 조회 실패:", myProfileErr);
          }
    
          const canSee =
            myProfile?.department === "공무팀" && myProfile?.role === "admin";
          setCanSeeAdminList(!!canSee);
    
          // ✅ 조건 만족 시: 공무팀 + role=admin 명단 조회
          if (canSee) {
            setAdminMembersLoading(true);
            const { data: admins, error: adminsErr } = await supabase
              .from("profiles")
              .select("id, name, username, email, position")
              .eq("department", "공무팀")
              .eq("role", "admin")
              .order("name", { ascending: true });
    
            if (adminsErr) {
              console.error("공무팀 admin 명단 조회 실패:", adminsErr);
              setAdminMembers([]);
            } else {
                const mappedAdmins = (admins || []).map((a: any) => ({
                    id: a.id,
                    name: a.name ?? "",
                    username: a.username ?? "",
                    email: a.email ?? "",
                    position: a.position ?? "",
                  }));
                  
                  // ✅ 직급 순 정렬(대표→…→인턴), 같은 직급이면 이름순
                  mappedAdmins.sort((a, b) => {
                    const oa = POSITION_ORDER[a.position] ?? 999;
                    const ob = POSITION_ORDER[b.position] ?? 999;
                  
                    if (oa !== ob) return oa - ob;
                    return (a.name || "").localeCompare(b.name || "");
                  });
                  
                  setAdminMembers(mappedAdmins);
                  
    
            }
            setAdminMembersLoading(false);
          } else {
            setAdminMembers([]);
          }
    


      const { data: pref, error: prefErr } = await supabase
        .from("notification_email_prefs")
        .select("user_id, targets, updated_at")
        .eq("user_id", user.id)
        .maybeSingle();

      if (prefErr) {
        console.error("notification_email_prefs 조회 실패:", prefErr);
      }

      const p = (pref as PrefRow | null) ?? null;
      const targets = (p?.targets ?? []) as NonNullable<PrefRow["targets"]>;

      const nextList: EmailPref[] = (targets || []).map((t) => ({
        id: makeId(),
        email: (t.email ?? "").trim().toLowerCase(),
        enabled: !!t.enabled,
        types: arrayToTypes(t.types ?? []),
      }));

      setList(nextList);
    } catch (e: any) {
      console.error(e);
      showError(e?.message ?? "설정 로드 실패");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPrefs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persist = async (nextList: EmailPref[]) => {
    if (!userId) return;
    setSaving(true);
    try {
      const payload: PrefRow = {
        user_id: userId,
        targets: nextList
          .map((x) => ({
            email: x.email.trim().toLowerCase(),
            enabled: x.enabled,
            types: typesToArray(x.types),
          }))
          .filter((x) => !!x.email),
      };

      const { error } = await supabase
        .from("notification_email_prefs")
        .upsert(payload, { onConflict: "user_id" });

      if (error) {
        console.error("prefs 저장 실패:", error);
        throw new Error(error.message);
      }

      showSuccess("저장되었습니다.");
    } catch (e: any) {
      console.error(e);
      showError(e?.message ?? "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  // ====== 1) 추가 섹션 핸들러 ======
  const handleAdd = async () => {
    const email = normalizedNewEmail;

    if (!email) {
      showError("이메일을 입력해 주세요.");
      return;
    }
    if (!isValidEmail(email)) {
      showError("이메일 형식이 올바르지 않습니다.");
      return;
    }
    if (newEnabled && !hasAnyType(newTypes)) {
      showError("받을 알림 유형을 최소 1개 선택해 주세요.");
      return;
    }
    if (list.some((x) => x.email === email)) {
      showError("이미 등록된 이메일입니다.");
      return;
    }

    const next: EmailPref[] = [
      ...list,
      { id: makeId(), email, enabled: newEnabled, types: { ...newTypes } },
    ];
    setList(next);

    // 폼 리셋
    setNewEmail("");
    setNewEnabled(true);
    setNewTypes(defaultTypes());

    await persist(next);
  };

  // ====== 2) 카드 클릭 -> 편집 ======
  const openEdit = (item: EmailPref) => {
    setEditItem(JSON.parse(JSON.stringify(item)));
    setEditOpen(true);
  };

  const closeEdit = () => {
    setEditOpen(false);
    setEditItem(null);
  };

  const handleEditSave = async () => {
    if (!editItem) return;

    const email = editItem.email.trim().toLowerCase();

    if (!email) {
      showError("이메일을 입력해 주세요.");
      return;
    }
    if (!isValidEmail(email)) {
      showError("이메일 형식이 올바르지 않습니다.");
      return;
    }
    if (editItem.enabled && !hasAnyType(editItem.types)) {
      showError("받을 알림 유형을 최소 1개 선택해 주세요.");
      return;
    }
    // 이메일 변경 시 중복 체크
    const dup = list.some((x) => x.email === email && x.id !== editItem.id);
    if (dup) {
      showError("이미 등록된 이메일입니다.");
      return;
    }

    const next = list.map((x) =>
      x.id === editItem.id ? { ...editItem, email } : x
    );

    setList(next);
    closeEdit();
    await persist(next);
  };

  const handleDelete = async (id: string) => {
    const next = list.filter((x) => x.id !== id);
    setList(next);
    closeEdit();
    await persist(next);
  };

  const toggleTypeIn = (types: Record<NotiType, boolean>, k: NotiType) => ({
    ...types,
    [k]: !types[k],
  });

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
        <Header title="이메일 알림 설정" onMenuClick={() => setSidebarOpen(true)} />

        <main className="flex-1 overflow-auto pt-8 pb-20 px-6 lg:px-10">
          {loading ? (
            <div className="max-w-[980px]">
              <div className="h-6 w-56 bg-gray-100 rounded animate-pulse mb-4" />
              <div className="h-36 bg-gray-100 rounded-2xl animate-pulse mb-4" />
              <div className="h-60 bg-gray-100 rounded-2xl animate-pulse" />
            </div>
          ) : (
            <div className="max-w-[1280px] w-full grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5">

              {/* ✅ 좌측 컬럼 (이메일 추가 + 이메일 목록) */}
              <div className="flex flex-col gap-5">

                {/* 1. 이메일 추가 섹션 */}
                <div className="bg-white border border-gray-200 rounded-2xl p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-[18px] font-bold text-gray-900">
                        이메일 추가
                      </h2>
                      <p className="text-[13px] text-gray-500 mt-1">

                      </p>
                    </div>

                    <div className="text-[12px] text-gray-500">
                      {saving ? "저장 중..." : ""}
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4 items-start">
                    {/* 이메일 입력 */}
                    <div>
                      <div className="text-[13px] font-medium text-gray-700 mb-2">
                        이메일
                      </div>
                      <input
                        type="email"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        placeholder="예: user@company.com"
                        className="w-full h-12 px-4 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20 focus:border-[#1E3A5F]"
                      />
                    </div>

                    {/* on/off */}
                    <div className="lg:pt-6 flex items-center gap-3 justify-end">
                      <span className="text-[13px] text-gray-700 font-medium">
                        알림
                      </span>

                      <label className="inline-flex items-center cursor-pointer select-none">
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={newEnabled}
                          onChange={(e) => setNewEnabled(e.target.checked)}
                        />
                        <div
                          className={`w-12 h-7 rounded-full transition-colors ${
                            newEnabled ? "bg-[#1E3A5F]" : "bg-gray-300"
                          } relative`}
                        >
                          <div
                            className={`w-6 h-6 bg-white rounded-full shadow absolute top-0.5 transition-transform ${
                              newEnabled ? "translate-x-5" : "translate-x-0.5"
                            }`}
                          />
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* 타입 선택 */}
                  <div className="mt-4">
                    <div className="text-[13px] font-medium text-gray-700 mb-2">
                      받을 알림 유형
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {(Object.keys(TYPE_LABEL) as NotiType[]).map((k) => (
                        <label
                          key={k}
                          className={`flex items-center gap-3 p-4 rounded-2xl border transition-colors cursor-pointer ${
                            newTypes[k]
                              ? "border-[#1E3A5F]/40 bg-[#1E3A5F]/5"
                              : "border-gray-200 bg-white hover:bg-gray-50"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={newTypes[k]}
                            onChange={() => setNewTypes((p) => toggleTypeIn(p, k))}
                            className="w-4 h-4 accent-[#1E3A5F]"
                          />
                          <div className="text-[14px] font-semibold text-gray-900">
                            {TYPE_LABEL[k]}
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="mt-5 flex justify-end">
                    <Button
                      variant="primary"
                      size="lg"
                      onClick={handleAdd}
                      disabled={saving}
                    >
                      추가
                    </Button>
                  </div>
                </div>

                {/* 2. 이메일 목록 섹션 */}
                <div className="bg-white border border-gray-200 rounded-2xl p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-[18px] font-bold text-gray-900">
                        이메일 목록
                      </h2>
                      <p className="text-[13px] text-gray-500 mt-1">

                      </p>
                    </div>
                    <div className="text-[12px] text-gray-500">
                      {list.length}개
                    </div>
                  </div>

                  {list.length === 0 ? (
                    <div className="py-10 text-center text-gray-400">
                      등록된 이메일이 없습니다.
                    </div>
                  ) : (
                    <div className="mt-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {list.map((item) => {
                        const selected = typesToArray(item.types);
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => openEdit(item)}
                            className="text-left border border-gray-200 rounded-2xl p-5 bg-white hover:bg-gray-50 transition-colors"
                            title="클릭하여 수정"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-[15px] font-bold text-gray-900 truncate">
                                  {item.email}
                                </div>
                                <div className="text-[12px] text-gray-500 mt-1">
                                  {item.enabled ? "" : ""}
                                </div>
                              </div>

                              <div
                                className={`shrink-0 px-2.5 py-1 rounded-full text-[12px] font-semibold ${
                                  item.enabled
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : "bg-gray-100 text-gray-600 border border-gray-200"
                                }`}
                              >
                                {item.enabled ? "ON" : "OFF"}
                              </div>
                            </div>

                            <div className="mt-4 flex flex-wrap gap-2">
                              {(["report", "vacation", "schedule"] as NotiType[]).map((k) => {
                                const on = item.types[k];
                                return (
                                  <span
                                    key={k}
                                    className={`px-2.5 py-1 rounded-full text-[12px] border ${
                                      on
                                        ? "bg-[#1E3A5F]/5 text-[#1E3A5F] border-[#1E3A5F]/20"
                                        : "bg-gray-50 text-gray-400 border-gray-200"
                                    }`}
                                  >
                                    {TYPE_LABEL[k]}
                                  </span>
                                );
                              })}
                            </div>

                            <div className="mt-4 text-[12px] text-gray-500">

                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

              </div>

              {/* ✅ 우측 컬럼: 여기다가 관리자 명단 섹션을 넣으면 됨 */}
              {canSeeAdminList ? (
                <div className="bg-white border border-gray-200 rounded-2xl p-6 h-fit">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-[18px] font-bold text-gray-900">
                        공무팀
                      </h2>
                      <p className="text-[13px] text-gray-500 mt-1">

                      </p>
                    </div>
                    <div className="text-[12px] text-gray-500">
                      {adminMembers.length}명
                    </div>
                  </div>

                  {adminMembersLoading ? (
                    <div className="mt-6 text-sm text-gray-500">로딩 중...</div>
                  ) : adminMembers.length === 0 ? (
                    <div className="mt-6 text-sm text-gray-400">
                      표시할 명단이 없습니다.
                    </div>
                  ) : (
                    <div className="mt-5 border border-gray-200 rounded-2xl overflow-hidden bg-white">
                      {/* 헤더 */}
                      <div className="text-[13px] font-semibold text-gray-700 text-right">

                        </div>

                      {/* 목록 */}
                      <div className="divide-y divide-gray-200">
                        {adminMembers.map((m) => (
                          <div
                            key={m.id}
                            className="grid grid-cols-[1fr_160px] gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                          >
                            {/* 왼쪽: 아바타 + 이름/아이디 */}
                            <div className="flex items-center gap-3 min-w-0">
                            <Avatar
                            email={m.email}
                            size={26}
                            position={m.position}
                            />

                            <div className="min-w-0">
                                <div className="text-[13px] font-semibold text-gray-900 truncate">
                                {m.name || "(이름 없음)"}
                                </div>
                                <div className="text-[12px] text-gray-500 truncate">
                                {m.username || "—"}
                                </div>
                            </div>
                            </div>

                        {/* 오른쪽: 이메일 */}
                        <div className="flex items-center justify-start min-w-0 pl-6">
                        <span className="text-[12px] text-gray-700 truncate max-w-[160px]">
                            {m.email || "—"}
                        </span>
                        </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </div>
              ) : (
                <div className="hidden lg:block" />
              )}

            </div>



          )}
        </main>
      </div>



      {/* 편집 모달 */}
      {editOpen && editItem && (
        <div
          className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4"
          onClick={closeEdit}
        >
          <div
            className="w-full max-w-[640px] bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <div className="text-[16px] font-bold text-gray-900">이메일 수정</div>
                <div className="text-[12px] text-gray-500 mt-0.5">
                  이메일 / 알림 ON/OFF / 받을 유형을 수정합니다.
                </div>
              </div>

              <button
                type="button"
                onClick={closeEdit}
                className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600"
                aria-label="닫기"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41Z"
                    fill="currentColor"
                  />
                </svg>
              </button>
            </div>

            <div className="px-6 py-5">
              <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 items-start">
                <div>
                  <div className="text-[13px] font-medium text-gray-700 mb-2">
                    이메일
                  </div>
                  <input
                    type="email"
                    value={editItem.email}
                    onChange={(e) =>
                      setEditItem((p) => (p ? { ...p, email: e.target.value } : p))
                    }
                    className="w-full h-12 px-4 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20 focus:border-[#1E3A5F]"
                  />
                </div>

                <div className="md:pt-6 flex items-center gap-3 justify-end">
                  <span className="text-[13px] text-gray-700 font-medium">알림</span>

                  <label className="inline-flex items-center cursor-pointer select-none">
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={editItem.enabled}
                      onChange={(e) =>
                        setEditItem((p) => (p ? { ...p, enabled: e.target.checked } : p))
                      }
                    />
                    <div
                      className={`w-12 h-7 rounded-full transition-colors ${
                        editItem.enabled ? "bg-[#1E3A5F]" : "bg-gray-300"
                      } relative`}
                    >
                      <div
                        className={`w-6 h-6 bg-white rounded-full shadow absolute top-0.5 transition-transform ${
                          editItem.enabled ? "translate-x-5" : "translate-x-0.5"
                        }`}
                      />
                    </div>
                  </label>
                </div>
              </div>

              <div className="mt-4">
                <div className="text-[13px] font-medium text-gray-700 mb-2">
                  받을 알림 유형
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {(Object.keys(TYPE_LABEL) as NotiType[]).map((k) => (
                    <label
                      key={k}
                      className={`flex items-center gap-3 p-4 rounded-2xl border transition-colors cursor-pointer ${
                        editItem.types[k]
                          ? "border-[#1E3A5F]/40 bg-[#1E3A5F]/5"
                          : "border-gray-200 bg-white hover:bg-gray-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={editItem.types[k]}
                        onChange={() =>
                          setEditItem((p) =>
                            p ? { ...p, types: toggleTypeIn(p.types, k) } : p
                          )
                        }
                        className="w-4 h-4 accent-[#1E3A5F]"
                      />
                      <div className="text-[14px] font-semibold text-gray-900">
                        {TYPE_LABEL[k]}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => handleDelete(editItem.id)}
                className="text-red-600 hover:text-red-700 text-[14px] font-semibold"
                disabled={saving}
              >
                삭제
              </button>

              <div className="flex items-center gap-2">
                <Button variant="outline" size="lg" onClick={closeEdit} disabled={saving}>
                  취소
                </Button>
                <Button variant="primary" size="lg" onClick={handleEditSave} disabled={saving}>
                  {saving ? "저장 중..." : "저장"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
