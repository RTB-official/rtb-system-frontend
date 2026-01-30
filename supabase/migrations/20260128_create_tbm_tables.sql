-- TBM tables + notifications meta column

-- Notifications meta column (optional payload)
alter table if exists notifications
  add column if not exists meta text;

-- TBM master table
create table if not exists tbm (
  id uuid primary key default gen_random_uuid(),
  tbm_date date,
  work_name text,
  work_content text,
  location text,
  risk_assessment boolean,
  process text,
  hazard text,
  measure text,
  during_result text,
  after_meeting text,
  created_by uuid not null,
  created_by_name text,
  created_at timestamptz not null default now()
);

-- TBM participants
create table if not exists tbm_participants (
  id uuid primary key default gen_random_uuid(),
  tbm_id uuid not null references tbm(id) on delete cascade,
  user_id uuid not null,
  name text,
  signed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (tbm_id, user_id)
);

alter table tbm enable row level security;
alter table tbm_participants enable row level security;

-- TBM select: creator, participant, or admin
create policy "TBM select creator/participant/admin"
  on tbm for select
  using (
    created_by = auth.uid()
    or exists (
      select 1 from tbm_participants p
      where p.tbm_id = tbm.id and p.user_id = auth.uid()
    )
    or exists (
      select 1 from profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

-- TBM insert: authenticated user can create own TBM
create policy "TBM insert by creator"
  on tbm for insert
  with check (created_by = auth.uid());

-- TBM update/delete: creator or admin
create policy "TBM update by creator/admin"
  on tbm for update
  using (
    created_by = auth.uid()
    or exists (
      select 1 from profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  )
  with check (
    created_by = auth.uid()
    or exists (
      select 1 from profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

create policy "TBM delete by creator/admin"
  on tbm for delete
  using (
    created_by = auth.uid()
    or exists (
      select 1 from profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

-- TBM participants select: participant, creator, or admin
create policy "TBM participants select"
  on tbm_participants for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from tbm t
      where t.id = tbm_participants.tbm_id and t.created_by = auth.uid()
    )
    or exists (
      select 1 from profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

-- TBM participants insert: creator or admin
create policy "TBM participants insert"
  on tbm_participants for insert
  with check (
    exists (
      select 1 from tbm t
      where t.id = tbm_participants.tbm_id and t.created_by = auth.uid()
    )
    or exists (
      select 1 from profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

-- TBM participants update: participant (for signing) or creator/admin
create policy "TBM participants update"
  on tbm_participants for update
  using (
    user_id = auth.uid()
    or exists (
      select 1 from tbm t
      where t.id = tbm_participants.tbm_id and t.created_by = auth.uid()
    )
    or exists (
      select 1 from profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  )
  with check (
    user_id = auth.uid()
    or exists (
      select 1 from tbm t
      where t.id = tbm_participants.tbm_id and t.created_by = auth.uid()
    )
    or exists (
      select 1 from profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );
