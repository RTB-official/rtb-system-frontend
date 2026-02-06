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
        // React 중복 로딩 방지
        dedupe: ["react", "react-dom"],
    },
    build: {
        // 최신 브라우저 타겟 (더 작은 번들)
        target: "esnext",
        // CJS 모듈 변환 강화 (react/use-sync-external-store 호환)
        commonjsOptions: {
            include: [/node_modules/],
            transformMixedEsModules: true,
        },
        rollupOptions: {
            output: {
                manualChunks: (id) => {
                    // node_modules에서 큰 라이브러리들을 분리 (초기 로드 감소, 병렬 다운로드)
                    if (id.includes("node_modules")) {
                        if (id.includes("react-router")) {
                            return "vendor-react-router";
                        }
                        if (
                            id.includes("/react/") ||
                            id.includes("react-dom")
                        ) {
                            return undefined;
                        }
                        if (id.includes("@supabase")) {
                            return "vendor-supabase";
                        }
                        if (id.includes("recharts")) {
                            return "vendor-charts";
                        }
                        if (id.includes("jspdf")) {
                            return "vendor-pdf";
                        }
                        if (id.includes("zustand")) {
                            return "vendor-state";
                        }
                        return "vendor";
                    }
                },
                chunkFileNames: "assets/[name]-[hash].js",
                entryFileNames: "assets/[name]-[hash].js",
            },
        },
        // 브라우저가 청크를 미리 로드해 네비게이션 체감 속도 향상
        modulePreload: { polyfill: false },
        // 빌드 최적화 옵션
        minify: "esbuild",
        // 소스맵: 프로덕션에서는 false로 빌드 용량·속도 개선 가능
        sourcemap: true,
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
