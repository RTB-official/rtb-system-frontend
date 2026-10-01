-- 자재 구매·가공 구매 완료. 승인 변경과 같이 profiles.role = admin 만 바꿀 수 있다.

ALTER TABLE public.material_purchases
    ADD COLUMN IF NOT EXISTS purchased boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.material_purchases.purchased IS '구매 완료 여부. true면 구매 완료, 다시 누르면 false로 해제';
