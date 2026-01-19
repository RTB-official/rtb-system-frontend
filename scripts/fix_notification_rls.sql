-- 알림 생성 RLS 정책 수정
-- Supabase SQL Editor에서 실행하세요

-- 기존 정책 완전히 삭제
DROP POLICY IF EXISTS "Authenticated users can create notifications" ON notifications;
DROP POLICY IF EXISTS "Users can create notifications for themselves" ON notifications;

-- 새 정책: 인증된 사용자는 누구에게나 알림 생성 가능
CREATE POLICY "Authenticated users can create notifications"
    ON notifications
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

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

