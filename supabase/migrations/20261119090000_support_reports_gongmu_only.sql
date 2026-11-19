-- 공무팀 서포트 보고서(work_logs.report_type = 'support')는 부서가 공무팀인 사람만 읽는다.
--   공사팀은 관리자(admin)여도, 작성자·참여자·수정 권한자여도 읽지 못한다.
--   (2026-11-19 운영 profiles: 공무팀 admin 6·staff 2, 공사팀 admin 2·staff 15, 부서 없음 0)
--   수정·삭제 정책은 읽기 정책을 통과한 행에만 적용되므로 함께 막힌다.
--
-- work_logs 본문은 SELECT 정책으로, 하위 테이블(entries·persons·expenses·materials·receipt 등)은
-- user_can_read_work_log(work_log_id) 로 막힌다. 두 곳에 같은 조건을 앞에 붙인다.
-- 기준: 20261117063343_work_log_select_policy_fix_insert_returning.sql (운영과 같은지 2026-11-19 확인 후 적용)
--
-- 서포트가 아닌 보고서는 조건이 항상 참이라 기존 동작 그대로다.

create or replace function public.user_can_see_support_reports()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles pr
    where pr.id = auth.uid()
      and pr.department = '공무팀'
  );
$$;

comment on function public.user_can_see_support_reports() is
  '공무팀 서포트 보고서를 읽을 수 있는지: 부서가 공무팀인 사람만 (공사팀 admin 포함 그 밖은 불가)';

grant execute on function public.user_can_see_support_reports() to authenticated;

create or replace function public.user_can_read_work_log(wl_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.work_logs wl
    where wl.id = wl_id
      and (
        wl.report_type is distinct from 'support'
        or public.user_can_see_support_reports()
      )
      and (
        public.is_admin()
        or wl.created_by = auth.uid()
        or coalesce(wl.is_draft, false) = false
        or exists (
          select 1
          from public.work_log_editors e
          where e.work_log_id = wl.id
            and e.user_id = auth.uid()
        )
        or public.user_is_work_log_participant(wl.id)
      )
  );
$$;

comment on function public.user_can_read_work_log(bigint) is
  '보고서 읽기: admin, 작성자, 제출 완료, 수정 권한자, 또는 참여자(임시저장 포함). 서포트 보고서는 공무팀만';

drop policy if exists "work_logs_select_authenticated" on public.work_logs;

create policy "work_logs_select_authenticated"
  on public.work_logs
  for select
  to authenticated
  using (
    (
      report_type is distinct from 'support'
      or public.user_can_see_support_reports()
    )
    and (
      public.is_admin()
      or created_by = auth.uid()
      or coalesce(is_draft, false) = false
      or exists (
        select 1
        from public.work_log_editors e
        where e.work_log_id = work_logs.id
          and e.user_id = auth.uid()
      )
      or public.user_is_work_log_participant(work_logs.id)
    )
  );

notify pgrst, 'reload schema';
