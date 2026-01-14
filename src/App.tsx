// src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/Login/LoginPage";
import WorkloadPage from "./pages/Workload/WorkloadPage";
import WorkloadDetailPage from "./pages/Workload/WorkloadDetailPage";
import CreationPage from "./pages/Creation/CreationPage";
import ReportListPage from "./pages/Report/ReportListPage";
import DashboardPage from "./pages/Dashboard/DashboardPage";
import PersonalExpensePage from "./pages/Expense/PersonalExpensePage";
import MemberExpensePage from "./pages/Expense/MemberExpensePage";
import VacationPage from "./pages/Vacation/VacationPage";
import AdminVacationPage from "./pages/Vacation/AdminVacationPage";
import MembersPage from "./pages/Members/MembersPage";

import { AuthProvider } from "./store/auth";
import RequireAuth from "./components/RequireAuth";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* public */}
          <Route path="/login" element={<LoginPage />} />

          {/* protected */}
          <Route element={<RequireAuth />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/workload" element={<WorkloadPage />} />
            <Route path="/workload/detail/:id" element={<WorkloadDetailPage />} />
            <Route path="/reportcreate" element={<CreationPage />} />
            <Route path="/report" element={<ReportListPage />} />
            <Route path="/vacation" element={<VacationPage />} />
            <Route path="/vacation/admin" element={<AdminVacationPage />} />
            <Route path="/expense" element={<PersonalExpensePage />} />
            <Route path="/expense/member" element={<MemberExpensePage />} />
            <Route path="/members" element={<MembersPage />} />
          </Route>

          {/* default */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
