-- 게시글 비밀댓글 옵션: true면 해당 글의 모든 댓글이 비밀댓글(타인에게는 "비밀댓글입니다"만 표시)

ALTER TABLE board_posts
ADD COLUMN IF NOT EXISTS secret_comments_only boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN board_posts.secret_comments_only IS 'true: 이 글의 댓글은 작성자·글 작성자만 내용 조회 가능, 그 외에는 비밀댓글입니다 표시';
