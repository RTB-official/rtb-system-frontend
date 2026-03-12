// src/lib/boardApi.ts
import { supabase } from "./supabase";

export type BoardPostType = "notice" | "post" | "vote";
export type BoardVisibility = "staff" | "all" | "admin";

export interface BoardPost {
    id: string;
    author_id: string;
    author_name: string | null;
    author_email?: string | null;
    title: string;
    body: string | null;
    type: BoardPostType;
    visibility: BoardVisibility;
    /** 게시글 작성 시 설정. true면 댓글을 익명/실명 선택 가능, false면 실명만 */
    allow_anonymous_comments?: boolean;
    /** true면 이 글의 모든 댓글이 비밀댓글(타인에게는 "비밀댓글입니다"만 표시) */
    secret_comments_only?: boolean;
    created_at: string;
    updated_at: string;
}

export interface BoardPostRow extends BoardPost {
    read_at?: string | null;
}

export interface CreateBoardPostInput {
    title: string;
    body?: string;
    type: BoardPostType;
    visibility: BoardVisibility;
    /** 댓글 익명 허용 여부. true면 익명/실명 선택 가능, false면 실명만 */
    allow_anonymous_comments?: boolean;
    /** 비밀댓글만 허용. true면 모든 댓글이 비밀댓글(타인에게 비밀댓글입니다 표시) */
    secret_comments_only?: boolean;
    voteOptions?: string[];
    /** 투표 시 여러 항목 선택 가능 여부 */
    voteAllowMultiple?: boolean;
    /** 투표 항목별 이미지 URL (options와 동일 길이, 없으면 빈 문자열) */
    voteOptionImages?: string[];
}

/** 목록 조회 */
export async function getBoardPosts(userId: string): Promise<BoardPostRow[]> {
    const { data: posts, error: postsError } = await supabase
        .from("board_posts")
        .select("id, author_id, author_name, title, body, type, visibility, allow_anonymous_comments, secret_comments_only, created_at, updated_at")
        .order("created_at", { ascending: false });

    if (postsError) throw postsError;
    if (!posts?.length) return [];

    const authorIds = [...new Set(posts.map((p) => p.author_id))];
    const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email")
        .in("id", authorIds);
    const emailByAuthorId = new Map<string, string>(
        (profiles ?? []).map((r) => [r.id, r.email ?? ""])
    );

    const { data: reads } = await supabase
        .from("board_reads")
        .select("post_id, read_at")
        .eq("user_id", userId);

    const readMap = new Map<string, string>(
        (reads ?? []).map((r) => [r.post_id, r.read_at])
    );

    return posts.map((p) => ({
        ...p,
        author_email: emailByAuthorId.get(p.author_id) ?? null,
        read_at: readMap.get(p.id) ?? null,
    })) as BoardPostRow[];
}

/** 단건 조회 */
export async function getBoardPostById(id: string): Promise<BoardPost | null> {
    const { data, error } = await supabase
        .from("board_posts")
        .select("*")
        .eq("id", id)
        .single();
    if (error) {
        if (error.code === "PGRST116") return null;
        throw error;
    }
    const post = data as BoardPost;
    if (post.author_id) {
        const { data: profile } = await supabase
            .from("profiles")
            .select("email")
            .eq("id", post.author_id)
            .maybeSingle();
        (post as BoardPost).author_email = profile?.email ?? null;
    } else {
        (post as BoardPost).author_email = null;
    }
    return post;
}

/** 글 작성 */
export async function createBoardPost(
    authorId: string,
    authorName: string | null,
    input: CreateBoardPostInput
): Promise<BoardPost> {
    let body: string | null = input.body ?? null;
    if (input.type === "vote" && input.voteOptions?.length) {
        body = JSON.stringify({
            description: (input.body ?? "").trim() || null,
            options: input.voteOptions,
            allowMultiple: input.voteAllowMultiple ?? false,
            optionImages: input.voteOptionImages ?? input.voteOptions.map(() => ""),
        });
    }
    const { data, error } = await supabase
        .from("board_posts")
        .insert({
            author_id: authorId,
            author_name: authorName,
            title: input.title,
            body,
            type: input.type,
            visibility: input.visibility,
            allow_anonymous_comments: input.allow_anonymous_comments ?? true,
            secret_comments_only: input.secret_comments_only ?? false,
        })
        .select()
        .single();
    if (error) throw error;
    return data as BoardPost;
}

const BOARD_OPTION_IMAGES_BUCKET = "board-option-images";

/** 투표 항목 이미지 업로드 → public URL 반환 */
export async function uploadBoardOptionImage(userId: string, file: File): Promise<string> {
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const safeName = `${userId}/${Date.now()}_${Math.random().toString(36).slice(2, 10)}.${ext}`;
    const { error } = await supabase.storage
        .from(BOARD_OPTION_IMAGES_BUCKET)
        .upload(safeName, file, { contentType: file.type, upsert: false });
    if (error) throw new Error(`이미지 업로드 실패: ${error.message}`);
    const { data } = supabase.storage.from(BOARD_OPTION_IMAGES_BUCKET).getPublicUrl(safeName);
    return data.publicUrl;
}

/** 글 삭제 */
export async function deleteBoardPost(postId: string, authorId: string): Promise<void> {
    const { error } = await supabase
        .from("board_posts")
        .delete()
        .eq("id", postId)
        .eq("author_id", authorId);
    if (error) throw error;
}

/** 글 수정 */
export async function updateBoardPost(
    postId: string,
    authorId: string,
    input: {
        title: string;
        body?: string;
        type: BoardPostType;
        visibility: BoardVisibility;
        allow_anonymous_comments?: boolean;
        secret_comments_only?: boolean;
        voteOptions?: string[];
        voteAllowMultiple?: boolean;
        voteOptionImages?: string[];
    }
): Promise<BoardPost> {
    let body: string | null = input.body ?? null;
    if (input.type === "vote" && input.voteOptions?.length) {
        body = JSON.stringify({
            description: (input.body ?? "").trim() || null,
            options: input.voteOptions,
            allowMultiple: input.voteAllowMultiple ?? false,
            optionImages: input.voteOptionImages ?? input.voteOptions.map(() => ""),
        });
    }
    const { data, error } = await supabase
        .from("board_posts")
        .update({
            title: input.title,
            body,
            type: input.type,
            visibility: input.visibility,
            allow_anonymous_comments: input.allow_anonymous_comments ?? true,
            secret_comments_only: input.secret_comments_only ?? false,
            updated_at: new Date().toISOString(),
        })
        .eq("id", postId)
        .eq("author_id", authorId)
        .select()
        .single();
    if (error) throw error;
    return data as BoardPost;
}

/** 읽음 처리 */
export async function markBoardPostAsRead(userId: string, postId: string): Promise<void> {
    await supabase.from("board_reads").upsert(
        { user_id: userId, post_id: postId, read_at: new Date().toISOString() },
        { onConflict: "user_id,post_id" }
    );
}

/** 내 투표 선택 조회 (선택한 option_index 배열, 단일 선택이면 길이 1) */
export async function getMyVotes(postId: string, userId: string): Promise<number[]> {
    const { data, error } = await supabase
        .from("board_votes")
        .select("option_index")
        .eq("post_id", postId)
        .eq("user_id", userId)
        .order("option_index");
    if (error) throw error;
    return (data ?? []).map((r) => r.option_index);
}

/** 여러 게시물에 대한 내 투표 선택 (목록용) */
export async function getMyVotesForPosts(postIds: string[], userId: string): Promise<Record<string, number[]>> {
    if (!postIds.length) return {};
    const { data, error } = await supabase
        .from("board_votes")
        .select("post_id, option_index")
        .in("post_id", postIds)
        .eq("user_id", userId)
        .order("option_index");
    if (error) throw error;
    const map: Record<string, number[]> = {};
    (data ?? []).forEach((r) => {
        if (!map[r.post_id]) map[r.post_id] = [];
        map[r.post_id].push(r.option_index);
    });
    return map;
}

/** 게시물별 옵션별 투표 수 (option_index -> count) */
export async function getVoteCounts(postId: string): Promise<Record<number, number>> {
    const { data, error } = await supabase
        .from("board_votes")
        .select("option_index")
        .eq("post_id", postId);
    if (error) throw error;
    const counts: Record<number, number> = {};
    (data ?? []).forEach((r) => {
        counts[r.option_index] = (counts[r.option_index] ?? 0) + 1;
    });
    return counts;
}

/** 여러 게시물 투표 수 (목록용) */
export async function getVoteCountsForPosts(postIds: string[]): Promise<Record<string, Record<number, number>>> {
    if (!postIds.length) return {};
    const { data, error } = await supabase
        .from("board_votes")
        .select("post_id, option_index")
        .in("post_id", postIds);
    if (error) throw error;
    const result: Record<string, Record<number, number>> = {};
    (data ?? []).forEach((r) => {
        if (!result[r.post_id]) result[r.post_id] = {};
        result[r.post_id][r.option_index] = (result[r.post_id][r.option_index] ?? 0) + 1;
    });
    return result;
}

/** 투표하기 (선택한 항목 인덱스 배열, 기존 선택 치환) */
export async function submitVote(postId: string, userId: string, optionIndices: number[]): Promise<void> {
    const { error: delError } = await supabase
        .from("board_votes")
        .delete()
        .eq("post_id", postId)
        .eq("user_id", userId);
    if (delError) throw delError;
    if (optionIndices.length === 0) return;
    const rows = optionIndices.map((option_index) => ({
        post_id: postId,
        user_id: userId,
        option_index,
    }));
    const { error: insError } = await supabase.from("board_votes").insert(rows);
    if (insError) throw insError;
}

// ==================== 첨부파일 ====================

export interface BoardAttachment {
    id: string;
    post_id: string;
    storage_path: string;
    file_name: string;
    content_type: string | null;
    file_size: number | null;
    created_at: string;
    /** 공개 URL (조회 시 채움) */
    url?: string;
}

const BOARD_ATTACHMENTS_BUCKET = "board-attachments";

/** 첨부파일 업로드 → storage 경로 및 메타 반환 (DB 저장은 호출 측에서) */
export async function uploadBoardAttachment(
    userId: string,
    file: File
): Promise<{ storage_path: string; file_name: string; content_type: string; file_size: number }> {
    const safeName = `${userId}/${Date.now()}_${Math.random().toString(36).slice(2, 10)}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error } = await supabase.storage
        .from(BOARD_ATTACHMENTS_BUCKET)
        .upload(safeName, file, { contentType: file.type || "application/octet-stream", upsert: false });
    if (error) {
        const msg = error.message || String(error);
        if (msg.includes("Bucket") || msg.includes("bucket") || msg.includes("not found")) {
            throw new Error(`첨부파일 업로드 실패: 'board-attachments' 버킷이 없습니다. Supabase 대시보드에서 Storage 버킷을 생성하거나, 마이그레이션(20250310300000_board_post_attachments.sql)을 적용해 주세요.`);
        }
        throw new Error(`첨부파일 업로드 실패: ${msg}`);
    }
    return {
        storage_path: safeName,
        file_name: file.name,
        content_type: file.type || "application/octet-stream",
        file_size: file.size,
    };
}

/** 게시글에 첨부 레코드 일괄 저장 */
export async function insertBoardAttachments(
    postId: string,
    items: { storage_path: string; file_name: string; content_type?: string; file_size?: number }[]
): Promise<void> {
    if (!items.length) return;
    const rows = items.map((item) => ({
        post_id: postId,
        storage_path: item.storage_path,
        file_name: item.file_name,
        content_type: item.content_type ?? null,
        file_size: item.file_size ?? null,
    }));
    const { error } = await supabase.from("board_post_attachments").insert(rows);
    if (error) {
        const msg = error.message || String(error);
        if (msg.includes("relation") && msg.includes("does not exist")) {
            throw new Error(`첨부파일 저장 실패: 'board_post_attachments' 테이블이 없습니다. Supabase에 마이그레이션(20250310300000_board_post_attachments.sql)을 적용해 주세요.`);
        }
        throw new Error(`첨부파일 저장 실패: ${msg}`);
    }
}

const ATTACHMENT_URL_EXPIRES_IN = 60 * 60; // 1시간 (Signed URL 사용 시)

/** 한 게시글의 첨부 목록 (url 포함, 비공개 버킷은 Signed URL 사용) */
export async function getBoardAttachments(postId: string): Promise<BoardAttachment[]> {
    const { data, error } = await supabase
        .from("board_post_attachments")
        .select("id, post_id, storage_path, file_name, content_type, file_size, created_at")
        .eq("post_id", postId)
        .order("created_at", { ascending: true });
    if (error) throw error;
    const list = (data ?? []) as BoardAttachment[];
    if (list.length === 0) return list;
    const paths = list.map((a) => a.storage_path);
    const { data: signedData, error: signedError } = await supabase.storage
        .from(BOARD_ATTACHMENTS_BUCKET)
        .createSignedUrls(paths, ATTACHMENT_URL_EXPIRES_IN);
    if (!signedError && signedData?.length) {
        const urlByPath = new Map(signedData.map((d) => [d.path, d.signedUrl ?? ""]));
        list.forEach((a) => {
            a.url = urlByPath.get(a.storage_path) || supabase.storage.from(BOARD_ATTACHMENTS_BUCKET).getPublicUrl(a.storage_path).data.publicUrl;
        });
    } else {
        list.forEach((a) => {
            a.url = supabase.storage.from(BOARD_ATTACHMENTS_BUCKET).getPublicUrl(a.storage_path).data.publicUrl;
        });
    }
    return list;
}

/** 여러 게시글의 첨부 목록 (postId -> BoardAttachment[], 비공개 버킷은 Signed URL 사용) */
export async function getBoardAttachmentsByPostIds(postIds: string[]): Promise<Record<string, BoardAttachment[]>> {
    if (!postIds.length) return {};
    const { data, error } = await supabase
        .from("board_post_attachments")
        .select("id, post_id, storage_path, file_name, content_type, file_size, created_at")
        .in("post_id", postIds)
        .order("created_at", { ascending: true });
    if (error) throw error;
    const list = (data ?? []) as BoardAttachment[];
    const result: Record<string, BoardAttachment[]> = {};
    list.forEach((a) => {
        if (!result[a.post_id]) result[a.post_id] = [];
        result[a.post_id].push(a as BoardAttachment);
    });
    if (list.length === 0) return result;
    const paths = list.map((a) => a.storage_path);
    const { data: signedData, error: signedError } = await supabase.storage
        .from(BOARD_ATTACHMENTS_BUCKET)
        .createSignedUrls(paths, ATTACHMENT_URL_EXPIRES_IN);
    if (!signedError && signedData?.length) {
        const urlByPath = new Map(signedData.map((d) => [d.path, d.signedUrl ?? ""]));
        list.forEach((a) => {
            (a as BoardAttachment).url = urlByPath.get(a.storage_path) || supabase.storage.from(BOARD_ATTACHMENTS_BUCKET).getPublicUrl(a.storage_path).data.publicUrl;
        });
    } else {
        list.forEach((a) => {
            (a as BoardAttachment).url = supabase.storage.from(BOARD_ATTACHMENTS_BUCKET).getPublicUrl(a.storage_path).data.publicUrl;
        });
    }
    return result;
}

/** 첨부 삭제 (DB만, 스토리지 객체는 유지) */
export async function deleteBoardAttachment(attachmentId: string): Promise<void> {
    const { error } = await supabase.from("board_post_attachments").delete().eq("id", attachmentId);
    if (error) throw error;
}

/** 스토리지에서 첨부 파일 삭제 (선택적 정리용) */
export async function removeBoardAttachmentFromStorage(storagePath: string): Promise<void> {
    await supabase.storage.from(BOARD_ATTACHMENTS_BUCKET).remove([storagePath]);
}

// ==================== 댓글 ====================

export interface BoardComment {
    id: string;
    post_id: string;
    parent_id: string | null;
    author_id: string;
    author_name: string | null;
    body: string;
    is_anonymous: boolean;
    created_at: string;
    updated_at: string;
}

/** 댓글 목록 조회 (대댓글 포함) */
export async function getBoardComments(postId: string): Promise<BoardComment[]> {
    const { data, error } = await supabase
        .from("board_comments")
        .select("*")
        .eq("post_id", postId)
        .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []) as BoardComment[];
}

/** 게시물별 댓글 수 (목록용) */
export async function getBoardCommentCounts(postIds: string[]): Promise<Record<string, number>> {
    if (!postIds.length) return {};
    const { data, error } = await supabase
        .from("board_comments")
        .select("post_id")
        .in("post_id", postIds);
    if (error) throw error;
    const counts: Record<string, number> = {};
    (data ?? []).forEach((r) => {
        counts[r.post_id] = (counts[r.post_id] ?? 0) + 1;
    });
    return counts;
}

/** 댓글 작성 */
export async function createBoardComment(
    postId: string,
    authorId: string,
    authorName: string | null,
    body: string,
    isAnonymous: boolean,
    parentId?: string | null
): Promise<BoardComment> {
    const trimmed = body.trim();
    if (!trimmed) throw new Error("댓글 내용을 입력해 주세요.");
    const { data, error } = await supabase
        .from("board_comments")
        .insert({
            post_id: postId,
            parent_id: parentId ?? null,
            author_id: authorId,
            author_name: authorName ?? null,
            body: trimmed,
            is_anonymous: isAnonymous,
        })
        .select()
        .single();
    if (error) throw error;
    return data as BoardComment;
}

/** 댓글 삭제 (RLS와 동일한 auth.uid() 사용) */
export async function deleteBoardComment(commentId: string, _userId: string): Promise<void> {
    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("로그인이 필요합니다.");
    const { error } = await supabase
        .from("board_comments")
        .delete()
        .eq("id", commentId)
        .eq("author_id", user.id);
    if (error) throw error;
}

/** 댓글 수정 (DB RPC 사용, auth.uid()로 본인 검사) */
export async function updateBoardComment(
    commentId: string,
    _userId: string,
    body: string
): Promise<void> {
    const trimmed = body.trim();
    if (!trimmed) throw new Error("댓글 내용을 입력해 주세요.");
    const { error } = await supabase.rpc("update_board_comment_body", {
        p_comment_id: commentId,
        p_body: trimmed,
    });
    if (error) {
        throw new Error(error.message || "댓글을 수정할 수 없습니다. 본인이 작성한 댓글인지 확인해 주세요.");
    }
}
