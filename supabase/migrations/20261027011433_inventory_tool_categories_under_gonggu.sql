-- 공구 대분류(수공구·동력공구 등)를 루트 '공구' 하위로 이동
DO $$
DECLARE
  v_tool uuid;
BEGIN
  SELECT id INTO v_tool
  FROM public.inventory_categories
  WHERE parent_id IS NULL AND lower(name) = lower('공구')
  LIMIT 1;

  IF v_tool IS NULL THEN
    INSERT INTO public.inventory_categories (parent_id, name, sort_order, is_active)
    VALUES (NULL, '공구', 10, true)
    RETURNING id INTO v_tool;
  ELSE
    UPDATE public.inventory_categories
    SET is_active = true, sort_order = 10, updated_at = now()
    WHERE id = v_tool;
  END IF;

  UPDATE public.inventory_categories
  SET parent_id = v_tool,
      sort_order = CASE name
        WHEN '수공구' THEN 10
        WHEN '동력공구' THEN 20
        WHEN '계측공구' THEN 30
        WHEN '용접공구' THEN 40
        WHEN '인양공구' THEN 50
        WHEN '특수공구' THEN 60
        ELSE sort_order
      END,
      is_active = true,
      updated_at = now()
  WHERE parent_id IS NULL
    AND name IN ('수공구', '동력공구', '계측공구', '용접공구', '인양공구', '특수공구');
END;
$$;
