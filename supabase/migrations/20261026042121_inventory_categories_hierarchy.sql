-- 카테고리 최대 3단계 계층 (예: 공구 > 수공구 > 스패너)

ALTER TABLE public.inventory_categories
    ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.inventory_categories (id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS inventory_categories_parent_id_idx
    ON public.inventory_categories (parent_id);

DROP INDEX IF EXISTS inventory_categories_name_unique;

-- 같은 부모 아래에서만 이름 유일 (루트는 parent_id IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS inventory_categories_parent_name_unique
    ON public.inventory_categories (COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));

COMMENT ON COLUMN public.inventory_categories.parent_id IS '상위 카테고리. NULL이면 1단계. 최대 3단계까지 허용(앱에서 검증).';
