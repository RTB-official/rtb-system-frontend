ALTER TABLE public.material_purchase_lines
    ADD COLUMN IF NOT EXISTS spec text;

ALTER TABLE public.material_purchase_lines
    ADD COLUMN IF NOT EXISTS grade text;

COMMENT ON COLUMN public.material_purchase_lines.spec IS '규격';
COMMENT ON COLUMN public.material_purchase_lines.grade IS '재질/Grade';
