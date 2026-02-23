// src/lib/memberFilesApi.ts
import { supabase } from "./supabase";

const PROFILE_PHOTO_BUCKET = "profile-photos";
const PASSPORT_PHOTO_BUCKET = "passport-photos";
const SIGNATURE_BUCKET = "signatures";

const getRandomId = () => {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
        return crypto.randomUUID();
    }
    return `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
};

async function uploadMemberFile(
    bucket: string,
    userId: string,
    file: File
): Promise<{ bucket: string; path: string; name: string }> {
    const fileExt = file.name.split(".").pop() || "bin";
    const fileName = `${getRandomId()}.${fileExt}`;
    const path = `${userId}/${fileName}`;
    const { error } = await supabase.storage
        .from(bucket)
        .upload(path, file, { upsert: true });
    if (error) {
        throw error;
    }
    return {
        bucket,
        path,
        name: file.name,
    };
}

export async function uploadProfilePhoto(
    userId: string,
    file: File
): Promise<{ bucket: string; path: string; name: string }> {
    return uploadMemberFile(PROFILE_PHOTO_BUCKET, userId, file);
}

export async function uploadPassportPhoto(
    userId: string,
    file: File
): Promise<{ bucket: string; path: string; name: string }> {
    return uploadMemberFile(PASSPORT_PHOTO_BUCKET, userId, file);
}

export async function uploadSignature(
    userId: string,
    file: File
): Promise<{ bucket: string; path: string; name: string }> {
    return uploadMemberFile(SIGNATURE_BUCKET, userId, file);
}
