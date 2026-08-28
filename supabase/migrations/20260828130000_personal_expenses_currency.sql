-- personal_expenses: 외화 단위 및 소수점 금액 지원 (work_log_expenses와 동일)
ALTER TABLE public.personal_expenses
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT '원';

COMMENT ON COLUMN public.personal_expenses.currency IS
  '화폐 단위 (원, 엔, 달러, 유로, 위안)';

ALTER TABLE public.personal_expenses
  ALTER COLUMN amount TYPE numeric(12, 2)
  USING amount::numeric(12, 2);

COMMENT ON COLUMN public.personal_expenses.amount IS
  'Expense amount; supports up to 2 decimal places (e.g. foreign currency).';
