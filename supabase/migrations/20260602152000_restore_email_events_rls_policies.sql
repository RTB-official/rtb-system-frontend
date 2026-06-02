-- email_events RLS 복구
-- 증상: work_log 저장/제출 중
--   new row violates row-level security policy for table "email_events"
-- email_events는 메일 발송 큐(이벤트 큐)이므로 인증 사용자의 INSERT가 필요합니다.

alter table public.email_events enable row level security;

drop policy if exists "email_events_insert_authenticated" on public.email_events;

create policy "email_events_insert_authenticated"
  on public.email_events
  for insert
  to authenticated
  with check (true);

