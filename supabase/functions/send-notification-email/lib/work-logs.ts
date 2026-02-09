// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import {
  normalize,
  formatKoreanDate,
  formatDateRange,
  formatTimeRange,
  buildEmailHtml,
  buildEmailText,
  escapeHtml,
  defaultSkipChangeKeys,
  buildChangeLines,
  changeValueForDetail,
  fetchUserName,
} from "./shared.ts";

const SUBJECT_PREFIX = "[RTB 통합 관리 시스템]";
const REPORT_BASE_URL = Deno.env.get("REPORT_BASE_URL") || "https://rtb-kor.com";

export type SupabaseClient = ReturnType<typeof createClient>;

export async function fetchWorkLogInfo(
  admin: SupabaseClient,
  workLogId?: number
): Promise<{ author: string; subject: string; location: string; vessel: string }> {
  if (!workLogId) return { author: "", subject: "", location: "", vessel: "" };
  const { data, error } = await admin
    .from("work_logs")
    .select("author, subject, location, vessel")
    .eq("id", workLogId)
    .single();
  if (error) return { author: "", subject: "", location: "", vessel: "" };
  return {
    author: normalize(data?.author),
    subject: normalize(data?.subject),
    location: normalize(data?.location),
    vessel: normalize(data?.vessel),
  };
}

export async function getWorkLogIsDraft(workLogId?: number): Promise<boolean> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey || !workLogId) return false;
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const { data, error } = await admin.from("work_logs").select("is_draft").eq("id", workLogId).single();
  if (error) return false;
  return data?.is_draft === true;
}

const roleOrder: Record<string, number> = {
  대표: 1, 감사: 2, 부장: 3, 차장: 4, 과장: 5, 대리: 6, 주임: 7, 사원: 8, 인턴: 9,
};

export async function getWorkLogExtras(admin: SupabaseClient, workLogId?: number) {
  if (!workLogId) {
    return { participants: [] as string[], leaderName: "", period: "", entries: [] as string[], entryCount: 0 };
  }
  const [personsRes, entriesRes] = await Promise.all([
    admin.from("work_log_persons").select("person_name").eq("work_log_id", workLogId),
    admin.from("work_log_entries").select("date_from, time_from, date_to, time_to, desc_type, details, note, move_from, move_to").eq("work_log_id", workLogId),
  ]);
  const participants = Array.from(new Set((personsRes.data || []).map((p: any) => normalize(p.person_name)).filter(Boolean)));
  let period = "";
  let entries: string[] = [];
  if (entriesRes.data && entriesRes.data.length > 0) {
    let minDate = "", maxDate = "";
    const sortedEntries = entriesRes.data.slice().sort((a: any, b: any) => {
      const aKey = `${normalize(a.date_from)} ${normalize(a.time_from)}`;
      const bKey = `${normalize(b.date_from)} ${normalize(b.time_from)}`;
      return aKey.localeCompare(bKey);
    });
    sortedEntries.forEach((entry: any) => {
      const start = normalize(entry.date_from) || normalize(entry.date_to);
      const end = normalize(entry.date_to) || normalize(entry.date_from);
      if (start && (!minDate || start < minDate)) minDate = start;
      if (end && (!maxDate || end > maxDate)) maxDate = end;
    });
    period = formatDateRange(minDate, maxDate);
    entries = sortedEntries.slice(0, 5).map((entry: any) => formatEntryLine(entry));
  }
  let leaderName = "";
  if (participants.length > 0) {
    const { data: profiles } = await admin.from("profiles").select("name, position, role, is_team_lead").in("name", participants);
    const profileMap = new Map((profiles || []).map((p: any) => [p.name, { isTeamLead: !!p.is_team_lead, position: normalize(p.position || p.role) }]));
    const leaders = participants.filter((name) => profileMap.get(name)?.isTeamLead);
    const candidates = leaders.length > 0 ? leaders : participants;
    leaderName = candidates.sort((a, b) => {
      const rankA = roleOrder[profileMap.get(a)?.position || ""] ?? 999;
      const rankB = roleOrder[profileMap.get(b)?.position || ""] ?? 999;
      return rankA - rankB;
    })[0] || "";
  }
  return { participants, leaderName, period, entries, entryCount: entriesRes.data?.length ?? 0 };
}

export async function getWorkLogExpenses(admin: SupabaseClient, workLogId?: number) {
  if (!workLogId) return { count: 0, lines: [] as string[] };
  const { data, error } = await admin
    .from("work_log_expenses")
    .select("expense_date, expense_type, detail, amount")
    .eq("work_log_id", workLogId)
    .order("expense_date", { ascending: true });
  if (error) return { count: 0, lines: [] };
  const rows = data || [];
  const lines = rows.slice(0, 10).map((r: any) => {
    const date = formatKoreanDate(r.expense_date);
    const type = normalize(r.expense_type) || "-";
    const detail = normalize(r.detail) || "-";
    const amount = r.amount != null ? Number(r.amount).toLocaleString("ko-KR") + "원" : "-";
    return `${date} | ${type} | ${detail} | ${amount}`;
  });
  return { count: rows.length, lines };
}

async function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: number | undefined;
  try {
    const timeout = new Promise<T>((resolve) => {
      timer = setTimeout(() => resolve(fallback), ms);
    });
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export async function fetchWorkLogEntryRow(admin: SupabaseClient, entryId: number): Promise<Record<string, any> | null> {
  const { data, error } = await admin.from("work_log_entries").select("*").eq("id", entryId).single();
  if (error || !data) return null;
  return data as Record<string, any>;
}

export async function fetchWorkLogExpenseRow(admin: SupabaseClient, expenseId: number): Promise<Record<string, any> | null> {
  const { data, error } = await admin.from("work_log_expenses").select("*").eq("id", expenseId).single();
  if (error || !data) return null;
  return data as Record<string, any>;
}

export async function fetchWorkLogMaterialRow(admin: SupabaseClient, materialId: number): Promise<Record<string, any> | null> {
  const { data, error } = await admin.from("work_log_materials").select("*").eq("id", materialId).single();
  if (error || !data) return null;
  return data as Record<string, any>;
}

type WorkLogEntrySummary = {
  date_from?: string; time_from?: string; date_to?: string; time_to?: string;
  desc_type?: string; details?: string; note?: string; move_from?: string; move_to?: string;
};

function formatEntryLine(entry: WorkLogEntrySummary): string {
  const date = formatDateRange(entry.date_from, entry.date_to);
  const time = formatTimeRange(entry.time_from, entry.time_to, false);
  const type = normalize(entry.desc_type) || "작업";
  const detail = normalize(entry.details);
  const note = normalize(entry.note);
  const moveFrom = normalize(entry.move_from);
  const moveTo = normalize(entry.move_to);
  let line = [[date, time].filter(Boolean).join(" "), type].filter(Boolean).join(" · ");
  if (moveFrom || moveTo) line += ` (${moveFrom || "-"} → ${moveTo || "-"})`;
  if (detail) line += ` | ${detail}`;
  if (note) line += ` | 특이사항: ${note}`;
  return line;
}

const workLogChangeLabels: Record<string, string> = {
  subject: "제목", vessel: "호선", engine: "엔진", location: "출장지",
  order_group: "작업 지시", order_person: "참관감독", vehicle: "차량",
  date_from: "시작일", date_to: "종료일", author: "작성자", updated_at: "마지막 수정 시각",
};
const entryChangeLabels: Record<string, string> = {
  date_from: "시작일", time_from: "시작시간", date_to: "종료일", time_to: "종료시간",
  desc_type: "구분", details: "작업 내용", note: "특이 사항", move_from: "출발지", move_to: "도착지",
  lunch_worked: "점심", updated_at: "수정 시각",
};
const expenseChangeLabels: Record<string, string> = {
  expense_date: "날짜", expense_type: "유형", detail: "내용", amount: "금액", updated_at: "수정 시각",
};
const materialChangeLabels: Record<string, string> = {
  material_name: "자재명", qty: "수량", unit: "단위", updated_at: "수정 시각",
};
const detailSkipKeys = new Set(["id", "created_at", "is_draft", "work_log_id"]);

type DetailLineWithType = { text: string; type: "add" | "delete" | "update"; category: string; sortKey?: string };
const SECTION_ORDER = ["출장보고서", "작업 일지", "지출 내역", "소모자재"] as const;
const PAIR_SECTIONS = new Set(["작업 일지", "지출 내역", "소모자재"]);

export function formatBatchedEventDetailLines(ev: {
  table: string;
  operation: string;
  record: Record<string, any>;
  changes?: Record<string, { before?: unknown; after?: unknown }>;
}): DetailLineWithType[] {
  const table = typeof ev.table === "string" ? ev.table : "";
  const op = (typeof ev.operation === "string" ? ev.operation : "").toUpperCase();
  const record = ev.record && typeof ev.record === "object" ? ev.record : {};
  const changes = ev.changes && typeof ev.changes === "object" ? ev.changes : {};
  const lines: DetailLineWithType[] = [];
  const build = (labelMap: Record<string, string>) =>
    Object.entries(changes)
      .filter(([k]) => !detailSkipKeys.has(k))
      .map(([key, diff]) => {
        const label = labelMap[key] || key;
        return `${label}: ${changeValueForDetail(key, diff?.before)} → ${changeValueForDetail(key, diff?.after)}`;
      })
      .filter(Boolean);
  const push = (text: string, type: "add" | "delete" | "update", category: string, sortKey?: string) =>
    lines.push({ text, type, category, sortKey });

  if (table === "work_logs" && op === "UPDATE") {
    build(workLogChangeLabels).forEach((l) => push(l, "update", "출장보고서"));
    return lines;
  }
  if (table === "work_log_entries") {
    const entryLine = formatEntryLine(record as WorkLogEntrySummary);
    const sortKey = `${normalize(record.date_from)}|${normalize(record.time_from)}|${normalize(record.details)}|${normalize(record.desc_type)}`;
    if (op === "INSERT") push(`${entryLine} 추가됨`, "add", "작업 일지", sortKey);
    else if (op === "UPDATE") build(entryChangeLabels).forEach((l) => push(l, "update", "작업 일지"));
    else if (op === "DELETE") push(`${entryLine} → 삭제됨`, "delete", "작업 일지", sortKey);
    return lines;
  }
  if (table === "work_log_expenses") {
    const date = formatKoreanDate(record.expense_date);
    const type = normalize(record.expense_type) || "-";
    const detail = normalize(record.detail) || "-";
    const amount = record.amount != null ? Number(record.amount).toLocaleString("ko-KR") + "원" : "-";
    const expenseLine = `${date} | ${type} | ${detail} | ${amount}`;
    const sortKey = `${normalize(record.expense_date)}|${record.amount ?? ""}|${detail}|${type}`;
    if (op === "INSERT") push(`${expenseLine} 추가됨`, "add", "지출 내역", sortKey);
    else if (op === "UPDATE") build(expenseChangeLabels).forEach((l) => push(l, "update", "지출 내역"));
    else if (op === "DELETE") push(`${expenseLine} → 삭제됨`, "delete", "지출 내역", sortKey);
    return lines;
  }
  if (table === "work_log_materials") {
    const name = normalize(record.material_name) || "-";
    const qty = record.qty != null ? String(record.qty) : "-";
    const unit = normalize(record.unit) || "-";
    const matLine = `${name} ${qty}${unit}`;
    const sortKey = `${name}|${qty}|${unit}`;
    if (op === "INSERT") push(`${matLine} 추가됨`, "add", "소모자재", sortKey);
    else if (op === "UPDATE") build(materialChangeLabels).forEach((l) => push(l, "update", "소모자재"));
    else if (op === "DELETE") push(`${matLine} → 삭제됨`, "delete", "소모자재", sortKey);
    return lines;
  }
  return lines;
}

export async function buildBatchedReportEmail(
  workLogId: number,
  events: Array<{ table: string; operation: string; record: Record<string, any>; changes?: Record<string, any> }>
): Promise<{ subject: string; text: string; html: string }> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return { subject: "", text: "", html: "" };
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  const info = await fetchWorkLogInfo(admin, workLogId);
  const author = info.author || "사용자";
  const { participants, leaderName, period } = await getWorkLogExtras(admin, workLogId);
  const title = info.subject || "출장보고서";

  const changeLines: DetailLineWithType[] = [];
  for (const ev of events) changeLines.push(...formatBatchedEventDetailLines(ev));

  const bySection = new Map<string, DetailLineWithType[]>();
  for (const line of changeLines) {
    const list = bySection.get(line.category) || [];
    list.push(line);
    bySection.set(line.category, list);
  }
  for (const section of SECTION_ORDER) {
    if (!PAIR_SECTIONS.has(section)) continue;
    const list = bySection.get(section);
    if (!list) continue;
    const deletes = list.filter((x) => x.type === "delete");
    const adds = list.filter((x) => x.type === "add");
    const updates = list.filter((x) => x.type === "update");
    if (deletes.length === 0 || adds.length === 0) continue;
    deletes.sort((a, b) => (a.sortKey ?? "").localeCompare(b.sortKey ?? ""));
    adds.sort((a, b) => (a.sortKey ?? "").localeCompare(b.sortKey ?? ""));
    const pairCount = Math.min(deletes.length, adds.length);
    const merged: DetailLineWithType[] = [];
    for (let i = 0; i < pairCount; i++) {
      const before = deletes[i].text.replace(/\s*→\s*삭제됨$/, "").trim();
      const after = adds[i].text.replace(/\s*추가됨$/, "").trim();
      merged.push({ text: `${before} → ${after}`, type: "update", category: section });
    }
    bySection.set(section, [...updates, ...merged, ...deletes.slice(pairCount), ...adds.slice(pairCount)]);
  }
  const typeOrder = (a: DetailLineWithType, b: DetailLineWithType) =>
    ({ delete: 0, add: 1, update: 2 }[a.type] - { delete: 0, add: 1, update: 2 }[b.type]);

  const subject = `${SUBJECT_PREFIX} ${author}님이 출장보고서를 수정했습니다.`;
  const summary = `${author}님이 출장보고서를 수정했습니다.`;
  const headerLines = [
    `작성자: ${info.author || author || "-"}`,
    `출장목적: ${title || "-"}`,
    `출장지: ${info.location || "-"}`,
    `팀장: ${leaderName || "-"}`,
    `참가자: ${participants.length > 0 ? participants.join(", ") : "-"}`,
    `작업 기간: ${period || "-"}`,
    "변경 내용:",
  ];
  const textParts = [summary, ...headerLines];
  for (const section of SECTION_ORDER) {
    const items = bySection.get(section);
    if (!items || items.length === 0) continue;
    textParts.push("", section);
    items.sort(typeOrder);
    for (const x of items) textParts.push(`  • ${x.text}`);
  }
  const text = textParts.filter(Boolean).join("\n");

  const colorByType = { add: "#059669", delete: "#dc2626", update: "#2563eb" };
  let htmlSections = "";
  for (const section of SECTION_ORDER) {
    const items = bySection.get(section);
    if (!items || items.length === 0) continue;
    items.sort(typeOrder);
    const lis = items
      .map((x) => `<li style="margin:4px 0;color:${colorByType[x.type]};font-size:15px;line-height:1.6;">${escapeHtml(x.text)}</li>`)
      .join("");
    htmlSections += `<div style="margin-top:14px;font-weight:700;color:#374151;font-size:15px;">${escapeHtml(section)}</div><ul style="margin:6px 0 0 18px;list-style:disc;padding-left:20px;">${lis}</ul>`;
  }
  const htmlDetails =
    `<ul style="margin:10px 0 0 18px;list-style:disc;padding-left:20px;font-size:16px;line-height:1.7;">${headerLines.map((item) => `<li style="margin:4px 0;color:#1f2937;">${escapeHtml(item)}</li>`).join("")}</ul>` +
    (changeLines.length > 0 ? htmlSections : `<ul style="margin:8px 0 0 18px;list-style:disc;padding-left:20px;"><li style="margin:4px 0;color:#6b7280;">(변경 사항 없음)</li></ul>`);
  const action =
    Number.isFinite(workLogId) && workLogId > 0
      ? `<div style="margin-top:22px;"><a href="${escapeHtml(`${REPORT_BASE_URL}/report/${workLogId}`)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:999px;font-size:14px;font-weight:700;letter-spacing:0.02em;">보고서 바로가기</a></div>`
      : "";
  const sloganUrl = Deno.env.get("SLOGAN_IMAGE_URL") || "https://kojdzbhewqjxdqfplqzj.supabase.co/storage/v1/object/public/email-assets/slogan.jpeg";
  const sloganBlock = sloganUrl
    ? `<tr><td style="background:#7a1b1b;padding:0;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px;max-width:600px;margin:0 auto;"><tr><td style="padding:0;"><img src="${sloganUrl}" alt="RTB Slogan" width="600" height="200" style="display:block;width:600px;max-width:600px;height:auto;border:0;outline:none;text-decoration:none;" /></td></tr></table></td></tr>`
    : `<tr><td style="background:#7a1b1b;padding:20px 24px;color:#ffffff;"><div style="font-size:20px;font-weight:700;">RETURN TO BASICS</div><div style="font-size:18px;font-weight:700;margin-top:4px;">FOR SAFETY</div></td></tr>`;
  const html = `
  <div style="margin:0;padding:0;background:#f7f6f2;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f7f6f2;padding:28px 0;">
      <tr><td align="center" style="padding:0 12px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="width:600px;max-width:600px;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #ebe7e4;">
          ${sloganBlock}
          <tr><td style="padding:26px 28px;">
            <div style="font-size:12px;font-weight:700;letter-spacing:0.12em;color:#7a1b1b;text-transform:uppercase;">RTB Notification</div>
            <div style="margin-top:6px;font-size:22px;font-weight:700;color:#111827;">${escapeHtml(subject)}</div>
            <div style="font-size:18px;line-height:1.75;color:#1f2937;">${escapeHtml(summary)}</div>
            ${htmlDetails}
            ${action}
            <div style="margin-top:30px;padding-top:20px;border-top:1px solid #ebe7e4;font-size:13px;color:#9ca3af;">본 메일은 RTB 통합 관리 시스템에서 자동 발송되었습니다.</div>
          </td></tr>
        </table>
        <div style="margin-top:12px;font-size:11px;color:#b0a8a2;">RETURN TO BASICS FOR SAFETY</div>
      </td></tr>
    </table>
  </div>`;
  return { subject, text, html };
}

export async function buildWorkLogContent(
  table: string,
  record: Record<string, any>,
  operation: string,
  changes: Record<string, { before?: unknown; after?: unknown }> | undefined,
  actorName: string,
  admin: SupabaseClient | null
): Promise<{ subject: string; text: string; html: string; skip: true } | { subject: string; text: string; html: string; skip: false }> {
  const op = (operation || "").toUpperCase();
  const hasChanges = !!changes && typeof changes === "object" && Object.keys(changes).length > 0;
  const updatedAt = normalize(record.updated_at);
  const createdAt = normalize(record.created_at);
  const updatedDifferent = updatedAt && createdAt && updatedAt !== createdAt;

  if (table === "work_logs") {
    const isUpdate = op === "UPDATE" || hasChanges || updatedDifferent;
    const changeDetails: string[] = isUpdate ? buildChangeLines(changes, workLogChangeLabels, defaultSkipChangeKeys) : [];
    const draftSubmit =
      changes?.is_draft?.before === true &&
      (changes?.is_draft?.after === false || changes?.is_draft?.after === 0 || changes?.is_draft?.after === "false");
    if (isUpdate && changeDetails.length === 0 && !draftSubmit) return { subject: "", text: "", html: "", skip: true };
    const subject = draftSubmit
      ? `${SUBJECT_PREFIX} ${actorName}님이 출장보고서를 제출했습니다.`
      : isUpdate
      ? `${SUBJECT_PREFIX} ${actorName}님이 출장보고서를 수정했습니다.`
      : `${SUBJECT_PREFIX} ${actorName}님이 출장보고서를 제출했습니다.`;
    const summary = draftSubmit
      ? `${actorName}님이 출장보고서를 제출했습니다.`
      : isUpdate
      ? `${actorName}님이 출장보고서를 수정했습니다.`
      : `${actorName}님이 출장보고서를 제출했습니다.`;
    const title = normalize(record.subject) || "출장보고서";
    const vessel = normalize(record.vessel);
    const location = normalize(record.location);
    const authorName = normalize(record.author) || actorName;
    let participants = "";
    let period = "";
    const workLogId = Number(record.id);
    if (admin && Number.isFinite(workLogId)) {
      const extras = await withTimeout(getWorkLogExtras(admin, workLogId), 1200, {
        participants: [] as string[],
        leaderName: "",
        period: "",
        entries: [] as string[],
        entryCount: 0,
      });
      participants = extras.participants?.length ? extras.participants.join(", ") : "";
      period = extras.period || "";
    }
    const baseDetails: string[] = [
      `작성자 : ${authorName || "-"}`,
      `출장 목적 : ${title || "-"}`,
      `출장지 : ${location || "-"}`,
      `선박명 : ${vessel || "-"}`,
      `참가자 : ${participants || "-"}`,
      `작업 기간 : ${period || "-"}`,
    ];
    const action =
      Number.isFinite(workLogId) && workLogId > 0
        ? { label: "보고서 바로가기", url: `${REPORT_BASE_URL}/report/${workLogId}` }
        : undefined;
    const effectiveChanges = draftSubmit ? [] : changeDetails;
    const text = buildEmailText(summary, baseDetails, effectiveChanges, action);
    const html = buildEmailHtml(subject, summary, baseDetails, effectiveChanges, escapeHtml, action);
    return { subject, text, html, skip: false };
  }

  if (table === "work_log_entries" || table === "work_log_expenses" || table === "work_log_materials") {
    const workLogId = Number(record?.work_log_id);
    if (workLogId && admin && (await getWorkLogIsDraft(workLogId))) {
      return { subject: "", text: "", html: "", skip: true };
    }
  }

  if (table === "work_log_entries") {
    const workLogId = Number(record.work_log_id);
    if (!admin) return { subject: "", text: "", html: "", skip: true };
    const { participants, leaderName, period } = await getWorkLogExtras(admin, workLogId);
    const info = await fetchWorkLogInfo(admin, workLogId);
    const title = info.subject || "출장보고서";
    const entryActor = info.author || (await fetchUserName(record.user_id)) || actorName;
    const isDelete = op === "DELETE";
    const isUpdate = op === "UPDATE" || (hasChanges && !isDelete) || updatedDifferent;
    let subject: string, summary: string;
    if (isDelete) {
      subject = `${SUBJECT_PREFIX} ${entryActor}님이 작업 일지를 삭제했습니다.`;
      summary = `"${title}" 출장보고서에서 작업 일지 1건이 삭제되었습니다.`;
    } else if (isUpdate) {
      subject = `${SUBJECT_PREFIX} ${entryActor}님이 작업 일지를 수정했습니다.`;
      summary = `${entryActor}님이 "${title}" 작업 일지 내용을 수정했습니다.`;
    } else {
      subject = `${SUBJECT_PREFIX} ${entryActor}님이 작업 일지를 추가했습니다.`;
      summary = `${entryActor}님이 "${title}" 출장보고서에 작업 일지를 추가했습니다.`;
    }
    const baseDetails = [
      `작성자: ${info.author || entryActor || "-"}`,
      `출장목적: ${title || "-"}`,
      `출장지: ${info.location || "-"}`,
      `팀장: ${leaderName || "-"}`,
      `참가자: ${participants.length > 0 ? participants.join(", ") : "-"}`,
      `작업 기간: ${period || "-"}`,
    ];
    if (isDelete) baseDetails.push("삭제된 작업 일지 내용:");
    const entryDate = formatDateRange(record.date_from, record.date_to);
    const entryTime = formatTimeRange(record.time_from, record.time_to, record.all_day);
    baseDetails.push(`작업 유형: ${normalize(record.desc_type) || "-"}`);
    if (entryDate) baseDetails.push(`작업 일자: ${entryDate}`);
    if (entryTime) baseDetails.push(`작업 시간: ${entryTime}`);
    if (normalize(record.move_from) || normalize(record.move_to)) baseDetails.push(`이동: ${normalize(record.move_from) || "-"} → ${normalize(record.move_to) || "-"}`);
    if (normalize(record.details)) baseDetails.push(`상세 내용: ${normalize(record.details)}`);
    if (normalize(record.note)) baseDetails.push(`특이 사항: ${normalize(record.note)}`);
    const entryChangeLines = isUpdate && !isDelete ? buildChangeLines(changes, entryChangeLabels, defaultSkipChangeKeys) : [];
    let changeDetails: string[] = entryChangeLines.length > 0 ? ["작업 일지 변경 내용:", ...entryChangeLines] : [];
    if (isUpdate && !isDelete && changeDetails.length === 0) {
      const snapshot: string[] = [];
      if (entryDate) snapshot.push(`작업 일자: ${entryDate}`);
      if (entryTime) snapshot.push(`작업 시간: ${entryTime}`);
      const entryType = normalize(record.desc_type) || "-";
      snapshot.push(`작업 유형: ${entryType}`);
      if (normalize(record.move_from) || normalize(record.move_to)) {
        snapshot.push(`이동: ${normalize(record.move_from) || "-"} → ${normalize(record.move_to) || "-"}`);
      }
      if (normalize(record.details)) snapshot.push(`상세 내용: ${normalize(record.details)}`);
      if (normalize(record.note)) snapshot.push(`특이 사항: ${normalize(record.note)}`);
      changeDetails = snapshot.length > 0 ? ["작업 일지 현재 내용:", ...snapshot] : [];
    }
    const action =
      Number.isFinite(workLogId) && workLogId > 0
        ? { label: "보고서 바로가기", url: `${REPORT_BASE_URL}/report/${workLogId}` }
        : undefined;
    const text = buildEmailText(summary, baseDetails, changeDetails, action);
    const html = buildEmailHtml(subject, summary, baseDetails, changeDetails, escapeHtml, action);
    return { subject, text, html, skip: false };
  }

  if (table === "work_log_expenses") {
    const workLogId = Number(record.work_log_id);
    if (!admin) return { subject: "", text: "", html: "", skip: true };
    const info = await fetchWorkLogInfo(admin, workLogId);
    const title = info.subject || "출장보고서";
    const entryActor = info.author || (await fetchUserName(record.user_id)) || actorName;
    const isDelete = op === "DELETE";
    const isUpdate = op === "UPDATE" && !isDelete && (hasChanges || updatedDifferent);
    let subject: string, summary: string;
    if (isDelete) {
      subject = `${SUBJECT_PREFIX} ${entryActor}님이 지출 내역을 삭제했습니다.`;
      summary = `"${title}" 출장보고서에서 지출 내역 1건이 삭제되었습니다.`;
    } else if (isUpdate) {
      subject = `${SUBJECT_PREFIX} ${entryActor}님이 지출 내역을 수정했습니다.`;
      summary = `${entryActor}님이 "${title}" 지출 내역을 수정했습니다.`;
    } else {
      subject = `${SUBJECT_PREFIX} ${entryActor}님이 지출 내역을 추가했습니다.`;
      summary = `${entryActor}님이 "${title}" 출장보고서에 지출 내역을 추가했습니다.`;
    }
    const baseDetails = [`출장목적: ${title || "-"}`];
    if (isDelete) baseDetails.push("삭제된 지출 내역:");
    baseDetails.push(`날짜: ${formatKoreanDate(record.expense_date)}`);
    baseDetails.push(`유형: ${normalize(record.expense_type) || "-"}`);
    baseDetails.push(`내용: ${normalize(record.detail) || "-"}`);
    baseDetails.push(`금액: ${record.amount != null ? Number(record.amount).toLocaleString("ko-KR") + "원" : "-"}`);
    const expenseChangeLines = isUpdate ? buildChangeLines(changes, expenseChangeLabels, defaultSkipChangeKeys) : [];
    let changeDetails: string[] = expenseChangeLines.length > 0 ? ["지출 내역 변경 내용:", ...expenseChangeLines] : [];
    if (isUpdate && changeDetails.length === 0) {
      const snapshot: string[] = [
        `날짜: ${formatKoreanDate(record.expense_date) || "-"}`,
        `유형: ${normalize(record.expense_type) || "-"}`,
        `내용: ${normalize(record.detail) || "-"}`,
        `금액: ${record.amount != null ? Number(record.amount).toLocaleString("ko-KR") + "원" : "-"}`,
      ];
      changeDetails = ["지출 내역 현재 내용:", ...snapshot];
    }
    const action =
      Number.isFinite(workLogId) && workLogId > 0
        ? { label: "보고서 바로가기", url: `${REPORT_BASE_URL}/report/${workLogId}` }
        : undefined;
    const text = buildEmailText(summary, baseDetails, changeDetails, action);
    const html = buildEmailHtml(subject, summary, baseDetails, changeDetails, escapeHtml, action);
    return { subject, text, html, skip: false };
  }

  if (table === "work_log_materials") {
    const workLogId = Number(record.work_log_id);
    if (!admin) return { subject: "", text: "", html: "", skip: true };
    const info = await fetchWorkLogInfo(admin, workLogId);
    const title = info.subject || "출장보고서";
    const entryActor = info.author || (await fetchUserName(record.user_id)) || actorName;
    const isDelete = op === "DELETE";
    const isUpdate = op === "UPDATE" && !isDelete && (hasChanges || updatedDifferent);
    let subject: string, summary: string;
    if (isDelete) {
      subject = `${SUBJECT_PREFIX} ${entryActor}님이 소모자재를 삭제했습니다.`;
      summary = `"${title}" 출장보고서에서 소모자재 1건이 삭제되었습니다.`;
    } else if (isUpdate) {
      subject = `${SUBJECT_PREFIX} ${entryActor}님이 소모자재를 수정했습니다.`;
      summary = `${entryActor}님이 "${title}" 소모자재 내역을 수정했습니다.`;
    } else {
      subject = `${SUBJECT_PREFIX} ${entryActor}님이 소모자재를 추가했습니다.`;
      summary = `${entryActor}님이 "${title}" 출장보고서에 소모자재를 추가했습니다.`;
    }
    const baseDetails = [`출장목적: ${title || "-"}`];
    if (isDelete) baseDetails.push("삭제된 소모자재:");
    baseDetails.push(`자재명: ${normalize(record.material_name) || "-"}`);
    baseDetails.push(`수량: ${record.qty != null ? String(record.qty) : "-"}`);
    baseDetails.push(`단위: ${normalize(record.unit) || "-"}`);
    const materialChangeLines = isUpdate ? buildChangeLines(changes, materialChangeLabels, defaultSkipChangeKeys) : [];
    let changeDetails: string[] = materialChangeLines.length > 0 ? ["소모자재 변경 내용:", ...materialChangeLines] : [];
    if (isUpdate && changeDetails.length === 0) {
      const snapshot: string[] = [
        `자재명: ${normalize(record.material_name) || "-"}`,
        `수량: ${record.qty != null ? String(record.qty) : "-"}`,
        `단위: ${normalize(record.unit) || "-"}`,
      ];
      changeDetails = ["소모자재 현재 내용:", ...snapshot];
    }
    const action =
      Number.isFinite(workLogId) && workLogId > 0
        ? { label: "보고서 바로가기", url: `${REPORT_BASE_URL}/report/${workLogId}` }
        : undefined;
    const text = buildEmailText(summary, baseDetails, changeDetails, action);
    const html = buildEmailHtml(subject, summary, baseDetails, changeDetails, escapeHtml, action);
    return { subject, text, html, skip: false };
  }

  return { subject: "", text: "", html: "", skip: true };
}
