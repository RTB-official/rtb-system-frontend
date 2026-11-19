-- 공무팀 서포트 보고서: work_logs.report_type 추가 + 보고서 목록 'support' 탭
--
-- report_type
--   null      = 기존 방식(제목으로 출장/교육 구분). 기존 행은 전부 null 로 남는다.
--   'support' = 공무팀 서포트 보고서. 화면은 출장 보고서와 같고, 워크로드 집계·알림에서 빠진다.
--
-- 적용 순서: 이 마이그레이션을 먼저 적용한 뒤 프론트를 배포한다.
--   (프론트가 먼저 나가면 서포트 보고서 저장만 실패하고 출장·교육은 그대로 동작한다)
-- 되돌릴 때: 컬럼을 지우지 않는다. 지우면 서포트 보고서가 출장 보고서로 바뀌어 워크로드에 다시 잡힌다.

alter table public.work_logs
  add column if not exists report_type text;

alter table public.work_logs
  drop constraint if exists work_logs_report_type_check;

alter table public.work_logs
  add constraint work_logs_report_type_check
  check (report_type is null or report_type in ('support'));

comment on column public.work_logs.report_type is
  '보고서 종류: null=기존(제목으로 출장/교육 구분), support=공무팀 서포트(워크로드·알림 제외)';

-- get_report_list_paging: 운영 DB의 현재 정의에 탭 조건만 바꾼다.
--   운영 정의 = 2026-07-14-report-add-memo 브랜치의 20260714150000_report_list_paging_memo_columns.sql
--   (memo / memo_updated_at / memo_read_at 반환. main 에는 아직 없지만 운영 DB에는 적용돼 있음 — 2026-11-19 지문 비교로 확인)
--   반환 칸이 같으므로 create or replace 로 바꾼다.
--   support   = report_type 'support'
--   education = 서포트가 아니고 제목·호선에 '교육'
--   work      = 서포트가 아니고 제목·호선에 '교육' 없음
create or replace function public.get_report_list_paging(
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
          v_tab = 'support'
          and wl.report_type = 'support'
        )
        or (
          v_tab = 'education'
          and wl.report_type is distinct from 'support'
          and (
            coalesce(wl.subject, '') || ' ' || coalesce(wl.vessel, '')
          ) ilike '%교육%'
        )
        or (
          v_tab = 'work'
          and wl.report_type is distinct from 'support'
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
  '보고서 목록 조회(페이징): p_tab null=전체, work=출장, education=교육, support=공무팀 서포트. memo/memo_updated_at/memo_read_at 포함';

grant execute on function public.get_report_list_paging(integer, integer, text, integer, integer, text) to authenticated;

notify pgrst, 'reload schema';
