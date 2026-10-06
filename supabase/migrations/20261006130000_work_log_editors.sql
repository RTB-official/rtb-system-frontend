-- 보고서별 수정 권한. 부여받은 계정(staff 포함)은 해당 보고서를 수정할 수 있다.
-- 보고서 삭제는 기존처럼 작성자 또는 admin만 가능하다.

create table if not exists public.work_log_editors (
  work_log_id bigint not null references public.work_logs (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  granted_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (work_log_id, user_id)
);

create index if not exists work_log_editors_user_id_idx
  on public.work_log_editors (user_id);

comment on table public.work_log_editors is
  '보고서 수정 권한을 부여받은 계정. staff도 이 목록에 있으면 해당 보고서를 수정할 수 있다.';

alter table public.work_log_editors enable row level security;

create or replace function public.user_can_modify_work_log(wl_id bigint)
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
        or exists (
          select 1
          from public.work_log_editors e
          where e.work_log_id = wl.id
            and e.user_id = auth.uid()
        )
      )
  );
$$;

comment on function public.user_can_modify_work_log(bigint) is
  '보고서 쓰기: admin, 작성자, 또는 수정 권한을 부여받은 계정';

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
      )
  );
$$;

comment on function public.user_can_read_work_log(bigint) is
  '보고서 읽기: admin, 작성자, 제출 완료 보고서, 또는 수정 권한을 부여받은 계정';

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
  );

create or replace function public.staff_can_read_work_log_list_item_paging(
  p_work_log_id bigint,
  p_user_id uuid,
  p_profile_name text,
  p_created_by uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_created_by = p_user_id
    or exists (
      select 1
      from public.work_log_editors e
      where e.work_log_id = p_work_log_id
        and e.user_id = p_user_id
    )
    or (
      coalesce(trim(p_profile_name), '') <> ''
      and (
        exists (
          select 1
          from public.work_log_persons wlp
          where wlp.work_log_id = p_work_log_id
            and wlp.person_name = trim(p_profile_name)
        )
        or exists (
          select 1
          from public.work_log_entry_persons wlep
          join public.work_log_entries e on e.id = wlep.entry_id
          where e.work_log_id = p_work_log_id
            and wlep.person_name = trim(p_profile_name)
        )
      )
    );
$$;

drop policy if exists "work_logs_update_owner_or_admin" on public.work_logs;

create policy "work_logs_update_owner_or_admin"
  on public.work_logs
  for update
  to authenticated
  using (public.user_can_modify_work_log(id))
  with check (public.user_can_modify_work_log(id));

drop policy if exists "work_log_editors_select" on public.work_log_editors;
drop policy if exists "work_log_editors_insert" on public.work_log_editors;
drop policy if exists "work_log_editors_delete" on public.work_log_editors;

create policy "work_log_editors_select"
  on public.work_log_editors
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.user_can_modify_work_log(work_log_id)
  );

create policy "work_log_editors_insert"
  on public.work_log_editors
  for insert
  to authenticated
  with check (public.user_can_modify_work_log(work_log_id));

create policy "work_log_editors_delete"
  on public.work_log_editors
  for delete
  to authenticated
  using (public.user_can_modify_work_log(work_log_id));

grant select, insert, delete on table public.work_log_editors to authenticated;

notify pgrst, 'reload schema';
