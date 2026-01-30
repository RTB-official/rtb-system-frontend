-- Allow any participant to see all participants on the same TBM
drop policy if exists "TBM participants select" on public.tbm_participants;
create policy "TBM participants select"
  on public.tbm_participants for select
  using (
    public.is_tbm_participant(tbm_id)
    or public.is_tbm_creator(tbm_id)
    or exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );
