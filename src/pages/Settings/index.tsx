//settings/index.tsx
import React from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/common/Header";
import { IconChevronRight } from "../../components/icons/Icons";

export default function SettingsPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const nav = useNavigate();

  const SettingRow = ({
    title,
    desc,
    to,
  }: {
    title: string;
    desc?: string;
    to: string;
  }) => (
    <button
      type="button"
      onClick={() => nav(to)}
      className="w-full px-6 py-5 flex items-center justify-between gap-4 hover:bg-gray-50 transition-colors text-left"
    >
      <div className="min-w-0 flex flex-col justify-center">
        <div className="text-[16px] font-semibold text-gray-800">{title}</div>
        {desc ? <div className="text-[14px] text-gray-500 mt-1">{desc}</div> : null}
      </div>
      <IconChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
    </button>
  );

  const SettingSection = ({
    label,
    children,
  }: {
    label: string;
    children: React.ReactNode;
  }) => (
    <div>
      <div className="px-1 mb-2 text-[14px] font-semibold text-gray-500">{label}</div>
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        {children}
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-white font-pretendard overflow-hidden">
      {/* 모바일 오버레이 */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed lg:static inset-y-0 left-0 z-50 transform ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0 transition-transform duration-300 ease-in-out`}
      >
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header title="설정" onMenuClick={() => setSidebarOpen(true)} />

        <main className="flex-1 overflow-auto pt-8 pb-20 px-4 sm:px-6 lg:px-10 bg-gray-50">
          <div className="w-full max-w-none">

          <div className="flex flex-col gap-6">

              <SettingSection label="웹설정">
                <SettingRow
                  title="안전 문구"
                  desc="시스템에 표시할 안전/주의 문구를 설정합니다."
                  to="/settings/safe-phrase"
                />
              </SettingSection>
            </div>

          </div>
        </main>
      </div>
    </div>
  );
}