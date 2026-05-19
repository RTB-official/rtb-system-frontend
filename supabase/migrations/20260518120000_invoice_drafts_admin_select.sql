-- admin(role=admin)은 모든 인보이스 드래프트 조회 가능
create or replace function public.is_profile_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

comment on function public.is_profile_admin() is 'profiles.role=admin 여부 (RLS 정책용)';

grant execute on function public.is_profile_admin() to authenticated;

drop policy if exists "invoice_drafts_select_own" on public.invoice_drafts;
drop policy if exists "invoice_drafts_select_own_or_admin" on public.invoice_drafts;

create policy "invoice_drafts_select_own_or_admin"
  on public.invoice_drafts
  for select
  to authenticated
  using (auth.uid() = created_by or public.is_profile_admin());
