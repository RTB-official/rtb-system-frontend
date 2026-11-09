-- 재고조사 단계: 카테고리/보관 위치 추가·삭제를 로그인 사용자 전원 허용

DROP POLICY IF EXISTS "inventory_categories_write_admin" ON public.inventory_categories;
CREATE POLICY "inventory_categories_write_authenticated"
ON public.inventory_categories
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "inventory_locations_write_admin" ON public.inventory_locations;
CREATE POLICY "inventory_locations_write_authenticated"
ON public.inventory_locations
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
