-- 503 방지: Edge Function 요청 body 크기 축소 (record 최소 필드만 전송, changes에서 대용량 컬럼 제외)
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
  rec_minimal jsonb;
  parent_is_draft boolean;
begin
  if (tg_table_name = 'work_logs') then
    if new.is_draft = true then
      return new;
    end if;
  end if;

  if tg_table_name in ('work_log_entries', 'work_log_expenses', 'work_log_materials') then
    select w.is_draft into parent_is_draft from public.work_logs w where w.id = (new).work_log_id;
    if parent_is_draft = true then
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
      and (old_json->key) is distinct from (new_json->key)
      -- 대용량 텍스트 컬럼 제외하여 payload 크기 제한 (503 방지)
      and (tg_table_name <> 'work_log_entries' or key not in ('details', 'note'))
      and (tg_table_name <> 'work_log_expenses' or key <> 'detail');
    if tg_table_name = 'work_logs' and (old).is_draft = true and (new).is_draft = false then
      changes := coalesce(changes, '{}'::jsonb) || '{"is_draft":{"before":true,"after":false}}'::jsonb;
    end if;
  end if;

  if (tg_op = 'UPDATE' and changes = '{}'::jsonb) then
    return new;
  end if;

  -- record: 이메일 로직에 필요한 최소 필드만 전송 (153KB+ body로 인한 503 방지)
  case tg_table_name
    when 'work_logs' then
      rec_minimal := jsonb_build_object(
        'id', new.id,
        'is_draft', new.is_draft,
        'subject', new.subject,
        'author', new.author,
        'vessel', new.vessel,
        'location', new.location,
        'created_by', new.created_by
      );
    when 'work_log_entries' then
      rec_minimal := jsonb_build_object('id', new.id, 'work_log_id', new.work_log_id);
    when 'work_log_expenses' then
      rec_minimal := jsonb_build_object('id', new.id, 'work_log_id', new.work_log_id);
    when 'work_log_materials' then
      rec_minimal := jsonb_build_object('id', new.id, 'work_log_id', new.work_log_id);
    else
      rec_minimal := to_jsonb(new);
  end case;

  payload := jsonb_build_object(
    'table', tg_table_name,
    'operation', tg_op,
    'record', rec_minimal
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
