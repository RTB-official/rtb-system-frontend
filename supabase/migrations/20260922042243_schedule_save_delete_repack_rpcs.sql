-- Atomic save (label resolved at save time) + delete with A/B/C repack

create or replace function public.schedule_next_version_label(p_labels text[])
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  i int;
  lbl text;
  used text[] := coalesce(p_labels, '{}'::text[]);
begin
  for i in 0..25 loop
    lbl := chr(65 + i);
    if not exists (
      select 1
      from unnest(used) as x
      where upper(btrim(coalesce(x, ''))) = lbl
    ) then
      return lbl;
    end if;
  end loop;

  raise exception '그날의 일정 버전 라벨(A–Z)이 모두 사용되었습니다.';
end;
$$;

create or replace function public.save_schedule_version(
  p_schedule_date date,
  p_rows jsonb,
  p_source_filename text default null
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
    source_filename
  ) values (
    p_schedule_date,
    v_label,
    v_uid,
    nullif(btrim(coalesce(p_source_filename, '')), '')
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

  return jsonb_build_object(
    'version_id', v_version_id,
    'schedule_date', p_schedule_date,
    'version_label', v_label,
    'version_key', p_schedule_date::text || v_label,
    'row_count', v_pos
  );
end;
$$;

comment on function public.save_schedule_version(date, jsonb, text) is
  'Save schedule sheet: upsert content-addressed rows, allocate next A–Z label at save time.';

create or replace function public.delete_schedule_version_and_repack(p_version_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_date date;
  v_ids uuid[];
  i int;
  v_new_labels text[] := '{}'::text[];
  v_lbl text;
begin
  if v_uid is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select schedule_date into v_date
  from public.schedule_versions
  where id = p_version_id;

  if v_date is null then
    raise exception '일정 버전을 찾을 수 없습니다.';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('schedule_version:' || v_date::text, 0)
  );

  delete from public.schedule_versions
  where id = p_version_id;

  if not found then
    raise exception '일정 버전을 찾을 수 없습니다.';
  end if;

  select coalesce(
    array_agg(id order by version_label, created_at, id),
    '{}'::uuid[]
  )
  into v_ids
  from public.schedule_versions
  where schedule_date = v_date;

  for i in 1..coalesce(array_length(v_ids, 1), 0) loop
    update public.schedule_versions
    set version_label = '~' || i::text,
        updated_at = now()
    where id = v_ids[i];
  end loop;

  for i in 1..coalesce(array_length(v_ids, 1), 0) loop
    if i > 26 then
      raise exception '버전 라벨 재부여 한도(A–Z)를 초과했습니다.';
    end if;
    v_lbl := chr(64 + i);
    update public.schedule_versions
    set version_label = v_lbl,
        updated_at = now()
    where id = v_ids[i];
    v_new_labels := array_append(v_new_labels, v_lbl);
  end loop;

  return jsonb_build_object(
    'schedule_date', v_date,
    'deleted_version_id', p_version_id,
    'remaining_labels', to_jsonb(v_new_labels)
  );
end;
$$;

comment on function public.delete_schedule_version_and_repack(uuid) is
  'Delete a schedule version and renumber remaining labels for that date to A,B,C…';

grant execute on function public.schedule_next_version_label(text[]) to authenticated;
grant execute on function public.save_schedule_version(date, jsonb, text) to authenticated;
grant execute on function public.delete_schedule_version_and_repack(uuid) to authenticated;
