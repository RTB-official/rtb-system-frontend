// 테이블/리스트 행 확장 시 나오는 상세 영역 공통 컴포넌트 (휴가·경비 등 재사용)
import type { ReactNode } from "react";

interface ExpandableDetailPanelProps {
    children: ReactNode;
    className?: string;
}

export default function ExpandableDetailPanel({
    children,
    className = "",
}: ExpandableDetailPanelProps) {
    return (
        <div
            className={`border-t border-gray-200 overflow-hidden ${className}`}
            onClick={(e) => e.stopPropagation()}
            role="presentation"
        >
            <div
                className="p-4 md:p-6 bg-gray-50 min-h-[60px]"
                style={{ animation: "expandable-panel-in 0.2s ease-out" }}
            >
                {children}
            </div>
        </div>
    );
}
