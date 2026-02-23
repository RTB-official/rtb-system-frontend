//vacations.ts
// @ts-nocheck
import {
  normalize,
  formatKoreanDate,
  formatLeaveType,
  buildEmailHtml,
  buildEmailText,
  escapeHtml,
  fetchUserName,
} from "./shared.ts";

const SUBJECT_PREFIX = "[RTB 통합 관리 시스템]";

export async function buildVacationContent(
  record: Record<string, any>,
  operation: string,
  changes: Record<string, { before?: unknown; after?: unknown }> | undefined,
  actorName: string
): Promise<{ subject: string; text: string; html: string; skip: false }> {
  const op = (operation || "").toUpperCase();
  const statusAfter = changes?.status?.after ?? record?.status;
  let subject: string;
  let summary: string;
  const baseDetails: string[] = [];

  if (op === "UPDATE" && statusAfter === "approved") {
    const applicantName = await fetchUserName(record.user_id);
    subject = `${SUBJECT_PREFIX} 휴가 신청이 승인되었습니다.`;
    summary = `${applicantName || "귀하"}님의 휴가 신청이 승인되었습니다.`;
    baseDetails.push(`날짜: ${formatKoreanDate(record.date) || "-"}`);
    baseDetails.push(`항목: ${formatLeaveType(record.leave_type)}`);
    const reason = normalize(record.reason);
    if (reason) baseDetails.push(`사유: ${reason}`);
  } else {
    subject = `${SUBJECT_PREFIX} ${actorName}님이 휴가를 등록했습니다.`;
    const leaveType = formatLeaveType(record.leave_type);
    const date = formatKoreanDate(record.date);
    summary = `${actorName}님이 ${date || "해당 날짜"}에 ${leaveType} 휴가를 등록했습니다.`;
    const reason = normalize(record.reason);
    if (reason) baseDetails.push(`사유: ${reason}`);
  }

  const text = buildEmailText(summary, baseDetails, []);
  const html = buildEmailHtml(subject, summary, baseDetails, [], escapeHtml);
  return { subject, text, html, skip: false };
}
