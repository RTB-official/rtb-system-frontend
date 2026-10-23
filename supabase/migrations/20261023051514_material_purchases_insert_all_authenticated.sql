-- 로그인 사용자 누구나 본인 자재 구매·가공 등록 가능
-- (영수증 스토리지 업로드도 본인 폴더에 한해 허용)

DROP POLICY IF EXISTS "material_purchases_insert_own" ON public.material_purchases;
CREATE POLICY "material_purchases_insert_own"
ON public.material_purchases
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "material_purchases_update_content" ON public.material_purchases;
CREATE POLICY "material_purchases_update_content"
ON public.material_purchases
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "material_purchase_lines_update_allowed" ON public.material_purchase_lines;
CREATE POLICY "material_purchase_lines_update_allowed"
ON public.material_purchase_lines
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.material_purchases p
        WHERE p.id = material_purchase_lines.purchase_id
          AND (
              p.user_id = auth.uid()
              OR EXISTS (
                  SELECT 1
                  FROM public.profiles pr
                  WHERE pr.id = auth.uid()
                    AND pr.role = 'admin'
              )
          )
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.material_purchases p
        WHERE p.id = purchase_id
          AND (
              p.user_id = auth.uid()
              OR EXISTS (
                  SELECT 1
                  FROM public.profiles pr
                  WHERE pr.id = auth.uid()
                    AND pr.role = 'admin'
              )
          )
    )
);

DROP POLICY IF EXISTS "material_purchase_receipts_storage_insert" ON storage.objects;
CREATE POLICY "material_purchase_receipts_storage_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'material-purchase-receipts'
    AND (storage.foldername(name))[1] = auth.uid()::text
);
