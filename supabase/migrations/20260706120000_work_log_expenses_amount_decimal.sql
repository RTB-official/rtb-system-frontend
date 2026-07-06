-- work_log_expenses.amount: integer → numeric (소수점 금액 지원)
ALTER TABLE public.work_log_expenses
  ALTER COLUMN amount TYPE numeric(12, 2)
  USING amount::numeric(12, 2);

COMMENT ON COLUMN public.work_log_expenses.amount IS
  'Expense amount; supports up to 2 decimal places (e.g. foreign currency).';
