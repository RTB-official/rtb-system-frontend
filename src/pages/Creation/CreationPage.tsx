  //  CreationPage.tsx
  import { useState } from 'react';
  import Sidebar from '../../components/Sidebar';
  import AppHeader from '../../layout/headers/AppHeader';
import BasicInfoSection from '../../components/sections/BasicInfoSection';
import WorkerSection from '../../components/sections/WorkerSection';
import WorkLogSection from '../../components/sections/WorkLogSection';
import ExpenseSection from '../../components/sections/ExpenseSection';
import ConsumablesSection from '../../components/sections/ConsumablesSection';
import FileUploadSection from '../../components/sections/FileUploadSection';
import TimelineSummarySection from '../../components/sections/TimelineSummarySection';
import { useWorkReportStore } from '../../store/workReportStore';

export default function CreationPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { 
    author, vessel, engine, subject, workers, workLogEntries, expenses, materials 
  } = useWorkReportStore();

  // 제출 핸들러
  const handleSubmit = () => {
    // 필수 항목 체크
    if (!author || !vessel || !engine || !subject) {
      alert('기본정보(작성자/호선/엔진/목적)는 필수입니다.');
      return;
    }
    if (workers.length === 0) {
      alert('작업자를 선택해주세요.');
      return;
    }
    if (workLogEntries.length === 0) {
      alert('출장 업무 일지를 1개 이상 작성해주세요.');
      return;
    }

    if (!confirm('제출하시겠습니까?')) return;

    // 실제 서버 연동 시 여기에 API 호출
    const payload = {
      basic: {
        author,
        vessel,
        engine,
        subject,
        workers,
      },
      entries: workLogEntries,
      expenses,
      materials,
    };

    console.log('제출 데이터:', payload);
    alert('제출 완료! (콘솔에서 데이터 확인)');
  };

  // 임시저장 핸들러
  const handleDraftSave = () => {
    const payload = {
      basic: {
        author,
        vessel,
        engine,
        subject,
        workers,
      },
      entries: workLogEntries,
      expenses,
      materials,
    };

    console.log('임시저장 데이터:', payload);
    alert('임시저장 완료! (콘솔에서 데이터 확인)');
  };

  return (
    <div className="flex h-screen bg-[#f9fafb] overflow-hidden">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - 데스크탑에서 고정, 모바일에서 슬라이드 */}
      <div className={`
        fixed lg:static inset-y-0 left-0 z-30
        w-[239px] h-screen flex-shrink-0
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden w-full">
        {/* Header - 고정 */}
        <div className="sticky top-0 z-10 flex-shrink-0">
          <AppHeader
            title="출장보고서 작성"
            onMenuClick={() => setSidebarOpen(true)}
            actions={
              <>
                <button
                  onClick={handleDraftSave}
                  className="
                    h-9 px-3 rounded-lg
                    bg-[#f2f4f7] text-[#344054] text-[13px] font-medium
                    hover:bg-[#e4e7ec]
                    active:bg-[#d0d5dd]
                    transition-colors
                  "
                >
                  임시 저장
                </button>
                <button
                  onClick={handleSubmit}
                  className="h-9 px-3 rounded-lg bg-[#364153] text-white text-[13px] font-medium hover:opacity-90 transition"
                >
                  제출하기
                </button>
              </>
            }
          />
        </div>

        
        {/* Content Area - 스크롤 가능 */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 md:px-12 lg:px-24 xl:px-48 py-6 md:py-9">
          <div className="max-w-[817px] mx-auto flex flex-col gap-4 md:gap-6">
            {/* 기본 정보 */}
            <BasicInfoSection />
            
            {/* 작업자 */}
            <WorkerSection />
            
            {/* 출장 업무 일지 */}
            <WorkLogSection />
            
            {/* 경비 내역 */}
            <ExpenseSection />
            
            {/* 소모품 사용량 */}
            <ConsumablesSection />
            
            {/* 첨부파일 업로드 */}
            <FileUploadSection />
            
            {/* 타임라인 요약 */}
            <TimelineSummarySection 
              onDraftSave={handleDraftSave}
              onSubmit={handleSubmit}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
