import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { useAuth } from './context/AuthContext';
import { AuthPage } from './pages/AuthPage';
import { DashboardPage } from './pages/DashboardPage';
import { TransfersPage } from './pages/TransfersPage';
import {
  AccountsPage,
  AuditPage,
  FraudPage,
  LedgerPage,
  LoansPage,
  SimulatorPage,
} from './pages/OperationsPages';

const ProtectedLayout = () => {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="p-8 text-center text-slate-400">Chargement de votre espace…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <Layout />;
};

const StaffOnly = ({ children }: { children: JSX.Element }) => {
  const { user } = useAuth();
  return user?.role === 'CLIENT' ? <Navigate to="/" replace /> : children;
};

export default function App() {
  return <Routes>
    <Route path="/login" element={<AuthPage />} />
    <Route path="/register" element={<AuthPage register />} />
    <Route element={<ProtectedLayout />}>
      <Route index element={<DashboardPage />} />
      <Route path="transfers" element={<TransfersPage />} />
      <Route path="accounts" element={<AccountsPage />} />
      <Route path="loans" element={<LoansPage />} />
      <Route path="ledger" element={<StaffOnly><LedgerPage /></StaffOnly>} />
      <Route path="fraud" element={<StaffOnly><FraudPage /></StaffOnly>} />
      <Route path="simulator" element={<StaffOnly><SimulatorPage /></StaffOnly>} />
      <Route path="audit" element={<StaffOnly><AuditPage /></StaffOnly>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Route>
  </Routes>;
}
