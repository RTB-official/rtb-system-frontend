-- 알림 생성 RLS 정책 수정
-- Supabase SQL Editor에서 실행하세요

-- 기존 정책 완전히 삭제
DROP POLICY IF EXISTS "Authenticated users can create notifications" ON notifications;
DROP POLICY IF EXISTS "Users can create notifications for themselves" ON notifications;
DROP POLICY IF EXISTS "Allow authenticated insert" ON notifications;

-- 방법 1: 인증된 사용자는 누구에게나 알림 생성 가능 (USING과 WITH CHECK 모두 true)
CREATE POLICY "Allow authenticated insert"
    ON notifications
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- 방법 2: 만약 위 방법이 안 되면, SECURITY DEFINER 함수 사용
CREATE OR REPLACE FUNCTION create_notification_for_user(
    p_user_id UUID,
    p_title TEXT,
    p_message TEXT,
    p_type TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_notification_id UUID;
BEGIN
    INSERT INTO notifications (user_id, title, message, type)
    VALUES (p_user_id, p_title, p_message, p_type)
    RETURNING id INTO v_notification_id;
    
    RETURN v_notification_id;
END;
$$;

-- 정책 확인
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'notifications';

