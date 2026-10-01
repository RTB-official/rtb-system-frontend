-- 자재 구매·가공 등록 (예정/완료, 작업/개인, 품목, 영수증)

CREATE TABLE IF NOT EXISTS public.material_purchases (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users (id),
    status text NOT NULL CHECK (status IN ('planned', 'confirmed')),
    kind text NOT NULL CHECK (kind IN ('work', 'personal')),
    vessel_name text,
    order_group text,
    order_persons text[] NOT NULL DEFAULT '{}',
    trip_purpose text,
    created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.material_purchases IS '자재 구매·가공 등록';
COMMENT ON COLUMN public.material_purchases.status IS 'planned=예정, confirmed=완료. 예정이면 품목 금액은 예상 비용, 완료이면 비용';
COMMENT ON COLUMN public.material_purchases.kind IS 'work=작업, personal=개인';
COMMENT ON COLUMN public.material_purchases.vessel_name IS '호선명. 개인이면 비움';
COMMENT ON COLUMN public.material_purchases.order_group IS '참관감독 그룹 (ELU, PRIME, MITSUI, OTHER)';
COMMENT ON COLUMN public.material_purchases.order_persons IS '참관감독 이름';
COMMENT ON COLUMN public.material_purchases.trip_purpose IS '출장 목적';

CREATE TABLE IF NOT EXISTS public.material_purchase_lines (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_id uuid NOT NULL REFERENCES public.material_purchases (id) ON DELETE CASCADE,
    sort_order integer NOT NULL,
    material_name text NOT NULL,
    vendor text,
    amount numeric(12, 2),
    currency text NOT NULL DEFAULT '원',
    note text
);

COMMENT ON TABLE public.material_purchase_lines IS '자재 구매·가공 품목';
COMMENT ON COLUMN public.material_purchase_lines.material_name IS '자재명';
COMMENT ON COLUMN public.material_purchase_lines.vendor IS '구매처';
COMMENT ON COLUMN public.material_purchase_lines.amount IS '금액. 부모 status가 planned면 예상 비용, confirmed면 비용';
COMMENT ON COLUMN public.material_purchase_lines.currency IS '화폐 단위 (원, 엔, 달러, 유로, 위안)';
COMMENT ON COLUMN public.material_purchase_lines.note IS '비고';

CREATE INDEX IF NOT EXISTS idx_material_purchase_lines_purchase_id
    ON public.material_purchase_lines (purchase_id);

CREATE TABLE IF NOT EXISTS public.material_purchase_receipts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    line_id uuid NOT NULL REFERENCES public.material_purchase_lines (id) ON DELETE CASCADE,
    storage_path text NOT NULL,
    file_name text NOT NULL,
    content_type text,
    created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.material_purchase_receipts IS '완료 등록의 품목 영수증. storage_path는 material-purchase-receipts 버킷 경로';

CREATE INDEX IF NOT EXISTS idx_material_purchase_receipts_line_id
    ON public.material_purchase_receipts (line_id);

ALTER TABLE public.material_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_purchase_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_purchase_receipts ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.material_purchases TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.material_purchase_lines TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.material_purchase_receipts TO authenticated, service_role;

DROP POLICY IF EXISTS "material_purchases_select_allowed" ON public.material_purchases;
CREATE POLICY "material_purchases_select_allowed"
ON public.material_purchases
FOR SELECT
TO authenticated
USING (
    lower(split_part(coalesce(auth.jwt() ->> 'email', ''), '@', 1)) IN ('mw.park', 'brian.ko')
);

DROP POLICY IF EXISTS "material_purchases_insert_own" ON public.material_purchases;
CREATE POLICY "material_purchases_insert_own"
ON public.material_purchases
FOR INSERT
TO authenticated
WITH CHECK (
    user_id = auth.uid()
    AND lower(split_part(coalesce(auth.jwt() ->> 'email', ''), '@', 1)) IN ('mw.park', 'brian.ko')
);

DROP POLICY IF EXISTS "material_purchases_delete_own" ON public.material_purchases;
CREATE POLICY "material_purchases_delete_own"
ON public.material_purchases
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

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
          AND lower(split_part(coalesce(auth.jwt() ->> 'email', ''), '@', 1)) IN ('mw.park', 'brian.ko')
    )
);

DROP POLICY IF EXISTS "material_purchase_lines_insert_own" ON public.material_purchase_lines;
CREATE POLICY "material_purchase_lines_insert_own"
ON public.material_purchase_lines
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.material_purchases p
        WHERE p.id = purchase_id
          AND p.user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "material_purchase_lines_delete_own" ON public.material_purchase_lines;
CREATE POLICY "material_purchase_lines_delete_own"
ON public.material_purchase_lines
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.material_purchases p
        WHERE p.id = material_purchase_lines.purchase_id
          AND p.user_id = auth.uid()
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
          AND lower(split_part(coalesce(auth.jwt() ->> 'email', ''), '@', 1)) IN ('mw.park', 'brian.ko')
    )
);

DROP POLICY IF EXISTS "material_purchase_receipts_insert_own" ON public.material_purchase_receipts;
CREATE POLICY "material_purchase_receipts_insert_own"
ON public.material_purchase_receipts
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.material_purchase_lines l
        JOIN public.material_purchases p ON p.id = l.purchase_id
        WHERE l.id = line_id
          AND p.user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "material_purchase_receipts_delete_own" ON public.material_purchase_receipts;
CREATE POLICY "material_purchase_receipts_delete_own"
ON public.material_purchase_receipts
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.material_purchase_lines l
        JOIN public.material_purchases p ON p.id = l.purchase_id
        WHERE l.id = material_purchase_receipts.line_id
          AND p.user_id = auth.uid()
    )
);

INSERT INTO storage.buckets (id, name, public)
VALUES ('material-purchase-receipts', 'material-purchase-receipts', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "material_purchase_receipts_storage_insert" ON storage.objects;
CREATE POLICY "material_purchase_receipts_storage_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'material-purchase-receipts'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND lower(split_part(coalesce(auth.jwt() ->> 'email', ''), '@', 1)) IN ('mw.park', 'brian.ko')
);

DROP POLICY IF EXISTS "material_purchase_receipts_storage_select" ON storage.objects;
CREATE POLICY "material_purchase_receipts_storage_select"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'material-purchase-receipts'
    AND lower(split_part(coalesce(auth.jwt() ->> 'email', ''), '@', 1)) IN ('mw.park', 'brian.ko')
);

DROP POLICY IF EXISTS "material_purchase_receipts_storage_delete" ON storage.objects;
CREATE POLICY "material_purchase_receipts_storage_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'material-purchase-receipts'
    AND (storage.foldername(name))[1] = auth.uid()::text
);
