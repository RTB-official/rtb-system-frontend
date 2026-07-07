-- work_log_receipt INSERT RLS: 수정 화면에서 영수증 추가 시 created_by 정책 완화
-- 기존: created_by = auth.uid() 만 허용 → admin이 타인 보고서 수정 시 실패
-- 변경: auth.uid() 또는 해당 work_log 작성자(created_by) 허용

drop policy if exists "work_log_receipt_insert" on public.work_log_receipt;

create policy "work_log_receipt_insert"
  on public.work_log_receipt
  for insert
  to authenticated
  with check (
    public.user_can_modify_work_log(work_log_id)
    and (
      created_by is null
      or created_by = auth.uid()
      or exists (
        select 1
        from public.work_logs wl
        where wl.id = work_log_id
          and wl.created_by = created_by
      )
    )
  );
