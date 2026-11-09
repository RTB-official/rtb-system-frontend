-- 카테고리별 자재 입력란 정의는 inventory_categories.metadata.formFields 에 저장
-- 예: { "formFields": [{ "id": "...", "label": "길이", "unit": "mm" }] }
ALTER TABLE public.inventory_categories
    ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.inventory_categories.metadata IS
    '확장 메타. formFields: [{id,label,unit}], formButtonGroups: [{id,name,selection:single|multiple,buttons:[{id,label}]}], formHashtags: [{id,label}] — 말단 카테고리 입력란·버튼그룹·해시태그 정의';
