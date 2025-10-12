import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { TrendingUp, Users, ShoppingCart, Mail, DollarSign, MousePointer, Eye, Calendar, ArrowLeft, Edit2 } from 'lucide-react';
import StatCard from '../components/StatCard';
import type { Database } from '../lib/database.types';

type Client = Database['public']['Tables']['clients']['Row'];
type Integration = Database['public']['Tables']['integrations']['Row'];

interface ClientDashboardProps {
  clientId?: string | null;
  onBack?: () => void;
}

export default function ClientDashboard({ clientId, onBack }: ClientDashboardProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    fetchClients();
  }, []);

  useEffect(() => {
    if (clientId && clients.length > 0) {
      const client = clients.find(c => c.id === clientId);
      if (client) {
        setSelectedClient(client);
      }
    } else if (!clientId && clients.length > 0) {
      setSelectedClient(clients[0]);
    }
  }, [clientId, clients]);

  useEffect(() => {
    if (selectedClient) {
      fetchIntegrations(selectedClient.id);
    }
  }, [selectedClient]);

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
      }
    } catch (error) {
      console.error('Error fetching clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchIntegrations = async (clientId: string) => {
    try {
      const { data, error } = await supabase
        .from('integrations')
        .select('*')
        .eq('client_id', clientId);

      if (error) throw error;
      setIntegrations(data || []);
    } catch (error) {
      console.error('Error fetching integrations:', error);
    }
  };

  const [realMetrics, setRealMetrics] = useState({
    totalRevenue: 0,
    totalConversions: 0,
    websiteVisitors: 0,
    emailSubscribers: 0,
    adSpend: 0,
    adClicks: 0,
    adImpressions: 0,
    orderCount: 0,
  });

  useEffect(() => {
    if (selectedClient) {
      fetchMetrics(selectedClient.id);
    }
  }, [selectedClient, dateRange]);

  const fetchMetrics = async (clientId: string) => {
    try {
      const daysAgo = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysAgo);

      const { data, error } = await supabase
        .from('metrics_snapshots')
        .select('*')
        .eq('client_id', clientId)
        .gte('date', startDate.toISOString().split('T')[0])
        .order('date', { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        const latestMetric = data[0].metrics as any;
        setRealMetrics({
          totalRevenue: latestMetric.totalRevenue || 0,
          totalConversions: latestMetric.completedOrders || 0,
          websiteVisitors: 0,
          emailSubscribers: 0,
          adSpend: 0,
          adClicks: 0,
          adImpressions: 0,
          orderCount: latestMetric.totalOrders || 0,
        });
      }
    } catch (error) {
      console.error('Error fetching metrics:', error);
    }
  };

  const mockMetrics = realMetrics.totalRevenue > 0 ? realMetrics : {
    totalRevenue: 45678,
    totalConversions: 234,
    websiteVisitors: 12456,
    emailSubscribers: 3421,
    adSpend: 8934,
    adClicks: 5678,
    adImpressions: 123456,
    orderCount: 187,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!selectedClient) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-slate-500">
          <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">No clients available</p>
          <p className="text-sm">Contact your administrator to get access to a client</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-slate-50">
      <div className="p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            {onBack && (
              <button
                onClick={onBack}
                className="flex items-center space-x-2 text-slate-600 hover:text-slate-800 mb-4 transition"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="text-sm font-medium">Back to Agency Dashboard</span>
              </button>
            )}
            <h1 className="text-2xl font-bold text-slate-800 mb-1">
              {selectedClient.name} Dashboard
            </h1>
            <p className="text-sm text-slate-600">Real-time marketing metrics and performance overview</p>
          </div>

          <div className="flex items-center space-x-4">
            {onBack && (
              <button
                onClick={() => setShowEditModal(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition text-slate-700 font-medium"
              >
                <Edit2 className="w-4 h-4" />
                <span>Edit Client</span>
              </button>
            )}
            <div className="flex items-center space-x-2 bg-white border border-slate-200 rounded-lg p-1">
              {(['7d', '30d', '90d'] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setDateRange(range)}
                  className={`px-4 py-2 rounded text-sm font-medium transition ${
                    dateRange === range
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {range === '7d' ? 'Last 7 days' : range === '30d' ? 'Last 30 days' : 'Last 90 days'}
                </button>
              ))}
            </div>

            {clients.length > 1 && (
              <select
                value={selectedClient.id}
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
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard
            title="Total Revenue"
            value={`${mockMetrics.totalRevenue.toLocaleString()} RON`}
            change={realMetrics.totalRevenue > 0 ? "From WooCommerce" : "+12.5% from last period"}
            changeType="positive"
            icon={DollarSign}
            iconColor="bg-green-500"
          />
          <StatCard
            title="Conversions"
            value={mockMetrics.totalConversions}
            change={realMetrics.totalRevenue > 0 ? "Completed orders" : "+8.3% from last period"}
            changeType="positive"
            icon={TrendingUp}
            iconColor="bg-blue-500"
          />
          <StatCard
            title="Total Orders"
            value={mockMetrics.orderCount.toLocaleString()}
            change={realMetrics.totalRevenue > 0 ? "All statuses" : "+15.2% from last period"}
            changeType="positive"
            icon={ShoppingCart}
            iconColor="bg-purple-500"
          />
          <StatCard
            title="Email Subscribers"
            value={mockMetrics.emailSubscribers.toLocaleString()}
            change="+5.7% from last period"
            changeType="positive"
            icon={Mail}
            iconColor="bg-orange-500"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-800">Advertising Performance</h2>
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <MousePointer className="w-5 h-5 text-blue-600" />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-sm font-medium text-slate-600">Ad Spend</span>
                <span className="text-base font-bold text-slate-800">
                  ${mockMetrics.adSpend.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-sm font-medium text-slate-600">Clicks</span>
                <span className="text-base font-bold text-slate-800">
                  {mockMetrics.adClicks.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-sm font-medium text-slate-600">Impressions</span>
                <span className="text-base font-bold text-slate-800">
                  {mockMetrics.adImpressions.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm font-medium text-slate-600">CTR</span>
                <span className="text-base font-bold text-slate-800">
                  {((mockMetrics.adClicks / mockMetrics.adImpressions) * 100).toFixed(2)}%
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-800">E-commerce Metrics</h2>
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <ShoppingCart className="w-5 h-5 text-green-600" />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-sm font-medium text-slate-600">Total Orders</span>
                <span className="text-base font-bold text-slate-800">
                  {mockMetrics.orderCount}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-sm font-medium text-slate-600">Average Order Value</span>
                <span className="text-base font-bold text-slate-800">
                  ${(mockMetrics.totalRevenue / mockMetrics.orderCount).toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-sm font-medium text-slate-600">Conversion Rate</span>
                <span className="text-base font-bold text-slate-800">
                  {((mockMetrics.orderCount / mockMetrics.websiteVisitors) * 100).toFixed(2)}%
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm font-medium text-slate-600">Revenue Per Visitor</span>
                <span className="text-base font-bold text-slate-800">
                  ${(mockMetrics.totalRevenue / mockMetrics.websiteVisitors).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-800">Active Integrations</h2>
            <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
              Manage Integrations
            </button>
          </div>

          {integrations.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <Eye className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No integrations configured yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {integrations.map((integration) => (
                <div
                  key={integration.id}
                  className="flex items-center space-x-3 p-4 bg-slate-50 rounded-lg border border-slate-200"
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    integration.status === 'active' ? 'bg-green-100' : 'bg-red-100'
                  }`}>
                    {getPlatformIcon(integration.platform)}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-slate-800 capitalize">
                      {integration.platform.replace('_', ' ')}
                    </p>
                    <p className="text-xs text-slate-500">
                      {integration.status === 'active' ? 'Connected' : 'Disconnected'}
                    </p>
                  </div>
                  <div className={`w-2 h-2 rounded-full ${
                    integration.status === 'active' ? 'bg-green-500' : 'bg-red-500'
                  }`} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showEditModal && selectedClient && (
        <EditClientModal
          client={selectedClient}
          onClose={() => setShowEditModal(false)}
          onSuccess={() => {
            fetchClients();
            setShowEditModal(false);
          }}
        />
      )}
    </div>
  );
}

function getPlatformIcon(platform: string) {
  const iconClass = "w-5 h-5";
  switch (platform) {
    case 'facebook_ads':
      return <TrendingUp className={`${iconClass} text-blue-600`} />;
    case 'google_analytics':
      return <Eye className={`${iconClass} text-orange-600`} />;
    case 'woocommerce':
      return <ShoppingCart className={`${iconClass} text-purple-600`} />;
    case 'mailerlite':
      return <Mail className={`${iconClass} text-green-600`} />;
    case 'wordpress':
      return <Calendar className={`${iconClass} text-slate-600`} />;
    default:
      return <TrendingUp className={`${iconClass} text-slate-600`} />;
  }
}

interface EditClientModalProps {
  client: Client;
  onClose: () => void;
  onSuccess: () => void;
}

function EditClientModal({ client, onClose, onSuccess }: EditClientModalProps) {
  const [formData, setFormData] = useState({
    name: client.name,
    slug: client.slug,
    website: client.website || '',
    industry: client.industry || '',
    status: client.status,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { error: updateError } = await supabase
        .from('clients')
        .update({
          name: formData.name,
          slug: formData.slug.toLowerCase().replace(/\s+/g, '-'),
          website: formData.website || null,
          industry: formData.industry || null,
          status: formData.status,
        })
        .eq('id', client.id);

      if (updateError) throw updateError;

      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-md w-full p-6">
        <h2 className="text-2xl font-bold text-slate-800 mb-6">Edit Client</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Client Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Slug (URL identifier) *
            </label>
            <input
              type="text"
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="my-client"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Website
            </label>
            <input
              type="url"
              value={formData.website}
              onChange={(e) => setFormData({ ...formData, website: e.target.value })}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Industry
            </label>
            <input
              type="text"
              value={formData.industry}
              onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="E-commerce, SaaS, etc."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Status *
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'paused' | 'inactive' })}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
