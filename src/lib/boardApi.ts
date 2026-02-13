import { supabase } from "./supabase";

export type BoardPostType = "notice" | "post" | "vote";
export type BoardVisibility = "staff" | "all" | "admin";

export interface BoardPost {
    id: string;
    author_id: string;
    author_name: string | null;
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
}

/** 목록 조회 (권한에 맞는 글만, 읽음 여부 포함) */
export async function getBoardPosts(userId: string): Promise<BoardPostRow[]> {
    const { data: posts, error: postsError } = await supabase
        .from("board_posts")
        .select("id, author_id, author_name, title, body, type, visibility, created_at, updated_at")
        .order("created_at", { ascending: false });

    if (postsError) throw postsError;
    if (!posts?.length) return [];

    const { data: reads } = await supabase
        .from("board_reads")
        .select("post_id, read_at")
        .eq("user_id", userId);

    const readMap = new Map<string, string>(
        (reads ?? []).map((r) => [r.post_id, r.read_at])
    );

    return posts.map((p) => ({
        ...p,
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
    return data as BoardPost;
}

/** 글 작성 */
export async function createBoardPost(
    authorId: string,
    authorName: string | null,
    input: CreateBoardPostInput
): Promise<BoardPost> {
    const { data, error } = await supabase
        .from("board_posts")
        .insert({
            author_id: authorId,
            author_name: authorName,
            title: input.title,
            body: input.body ?? null,
            type: input.type,
            visibility: input.visibility,
        })
        .select()
        .single();
    if (error) throw error;
    return data as BoardPost;
}

/** 읽음 처리 */
export async function markBoardPostAsRead(
    userId: string,
    postId: string
): Promise<void> {
    await supabase.from("board_reads").upsert(
        { user_id: userId, post_id: postId, read_at: new Date().toISOString() },
        { onConflict: "user_id,post_id" }
    );
}
