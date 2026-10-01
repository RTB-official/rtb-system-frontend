-- 자재 구매·가공 내용 수정. 승인·구매완료 컬럼은 관리자만 바꿀 수 있다.

CREATE OR REPLACE FUNCTION public.material_purchases_keep_admin_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role = 'admin'
    ) THEN
        RETURN NEW;
    END IF;

    NEW.user_id := OLD.user_id;
    NEW.status := OLD.status;
    NEW.approval_status := OLD.approval_status;
    NEW.approved_by := OLD.approved_by;
    NEW.approved_at := OLD.approved_at;
    NEW.purchased := OLD.purchased;
    NEW.created_at := OLD.created_at;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS material_purchases_keep_admin_columns ON public.material_purchases;
CREATE TRIGGER material_purchases_keep_admin_columns
BEFORE UPDATE ON public.material_purchases
FOR EACH ROW
EXECUTE FUNCTION public.material_purchases_keep_admin_columns();

DROP POLICY IF EXISTS "material_purchases_update_content" ON public.material_purchases;
CREATE POLICY "material_purchases_update_content"
ON public.material_purchases
FOR UPDATE
TO authenticated
USING (
    lower(split_part(coalesce(auth.jwt() ->> 'email', ''), '@', 1)) IN ('mw.park', 'brian.ko')
)
WITH CHECK (
    lower(split_part(coalesce(auth.jwt() ->> 'email', ''), '@', 1)) IN ('mw.park', 'brian.ko')
);

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
              lower(split_part(coalesce(auth.jwt() ->> 'email', ''), '@', 1)) IN ('mw.park', 'brian.ko')
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
              lower(split_part(coalesce(auth.jwt() ->> 'email', ''), '@', 1)) IN ('mw.park', 'brian.ko')
              OR EXISTS (
                  SELECT 1
                  FROM public.profiles pr
                  WHERE pr.id = auth.uid()
                    AND pr.role = 'admin'
              )
          )
    )
);

DROP POLICY IF EXISTS "material_purchase_receipts_insert_allowed" ON public.material_purchase_receipts;
CREATE POLICY "material_purchase_receipts_insert_allowed"
ON public.material_purchase_receipts
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.material_purchase_lines l
        JOIN public.material_purchases p ON p.id = l.purchase_id
        WHERE l.id = line_id
          AND (
              lower(split_part(coalesce(auth.jwt() ->> 'email', ''), '@', 1)) IN ('mw.park', 'brian.ko')
              OR EXISTS (
                  SELECT 1
                  FROM public.profiles pr
                  WHERE pr.id = auth.uid()
                    AND pr.role = 'admin'
              )
          )
    )
);

DROP POLICY IF EXISTS "material_purchase_receipts_delete_allowed" ON public.material_purchase_receipts;
CREATE POLICY "material_purchase_receipts_delete_allowed"
ON public.material_purchase_receipts
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.material_purchase_lines l
        JOIN public.material_purchases p ON p.id = l.purchase_id
        WHERE l.id = material_purchase_receipts.line_id
          AND (
              lower(split_part(coalesce(auth.jwt() ->> 'email', ''), '@', 1)) IN ('mw.park', 'brian.ko')
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
    AND (
        lower(split_part(coalesce(auth.jwt() ->> 'email', ''), '@', 1)) IN ('mw.park', 'brian.ko')
        OR EXISTS (
            SELECT 1
            FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.role = 'admin'
        )
    )
);

DROP POLICY IF EXISTS "material_purchase_receipts_storage_delete_allowed" ON storage.objects;
CREATE POLICY "material_purchase_receipts_storage_delete_allowed"
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'material-purchase-receipts'
    AND (
        lower(split_part(coalesce(auth.jwt() ->> 'email', ''), '@', 1)) IN ('mw.park', 'brian.ko')
        OR EXISTS (
            SELECT 1
            FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.role = 'admin'
        )
    )
);
