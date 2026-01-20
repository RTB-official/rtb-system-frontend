import React from 'react';

interface MainLayoutProps {
    children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
    return (
        <div className="min-h-screen flex flex-col">
            <header className="bg-blue-500 text-white p-4">
                <h1 className="text-xl font-bold">RTB통합 관리 시스템</h1>
            </header>
            <main className="flex-grow p-4">
                {children}
            </main>
            <footer className="bg-gray-800 text-white p-4 text-center">
                <p>&copy; 2025 RTB통합 관리 시스템</p>
            </footer>
        </div>
    );
};

export default MainLayout;
