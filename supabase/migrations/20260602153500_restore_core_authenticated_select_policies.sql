-- 핵심 화면 조회 복구용 RLS SELECT 정책
-- Table Editor에서 RLS 정책이 손상되어 로그인 후 전체 화면이 빈 경우 적용.
-- 우선 앱 복구를 위해 authenticated 사용자의 핵심 업무 데이터 SELECT를 명시 허용한다.

-- profiles: 로그인/사이드바/권한 판별
drop policy if exists "profiles_select_all_authenticated" on public.profiles;
create policy "profiles_select_all_authenticated"
  on public.profiles
  for select
  to authenticated
  using (true);

drop policy if exists "profiles_select_username_for_login" on public.profiles;
create policy "profiles_select_username_for_login"
  on public.profiles
  for select
  to anon
  using (true);

-- 보고서
drop policy if exists "work_logs_select_authenticated" on public.work_logs;
create policy "work_logs_select_authenticated"
  on public.work_logs
  for select
  to authenticated
  using (true);

drop policy if exists "work_log_entries_select" on public.work_log_entries;
create policy "work_log_entries_select"
  on public.work_log_entries
  for select
  to authenticated
  using (true);

drop policy if exists "work_log_entry_persons_select" on public.work_log_entry_persons;
create policy "work_log_entry_persons_select"
  on public.work_log_entry_persons
  for select
  to authenticated
  using (true);

drop policy if exists "work_log_persons_select" on public.work_log_persons;
create policy "work_log_persons_select"
  on public.work_log_persons
  for select
  to authenticated
  using (true);

drop policy if exists "work_log_expenses_select" on public.work_log_expenses;
create policy "work_log_expenses_select"
  on public.work_log_expenses
  for select
  to authenticated
  using (true);

drop policy if exists "work_log_materials_select" on public.work_log_materials;
create policy "work_log_materials_select"
  on public.work_log_materials
  for select
  to authenticated
  using (true);

drop policy if exists "work_log_receipt_select" on public.work_log_receipt;
create policy "work_log_receipt_select"
  on public.work_log_receipt
  for select
  to authenticated
  using (true);

-- TBM
drop policy if exists "TBM select creator/participant/admin" on public.tbm;
create policy "tbm_select_authenticated"
  on public.tbm
  for select
  to authenticated
  using (true);

drop policy if exists "TBM participants select" on public.tbm_participants;
create policy "tbm_participants_select_authenticated"
  on public.tbm_participants
  for select
  to authenticated
  using (true);

drop policy if exists "tbm_hazards_select_authenticated" on public.tbm_hazards;
create policy "tbm_hazards_select_authenticated"
  on public.tbm_hazards
  for select
  to authenticated
  using (true);

drop policy if exists "tbm_processes_select_authenticated" on public.tbm_processes;
create policy "tbm_processes_select_authenticated"
  on public.tbm_processes
  for select
  to authenticated
  using (true);

drop policy if exists "tbm_measures_select_authenticated" on public.tbm_measures;
create policy "tbm_measures_select_authenticated"
  on public.tbm_measures
  for select
  to authenticated
  using (true);

-- 워크로드 보조
alter table if exists public.workload_reasons enable row level security;
drop policy if exists "workload_reasons_select_authenticated" on public.workload_reasons;
create policy "workload_reasons_select_authenticated"
  on public.workload_reasons
  for select
  to authenticated
  using (true);

grant select on table public.profiles to anon, authenticated;
grant select on table public.work_logs to authenticated;
grant select on table public.work_log_entries to authenticated;
grant select on table public.work_log_entry_persons to authenticated;
grant select on table public.work_log_persons to authenticated;
grant select on table public.work_log_expenses to authenticated;
grant select on table public.work_log_materials to authenticated;
grant select on table public.work_log_receipt to authenticated;
grant select on table public.tbm to authenticated;
grant select on table public.tbm_participants to authenticated;
grant select on table public.tbm_hazards to authenticated;
grant select on table public.tbm_processes to authenticated;
grant select on table public.tbm_measures to authenticated;
grant select on table public.workload_reasons to authenticated;
grant select on public.work_log_entries_with_hours to authenticated;

