-- 알림 클릭 시 이동 경로 등 저장 (예: 게시글 postId)
-- notifications 테이블이 이미 있는 경우에만 실행
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS meta jsonb;

COMMENT ON COLUMN notifications.meta IS '알림별 메타데이터 (예: board_post 시 postId)';
