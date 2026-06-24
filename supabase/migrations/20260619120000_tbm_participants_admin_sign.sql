-- TBM 참가자 서명: staff는 본인만, admin(role=admin)은 전원 서명 처리 가능

drop policy if exists "tbm_participants_update_sign_self" on public.tbm_participants;
drop policy if exists "tbm_participants_update_sign" on public.tbm_participants;
drop policy if exists "TBM participants sign" on public.tbm_participants;

create policy "tbm_participants_update_sign"
  on public.tbm_participants
  for update
  to authenticated
  using (user_id = auth.uid() or public.is_profile_admin())
  with check (user_id = auth.uid() or public.is_profile_admin());

grant update on table public.tbm_participants to authenticated;
