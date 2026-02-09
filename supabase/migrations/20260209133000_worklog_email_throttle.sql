-- Throttle work log related emails to avoid duplicate notifications.
create table if not exists public.work_log_email_throttle (
  work_log_id bigint primary key,
  last_sent_at timestamptz not null default now()
);

create or replace function public.throttle_work_log_email(p_work_log_id bigint, p_window_seconds int)
returns boolean
language plpgsql
security definer
as $$
declare
  allowed boolean;
begin
  if p_work_log_id is null then
    return true;
  end if;

  with upsert as (
    insert into public.work_log_email_throttle (work_log_id, last_sent_at)
    values (p_work_log_id, now())
    on conflict (work_log_id) do update
      set last_sent_at = excluded.last_sent_at
      where public.work_log_email_throttle.last_sent_at < now() - make_interval(secs => p_window_seconds)
    returning 1
  )
  select exists(select 1 from upsert) into allowed;

  return allowed;
end;
$$;
