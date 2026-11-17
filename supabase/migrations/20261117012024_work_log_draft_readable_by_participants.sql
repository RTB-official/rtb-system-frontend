-- 임시저장(is_draft=true) 보고서도 참여자(이름 기준)가 읽을 수 있게 한다.
-- staff 목록 RPC(staff_can_read_*)는 이미 참여자를 허용하지만,
-- work_logs SELECT RLS가 draft를 작성자/admin/editor만 열어 참여자에게 안 보였음.

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
        or exists (
          select 1
          from public.profiles pr
          where pr.id = auth.uid()
            and coalesce(trim(pr.name), '') <> ''
            and (
              exists (
                select 1
                from public.work_log_persons wlp
                where wlp.work_log_id = wl.id
                  and wlp.person_name = trim(pr.name)
              )
              or exists (
                select 1
                from public.work_log_entry_persons wlep
                join public.work_log_entries e on e.id = wlep.entry_id
                where e.work_log_id = wl.id
                  and wlep.person_name = trim(pr.name)
              )
            )
        )
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
  using (public.user_can_read_work_log(id));

notify pgrst, 'reload schema';
