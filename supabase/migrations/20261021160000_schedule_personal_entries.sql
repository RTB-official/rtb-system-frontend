-- 달력 개인 일정 (일정표·버전과 독립, 날짜칸 빨간 이름용)

create table if not exists public.schedule_personal_entries (
  id uuid primary key default gen_random_uuid(),
  start_date date not null,
  end_date date not null,
  names text[] not null default '{}'::text[],
  reason text not null default '',
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint schedule_personal_entries_range_ok check (end_date >= start_date)
);

comment on table public.schedule_personal_entries is
  'Personal schedules shown as red names on the schedule calendar (not sheet rows/bars).';

create index if not exists schedule_personal_entries_range_idx
  on public.schedule_personal_entries (start_date, end_date);

create index if not exists schedule_personal_entries_created_by_idx
  on public.schedule_personal_entries (created_by, created_at desc);

alter table public.schedule_personal_entries enable row level security;

drop policy if exists "schedule_personal_entries_select_authenticated"
  on public.schedule_personal_entries;
create policy "schedule_personal_entries_select_authenticated"
  on public.schedule_personal_entries
  for select
  to authenticated
  using (true);

drop policy if exists "schedule_personal_entries_insert_own"
  on public.schedule_personal_entries;
create policy "schedule_personal_entries_insert_own"
  on public.schedule_personal_entries
  for insert
  to authenticated
  with check (auth.uid() = created_by);

drop policy if exists "schedule_personal_entries_delete_own"
  on public.schedule_personal_entries;
create policy "schedule_personal_entries_delete_own"
  on public.schedule_personal_entries
  for delete
  to authenticated
  using (auth.uid() = created_by);

grant select, insert, delete on public.schedule_personal_entries to authenticated;
