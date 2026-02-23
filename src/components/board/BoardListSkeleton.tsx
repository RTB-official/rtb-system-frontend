// src/components/board/BoardListSkeleton.tsx
import SectionCard from "../ui/SectionCard";

/** 게시판 목록 로딩 스켈레톤 - 카드 형태로 목록과 동일한 레이아웃 */
export default function BoardListSkeleton() {
    return (
        <div className="flex flex-col gap-4">
            {[1, 2, 3].map((i) => (
                <SectionCard key={i} title="" className="bg-white">
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                            <div className="h-6 w-24 rounded-lg bg-gray-100 animate-pulse" />
                            <div className="h-8 w-8 rounded-lg bg-gray-100 animate-pulse" />
                        </div>
                        <div className="h-6 w-4/5 max-w-[280px] rounded-lg bg-gray-100 animate-pulse" />
                        <div className="h-4 w-full rounded bg-gray-100 animate-pulse" />
                        <div className="h-4 w-full rounded bg-gray-100 animate-pulse" />
                        <div className="h-4 w-3/4 rounded bg-gray-100 animate-pulse" />
                        <div className="mt-4 flex items-center justify-start gap-2 border-t border-gray-100 pt-4">
                            <div className="h-8 w-8 shrink-0 rounded-full bg-gray-100 animate-pulse" />
                            <div className="flex flex-col gap-1">
                                <div className="h-3 w-16 rounded bg-gray-100 animate-pulse" />
                                <div className="h-3 w-24 rounded bg-gray-100 animate-pulse" />
                            </div>
                        </div>
                    </div>
                </SectionCard>
            ))}
        </div>
    );
}
