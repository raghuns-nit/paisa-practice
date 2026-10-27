import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { SignUp } from './pages/SignUp';
import { ForgotPassword } from './pages/ForgotPassword';
import { Dashboard } from './pages/Dashboard';
import { Bank } from './pages/Bank';
import { PostOffice } from './pages/PostOffice';
import { Insurance } from './pages/Insurance';
import { Investments } from './pages/Investments';
import { Bonds } from './pages/Bonds';
import { Learning } from './pages/Learning';
import { Search } from './pages/Search';
import { PhoneInbox } from './pages/PhoneInbox';
import { Security } from './pages/Security';
import { Settings } from './pages/Settings';
import { Statements } from './pages/Statements';
import { IncomeTax } from './pages/IncomeTax';
import { TransactionDetail } from './pages/TransactionDetail';
import { ComingSoon } from './pages/ComingSoon';
import type { JSX } from 'react';

function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { session, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ink-50">
        <div className="text-ink-400 animate-pulse">Loading...</div>
      </div>
    );
  }
  if (!session) return <Navigate to="/login" replace />;
  return children;
}

function PublicOnlyRoute({ children }: { children: JSX.Element }) {
  const { session, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ink-50">
        <div className="text-ink-400 animate-pulse">Loading...</div>
      </div>
    );
  }
  if (session) return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
          <Route path="/signup" element={<PublicOnlyRoute><SignUp /></PublicOnlyRoute>} />
          <Route path="/forgot-password" element={<PublicOnlyRoute><ForgotPassword /></PublicOnlyRoute>} />

          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="bank" element={<Bank />} />
            <Route path="post-office" element={<PostOffice />} />
            <Route path="insurance" element={<Insurance />} />
            <Route path="investments" element={<Investments />} />
            <Route path="bonds" element={<Bonds />} />
            <Route path="learning" element={<Learning />} />
            <Route path="search" element={<Search />} />
            <Route path="phone-inbox" element={<PhoneInbox />} />
            <Route path="security" element={<Security />} />
            <Route path="settings" element={<Settings />} />
            <Route path="statements" element={<Statements />} />
            <Route path="income-tax" element={<IncomeTax />} />
            <Route path="transaction/:id" element={<TransactionDetail />} />
            <Route path="*" element={<ComingSoon />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
