-- 자재 등록 시 카테고리별 입력란·버튼 값 저장
ALTER TABLE public.inventory_items
    ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.inventory_items.metadata IS
    '확장 메타. fieldValues: { [fieldId]: string }, activeButtonIds: string[] — 카테고리 formFields/formButtons 입력값';
