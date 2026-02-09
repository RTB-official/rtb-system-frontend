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
      const { table, record, operation, changes, batched, work_log_id, events } = payload;
      const safeTable = typeof table === "string" ? table : "";
      const safeRecord = record && typeof record === "object" ? (record as Record<string, any>) : {};
      const safeOp = (typeof operation === "string" ? operation : "").toUpperCase();
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

      let recordForContent: Record<string, any> = safeRecord;
      if (admin) {
        if (safeTable === "work_log_entries" && safeRecord?.id != null && safeRecord?.desc_type === undefined) {
          const full = await fetchWorkLogEntryRow(admin, Number(safeRecord.id));
          if (full) recordForContent = full;
        } else if (safeTable === "work_log_expenses" && safeRecord?.id != null && safeRecord?.expense_date === undefined) {
          const full = await fetchWorkLogExpenseRow(admin, Number(safeRecord.id));
          if (full) recordForContent = full;
        } else if (safeTable === "work_log_materials" && safeRecord?.id != null && safeRecord?.material_name === undefined) {
          const full = await fetchWorkLogMaterialRow(admin, Number(safeRecord.id));
          if (full) recordForContent = full;
        }
      }

      const safeChanges =
        changes && typeof changes === "object"
          ? (changes as Record<string, { before?: unknown; after?: unknown }>)
          : undefined;

      const [content, toList] = await Promise.all([
        buildFriendlyContent(safeTable, recordForContent, safeOp, safeChanges, admin),
        admin ? getRecipients(admin, safeTable, safeOp, safeRecord, safeChanges) : Promise.resolve(INVOICE_EMAILS),
      ]);
      const { subject, text, html, skip } = content;

      if (skip) {
        console.log("skip_reason", "content_skip");
        return new Response("skip");
      }

      const workLogId =
        safeTable === "work_logs"
          ? Number(recordForContent?.id)
          : safeTable === "work_log_entries" || safeTable === "work_log_expenses" || safeTable === "work_log_materials"
          ? Number(recordForContent?.work_log_id)
          : undefined;
      if (workLogId && !(await shouldSendWorkLogEmail(admin, workLogId))) {
        console.log("skip_reason", "throttled");
        return SKIP_200();
      }

      const toFinal = Array.isArray(toList) && toList.length > 0 ? toList : INVOICE_EMAILS;

      const ok = await sendResendEmail(resendKey, {
        from: "RTB 알림 <no-reply@rtb-kor.com>",
        to: toFinal,
        subject,
        text,
        html,
      });
      if (!ok) {
        console.log("skip_reason", "resend_failed");
        return SKIP_200();
      }
      console.log("send_result", "ok");
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
