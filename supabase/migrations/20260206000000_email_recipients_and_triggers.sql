-- 휴가 승인 시 이메일 알림을 위해 vacations UPDATE 트리거 추가
-- (기존 notify_email_on_insert 함수 재사용)
drop trigger if exists notify_email_vacations_update on public.vacations;
create trigger notify_email_vacations_update
after update on public.vacations
for each row execute function public.notify_email_on_insert();

-- notifications 테이블: 여권/차량 알림 삽입 시 이메일 발송 트리거
-- (passport_expiry, vehicle_inspection 메타가 있을 때만 호출)
create or replace function public.notify_email_on_notification_insert()
returns trigger
language plpgsql
security definer
as $$
declare
  response json;
  endpoint text := 'https://kojdzbhewqjxdqfplqzj.functions.supabase.co/send-notification-email';
  meta_text text;
  payload jsonb;
begin
  meta_text := coalesce(new.meta::text, '');
  if meta_text not like '%passport_expiry%' and meta_text not like '%vehicle_inspection%' then
    return new;
  end if;

  payload := jsonb_build_object(
    'table', 'notifications',
    'operation', 'INSERT',
    'record', row_to_json(new)
  );

  select net.http_post(
    url := endpoint,
    body := payload,
    headers := jsonb_build_object('Content-Type', 'application/json')
  ) into response;

  return new;
end;
$$;

drop trigger if exists notify_email_notifications on public.notifications;
create trigger notify_email_notifications
after insert on public.notifications
for each row execute function public.notify_email_on_notification_insert();
