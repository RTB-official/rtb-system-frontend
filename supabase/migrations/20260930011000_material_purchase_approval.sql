-- 자재 구매·가공 승인. 승인 변경은 profiles.role = admin 만 가능

ALTER TABLE public.material_purchases
    ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'pending';

ALTER TABLE public.material_purchases
    DROP CONSTRAINT IF EXISTS material_purchases_approval_status_check;

ALTER TABLE public.material_purchases
    ADD CONSTRAINT material_purchases_approval_status_check
    CHECK (approval_status IN ('pending', 'approved'));

ALTER TABLE public.material_purchases
    ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users (id);

ALTER TABLE public.material_purchases
    ADD COLUMN IF NOT EXISTS approved_at timestamptz;

COMMENT ON COLUMN public.material_purchases.approval_status IS 'pending=미승인, approved=승인';
COMMENT ON COLUMN public.material_purchases.approved_by IS '승인한 관리자';
COMMENT ON COLUMN public.material_purchases.approved_at IS '승인 시각';

DROP POLICY IF EXISTS "material_purchases_select_allowed" ON public.material_purchases;
CREATE POLICY "material_purchases_select_allowed"
ON public.material_purchases
FOR SELECT
TO authenticated
USING (
    lower(split_part(coalesce(auth.jwt() ->> 'email', ''), '@', 1)) IN ('mw.park', 'brian.ko')
    OR EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role = 'admin'
    )
);

DROP POLICY IF EXISTS "material_purchases_update_approval" ON public.material_purchases;
CREATE POLICY "material_purchases_update_approval"
ON public.material_purchases
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role = 'admin'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role = 'admin'
    )
);

DROP POLICY IF EXISTS "material_purchase_lines_select_allowed" ON public.material_purchase_lines;
CREATE POLICY "material_purchase_lines_select_allowed"
ON public.material_purchase_lines
FOR SELECT
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
);

DROP POLICY IF EXISTS "material_purchase_receipts_select_allowed" ON public.material_purchase_receipts;
CREATE POLICY "material_purchase_receipts_select_allowed"
ON public.material_purchase_receipts
FOR SELECT
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

DROP POLICY IF EXISTS "material_purchase_receipts_storage_select" ON storage.objects;
CREATE POLICY "material_purchase_receipts_storage_select"
ON storage.objects
FOR SELECT
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
