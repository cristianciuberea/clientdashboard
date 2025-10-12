import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Users, TrendingUp, DollarSign, Activity, Plus, Search, Trash2, AlertTriangle, X } from 'lucide-react';
import StatCard from '../components/StatCard';
import type { Database } from '../lib/database.types';

type Client = Database['public']['Tables']['clients']['Row'];

interface ClientWithMetrics extends Client {
  total_spend?: number;
  total_conversions?: number;
  active_integrations?: number;
}

interface AgencyDashboardProps {
  onClientSelect?: (clientId: string) => void;
}

export default function AgencyDashboard({ onClientSelect }: AgencyDashboardProps) {
  const [clients, setClients] = useState<ClientWithMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddClient, setShowAddClient] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Error fetching clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClient = (client: Client) => {
    setClientToDelete(client);
    setDeleteConfirmation('');
  };

  const confirmDeleteClient = async () => {
    if (!clientToDelete) return;

    if (deleteConfirmation !== clientToDelete.name) {
      alert('Client name does not match. Please type the exact name to confirm deletion.');
      return;
    }

    try {
      const clientId = clientToDelete.id;
      const clientName = clientToDelete.name;

      // Delete in order: child records first, then parent

      // 1. Delete metrics snapshots
      const { error: metricsError } = await supabase
        .from('metrics_snapshots')
        .delete()
        .eq('client_id', clientId);

      if (metricsError) throw metricsError;

      // 2. Delete alerts
      const { error: alertsError } = await supabase
        .from('alerts')
        .delete()
        .eq('client_id', clientId);

      if (alertsError) throw alertsError;

      // 3. Delete client_users assignments
      const { error: clientUsersError } = await supabase
        .from('client_users')
        .delete()
        .eq('client_id', clientId);

      if (clientUsersError) throw clientUsersError;

      // 4. Delete integrations
      const { error: integrationsError } = await supabase
        .from('integrations')
        .delete()
        .eq('client_id', clientId);

      if (integrationsError) throw integrationsError;

      // 5. Delete report_shares
      const { error: reportSharesError } = await supabase
        .from('report_shares')
        .delete()
        .eq('client_id', clientId);

      if (reportSharesError) throw reportSharesError;

      // 6. Delete reports
      const { error: reportsError } = await supabase
        .from('reports')
        .delete()
        .eq('client_id', clientId);

      if (reportsError) throw reportsError;

      // 7. Finally, delete the client
      const { error: clientError } = await supabase
        .from('clients')
        .delete()
        .eq('id', clientId);

      if (clientError) throw clientError;

      alert(`Client "${clientName}" deleted successfully!`);
      setClientToDelete(null);
      setDeleteConfirmation('');
      fetchClients(); // Refresh list
    } catch (error: any) {
      console.error('Error deleting client:', error);
      alert(`Failed to delete client: ${error.message}`);
    }
  };

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.industry?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    totalClients: clients.length,
    activeClients: clients.filter(c => c.status === 'active').length,
    totalRevenue: clients.reduce((sum, c) => sum + (c.total_spend || 0), 0),
    avgConversions: clients.length > 0
      ? Math.round(clients.reduce((sum, c) => sum + (c.total_conversions || 0), 0) / clients.length)
      : 0,
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

  return (
    <div className="flex-1 overflow-auto bg-slate-50">
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800 mb-1">Agency Dashboard</h1>
          <p className="text-sm text-slate-600">Manage all your clients and track their performance</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard
            title="Total Clients"
            value={stats.totalClients}
            icon={Users}
            iconColor="bg-blue-500"
          />
          <StatCard
            title="Active Clients"
            value={stats.activeClients}
            change={`${Math.round((stats.activeClients / stats.totalClients) * 100)}% active`}
            changeType="positive"
            icon={Activity}
            iconColor="bg-green-500"
          />
          <StatCard
            title="Total Spend"
            value={`$${stats.totalRevenue.toLocaleString()}`}
            icon={DollarSign}
            iconColor="bg-purple-500"
          />
          <StatCard
            title="Avg Conversions"
            value={stats.avgConversions}
            icon={TrendingUp}
            iconColor="bg-orange-500"
          />
        </div>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-slate-800">Clients</h2>
              <button
                onClick={() => setShowAddClient(true)}
                className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition"
              >
                <Plus className="w-4 h-4" />
                <span>Add Client</span>
              </button>
            </div>

            <div className="relative">
              <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search clients..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Client
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Industry
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Website
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredClients.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <div className="text-slate-400">
                        <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p className="text-lg font-medium mb-1">No clients found</p>
                        <p className="text-sm">Add your first client to get started</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredClients.map((client) => (
                    <tr
                      key={client.id}
                      className="hover:bg-slate-50 transition cursor-pointer"
                      onClick={() => onClientSelect?.(client.id)}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-blue-600 rounded-lg flex items-center justify-center">
                            <span className="text-white font-semibold text-sm">
                              {client.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-slate-800">{client.name}</p>
                            <p className="text-sm text-slate-500">{client.slug}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {client.industry || '-'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          client.status === 'active' ? 'bg-green-100 text-green-800' :
                          client.status === 'paused' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-slate-100 text-slate-800'
                        }`}>
                          {client.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {client.website ? (
                          <a
                            href={client.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-700 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Visit
                          </a>
                        ) : '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {new Date(client.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteClient(client);
                          }}
                          className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition inline-flex items-center justify-center"
                          title="Delete Client"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showAddClient && (
        <AddClientModal onClose={() => setShowAddClient(false)} onSuccess={fetchClients} />
      )}

      {/* Delete Confirmation Modal */}
      {clientToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-800">Delete Client</h2>
                <p className="text-sm text-slate-600">This action cannot be undone</p>
              </div>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-red-800 font-medium mb-2">
                You are about to permanently delete:
              </p>
              <p className="text-lg font-bold text-red-900 mb-3">{clientToDelete.name}</p>
              <ul className="text-sm text-red-700 space-y-1 list-disc list-inside">
                <li>All integrations (Facebook Ads, WooCommerce, etc.)</li>
                <li>All metrics and historical data</li>
                <li>All alerts and notifications</li>
                <li>All reports and shared links</li>
                <li>All user assignments</li>
              </ul>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Type <span className="font-bold text-red-600">{clientToDelete.name}</span> to confirm:
              </label>
              <input
                type="text"
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                placeholder="Enter client name"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-end space-x-3">
              <button
                onClick={() => {
                  setClientToDelete(null);
                  setDeleteConfirmation('');
                }}
                className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg transition font-medium"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteClient}
                disabled={deleteConfirmation !== clientToDelete.name}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition font-medium disabled:bg-slate-300 disabled:cursor-not-allowed"
              >
                Delete Client
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AddClientModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    website: '',
    industry: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', (await supabase.auth.getUser()).data.user?.id)
        .maybeSingle();

      if (!profile?.organization_id) {
        throw new Error('Organization not found');
      }

      const { error: insertError } = await supabase
        .from('clients')
        .insert({
          organization_id: profile.organization_id,
          name: formData.name,
          slug: formData.slug.toLowerCase().replace(/\s+/g, '-'),
          website: formData.website || null,
          industry: formData.industry || null,
          status: 'active',
        });

      if (insertError) throw insertError;

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-md w-full p-6">
        <h2 className="text-2xl font-bold text-slate-800 mb-6">Add New Client</h2>

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
              {loading ? 'Creating...' : 'Create Client'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
