// deno-lint-ignore-file
/// <reference lib="deno.ns" />
// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const normalize = (value: unknown) => {
  if (value === null || value === undefined) return "";
  const text = String(value).trim();
  return text.length === 0 ? "" : text;
};

const formatKoreanDate = (value?: string) => {
  const raw = normalize(value);
  if (!raw) return "";
  const base = raw.includes("T") ? raw.split("T")[0] : raw;
  const d = new Date(base);
  if (Number.isNaN(d.getTime())) return base;
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
};

const formatDateRange = (start?: string, end?: string) => {
  const s = formatKoreanDate(start);
  const e = formatKoreanDate(end);
  if (!s && !e) return "";
  if (s === e || !e) return s || e;
  return `${s} ~ ${e}`;
};

const formatTimeRange = (start?: string, end?: string, allDay?: boolean) => {
  if (allDay) return "종일";
  const s = normalize(start);
  const e = normalize(end);
  if (!s && !e) return "";
  if (s === e || !e) return s || e;
  return `${s} ~ ${e}`;
};

const normalizeTimeValue = (value?: string) => {
  const raw = normalize(value);
  if (!raw) return "";
  const hhmmss = raw.match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
  if (hhmmss) return `${hhmmss[1].padStart(2, "0")}:${hhmmss[2]}`;
  const hhmm = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (hhmm) return `${hhmm[1].padStart(2, "0")}:${hhmm[2]}`;
  return raw;
};

const formatLeaveType = (value?: string) => {
  const raw = normalize(value);
  if (!raw) return "휴가";
  const map: Record<string, string> = {
    FULL: "연차",
    AM: "오전반차",
    PM: "오후반차",
  };
  return map[raw] ?? raw;
};

const fetchUserName = async (userId?: string) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey || !userId) return "";
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
  const { data, error } = await admin
    .from("profiles")
    .select("name")
    .eq("id", userId)
    .single();
  if (error) return "";
  return normalize(data?.name);
};

const roleOrder: Record<string, number> = {
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

const fetchWorkLogInfo = async (workLogId?: number) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey || !workLogId) {
    return { author: "", subject: "", location: "", vessel: "" };
  }
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
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
};

type WorkLogEntrySummary = {
  date_from?: string;
  time_from?: string;
  date_to?: string;
  time_to?: string;
  desc_type?: string;
  details?: string;
  note?: string;
  move_from?: string;
  move_to?: string;
};

const formatEntryLine = (entry: WorkLogEntrySummary) => {
  const date = formatDateRange(entry.date_from, entry.date_to);
  const time = formatTimeRange(entry.time_from, entry.time_to, false);
  const type = normalize(entry.desc_type) || "작업";
  const detail = normalize(entry.details);
  const note = normalize(entry.note);
  const moveFrom = normalize(entry.move_from);
  const moveTo = normalize(entry.move_to);

  const pieces = [
    [date, time].filter(Boolean).join(" "),
    type,
  ].filter(Boolean);

  let line = pieces.join(" · ");
  if (moveFrom || moveTo) {
    line += ` (${moveFrom || "-"} → ${moveTo || "-"})`;
  }
  if (detail) {
    line += ` | ${detail}`;
  }
  if (note) {
    line += ` | 특이사항: ${note}`;
  }
  return line;
};

const getWorkLogExtras = async (workLogId?: number) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey || !workLogId) {
    return { participants: [] as string[], leaderName: "", period: "", entries: [] as string[] };
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const [personsRes, entriesRes] = await Promise.all([
    admin
      .from("work_log_persons")
      .select("person_name")
      .eq("work_log_id", workLogId),
    admin
      .from("work_log_entries")
      .select("date_from, time_from, date_to, time_to, desc_type, details, note, move_from, move_to")
      .eq("work_log_id", workLogId),
  ]);

  const participants = Array.from(
    new Set(
      (personsRes.data || [])
        .map((p: any) => normalize(p.person_name))
        .filter(Boolean)
    )
  );

  let period = "";
  let entries: string[] = [];
  if (entriesRes.data && entriesRes.data.length > 0) {
    let minDate = "";
    let maxDate = "";
    const sortedEntries = entriesRes.data.slice().sort((a: any, b: any) => {
      const aKey = `${normalize(a.date_from)} ${normalize(a.time_from)}`;
      const bKey = `${normalize(b.date_from)} ${normalize(b.time_from)}`;
      return aKey.localeCompare(bKey);
    });
    sortedEntries.forEach((entry: any) => {
      const start = normalize(entry.date_from) || normalize(entry.date_to);
      const end = normalize(entry.date_to) || normalize(entry.date_from);
      if (start) {
        if (!minDate || start < minDate) minDate = start;
      }
      if (end) {
        if (!maxDate || end > maxDate) maxDate = end;
      }
    });
    period = formatDateRange(minDate, maxDate);

    entries = sortedEntries.slice(0, 5).map((entry: any) => formatEntryLine(entry));
  }

  let leaderName = "";
  if (participants.length > 0) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("name, position, role, is_team_lead")
      .in("name", participants);
    const profileMap = new Map(
      (profiles || []).map((p: any) => [
        p.name,
        {
          isTeamLead: !!p.is_team_lead,
          position: normalize(p.position || p.role),
        },
      ])
    );

    const leaders = participants.filter(
      (name) => profileMap.get(name)?.isTeamLead
    );
    const candidates = leaders.length > 0 ? leaders : participants;
    leaderName =
      candidates.sort((a, b) => {
        const posA = profileMap.get(a)?.position || "";
        const posB = profileMap.get(b)?.position || "";
        const rankA = roleOrder[posA] ?? 999;
        const rankB = roleOrder[posB] ?? 999;
        if (rankA !== rankB) return rankA - rankB;
        return 0;
      })[0] || "";
  }

  return { participants, leaderName, period, entries };
};

const buildFriendlyContent = async (
  table: string,
  record: Record<string, any>,
  operation?: string,
  changes?: Record<string, any>
) => {
  const subjectPrefix = "[RTB 통합 관리 시스템]";
  let subject = "알림";
  let summary = "새로운 알림이 등록되었습니다.";
  const baseDetails: string[] = [];
  const changeDetails: string[] = [];

  const userId = normalize(record.user_id);
  const author = normalize(record.author);
  const actorName =
    author || (await fetchUserName(userId)) || "사용자";

  const changeLabelMap: Record<string, string> = {
    subject: "제목",
    vessel: "호선",
    engine: "엔진",
    location: "출장지",
    order_group: "작업 지시",
    order_person: "참관감독",
    vehicle: "차량",
    date_from: "시작일",
    date_to: "종료일",
    author: "작성자",
  };
  const entryChangeLabelMap: Record<string, string> = {
    date_from: "시작일",
    time_from: "시작시간",
    date_to: "종료일",
    time_to: "종료시간",
    desc_type: "구분",
    details: "작업 내용",
    note: "특이 사항",
    move_from: "출발지",
    move_to: "도착지",
    lunch_worked: "점심",
  };
  const skipChangeKeys = new Set([
    "id",
    "created_at",
    "updated_at",
    "is_draft",
    "work_log_id",
  ]);

  const formatChangeValue = (key: string, value: unknown) => {
    if (value === null || value === undefined || value === "") return "-";
    if (key === "date_from" || key === "date_to") {
      return formatKoreanDate(String(value));
    }
    if (key === "time_from" || key === "time_to") {
      return normalizeTimeValue(String(value));
    }
    if (key === "lunch_worked") {
      return value ? "점심 안 먹고 작업" : "점심 식사";
    }
    return String(value);
  };

  const buildChangeLines = (labelMap: Record<string, string>) => {
    if (!changes || typeof changes !== "object") return [];
    return Object.entries(changes)
      .filter(([key]) => !skipChangeKeys.has(key))
      .map(([key, diff]) => {
        const label = labelMap[key] || key;
        const before = formatChangeValue(key, diff?.before);
        const after = formatChangeValue(key, diff?.after);
        return `${label}: ${before} → ${after}`;
      })
      .filter(Boolean);
  };

  const hasChanges =
    !!changes && typeof changes === "object" && Object.keys(changes).length > 0;
  const updatedAt = normalize(record.updated_at);
  const createdAt = normalize(record.created_at);
  const updatedDifferent = updatedAt && createdAt && updatedAt !== createdAt;

  if (table === "calendar_events") {
    subject = `${subjectPrefix} ${actorName}님이 일정을 등록했습니다.`;
    const title = normalize(record.title) || "일정";
    const date = formatDateRange(record.start_date, record.end_date);
    const time = formatTimeRange(record.start_time, record.end_time, record.all_day);
    summary = `${actorName}님이 ${date || "일정 날짜"}에 "${title}" 일정을 등록했습니다.`;
    if (time) baseDetails.push(`시간: ${time}`);
    if (Array.isArray(record.attendees) && record.attendees.length > 0) {
      baseDetails.push(`참여자: ${record.attendees.join(", ")}`);
    }
    const desc = normalize(record.description);
    if (desc) baseDetails.push(`내용: ${desc}`);
  } else if (table === "work_logs") {
    const isUpdate = operation === "UPDATE" || hasChanges || updatedDifferent;
    subject = isUpdate
      ? `${subjectPrefix} ${actorName}님이 출장보고서를 수정했습니다.`
      : `${subjectPrefix} ${actorName}님이 출장보고서를 등록했습니다.`;
    const title = normalize(record.subject) || "출장보고서";
    const vessel = normalize(record.vessel);
    const location = normalize(record.location);
    const authorName = normalize(record.author) || actorName;
    const { participants, leaderName, period, entries } = await getWorkLogExtras(
      Number(record.id)
    );
    const date = formatDateRange(record.date_from, record.date_to);
    summary = isUpdate
      ? `${actorName}님이 출장보고서를 수정했습니다.`
      : `${actorName}님이 출장보고서를 등록했습니다.`;
    baseDetails.push(`작성자 : ${authorName || "-"}`);
    baseDetails.push(`출장목적 : ${title || "-"}`);
    baseDetails.push(`출장지 : ${location || "-"}`);
    baseDetails.push(`팀장 : ${leaderName || "-"}`);
    baseDetails.push(
      `참가자 : ${participants.length > 0 ? participants.join(", ") : "-"}`
    );
    baseDetails.push(`작업 기간 : ${period || date || "-"}`);
    if (vessel && !isUpdate) baseDetails.push(`호선: ${vessel}`);
    if (entries.length > 0) {
      baseDetails.push("작업 일지");
      baseDetails.push(...entries);
    }
    if (isUpdate) {
      const changeLines = buildChangeLines(changeLabelMap);
      if (changeLines.length > 0) {
        changeDetails.push(...changeLines);
      }
    }
  } else if (table === "work_log_entries") {
    const isUpdate = operation === "UPDATE" || hasChanges || updatedDifferent;
    const workLogId = Number(record.work_log_id);
    const { participants, leaderName, period } = await getWorkLogExtras(
      workLogId
    );
    const info = await fetchWorkLogInfo(workLogId);
    const title = info.subject || "출장보고서";
    const entryActor =
      info.author || (await fetchUserName(userId)) || actorName;
    subject = isUpdate
      ? `${subjectPrefix} ${entryActor}님이 작업 일지를 수정했습니다.`
      : `${subjectPrefix} ${entryActor}님이 작업 일지를 등록했습니다.`;
    summary = isUpdate
      ? `${entryActor}님이 "${title}" 작업 일지를 수정하셨습니다.`
      : `${entryActor}님이 "${title}" 작업 일지를 등록하셨습니다.`;
    baseDetails.push(`작성자: ${info.author || entryActor || "-"}`);
    baseDetails.push(`출장목적: ${title || "-"}`);
    baseDetails.push(`출장지: ${info.location || "-"}`);
    baseDetails.push(`팀장: ${leaderName || "-"}`);
    baseDetails.push(
      `참가자: ${participants.length > 0 ? participants.join(", ") : "-"}`
    );
    baseDetails.push(`작업 기간: ${period || "-"}`);
    const entryDate = formatDateRange(record.date_from, record.date_to);
    const entryTime = formatTimeRange(
      record.time_from,
      record.time_to,
      record.all_day
    );
    const entryType = normalize(record.desc_type) || "-";
    const entryDetails = normalize(record.details);
    const entryNote = normalize(record.note);
    if (entryDate) baseDetails.push(`작업 일자: ${entryDate}`);
    if (entryTime) baseDetails.push(`작업 시간: ${entryTime}`);
    baseDetails.push(`작업 유형: ${entryType}`);
    if (normalize(record.move_from) || normalize(record.move_to)) {
      baseDetails.push(
        `이동: ${normalize(record.move_from) || "-"} → ${
          normalize(record.move_to) || "-"
        }`
      );
    }
    if (entryDetails) baseDetails.push(`상세 내용: ${entryDetails}`);
    if (entryNote) baseDetails.push(`특이 사항: ${entryNote}`);
    if (isUpdate) {
      const changeLines = buildChangeLines(entryChangeLabelMap);
      if (changeLines.length > 0) {
        changeDetails.push(...changeLines);
      }
    }
  } else if (table === "vacations") {
    subject = `${subjectPrefix} ${actorName}님이 휴가를 등록했습니다.`;
    const leaveType = formatLeaveType(record.leave_type);
    const date = formatKoreanDate(record.date);
    summary = `${actorName}님이 ${date || "해당 날짜"}에 ${leaveType} 휴가를 등록했습니다.`;
    const reason = normalize(record.reason);
    if (reason) baseDetails.push(`사유: ${reason}`);
  }

  const text = [summary, ...baseDetails]
    .concat(changeDetails.length ? ["변경된 항목", ...changeDetails] : [])
    .filter(Boolean)
    .join("\n");
  let htmlDetails = "";
  if (baseDetails.length > 0) {
    htmlDetails += `<ul style="margin:10px 0 0 18px;color:#1f2937;font-size:16px;line-height:1.7;padding:0;">${baseDetails
      .map((item) => `<li style="margin:4px 0;">${item}</li>`)
      .join("")}</ul>`;
  }
  if (changeDetails.length > 0) {
    htmlDetails += `<div style="margin-top:18px;font-weight:700;color:#7a1b1b;">변경된 항목</div><ul style="margin:12px 0 0 18px;color:#1f2937;font-size:15px;line-height:1.7;padding:0;">${changeDetails
      .map((item) => `<li style="margin:4px 0;">${item}</li>`)
      .join("")}</ul>`;
  }
  const sloganUrl =
    Deno.env.get("SLOGAN_IMAGE_URL") ||
    "https://kojdzbhewqjxdqfplqzj.supabase.co/storage/v1/object/public/email-assets/slogan.jpeg";
  const sloganBlock = sloganUrl
    ? `<tr>
        <td style="background:#7a1b1b;padding:0;">
          <img src="${sloganUrl}" alt="RTB Slogan" style="display:block;width:100%;height:auto;border:0;outline:none;text-decoration:none;" />
        </td>
      </tr>`
    : `<tr>
        <td style="background:#7a1b1b;padding:20px 24px;color:#ffffff;">
          <div style="font-size:20px;font-weight:700;letter-spacing:0.5px;">RETURN TO BASICS</div>
          <div style="font-size:18px;font-weight:700;letter-spacing:0.5px;margin-top:4px;">FOR SAFETY</div>
          <div style="margin-top:10px;font-size:12px;opacity:0.9;">RTB 통합 관리 시스템 알림</div>
        </td>
      </tr>`;
  const html = `
  <div style="margin:0;padding:0;background:#f7f6f2;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f7f6f2;padding:28px 0;">
      <tr>
        <td align="center" style="padding:0 12px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="width:600px;max-width:600px;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #ebe7e4;">
            ${sloganBlock}
            <tr>
              <td style="padding:26px 28px;">
                <div style="font-size:12px;font-weight:700;letter-spacing:0.12em;color:#7a1b1b;text-transform:uppercase;">RTB Notification</div>
                <div style="margin-top:6px;font-size:22px;font-weight:700;color:#111827;">${subject}</div>
                <div style="font-size:18px;line-height:1.75;color:#1f2937;">${summary}</div>
                ${htmlDetails}
                <div style="margin-top:30px;padding-top:20px;border-top:1px solid #ebe7e4;font-size:13px;color:#9ca3af;">
                  본 메일은 RTB 통합 관리 시스템에서 자동 발송되었습니다.
                </div>
              </td>
            </tr>
          </table>
          <div style="margin-top:12px;font-size:11px;color:#b0a8a2;">RETURN TO BASICS FOR SAFETY</div>
        </td>
      </tr>
    </table>
  </div>
  `;

  return { subject, text, html };
};

serve(async (req) => {
  try {
    const payload = await req.json();
    const { table, record, operation, changes } = payload ?? {};

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      return new Response("Missing RESEND_API_KEY", { status: 500 });
    }

    const safeTable = typeof table === "string" ? table : "";
    const safeOperation = typeof operation === "string" ? operation : "";
    const safeRecord =
      record && typeof record === "object" ? (record as Record<string, any>) : {};
    const safeChanges =
      changes && typeof changes === "object" ? (changes as Record<string, any>) : undefined;

    const { subject, text, html } = await buildFriendlyContent(
      safeTable,
      safeRecord,
      safeOperation,
      safeChanges
    );

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "RTB 알림 <no-reply@rtb-kor.com>",
        to: "mj.kang@rtb-kor.com",
        subject,
        text,
        html,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return new Response(err, { status: 500 });
    }

    return new Response("ok");
  } catch (e) {
    return new Response(String(e), { status: 500 });
  }
});
