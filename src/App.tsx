// src/App.tsx
import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./store/auth";
import RequireAuth from "./components/RequireAuth";
import { ToastProvider } from "./components/ui/ToastProvider";
import PageSkeleton from "./components/common/PageSkeleton";

// 코드 스플리팅: 페이지 컴포넌트들을 lazy loading으로 변경
const LoginPage = lazy(() => import("./pages/Login/LoginPage"));
const DashboardPage = lazy(() => import("./pages/Dashboard/DashboardPage"));
const WorkloadPage = lazy(() => import("./pages/Workload/WorkloadPage"));
const WorkloadDetailPage = lazy(
    () => import("./pages/Workload/WorkloadDetailPage")
);
const CreationPage = lazy(() => import("./pages/Creation/CreationPage"));
const ReportListPage = lazy(() => import("./pages/Report/ReportListPage"));
const ReportEditPage = lazy(() => import("./pages/Report/ReportEditPage"));
const ReportViewPage = lazy(() => import("./pages/Report/ReportViewPage"));
const ReportPdfPage = lazy(() => import("./pages/Report/ReportPdfPage"));
const VacationPage = lazy(() => import("./pages/Vacation/VacationPage"));
const AdminVacationPage = lazy(
    () => import("./pages/Vacation/AdminVacationPage")
);
const PersonalExpensePage = lazy(
    () => import("./pages/Expense/PersonalExpensePage")
);
const MemberExpensePage = lazy(
    () => import("./pages/Expense/MemberExpensePage")
);
const MembersPage = lazy(() => import("./pages/Members/MembersPage"));
const EmailNotificationSettingsPage = lazy(
    () => import("./pages/Settings/EmailNotificationSettingsPage")
);

function RoleLanding() {
    const { loading, loadingProfile, user, profile } = useAuth();

    if (loading || loadingProfile) return <PageSkeleton />;
    if (!user) return <Navigate to="/login" replace />;

    if (profile?.role === "admin") return <Navigate to="/dashboard" replace />;
    return <Navigate to="/report" replace />;
}

function App() {

    return (
        <AuthProvider>
            <ToastProvider>
                <BrowserRouter>
                    <Suspense fallback={<PageSkeleton />}>
                        <Routes>
                            {/* public */}
                            <Route path="/login" element={<LoginPage />} />

                            {/* protected */}
                            <Route element={<RequireAuth />}>
                                <Route
                                    path="/dashboard"
                                    element={<DashboardPage />}
                                />
                                <Route
                                    path="/workload"
                                    element={<WorkloadPage />}
                                />
                                <Route
                                    path="/workload/detail/:id"
                                    element={<WorkloadDetailPage />}
                                />
                                <Route
                                    path="/reportcreate"
                                    element={<CreationPage />}
                                />
                                <Route
                                    path="/report"
                                    element={<ReportListPage />}
                                />
                                <Route
                                    path="/report/:id"
                                    element={<ReportViewPage />}
                                />
                                <Route
                                    path="/report/:id/edit"
                                    element={<ReportEditPage />}
                                />
                                <Route
                                    path="/report/pdf"
                                    element={<ReportPdfPage />}
                                />
                                <Route
                                    path="/vacation"
                                    element={<VacationPage />}
                                />
                                <Route
                                    path="/vacation/admin"
                                    element={<AdminVacationPage />}
                                />
                                <Route
                                    path="/expense"
                                    element={<PersonalExpensePage />}
                                />
                                <Route
                                    path="/expense/member"
                                    element={<MemberExpensePage />}
                                />
                                <Route
                                    path="/members"
                                    element={<MembersPage />}
                                />
                            </Route>

                            <Route
                                path="/settings/email-notifications"
                                element={<EmailNotificationSettingsPage />}
                            />

                            {/* default */}
                            <Route path="/" element={<RoleLanding />} />
                            <Route path="*" element={<RoleLanding />} />
                        </Routes>
                    </Suspense>
                </BrowserRouter>
            </ToastProvider>
        </AuthProvider>
    );
}

export default App;