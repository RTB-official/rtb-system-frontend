-- 인보이스 드래프트 저장 목록: 호선 그룹화 조회
-- InvoiceDraftListPage용


create function public.invoice_draft_group_vessel(
  p_work_log_ids bigint[],
  p_title text
)
returns text
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_vessel text;
  v_trimmed text;
  v_without_period text;
  v_match text[];
begin
  if p_work_log_ids is not null and coalesce(array_length(p_work_log_ids, 1), 0) > 0 then
    select nullif(trim(wl.vessel), '')
    into v_vessel
    from unnest(p_work_log_ids) as wl_id
    join public.work_logs wl on wl.id = wl_id
    where nullif(trim(coalesce(wl.vessel, '')), '') is not null
    order by wl_id
    limit 1;

    if v_vessel is not null then
      return v_vessel;
    end if;
  end if;

  v_trimmed := trim(coalesce(p_title, ''));
  if v_trimmed = '' then
    return '기타';
  end if;

  v_without_period := regexp_replace(v_trimmed, '^\d+월\d+일(?:~\d+일)?\s*', '');
  v_trimmed := trim(v_without_period);
  if v_trimmed = '' then
    return '기타';
  end if;

  v_match := regexp_match(v_trimmed, '^(H\d+|OC[\w-]+)', 'i');
  if v_match is not null and v_match[1] is not null then
    return v_match[1];
  end if;

  return split_part(v_trimmed, ' ', 1);
end;
$$;

comment on function public.invoice_draft_group_vessel(bigint[], text) is
  '드래프트 그룹 키(호선): work_logs.vessel 우선, 없으면 title 파싱, fallback 기타';

grant execute on function public.invoice_draft_group_vessel(bigint[], text) to authenticated;

create function public.get_invoice_draft_vessel_groups()
returns table (
  vessel text,
  draft_count bigint,
  latest_updated_at timestamptz
)
language plpgsql
stable
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  return query
  with enriched as (
    select
      public.invoice_draft_group_vessel(d.work_log_ids, d.title) as group_vessel,
      d.updated_at
    from public.invoice_drafts d
  )
  select
    e.group_vessel as vessel,
    count(*)::bigint as draft_count,
    max(e.updated_at) as latest_updated_at
  from enriched e
  group by e.group_vessel
  order by max(e.updated_at) desc;
end;
$$;

comment on function public.get_invoice_draft_vessel_groups() is
  '인보이스 드래프트 호선별 그룹 목록';

grant execute on function public.get_invoice_draft_vessel_groups() to authenticated;

create function public.get_invoice_drafts_by_vessel_group(p_vessel text)
returns table (
  id uuid,
  created_by uuid,
  title text,
  work_log_ids bigint[],
  status text,
  created_at timestamptz,
  updated_at timestamptz,
  creator_name text
)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_vessel text := trim(coalesce(p_vessel, ''));
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  if v_vessel = '' then
    raise exception '호선을 지정해 주세요.';
  end if;

  return query
  select
    d.id,
    d.created_by,
    d.title,
    d.work_log_ids,
    d.status,
    d.created_at,
    d.updated_at,
    coalesce(nullif(trim(p.name), ''), nullif(trim(p.username), '')) as creator_name
  from public.invoice_drafts d
  left join public.profiles p on p.id = d.created_by
  where public.invoice_draft_group_vessel(d.work_log_ids, d.title) = v_vessel
  order by d.updated_at desc;
end;
$$;

comment on function public.get_invoice_drafts_by_vessel_group(text) is
  '호선 그룹별 인보이스 드래프트 목록 (모달)';

grant execute on function public.get_invoice_drafts_by_vessel_group(text) to authenticated;

notify pgrst, 'reload schema';
