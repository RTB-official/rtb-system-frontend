import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    plugins: [react(), tailwindcss()],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "src"),
        },
    },
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    // vendor: React, React DOM 등 큰 라이브러리 분리
                    vendor: ["react", "react-dom", "react-router-dom"],
                    // supabase 클라이언트 분리
                    supabase: ["@supabase/supabase-js"],
                },
            },
        },
        // 청크 크기 경고 임계값 증가 (큰 페이지가 있을 수 있음)
        chunkSizeWarningLimit: 1000,
    },
});
