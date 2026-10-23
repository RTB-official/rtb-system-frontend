-- 자재 구매·가공 목록/상세: 로그인 사용자 전원 조회 가능
-- (등록·수정·승인 권한은 기존 정책 유지)

DROP POLICY IF EXISTS "material_purchases_select_allowed" ON public.material_purchases;
CREATE POLICY "material_purchases_select_allowed"
ON public.material_purchases
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "material_purchase_lines_select_allowed" ON public.material_purchase_lines;
CREATE POLICY "material_purchase_lines_select_allowed"
ON public.material_purchase_lines
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "material_purchase_receipts_select_allowed" ON public.material_purchase_receipts;
CREATE POLICY "material_purchase_receipts_select_allowed"
ON public.material_purchase_receipts
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "material_purchase_receipts_storage_select" ON storage.objects;
CREATE POLICY "material_purchase_receipts_storage_select"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'material-purchase-receipts');
