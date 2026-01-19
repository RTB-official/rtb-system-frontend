-- 알림(notifications) 테이블 생성 스크립트
-- Supabase SQL Editor에서 실행하세요

-- 1. notifications 테이블 생성
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('report', 'schedule', 'vacation', 'other')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    read_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- 2. 인덱스 생성 (성능 향상)
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_read_at ON notifications(read_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);

-- 3. RLS (Row Level Security) 정책 설정
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 알림만 볼 수 있음
CREATE POLICY "Users can view their own notifications"
    ON notifications
    FOR SELECT
    USING (auth.uid() = user_id);

-- 사용자는 자신의 알림을 읽음 처리할 수 있음
CREATE POLICY "Users can update their own notifications"
    ON notifications
    FOR UPDATE
    USING (auth.uid() = user_id);

-- 서비스 역할(service_role)은 모든 알림을 생성할 수 있음
-- (알림 생성은 서버 측에서만 수행되므로 anon으로는 생성 불가)
-- 하지만 클라이언트에서도 생성할 수 있도록 anon 정책도 추가
CREATE POLICY "Authenticated users can create notifications for themselves"
    ON notifications
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- 4. 자동 정리 함수 (2주 지난 알림 삭제)
-- 참고: 이 함수는 수동으로 실행하거나 cron job으로 설정해야 합니다
CREATE OR REPLACE FUNCTION delete_old_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM notifications
    WHERE created_at < NOW() - INTERVAL '14 days';
END;
$$;

-- 5. 결과 확인
SELECT 
    tablename,
    schemaname
FROM pg_tables
WHERE tablename = 'notifications';

-- 현재 알림 개수 확인 (없으면 0개일 것)
SELECT COUNT(*) as total_notifications FROM notifications;

