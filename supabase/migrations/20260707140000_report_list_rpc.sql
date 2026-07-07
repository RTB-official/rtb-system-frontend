-- 보고서 목록: 조인·필터·페이징을 DB에서 한 번에 처리
-- ReportListPage 서버 사이드 페이징용 (기존 함수와 이름 충돌 방지: *_paging 접미사)

create function public.staff_can_read_work_log_list_item_paging(
  p_work_log_id bigint,
  p_user_id uuid,
  p_profile_name text,
  p_created_by uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_created_by = p_user_id
    or (
      coalesce(trim(p_profile_name), '') <> ''
      and (
        exists (
          select 1
          from public.work_log_persons wlp
          where wlp.work_log_id = p_work_log_id
            and wlp.person_name = trim(p_profile_name)
        )
        or exists (
          select 1
          from public.work_log_entry_persons wlep
          join public.work_log_entries e on e.id = wlep.entry_id
          where e.work_log_id = p_work_log_id
            and wlep.person_name = trim(p_profile_name)
        )
      )
    );
$$;

comment on function public.staff_can_read_work_log_list_item_paging(bigint, uuid, text, uuid) is
  'staff 목록(페이징): 본인 작성 또는 person_name 기준 참여 보고서';

grant execute on function public.staff_can_read_work_log_list_item_paging(bigint, uuid, text, uuid) to authenticated;

create function public.report_list_effective_range_paging(
  p_period_start date,
  p_period_end date,
  p_created_at timestamptz
)
returns table (range_start date, range_end date)
language sql
immutable
as $$
  select
    coalesce(
      p_period_start,
      p_period_end,
      (p_created_at at time zone 'Asia/Seoul')::date
    ) as range_start,
    coalesce(
      p_period_end,
      p_period_start,
      (p_created_at at time zone 'Asia/Seoul')::date
    ) as range_end;
$$;

create function public.report_list_overlaps_month_paging(
  p_range_start date,
  p_range_end date,
  p_month integer,
  p_year integer
)
returns boolean
language plpgsql
immutable
as $$
declare
  v_start date;
  v_end date;
  v_cursor date;
  v_guard integer := 0;
  v_month_start date;
  v_month_end date;
begin
  if p_month is null then
    return true;
  end if;

  v_start := least(p_range_start, p_range_end);
  v_end := greatest(p_range_start, p_range_end);

  if p_year is not null then
    v_month_start := make_date(p_year, p_month, 1);
    v_month_end := (v_month_start + interval '1 month' - interval '1 day')::date;
    return v_start <= v_month_end and v_end >= v_month_start;
  end if;

  v_cursor := date_trunc('month', v_start)::date;
  while v_cursor <= date_trunc('month', v_end)::date and v_guard < 120 loop
    if extract(month from v_cursor)::integer = p_month then
      return true;
    end if;
    v_cursor := (v_cursor + interval '1 month')::date;
    v_guard := v_guard + 1;
  end loop;

  return false;
end;
$$;

create function public.get_report_list_paging(
  p_page integer default 1,
  p_page_size integer default 10,
  p_search text default null,
  p_year integer default null,
  p_month integer default null,
  p_tab text default 'work'
)
returns table (
  id bigint,
  author text,
  vessel text,
  subject text,
  location text,
  order_person text,
  is_draft boolean,
  created_by uuid,
  created_at timestamptz,
  owner_email text,
  owner_position text,
  period_start date,
  period_end date,
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
  v_name text;
  v_search text := nullif(trim(coalesce(p_search, '')), '');
  v_page integer := greatest(coalesce(p_page, 1), 1);
  v_page_size integer := greatest(coalesce(p_page_size, 10), 1);
  v_tab text := coalesce(nullif(trim(p_tab), ''), 'work');
begin
  if v_uid is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select pr.role, pr.name
  into v_role, v_name
  from public.profiles pr
  where pr.id = v_uid;

  return query
  with entry_periods as (
    select
      d.work_log_id,
      min(d.day_d)::date as period_start,
      max(d.day_d)::date as period_end
    from (
      select e.work_log_id, e.date_from::date as day_d
      from public.work_log_entries e
      where e.date_from is not null
      union all
      select e.work_log_id, e.date_to::date as day_d
      from public.work_log_entries e
      where e.date_to is not null
    ) d
    group by d.work_log_id
  ),
  base as (
    select
      wl.id,
      wl.author,
      wl.vessel,
      wl.subject,
      wl.location,
      wl.order_person,
      wl.is_draft,
      wl.created_by,
      wl.created_at,
      p.email as owner_email,
      p.position as owner_position,
      ep.period_start,
      ep.period_end,
      rng.range_start as effective_start,
      rng.range_end as effective_end
    from public.work_logs wl
    left join entry_periods ep on ep.work_log_id = wl.id
    left join public.profiles p on p.name = wl.author
    cross join lateral public.report_list_effective_range_paging(
      ep.period_start,
      ep.period_end,
      wl.created_at
    ) rng
    where
      (
        coalesce(v_role, '') <> 'staff'
        or public.staff_can_read_work_log_list_item_paging(
          wl.id,
          v_uid,
          v_name,
          wl.created_by
        )
      )
      and (
        v_search is null
        or lower(
          coalesce(wl.subject, '') || ' ' ||
          coalesce(wl.vessel, '') || ' ' ||
          coalesce(wl.author, '') || ' ' ||
          coalesce(wl.location, '')
        ) like '%' || lower(v_search) || '%'
      )
      and (
        p_year is null
        or (
          extract(year from rng.range_start)::integer <= p_year
          and extract(year from rng.range_end)::integer >= p_year
        )
      )
      and public.report_list_overlaps_month_paging(
        rng.range_start,
        rng.range_end,
        p_month,
        p_year
      )
      and (
        (v_tab = 'education' and (
          coalesce(wl.subject, '') || ' ' || coalesce(wl.vessel, '')
        ) ilike '%교육%')
        or (
          v_tab <> 'education'
          and (
            coalesce(wl.subject, '') || ' ' || coalesce(wl.vessel, '')
          ) not ilike '%교육%'
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
    n.author,
    n.vessel,
    n.subject,
    n.location,
    n.order_person,
    n.is_draft,
    n.created_by,
    n.created_at,
    n.owner_email,
    n.owner_position,
    n.period_start,
    n.period_end,
    n.total_count
  from numbered n
  order by n.created_at desc
  offset (v_page - 1) * v_page_size
  limit v_page_size;
end;
$$;

comment on function public.get_report_list_paging(integer, integer, text, integer, integer, text) is
  '보고서 목록 조회(페이징): work_logs + 기간 + profiles 조인, staff/검색/년월/탭 필터';

grant execute on function public.get_report_list_paging(integer, integer, text, integer, integer, text) to authenticated;

notify pgrst, 'reload schema';
