-- admin은 모든 자재 구매·가공 건 삭제 가능 (작성자 본인 삭제는 기존 정책 유지)

DROP POLICY IF EXISTS "material_purchases_delete_admin" ON public.material_purchases;
CREATE POLICY "material_purchases_delete_admin"
ON public.material_purchases
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role = 'admin'
    )
);

DROP POLICY IF EXISTS "material_purchase_lines_delete_admin" ON public.material_purchase_lines;
CREATE POLICY "material_purchase_lines_delete_admin"
ON public.material_purchase_lines
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role = 'admin'
    )
);
