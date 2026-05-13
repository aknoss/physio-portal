import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { RequireAuth } from '../auth/RequireAuth';
import { Login } from '../pages/Login';
import { Pacientes } from '../pages/Pacientes';
import { PatientDetail } from '../pages/PatientDetail';
import { Relatorios } from '../pages/Relatorios';
import { RelatorioMensal } from '../pages/RelatorioMensal';
import { Configuracoes } from '../pages/Configuracoes';

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
        <Route index element={<Navigate to="/pacientes" replace />} />
        <Route path="/pacientes" element={<Pacientes />} />
        <Route path="/pacientes/:id" element={<PatientDetail />} />
        <Route path="/relatorios" element={<Relatorios />} />
        <Route path="/relatorios/mensal" element={<RelatorioMensal />} />
        <Route path="/configuracoes" element={<Configuracoes />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
