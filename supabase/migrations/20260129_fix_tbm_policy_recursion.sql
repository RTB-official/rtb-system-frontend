-- Fix TBM RLS policy recursion by using security definer helpers

create or replace function public.is_tbm_creator(tbm_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists(
    select 1
    from public.tbm t
    where t.id = tbm_id
      and t.created_by = auth.uid()
  );
$$;

create or replace function public.is_tbm_participant(tbm_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists(
    select 1
    from public.tbm_participants p
    where p.tbm_id = tbm_id
      and p.user_id = auth.uid()
  );
$$;

drop policy if exists "TBM select creator/participant/admin" on public.tbm;
create policy "TBM select creator/participant/admin"
  on public.tbm for select
  using (
    created_by = auth.uid()
    or public.is_tbm_participant(id)
    or exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

drop policy if exists "TBM participants select" on public.tbm_participants;
create policy "TBM participants select"
  on public.tbm_participants for select
  using (
    user_id = auth.uid()
    or public.is_tbm_creator(tbm_id)
    or exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

drop policy if exists "TBM participants insert" on public.tbm_participants;
create policy "TBM participants insert"
  on public.tbm_participants for insert
  with check (
    public.is_tbm_creator(tbm_id)
    or exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

drop policy if exists "TBM participants update" on public.tbm_participants;
create policy "TBM participants update"
  on public.tbm_participants for update
  using (
    user_id = auth.uid()
    or public.is_tbm_creator(tbm_id)
    or exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  )
  with check (
    user_id = auth.uid()
    or public.is_tbm_creator(tbm_id)
    or exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );
