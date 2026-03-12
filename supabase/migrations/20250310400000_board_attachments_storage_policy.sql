-- 기존 업로드 정책이 있으면 제거 후 재생성 (인증된 사용자 업로드 허용)
DROP POLICY IF EXISTS "board_attachments_upload_authenticated" ON storage.objects;

CREATE POLICY "board_attachments_upload_authenticated"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'board-attachments');
