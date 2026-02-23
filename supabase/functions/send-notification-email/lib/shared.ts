//libshared.ts
// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

/** 출장보고서/인보이스 등 공무팀 수신자 */
export const INVOICE_EMAILS = ["invoicertb-kor.com"];
export const CEO_EMAIL = "y.k@rtb-kor.com";

export const escapeHtml = (s: string) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const normalize = (value: unknown) => {
  if (value === null || value === undefined) return "";
  const text = String(value).trim();
  return text.length === 0 ? "" : text;
};

export const formatKoreanDate = (value?: string) => {
  const raw = normalize(value);
  if (!raw) return "";
  const base = raw.includes("T") ? raw.split("T")[0] : raw;
  const d = new Date(base);
  if (Number.isNaN(d.getTime())) return base;
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
};

export const formatDateRange = (start?: string, end?: string) => {
  const s = formatKoreanDate(start);
  const e = formatKoreanDate(end);
  if (!s && !e) return "";
  if (s === e || !e) return s || e;
  return `${s} ~ ${e}`;
};

export const formatTimeRange = (start?: string, end?: string, allDay?: boolean) => {
  if (allDay) return "종일";
  const s = normalize(start);
  const e = normalize(end);
  if (!s && !e) return "";
  if (s === e || !e) return s || e;
  return `${s} ~ ${e}`;
};

export const normalizeTimeValue = (value?: string) => {
  const raw = normalize(value);
  if (!raw) return "";
  const hhmmss = raw.match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
  if (hhmmss) return `${hhmmss[1].padStart(2, "0")}:${hhmmss[2]}`;
  const hhmm = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (hhmm) return `${hhmm[1].padStart(2, "0")}:${hhmm[2]}`;
  return raw;
};

export const formatLeaveType = (value?: string) => {
  const raw = normalize(value);
  if (!raw) return "휴가";
  const map: Record<string, string> = {
    FULL: "연차",
    AM: "오전반차",
    PM: "오후반차",
  };
  return map[raw] ?? raw;
};

export const fetchUserName = async (userId?: string) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey || !userId) return "";
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const { data, error } = await admin.from("profiles").select("name").eq("id", userId).single();
  if (error) return "";
  return normalize(data?.name);
};

export const fetchUserEmail = async (
  admin: ReturnType<typeof createClient>,
  userId?: string
): Promise<string> => {
  if (!userId) return "";
  const { data, error } = await admin.from("profiles").select("email").eq("id", userId).single();
  if (error || !data?.email) return "";
  const email = normalize(data.email);
  return email.includes("@") ? email : "";
};

export const defaultSkipChangeKeys = new Set([
  "id",
  "created_at",
  "is_draft",
  "work_log_id",
  "updated_at",
]);

export function changeValueForDetail(key: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "-";
  if (key === "date_from" || key === "date_to") return formatKoreanDate(String(value));
  if (key === "time_from" || key === "time_to") return normalizeTimeValue(String(value));
  if (key === "lunch_worked") return value ? "점심 안 먹고 작업" : "점심 식사";
  if (key === "updated_at") {
    const raw = String(value).trim();
    if (!raw) return "-";
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return raw;
    return `${d.getMonth() + 1}월 ${d.getDate()}일 ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
  if (key === "expense_date") return formatKoreanDate(String(value));
  if (key === "amount") {
    const n = Number(value);
    if (Number.isNaN(n)) return String(value);
    return n.toLocaleString("ko-KR") + "원";
  }
  return String(value);
}

export function buildChangeLines(
  changes: Record<string, { before?: unknown; after?: unknown }> | undefined,
  labelMap: Record<string, string>,
  skipKeys: Set<string>
): string[] {
  if (!changes || typeof changes !== "object") return [];
  return Object.entries(changes)
    .filter(([key]) => !skipKeys.has(key))
    .map(([key, diff]) => {
      const label = labelMap[key] || key;
      const before = changeValueForDetail(key, diff?.before);
      const after = changeValueForDetail(key, diff?.after);
      return `${label}: ${before} → ${after}`;
    })
    .filter(Boolean);
}

const SLOGAN_URL =
  Deno.env.get("SLOGAN_IMAGE_URL") ||
  "https://kojdzbhewqjxdqfplqzj.supabase.co/storage/v1/object/public/email-assets/slogan.jpeg";

function sloganBlock() {
  return SLOGAN_URL
    ? `<tr><td style="background:#7a1b1b;padding:0;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px;max-width:600px;margin:0 auto;"><tr><td style="padding:0;"><img src="${SLOGAN_URL}" alt="RTB Slogan" width="600" height="200" style="display:block;width:600px;max-width:600px;height:auto;border:0;outline:none;text-decoration:none;" /></td></tr></table></td></tr>`
    : `<tr><td style="background:#7a1b1b;padding:20px 24px;color:#ffffff;"><div style="font-size:20px;font-weight:700;letter-spacing:0.5px;">RETURN TO BASICS</div><div style="font-size:18px;font-weight:700;letter-spacing:0.5px;margin-top:4px;">FOR SAFETY</div><div style="margin-top:10px;font-size:12px;opacity:0.9;">RTB 통합 관리 시스템 알림</div></td></tr>`;
}

export function buildEmailHtml(
  subject: string,
  summary: string,
  baseDetails: string[],
  changeDetails: string[],
  escapeHtmlFn: (s: string) => string = escapeHtml,
  action?: { label: string; url: string }
): string {
  let htmlDetails = "";
  if (baseDetails.length > 0) {
    htmlDetails += `<ul style="margin:10px 0 0 18px;color:#1f2937;font-size:16px;line-height:1.7;padding:0;">${baseDetails
      .map((item) => `<li style="margin:4px 0;">${escapeHtmlFn(item)}</li>`)
      .join("")}</ul>`;
  }
  if (changeDetails.length > 0) {
    htmlDetails += `<div style="margin-top:18px;font-weight:700;color:#7a1b1b;">변경된 항목</div><ul style="margin:12px 0 0 18px;color:#1f2937;font-size:15px;line-height:1.7;padding:0;">${changeDetails
      .map((item) => `<li style="margin:4px 0;">${escapeHtmlFn(item)}</li>`)
      .join("")}</ul>`;
  }
  const actionBlock = action?.url
    ? `<div style="margin-top:22px;"><a href="${escapeHtmlFn(action.url)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:999px;font-size:14px;font-weight:700;letter-spacing:0.02em;">${escapeHtmlFn(action.label || "자세히 보기")}</a></div>`
    : "";
  return `
  <div style="margin:0;padding:0;background:#f7f6f2;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f7f6f2;padding:28px 0;">
      <tr>
        <td align="center" style="padding:0 12px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="width:600px;max-width:600px;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #ebe7e4;">
            ${sloganBlock()}
            <tr>
              <td style="padding:26px 28px;">
                <div style="font-size:12px;font-weight:700;letter-spacing:0.12em;color:#7a1b1b;text-transform:uppercase;">RTB Notification</div>
                <div style="margin-top:6px;font-size:22px;font-weight:700;color:#111827;">${escapeHtmlFn(subject)}</div>
                <div style="font-size:18px;line-height:1.75;color:#1f2937;">${escapeHtmlFn(summary)}</div>
                ${htmlDetails}
                ${actionBlock}
                <div style="margin-top:30px;padding-top:20px;border-top:1px solid #ebe7e4;font-size:13px;color:#9ca3af;">본 메일은 RTB 통합 관리 시스템에서 자동 발송되었습니다.</div>
              </td>
            </tr>
          </table>
          <div style="margin-top:12px;font-size:11px;color:#b0a8a2;">RETURN TO BASICS FOR SAFETY</div>
        </td>
      </tr>
    </table>
  </div>
  `;
}

export function buildEmailText(
  summary: string,
  baseDetails: string[],
  changeDetails: string[],
  action?: { label: string; url: string }
): string {
  const actionLines =
    action?.url && action?.label ? [`${action.label}: ${action.url}`] : action?.url ? [`링크: ${action.url}`] : [];
  return [summary, ...baseDetails]
    .concat(changeDetails.length ? ["변경된 항목", ...changeDetails] : [])
    .concat(actionLines)
    .filter(Boolean)
    .join("\n");
}
