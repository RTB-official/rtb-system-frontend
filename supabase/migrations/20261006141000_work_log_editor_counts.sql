-- 보고서 목록에서 수정 권한 인원 수를 보여 주기 위한 집계.
-- 해당 보고서를 읽을 수 있는 계정만 건수를 받는다.

create or replace function public.get_work_log_editor_counts(p_ids bigint[])
returns table (work_log_id bigint, editor_count integer)
language sql
stable
security definer
set search_path = public
as $$
  select e.work_log_id, count(*)::integer as editor_count
  from public.work_log_editors e
  where e.work_log_id = any(coalesce(p_ids, array[]::bigint[]))
    and public.user_can_read_work_log(e.work_log_id)
  group by e.work_log_id;
$$;

comment on function public.get_work_log_editor_counts(bigint[]) is
  '읽을 수 있는 보고서의 수정 권한 인원 수';

grant execute on function public.get_work_log_editor_counts(bigint[]) to authenticated;

notify pgrst, 'reload schema';
