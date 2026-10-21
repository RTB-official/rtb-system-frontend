-- 개인 일정: 팀원 누구나 수정·삭제 가능

drop policy if exists "schedule_personal_entries_update_authenticated"
  on public.schedule_personal_entries;
create policy "schedule_personal_entries_update_authenticated"
  on public.schedule_personal_entries
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "schedule_personal_entries_delete_own"
  on public.schedule_personal_entries;
create policy "schedule_personal_entries_delete_authenticated"
  on public.schedule_personal_entries
  for delete
  to authenticated
  using (true);

grant update on public.schedule_personal_entries to authenticated;
