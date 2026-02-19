/**
 * 페이지 메인 콘텐츠용 래퍼.
 * 좌우 패딩: 모바일 16px, md 24px, lg 36px (팀 공통 규칙)
 */
interface PageContainerProps {
  children: React.ReactNode;
  /** 추가 className (예: pt-9 pb-20) */
  className?: string;
}

export default function PageContainer({ children, className = "" }: PageContainerProps) {
  return (
    <div className={`px-4 md:px-6 lg:px-9 ${className}`.trim()}>
      {children}
    </div>
  );
}
