-- 수정 권한 부여는 최초 작성자와 admin만 가능하다.
-- 권한을 받은 계정은 보고서를 수정할 수 있지만, 다른 사람에게 권한을 줄 수는 없다.

create or replace function public.user_can_grant_work_log_edit(wl_id bigint)
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
      )
  );
$$;

comment on function public.user_can_grant_work_log_edit(bigint) is
  '수정 권한 부여: admin 또는 최초 작성자';

drop policy if exists "work_log_editors_insert" on public.work_log_editors;
drop policy if exists "work_log_editors_delete" on public.work_log_editors;

create policy "work_log_editors_insert"
  on public.work_log_editors
  for insert
  to authenticated
  with check (public.user_can_grant_work_log_edit(work_log_id));

create policy "work_log_editors_delete"
  on public.work_log_editors
  for delete
  to authenticated
  using (public.user_can_grant_work_log_edit(work_log_id));

notify pgrst, 'reload schema';
