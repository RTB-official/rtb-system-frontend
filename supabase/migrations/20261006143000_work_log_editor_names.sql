-- 보고서 보기에서 작성자 옆에 수정 권한 받은 사람 이름을 보여 주기 위한 조회.
-- 해당 보고서를 읽을 수 있는 계정만 이름을 받는다.

create or replace function public.get_work_log_editor_names(p_work_log_id bigint)
returns table (
  user_id uuid,
  editor_name text,
  job_position text,
  department text
)
language sql
stable
security definer
set search_path = public
as $$
  select e.user_id, p.name, p.position, p.department
  from public.work_log_editors e
  join public.profiles p on p.id = e.user_id
  where e.work_log_id = p_work_log_id
    and public.user_can_read_work_log(p_work_log_id)
    and coalesce(trim(p.name), '') <> '';
$$;

comment on function public.get_work_log_editor_names(bigint) is
  '읽을 수 있는 보고서의 수정 권한 받은 사람 이름';

grant execute on function public.get_work_log_editor_names(bigint) to authenticated;

notify pgrst, 'reload schema';
