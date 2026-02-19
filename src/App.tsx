import { useState, useEffect, lazy, Suspense, useCallback, useMemo } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import Sidebar from './components/Sidebar';
import BackfillBanner from './components/BackfillBanner';

const AgencyDashboard = lazy(() => import('./pages/AgencyDashboard'));
const ClientDashboard = lazy(() => import('./pages/ClientDashboard'));
const IntegrationsPage = lazy(() => import('./pages/IntegrationsPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const AlertsPage = lazy(() => import('./pages/AlertsPage'));
const SharedReportPage = lazy(() => import('./pages/SharedReportPage'));
const UserManagementPage = lazy(() => import('./pages/UserManagementPage'));
const GoalsDashboard = lazy(() => import('./pages/GoalsDashboard'));
const AgencyFinancePage = lazy(() => import('./pages/AgencyFinancePage'));
const MonthlyReportsPage = lazy(() => import('./pages/MonthlyReportsPage'));
const ChangePasswordPage = lazy(() => import('./pages/ChangePasswordPage'));

function AppContent() {
  const { user, profile, loading } = useAuth();
  const [activeView, setActiveView] = useState('dashboard');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [sharedReportToken, setSharedReportToken] = useState<string | null>(null);

  useEffect(() => {
    const checkPath = () => {
      const path = window.location.pathname;
      const match = path.match(/^\/shared-report\/(.+)$/);
      if (match) {
        setSharedReportToken(match[1]);
      } else {
        setSharedReportToken(null);
      }
    };

    checkPath();

    window.addEventListener('popstate', checkPath);

    const originalPushState = window.history.pushState;
    window.history.pushState = function(...args) {
      originalPushState.apply(window.history, args);
      checkPath();
    };

    return () => {
      window.removeEventListener('popstate', checkPath);
      window.history.pushState = originalPushState;
    };
  }, []);

  if (sharedReportToken) {
    return <SharedReportPage token={sharedReportToken} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !profile) {
    return <LoginPage />;
  }

  const isSuperAdmin = profile.role === 'super_admin';

  const handleClientSelect = useCallback((clientId: string) => {
    setSelectedClientId(clientId);
    setActiveView('client-details');
  }, []);

  const handleBackToAgency = useCallback(() => {
    setSelectedClientId(null);
    setActiveView('dashboard');
  }, []);

  const renderView = useMemo(() => {
    switch (activeView) {
      case 'dashboard':
        return isSuperAdmin ? <AgencyDashboard onClientSelect={handleClientSelect} /> : <ClientDashboard />;
      case 'clients':
        return isSuperAdmin ? <AgencyDashboard onClientSelect={handleClientSelect} /> : <ClientDashboard />;
      case 'client-details':
        return <ClientDashboard clientId={selectedClientId} onBack={handleBackToAgency} />;
      case 'goals':
        return <GoalsDashboard />;
      case 'finance':
        return <AgencyFinancePage />;
      case 'reports':
        return <ReportsPage />;
      case 'monthly-reports':
        return <MonthlyReportsPage />;
      case 'alerts':
        return <AlertsPage />;
      case 'users':
        return isSuperAdmin ? <UserManagementPage /> : <ClientDashboard />;
      case 'settings':
        return <IntegrationsPage />;
      case 'change-password':
        return <ChangePasswordPage onBack={() => setActiveView('dashboard')} />;
      default:
        return isSuperAdmin ? <AgencyDashboard /> : <ClientDashboard />;
    }
  }, [activeView, isSuperAdmin, selectedClientId, handleClientSelect, handleBackToAgency]);

  const pageLoader = (
    <div className="flex-1 flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar activeView={activeView} onViewChange={setActiveView} />
      <div className="flex-1 flex flex-col">
        <BackfillBanner />
        <Suspense fallback={pageLoader}>
          {renderView}
        </Suspense>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
