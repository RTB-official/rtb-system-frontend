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
        // 최신 브라우저 타겟 (더 작은 번들)
        target: "esnext",
        rollupOptions: {
            output: {
                manualChunks: (id) => {
                    // node_modules에서 큰 라이브러리들을 분리
                    if (id.includes("node_modules")) {
                        // React 관련
                        if (id.includes("react") || id.includes("react-dom") || id.includes("react-router")) {
                            return "vendor-react";
                        }
                        // Supabase 클라이언트
                        if (id.includes("@supabase")) {
                            return "vendor-supabase";
                        }
                        // 차트 라이브러리
                        if (id.includes("recharts")) {
                            return "vendor-charts";
                        }
                        // PDF 관련
                        if (id.includes("jspdf")) {
                            return "vendor-pdf";
                        }
                        // Zustand
                        if (id.includes("zustand")) {
                            return "vendor-state";
                        }
                        // 나머지 node_modules
                        return "vendor";
                    }
                },
            },
        },
        // 빌드 최적화 옵션
        minify: "esbuild",
        // 소스맵 생성 비활성화 (프로덕션 성능 향상)
        sourcemap: false,
        // 청크 크기 경고 임계값 증가 (큰 페이지가 있을 수 있음)
        chunkSizeWarningLimit: 1500,
        // CSS 코드 스플리팅
        cssCodeSplit: true,
        // 작은 에셋 인라인 처리 (4KB 이하)
        assetsInlineLimit: 4096,
    },
    // 개발 서버 최적화
    server: {
        hmr: {
            overlay: false, // 에러 오버레이 비활성화 (성능 향상)
        },
    },
});
