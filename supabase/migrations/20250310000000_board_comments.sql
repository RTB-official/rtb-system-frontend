-- 게시판 댓글·익명 옵션 마이그레이션
-- Supabase Dashboard > SQL Editor에서 실행하세요.

-- 1) board_posts에 댓글 익명 허용 여부 컬럼 추가
ALTER TABLE board_posts
ADD COLUMN IF NOT EXISTS allow_anonymous_comments boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN board_posts.allow_anonymous_comments IS 'true: 익명/실명 선택 가능, false: 실명만';

-- 2) 댓글 테이블 생성 (대댓글 지원)
CREATE TABLE IF NOT EXISTS board_comments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id uuid NOT NULL REFERENCES board_posts(id) ON DELETE CASCADE,
    parent_id uuid REFERENCES board_comments(id) ON DELETE CASCADE,
    author_id uuid NOT NULL,
    author_name text,
    body text NOT NULL,
    is_anonymous boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_board_comments_post_id ON board_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_board_comments_parent_id ON board_comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_board_comments_created_at ON board_comments(created_at);

COMMENT ON TABLE board_comments IS '게시판 댓글 (대댓글: parent_id로 구분)';
COMMENT ON COLUMN board_comments.is_anonymous IS 'true면 익명, author_name 미표시';
COMMENT ON COLUMN board_comments.author_name IS '실명일 때 표시용 (profiles.name과 동기화 가능)';

-- RLS 정책 (기존 board_posts 접근 권한과 맞춰 적용)
ALTER TABLE board_comments ENABLE ROW LEVEL SECURITY;

-- 읽기: 로그인 사용자
CREATE POLICY "board_comments_select_authenticated"
ON board_comments FOR SELECT
TO authenticated
USING (true);

-- 삽입: 로그인 사용자, 본인 author_id
CREATE POLICY "board_comments_insert_own"
ON board_comments FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = author_id);

-- 삭제: 본인 댓글만
CREATE POLICY "board_comments_delete_own"
ON board_comments FOR DELETE
TO authenticated
USING (auth.uid() = author_id);

-- 수정: 본인 댓글만
CREATE POLICY "board_comments_update_own"
ON board_comments FOR UPDATE
TO authenticated
USING (auth.uid() = author_id)
WITH CHECK (auth.uid() = author_id);
