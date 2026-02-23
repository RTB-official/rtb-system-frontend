//lib/recipients.ts
// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { INVOICE_EMAILS, CEO_EMAIL, fetchUserEmail } from "./shared.ts";

export async function getRecipients(
  admin: ReturnType<typeof createClient>,
  table: string,
  operation: string,
  record: Record<string, any>,
  changes?: Record<string, { before?: unknown; after?: unknown }>
): Promise<string[]> {
  const op = (operation || "").toUpperCase();

  if (table === "calendar_events" && op === "INSERT") return INVOICE_EMAILS;
  if (table === "work_logs") return INVOICE_EMAILS;
  if (table === "work_log_entries" || table === "work_log_expenses" || table === "work_log_materials") {
    return INVOICE_EMAILS;
  }
  if (table === "vacations") {
    if (op === "INSERT") return [CEO_EMAIL];
    if (op === "UPDATE" && changes?.status?.after === "approved") {
      const email = await fetchUserEmail(admin, record?.user_id);
      if (email) return [email];
    }
    return [];
  }
  if (table === "notifications") {
    let kind: string | null = null;
    const metaRaw = record?.meta;
    if (typeof metaRaw === "string") {
      try {
        const m = JSON.parse(metaRaw);
        kind = m?.kind ?? null;
      } catch {
        kind = null;
      }
    } else if (metaRaw && typeof metaRaw === "object") {
      kind = metaRaw?.kind ?? null;
    }
    if (kind === "passport_expiry_within_1y" || kind === "member_passport_expiry") {
      const email = await fetchUserEmail(admin, record?.user_id);
      const list = [...INVOICE_EMAILS];
      if (email && !list.includes(email)) list.push(email);
      return list;
    }
    if (kind === "vehicle_inspection_due_2m" || kind === "vehicle_inspection_due_1m") {
      return INVOICE_EMAILS;
    }
    return [];
  }
  return INVOICE_EMAILS;
}
