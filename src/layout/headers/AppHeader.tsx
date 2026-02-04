//AppHeader.tsx
import React from "react";

type AppHeaderProps = {
  title: string;

  /** 모바일에서 사이드바 여는 햄버거 버튼 */
  onMenuClick?: () => void;

  /** 왼쪽 영역에 뒤로가기(옵션) */
  onBackClick?: () => void;

  /** 우측 버튼 영역 */
  actions?: React.ReactNode;

  /** 추가 클래스 */
  className?: string;
};

// 아이콘들
const IconHamburger = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M4 6h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M4 12h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const IconChevronLeft = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function AppHeader({
  title,
  onMenuClick,
  onBackClick,
  actions,
  className = "",
}: AppHeaderProps) {
  return (
    <header className={`bg-white border-b border-[#eaecf0] ${className}`}>
      {/* 시안 느낌: 좌우 여백 + 높이 통일 */}
      <div className="px-4 md:px-6 lg:px-9 h-[64px] flex items-center justify-between gap-3">
        {/* Left */}
        <div className="flex items-center gap-2 min-w-0">
          {/* 모바일 햄버거 (onMenuClick 있을 때만) */}
          {onMenuClick && (
            <button
              onClick={onMenuClick}
              aria-label="사이드바 열기"
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100 active:bg-gray-200 transition-colors text-[#101828]"
            >
              <IconHamburger />
            </button>
          )}

          {/* 뒤로가기(옵션) - 데스크탑/모바일 둘다 */}
          {onBackClick && (
            <button
              onClick={onBackClick}
              aria-label="뒤로가기"
              className="p-2 rounded-lg hover:bg-gray-100 active:bg-gray-200 transition-colors text-[#101828]"
            >
              <IconChevronLeft />
            </button>
          )}

          <h1 className="text-[20px] sm:text-[20px] font-extrabold text-[#101828] truncate">
            {title}
          </h1>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {actions}
        </div>
      </div>
    </header>

  );
}
