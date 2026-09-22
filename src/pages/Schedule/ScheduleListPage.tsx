// src/pages/Schedule/ScheduleListPage.tsx
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/common/Header";
import Button from "../../components/common/Button";
import PageContainer from "../../components/common/PageContainer";
import ScheduleSheetTable from "../../components/schedule/ScheduleSheetTable";
import { IconPlus } from "../../components/icons/Icons";
import { useToast } from "../../components/ui/ToastProvider";
import {
    fetchScheduleVersionSheets,
    type ScheduleVersionSheet,
} from "../../lib/scheduleApi";
import { PATHS } from "../../utils/paths";

export default function ScheduleListPage() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [sheets, setSheets] = useState<ScheduleVersionSheet[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const { showError } = useToast();
    const scrollRef = useRef<HTMLDivElement>(null);
    const bottomRef = useRef<HTMLDivElement>(null);
    const didInitialScroll = useRef(false);

    useEffect(() => {
        let cancelled = false;
        void (async () => {
            setLoading(true);
            try {
                const data = await fetchScheduleVersionSheets();
                if (!cancelled) setSheets(data);
            } catch (err) {
                console.error(err);
                if (!cancelled) {
                    showError(
                        err instanceof Error
                            ? err.message
                            : "일정 목록을 불러오지 못했습니다."
                    );
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [showError]);

    useLayoutEffect(() => {
        if (loading || sheets.length === 0 || didInitialScroll.current) return;
        didInitialScroll.current = true;
        bottomRef.current?.scrollIntoView({ block: "end" });
    }, [loading, sheets]);

    return (
        <div className="flex h-screen bg-gray-50 overflow-hidden">
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-20 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}
            <div
                className={`fixed lg:static inset-y-0 left-0 z-30 w-[260px] max-w-[88vw] lg:max-w-none lg:w-[239px] h-screen shrink-0 transform transition-transform duration-300 ease-in-out ${
                    sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
                }`}
            >
                <Sidebar onClose={() => setSidebarOpen(false)} />
            </div>

            <div className="flex-1 flex flex-col h-screen overflow-hidden w-full">
                <Header
                    title="일정 목록"
                    onMenuClick={() => setSidebarOpen(true)}
                    rightContent={
                        <Button
                            variant="primary"
                            size="lg"
                            onClick={() => navigate(PATHS.scheduleCreate)}
                            icon={<IconPlus />}
                        >
                            일정 등록
                        </Button>
                    }
                />
                <div ref={scrollRef} className="flex-1 overflow-y-auto pt-4 pb-24">
                    <PageContainer className="pt-2 flex flex-col gap-8">
                        {loading ? (
                            <div className="py-16 text-center text-gray-500 text-sm">
                                불러오는 중…
                            </div>
                        ) : sheets.length === 0 ? (
                            <div className="py-16 text-center text-gray-500 text-sm">
                                등록된 일정이 없습니다.
                            </div>
                        ) : (
                            sheets.map((sheet) => (
                                <section
                                    key={sheet.id}
                                    className="flex flex-col gap-2"
                                    aria-label={sheet.versionKey}
                                >
                                    <h2 className="text-sm md:text-base font-semibold tracking-tight text-gray-900">
                                        {sheet.versionKey}
                                    </h2>
                                    <ScheduleSheetTable rows={sheet.rows} />
                                </section>
                            ))
                        )}
                        <div ref={bottomRef} aria-hidden className="h-px w-full shrink-0" />
                    </PageContainer>
                </div>
            </div>
        </div>
    );
}
