/**
 * 공무팀 서포트 보고서 (work_logs.report_type = 'support')
 * - 화면·입력은 출장 보고서와 같다.
 * - 워크로드 집계와 알림(웹·메일)에서 빠진다.
 * - report_type 이 null 인 기존 보고서는 제목으로 출장/교육을 구분한다.
 */
export const SUPPORT_REPORT_TYPE = "support" as const;

export type WorkLogReportType = typeof SUPPORT_REPORT_TYPE;

export const SUPPORT_REPORT_LABEL = "공무팀 서포트 보고서";

/**
 * 서포트 보고서를 보고 쓸 수 있는 사람: 부서가 공무팀인 사람만 (공사팀은 admin 이어도 불가).
 * 화면에서 탭을 숨기는 용도이고, 실제 차단은 DB(user_can_see_support_reports)가 한다.
 */
export function canSeeSupportReports(
    profile: { department?: string | null } | null | undefined
): boolean {
    return profile?.department === "공무팀";
}

export function isSupportReport(
    log: { report_type?: string | null } | null | undefined
): boolean {
    return log?.report_type === SUPPORT_REPORT_TYPE;
}
