import { useState } from "react";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/common/Header";

export default function InvoiceCreatePage() {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const handleMenuClick = () => {
        setSidebarOpen(!sidebarOpen);
    };

    const handleSidebarClose = () => {
        setSidebarOpen(false);
    };

    return (
        <div className="flex h-screen bg-white overflow-hidden font-pretendard">
            {/* Overlay - 사이드바가 열려있을 때만 표시 */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40"
                    onClick={handleSidebarClose}
                />
            )}

            {/* Sidebar - 접기/펼치기 가능 (데스크탑에서도 접기 가능) */}
            <div
                className={`
                    fixed inset-y-0 left-0 z-50
                    w-[260px] max-w-[88vw] lg:max-w-none lg:w-[239px] h-screen shrink-0
                    transform transition-transform duration-300 ease-in-out
                    ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
                `}
                onClick={(e) => e.stopPropagation()}
            >
                <Sidebar onClose={handleSidebarClose} showCloseOnDesktop={true} />
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <Header
                    title="인보이스 생성"
                    onMenuClick={handleMenuClick}
                    showMenuOnDesktop={true}
                />
                
                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
                    <div className="max-w-full mx-auto">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* 좌측: R&D TIMESHEET 및 JOB DESCRIPTION 섹션 */}
                            <div className="flex flex-col gap-6">
                                {/* R&D TIMESHEET 섹션 */}
                                <div className="flex flex-col gap-6 bg-white border border-gray-200 rounded-xl p-6">
                                    {/* R&D TIMESHEET 제목 - 크고 굵게 */}
                                    <h2 className="text-3xl font-bold text-black mb-2">R&D TIMESHEET</h2>
                                
                                {/* Job Information Table */}
                                <div className="flex flex-col gap-4 mb-6">
                                    <div className="border border-gray-300 rounded overflow-hidden">
                                        <table className="w-full text-sm border-collapse">
                                            <thead className="bg-gray-100">
                                                <tr>
                                                    <th className="px-4 py-3 text-left font-semibold text-gray-900 border-b border-gray-300">SHIP NAME</th>
                                                    <th className="px-4 py-3 text-left font-semibold text-gray-900 border-b border-l border-gray-300">WORK PLACE</th>
                                                    <th className="px-4 py-3 text-left font-semibold text-gray-900 border-b border-l border-gray-300">Work order from</th>
                                                    <th className="px-4 py-3 text-left font-semibold text-gray-900 border-b border-l border-gray-300">P O No.</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr>
                                                    <td className="px-4 py-2 text-gray-900 border-b border-gray-300">SH8222</td>
                                                    <td className="px-4 py-2 text-gray-900 border-b border-l border-gray-300">HHI</td>
                                                    <td className="px-4 py-2 text-gray-900 border-b border-l border-gray-300">Everlience ELU KOREA</td>
                                                    <td className="px-4 py-2 text-gray-900 border-b border-l border-gray-300"></td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                                
                                {/* Hours Logging Table */}
                                <div className="flex flex-col gap-4">
                                    <div className="border border-gray-300 rounded overflow-hidden">
                                        <table className="w-full table-fixed text-[11px] min-w-full border-collapse">
                                            <colgroup>
                                                <col className="w-[56px]" />
                                                <col className="w-[68px]" />
                                                <col className="w-[52px]" />
                                                <col className="w-[52px]" />
                                                <col className="w-[56px]" />
                                                <col className="w-[74px]" />
                                                <col className="w-[74px]" />
                                                <col className="w-[74px]" />
                                                <col className="w-[82px]" />
                                                <col className="w-[66px]" />
                                                <col className="w-[76px]" />
                                                <col className="w-[58px]" />
                                            </colgroup>
                                            <thead className="bg-gray-100">
                                                {/* 1행: Indication of date & time / Total Hours / Split of Hours / Mark Sea-going */}
                                                <tr>
                                                    <th colSpan={4} className="px-1 py-2 text-center font-semibold text-gray-900 border-b border-r border-gray-300">
                                                        Indication of date &amp; time
                                                    </th>
                                                    <th rowSpan={3} className="px-1 py-2 text-center font-semibold text-gray-900 border-b border-r border-gray-300 leading-tight">
                                                        Total
                                                        <br />
                                                        Hours
                                                    </th>
                                                    <th colSpan={6} className="px-1 py-2 text-center font-semibold text-gray-900 border-b border-r border-gray-300">
                                                        Split of Hours
                                                    </th>
                                                    <th rowSpan={3} className="px-1 py-2 text-center font-semibold text-gray-900 border-b border-gray-300 leading-tight">
                                                        Mark Sea-going<br />Vessel (x)
                                                    </th>
                                                </tr>
                                                {/* 2행: Year/Day/Date/Time From/Time To + 상위 그룹 헤더 */}
                                                <tr>
                                                    <th className="px-1 py-2 text-center font-medium text-gray-700 border-b border-r border-gray-300">
                                                        Year
                                                    </th>
                                                    <th className="px-1 py-2 text-center font-medium text-gray-900 bg-white border-b border-r border-gray-300">
                                                        2026
                                                    </th>
                                                    <th rowSpan={2} className="px-1 py-2 text-center font-medium text-gray-700 border-b border-r border-gray-300 leading-tight">
                                                        Time
                                                        <br />
                                                        From
                                                    </th>
                                                    <th rowSpan={2} className="px-1 py-2 text-center font-medium text-gray-700 border-b border-r border-gray-300 leading-tight">
                                                        Time
                                                        <br />
                                                        To
                                                    </th>
                                                    <th colSpan={2} className="px-1 py-1 text-center font-medium text-gray-700 border-b border-r border-gray-300 leading-tight">
                                                        Weekdays
                                                        <br />
                                                        (with in normal working
                                                        <br />
                                                        hours,
                                                        <br />
                                                        08:00 to 17:00)
                                                    </th>
                                                    <th colSpan={2} className="px-1 py-1 text-center font-medium text-gray-700 border-b border-r border-gray-300 leading-tight">
                                                        Saturday, Sunday, and
                                                        <br />
                                                        local holidays
                                                    </th>
                                                    <th colSpan={2} className="px-1 py-1 text-center font-medium text-gray-700 border-b border-r border-gray-300 leading-tight">
                                                        Travel
                                                        <br />
                                                        Hours**
                                                    </th>
                                                </tr>
                                                {/* 3행: Day/Date 하위 헤더 + Split of Hours 하위 라벨 */}
                                                <tr>
                                                    <th className="px-1 py-1 text-center font-medium text-gray-700 border-b border-r border-gray-300">
                                                        Day
                                                    </th>
                                                    <th className="px-1 py-1 text-center font-medium text-gray-700 border-b border-r border-gray-300">
                                                        Date
                                                    </th>
                                                    <th className="px-1 py-1 text-center font-medium text-gray-700 border-b border-r border-gray-300 leading-tight">
                                                        Normal
                                                        <br />
                                                        Working
                                                    </th>
                                                    <th className="px-1 py-1 text-center font-medium text-gray-700 border-b border-r border-gray-300 leading-tight">
                                                        After Normal
                                                        <br />
                                                        Working
                                                    </th>
                                                    <th className="px-1 py-1 text-center font-medium text-gray-700 border-b border-r border-gray-300 leading-tight">
                                                        Normal
                                                        <br />
                                                        Working
                                                    </th>
                                                    <th className="px-1 py-1 text-center font-medium text-gray-700 border-b border-r border-gray-300 leading-tight">
                                                        After Normal
                                                        <br />
                                                        Working
                                                    </th>
                                                    <th className="px-1 py-1 text-center font-medium text-gray-700 border-b border-r border-gray-300">
                                                        Weekday
                                                    </th>
                                                    <th className="px-1 py-1 text-center font-medium text-gray-700 border-b border-r border-gray-300 leading-tight">
                                                        Weekend
                                                        <br />
                                                        / Holiday
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {/* Row 1: Fri, 02.Jan */}
                                                <tr className="border-b border-gray-300">
                                                    <td rowSpan={2} className="px-2 py-2 text-center border-r border-gray-300">Fri</td>
                                                    <td rowSpan={2} className="px-2 py-2 text-center border-r border-gray-300">02.Jan</td>
                                                    <td rowSpan={2} className="px-2 py-2 text-center border-r border-gray-300">06</td>
                                                    <td rowSpan={2} className="px-2 py-2 text-center border-r border-gray-300">19</td>
                                                    <td rowSpan={2} className="px-2 py-2 text-center border-r border-gray-300 font-bold">12</td>
                                                    <td className="px-2 py-2 text-center border-r border-gray-300">8</td>
                                                    <td className="px-2 py-2 text-center border-r border-gray-300"></td>
                                                    <td className="px-2 py-2 text-center border-r border-gray-300"></td>
                                                    <td className="px-2 py-2 text-center border-r border-gray-300"></td>
                                                    <td className="px-2 py-2 text-center border-r border-gray-300">4</td>
                                                    <td className="px-2 py-2 text-center border-r border-gray-300"></td>
                                                    <td className="px-2 py-2 text-center"></td>
                                                </tr>
                                                <tr className="border-b border-gray-300">
                                                    <td colSpan={7} className="px-2 py-1 text-left text-xs text-gray-600">KT On / skilled fitter and 2 fitters</td>
                                                </tr>
                                                {/* Row 2: Sat, 03.Jan */}
                                                <tr className="border-b border-gray-300">
                                                    <td rowSpan={2} className="px-2 py-2 text-center border-r border-gray-300">Sat</td>
                                                    <td rowSpan={2} className="px-2 py-2 text-center border-r border-gray-300">03.Jan</td>
                                                    <td rowSpan={2} className="px-2 py-2 text-center border-r border-gray-300">13</td>
                                                    <td rowSpan={2} className="px-2 py-2 text-center border-r border-gray-300">24</td>
                                                    <td rowSpan={2} className="px-2 py-2 text-center border-r border-gray-300 font-bold">11</td>
                                                    <td className="px-2 py-2 text-center border-r border-gray-300"></td>
                                                    <td className="px-2 py-2 text-center border-r border-gray-300"></td>
                                                    <td className="px-2 py-2 text-center border-r border-gray-300">2</td>
                                                    <td className="px-2 py-2 text-center border-r border-gray-300">7</td>
                                                    <td className="px-2 py-2 text-center border-r border-gray-300"></td>
                                                    <td className="px-2 py-2 text-center border-r border-gray-300">2</td>
                                                    <td className="px-2 py-2 text-center"></td>
                                                </tr>
                                                <tr className="border-b border-gray-300">
                                                    <td colSpan={7} className="px-2 py-1 text-left text-xs text-gray-600">KT On / skilled fitter and 5 fitters</td>
                                                </tr>
                                                {/* Row 3: Sun, 04.Jan */}
                                                <tr className="border-b border-gray-300">
                                                    <td rowSpan={2} className="px-2 py-2 text-center border-r border-gray-300">Sun</td>
                                                    <td rowSpan={2} className="px-2 py-2 text-center border-r border-gray-300">04.Jan</td>
                                                    <td rowSpan={2} className="px-2 py-2 text-center border-r border-gray-300">00</td>
                                                    <td rowSpan={2} className="px-2 py-2 text-center border-r border-gray-300">03</td>
                                                    <td rowSpan={2} className="px-2 py-2 text-center border-r border-gray-300 font-bold">3</td>
                                                    <td className="px-2 py-2 text-center border-r border-gray-300"></td>
                                                    <td className="px-2 py-2 text-center border-r border-gray-300"></td>
                                                    <td className="px-2 py-2 text-center border-r border-gray-300"></td>
                                                    <td className="px-2 py-2 text-center border-r border-gray-300">1</td>
                                                    <td className="px-2 py-2 text-center border-r border-gray-300"></td>
                                                    <td className="px-2 py-2 text-center border-r border-gray-300">2</td>
                                                    <td className="px-2 py-2 text-center"></td>
                                                </tr>
                                                <tr className="border-b border-gray-300">
                                                    <td colSpan={7} className="px-2 py-1 text-left text-xs text-gray-600">KT On / skilled fitter and 5 fitters</td>
                                                </tr>
                                                {/* Row 4: Tue, 06.Jan */}
                                                <tr className="border-b border-gray-300">
                                                    <td rowSpan={2} className="px-2 py-2 text-center border-r border-gray-300">Tue</td>
                                                    <td rowSpan={2} className="px-2 py-2 text-center border-r border-gray-300">06.Jan</td>
                                                    <td rowSpan={2} className="px-2 py-2 text-center border-r border-gray-300">06</td>
                                                    <td rowSpan={2} className="px-2 py-2 text-center border-r border-gray-300">19</td>
                                                    <td rowSpan={2} className="px-2 py-2 text-center border-r border-gray-300 font-bold">12</td>
                                                    <td className="px-2 py-2 text-center border-r border-gray-300">8</td>
                                                    <td className="px-2 py-2 text-center border-r border-gray-300"></td>
                                                    <td className="px-2 py-2 text-center border-r border-gray-300"></td>
                                                    <td className="px-2 py-2 text-center border-r border-gray-300"></td>
                                                    <td className="px-2 py-2 text-center border-r border-gray-300">4</td>
                                                    <td className="px-2 py-2 text-center border-r border-gray-300"></td>
                                                    <td className="px-2 py-2 text-center"></td>
                                                </tr>
                                                <tr className="border-b border-gray-300">
                                                    <td colSpan={7} className="px-2 py-1 text-left text-xs text-gray-600">KT On / skilled fitter and 2 fitters</td>
                                                </tr>
                                                {/* Row 5: Mon, 12.Jan */}
                                                <tr className="border-b border-gray-300">
                                                    <td rowSpan={2} className="px-2 py-2 text-center border-r border-gray-300">Mon</td>
                                                    <td rowSpan={2} className="px-2 py-2 text-center border-r border-gray-300">12.Jan</td>
                                                    <td rowSpan={2} className="px-2 py-2 text-center border-r border-gray-300">06</td>
                                                    <td rowSpan={2} className="px-2 py-2 text-center border-r border-gray-300">13</td>
                                                    <td rowSpan={2} className="px-2 py-2 text-center border-r border-gray-300 font-bold">7</td>
                                                    <td className="px-2 py-2 text-center border-r border-gray-300">3</td>
                                                    <td className="px-2 py-2 text-center border-r border-gray-300"></td>
                                                    <td className="px-2 py-2 text-center border-r border-gray-300"></td>
                                                    <td className="px-2 py-2 text-center border-r border-gray-300"></td>
                                                    <td className="px-2 py-2 text-center border-r border-gray-300">4</td>
                                                    <td className="px-2 py-2 text-center border-r border-gray-300"></td>
                                                    <td className="px-2 py-2 text-center"></td>
                                                </tr>
                                                <tr className="border-b border-gray-300">
                                                    <td colSpan={7} className="px-2 py-1 text-left text-xs text-gray-600">KT On / skilled fitter and 1 fitter</td>
                                                </tr>
                                                {/* Row 6: Sat, 17.Jan */}
                                                <tr className="border-b border-gray-300">
                                                    <td rowSpan={2} className="px-2 py-2 text-center border-r border-gray-300">Sat</td>
                                                    <td rowSpan={2} className="px-2 py-2 text-center border-r border-gray-300">17.Jan</td>
                                                    <td rowSpan={2} className="px-2 py-2 text-center border-r border-gray-300">06</td>
                                                    <td rowSpan={2} className="px-2 py-2 text-center border-r border-gray-300">16</td>
                                                    <td rowSpan={2} className="px-2 py-2 text-center border-r border-gray-300 font-bold">10</td>
                                                    <td className="px-2 py-2 text-center border-r border-gray-300"></td>
                                                    <td className="px-2 py-2 text-center border-r border-gray-300"></td>
                                                    <td className="px-2 py-2 text-center border-r border-gray-300">6</td>
                                                    <td className="px-2 py-2 text-center border-r border-gray-300"></td>
                                                    <td className="px-2 py-2 text-center border-r border-gray-300"></td>
                                                    <td className="px-2 py-2 text-center border-r border-gray-300">4</td>
                                                    <td className="px-2 py-2 text-center"></td>
                                                </tr>
                                                <tr className="border-b border-gray-300">
                                                    <td colSpan={7} className="px-2 py-1 text-left text-xs text-gray-600">KT On / skilled fitter and 2 fitters</td>
                                                </tr>
                                                {/* Row 7: Tue, 27.Jan */}
                                                <tr className="border-b border-gray-300">
                                                    <td rowSpan={2} className="px-2 py-2 text-center border-r border-gray-300">Tue</td>
                                                    <td rowSpan={2} className="px-2 py-2 text-center border-r border-gray-300">27.Jan</td>
                                                    <td rowSpan={2} className="px-2 py-2 text-center border-r border-gray-300">06</td>
                                                    <td rowSpan={2} className="px-2 py-2 text-center border-r border-gray-300">15</td>
                                                    <td rowSpan={2} className="px-2 py-2 text-center border-r border-gray-300 font-bold">9</td>
                                                    <td className="px-2 py-2 text-center border-r border-gray-300">2</td>
                                                    <td className="px-2 py-2 text-center border-r border-gray-300">4</td>
                                                    <td className="px-2 py-2 text-center border-r border-gray-300"></td>
                                                    <td className="px-2 py-2 text-center border-r border-gray-300"></td>
                                                    <td className="px-2 py-2 text-center border-r border-gray-300">3</td>
                                                    <td className="px-2 py-2 text-center border-r border-gray-300"></td>
                                                    <td className="px-2 py-2 text-center"></td>
                                                </tr>
                                                <tr className="border-b border-gray-300">
                                                    <td colSpan={7} className="px-2 py-1 text-left text-xs text-gray-600">JH Ahn / skilled fitter and 4 fitters</td>
                                                </tr>
                                                {/* Row 8: Wed, 28.Jan */}
                                                <tr className="border-b border-gray-300">
                                                    <td rowSpan={2} className="px-2 py-2 text-center border-r border-gray-300">Wed</td>
                                                    <td rowSpan={2} className="px-2 py-2 text-center border-r border-gray-300">28.Jan</td>
                                                    <td rowSpan={2} className="px-2 py-2 text-center border-r border-gray-300">06</td>
                                                    <td rowSpan={2} className="px-2 py-2 text-center border-r border-gray-300">13</td>
                                                    <td rowSpan={2} className="px-2 py-2 text-center border-r border-gray-300 font-bold">7</td>
                                                    <td className="px-2 py-2 text-center border-r border-gray-300">4</td>
                                                    <td className="px-2 py-2 text-center border-r border-gray-300"></td>
                                                    <td className="px-2 py-2 text-center border-r border-gray-300"></td>
                                                    <td className="px-2 py-2 text-center border-r border-gray-300"></td>
                                                    <td className="px-2 py-2 text-center border-r border-gray-300">3</td>
                                                    <td className="px-2 py-2 text-center border-r border-gray-300"></td>
                                                    <td className="px-2 py-2 text-center"></td>
                                                </tr>
                                                <tr className="border-b border-gray-300">
                                                    <td colSpan={7} className="px-2 py-1 text-left text-xs text-gray-600">JH Ahn / skilled fitter and 4 fitters</td>
                                                </tr>
                                                {/* Row 9: Fri, 30.Jan */}
                                                <tr className="border-b border-gray-300">
                                                    <td rowSpan={2} className="px-2 py-2 text-center border-r border-gray-300">Fri</td>
                                                    <td rowSpan={2} className="px-2 py-2 text-center border-r border-gray-300">30.Jan</td>
                                                    <td rowSpan={2} className="px-2 py-2 text-center border-r border-gray-300">06</td>
                                                    <td rowSpan={2} className="px-2 py-2 text-center border-r border-gray-300">16</td>
                                                    <td rowSpan={2} className="px-2 py-2 text-center border-r border-gray-300 font-bold">10</td>
                                                    <td className="px-2 py-2 text-center border-r border-gray-300">6</td>
                                                    <td className="px-2 py-2 text-center border-r border-gray-300"></td>
                                                    <td className="px-2 py-2 text-center border-r border-gray-300"></td>
                                                    <td className="px-2 py-2 text-center border-r border-gray-300"></td>
                                                    <td className="px-2 py-2 text-center border-r border-gray-300">4</td>
                                                    <td className="px-2 py-2 text-center border-r border-gray-300"></td>
                                                    <td className="px-2 py-2 text-center"></td>
                                                </tr>
                                                <tr className="border-b border-gray-300">
                                                    <td colSpan={7} className="px-2 py-1 text-left text-xs text-gray-600">JH Ahn / skilled fitter and 3 fitters</td>
                                                </tr>
                                                {/* Total Row */}
                                                <tr className="bg-gray-100 font-semibold">
                                                    <td colSpan={4} className="px-2 py-2 text-center border-r border-gray-300">Total</td>
                                                    <td className="px-2 py-2 text-center border-r border-gray-300 font-bold">81</td>
                                                    <td className="px-2 py-2 text-center border-r border-gray-300 font-bold">31</td>
                                                    <td className="px-2 py-2 text-center border-r border-gray-300 font-bold">4</td>
                                                    <td className="px-2 py-2 text-center border-r border-gray-300 font-bold">8</td>
                                                    <td className="px-2 py-2 text-center border-r border-gray-300 font-bold">8</td>
                                                    <td className="px-2 py-2 text-center border-r border-gray-300 font-bold">22</td>
                                                    <td className="px-2 py-2 text-center border-r border-gray-300 font-bold">8</td>
                                                    <td className="px-2 py-2 text-center font-bold">0</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                                </div>

                                {/* JOB DESCRIPTION 섹션 */}
                                <div className="flex flex-col gap-4 bg-white border border-gray-200 rounded-xl p-6">
                                    <h2 className="text-3xl font-bold text-black mb-2">JOB DESCRIPTION</h2>
                                    <div className="grid grid-cols-4 gap-4">
                                        {/* Row 1 - Card 1: SHIP NAME */}
                                        <div className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col">
                                            <div className="text-xs font-semibold text-gray-700 mb-2">SHIP NAME</div>
                                            <div className="text-sm text-gray-900">SH8300</div>
                                        </div>
                                        {/* Row 1 - Card 2: Engineer Name and Title */}
                                        <div className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col">
                                            <div className="text-xs font-semibold text-gray-700 mb-2">Engineer Name and Title</div>
                                            <div className="text-sm text-gray-900">KT On / Skilled fitter</div>
                                        </div>
                                        {/* Row 1 - Card 3: Work Order From */}
                                        <div className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col">
                                            <div className="text-xs font-semibold text-gray-700 mb-2">Work Order From</div>
                                            <div className="text-sm text-gray-900">Everllence ELU KOREA</div>
                                        </div>
                                        {/* Row 1 - Card 4: Departure date & time, from place */}
                                        <div className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col">
                                            <div className="text-xs font-semibold text-gray-700 mb-2">Departure date & time, from place</div>
                                            <div className="text-sm text-gray-900">04.Feb.2026, 06:00 from Busan</div>
                                        </div>
                                        {/* Row 2 - Card 5: WORK PLACE */}
                                        <div className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col">
                                            <div className="text-xs font-semibold text-gray-700 mb-2">WORK PLACE</div>
                                            <div className="text-sm text-gray-900">HHI</div>
                                        </div>
                                        {/* Row 2 - Card 6: Mechanic names and numbers */}
                                        <div className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col">
                                            <div className="text-xs font-semibold text-gray-700 mb-2">Mechanic names and numbers</div>
                                            <div className="text-sm text-gray-900">DM Kim and 1 fitter (Total 2 fitters)</div>
                                        </div>
                                        {/* Row 2 - Card 7: P.O No. */}
                                        <div className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col">
                                            <div className="text-xs font-semibold text-gray-700 mb-2">P.O No.</div>
                                            <div className="text-sm text-gray-900"></div>
                                        </div>
                                        {/* Row 2 - Card 8: Return date & time, to place */}
                                        <div className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col">
                                            <div className="text-xs font-semibold text-gray-700 mb-2">Return date & time, to place</div>
                                            <div className="text-sm text-gray-900">04.Feb.2026, 19:00 to Busan</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 우측: INVOICE 및 NORMAL TIMESHEET 섹션 */}
                            <div className="flex flex-col gap-6">
                                {/* INVOICE 섹션 */}
                                <div className="flex flex-col gap-6 bg-white border border-gray-200 rounded-xl p-6">
                                    {/* INVOICE 제목 - 크고 굵게 */}
                                    <h2 className="text-3xl font-bold text-black mb-2">INVOICE</h2>
                                    
                                    {/* Top Information Sections - 3 columns */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        {/* Invoice to (Left Column) */}
                                        <div className="flex flex-col gap-3">
                                            <h3 className="text-sm font-semibold text-gray-900">Invoice to</h3>
                                            <div className="text-sm text-gray-900">Everllence</div>
                                            <div className="text-sm text-gray-900">2-Stroke Business, Operation / Engineering</div>
                                            <div className="text-sm text-gray-900">Teglholmsgade 41</div>
                                            <div className="text-sm text-gray-900">2450 Copenhagen SV, Denmark</div>
                                        </div>

                                        {/* Job Information (Middle Column) */}
                                        <div className="flex flex-col gap-3">
                                            <h3 className="text-sm font-semibold text-gray-900">Job information</h3>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm text-gray-700">Hull no.</span>
                                                <span className="text-sm text-gray-900">SH8300</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm text-gray-700">Engine type:</span>
                                                <span className="text-sm text-gray-900">7G95ME-GI</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm text-gray-700">Work Period & Place:</span>
                                                <span className="text-sm text-gray-900">04.Feb.2026 at HHI</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm text-gray-700">Work Item:</span>
                                                <span className="text-sm text-gray-900">Replacement of PIV Atomizer</span>
                                            </div>
                                        </div>

                                        {/* Invoice Numbers & Dates (Right Column) */}
                                        <div className="flex flex-col gap-3">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm text-gray-700">P.O No:</span>
                                                <span className="text-sm text-gray-900"></span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm text-gray-700">INVOICE No:</span>
                                                <span className="text-sm text-gray-900">R12602061</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm text-gray-700">Date:</span>
                                                <span className="text-sm text-gray-900">10.Feb.2026</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm text-gray-700">Validity:</span>
                                                <span className="text-sm text-gray-900">14 days</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm text-gray-700">Currency unit:</span>
                                                <span className="text-sm text-gray-900">EUR</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Line Items Table */}
                                    <div className="flex flex-col gap-4 mt-4">
                                        <div className="border border-gray-300 rounded overflow-hidden">
                                            <table className="w-full text-sm border-collapse">
                                                <thead className="bg-gray-100">
                                                    <tr>
                                                        <th className="px-4 py-3 text-left font-semibold text-gray-900 border-b border-gray-300">Description</th>
                                                        <th className="px-4 py-3 text-center font-semibold text-gray-900 border-b border-gray-300 border-l border-gray-300 w-20">Q'ty</th>
                                                        <th className="px-4 py-3 text-center font-semibold text-gray-900 border-b border-gray-300 border-l border-gray-300 w-24">Unit</th>
                                                        <th className="px-4 py-3 text-right font-semibold text-gray-900 border-b border-gray-300 border-l border-gray-300 w-32">Unit price</th>
                                                        <th className="px-4 py-3 text-right font-semibold text-gray-900 border-b border-gray-300 border-l border-gray-300 w-32">Total</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {/* 1. MANPOWER */}
                                                    <tr>
                                                        <td className="px-4 py-2 text-gray-900 font-semibold border-b border-gray-300">1. MANPOWER</td>
                                                        <td className="px-4 py-2 text-center border-b border-gray-300 border-l border-gray-300"></td>
                                                        <td className="px-4 py-2 text-center border-b border-gray-300 border-l border-gray-300"></td>
                                                        <td className="px-4 py-2 text-right border-b border-gray-300 border-l border-gray-300"></td>
                                                        <td className="px-4 py-2 text-right border-b border-gray-300 border-l border-gray-300"></td>
                                                    </tr>
                                                    {/* 1.1 Skilled Fitter (KT On) */}
                                                    <tr>
                                                        <td className="px-4 py-2 text-gray-900 pl-8 border-b border-gray-300">1.1 Skilled Fitter (KT On)</td>
                                                        <td className="px-4 py-2 text-center border-b border-gray-300 border-l border-gray-300">1</td>
                                                        <td className="px-4 py-2 text-center border-b border-gray-300 border-l border-gray-300">MAN</td>
                                                        <td className="px-4 py-2 text-right border-b border-gray-300 border-l border-gray-300"></td>
                                                        <td className="px-4 py-2 text-right border-b border-gray-300 border-l border-gray-300"></td>
                                                    </tr>
                                                    {/* : Weekday/ Normal Working Hours */}
                                                    <tr>
                                                        <td className="px-4 py-2 text-gray-900 pl-12 border-b border-gray-300">: Weekday/ Normal Working Hours</td>
                                                        <td className="px-4 py-2 text-center border-b border-gray-300 border-l border-gray-300">8</td>
                                                        <td className="px-4 py-2 text-center border-b border-gray-300 border-l border-gray-300">hours</td>
                                                        <td className="px-4 py-2 text-right border-b border-gray-300 border-l border-gray-300">55,200</td>
                                                        <td className="px-4 py-2 text-right border-b border-gray-300 border-l border-gray-300">441,600</td>
                                                    </tr>
                                                    {/* : Weekday/ Waiting & Travel Hours */}
                                                    <tr>
                                                        <td className="px-4 py-2 text-gray-900 pl-12 border-b border-gray-300">: Weekday/ Waiting & Travel Hours</td>
                                                        <td className="px-4 py-2 text-center border-b border-gray-300 border-l border-gray-300">4</td>
                                                        <td className="px-4 py-2 text-center border-b border-gray-300 border-l border-gray-300">hours</td>
                                                        <td className="px-4 py-2 text-right border-b border-gray-300 border-l border-gray-300">39,100</td>
                                                        <td className="px-4 py-2 text-right border-b border-gray-300 border-l border-gray-300">156,400</td>
                                                    </tr>
                                                    {/* 1.2 Fitters (DM Kim, JH Lee) */}
                                                    <tr>
                                                        <td className="px-4 py-2 text-gray-900 pl-8 border-b border-gray-300">1.2 Fitters (DM Kim, JH Lee)</td>
                                                        <td className="px-4 py-2 text-center border-b border-gray-300 border-l border-gray-300">2</td>
                                                        <td className="px-4 py-2 text-center border-b border-gray-300 border-l border-gray-300">MEN</td>
                                                        <td className="px-4 py-2 text-right border-b border-gray-300 border-l border-gray-300"></td>
                                                        <td className="px-4 py-2 text-right border-b border-gray-300 border-l border-gray-300"></td>
                                                    </tr>
                                                    {/* : Weekday/ Normal Working Hours */}
                                                    <tr>
                                                        <td className="px-4 py-2 text-gray-900 pl-12 border-b border-gray-300">: Weekday/ Normal Working Hours</td>
                                                        <td className="px-4 py-2 text-center border-b border-gray-300 border-l border-gray-300">16</td>
                                                        <td className="px-4 py-2 text-center border-b border-gray-300 border-l border-gray-300">hours</td>
                                                        <td className="px-4 py-2 text-right border-b border-gray-300 border-l border-gray-300">42,600</td>
                                                        <td className="px-4 py-2 text-right border-b border-gray-300 border-l border-gray-300">681,600</td>
                                                    </tr>
                                                    {/* : Weekday/ Waiting & Travel Hours */}
                                                    <tr>
                                                        <td className="px-4 py-2 text-gray-900 pl-12 border-b border-gray-300">: Weekday/ Waiting & Travel Hours</td>
                                                        <td className="px-4 py-2 text-center border-b border-gray-300 border-l border-gray-300">8</td>
                                                        <td className="px-4 py-2 text-center border-b border-gray-300 border-l border-gray-300">hours</td>
                                                        <td className="px-4 py-2 text-right border-b border-gray-300 border-l border-gray-300">31,100</td>
                                                        <td className="px-4 py-2 text-right border-b border-gray-300 border-l border-gray-300">248,800</td>
                                                    </tr>
                                                    {/* 2. Daily Allowance */}
                                                    <tr>
                                                        <td className="px-4 py-2 text-gray-900 font-semibold border-b border-gray-300">2. Daily Allowance</td>
                                                        <td className="px-4 py-2 text-center border-b border-gray-300 border-l border-gray-300"></td>
                                                        <td className="px-4 py-2 text-center border-b border-gray-300 border-l border-gray-300"></td>
                                                        <td className="px-4 py-2 text-right border-b border-gray-300 border-l border-gray-300"></td>
                                                        <td className="px-4 py-2 text-right border-b border-gray-300 border-l border-gray-300"></td>
                                                    </tr>
                                                    {/* : 1 Skilled fitter and 2 fitters */}
                                                    <tr>
                                                        <td className="px-4 py-2 text-gray-900 pl-8 border-b border-gray-300">: 1 Skilled fitter and 2 fitters</td>
                                                        <td className="px-4 py-2 text-center border-b border-gray-300 border-l border-gray-300">9</td>
                                                        <td className="px-4 py-2 text-center border-b border-gray-300 border-l border-gray-300">Meals</td>
                                                        <td className="px-4 py-2 text-right border-b border-gray-300 border-l border-gray-300">15,000</td>
                                                        <td className="px-4 py-2 text-right border-b border-gray-300 border-l border-gray-300">135,000</td>
                                                    </tr>
                                                    {/* 3. Transportation (KRW 500/km) */}
                                                    <tr>
                                                        <td className="px-4 py-2 text-gray-900 font-semibold border-b border-gray-300">3. Transportation (KRW 500/km)</td>
                                                        <td className="px-4 py-2 text-center border-b border-gray-300 border-l border-gray-300"></td>
                                                        <td className="px-4 py-2 text-center border-b border-gray-300 border-l border-gray-300"></td>
                                                        <td className="px-4 py-2 text-right border-b border-gray-300 border-l border-gray-300"></td>
                                                        <td className="px-4 py-2 text-right border-b border-gray-300 border-l border-gray-300"></td>
                                                    </tr>
                                                    {/* : 1 (Round) x 200km x 1car: 200km */}
                                                    <tr>
                                                        <td className="px-4 py-2 text-gray-900 pl-8 border-b border-gray-300">: 1 (Round) x 200km x 1car: 200km</td>
                                                        <td className="px-4 py-2 text-center border-b border-gray-300 border-l border-gray-300">200</td>
                                                        <td className="px-4 py-2 text-center border-b border-gray-300 border-l border-gray-300">Km</td>
                                                        <td className="px-4 py-2 text-right border-b border-gray-300 border-l border-gray-300">500</td>
                                                        <td className="px-4 py-2 text-right border-b border-gray-300 border-l border-gray-300">100,000</td>
                                                    </tr>
                                                    {/* * Mileage: RTB to HHI(Round): 200km */}
                                                    <tr>
                                                        <td className="px-4 py-2 text-gray-900 pl-8 border-b border-gray-300 italic">* Mileage: RTB to HHI(Round): 200km</td>
                                                        <td className="px-4 py-2 text-center border-b border-gray-300 border-l border-gray-300"></td>
                                                        <td className="px-4 py-2 text-center border-b border-gray-300 border-l border-gray-300"></td>
                                                        <td className="px-4 py-2 text-right border-b border-gray-300 border-l border-gray-300"></td>
                                                        <td className="px-4 py-2 text-right border-b border-gray-300 border-l border-gray-300"></td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>

                                {/* NORMAL TIMESHEET 섹션 */}
                                <div className="flex flex-col gap-6 bg-white border border-gray-200 rounded-xl p-6">
                                    {/* NORMAL TIMESHEET 제목 - 크고 굵게 */}
                                    <h2 className="text-3xl font-bold text-black mb-2">NORMAL TIMESHEET</h2>
                                    
                                    {/* Hours Logging Table */}
                                    <div className="flex flex-col gap-4">
                                        <div className="border border-gray-300 rounded overflow-hidden">
                                            <table className="w-full table-fixed text-[11px] min-w-full border-collapse">
                                                <colgroup>
                                                    <col className="w-[56px]" />
                                                    <col className="w-[68px]" />
                                                    <col className="w-[52px]" />
                                                    <col className="w-[52px]" />
                                                    <col className="w-[56px]" />
                                                    <col className="w-[74px]" />
                                                    <col className="w-[74px]" />
                                                    <col className="w-[74px]" />
                                                    <col className="w-[82px]" />
                                                    <col className="w-[66px]" />
                                                    <col className="w-[76px]" />
                                                    <col className="w-[58px]" />
                                                </colgroup>
                                                <thead className="bg-gray-100">
                                                    {/* 1행: Indication of date & time / Total Hours / Split of Hours / Mark Sea-going */}
                                                    <tr>
                                                        <th colSpan={4} className="px-1 py-2 text-center font-semibold text-gray-900 border-b border-r border-gray-300">
                                                            Indication of date &amp; time
                                                        </th>
                                                        <th rowSpan={3} className="px-1 py-2 text-center font-semibold text-gray-900 border-b border-r border-gray-300 leading-tight">
                                                            Total
                                                            <br />
                                                            Hours
                                                        </th>
                                                        <th colSpan={6} className="px-1 py-2 text-center font-semibold text-gray-900 border-b border-r border-gray-300">
                                                            Split of Hours
                                                        </th>
                                                        <th rowSpan={3} className="px-1 py-2 text-center font-semibold text-gray-900 border-b border-gray-300 leading-tight">
                                                            Mark Sea-going<br />Vessel (x)
                                                        </th>
                                                    </tr>
                                                    {/* 2행: Year/Day/Date/Time From/Time To + 상위 그룹 헤더 */}
                                                    <tr>
                                                        <th className="px-1 py-2 text-center font-medium text-gray-700 border-b border-r border-gray-300">
                                                            Year
                                                        </th>
                                                        <th className="px-1 py-2 text-center font-medium text-gray-900 bg-white border-b border-r border-gray-300">
                                                            2026
                                                        </th>
                                                        <th rowSpan={2} className="px-1 py-2 text-center font-medium text-gray-700 border-b border-r border-gray-300 leading-tight">
                                                            Time
                                                            <br />
                                                            From
                                                        </th>
                                                        <th rowSpan={2} className="px-1 py-2 text-center font-medium text-gray-700 border-b border-r border-gray-300 leading-tight">
                                                            Time
                                                            <br />
                                                            To
                                                        </th>
                                                        <th colSpan={2} className="px-1 py-1 text-center font-medium text-gray-700 border-b border-r border-gray-300 leading-tight">
                                                            Weekdays
                                                            <br />
                                                            (with in normal working
                                                            <br />
                                                            hours,
                                                            <br />
                                                            08:00 to 17:00)
                                                        </th>
                                                        <th colSpan={2} className="px-1 py-1 text-center font-medium text-gray-700 border-b border-r border-gray-300 leading-tight">
                                                            Saturday, Sunday, and
                                                            <br />
                                                            local holidays
                                                        </th>
                                                        <th colSpan={2} className="px-1 py-1 text-center font-medium text-gray-700 border-b border-r border-gray-300 leading-tight">
                                                            Travel
                                                            <br />
                                                            Hours**
                                                        </th>
                                                    </tr>
                                                    {/* 3행: Day/Date 하위 헤더 + Split of Hours 하위 라벨 */}
                                                    <tr>
                                                        <th className="px-1 py-1 text-center font-medium text-gray-700 border-b border-r border-gray-300">
                                                            Day
                                                        </th>
                                                        <th className="px-1 py-1 text-center font-medium text-gray-700 border-b border-r border-gray-300">
                                                            Date
                                                        </th>
                                                        <th className="px-1 py-1 text-center font-medium text-gray-700 border-b border-r border-gray-300 leading-tight">
                                                            Normal
                                                            <br />
                                                            Working
                                                        </th>
                                                        <th className="px-1 py-1 text-center font-medium text-gray-700 border-b border-r border-gray-300 leading-tight">
                                                            After Normal
                                                            <br />
                                                            Working
                                                        </th>
                                                        <th className="px-1 py-1 text-center font-medium text-gray-700 border-b border-r border-gray-300 leading-tight">
                                                            Normal
                                                            <br />
                                                            Working
                                                        </th>
                                                        <th className="px-1 py-1 text-center font-medium text-gray-700 border-b border-r border-gray-300 leading-tight">
                                                            After Normal
                                                            <br />
                                                            Working
                                                        </th>
                                                        <th className="px-1 py-1 text-center font-medium text-gray-700 border-b border-r border-gray-300">
                                                            Weekday
                                                        </th>
                                                        <th className="px-1 py-1 text-center font-medium text-gray-700 border-b border-r border-gray-300 leading-tight">
                                                            Weekend
                                                            <br />
                                                            / Holiday
                                                        </th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {/* Row 1: Fri, 02.Jan */}
                                                    <tr className="border-b border-gray-300">
                                                        <td className="px-2 py-3 text-center border-r border-gray-300">Fri</td>
                                                        <td className="px-2 py-3 text-center border-r border-gray-300">02.Jan</td>
                                                        <td className="px-2 py-3 text-center border-r border-gray-300">06</td>
                                                        <td className="px-2 py-3 text-center border-r border-gray-300">19</td>
                                                        <td className="px-2 py-3 text-center border-r border-gray-300 font-bold">12</td>
                                                        <td className="px-2 py-3 text-center border-r border-gray-300">8</td>
                                                        <td className="px-2 py-3 text-center border-r border-gray-300"></td>
                                                        <td className="px-2 py-3 text-center border-r border-gray-300"></td>
                                                        <td className="px-2 py-3 text-center border-r border-gray-300"></td>
                                                        <td className="px-2 py-3 text-center border-r border-gray-300">4</td>
                                                        <td className="px-2 py-3 text-center border-r border-gray-300"></td>
                                                        <td className="px-2 py-3 text-center"></td>
                                                    </tr>
                                                    {/* Row 2: Sat, 03.Jan */}
                                                    <tr className="border-b border-gray-300">
                                                        <td className="px-2 py-3 text-center border-r border-gray-300">Sat</td>
                                                        <td className="px-2 py-3 text-center border-r border-gray-300">03.Jan</td>
                                                        <td className="px-2 py-3 text-center border-r border-gray-300">13</td>
                                                        <td className="px-2 py-3 text-center border-r border-gray-300">24</td>
                                                        <td className="px-2 py-3 text-center border-r border-gray-300 font-bold">11</td>
                                                        <td className="px-2 py-3 text-center border-r border-gray-300"></td>
                                                        <td className="px-2 py-3 text-center border-r border-gray-300"></td>
                                                        <td className="px-2 py-3 text-center border-r border-gray-300">2</td>
                                                        <td className="px-2 py-3 text-center border-r border-gray-300">7</td>
                                                        <td className="px-2 py-3 text-center border-r border-gray-300"></td>
                                                        <td className="px-2 py-3 text-center border-r border-gray-300">2</td>
                                                        <td className="px-2 py-3 text-center"></td>
                                                    </tr>
                                                    {/* Row 3: Sun, 04.Jan */}
                                                    <tr className="border-b border-gray-300">
                                                        <td className="px-2 py-3 text-center border-r border-gray-300">Sun</td>
                                                        <td className="px-2 py-3 text-center border-r border-gray-300">04.Jan</td>
                                                        <td className="px-2 py-3 text-center border-r border-gray-300">00</td>
                                                        <td className="px-2 py-3 text-center border-r border-gray-300">03</td>
                                                        <td className="px-2 py-3 text-center border-r border-gray-300 font-bold">3</td>
                                                        <td className="px-2 py-3 text-center border-r border-gray-300"></td>
                                                        <td className="px-2 py-3 text-center border-r border-gray-300"></td>
                                                        <td className="px-2 py-3 text-center border-r border-gray-300"></td>
                                                        <td className="px-2 py-3 text-center border-r border-gray-300">1</td>
                                                        <td className="px-2 py-3 text-center border-r border-gray-300"></td>
                                                        <td className="px-2 py-3 text-center border-r border-gray-300">2</td>
                                                        <td className="px-2 py-3 text-center"></td>
                                                    </tr>
                                                    {/* Row 4: Tue, 06.Jan */}
                                                    <tr className="border-b border-gray-300">
                                                        <td className="px-2 py-3 text-center border-r border-gray-300">Tue</td>
                                                        <td className="px-2 py-3 text-center border-r border-gray-300">06.Jan</td>
                                                        <td className="px-2 py-3 text-center border-r border-gray-300">06</td>
                                                        <td className="px-2 py-3 text-center border-r border-gray-300">19</td>
                                                        <td className="px-2 py-3 text-center border-r border-gray-300 font-bold">12</td>
                                                        <td className="px-2 py-3 text-center border-r border-gray-300">8</td>
                                                        <td className="px-2 py-3 text-center border-r border-gray-300"></td>
                                                        <td className="px-2 py-3 text-center border-r border-gray-300"></td>
                                                        <td className="px-2 py-3 text-center border-r border-gray-300"></td>
                                                        <td className="px-2 py-3 text-center border-r border-gray-300">4</td>
                                                        <td className="px-2 py-3 text-center border-r border-gray-300"></td>
                                                        <td className="px-2 py-3 text-center"></td>
                                                    </tr>
                                                    {/* Row 5: Mon, 12.Jan */}
                                                    <tr className="border-b border-gray-300">
                                                        <td className="px-2 py-3 text-center border-r border-gray-300">Mon</td>
                                                        <td className="px-2 py-3 text-center border-r border-gray-300">12.Jan</td>
                                                        <td className="px-2 py-3 text-center border-r border-gray-300">06</td>
                                                        <td className="px-2 py-3 text-center border-r border-gray-300">13</td>
                                                        <td className="px-2 py-3 text-center border-r border-gray-300 font-bold">7</td>
                                                        <td className="px-2 py-3 text-center border-r border-gray-300">3</td>
                                                        <td className="px-2 py-3 text-center border-r border-gray-300"></td>
                                                        <td className="px-2 py-3 text-center border-r border-gray-300"></td>
                                                        <td className="px-2 py-3 text-center border-r border-gray-300"></td>
                                                        <td className="px-2 py-3 text-center border-r border-gray-300">4</td>
                                                        <td className="px-2 py-3 text-center border-r border-gray-300"></td>
                                                        <td className="px-2 py-3 text-center"></td>
                                                    </tr>
                                                    {/* Row 6: Sat, 17.Jan */}
                                                    <tr className="border-b border-gray-300">
                                                        <td className="px-2 py-3 text-center border-r border-gray-300">Sat</td>
                                                        <td className="px-2 py-3 text-center border-r border-gray-300">17.Jan</td>
                                                        <td className="px-2 py-3 text-center border-r border-gray-300">06</td>
                                                        <td className="px-2 py-3 text-center border-r border-gray-300">16</td>
                                                        <td className="px-2 py-3 text-center border-r border-gray-300 font-bold">10</td>
                                                        <td className="px-2 py-3 text-center border-r border-gray-300"></td>
                                                        <td className="px-2 py-3 text-center border-r border-gray-300"></td>
                                                        <td className="px-2 py-3 text-center border-r border-gray-300">6</td>
                                                        <td className="px-2 py-3 text-center border-r border-gray-300"></td>
                                                        <td className="px-2 py-3 text-center border-r border-gray-300"></td>
                                                        <td className="px-2 py-3 text-center border-r border-gray-300">4</td>
                                                        <td className="px-2 py-3 text-center"></td>
                                                    </tr>
                                                    {/* Row 7: Tue, 27.Jan */}
                                                    <tr className="border-b border-gray-300">
                                                        <td className="px-2 py-3 text-center border-r border-gray-300">Tue</td>
                                                        <td className="px-2 py-3 text-center border-r border-gray-300">27.Jan</td>
                                                        <td className="px-2 py-3 text-center border-r border-gray-300">06</td>
                                                        <td className="px-2 py-3 text-center border-r border-gray-300">15</td>
                                                        <td className="px-2 py-3 text-center border-r border-gray-300 font-bold">9</td>
                                                        <td className="px-2 py-3 text-center border-r border-gray-300">2</td>
                                                        <td className="px-2 py-3 text-center border-r border-gray-300">4</td>
                                                        <td className="px-2 py-3 text-center border-r border-gray-300"></td>
                                                        <td className="px-2 py-3 text-center border-r border-gray-300"></td>
                                                        <td className="px-2 py-3 text-center border-r border-gray-300">3</td>
                                                        <td className="px-2 py-3 text-center border-r border-gray-300"></td>
                                                        <td className="px-2 py-3 text-center"></td>
                                                    </tr>
                                                    {/* Row 8: Wed, 28.Jan */}
                                                    <tr className="border-b border-gray-300">
                                                        <td className="px-2 py-3 text-center border-r border-gray-300">Wed</td>
                                                        <td className="px-2 py-3 text-center border-r border-gray-300">28.Jan</td>
                                                        <td className="px-2 py-3 text-center border-r border-gray-300">06</td>
                                                        <td className="px-2 py-3 text-center border-r border-gray-300">13</td>
                                                        <td className="px-2 py-3 text-center border-r border-gray-300 font-bold">7</td>
                                                        <td className="px-2 py-3 text-center border-r border-gray-300">4</td>
                                                        <td className="px-2 py-3 text-center border-r border-gray-300"></td>
                                                        <td className="px-2 py-3 text-center border-r border-gray-300"></td>
                                                        <td className="px-2 py-3 text-center border-r border-gray-300"></td>
                                                        <td className="px-2 py-3 text-center border-r border-gray-300">3</td>
                                                        <td className="px-2 py-3 text-center border-r border-gray-300"></td>
                                                        <td className="px-2 py-3 text-center"></td>
                                                    </tr>
                                                    {/* Row 9: Fri, 30.Jan */}
                                                    <tr className="border-b border-gray-300">
                                                        <td className="px-2 py-3 text-center border-r border-gray-300">Fri</td>
                                                        <td className="px-2 py-3 text-center border-r border-gray-300">30.Jan</td>
                                                        <td className="px-2 py-3 text-center border-r border-gray-300">06</td>
                                                        <td className="px-2 py-3 text-center border-r border-gray-300">16</td>
                                                        <td className="px-2 py-3 text-center border-r border-gray-300 font-bold">10</td>
                                                        <td className="px-2 py-3 text-center border-r border-gray-300">6</td>
                                                        <td className="px-2 py-3 text-center border-r border-gray-300"></td>
                                                        <td className="px-2 py-3 text-center border-r border-gray-300"></td>
                                                        <td className="px-2 py-3 text-center border-r border-gray-300"></td>
                                                        <td className="px-2 py-3 text-center border-r border-gray-300">4</td>
                                                        <td className="px-2 py-3 text-center border-r border-gray-300"></td>
                                                        <td className="px-2 py-3 text-center"></td>
                                                    </tr>
                                                    {/* Total Row */}
                                                    <tr className="bg-gray-100 font-semibold">
                                                        <td colSpan={4} className="px-2 py-2 text-center border-r border-gray-300">Total</td>
                                                        <td className="px-2 py-2 text-center border-r border-gray-300 font-bold">81</td>
                                                        <td className="px-2 py-2 text-center border-r border-gray-300 font-bold">31</td>
                                                        <td className="px-2 py-2 text-center border-r border-gray-300 font-bold">4</td>
                                                        <td className="px-2 py-2 text-center border-r border-gray-300 font-bold">8</td>
                                                        <td className="px-2 py-2 text-center border-r border-gray-300 font-bold">8</td>
                                                        <td className="px-2 py-2 text-center border-r border-gray-300 font-bold">22</td>
                                                        <td className="px-2 py-2 text-center border-r border-gray-300 font-bold">8</td>
                                                        <td className="px-2 py-2 text-center font-bold">0</td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
