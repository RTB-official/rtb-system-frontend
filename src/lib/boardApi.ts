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
        .select("id, author_id, author_name, title, body, type, visibility, created_at, updated_at")
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
