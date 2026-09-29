import { useSidebarOpen } from "../../hooks/useSidebarOpen";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/common/Header";
import PageContainer from "../../components/common/PageContainer";

export default function MaterialsPage({ title }: { title: string }) {
    const [sidebarOpen, setSidebarOpen] = useSidebarOpen();

    return (
        <div className="flex h-screen bg-white overflow-hidden">
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-20 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            <div
                className={`
            fixed lg:static inset-y-0 left-0 z-30
            w-[260px] max-w-[88vw] lg:max-w-none lg:w-[239px] h-screen shrink-0
            transform transition-transform duration-300 ease-in-out
            ${
                sidebarOpen
                    ? "translate-x-0"
                    : "-translate-x-full lg:translate-x-0"
            }
          `}
            >
                <Sidebar onClose={() => setSidebarOpen(false)} />
            </div>

            <div className="flex-1 flex flex-col h-screen overflow-hidden w-full">
                <Header
                    title={title}
                    onMenuClick={() => setSidebarOpen(true)}
                />
                <div className="flex-1 overflow-y-auto">
                    <PageContainer className="py-4 md:py-6" />
                </div>
            </div>
        </div>
    );
}
