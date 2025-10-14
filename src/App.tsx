import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import AgencyDashboard from './pages/AgencyDashboard';
import ClientDashboard from './pages/ClientDashboard';
import IntegrationsPage from './pages/IntegrationsPage';
import ReportsPage from './pages/ReportsPage';
import AlertsPage from './pages/AlertsPage';
import SharedReportPage from './pages/SharedReportPage';
import UserManagementPage from './pages/UserManagementPage';
import GoalsDashboard from './pages/GoalsDashboard';
import AgencyFinancePage from './pages/AgencyFinancePage';
import Sidebar from './components/Sidebar';
import BackfillBanner from './components/BackfillBanner';

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

  const handleClientSelect = (clientId: string) => {
    setSelectedClientId(clientId);
    setActiveView('client-details');
  };

  const handleBackToAgency = () => {
    setSelectedClientId(null);
    setActiveView('dashboard');
  };

  const renderView = () => {
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
      case 'alerts':
        return <AlertsPage />;
      case 'users':
        return isSuperAdmin ? <UserManagementPage /> : <ClientDashboard />;
      case 'settings':
        return <IntegrationsPage />;
      default:
        return isSuperAdmin ? <AgencyDashboard /> : <ClientDashboard />;
    }
  };

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar activeView={activeView} onViewChange={setActiveView} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <BackfillBanner />
        {renderView()}
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
