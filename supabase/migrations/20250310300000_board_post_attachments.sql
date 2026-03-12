-- 게시글 첨부파일 (사진, PDF 등)

-- Storage 버킷 (public: 링크로 다운로드 가능)
INSERT INTO storage.buckets (id, name, public)
VALUES ('board-attachments', 'board-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- 버킷 정책 (이미 있으면 제거 후 생성 → 재실행 가능)
DROP POLICY IF EXISTS "board_attachments_upload_authenticated" ON storage.objects;
CREATE POLICY "board_attachments_upload_authenticated"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'board-attachments');

DROP POLICY IF EXISTS "board_attachments_select_public" ON storage.objects;
CREATE POLICY "board_attachments_select_public"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'board-attachments');

DROP POLICY IF EXISTS "board_attachments_delete_authenticated" ON storage.objects;
CREATE POLICY "board_attachments_delete_authenticated"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'board-attachments');

CREATE TABLE IF NOT EXISTS board_post_attachments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id uuid NOT NULL REFERENCES board_posts(id) ON DELETE CASCADE,
    storage_path text NOT NULL,
    file_name text NOT NULL,
    content_type text,
    file_size bigint,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_board_post_attachments_post_id ON board_post_attachments(post_id);

COMMENT ON TABLE board_post_attachments IS '게시글 첨부파일 (storage_path: board-attachments 버킷 내 경로)';

ALTER TABLE board_post_attachments ENABLE ROW LEVEL SECURITY;

-- 읽기: 로그인 사용자
DROP POLICY IF EXISTS "board_post_attachments_select_authenticated" ON board_post_attachments;
CREATE POLICY "board_post_attachments_select_authenticated"
ON board_post_attachments FOR SELECT TO authenticated USING (true);

-- 삽입: 로그인 사용자 (글 작성자는 글 생성 후 첨부)
DROP POLICY IF EXISTS "board_post_attachments_insert_authenticated" ON board_post_attachments;
CREATE POLICY "board_post_attachments_insert_authenticated"
ON board_post_attachments FOR INSERT TO authenticated WITH CHECK (true);

-- 삭제: 본인 글의 첨부만 (post.author_id = auth.uid())
DROP POLICY IF EXISTS "board_post_attachments_delete_own" ON board_post_attachments;
CREATE POLICY "board_post_attachments_delete_own"
ON board_post_attachments FOR DELETE TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM board_posts p
        WHERE p.id = board_post_attachments.post_id AND p.author_id = auth.uid()
    )
);
