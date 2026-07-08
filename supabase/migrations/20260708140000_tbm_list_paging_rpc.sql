-- TBM 목록: 참여자 집계 조인 + 필터 + 페이징
-- TbmListPage용 (기존 함수와 이름 충돌 방지: *_paging 접미사)

create function public.tbm_list_is_in_progress_paging(
  p_created_by uuid,
  p_participant_total bigint,
  p_participant_signed bigint,
  p_current_user_signed_at timestamptz,
  p_current_user_is_participant boolean,
  p_is_admin boolean,
  p_is_staff boolean
)
returns boolean
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if p_is_staff and not p_is_admin
     and coalesce(p_created_by, '00000000-0000-0000-0000-000000000000'::uuid) <> coalesce(v_uid, '00000000-0000-0000-0000-000000000000'::uuid)
     and not coalesce(p_current_user_is_participant, false) then
    return false;
  end if;

  if p_is_admin or p_created_by = v_uid then
    return not (
      coalesce(p_participant_total, 0) > 0
      and coalesce(p_participant_total, 0) = coalesce(p_participant_signed, 0)
    );
  end if;

  return p_current_user_signed_at is null;
end;
$$;

comment on function public.tbm_list_is_in_progress_paging(uuid, bigint, bigint, timestamptz, boolean, boolean, boolean) is
  'TBM 목록 진행중 필터 (작성자/admin: 전원 서명 전, 참여자: 본인 미서명)';

grant execute on function public.tbm_list_is_in_progress_paging(uuid, bigint, bigint, timestamptz, boolean, boolean, boolean) to authenticated;

create function public.get_tbm_list_paging(
  p_page integer default 1,
  p_page_size integer default 10,
  p_search text default null,
  p_year integer default null,
  p_month integer default null,
  p_in_progress_only boolean default false
)
returns table (
  id uuid,
  tbm_date date,
  line_name text,
  work_name text,
  location text,
  created_by uuid,
  created_by_name text,
  created_at timestamptz,
  participant_total bigint,
  participant_signed bigint,
  current_user_signed_at timestamptz,
  current_user_is_participant boolean,
  total_count bigint
)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_is_admin boolean := false;
  v_is_staff boolean := false;
  v_search text := nullif(trim(coalesce(p_search, '')), '');
  v_page integer := greatest(coalesce(p_page, 1), 1);
  v_page_size integer := greatest(coalesce(p_page_size, 10), 1);
begin
  if v_uid is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select pr.role
  into v_role
  from public.profiles pr
  where pr.id = v_uid;

  v_is_admin := coalesce(v_role, '') = 'admin';
  v_is_staff := coalesce(v_role, '') = 'staff';

  return query
  with participant_stats as (
    select
      tp.tbm_id,
      count(*)::bigint as participant_total,
      count(*) filter (where tp.signed_at is not null)::bigint as participant_signed
    from public.tbm_participants tp
    group by tp.tbm_id
  ),
  my_participation as (
    select
      tp.tbm_id,
      tp.signed_at as my_signed_at
    from public.tbm_participants tp
    where tp.user_id = v_uid
  ),
  base as (
    select
      t.id,
      t.tbm_date,
      t.line_name,
      t.work_name,
      t.location,
      t.created_by,
      t.created_by_name,
      t.created_at,
      coalesce(ps.participant_total, 0)::bigint as participant_total,
      coalesce(ps.participant_signed, 0)::bigint as participant_signed,
      mp.my_signed_at as current_user_signed_at,
      (mp.tbm_id is not null) as current_user_is_participant
    from public.tbm t
    left join participant_stats ps on ps.tbm_id = t.id
    left join my_participation mp on mp.tbm_id = t.id
    where
      (
        v_search is null
        or coalesce(t.work_name, '') ilike '%' || v_search || '%'
        or coalesce(t.created_by_name, '') ilike '%' || v_search || '%'
        or coalesce(t.location, '') ilike '%' || v_search || '%'
      )
      and (
        p_year is null
        or extract(year from t.tbm_date)::integer = p_year
      )
      and (
        p_month is null
        or extract(month from t.tbm_date)::integer = p_month
      )
      and (
        not coalesce(p_in_progress_only, false)
        or public.tbm_list_is_in_progress_paging(
          t.created_by,
          coalesce(ps.participant_total, 0)::bigint,
          coalesce(ps.participant_signed, 0)::bigint,
          mp.my_signed_at,
          (mp.tbm_id is not null),
          v_is_admin,
          v_is_staff
        )
      )
  ),
  numbered as (
    select
      b.*,
      count(*) over() as total_count
    from base b
  )
  select
    n.id,
    n.tbm_date,
    n.line_name,
    n.work_name,
    n.location,
    n.created_by,
    n.created_by_name,
    n.created_at,
    n.participant_total,
    n.participant_signed,
    n.current_user_signed_at,
    n.current_user_is_participant,
    n.total_count
  from numbered n
  order by n.created_at desc
  offset (v_page - 1) * v_page_size
  limit v_page_size;
end;
$$;

comment on function public.get_tbm_list_paging(integer, integer, text, integer, integer, boolean) is
  'TBM 목록: tbm + 참여자 집계 조인, 검색·년월·진행중 필터, 페이징';

grant execute on function public.get_tbm_list_paging(integer, integer, text, integer, integer, boolean) to authenticated;

notify pgrst, 'reload schema';
