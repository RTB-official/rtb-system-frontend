//lib/notifications.ts
// @ts-nocheck
import { normalize, buildEmailHtml, buildEmailText, escapeHtml } from "./shared.ts";

const SUBJECT_PREFIX = "[RTB 통합 관리 시스템]";

function getNotificationKind(record: Record<string, any>): string {
  const metaRaw = record?.meta;
  if (typeof metaRaw === "string") {
    try {
      const m = JSON.parse(metaRaw);
      return m?.kind ?? "";
    } catch {
      return "";
    }
  }
  if (metaRaw && typeof metaRaw === "object") return metaRaw?.kind ?? "";
  return "";
}

export function buildNotificationContent(
  record: Record<string, any>
): { subject: string; text: string; html: string; skip: true } | { subject: string; text: string; html: string; skip: false } {
  const kind = getNotificationKind(record);

  if (kind === "passport_expiry_within_1y" || kind === "member_passport_expiry") {
    const subject = `${SUBJECT_PREFIX} 여권 만료 1년 전 알림`;
    const msg = normalize(record.message);
    const summary = msg || "구성원 여권이 1년 이내 만료됩니다.";
    const baseDetails = [summary];
    const text = buildEmailText(summary, baseDetails, []);
    const html = buildEmailHtml(subject, summary, baseDetails, [], escapeHtml);
    return { subject, text, html, skip: false };
  }

  if (kind === "vehicle_inspection_due_2m" || kind === "vehicle_inspection_due_1m") {
    const is2m = kind === "vehicle_inspection_due_2m";
    const subject = `${SUBJECT_PREFIX} 차량 검사 만료 ${is2m ? "2달" : "1달"} 전 알림`;
    const msg = normalize(record.message);
    const summary = msg || `차량 검사가 ${is2m ? "2개월" : "1개월"} 이내에 만료됩니다.`;
    const baseDetails = [summary];
    const text = buildEmailText(summary, baseDetails, []);
    const html = buildEmailHtml(subject, summary, baseDetails, [], escapeHtml);
    return { subject, text, html, skip: false };
  }

  return { subject: "", text: "", html: "", skip: true };
}
