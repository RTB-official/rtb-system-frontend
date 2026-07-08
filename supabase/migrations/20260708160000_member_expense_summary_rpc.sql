-- 구성원 지출 관리: 직원별 집계 + profiles 조인 (페이징 없음)
-- MemberExpensePage용

create function public.get_member_expense_summary(
  p_year integer,
  p_month integer
)
returns table (
  user_id uuid,
  name text,
  email text,
  user_position text,
  mileage bigint,
  distance numeric,
  card_expense bigint,
  total bigint,
  item_count bigint
)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_start date;
  v_end date;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  if not public.can_view_all_personal_expenses() then
    raise exception '권한이 없습니다.';
  end if;

  if p_year is null or p_month is null or p_month < 1 or p_month > 12 then
    raise exception '유효한 년·월이 필요합니다.';
  end if;

  v_start := make_date(p_year, p_month, 1);
  v_end := (date_trunc('month', v_start::timestamp) + interval '1 month' - interval '1 day')::date;

  return query
  with mileage_agg as (
    select
      pm.user_id,
      coalesce(sum(pm.amount_won), 0)::bigint as mileage,
      coalesce(sum(pm.distance_km), 0)::numeric as distance,
      count(*)::bigint as mileage_count
    from public.personal_mileage pm
    where pm.m_date >= v_start
      and pm.m_date <= v_end
    group by pm.user_id
  ),
  expense_agg as (
    select
      pe.user_id,
      coalesce(sum(pe.amount), 0)::bigint as card_expense,
      count(*)::bigint as expense_count
    from public.personal_expenses pe
    where pe.expense_date >= v_start
      and pe.expense_date <= v_end
    group by pe.user_id
  ),
  combined as (
    select
      coalesce(m.user_id, e.user_id) as uid,
      coalesce(m.mileage, 0)::bigint as mileage,
      coalesce(m.distance, 0)::numeric as distance,
      coalesce(e.card_expense, 0)::bigint as card_expense,
      (coalesce(m.mileage_count, 0) + coalesce(e.expense_count, 0))::bigint as item_count
    from mileage_agg m
    full outer join expense_agg e on e.user_id = m.user_id
    where (coalesce(m.mileage_count, 0) + coalesce(e.expense_count, 0)) > 0
  )
  select
    p.id as user_id,
    coalesce(nullif(trim(p.name), ''), nullif(trim(p.username), ''), 'User ' || left(p.id::text, 8)) as name,
    p.email,
    p.position as user_position,
    c.mileage,
    round(c.distance, 1) as distance,
    c.card_expense,
    (c.mileage + c.card_expense)::bigint as total,
    c.item_count
  from combined c
  join public.profiles p on p.id = c.uid
  order by (c.mileage + c.card_expense) desc, name asc;
end;
$$;

comment on function public.get_member_expense_summary(integer, integer) is
  '구성원 지출 집계: personal_mileage + personal_expenses 기간 합산, profiles 조인';

grant execute on function public.get_member_expense_summary(integer, integer) to authenticated;

notify pgrst, 'reload schema';
