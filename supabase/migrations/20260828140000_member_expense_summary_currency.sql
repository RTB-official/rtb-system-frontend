-- personal_expenses.currency 컬럼이 없으면 RPC가 실패하므로 선행 보장
ALTER TABLE public.personal_expenses
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT '원';

-- 반환 타입 변경은 CREATE OR REPLACE로 불가 → 기존 함수 삭제 후 재생성
DROP FUNCTION IF EXISTS public.get_member_expense_summary(integer, integer);

-- 구성원 지출 집계: 카드 지출을 화폐 단위별로 반환
create or replace function public.get_member_expense_summary(
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
  card_expenses_by_currency jsonb,
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
  expense_by_currency as (
    select
      pe.user_id,
      coalesce(nullif(trim(pe.currency), ''), '원') as currency,
      coalesce(sum(pe.amount), 0) as amount,
      count(*)::bigint as expense_count
    from public.personal_expenses pe
    where pe.expense_date >= v_start
      and pe.expense_date <= v_end
    group by pe.user_id, coalesce(nullif(trim(pe.currency), ''), '원')
  ),
  expense_agg as (
    select
      ebc.user_id,
      coalesce(
        jsonb_object_agg(ebc.currency, ebc.amount),
        '{}'::jsonb
      ) as card_expenses_by_currency,
      coalesce(sum(ebc.expense_count), 0)::bigint as expense_count
    from expense_by_currency ebc
    group by ebc.user_id
  ),
  combined as (
    select
      coalesce(m.user_id, e.user_id) as uid,
      coalesce(m.mileage, 0)::bigint as mileage,
      coalesce(m.distance, 0)::numeric as distance,
      coalesce(e.card_expenses_by_currency, '{}'::jsonb) as card_expenses_by_currency,
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
    c.card_expenses_by_currency,
    c.item_count
  from combined c
  join public.profiles p on p.id = c.uid
  order by c.mileage desc, name asc;
end;
$$;

comment on function public.get_member_expense_summary(integer, integer) is
  '구성원 지출 집계: 마일리지(원) + 카드 지출(화폐 단위별 jsonb)';

grant execute on function public.get_member_expense_summary(integer, integer) to authenticated;

notify pgrst, 'reload schema';
