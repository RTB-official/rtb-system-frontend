-- work_logs SELECT 정책이 user_can_read_work_log(id)만 쓰면
-- INSERT ... RETURNING 시 함수가 같은 테이블을 재조회해 새 행을 못 보고 RLS 위반이 난다.
-- 행 컬럼을 직접 검사하고, 참여자 여부만 security definer 헬퍼로 분리한다.

create or replace function public.user_is_work_log_participant(p_work_log_id bigint)
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
      and coalesce(trim(pr.name), '') <> ''
      and (
        exists (
          select 1
          from public.work_log_persons wlp
          where wlp.work_log_id = p_work_log_id
            and wlp.person_name = trim(pr.name)
        )
        or exists (
          select 1
          from public.work_log_entry_persons wlep
          join public.work_log_entries e on e.id = wlep.entry_id
          where e.work_log_id = p_work_log_id
            and wlep.person_name = trim(pr.name)
        )
      )
  );
$$;

comment on function public.user_is_work_log_participant(bigint) is
  '현재 사용자가 보고서 참여자인지(이름 기준). work_logs RLS 재귀 방지용';

grant execute on function public.user_is_work_log_participant(bigint) to authenticated;

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
  '보고서 읽기: admin, 작성자, 제출 완료, 수정 권한자, 또는 참여자(임시저장 포함)';

drop policy if exists "work_logs_select_authenticated" on public.work_logs;

create policy "work_logs_select_authenticated"
  on public.work_logs
  for select
  to authenticated
  using (
    public.is_admin()
    or created_by = auth.uid()
    or coalesce(is_draft, false) = false
    or exists (
      select 1
      from public.work_log_editors e
      where e.work_log_id = id
        and e.user_id = auth.uid()
    )
    or public.user_is_work_log_participant(id)
  );

notify pgrst, 'reload schema';
