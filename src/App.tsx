// src/App.tsx
import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./store/auth";
import RequireAuth from "./components/RequireAuth";
import { ToastProvider } from "./components/ui/ToastProvider";
import ReportPdfPage from "./pages/Report/ReportPdfPage";

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



function App() {
    return (
        <AuthProvider>
            <ToastProvider>
                <BrowserRouter>
                    <Suspense fallback={null}>
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
                                    path="/report/:id/edit"
                                    element={<ReportEditPage />}
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

                            {/* default */}
                            <Route
                                path="/"
                                element={<Navigate to="/dashboard" replace />}
                            />
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

                                {/* ✅ PDF 페이지도 protected 안에 넣기 + 경로를 쿼리 방식에 맞춤 */}
                                <Route path="/report/pdf" element={<ReportPdfPage />} />

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

                            {/* default */}
                            <Route
                                path="/"
                                element={<Navigate to="/dashboard" replace />}
                            />
                            <Route
                                path="*"
                                element={<Navigate to="/dashboard" replace />}
                            />
                        </Routes>
                    </Suspense>
                </BrowserRouter>
            </ToastProvider>
        </AuthProvider>
    );
}

export default App;
