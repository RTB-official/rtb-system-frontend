export default function TbmDetailSkeleton() {
    return (
        <div className="max-w-[900px] mx-auto animate-pulse space-y-6">
            <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                {/* Header */}
                <div className="h-12 bg-gray-50 border-b border-gray-200 flex items-center justify-center">
                    <div className="h-5 w-32 bg-gray-200 rounded" />
                </div>

                {/* Details */}
                <div className="p-4 space-y-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="flex border-b border-gray-100 pb-4 last:border-0">
                            <div className="w-[140px] h-5 bg-gray-100 rounded mr-4" />
                            <div className="flex-1 h-5 bg-gray-50 rounded" />
                        </div>
                    ))}
                </div>

                {/* Risk Assessment Table Header */}
                <div className="bg-gray-50 border-y border-gray-200 py-3 px-4 flex justify-center">
                    <div className="h-5 w-40 bg-gray-200 rounded" />
                </div>
                
                {/* Risk Assessment Table Body */}
                <div className="p-4 space-y-4">
                    <div className="flex gap-4 border-b border-gray-100 pb-2">
                        <div className="w-[140px] h-4 bg-gray-100 rounded" />
                        <div className="flex-1 h-4 bg-gray-100 rounded" />
                        <div className="flex-1 h-4 bg-gray-100 rounded" />
                    </div>
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="flex gap-4">
                            <div className="w-[140px] h-8 bg-blue-50/50 rounded-full" />
                            <div className="flex-1 h-8 bg-gray-50 rounded-full" />
                            <div className="flex-1 h-8 bg-gray-50 rounded-full" />
                        </div>
                    ))}
                </div>

                {/* Participants Header */}
                <div className="bg-gray-50 border-t border-gray-200 py-3 px-4 flex justify-center">
                    <div className="h-5 w-24 bg-gray-200 rounded" />
                </div>
                <div className="p-4 space-y-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                            <div className="w-24 h-5 bg-gray-100 rounded" />
                            <div className="w-5 h-5 bg-gray-100 rounded" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
