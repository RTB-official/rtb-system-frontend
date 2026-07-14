-- get_report_list_paging: work_logs.memo / memo_updated_at / memo_read_at 반환 추가
-- RETURNS TABLE 변경이므로 drop 후 재생성

drop function if exists public.get_report_list_paging(integer, integer, text, integer, integer, text);

create function public.get_report_list_paging(
  p_page integer default 1,
  p_page_size integer default 10,
  p_search text default null,
  p_year integer default null,
  p_month integer default null,
  p_tab text default null
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
  memo text,
  memo_updated_at timestamptz,
  memo_read_at timestamptz,
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
  v_tab text := nullif(trim(coalesce(p_tab, '')), '');
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
      wl.memo,
      wl.memo_updated_at,
      wl.memo_read_at,
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
        v_tab is null
        or (
          v_tab = 'education'
          and (
            coalesce(wl.subject, '') || ' ' || coalesce(wl.vessel, '')
          ) ilike '%교육%'
        )
        or (
          v_tab = 'work'
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
    n.memo,
    n.memo_updated_at,
    n.memo_read_at,
    n.total_count
  from numbered n
  order by n.created_at desc
  offset (v_page - 1) * v_page_size
  limit v_page_size;
end;
$$;

comment on function public.get_report_list_paging(integer, integer, text, integer, integer, text) is
  '보고서 목록 조회(페이징): p_tab null=전체, work=출장, education=교육. memo/memo_updated_at/memo_read_at 포함';

grant execute on function public.get_report_list_paging(integer, integer, text, integer, integer, text) to authenticated;

notify pgrst, 'reload schema';
