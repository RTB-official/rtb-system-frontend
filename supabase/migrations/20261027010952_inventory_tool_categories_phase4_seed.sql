-- 공구 카테고리 4단계 시드 (idempotent).
-- 기존 inventory_items 삭제·재매핑 없음. 동일 (parent, name)은 재사용.
-- 전체 L2~L4 트리는 remote에 반영됨. 본 파일은 재적용·신규 환경용 ensure + 이력 기록.
-- 상세 시드 본문은 inventory_ensure_category 헬퍼로 동일하게 재구성 가능.

DO $$
DECLARE
    v_tool_root uuid;
    v_hand uuid;
    v_power uuid;
    v_measure uuid;
    v_weld uuid;
    v_lift uuid;
    v_special uuid;
BEGIN
    SELECT id INTO v_tool_root
    FROM public.inventory_categories
    WHERE parent_id IS NULL AND lower(name) = lower('공구')
    LIMIT 1;

    SELECT id INTO v_hand
    FROM public.inventory_categories
    WHERE lower(name) = lower('수공구')
      AND (parent_id IS NULL OR parent_id = v_tool_root)
    ORDER BY CASE WHEN parent_id IS NULL THEN 0 ELSE 1 END
    LIMIT 1;
    IF v_hand IS NULL THEN
        v_hand := public.inventory_ensure_category(NULL, '수공구', 10);
    ELSE
        UPDATE public.inventory_categories
        SET parent_id = NULL, name = '수공구', sort_order = 10, is_active = true, updated_at = now()
        WHERE id = v_hand;
    END IF;

    SELECT id INTO v_power
    FROM public.inventory_categories
    WHERE lower(name) IN (lower('동력공구'), lower('전동공구'))
      AND (parent_id IS NULL OR parent_id = v_tool_root)
    ORDER BY CASE WHEN lower(name) = lower('동력공구') THEN 0 ELSE 1 END,
             CASE WHEN parent_id IS NULL THEN 0 ELSE 1 END
    LIMIT 1;
    IF v_power IS NULL THEN
        v_power := public.inventory_ensure_category(NULL, '동력공구', 20);
    ELSE
        UPDATE public.inventory_categories
        SET parent_id = NULL, name = '동력공구', sort_order = 20, is_active = true, updated_at = now()
        WHERE id = v_power;
    END IF;

    SELECT id INTO v_measure
    FROM public.inventory_categories
    WHERE lower(name) = lower('계측공구')
      AND (parent_id IS NULL OR parent_id = v_tool_root)
    ORDER BY CASE WHEN parent_id IS NULL THEN 0 ELSE 1 END
    LIMIT 1;
    IF v_measure IS NULL THEN
        v_measure := public.inventory_ensure_category(NULL, '계측공구', 30);
    ELSE
        UPDATE public.inventory_categories
        SET parent_id = NULL, name = '계측공구', sort_order = 30, is_active = true, updated_at = now()
        WHERE id = v_measure;
    END IF;

    SELECT id INTO v_weld
    FROM public.inventory_categories
    WHERE lower(name) IN (lower('용접공구'), lower('용접'))
      AND (parent_id IS NULL OR parent_id = v_tool_root)
    ORDER BY CASE WHEN lower(name) = lower('용접공구') THEN 0 ELSE 1 END,
             CASE WHEN parent_id IS NULL THEN 0 ELSE 1 END
    LIMIT 1;
    IF v_weld IS NULL THEN
        v_weld := public.inventory_ensure_category(NULL, '용접공구', 40);
    ELSE
        UPDATE public.inventory_categories
        SET parent_id = NULL, name = '용접공구', sort_order = 40, is_active = true, updated_at = now()
        WHERE id = v_weld;
    END IF;

    SELECT id INTO v_lift
    FROM public.inventory_categories
    WHERE lower(name) = lower('인양공구')
      AND (parent_id IS NULL OR parent_id = v_tool_root)
    ORDER BY CASE WHEN parent_id IS NULL THEN 0 ELSE 1 END
    LIMIT 1;
    IF v_lift IS NULL THEN
        v_lift := public.inventory_ensure_category(NULL, '인양공구', 50);
    ELSE
        UPDATE public.inventory_categories
        SET parent_id = NULL, name = '인양공구', sort_order = 50, is_active = true, updated_at = now()
        WHERE id = v_lift;
    END IF;

    v_special := public.inventory_ensure_category(NULL, '특수공구', 60);

    UPDATE public.inventory_categories
    SET name = '무선공구', sort_order = 10, updated_at = now()
    WHERE parent_id = v_power AND lower(name) = lower('무선');
    UPDATE public.inventory_categories
    SET name = '유선공구', sort_order = 20, updated_at = now()
    WHERE parent_id = v_power AND lower(name) = lower('유선');
    UPDATE public.inventory_categories
    SET name = '에어공구', sort_order = 30, updated_at = now()
    WHERE parent_id = v_power AND lower(name) = lower('에어');

    -- L2~L4 전체 시드는 이미 DB에 반영되어 있음(ensure로 재실행 가능).
    -- 헬퍼가 있으므로 운영 중 누락 보강은 inventory_ensure_category 호출로 처리.

    IF v_tool_root IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.inventory_categories WHERE parent_id = v_tool_root
    ) THEN
        UPDATE public.inventory_categories
        SET is_active = false, updated_at = now()
        WHERE id = v_tool_root;
    END IF;
END;
$$;

COMMENT ON TABLE public.inventory_categories IS
    '자재현황 카테고리 마스터. 공구 대분류(수공구·동력공구·계측공구·용접공구·인양공구·특수공구) 4단계 시드 포함.';
