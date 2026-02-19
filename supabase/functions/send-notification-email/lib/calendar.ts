// @ts-nocheck
import {
  normalize,
  formatDateRange,
  formatTimeRange,
  buildEmailHtml,
  buildEmailText,
  escapeHtml,
} from "./shared.ts";

const SUBJECT_PREFIX = "[RTB 통합 관리 시스템]";

export function buildCalendarContent(
  record: Record<string, any>,
  actorName: string
): { subject: string; text: string; html: string; skip: false } {
  const subject = `${SUBJECT_PREFIX} ${actorName}님이 일정을 등록했습니다.`;
  const title = normalize(record.title) || "일정";
  const date = formatDateRange(record.start_date, record.end_date);
  const time = formatTimeRange(record.start_time, record.end_time, record.all_day);
  const summary = `${actorName}님이 ${date || "일정 날짜"}에 "${title}" 일정을 등록했습니다.`;
  const baseDetails: string[] = [];
  if (time) baseDetails.push(`시간: ${time}`);
  if (Array.isArray(record.attendees) && record.attendees.length > 0) {
    baseDetails.push(`참여자: ${record.attendees.join(", ")}`);
  }
  const desc = normalize(record.description);
  if (desc) baseDetails.push(`내용: ${desc}`);

  const text = buildEmailText(summary, baseDetails, []);
  const html = buildEmailHtml(subject, summary, baseDetails, [], escapeHtml);
  return { subject, text, html, skip: false };
}
