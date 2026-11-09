-- 자재현황(공장 재고) 1차 스키마. 구매·가공(material_purchases)과 분리.

CREATE TABLE IF NOT EXISTS public.inventory_categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    sort_order int NOT NULL DEFAULT 0,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS inventory_categories_name_unique
    ON public.inventory_categories (lower(name));

CREATE TABLE IF NOT EXISTS public.inventory_locations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id uuid REFERENCES public.inventory_locations (id) ON DELETE SET NULL,
    name text NOT NULL,
    kind text NOT NULL DEFAULT 'zone'
        CHECK (kind IN ('zone', 'shelf', 'other')),
    sort_order int NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS inventory_locations_parent_id_idx
    ON public.inventory_locations (parent_id);

CREATE TABLE IF NOT EXISTS public.inventory_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    spec text NOT NULL DEFAULT '',
    category_id uuid REFERENCES public.inventory_categories (id) ON DELETE SET NULL,
    unit text NOT NULL DEFAULT 'EA',
    min_quantity numeric NOT NULL DEFAULT 0,
    note text NOT NULL DEFAULT '',
    created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS inventory_items_category_id_idx
    ON public.inventory_items (category_id);
CREATE INDEX IF NOT EXISTS inventory_items_name_idx
    ON public.inventory_items (name);
CREATE INDEX IF NOT EXISTS inventory_items_updated_at_idx
    ON public.inventory_items (updated_at DESC);

CREATE TABLE IF NOT EXISTS public.inventory_stocks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id uuid NOT NULL REFERENCES public.inventory_items (id) ON DELETE CASCADE,
    location_id uuid REFERENCES public.inventory_locations (id) ON DELETE SET NULL,
    slot_code text NOT NULL DEFAULT '',
    quantity numeric NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS inventory_stocks_item_id_idx
    ON public.inventory_stocks (item_id);
CREATE INDEX IF NOT EXISTS inventory_stocks_location_id_idx
    ON public.inventory_stocks (location_id);

CREATE TABLE IF NOT EXISTS public.inventory_item_photos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id uuid NOT NULL REFERENCES public.inventory_items (id) ON DELETE CASCADE,
    storage_path text NOT NULL,
    file_name text NOT NULL DEFAULT '',
    content_type text NOT NULL DEFAULT 'image/jpeg',
    sort_order int NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS inventory_item_photos_item_id_idx
    ON public.inventory_item_photos (item_id);

COMMENT ON TABLE public.inventory_categories IS '자재현황 카테고리 마스터';
COMMENT ON TABLE public.inventory_locations IS '자재현황 보관 위치(구역/선반). parent_id로 트리';
COMMENT ON TABLE public.inventory_items IS '자재현황 품목 마스터';
COMMENT ON TABLE public.inventory_stocks IS '품목별 위치·수량. location_id NULL이면 위치 미지정';
COMMENT ON TABLE public.inventory_item_photos IS '품목 사진. storage_path는 inventory-item-photos 버킷';

ALTER TABLE public.inventory_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_stocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_item_photos ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.inventory_categories TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.inventory_locations TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.inventory_items TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.inventory_stocks TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.inventory_item_photos TO authenticated, service_role;

-- categories: 조회 전원, 쓰기 admin
DROP POLICY IF EXISTS "inventory_categories_select" ON public.inventory_categories;
CREATE POLICY "inventory_categories_select"
ON public.inventory_categories FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "inventory_categories_write_admin" ON public.inventory_categories;
CREATE POLICY "inventory_categories_write_admin"
ON public.inventory_categories FOR ALL TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
)
WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);

-- locations: 조회 전원, 쓰기 admin
DROP POLICY IF EXISTS "inventory_locations_select" ON public.inventory_locations;
CREATE POLICY "inventory_locations_select"
ON public.inventory_locations FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "inventory_locations_write_admin" ON public.inventory_locations;
CREATE POLICY "inventory_locations_write_admin"
ON public.inventory_locations FOR ALL TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
)
WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);

-- items: 조회/등록/수정 전원, 삭제는 작성자 또는 admin
DROP POLICY IF EXISTS "inventory_items_select" ON public.inventory_items;
CREATE POLICY "inventory_items_select"
ON public.inventory_items FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "inventory_items_insert" ON public.inventory_items;
CREATE POLICY "inventory_items_insert"
ON public.inventory_items FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "inventory_items_update" ON public.inventory_items;
CREATE POLICY "inventory_items_update"
ON public.inventory_items FOR UPDATE TO authenticated
USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "inventory_items_delete" ON public.inventory_items;
CREATE POLICY "inventory_items_delete"
ON public.inventory_items FOR DELETE TO authenticated
USING (
    created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);

-- stocks
DROP POLICY IF EXISTS "inventory_stocks_select" ON public.inventory_stocks;
CREATE POLICY "inventory_stocks_select"
ON public.inventory_stocks FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "inventory_stocks_insert" ON public.inventory_stocks;
CREATE POLICY "inventory_stocks_insert"
ON public.inventory_stocks FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "inventory_stocks_update" ON public.inventory_stocks;
CREATE POLICY "inventory_stocks_update"
ON public.inventory_stocks FOR UPDATE TO authenticated
USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "inventory_stocks_delete" ON public.inventory_stocks;
CREATE POLICY "inventory_stocks_delete"
ON public.inventory_stocks FOR DELETE TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.inventory_items i
        WHERE i.id = inventory_stocks.item_id
          AND (
              i.created_by = auth.uid()
              OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
          )
    )
);

-- photos
DROP POLICY IF EXISTS "inventory_item_photos_select" ON public.inventory_item_photos;
CREATE POLICY "inventory_item_photos_select"
ON public.inventory_item_photos FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "inventory_item_photos_insert" ON public.inventory_item_photos;
CREATE POLICY "inventory_item_photos_insert"
ON public.inventory_item_photos FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "inventory_item_photos_update" ON public.inventory_item_photos;
CREATE POLICY "inventory_item_photos_update"
ON public.inventory_item_photos FOR UPDATE TO authenticated
USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "inventory_item_photos_delete" ON public.inventory_item_photos;
CREATE POLICY "inventory_item_photos_delete"
ON public.inventory_item_photos FOR DELETE TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.inventory_items i
        WHERE i.id = inventory_item_photos.item_id
          AND (
              i.created_by = auth.uid()
              OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
          )
    )
);

-- Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('inventory-item-photos', 'inventory-item-photos', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "inventory_item_photos_storage_select" ON storage.objects;
CREATE POLICY "inventory_item_photos_storage_select"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'inventory-item-photos');

DROP POLICY IF EXISTS "inventory_item_photos_storage_insert" ON storage.objects;
CREATE POLICY "inventory_item_photos_storage_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'inventory-item-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "inventory_item_photos_storage_update" ON storage.objects;
CREATE POLICY "inventory_item_photos_storage_update"
ON storage.objects FOR UPDATE TO authenticated
USING (
    bucket_id = 'inventory-item-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
    bucket_id = 'inventory-item-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "inventory_item_photos_storage_delete" ON storage.objects;
CREATE POLICY "inventory_item_photos_storage_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
    bucket_id = 'inventory-item-photos'
    AND (
        (storage.foldername(name))[1] = auth.uid()::text
        OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    )
);

-- seed categories
INSERT INTO public.inventory_categories (name, sort_order)
VALUES
    ('공구', 10),
    ('인양장비', 20),
    ('볼트·너트', 30),
    ('안전용품', 40),
    ('화학제품', 50),
    ('소모품', 60)
ON CONFLICT DO NOTHING;

-- seed sample zones (optional starter)
INSERT INTO public.inventory_locations (name, kind, sort_order)
SELECT v.name, 'zone', v.sort_order
FROM (VALUES
    ('A동 1층', 10),
    ('A동 2층', 20),
    ('B동 1층', 30),
    ('공구실', 40),
    ('자재창고', 50)
) AS v(name, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.inventory_locations LIMIT 1);
