import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/Login/LoginPage';
import CreationPage from './pages/Creation/CreationPage';
import WorkloadPage from './pages/Workload/WorkloadPage';
import WorkloadDetailPage from './pages/Workload/WorkloadDetailPage';
import PersonalExpensePage from './pages/Expense/PersonalExpensePage';
import ReportCreatePage from './pages/Report/ReportCreatePage';
import ReportListPage from './pages/Report/ReportListPage';
import VacationPage from './pages/Vacation/VacationPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/worklog" element={<CreationPage />} />
        <Route path="/workload" element={<WorkloadPage />} />
        <Route path="/workload/detail/:id" element={<WorkloadDetailPage />} />
        <Route path="/expense" element={<PersonalExpensePage />} />
        <Route path="/report/create" element={<ReportCreatePage />} />
        <Route path="/report/list" element={<ReportListPage />} />
        <Route path="/vacation" element={<VacationPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
