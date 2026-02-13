// send-notification-email/index.ts
// deno-lint-ignore-file
/// <reference lib="deno.ns" />
// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { INVOICE_EMAILS, normalize, fetchUserName } from "./lib/shared.ts";
import { getRecipients } from "./lib/recipients.ts";
import {
  getWorkLogIsDraft,
  buildWorkLogContent,
  buildBatchedReportEmail,
  fetchWorkLogEntryRow,
  fetchWorkLogExpenseRow,
  fetchWorkLogMaterialRow,
} from "./lib/work-logs.ts";
import { buildCalendarContent } from "./lib/calendar.ts";
import { buildVacationContent } from "./lib/vacations.ts";
import { buildNotificationContent } from "./lib/notifications.ts";

const SKIP_200 = () => new Response("skip", { status: 200, headers: { "Content-Type": "text/plain" } });
const RESEND_URL = "https://api.resend.com/emails";
const EMAIL_TIMEOUT_MS = 8000;
const WORKLOG_THROTTLE_SECONDS = 3;

async function sendResendEmail(resendKey: string, body: Record<string, any>): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), EMAIL_TIMEOUT_MS);
  try {
    const res = await fetch(RESEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      let errorText = "";
      try {
        errorText = await res.text();
      } catch {
        errorText = "";
      }
      console.log("resend_response", { ok: res.ok, status: res.status, statusText: res.statusText, body: errorText });
    }
    return res.ok;
  } catch (err) {
    console.error("resend_fetch_error", err);
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function shouldSendWorkLogEmail(
  admin: ReturnType<typeof createClient> | null,
  workLogId?: number
): Promise<boolean> {
  if (!admin || !workLogId || !Number.isFinite(workLogId)) return true;
  try {
    const { data, error } = await admin.rpc("throttle_work_log_email", {
      p_work_log_id: workLogId,
      p_window_seconds: WORKLOG_THROTTLE_SECONDS,
    });
    if (error) {
      console.error("throttle_error", error);
      return true;
    }
    return data === true;
  } catch (err) {
    console.error("throttle_exception", err);
    return true;
  }
}

async function buildFriendlyContent(
  table: string,
  record: Record<string, any>,
  operation: string,
  changes: Record<string, { before?: unknown; after?: unknown }> | undefined,
  admin: ReturnType<typeof createClient> | null
): Promise<{ subject: string; text: string; html: string; skip: boolean }> {
  const op = (operation || "").toUpperCase();


  if (table === "work_logs" && op === "DELETE") {
    return { subject: "", text: "", html: "", skip: true };
  }
  if (table === "work_logs" && (record?.is_draft === true || record?.is_draft === "true" || record?.is_draft === 1)) {
    return { subject: "", text: "", html: "", skip: true };
  }

  const userId = normalize(record.user_id);
  const author = normalize(record.author);
  const actorName = author || (await fetchUserName(userId)) || "사용자";

  switch (table) {
    case "work_logs":
    case "work_log_entries":
    case "work_log_expenses":
    case "work_log_materials":
      return buildWorkLogContent(table, record, operation, changes, actorName, admin);
    case "calendar_events":
      return buildCalendarContent(record, actorName);
    case "vacations":
      return await buildVacationContent(record, operation, changes, actorName);
    case "notifications":
      return buildNotificationContent(record);
    default:
      return { subject: "", text: "", html: "", skip: true };
  }
}

serve(async (req) => {
  try {
    let payload: any = {};
    try {
      payload = await req.json();
    } catch {
      return SKIP_200();
    }
    if (!payload || typeof payload !== "object") payload = {};

    try {
// email_events 전용 처리
const eventRecord =
  payload.record ??
  payload.new_record ??
  payload.new ??
  payload.data?.record ??
  payload.data?.new ??
  {};

if (!eventRecord || eventRecord.source_table == null) {
  return SKIP_200();
}

const table = eventRecord.source_table;
const operation = eventRecord.operation;
const record = eventRecord.snapshot ?? {};
const changes = eventRecord.changes ?? undefined;
const safeOp = (operation || "").toUpperCase();






const { batched, work_log_id, events } = payload;

      const safeTable = typeof table === "string" ? table : "";
      const safeRecord = record && typeof record === "object" ? (record as Record<string, any>) : {};


      const changeKeys = changes && typeof changes === "object" ? Object.keys(changes) : [];
      const recordKeys = safeRecord ? Object.keys(safeRecord) : [];
      const recordId = safeRecord?.id ?? safeRecord?.work_log_id ?? safeRecord?.user_id ?? null;
      console.log("payload_summary", {
        table: safeTable,
        operation: safeOp,
        recordId,
        changeKeys,
        recordKeys,
        batched: batched === true,
        eventsCount: Array.isArray(events) ? events.length : 0,
      });





      if (safeTable === "work_logs") {
        const isDraft = safeRecord?.is_draft;
        if (isDraft === true || isDraft === "true" || isDraft === 1) {
          console.log("skip_reason", "work_logs_draft");
          return SKIP_200();
        }
        if (safeOp === "DELETE") {
          console.log("skip_reason", "work_logs_delete");
          return SKIP_200();
        }
      }

      const resendKey = Deno.env.get("RESEND_API_KEY");
      if (!resendKey) {
        console.log("skip_reason", "missing_resend_key");
        return SKIP_200();
      }

      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      const admin =
        supabaseUrl && serviceRoleKey
          ? createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
          : null;

      if (batched === true && Array.isArray(events) && events.length > 0 && work_log_id != null) {
        const workLogId = Number(work_log_id);
        if (!(await shouldSendWorkLogEmail(admin, workLogId))) {
          console.log("skip_reason", "throttled");
          return SKIP_200();
        }
        if (await getWorkLogIsDraft(workLogId)) {
          console.log("skip_reason", "batched_worklog_draft");
          return new Response("skip");
        }
        const safeEvents = events.slice(0, 200).map((ev: any) => ({
          table: typeof ev.table === "string" ? ev.table : "",
          operation: typeof ev.operation === "string" ? ev.operation : "",
          record: ev.record && typeof ev.record === "object" ? ev.record : {},
          changes: ev.changes && typeof ev.changes === "object" ? ev.changes : undefined,
        }));
        const { subject, text, html } = await buildBatchedReportEmail(workLogId, safeEvents);
        const ok = await sendResendEmail(resendKey, {
          from: "RTB 알림 <no-reply@rtb-kor.com>",
          to: INVOICE_EMAILS,
          subject,
          text,
          html,
        });
        if (!ok) {
          console.log("skip_reason", "resend_failed_batched");
          return SKIP_200();
        }
        console.log("send_result", "ok_batched");
        return new Response("ok");
      }



      const safeChanges =
        changes && typeof changes === "object"
          ? (changes as Record<string, { before?: unknown; after?: unknown }>)
          : undefined;

// 🔥 email_events: work_log_id 기준으로 "미발송 이벤트"를 모아서 batched 메일 1통만 발송
const workLogIdRaw = eventRecord?.work_log_id ?? recordForContent?.work_log_id ?? recordForContent?.id;
const workLogId = Number(workLogIdRaw);

if (!workLogId || !Number.isFinite(workLogId)) {
  return SKIP_200();
}

if (await getWorkLogIsDraft(workLogId)) {
  return SKIP_200();
}

if (!admin) {
  return SKIP_200();
}

// ✅ 같은 work_log_id의 "미발송 이벤트"를 모아서 1통만 발송
const { data: pendingEvents, error: pendingErr } = await admin
  .from("email_events")
  .select("id, source_table, operation, snapshot, changes, created_at")
  .eq("work_log_id", workLogId)
  .is("sent_at", null)
  .order("created_at", { ascending: true })
  .limit(50);

if (pendingErr) {
  console.error("email_events_fetch_error", pendingErr);
  return SKIP_200();
}

if (!pendingEvents || pendingEvents.length === 0) {
  return SKIP_200();
}

// ✅ 0) work_logs DELETE 이벤트가 포함되어 있으면 => 전체 삭제로 간주하고 메일 발송 금지
const hasWorkLogDeleteEvent = pendingEvents.some(
  (ev: any) => ev?.source_table === "work_logs" && String(ev?.operation || "").toUpperCase() === "DELETE"
);

// ✅ 1) "전체 삭제(캐스케이드)" 패턴 감지: (전부 DELETE) + (테이블이 여러개/삭제량 큼)
const ops = pendingEvents.map((ev: any) => String(ev?.operation || "").toUpperCase());
const allDeleteOnly = ops.length > 0 && ops.every((op: string) => op === "DELETE");
const tableSet = new Set(pendingEvents.map((ev: any) => String(ev?.source_table || "")));
const distinctTables = tableSet.size;

const deleteCountEntries = pendingEvents.filter(
  (ev: any) => String(ev?.source_table || "") === "work_log_entries" && String(ev?.operation || "").toUpperCase() === "DELETE"
).length;
const deleteCountExpenses = pendingEvents.filter(
  (ev: any) => String(ev?.source_table || "") === "work_log_expenses" && String(ev?.operation || "").toUpperCase() === "DELETE"
).length;
const deleteCountMaterials = pendingEvents.filter(
  (ev: any) => String(ev?.source_table || "") === "work_log_materials" && String(ev?.operation || "").toUpperCase() === "DELETE"
).length;

const looksLikeCascadeDelete =
  allDeleteOnly &&
  (
    // 여러 테이블에서 같이 삭제가 터지면 거의 "보고서 전체 삭제"
    distinctTables >= 2 ||
    // 작업일지 삭제가 여러 개 한꺼번에 오면 전체 삭제일 가능성 높음
    deleteCountEntries >= 2 ||
    // 삭제 이벤트가 좀 많이 모이면 전체 삭제로 판단
    pendingEvents.length >= 6 ||
    // 지출/자재도 같이 삭제면 더 확실
    (deleteCountExpenses > 0 && deleteCountEntries > 0) ||
    (deleteCountMaterials > 0 && deleteCountEntries > 0)
  );

// ✅ 2) work_logs 테이블에서 해당 id가 이미 없어도(커밋 후/캐스케이드 순서) => 전체 삭제로 간주
let workLogExists = true;
try {
  const { data: wl, error: wlErr } = await admin.from("work_logs").select("id").eq("id", workLogId).maybeSingle();
  if (wlErr) console.error("work_logs_exists_check_error", wlErr);
  if (!wl) workLogExists = false;
} catch (e) {
  console.error("work_logs_exists_check_exception", e);
  // 에러 시엔 삭제 패턴(looksLikeCascadeDelete/hasWorkLogDeleteEvent)으로만 판단
}

if (hasWorkLogDeleteEvent || !workLogExists || looksLikeCascadeDelete) {
  // 🔥 중요: 전체 삭제면 메일을 보내지 않고, 쌓인 이벤트만 정리(sent 처리)
  await admin
    .from("email_events")
    .update({ sent_at: new Date().toISOString() })
    .eq("work_log_id", workLogId)
    .is("sent_at", null);

  console.log("skip_reason", "worklog_deleted_no_email", {
    workLogId,
    hasWorkLogDeleteEvent,
    workLogExists,
    looksLikeCascadeDelete,
    distinctTables,
    pendingCount: pendingEvents.length,
  });

  return SKIP_200();
}

const safeEvents = pendingEvents.slice(0, 50).map((ev: any) => ({
  table: ev.source_table,
  operation: ev.operation,
  record: ev.snapshot ?? {},
  changes: ev.changes ?? undefined,
}));


const { subject, text, html } = await buildBatchedReportEmail(workLogId, safeEvents);

// 혹시 안전장치로 비어있으면 스킵
if (!subject) {
  await admin
    .from("email_events")
    .update({ sent_at: new Date().toISOString() })
    .eq("work_log_id", workLogId)
    .is("sent_at", null);

  console.log("skip_reason", "empty_subject_after_build", { workLogId });
  return SKIP_200();
}

const toList = await getRecipients(admin, safeTable, safeOp, safeRecord, safeChanges);
const toFinal = Array.isArray(toList) && toList.length > 0 ? toList : INVOICE_EMAILS;

const ok = await sendResendEmail(resendKey, {
  from: "RTB 알림 <no-reply@rtb-kor.com>",
  to: toFinal,
  subject,
  text,
  html,
});

if (!ok) {
  return SKIP_200();
}

// 🔥 중요: 같은 work_log_id의 미발송 전부 정리
await admin
  .from("email_events")
  .update({ sent_at: new Date().toISOString() })
  .eq("work_log_id", workLogId)
  .is("sent_at", null);

console.log("send_result", "ok_batched_email_events", { workLogId });

return new Response("ok");





    } catch (err) {
      console.error("send_notification_error", err);
      return SKIP_200();
    }
  } catch (err) {
    console.error("send_notification_outer_error", err);
    return SKIP_200();
  }
});
