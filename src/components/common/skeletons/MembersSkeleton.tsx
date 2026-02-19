/**
 * 구성원 관리 페이지 로딩 스켈레톤 컴포넌트
 */
export default function MembersSkeleton() {
    return (
        <div className="overflow-x-auto">
            <div className="min-w-[980px]">
                <div className="overflow-auto border border-gray-200 rounded-2xl w-full">
                    <table className="w-full text-[14px] text-gray-900">
                        <thead className="bg-gray-100 border-b border-gray-200">
                            <tr>
                                {/* 이름 */}
                                <th className="px-4 py-3 font-semibold text-gray-600 text-left" style={{ width: "11%" }}>
                                    이름
                                </th>
                                {/* 직급 */}
                                <th className="px-4 py-3 font-semibold text-gray-600 text-left" style={{ width: "6%" }}>
                                    직급
                                </th>
                                {/* 전화번호 */}
                                <th className="px-4 py-3 font-semibold text-gray-600 text-left" style={{ width: "10%" }}>
                                    전화번호
                                </th>
                                {/* 주소 */}
                                <th className="px-4 py-3 font-semibold text-gray-600 text-left" style={{ width: "30%" }}>
                                    주소
                                </th>
                                {/* 입사일 */}
                                <th className="px-4 py-3 font-semibold text-gray-600 text-left" style={{ width: "8%" }}>
                                    입사일
                                </th>
                                {/* 생년월일 */}
                                <th className="px-4 py-3 font-semibold text-gray-600 text-left" style={{ width: "8%" }}>
                                    생년월일
                                </th>
                                {/* 여권정보 */}
                                <th className="px-4 py-3 font-semibold text-gray-600 text-left" style={{ width: "10%" }}>
                                    여권정보
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {Array.from({ length: 10 }).map((_, index) => (
                                <tr
                                    key={index}
                                    className={`${
                                        index % 2 === 0 ? "bg-white" : "bg-gray-50"
                                    } border-b border-gray-100`}
                                >
                                    {/* 이름 */}
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3 animate-pulse">
                                            <div className="w-6 h-6 bg-gray-200 rounded-full"></div>
                                            <div className="flex-1">
                                                <div className="h-4 bg-gray-200 rounded w-16 mb-1"></div>
                                                <div className="h-3 bg-gray-200 rounded w-12"></div>
                                            </div>
                                        </div>
                                    </td>
                                    {/* 직급 */}
                                    <td className="px-4 py-3">
                                        <div className="h-4 bg-gray-200 rounded w-12 animate-pulse"></div>
                                    </td>
                                    {/* 전화번호 */}
                                    <td className="px-4 py-3">
                                        <div className="h-4 bg-gray-200 rounded w-24 animate-pulse"></div>
                                    </td>
                                    {/* 주소 */}
                                    <td className="px-4 py-3">
                                        <div className="animate-pulse">
                                            <div className="h-4 bg-gray-200 rounded w-48 mb-1"></div>
                                            <div className="h-3 bg-gray-200 rounded w-32"></div>
                                        </div>
                                    </td>
                                    {/* 입사일 */}
                                    <td className="px-4 py-3">
                                        <div className="h-4 bg-gray-200 rounded w-16 animate-pulse"></div>
                                    </td>
                                    {/* 생년월일 */}
                                    <td className="px-4 py-3">
                                        <div className="h-4 bg-gray-200 rounded w-16 animate-pulse"></div>
                                    </td>
                                    {/* 여권정보 */}
                                    <td className="px-4 py-3">
                                        <div className="animate-pulse">
                                            <div className="flex items-center gap-2 mb-1">
                                                <div className="h-4 bg-gray-200 rounded w-24"></div>
                                                <div className="h-5 bg-gray-200 rounded w-20"></div>
                                            </div>
                                            <div className="h-3 bg-gray-200 rounded w-32"></div>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
