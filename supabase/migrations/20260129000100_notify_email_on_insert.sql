-- Sends notification emails via Supabase Edge Function when new records are inserted.
-- TODO: Replace YOUR_PROJECT_REF with the actual project ref.

create extension if not exists pg_net;

create or replace function public.notify_email_on_insert()
returns trigger
language plpgsql
security definer
as $$
declare
  response json;
  endpoint text := 'https://kojdzbhewqjxdqfplqzj.functions.supabase.co/send-notification-email';
  changes jsonb := '{}'::jsonb;
  new_json jsonb;
  old_json jsonb;
  payload jsonb;
begin
  -- Skip drafts for work_logs
  if (tg_table_name = 'work_logs') then
    if new.is_draft = true then
      return new;
    end if;
  end if;

  if (tg_op = 'UPDATE') then
    new_json := to_jsonb(new);
    old_json := to_jsonb(old);
    select coalesce(
      jsonb_object_agg(
        key,
        jsonb_build_object('before', old_json->key, 'after', new_json->key)
      ),
      '{}'::jsonb
    )
    into changes
    from jsonb_each(new_json)
    where key not in ('updated_at', 'created_at')
      and (old_json->key) is distinct from (new_json->key);
  end if;

  if (tg_op = 'UPDATE' and changes = '{}'::jsonb) then
    return new;
  end if;

  payload := jsonb_build_object(
    'table', tg_table_name,
    'operation', tg_op,
    'record', row_to_json(new)
  );
  if changes <> '{}'::jsonb then
    payload := payload || jsonb_build_object('changes', changes);
  end if;

  select
    net.http_post(
      url := endpoint,
      body := payload,
      headers := jsonb_build_object('Content-Type', 'application/json')
    )
  into response;

  return new;
end;
$$;

-- work_logs

drop trigger if exists notify_email_work_logs on public.work_logs;
create trigger notify_email_work_logs
after insert on public.work_logs
for each row execute function public.notify_email_on_insert();

drop trigger if exists notify_email_work_logs_update on public.work_logs;
create trigger notify_email_work_logs_update
after update on public.work_logs
for each row execute function public.notify_email_on_insert();

drop trigger if exists notify_email_work_log_entries_update on public.work_log_entries;
create trigger notify_email_work_log_entries_update
after update on public.work_log_entries
for each row execute function public.notify_email_on_insert();

drop trigger if exists notify_email_work_log_entries_insert on public.work_log_entries;
create trigger notify_email_work_log_entries_insert
after insert on public.work_log_entries
for each row execute function public.notify_email_on_insert();

-- calendar_events

drop trigger if exists notify_email_calendar_events on public.calendar_events;
create trigger notify_email_calendar_events
after insert on public.calendar_events
for each row execute function public.notify_email_on_insert();

-- vacations

drop trigger if exists notify_email_vacations on public.vacations;
create trigger notify_email_vacations
after insert on public.vacations
for each row execute function public.notify_email_on_insert();
