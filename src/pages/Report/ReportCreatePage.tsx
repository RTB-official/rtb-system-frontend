import { useState } from 'react';
import Sidebar from '../../components/Sidebar';

export default function ReportCreatePage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-white font-pretendard">
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className={`
        fixed lg:static inset-y-0 left-0 z-50
        transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0
        transition-transform duration-300 ease-in-out
      `}>
        <Sidebar onClose={() => setSidebarOpen(false)} activeMenu="출장 보고서" activeSubMenu="보고서 작성" />
      </div>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="bg-white border-b border-gray-200 px-6 lg:px-9 py-3 flex items-center gap-5">
          <button 
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 hover:bg-gray-100 rounded-lg text-gray-700"
          >
            메뉴
          </button>
          <h1 className="font-bold text-[22px] text-gray-700">
            보고서 작성
          </h1>
        </header>

        <main className="flex-1 overflow-auto px-6 lg:px-12 pt-6 pb-24">
          <div className="max-w-[1200px]">
            <p className="text-gray-600">여기에 보고서 작성 폼을 구현하세요.</p>
          </div>
        </main>
      </div>
    </div>
  );
}








