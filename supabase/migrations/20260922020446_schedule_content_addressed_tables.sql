-- schedule: content-addressed rows + dated A/B versions (additive only)

create or replace function public.normalize_schedule_text(t text)
returns text
language sql
immutable
parallel safe
set search_path = public
as $$
  select replace(replace(btrim(coalesce(t, '')), E'\r\n', E'\n'), E'\r', E'\n');
$$;

comment on function public.normalize_schedule_text(text) is
  'Schedule row field normalize: null→empty, trim, CRLF/CR→LF. No case/internal-space changes.';

grant execute on function public.normalize_schedule_text(text) to authenticated;

create or replace function public.schedule_row_content_hash(
  p_customer_company text,
  p_customer_contact text,
  p_ship_name text,
  p_engine_type text,
  p_work_location text,
  p_period text,
  p_work_item text,
  p_manpower text,
  p_team_member text,
  p_car text,
  p_yard_pic text,
  p_remark text
)
returns text
language sql
immutable
parallel safe
set search_path = public, extensions
as $$
  select encode(
    extensions.digest(
      convert_to(
        concat_ws(
          E'\x1f',
          public.normalize_schedule_text(p_customer_company),
          public.normalize_schedule_text(p_customer_contact),
          public.normalize_schedule_text(p_ship_name),
          public.normalize_schedule_text(p_engine_type),
          public.normalize_schedule_text(p_work_location),
          public.normalize_schedule_text(p_period),
          public.normalize_schedule_text(p_work_item),
          public.normalize_schedule_text(p_manpower),
          public.normalize_schedule_text(p_team_member),
          public.normalize_schedule_text(p_car),
          public.normalize_schedule_text(p_yard_pic),
          public.normalize_schedule_text(p_remark)
        ),
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );
$$;

comment on function public.schedule_row_content_hash(
  text, text, text, text, text, text, text, text, text, text, text, text
) is
  'SHA-256 hex of 12 normalized schedule row fields (unit separator delimited).';

grant execute on function public.schedule_row_content_hash(
  text, text, text, text, text, text, text, text, text, text, text, text
) to authenticated;

create table if not exists public.schedule_rows (
  id uuid primary key default gen_random_uuid(),
  customer_company text not null default '',
  customer_contact text not null default '',
  ship_name text not null default '',
  engine_type text not null default '',
  work_location text not null default '',
  period text not null default '',
  work_item text not null default '',
  manpower text not null default '',
  team_member text not null default '',
  car text not null default '',
  yard_pic text not null default '',
  remark text not null default '',
  content_hash text generated always as (
    public.schedule_row_content_hash(
      customer_company,
      customer_contact,
      ship_name,
      engine_type,
      work_location,
      period,
      work_item,
      manpower,
      team_member,
      car,
      yard_pic,
      remark
    )
  ) stored,
  created_at timestamptz not null default now(),
  constraint schedule_rows_content_hash_key unique (content_hash)
);

comment on table public.schedule_rows is
  'Schedule row ledger (append-only). Identical normalized 12 fields reuse content_hash/id.';
comment on column public.schedule_rows.period is
  'Work period text inside the row (not schedule_versions.schedule_date).';
comment on column public.schedule_rows.content_hash is
  'DB-generated SHA-256 of normalized 12 fields; UNIQUE for dedup.';

create table if not exists public.schedule_versions (
  id uuid primary key default gen_random_uuid(),
  schedule_date date not null,
  version_label text not null,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source_filename text,
  constraint schedule_versions_date_label_key unique (schedule_date, version_label),
  constraint schedule_versions_version_label_nonempty
    check (length(btrim(version_label)) > 0)
);

comment on table public.schedule_versions is
  'Schedule sheet versions by creation date + label (A/B/C). Duplicate key rejected (no overwrite).';
comment on column public.schedule_versions.schedule_date is
  'Date the schedule sheet was created (not row work dates).';
comment on column public.schedule_versions.created_by is
  'Creator audit only; read access is not ownership-scoped.';

create index if not exists schedule_versions_schedule_date_idx
  on public.schedule_versions (schedule_date desc, version_label);

create index if not exists schedule_versions_created_by_created_at_idx
  on public.schedule_versions (created_by, created_at desc);

create table if not exists public.schedule_version_rows (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.schedule_versions (id) on delete cascade,
  row_id uuid not null references public.schedule_rows (id) on delete restrict,
  position integer not null,
  constraint schedule_version_rows_version_position_key unique (version_id, position),
  constraint schedule_version_rows_position_positive check (position >= 1)
);

comment on table public.schedule_version_rows is
  'Membership of rows in a version with 1-based position (= Excel No.). Same row_id may repeat.';
comment on column public.schedule_version_rows.position is
  '1-based order matching Excel No.';

create index if not exists schedule_version_rows_row_id_idx
  on public.schedule_version_rows (row_id);

create index if not exists schedule_version_rows_version_id_idx
  on public.schedule_version_rows (version_id);

alter table public.schedule_rows enable row level security;
alter table public.schedule_versions enable row level security;
alter table public.schedule_version_rows enable row level security;

-- schedule_rows: append-only (select + insert). Read not tied to creator.
drop policy if exists "schedule_rows_select_authenticated" on public.schedule_rows;
create policy "schedule_rows_select_authenticated"
  on public.schedule_rows
  for select
  to authenticated
  using (true);

drop policy if exists "schedule_rows_insert_authenticated" on public.schedule_rows;
create policy "schedule_rows_insert_authenticated"
  on public.schedule_rows
  for insert
  to authenticated
  with check (true);

-- schedule_versions: all authenticated can read; insert only as self; no update/delete policies
drop policy if exists "schedule_versions_select_authenticated" on public.schedule_versions;
create policy "schedule_versions_select_authenticated"
  on public.schedule_versions
  for select
  to authenticated
  using (true);

drop policy if exists "schedule_versions_insert_own" on public.schedule_versions;
create policy "schedule_versions_insert_own"
  on public.schedule_versions
  for insert
  to authenticated
  with check (auth.uid() = created_by);

-- schedule_version_rows: read all; insert only into versions created by self
drop policy if exists "schedule_version_rows_select_authenticated" on public.schedule_version_rows;
create policy "schedule_version_rows_select_authenticated"
  on public.schedule_version_rows
  for select
  to authenticated
  using (true);

drop policy if exists "schedule_version_rows_insert_own_version" on public.schedule_version_rows;
create policy "schedule_version_rows_insert_own_version"
  on public.schedule_version_rows
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.schedule_versions v
      where v.id = version_id
        and v.created_by = auth.uid()
    )
  );

grant select, insert on public.schedule_rows to authenticated;
grant select, insert on public.schedule_versions to authenticated;
grant select, insert on public.schedule_version_rows to authenticated;

revoke update, delete on public.schedule_rows from authenticated;
revoke update, delete on public.schedule_versions from authenticated;
revoke update, delete on public.schedule_version_rows from authenticated;
