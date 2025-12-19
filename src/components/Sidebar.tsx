import { LayoutDashboard, Users, Settings, Bell, FileText, LogOut, UserCog, Target, DollarSign, Calendar, Lock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface SidebarProps {
  activeView: string;
  onViewChange: (view: string) => void;
}

export default function Sidebar({ activeView, onViewChange }: SidebarProps) {
  const { profile, signOut } = useAuth();
  const [unreadAlerts, setUnreadAlerts] = useState(0);

  const isSuperAdmin = profile?.role === 'super_admin';
  const isManager = profile?.role === 'manager';
  const isClient = profile?.role === 'client';

  useEffect(() => {
    fetchUnreadAlerts();

    const interval = setInterval(fetchUnreadAlerts, 30000);

    return () => clearInterval(interval);
  }, []);

  const fetchUnreadAlerts = async () => {
    try {
      const { count, error } = await supabase
        .from('alerts')
        .select('*', { count: 'exact', head: true })
        .eq('is_read', false);

      if (error) throw error;
      setUnreadAlerts(count || 0);
    } catch (error) {
      console.error('Error fetching unread alerts:', error);
    }
  };

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ...(isSuperAdmin ? [{ id: 'clients', label: 'Clients', icon: Users }] : []),
    { id: 'goals', label: 'Goals', icon: Target },
    ...(isSuperAdmin || isManager ? [{ id: 'finance', label: 'Finance', icon: DollarSign }] : []),
    { id: 'reports', label: 'Reports', icon: FileText },
    { id: 'monthly-reports', label: 'Monthly Reports', icon: Calendar },
    { id: 'alerts', label: 'Alerts', icon: Bell },
    ...(isSuperAdmin ? [{ id: 'users', label: 'User Management', icon: UserCog }] : []),
    ...(!isClient ? [{ id: 'settings', label: 'Settings', icon: Settings }] : []),
  ];

  return (
    <div className="w-64 bg-white border-r border-slate-200 flex flex-col h-screen">
      <div className="p-6 border-b border-slate-200">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
            <LayoutDashboard className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800">Marketing Hub</h1>
            <p className="text-xs text-slate-500">{isSuperAdmin ? 'Agency' : 'Client'} Dashboard</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition ${
                isActive
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <div className="relative">
                <Icon className="w-5 h-5" />
                {item.id === 'alerts' && unreadAlerts > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                    {unreadAlerts > 9 ? '9+' : unreadAlerts}
                  </span>
                )}
              </div>
              <span className="font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-200">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center">
            <span className="text-sm font-semibold text-slate-600">
              {profile?.full_name?.charAt(0).toUpperCase() || 'U'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-800 truncate">{profile?.full_name}</p>
            <p className="text-xs text-slate-500 truncate">{profile?.email}</p>
          </div>
        </div>
        <div className="space-y-1">
          <button
            onClick={() => onViewChange('change-password')}
            className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-slate-600 hover:bg-slate-50 transition"
          >
            <Lock className="w-5 h-5" />
            <span className="font-medium">Change Password</span>
          </button>
          <button
            onClick={signOut}
            className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-slate-600 hover:bg-slate-50 transition"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
}
