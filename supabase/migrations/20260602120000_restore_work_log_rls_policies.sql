-- 출장 보고서(work_logs) 및 관련 테이블 RLS 복구
-- Table Editor에서 정책이 잘못 수정되어 목록/조회가 비는 경우 Supabase SQL Editor에서 실행하세요.
--
-- 프론트엔드 기대 동작:
-- - authenticated: 제출된 보고서(is_draft=false) 목록 조회 (staff는 앱에서 참여자 필터)
-- - 작성자: 본인 임시저장·수정·삭제
-- - admin(profiles.role=admin): 전체 조회·수정·삭제

-- ---------------------------------------------------------------------------
-- helpers (기존 public.is_admin() 사용, profiles RLS 재귀 방지)
-- ---------------------------------------------------------------------------

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
      )
  );
$$;

comment on function public.user_can_read_work_log(bigint) is
  '보고서 읽기: admin, 작성자, 또는 제출 완료 보고서';

grant execute on function public.user_can_read_work_log(bigint) to authenticated;

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
      )
  );
$$;

comment on function public.user_can_modify_work_log(bigint) is
  '보고서 쓰기: admin 또는 작성자';

grant execute on function public.user_can_modify_work_log(bigint) to authenticated;

create or replace function public.user_can_read_work_log_entry(entry_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.work_log_entries e
    where e.id = entry_id
      and public.user_can_read_work_log(e.work_log_id)
  );
$$;

grant execute on function public.user_can_read_work_log_entry(bigint) to authenticated;

create or replace function public.user_can_modify_work_log_entry(entry_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.work_log_entries e
    where e.id = entry_id
      and public.user_can_modify_work_log(e.work_log_id)
  );
$$;

grant execute on function public.user_can_modify_work_log_entry(bigint) to authenticated;

-- ---------------------------------------------------------------------------
-- drop all existing policies on target tables (수동 변경분 초기화)
-- ---------------------------------------------------------------------------

do $$
declare
  r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'work_logs',
        'work_log_entries',
        'work_log_entry_persons',
        'work_log_persons',
        'work_log_expenses',
        'work_log_materials',
        'work_log_receipt'
      )
  loop
    execute format(
      'drop policy if exists %I on public.%I',
      r.policyname,
      r.tablename
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- work_logs
-- ---------------------------------------------------------------------------

alter table public.work_logs enable row level security;

create policy "work_logs_select_authenticated"
  on public.work_logs
  for select
  to authenticated
  using (
    public.is_admin()
    or created_by = auth.uid()
    or coalesce(is_draft, false) = false
  );

create policy "work_logs_insert_own"
  on public.work_logs
  for insert
  to authenticated
  with check (
    auth.uid() is not null
    and (created_by is null or created_by = auth.uid())
  );

create policy "work_logs_update_owner_or_admin"
  on public.work_logs
  for update
  to authenticated
  using (
    public.is_admin()
    or created_by = auth.uid()
  )
  with check (
    public.is_admin()
    or created_by = auth.uid()
  );

create policy "work_logs_delete_owner_or_admin"
  on public.work_logs
  for delete
  to authenticated
  using (
    public.is_admin()
    or created_by = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- work_log_entries
-- ---------------------------------------------------------------------------

alter table public.work_log_entries enable row level security;

create policy "work_log_entries_select"
  on public.work_log_entries
  for select
  to authenticated
  using (public.user_can_read_work_log(work_log_id));

create policy "work_log_entries_insert"
  on public.work_log_entries
  for insert
  to authenticated
  with check (public.user_can_modify_work_log(work_log_id));

create policy "work_log_entries_update"
  on public.work_log_entries
  for update
  to authenticated
  using (public.user_can_modify_work_log(work_log_id))
  with check (public.user_can_modify_work_log(work_log_id));

create policy "work_log_entries_delete"
  on public.work_log_entries
  for delete
  to authenticated
  using (public.user_can_modify_work_log(work_log_id));

-- ---------------------------------------------------------------------------
-- work_log_entry_persons
-- ---------------------------------------------------------------------------

alter table public.work_log_entry_persons enable row level security;

create policy "work_log_entry_persons_select"
  on public.work_log_entry_persons
  for select
  to authenticated
  using (public.user_can_read_work_log_entry(entry_id));

create policy "work_log_entry_persons_insert"
  on public.work_log_entry_persons
  for insert
  to authenticated
  with check (public.user_can_modify_work_log_entry(entry_id));

create policy "work_log_entry_persons_update"
  on public.work_log_entry_persons
  for update
  to authenticated
  using (public.user_can_modify_work_log_entry(entry_id))
  with check (public.user_can_modify_work_log_entry(entry_id));

create policy "work_log_entry_persons_delete"
  on public.work_log_entry_persons
  for delete
  to authenticated
  using (public.user_can_modify_work_log_entry(entry_id));

-- ---------------------------------------------------------------------------
-- work_log_persons / expenses / materials
-- ---------------------------------------------------------------------------

alter table public.work_log_persons enable row level security;

create policy "work_log_persons_select"
  on public.work_log_persons
  for select
  to authenticated
  using (public.user_can_read_work_log(work_log_id));

create policy "work_log_persons_insert"
  on public.work_log_persons
  for insert
  to authenticated
  with check (public.user_can_modify_work_log(work_log_id));

create policy "work_log_persons_update"
  on public.work_log_persons
  for update
  to authenticated
  using (public.user_can_modify_work_log(work_log_id))
  with check (public.user_can_modify_work_log(work_log_id));

create policy "work_log_persons_delete"
  on public.work_log_persons
  for delete
  to authenticated
  using (public.user_can_modify_work_log(work_log_id));

alter table public.work_log_expenses enable row level security;

create policy "work_log_expenses_select"
  on public.work_log_expenses
  for select
  to authenticated
  using (public.user_can_read_work_log(work_log_id));

create policy "work_log_expenses_insert"
  on public.work_log_expenses
  for insert
  to authenticated
  with check (public.user_can_modify_work_log(work_log_id));

create policy "work_log_expenses_update"
  on public.work_log_expenses
  for update
  to authenticated
  using (public.user_can_modify_work_log(work_log_id))
  with check (public.user_can_modify_work_log(work_log_id));

create policy "work_log_expenses_delete"
  on public.work_log_expenses
  for delete
  to authenticated
  using (public.user_can_modify_work_log(work_log_id));

alter table public.work_log_materials enable row level security;

create policy "work_log_materials_select"
  on public.work_log_materials
  for select
  to authenticated
  using (public.user_can_read_work_log(work_log_id));

create policy "work_log_materials_insert"
  on public.work_log_materials
  for insert
  to authenticated
  with check (public.user_can_modify_work_log(work_log_id));

create policy "work_log_materials_update"
  on public.work_log_materials
  for update
  to authenticated
  using (public.user_can_modify_work_log(work_log_id))
  with check (public.user_can_modify_work_log(work_log_id));

create policy "work_log_materials_delete"
  on public.work_log_materials
  for delete
  to authenticated
  using (public.user_can_modify_work_log(work_log_id));

-- ---------------------------------------------------------------------------
-- work_log_receipt (created_by는 work_logs.created_by와 맞춤)
-- ---------------------------------------------------------------------------

alter table public.work_log_receipt enable row level security;

create policy "work_log_receipt_select"
  on public.work_log_receipt
  for select
  to authenticated
  using (public.user_can_read_work_log(work_log_id));

create policy "work_log_receipt_insert"
  on public.work_log_receipt
  for insert
  to authenticated
  with check (
    public.user_can_modify_work_log(work_log_id)
    and (created_by is null or created_by = auth.uid())
  );

create policy "work_log_receipt_update"
  on public.work_log_receipt
  for update
  to authenticated
  using (public.user_can_modify_work_log(work_log_id))
  with check (public.user_can_modify_work_log(work_log_id));

create policy "work_log_receipt_delete"
  on public.work_log_receipt
  for delete
  to authenticated
  using (public.user_can_modify_work_log(work_log_id));

-- profiles SELECT는 기존 profiles_select_all_authenticated 유지 (변경 없음)

-- ---------------------------------------------------------------------------
-- work_log_entries_with_hours 뷰 (목록 기간·워크로드 집계)
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'work_log_entries_with_hours'
      and c.relkind = 'v'
  ) then
    begin
      execute 'alter view public.work_log_entries_with_hours set (security_invoker = true)';
    exception
      when others then
        raise notice 'work_log_entries_with_hours security_invoker: %', sqlerrm;
    end;
  end if;
end $$;

grant select on public.work_log_entries_with_hours to authenticated;

grant select, insert, update, delete on table public.work_logs to authenticated;
grant select, insert, update, delete on table public.work_log_entries to authenticated;
grant select, insert, update, delete on table public.work_log_entry_persons to authenticated;
grant select, insert, update, delete on table public.work_log_persons to authenticated;
grant select, insert, update, delete on table public.work_log_expenses to authenticated;
grant select, insert, update, delete on table public.work_log_materials to authenticated;
grant select, insert, update, delete on table public.work_log_receipt to authenticated;
