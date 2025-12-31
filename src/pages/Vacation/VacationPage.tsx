//VacationPage.tsx
import { useMemo, useState } from "react";
import Sidebar from "../../components/Sidebar";
import AppHeader from "../../layout/headers/AppHeader";        <div className="sticky top-0 z-10 flex-shrink-0"></div>
import VacationManagementSection from "../../components/sections/VacationManagementSection";
import VacationRequestModal from "../../components/ui/VacationRequestModal";

export type VacationStatus = "대기 중" | "승인 완료" | "반려";

export interface VacationRow {
  id: string;
  period: string;
  item: string;
  reason: string;
  status: VacationStatus;
  usedDays: number; // -1, -0.5
  remainDays: number; // 12, 13.5
}

export default function VacationPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // 연도 필터 / 탭 상태
  const [year, setYear] = useState("2025");
  const [tab, setTab] = useState<"사용 내역" | "지급/소멸 내역">("사용 내역");
  const [page, setPage] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);


  // 스샷과 유사한 mock
  const rows: VacationRow[] = useMemo(
    () => [
      { id: "1", period: "2025. 12. 18.(목)", item: "연차", reason: "개인 사유", status: "대기 중", usedDays: -1, remainDays: 12 },
      { id: "2", period: "2025. 12. 18.(목)", item: "오전 반차", reason: "병원 방문", status: "대기 중", usedDays: -0.5, remainDays: 13 },
      { id: "3", period: "2025. 12. 18.(목)", item: "오후 반차", reason: "개인 사유", status: "승인 완료", usedDays: -0.5, remainDays: 13.5 },
      { id: "4", period: "2025. 12. 18.(목)", item: "오후 반차", reason: "개인 사유", status: "승인 완료", usedDays: -0.5, remainDays: 14 },
      { id: "5", period: "2025. 12. 18.(목)", item: "연차", reason: "개인 사유", status: "승인 완료", usedDays: -1, remainDays: 15 },
      { id: "6", period: "2025. 12. 18.(목)", item: "연차", reason: "개인 사유", status: "승인 완료", usedDays: -1, remainDays: 16 },
      { id: "7", period: "2025. 12. 18.(목)", item: "연차", reason: "개인 사유", status: "승인 완료", usedDays: -1, remainDays: 17 },
      { id: "8", period: "2025. 12. 18.(목)", item: "연차", reason: "개인 사유", status: "승인 완료", usedDays: -1, remainDays: 18 },
      { id: "9", period: "2025. 12. 18.(목)", item: "연차", reason: "개인 사유", status: "승인 완료", usedDays: -1, remainDays: 19 },
      { id: "10", period: "2025. 12. 18.(목)", item: "연차", reason: "개인 사유", status: "승인 완료", usedDays: -1, remainDays: 20 },
    ],
    []
  );

  const grantExpireRows = useMemo(() => {
    return [
      { id: "m1", monthLabel: "2025년 1월", granted: 15, expired: -3, used: undefined, balance: 15 },
      { id: "m2", monthLabel: "2025년 2월", granted: undefined, expired: undefined, used: undefined, balance: 15 },
      { id: "m3", monthLabel: "2025년 3월", granted: undefined, expired: undefined, used: -3, balance: 12 },
      { id: "m4", monthLabel: "2025년 4월", granted: undefined, expired: undefined, used: undefined, balance: 12 },
      { id: "m5", monthLabel: "2025년 5월", granted: undefined, expired: undefined, used: undefined, balance: 12 },
      { id: "m6", monthLabel: "2025년 6월", granted: undefined, expired: undefined, used: undefined, balance: 12 },
      { id: "m7", monthLabel: "2025년 7월", granted: undefined, expired: undefined, used: undefined, balance: 12 },
      { id: "m8", monthLabel: "2025년 8월", granted: undefined, expired: undefined, used: undefined, balance: 12 },
      { id: "m9", monthLabel: "2025년 9월", granted: undefined, expired: undefined, used: undefined, balance: 12 },
      { id: "m10", monthLabel: "2025년 10월", granted: undefined, expired: undefined, used: undefined, balance: 12 },
    ];
  }, []);


  // 간단 페이징(1페이지 10개 고정으로 mock)
  const totalPages = 3;

  // 카드 요약(스샷 숫자 형태)
  const summary = useMemo(() => {
    return {
      myAnnual: 11,
      granted: 20,
      used: 3,
      expired: 3,
    };
  }, []);

  const handleRegister = () => {
    setModalOpen(true);
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

      {/* Sidebar */}
      <div
        className={`
          fixed lg:static inset-y-0 left-0 z-30
          w-[239px] h-screen flex-shrink-0
          transform transition-transform duration-300 ease-in-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden w-full">
        {/* Header */}
        <div className="sticky top-0 z-10 flex-shrink-0">
          <AppHeader
            title="휴가 관리"
            onMenuClick={() => setSidebarOpen(true)}
            actions={
              <button
                onClick={handleRegister}
                className="h-9 px-3 rounded-lg bg-[#364153] text-white text-[13px] font-medium hover:opacity-90 transition inline-flex items-center gap-2"
              >
                <span className="text-[18px] leading-none">+</span>
                휴가등록
              </button>
            }
          />
        </div>


        {/* Content */}
         <div className="flex-1 overflow-y-auto px-6 md:px-8 lg:px-10 py-6 md:py-9">
           <div className="max-w-[1200px] mx-auto flex flex-col gap-4 md:gap-6">
            <VacationManagementSection
              summary={summary}
              year={year}
              onYearChange={setYear}
              tab={tab}
              onTabChange={setTab}
              rows={rows}
              grantExpireRows={grantExpireRows}
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
            />

            <VacationRequestModal
              isOpen={modalOpen}
              onClose={() => setModalOpen(false)}
              availableDays={summary.myAnnual} // 지금은 11일, 원하면 12로
              onSubmit={(payload) => {
                console.log("휴가 신청 payload:", payload);
                alert("휴가 신청이 추가되었습니다. (콘솔 확인)");
                // TODO: 여기서 API 호출 or store 업데이트
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
