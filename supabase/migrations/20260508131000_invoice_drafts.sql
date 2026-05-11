create table if not exists public.invoice_drafts (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users (id) on delete cascade,
  title text not null default 'Untitled invoice draft',
  work_log_ids bigint[] not null default '{}'::bigint[],
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'final')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.invoice_drafts is '인보이스 생성 화면 드래프트(수동 저장/불러오기) payload 보관';

create index if not exists invoice_drafts_created_by_updated_at_idx
  on public.invoice_drafts (created_by, updated_at desc);

create index if not exists invoice_drafts_work_log_ids_gin_idx
  on public.invoice_drafts using gin (work_log_ids);

alter table public.invoice_drafts enable row level security;

drop policy if exists "invoice_drafts_select_own" on public.invoice_drafts;
create policy "invoice_drafts_select_own"
  on public.invoice_drafts
  for select
  to authenticated
  using (auth.uid() = created_by);

drop policy if exists "invoice_drafts_insert_own" on public.invoice_drafts;
create policy "invoice_drafts_insert_own"
  on public.invoice_drafts
  for insert
  to authenticated
  with check (auth.uid() = created_by);

drop policy if exists "invoice_drafts_update_own" on public.invoice_drafts;
create policy "invoice_drafts_update_own"
  on public.invoice_drafts
  for update
  to authenticated
  using (auth.uid() = created_by)
  with check (auth.uid() = created_by);

drop policy if exists "invoice_drafts_delete_own" on public.invoice_drafts;
create policy "invoice_drafts_delete_own"
  on public.invoice_drafts
  for delete
  to authenticated
  using (auth.uid() = created_by);
