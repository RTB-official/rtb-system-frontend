-- 작성자도 본인 건의 purchased(구매 완료)만 변경 가능
-- 승인 관련 컬럼은 계속 admin만 변경

CREATE OR REPLACE FUNCTION public.material_purchases_keep_admin_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    is_admin boolean := EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role = 'admin'
    );
    is_owner boolean := OLD.user_id = auth.uid();
BEGIN
    IF is_admin THEN
        RETURN NEW;
    END IF;

    NEW.user_id := OLD.user_id;
    NEW.status := OLD.status;
    NEW.approval_status := OLD.approval_status;
    NEW.approved_by := OLD.approved_by;
    NEW.approved_at := OLD.approved_at;
    NEW.created_at := OLD.created_at;

    -- 작성자가 아니면 purchased도 고정
    IF NOT is_owner THEN
        NEW.purchased := OLD.purchased;
    END IF;

    RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS "material_purchases_update_purchased_own" ON public.material_purchases;
CREATE POLICY "material_purchases_update_purchased_own"
ON public.material_purchases
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
