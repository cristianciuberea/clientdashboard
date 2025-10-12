import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Facebook, TrendingUp, ShoppingCart, Mail, FileCode, Plus, Check, X, RefreshCw } from 'lucide-react';
import type { Database } from '../lib/database.types';

type Client = Database['public']['Tables']['clients']['Row'];
type Integration = Database['public']['Tables']['integrations']['Row'];

interface PlatformConfig {
  id: string;
  name: string;
  description: string;
  icon: any;
  color: string;
  fields: Array<{
    name: string;
    label: string;
    type: string;
    placeholder: string;
    required: boolean;
  }>;
}

const platforms: PlatformConfig[] = [
  {
    id: 'facebook_ads',
    name: 'Facebook Ads',
    description: 'Connect your Facebook Ads account to track campaign performance',
    icon: Facebook,
    color: 'bg-blue-500',
    fields: [
      { name: 'access_token', label: 'Access Token', type: 'password', placeholder: 'Enter your Facebook Access Token', required: true },
      { name: 'ad_account_id', label: 'Ad Account ID', type: 'text', placeholder: 'act_1234567890', required: true },
    ],
  },
  {
    id: 'google_analytics',
    name: 'Google Analytics',
    description: 'Sync website traffic and user behavior data',
    icon: TrendingUp,
    color: 'bg-orange-500',
    fields: [
      { name: 'property_id', label: 'Property ID', type: 'text', placeholder: 'GA4-XXXXXXXXX', required: true },
      { name: 'credentials', label: 'Service Account JSON', type: 'textarea', placeholder: 'Paste service account credentials', required: true },
    ],
  },
  {
    id: 'woocommerce',
    name: 'WooCommerce',
    description: 'Track e-commerce sales and product performance',
    icon: ShoppingCart,
    color: 'bg-purple-500',
    fields: [
      { name: 'store_url', label: 'Store URL', type: 'url', placeholder: 'https://your-store.com', required: true },
      { name: 'consumer_key', label: 'Consumer Key', type: 'text', placeholder: 'ck_xxxxx', required: true },
      { name: 'consumer_secret', label: 'Consumer Secret', type: 'password', placeholder: 'cs_xxxxx', required: true },
    ],
  },
  {
    id: 'mailerlite',
    name: 'MailerLite',
    description: 'Monitor email campaigns and subscriber growth',
    icon: Mail,
    color: 'bg-green-500',
    fields: [
      { name: 'api_key', label: 'API Key', type: 'password', placeholder: 'Enter MailerLite API key', required: true },
    ],
  },
  {
    id: 'wordpress',
    name: 'WordPress Analytics',
    description: 'Connect custom WordPress analytics plugin',
    icon: FileCode,
    color: 'bg-slate-500',
    fields: [
      { name: 'site_url', label: 'Site URL', type: 'url', placeholder: 'https://your-site.com', required: true },
      { name: 'api_key', label: 'API Key', type: 'password', placeholder: 'Enter API key', required: true },
      { name: 'endpoint', label: 'API Endpoint', type: 'text', placeholder: '/wp-json/analytics/v1', required: true },
    ],
  },
];

export default function IntegrationsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformConfig | null>(null);

  useEffect(() => {
    fetchClients();
  }, []);

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
        setSelectedClient(data[0]);
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

  const handleDisconnect = async (integrationId: string) => {
    if (!confirm('Are you sure you want to disconnect this integration?')) return;

    try {
      const { error } = await supabase
        .from('integrations')
        .delete()
        .eq('id', integrationId);

      if (error) throw error;

      if (selectedClient) {
        fetchIntegrations(selectedClient.id);
      }
    } catch (error) {
      console.error('Error disconnecting integration:', error);
      alert('Failed to disconnect integration');
    }
  };

  const handleSync = async (integration: Integration, platform: PlatformConfig) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-${platform.id.replace('_', '-')}`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          integration_id: integration.id,
          client_id: integration.client_id,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        alert('Sync completed successfully!');
        if (selectedClient) {
          fetchIntegrations(selectedClient.id);
        }
      } else {
        throw new Error(result.error || 'Sync failed');
      }
    } catch (error: any) {
      console.error('Error syncing:', error);
      alert(`Sync failed: ${error.message}`);
    }
  };

  const handleAddIntegration = (platform: PlatformConfig) => {
    setSelectedPlatform(platform);
    setShowAddModal(true);
  };

  const getIntegrationStatus = (platformId: string) => {
    return integrations.find(i => i.platform === platformId);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Loading integrations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-slate-50">
      <div className="p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 mb-1">Integrations</h1>
            <p className="text-sm text-slate-600">Connect and manage your marketing platforms</p>
          </div>

          {clients.length > 1 && (
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
        </div>

        {selectedClient && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
            <p className="text-sm text-blue-800">
              <span className="font-semibold">Currently managing:</span> {selectedClient.name}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {platforms.map((platform) => {
            const Icon = platform.icon;
            const integration = getIntegrationStatus(platform.id);
            const isConnected = integration?.status === 'active';

            return (
              <div
                key={platform.id}
                className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-md transition"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-12 h-12 ${platform.color} rounded-lg flex items-center justify-center`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  {isConnected ? (
                    <div className="flex items-center space-x-1 text-green-600 text-sm font-medium">
                      <Check className="w-4 h-4" />
                      <span>Connected</span>
                    </div>
                  ) : integration?.status === 'error' ? (
                    <div className="flex items-center space-x-1 text-red-600 text-sm font-medium">
                      <X className="w-4 h-4" />
                      <span>Error</span>
                    </div>
                  ) : (
                    <div className="text-slate-400 text-sm font-medium">Not connected</div>
                  )}
                </div>

                <h3 className="text-lg font-bold text-slate-800 mb-2">{platform.name}</h3>
                <p className="text-sm text-slate-600 mb-6 line-clamp-2">{platform.description}</p>

                {isConnected ? (
                  <div className="space-y-2">
                    <button
                      onClick={() => integration && handleSync(integration, platform)}
                      className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition text-sm font-medium"
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>Sync Now</span>
                    </button>
                    <button
                      onClick={() => integration && handleDisconnect(integration.id)}
                      className="w-full px-4 py-2 border border-red-200 hover:bg-red-50 text-red-600 rounded-lg transition text-sm font-medium"
                    >
                      Disconnect
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => handleAddIntegration(platform)}
                    disabled={!selectedClient}
                    className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Connect</span>
                  </button>
                )}

                {integration?.last_sync_at && (
                  <p className="text-xs text-slate-500 mt-3">
                    Last synced: {new Date(integration.last_sync_at).toLocaleString()}
                  </p>
                )}

                {integration?.error_message && (
                  <p className="text-xs text-red-600 mt-2">
                    Error: {integration.error_message}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {showAddModal && selectedPlatform && selectedClient && (
        <AddIntegrationModal
          platform={selectedPlatform}
          client={selectedClient}
          onClose={() => {
            setShowAddModal(false);
            setSelectedPlatform(null);
          }}
          onSuccess={() => {
            fetchIntegrations(selectedClient.id);
            setShowAddModal(false);
            setSelectedPlatform(null);
          }}
        />
      )}
    </div>
  );
}

function AddIntegrationModal({
  platform,
  client,
  onClose,
  onSuccess,
}: {
  platform: PlatformConfig;
  client: Client;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [orderStatuses, setOrderStatuses] = useState<string[]>(['processing', 'completed']);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const config = platform.id === 'woocommerce'
        ? { order_statuses: orderStatuses }
        : {};

      const { error: insertError } = await supabase
        .from('integrations')
        .insert({
          client_id: client.id,
          platform: platform.id as any,
          status: 'active',
          credentials: formData,
          config: config,
        });

      if (insertError) throw insertError;
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const Icon = platform.icon;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center space-x-3 mb-6">
          <div className={`w-12 h-12 ${platform.color} rounded-lg flex items-center justify-center`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Connect {platform.name}</h2>
            <p className="text-sm text-slate-500">{client.name}</p>
          </div>
        </div>

        {platform.id === 'facebook_ads' && (
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-blue-900 mb-2">How to get your credentials:</h3>
            <ol className="text-xs text-blue-800 space-y-2 list-decimal list-inside">
              <li>
                <strong>Access Token:</strong> Go to{' '}
                <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-600">
                  Graph API Explorer
                </a>
                , select your app, request permissions: <code className="bg-blue-100 px-1 rounded">ads_read</code>, <code className="bg-blue-100 px-1 rounded">ads_management</code>
              </li>
              <li>
                <strong>Ad Account ID:</strong> Go to{' '}
                <a href="https://business.facebook.com/settings/ad-accounts" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-600">
                  Business Settings → Ad Accounts
                </a>
                . Your ID format: <code className="bg-blue-100 px-1 rounded">act_XXXXX</code>
              </li>
              <li>
                <strong>For production:</strong> Use a System User Token from{' '}
                <a href="https://business.facebook.com/settings/system-users" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-600">
                  Business Settings → System Users
                </a>
                {' '}(never expires)
              </li>
            </ol>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {platform.fields.map((field) => (
            <div key={field.name}>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                {field.label} {field.required && <span className="text-red-500">*</span>}
              </label>
              {field.type === 'textarea' ? (
                <textarea
                  value={formData[field.name] || ''}
                  onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  placeholder={field.placeholder}
                  required={field.required}
                  rows={4}
                />
              ) : (
                <input
                  type={field.type}
                  value={formData[field.name] || ''}
                  onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={field.placeholder}
                  required={field.required}
                />
              )}
              {platform.id === 'facebook_ads' && field.name === 'ad_account_id' && (
                <p className="text-xs text-slate-500 mt-1">
                  Must start with "act_" (e.g., act_1234567890)
                </p>
              )}
            </div>
          ))}

          {platform.id === 'woocommerce' && (
            <div className="border-t border-slate-200 pt-4">
              <label className="block text-sm font-medium text-slate-700 mb-3">
                Order Statuses to Count <span className="text-slate-500 font-normal">(metrics will only include these)</span>
              </label>
              <div className="space-y-2">
                {['pending', 'processing', 'completed', 'on-hold', 'cancelled', 'refunded', 'failed'].map((status) => (
                  <label key={status} className="flex items-center space-x-3 p-2 hover:bg-slate-50 rounded-lg cursor-pointer">
                    <input
                      type="checkbox"
                      checked={orderStatuses.includes(status)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setOrderStatuses([...orderStatuses, status]);
                        } else {
                          setOrderStatuses(orderStatuses.filter(s => s !== status));
                        }
                      }}
                      className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-slate-700 capitalize">{status.replace('-', ' ')}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Currently selected: {orderStatuses.join(', ') || 'none'}
              </p>
            </div>
          )}

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
              {loading ? 'Connecting...' : 'Connect'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
