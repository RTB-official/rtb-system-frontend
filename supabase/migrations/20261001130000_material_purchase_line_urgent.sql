ALTER TABLE public.material_purchase_lines
    ADD COLUMN IF NOT EXISTS urgent boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.material_purchase_lines.urgent IS '긴급구매 여부';
