/**
 * Supabase Storage 버킷 생성 스크립트
 * 실행 방법: npx tsx scripts/create-storage-bucket.ts
 */

import { supabase } from "../src/lib/supabase";

async function createStorageBucket() {
    console.log("📦 Storage 버킷 생성 시작...");

    try {
        // personal-expense-receipts 버킷 생성
        const { data, error } = await supabase.storage.createBucket(
            "personal-expense-receipts",
            {
                public: true, // 공개 버킷 (영수증 접근을 위해)
                allowedMimeTypes: ["image/*", "application/pdf"], // 이미지와 PDF만 허용
                fileSizeLimit: 5242880, // 5MB 제한
            }
        );

        if (error) {
            // 이미 존재하는 버킷이면 무시
            if (error.message.includes("already exists")) {
                console.log("✅ 버킷이 이미 존재합니다: personal-expense-receipts");
                return;
            }
            throw error;
        }

        console.log("✅ 버킷 생성 완료:", data);
        console.log("\n📋 생성된 버킷 정보:");
        console.log("  - 이름: personal-expense-receipts");
        console.log("  - 공개: true");
        console.log("  - 허용 파일 타입: image/*, application/pdf");
        console.log("  - 최대 파일 크기: 5MB");
    } catch (error: any) {
        console.error("❌ 버킷 생성 실패:", error.message);
        
        if (error.message.includes("permission")) {
            console.log("\n💡 권한이 없습니다. 대시보드에서 수동으로 생성해주세요:");
            console.log("   1. Supabase 대시보드 → Storage");
            console.log("   2. New Bucket 클릭");
            console.log("   3. 이름: personal-expense-receipts");
            console.log("   4. Public bucket 체크");
            console.log("   5. Create 클릭");
        }
    }
}

createStorageBucket();

