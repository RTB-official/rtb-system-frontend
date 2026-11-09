-- Persist visual cell merges on schedule versions (position + field based)

alter table public.schedule_versions
  add column if not exists cell_merges jsonb not null default '[]'::jsonb;

comment on column public.schedule_versions.cell_merges is
  'Visual cell merges: [{field, start, end}] with 1-based row positions in this version.';

alter table public.schedule_versions
  drop constraint if exists schedule_versions_cell_merges_is_array;

alter table public.schedule_versions
  add constraint schedule_versions_cell_merges_is_array
  check (jsonb_typeof(cell_merges) = 'array');

drop function if exists public.save_schedule_version(date, jsonb, text);

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
    'remark'
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
      and public.normalize_schedule_text(v_rm) = '';

    if v_all_empty then
      continue;
    end if;

    v_pos := v_pos + 1;
    v_hash := public.schedule_row_content_hash(
      v_cc, v_ct, v_sn, v_et, v_wl, v_pe, v_wi, v_mp, v_tm, v_car, v_yp, v_rm
    );

    insert into public.schedule_rows (
      customer_company, customer_contact, ship_name, engine_type,
      work_location, period, work_item, manpower, team_member,
      car, yard_pic, remark
    ) values (
      v_cc, v_ct, v_sn, v_et, v_wl, v_pe, v_wi, v_mp, v_tm, v_car, v_yp, v_rm
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
