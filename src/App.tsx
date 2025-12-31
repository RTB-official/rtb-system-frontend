import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/Login/LoginPage";
import HomePage from "./pages/Home/HomePage";
import WorkloadPage from "./pages/Workload/WorkloadPage";
import WorkloadDetailPage from "./pages/Workload/WorkloadDetailPage";
import CreationPage from "./pages/Creation/CreationPage";
import ReportListPage from "./pages/Report/ReportListPage";
import DashboardPage from "./pages/Dashboard/DashboardPage";
import PersonalExpensePage from "./pages/Expense/PersonalExpensePage";
import MemberExpensePage from "./pages/Expense/MemberExpensePage";
import VacationPage from "./pages/Vacation/VacationPage";

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/home" element={<HomePage />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/workload" element={<WorkloadPage />} />
                <Route
                    path="/workload/detail/:id"
                    element={<WorkloadDetailPage />}
                />
                <Route path="/reportcreate" element={<CreationPage />} />
                <Route path="/report" element={<ReportListPage />} />
                <Route path="/Vacation" element={<VacationPage />} />
                <Route path="/expense" element={<PersonalExpensePage />} />
                <Route path="/expense/member" element={<MemberExpensePage />} />
                <Route path="/" element={<Navigate to="/login" replace />} />
                <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;
