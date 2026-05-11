-- invoice_drafts: API(authenticated)에서 insert/update가 거절되는 경우를 방지
grant select, insert, update, delete on table public.invoice_drafts to authenticated;
grant select, insert, update, delete on table public.invoice_drafts to service_role;
