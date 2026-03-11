-- 댓글 수정 RPC: RLS와 무관하게 auth.uid()로 본인 여부만 검사 후 수정
-- (일반 UPDATE가 0건이 되는 경우를 피하기 위함)

CREATE OR REPLACE FUNCTION public.update_board_comment_body(
    p_comment_id uuid,
    p_body text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_author_id uuid;
    v_trimmed text := trim(p_body);
BEGIN
    IF v_trimmed = '' THEN
        RAISE EXCEPTION '댓글 내용을 입력해 주세요.';
    END IF;

    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION '로그인이 필요합니다.';
    END IF;

    SELECT author_id INTO v_author_id
    FROM board_comments
    WHERE id = p_comment_id;

    IF v_author_id IS NULL THEN
        RAISE EXCEPTION '댓글을 찾을 수 없습니다.';
    END IF;

    IF v_author_id != auth.uid() THEN
        RAISE EXCEPTION '본인이 작성한 댓글만 수정할 수 있습니다.';
    END IF;

    UPDATE board_comments
    SET body = v_trimmed, updated_at = now()
    WHERE id = p_comment_id;
END;
$$;

COMMENT ON FUNCTION public.update_board_comment_body(uuid, text) IS '본인 댓글만 수정 (auth.uid() 검사)';

-- authenticated 사용자가 RPC 호출 가능
GRANT EXECUTE ON FUNCTION public.update_board_comment_body(uuid, text) TO authenticated;
