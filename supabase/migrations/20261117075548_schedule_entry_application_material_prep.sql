-- schedule_rows: 출입신청 / 자재준비 컬럼 추가 (Remark 우측, 더보기로 표시)

alter table public.schedule_rows
  drop constraint if exists schedule_rows_content_hash_key;

alter table public.schedule_rows
  drop column if exists content_hash;

alter table public.schedule_rows
  add column if not exists entry_application text not null default '';

alter table public.schedule_rows
  add column if not exists material_prep text not null default '';

comment on column public.schedule_rows.entry_application is '출입신청';
comment on column public.schedule_rows.material_prep is '자재준비';

drop function if exists public.schedule_row_content_hash(
  text, text, text, text, text, text, text, text, text, text, text, text
);

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
  p_remark text,
  p_entry_application text default '',
  p_material_prep text default ''
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
          public.normalize_schedule_text(p_remark),
          public.normalize_schedule_text(p_entry_application),
          public.normalize_schedule_text(p_material_prep)
        ),
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );
$$;

comment on function public.schedule_row_content_hash(
  text, text, text, text, text, text, text, text, text, text, text, text, text, text
) is
  'SHA-256 hex of 14 normalized schedule row fields (unit separator delimited).';

grant execute on function public.schedule_row_content_hash(
  text, text, text, text, text, text, text, text, text, text, text, text, text, text
) to authenticated;

alter table public.schedule_rows
  add column content_hash text generated always as (
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
      remark,
      entry_application,
      material_prep
    )
  ) stored;

alter table public.schedule_rows
  add constraint schedule_rows_content_hash_key unique (content_hash);

comment on table public.schedule_rows is
  'Schedule row ledger (append-only). Identical normalized 14 fields reuse content_hash/id.';
comment on column public.schedule_rows.content_hash is
  'DB-generated SHA-256 of normalized 14 fields; UNIQUE for dedup.';

drop function if exists public.save_schedule_version(date, jsonb, text, jsonb);

create or replace function public.save_schedule_version(
  p_schedule_date date,
  p_rows jsonb,
  p_source_filename text default null,
  p_cell_merges jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_label text;
  v_version_id uuid;
  v_row jsonb;
  v_row_id uuid;
  v_pos int := 0;
  v_existing text[];
  v_hash text;
  v_cc text; v_ct text; v_sn text; v_et text; v_wl text; v_pe text;
  v_wi text; v_mp text; v_tm text; v_car text; v_yp text; v_rm text;
  v_ea text; v_mat text;
  v_all_empty boolean;
  v_merges jsonb := '[]'::jsonb;
  v_merge jsonb;
  v_field text;
  v_start int;
  v_end int;
  v_allowed_fields text[] := array[
    'customerCompany',
    'customerContact',
    'shipName',
    'engineType',
    'workLocation',
    'period',
    'workItem',
    'manpower',
    'teamMember',
    'car',
    'yardPic',
    'remark',
    'entryApplication',
    'materialPrep'
  ];
begin
  if v_uid is null then
    raise exception '로그인이 필요합니다.';
  end if;

  if p_schedule_date is null then
    raise exception 'schedule_date가 필요합니다.';
  end if;

  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception '행 데이터가 올바르지 않습니다.';
  end if;

  if p_cell_merges is not null and jsonb_typeof(p_cell_merges) <> 'array' then
    raise exception '셀 병합 데이터가 올바르지 않습니다.';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('schedule_version:' || p_schedule_date::text, 0)
  );

  select coalesce(array_agg(version_label), '{}'::text[])
  into v_existing
  from public.schedule_versions
  where schedule_date = p_schedule_date;

  v_label := public.schedule_next_version_label(v_existing);

  insert into public.schedule_versions (
    schedule_date,
    version_label,
    created_by,
    source_filename,
    cell_merges
  ) values (
    p_schedule_date,
    v_label,
    v_uid,
    nullif(btrim(coalesce(p_source_filename, '')), ''),
    '[]'::jsonb
  )
  returning id into v_version_id;

  for v_row in
    select value from jsonb_array_elements(p_rows)
  loop
    v_cc := coalesce(v_row->>'customer_company', v_row->>'customerCompany', '');
    v_ct := coalesce(v_row->>'customer_contact', v_row->>'customerContact', '');
    v_sn := coalesce(v_row->>'ship_name', v_row->>'shipName', '');
    v_et := coalesce(v_row->>'engine_type', v_row->>'engineType', '');
    v_wl := coalesce(v_row->>'work_location', v_row->>'workLocation', '');
    v_pe := coalesce(v_row->>'period', '');
    v_wi := coalesce(v_row->>'work_item', v_row->>'workItem', '');
    v_mp := coalesce(v_row->>'manpower', '');
    v_tm := coalesce(v_row->>'team_member', v_row->>'teamMember', '');
    v_car := coalesce(v_row->>'car', '');
    v_yp := coalesce(v_row->>'yard_pic', v_row->>'yardPic', '');
    v_rm := coalesce(v_row->>'remark', '');
    v_ea := coalesce(v_row->>'entry_application', v_row->>'entryApplication', '');
    v_mat := coalesce(v_row->>'material_prep', v_row->>'materialPrep', '');

    v_all_empty :=
      public.normalize_schedule_text(v_cc) = ''
      and public.normalize_schedule_text(v_ct) = ''
      and public.normalize_schedule_text(v_sn) = ''
      and public.normalize_schedule_text(v_et) = ''
      and public.normalize_schedule_text(v_wl) = ''
      and public.normalize_schedule_text(v_pe) = ''
      and public.normalize_schedule_text(v_wi) = ''
      and public.normalize_schedule_text(v_mp) = ''
      and public.normalize_schedule_text(v_tm) = ''
      and public.normalize_schedule_text(v_car) = ''
      and public.normalize_schedule_text(v_yp) = ''
      and public.normalize_schedule_text(v_rm) = ''
      and public.normalize_schedule_text(v_ea) = ''
      and public.normalize_schedule_text(v_mat) = '';

    if v_all_empty then
      continue;
    end if;

    v_pos := v_pos + 1;
    v_hash := public.schedule_row_content_hash(
      v_cc, v_ct, v_sn, v_et, v_wl, v_pe, v_wi, v_mp, v_tm, v_car, v_yp, v_rm, v_ea, v_mat
    );

    insert into public.schedule_rows (
      customer_company, customer_contact, ship_name, engine_type,
      work_location, period, work_item, manpower, team_member,
      car, yard_pic, remark, entry_application, material_prep
    ) values (
      v_cc, v_ct, v_sn, v_et, v_wl, v_pe, v_wi, v_mp, v_tm, v_car, v_yp, v_rm, v_ea, v_mat
    )
    on conflict (content_hash) do nothing;

    select id into v_row_id
    from public.schedule_rows
    where content_hash = v_hash;

    if v_row_id is null then
      raise exception '행 저장에 실패했습니다. (position %)', v_pos;
    end if;

    insert into public.schedule_version_rows (version_id, row_id, position)
    values (v_version_id, v_row_id, v_pos);
  end loop;

  if v_pos = 0 then
    raise exception '저장할 일정 행이 없습니다.';
  end if;

  if p_cell_merges is not null then
    for v_merge in
      select value from jsonb_array_elements(p_cell_merges)
    loop
      v_field := coalesce(v_merge->>'field', '');
      begin
        v_start := (v_merge->>'start')::int;
        v_end := (v_merge->>'end')::int;
      exception
        when others then
          raise exception '셀 병합 범위가 올바르지 않습니다.';
      end;

      if not (v_field = any (v_allowed_fields)) then
        raise exception '셀 병합 필드가 올바르지 않습니다: %', v_field;
      end if;

      if v_start is null or v_end is null or v_start < 1 or v_end < v_start or v_end > v_pos then
        raise exception '셀 병합 범위가 행 수를 벗어났습니다. (%-% / %)', v_start, v_end, v_pos;
      end if;

      v_merges := v_merges || jsonb_build_array(
        jsonb_build_object(
          'field', v_field,
          'start', v_start,
          'end', v_end
        )
      );
    end loop;
  end if;

  update public.schedule_versions
  set cell_merges = v_merges
  where id = v_version_id;

  return jsonb_build_object(
    'version_id', v_version_id,
    'schedule_date', p_schedule_date,
    'version_label', v_label,
    'version_key', p_schedule_date::text || v_label,
    'row_count', v_pos
  );
end;
$$;

comment on function public.save_schedule_version(date, jsonb, text, jsonb) is
  'Save schedule sheet with optional cell merges; allocate next A–Z label at save time.';

grant execute on function public.save_schedule_version(date, jsonb, text, jsonb) to authenticated;

notify pgrst, 'reload schema';
