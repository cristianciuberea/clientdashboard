import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Bell, AlertTriangle, Info, CheckCircle, XCircle, Filter, Check, Trash2, Settings } from 'lucide-react';
import type { Database } from '../lib/database.types';

type Alert = Database['public']['Tables']['alerts']['Row'];
type Client = Database['public']['Tables']['clients']['Row'];

type AlertType = 'budget' | 'performance' | 'integration_error' | 'goal_reached' | 'info';
type Severity = 'info' | 'warning' | 'critical';

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<AlertType | 'all'>('all');
  const [filterSeverity, setFilterSeverity] = useState<Severity | 'all'>('all');
  const [filterRead, setFilterRead] = useState<'all' | 'read' | 'unread'>('all');
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    fetchClients();
  }, []);

  useEffect(() => {
    if (selectedClient) {
      fetchAlerts(selectedClient.id);
    }
  }, [selectedClient, filterType, filterSeverity, filterRead]);

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('status', 'active')
        .order('name');

      if (error) throw error;

      if (data && data.length > 0) {
        setClients(data);
        setSelectedClient(data[0]);
      }
    } catch (error) {
      console.error('Error fetching clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAlerts = async (clientId: string) => {
    try {
      let query = supabase
        .from('alerts')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

      if (filterType !== 'all') {
        query = query.eq('type', filterType);
      }

      if (filterSeverity !== 'all') {
        query = query.eq('severity', filterSeverity);
      }

      if (filterRead === 'read') {
        query = query.eq('is_read', true);
      } else if (filterRead === 'unread') {
        query = query.eq('is_read', false);
      }

      const { data, error } = await query;

      if (error) throw error;
      setAlerts(data || []);
    } catch (error) {
      console.error('Error fetching alerts:', error);
    }
  };

  const markAsRead = async (alertId: string, isRead: boolean) => {
    try {
      const { error } = await supabase
        .from('alerts')
        .update({ is_read: isRead })
        .eq('id', alertId);

      if (error) throw error;

      if (selectedClient) {
        fetchAlerts(selectedClient.id);
      }
    } catch (error) {
      console.error('Error updating alert:', error);
    }
  };

  const deleteAlert = async (alertId: string) => {
    if (!confirm('Are you sure you want to delete this alert?')) return;

    try {
      const { error } = await supabase
        .from('alerts')
        .delete()
        .eq('id', alertId);

      if (error) throw error;

      if (selectedClient) {
        fetchAlerts(selectedClient.id);
      }
    } catch (error) {
      console.error('Error deleting alert:', error);
    }
  };

  const markAllAsRead = async () => {
    if (!selectedClient) return;

    try {
      const { error } = await supabase
        .from('alerts')
        .update({ is_read: true })
        .eq('client_id', selectedClient.id)
        .eq('is_read', false);

      if (error) throw error;

      fetchAlerts(selectedClient.id);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'budget':
        return DollarSignIcon;
      case 'performance':
        return AlertTriangle;
      case 'integration_error':
        return XCircle;
      case 'goal_reached':
        return CheckCircle;
      default:
        return Info;
    }
  };

  const getSeverityColors = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      default:
        return 'bg-blue-50 border-blue-200 text-blue-800';
    }
  };

  const getSeverityIconBg = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-600';
      case 'warning':
        return 'bg-yellow-100 text-yellow-600';
      default:
        return 'bg-blue-100 text-blue-600';
    }
  };

  const unreadCount = alerts.filter(a => !a.is_read).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Loading alerts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-slate-50 p-8 overflow-auto">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Alerts</h1>
            <p className="text-slate-600">Monitor important events and notifications</p>
          </div>

          <button
            onClick={() => setShowSettings(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition font-medium"
          >
            <Settings className="w-4 h-4" />
            <span>Settings</span>
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            {clients.length > 0 && (
              <select
                value={selectedClient?.id || ''}
                onChange={(e) => {
                  const client = clients.find(c => c.id === e.target.value);
                  setSelectedClient(client || null);
                }}
                className="px-4 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {clients.map(client => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            )}

            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as AlertType | 'all')}
                className="px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="all">All Types</option>
                <option value="budget">Budget</option>
                <option value="performance">Performance</option>
                <option value="integration_error">Integration Error</option>
                <option value="goal_reached">Goal Reached</option>
                <option value="info">Info</option>
              </select>

              <select
                value={filterSeverity}
                onChange={(e) => setFilterSeverity(e.target.value as Severity | 'all')}
                className="px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="all">All Severities</option>
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="critical">Critical</option>
              </select>

              <select
                value={filterRead}
                onChange={(e) => setFilterRead(e.target.value as 'all' | 'read' | 'unread')}
                className="px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="all">All Alerts</option>
                <option value="unread">Unread</option>
                <option value="read">Read</option>
              </select>
            </div>

            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="ml-auto flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-medium text-sm"
              >
                <Check className="w-4 h-4" />
                <span>Mark All Read</span>
              </button>
            )}
          </div>

          {unreadCount > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-200">
              <p className="text-sm text-slate-600">
                <span className="font-semibold text-blue-600">{unreadCount}</span> unread alert{unreadCount !== 1 ? 's' : ''}
              </p>
            </div>
          )}
        </div>

        {alerts.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
            <Bell className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No alerts</h3>
            <p className="text-slate-600">You're all caught up! No alerts to display.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) => {
              const Icon = getAlertIcon(alert.type);
              const severityColors = getSeverityColors(alert.severity);
              const iconBg = getSeverityIconBg(alert.severity);

              return (
                <div
                  key={alert.id}
                  className={`bg-white rounded-xl shadow-sm border-2 transition hover:shadow-md ${
                    alert.is_read ? 'border-slate-100 opacity-75' : severityColors
                  }`}
                >
                  <div className="p-6">
                    <div className="flex items-start space-x-4">
                      <div className={`p-3 rounded-xl ${iconBg}`}>
                        <Icon className="w-6 h-6" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h3 className="text-lg font-semibold text-slate-900 mb-1">
                              {alert.title}
                            </h3>
                            <p className="text-sm text-slate-600">{alert.message}</p>
                          </div>

                          <div className="flex items-center space-x-2 ml-4">
                            <button
                              onClick={() => markAsRead(alert.id, !alert.is_read)}
                              className="p-2 hover:bg-slate-100 rounded-lg transition"
                              title={alert.is_read ? 'Mark as unread' : 'Mark as read'}
                            >
                              {alert.is_read ? (
                                <Bell className="w-4 h-4 text-slate-400" />
                              ) : (
                                <Check className="w-4 h-4 text-green-600" />
                              )}
                            </button>

                            <button
                              onClick={() => deleteAlert(alert.id)}
                              className="p-2 hover:bg-red-50 rounded-lg transition"
                              title="Delete alert"
                            >
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center space-x-4 text-xs text-slate-500">
                          <span className="font-medium capitalize">{alert.type.replace('_', ' ')}</span>
                          <span>•</span>
                          <span className="capitalize">{alert.severity}</span>
                          <span>•</span>
                          <span>{new Date(alert.created_at).toLocaleString()}</span>
                        </div>

                        {alert.metadata && typeof alert.metadata === 'object' && Object.keys(alert.metadata).length > 0 && (
                          <div className="mt-3 p-3 bg-slate-50 rounded-lg">
                            <p className="text-xs font-medium text-slate-700 mb-2">Details:</p>
                            <div className="text-xs text-slate-600 space-y-1">
                              {Object.entries(alert.metadata).map(([key, value]) => (
                                <div key={key} className="flex justify-between">
                                  <span className="font-medium capitalize">{key.replace(/_/g, ' ')}:</span>
                                  <span>{String(value)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showSettings && (
        <AlertSettingsModal
          clientId={selectedClient?.id || ''}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

function DollarSignIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

interface AlertSettingsModalProps {
  clientId: string;
  onClose: () => void;
}

function AlertSettingsModal({ clientId, onClose }: AlertSettingsModalProps) {
  const [settings, setSettings] = useState({
    budgetThreshold: 90,
    performanceDropThreshold: 20,
    enableEmailNotifications: true,
    enableBudgetAlerts: true,
    enablePerformanceAlerts: true,
    enableIntegrationAlerts: true,
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-auto">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-2xl font-bold text-slate-900">Alert Settings</h2>
          <p className="text-sm text-slate-600 mt-1">Configure when and how you receive alerts</p>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Thresholds</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Budget Alert Threshold
                </label>
                <div className="flex items-center space-x-4">
                  <input
                    type="range"
                    min="50"
                    max="100"
                    value={settings.budgetThreshold}
                    onChange={(e) => setSettings({ ...settings, budgetThreshold: parseInt(e.target.value) })}
                    className="flex-1"
                  />
                  <span className="text-sm font-semibold text-slate-700 w-12">{settings.budgetThreshold}%</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">Alert when budget usage exceeds this percentage</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Performance Drop Threshold
                </label>
                <div className="flex items-center space-x-4">
                  <input
                    type="range"
                    min="10"
                    max="50"
                    value={settings.performanceDropThreshold}
                    onChange={(e) => setSettings({ ...settings, performanceDropThreshold: parseInt(e.target.value) })}
                    className="flex-1"
                  />
                  <span className="text-sm font-semibold text-slate-700 w-12">{settings.performanceDropThreshold}%</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">Alert when metrics drop by this percentage</p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Alert Types</h3>

            <div className="space-y-3">
              <label className="flex items-center space-x-3 p-3 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition">
                <input
                  type="checkbox"
                  checked={settings.enableBudgetAlerts}
                  onChange={(e) => setSettings({ ...settings, enableBudgetAlerts: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <div>
                  <p className="font-medium text-slate-900">Budget Alerts</p>
                  <p className="text-xs text-slate-600">Get notified about budget changes</p>
                </div>
              </label>

              <label className="flex items-center space-x-3 p-3 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition">
                <input
                  type="checkbox"
                  checked={settings.enablePerformanceAlerts}
                  onChange={(e) => setSettings({ ...settings, enablePerformanceAlerts: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <div>
                  <p className="font-medium text-slate-900">Performance Alerts</p>
                  <p className="text-xs text-slate-600">Get notified about performance changes</p>
                </div>
              </label>

              <label className="flex items-center space-x-3 p-3 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition">
                <input
                  type="checkbox"
                  checked={settings.enableIntegrationAlerts}
                  onChange={(e) => setSettings({ ...settings, enableIntegrationAlerts: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <div>
                  <p className="font-medium text-slate-900">Integration Alerts</p>
                  <p className="text-xs text-slate-600">Get notified about integration issues</p>
                </div>
              </label>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Notifications</h3>

            <label className="flex items-center space-x-3 p-3 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition">
              <input
                type="checkbox"
                checked={settings.enableEmailNotifications}
                onChange={(e) => setSettings({ ...settings, enableEmailNotifications: e.target.checked })}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <div>
                <p className="font-medium text-slate-900">Email Notifications</p>
                <p className="text-xs text-slate-600">Receive alerts via email</p>
              </div>
            </label>
          </div>
        </div>

        <div className="p-6 border-t border-slate-200 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition font-medium"
          >
            Cancel
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-medium"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}
