import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { RequireAuth } from '../auth/RequireAuth';
import { Login } from '../pages/Login';
import { Patients } from '../pages/Patients';
import { PatientDetail } from '../pages/PatientDetail';
import { Reports } from '../pages/Reports';
import { MonthlyReport } from '../pages/MonthlyReport';
import { Settings } from '../pages/Settings';

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="/patients" replace />} />
        <Route path="/patients" element={<Patients />} />
        <Route path="/patients/:id" element={<PatientDetail />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/reports/monthly" element={<MonthlyReport />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
