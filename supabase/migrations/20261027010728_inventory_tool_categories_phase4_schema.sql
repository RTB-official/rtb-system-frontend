-- 공구 카테고리 4단계 지원: metadata 확장 컬럼 + idempotent ensure 헬퍼
ALTER TABLE public.inventory_categories
    ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.inventory_categories.parent_id IS
    '상위 카테고리. NULL이면 1단계. 최대 4단계까지 허용(앱에서 검증).';
COMMENT ON COLUMN public.inventory_categories.metadata IS
    '확장 메타(교정·점검·엔진적용 등). 현재는 비어 있음.';

CREATE OR REPLACE FUNCTION public.inventory_ensure_category(
    p_parent_id uuid,
    p_name text,
    p_sort_order int DEFAULT 0
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
    v_id uuid;
    v_parent_key uuid := COALESCE(p_parent_id, '00000000-0000-0000-0000-000000000000'::uuid);
BEGIN
    SELECT c.id INTO v_id
    FROM public.inventory_categories c
    WHERE lower(c.name) = lower(p_name)
      AND COALESCE(c.parent_id, '00000000-0000-0000-0000-000000000000'::uuid) = v_parent_key
    LIMIT 1;

    IF v_id IS NULL THEN
        INSERT INTO public.inventory_categories (parent_id, name, sort_order, is_active)
        VALUES (p_parent_id, p_name, p_sort_order, true)
        RETURNING id INTO v_id;
    ELSE
        UPDATE public.inventory_categories
        SET sort_order = p_sort_order,
            is_active = true,
            updated_at = now()
        WHERE id = v_id;
    END IF;

    RETURN v_id;
END;
$$;
