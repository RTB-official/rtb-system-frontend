-- 개인 지출·마일리지 RLS 복구 (구성원 지출 관리 / 개인 지출 기록)
-- personal_* 테이블: RLS만 켜지고 정책 0개면 조회 불가

-- admin 또는 대표(CEO): 전 구성원 지출 조회 (MemberExpensePage)
create or replace function public.can_view_all_personal_expenses()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin()
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.position = '대표'
    );
$$;

comment on function public.can_view_all_personal_expenses() is
  '구성원 지출 관리: admin 또는 position=대표';

grant execute on function public.can_view_all_personal_expenses() to authenticated;

-- ---------------------------------------------------------------------------
-- personal_expenses
-- ---------------------------------------------------------------------------

do $$
declare r record;
begin
  for r in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'personal_expenses'
  loop
    execute format('drop policy if exists %I on public.personal_expenses', r.policyname);
  end loop;
end $$;

alter table public.personal_expenses enable row level security;

create policy "personal_expenses_select_own_or_manager"
  on public.personal_expenses
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.can_view_all_personal_expenses()
  );

create policy "personal_expenses_insert_own"
  on public.personal_expenses
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "personal_expenses_update_own"
  on public.personal_expenses
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "personal_expenses_delete_own"
  on public.personal_expenses
  for delete
  to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- personal_mileage
-- ---------------------------------------------------------------------------

do $$
declare r record;
begin
  for r in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'personal_mileage'
  loop
    execute format('drop policy if exists %I on public.personal_mileage', r.policyname);
  end loop;
end $$;

alter table public.personal_mileage enable row level security;

create policy "personal_mileage_select_own_or_manager"
  on public.personal_mileage
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.can_view_all_personal_expenses()
  );

create policy "personal_mileage_insert_own"
  on public.personal_mileage
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "personal_mileage_update_own"
  on public.personal_mileage
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "personal_mileage_delete_own"
  on public.personal_mileage
  for delete
  to authenticated
  using (user_id = auth.uid());

grant select, insert, update, delete on table public.personal_expenses to authenticated;
grant select, insert, update, delete on table public.personal_mileage to authenticated;
