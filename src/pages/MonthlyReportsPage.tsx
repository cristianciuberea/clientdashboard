import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Database } from '../lib/database.types';
import { Calendar, Download, Filter, RefreshCw } from 'lucide-react';

type Client = Database['public']['Tables']['clients']['Row'];

interface DailyMetrics {
  date: string;
  // Facebook metrics
  fbAdSpend: number;
  fbRevenue: number;
  fbRoas: number;
  fbCpm: number;
  fbImpressions: number;
  fbLinkClicks: number;
  fbLandingPageViews: number;
  fbLpViewRate: number;
  fbConversions: number;
  fbConversionRate: number;
  fbCtr: number;
  fbCostPerLinkClick: number;
  fbCpcTotal: number;
  // WooCommerce metrics
  wcTotalOrders: number;
  wcCodulDestinuluiOrders: number;
  wcCodulDestinului2Orders: number;
  wcInfluentaDecadeiOrders: number;
  wcTotalRevenue: number;
}

export default function MonthlyReportsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [dailyMetrics, setDailyMetrics] = useState<DailyMetrics[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM format
  const [syncing, setSyncing] = useState(false);

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

  const fetchDailyMetrics = useCallback(async (clientId: string, month: string) => {
    try {
      setLoading(true);
      
      // Get date range for the selected month
      const startDate = `${month}-01`;
      const endDate = new Date(new Date(startDate).getFullYear(), new Date(startDate).getMonth() + 1, 0)
        .toISOString().split('T')[0];

      console.log('Fetching daily metrics for:', { clientId, startDate, endDate });

      // Fetch Facebook snapshots
      const { data: fbSnapshots, error: fbError } = await supabase
        .from('metrics_snapshots')
        .select('*')
        .eq('client_id', clientId)
        .eq('platform', 'facebook_ads')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true });

      if (fbError) throw fbError;

      // Fetch WooCommerce snapshots
      const { data: wcSnapshots, error: wcError } = await supabase
        .from('metrics_snapshots')
        .select('*')
        .eq('client_id', clientId)
        .eq('platform', 'woocommerce')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true });

      if (wcError) throw wcError;

      console.log('Snapshots fetched:', { 
        fbCount: fbSnapshots?.length || 0, 
        wcCount: wcSnapshots?.length || 0 
      });

      // Process snapshots by date
      const dailyData: { [date: string]: DailyMetrics } = {};

      // Initialize all days in the month with 0 values
      const daysInMonth = new Date(new Date(startDate).getFullYear(), new Date(startDate).getMonth() + 1, 0).getDate();
      for (let day = 1; day <= daysInMonth; day++) {
        const date = `${month}-${day.toString().padStart(2, '0')}`;
        dailyData[date] = {
          date,
          fbAdSpend: 0,
          fbRevenue: 0,
          fbRoas: 0,
          fbCpm: 0,
          fbImpressions: 0,
          fbLinkClicks: 0,
          fbLandingPageViews: 0,
          fbLpViewRate: 0,
          fbConversions: 0,
          fbConversionRate: 0,
          fbCtr: 0,
          fbCostPerLinkClick: 0,
          fbCpcTotal: 0,
          wcTotalOrders: 0,
          wcCodulDestinuluiOrders: 0,
          wcCodulDestinului2Orders: 0,
          wcInfluentaDecadeiOrders: 0,
          wcTotalRevenue: 0,
        };
      }

      // Process Facebook snapshots
      if (fbSnapshots) {
        for (const snapshot of fbSnapshots) {
          const metrics = snapshot.metrics as any;
          const date = snapshot.date;
          
          if (dailyData[date]) {
            dailyData[date].fbAdSpend = metrics.spend || 0;
            dailyData[date].fbCpm = metrics.cpm || 0;
            dailyData[date].fbImpressions = metrics.impressions || 0;
            dailyData[date].fbLinkClicks = metrics.link_clicks || 0;
            dailyData[date].fbLandingPageViews = metrics.landing_page_views || 0;
            dailyData[date].fbLpViewRate = metrics.landing_page_view_rate || 0;
            dailyData[date].fbConversions = metrics.conversions || 0;
            dailyData[date].fbConversionRate = metrics.conversion_rate || 0;
            dailyData[date].fbCtr = metrics.ctr || 0;
            dailyData[date].fbCostPerLinkClick = metrics.cost_per_link_click || 0;
            dailyData[date].fbCpcTotal = metrics.cpc || 0;
          }
        }
      }

      // Process WooCommerce snapshots
      if (wcSnapshots) {
        for (const snapshot of wcSnapshots) {
          const metrics = snapshot.metrics as any;
          const date = snapshot.date;
          
          if (dailyData[date]) {
            dailyData[date].wcTotalOrders = metrics.totalOrders || 0;
            dailyData[date].wcTotalRevenue = metrics.totalRevenue || 0;
            
            // Count specific product orders
            if (metrics.topProducts) {
              for (const product of metrics.topProducts) {
                if (product.name.includes('Codul Destinului') && !product.name.includes('2')) {
                  dailyData[date].wcCodulDestinuluiOrders += product.quantity || 0;
                } else if (product.name.includes('Codul Destinului 2')) {
                  dailyData[date].wcCodulDestinului2Orders += product.quantity || 0;
                } else if (product.name.includes('INFLUENȚA DECADEI în care te-ai născut (complet)')) {
                  dailyData[date].wcInfluentaDecadeiOrders += product.quantity || 0;
                }
              }
            }
          }
        }
      }

      // Calculate Facebook ROAS and Revenue
      Object.values(dailyData).forEach(day => {
        if (day.fbAdSpend > 0) {
          day.fbRoas = day.wcTotalRevenue / day.fbAdSpend;
          day.fbRevenue = day.wcTotalRevenue; // Assuming all revenue comes from Facebook
        }
      });

      const sortedMetrics = Object.values(dailyData).sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      setDailyMetrics(sortedMetrics);
    } catch (error) {
      console.error('Error fetching daily metrics:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClients();
  }, []);

  useEffect(() => {
    if (selectedClient) {
      fetchDailyMetrics(selectedClient.id, selectedMonth);
    }
  }, [selectedClient, selectedMonth, fetchDailyMetrics]);

  const handleSync = async () => {
    if (!selectedClient) return;
    
    setSyncing(true);
    try {
      // Trigger sync for all integrations
      const { data: integrations } = await supabase
        .from('integrations')
        .select('*')
        .eq('client_id', selectedClient.id)
        .eq('status', 'active');

      if (integrations) {
        for (const integration of integrations) {
          const functionName = `sync-${integration.platform}`;
          const response = await fetch(`/api/functions/v1/${functionName}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              integration_id: integration.id,
              client_id: selectedClient.id,
              date_from: `${selectedMonth}-01`,
              date_to: new Date(new Date(`${selectedMonth}-01`).getFullYear(), new Date(`${selectedMonth}-01`).getMonth() + 1, 0).toISOString().split('T')[0]
            })
          });
          
          if (!response.ok) {
            console.error(`Sync failed for ${integration.platform}:`, await response.text());
          }
        }
      }

      // Refresh data after sync
      await fetchDailyMetrics(selectedClient.id, selectedMonth);
    } catch (error) {
      console.error('Error syncing:', error);
    } finally {
      setSyncing(false);
    }
  };

  const exportToCSV = () => {
    const headers = [
      'Date',
      'FB Ad Spend (RON)',
      'FB Revenue (RON)',
      'FB ROAS',
      'FB CPM (RON)',
      'FB Impressions',
      'FB Link Clicks',
      'FB Landing Page Views',
      'FB LP View Rate (%)',
      'FB Conversions',
      'FB Conversion Rate (%)',
      'FB CTR (%)',
      'FB Cost per Link Click (RON)',
      'FB CPC Total (RON)',
      'WC Total Orders',
      'WC Codul Destinului Orders',
      'WC Codul Destinului 2 Orders',
      'WC INFLUENȚA DECADEI Orders',
      'WC Total Revenue (RON)'
    ];

    const csvContent = [
      headers.join(','),
      ...dailyMetrics.map(day => [
        day.date,
        day.fbAdSpend.toFixed(2),
        day.fbRevenue.toFixed(2),
        day.fbRoas.toFixed(2),
        day.fbCpm.toFixed(2),
        day.fbImpressions,
        day.fbLinkClicks,
        day.fbLandingPageViews,
        day.fbLpViewRate.toFixed(2),
        day.fbConversions,
        day.fbConversionRate.toFixed(2),
        day.fbCtr.toFixed(2),
        day.fbCostPerLinkClick.toFixed(2),
        day.fbCpcTotal.toFixed(2),
        day.wcTotalOrders,
        day.wcCodulDestinuluiOrders,
        day.wcCodulDestinului2Orders,
        day.wcInfluentaDecadeiOrders,
        day.wcTotalRevenue.toFixed(2)
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `monthly-report-${selectedMonth}-${selectedClient?.name || 'client'}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading && dailyMetrics.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-slate-400 mx-auto mb-4" />
          <p className="text-slate-600">Loading monthly reports...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Monthly Reports</h1>
              <p className="text-slate-600 mt-2">
                Daily performance metrics for {selectedClient?.name || 'selected client'}
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={exportToCSV}
                className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </button>
              <button
                onClick={handleSync}
                disabled={syncing}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Syncing...' : 'Sync Data'}
              </button>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Client</label>
              <select
                value={selectedClient?.id || ''}
                onChange={(e) => {
                  const client = clients.find(c => c.id === e.target.value);
                  setSelectedClient(client || null);
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {clients.map(client => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Month</label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="flex items-end">
              <div className="text-sm text-slate-500">
                {dailyMetrics.length} days of data
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="relative">
            <div className="text-xs text-slate-500 mb-2 px-4">
              💡 Scroll orizontal pentru a vedea toate coloanele
            </div>
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#cbd5e1 #f1f5f9' }}>
            <table className="min-w-[2000px] divide-y divide-slate-200">
              <thead className="bg-slate-50 sticky top-0 z-20">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider sticky left-0 bg-slate-50 z-30">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    FB Ad Spend
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    FB Revenue
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    FB ROAS
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    FB CPM
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    FB Impressions
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    FB Link Clicks
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    FB LP Views
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    FB LP Rate
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    FB Conversions
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    FB Conv Rate
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    FB CTR
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    FB Cost/Link
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    FB CPC Total
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    WC Orders
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Codul Destinului
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Codul Destinului 2
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    INFLUENȚA DECADEI
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    WC Revenue
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {dailyMetrics.map((day) => (
                  <tr key={day.date} className="hover:bg-slate-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 sticky left-0 bg-white z-30">
                      {new Date(day.date).toLocaleDateString('ro-RO')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                      {day.fbAdSpend.toFixed(2)} RON
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                      {day.fbRevenue.toFixed(2)} RON
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                      {day.fbRoas.toFixed(2)}x
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                      {day.fbCpm.toFixed(2)} RON
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                      {day.fbImpressions.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                      {day.fbLinkClicks.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                      {day.fbLandingPageViews.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                      {day.fbLpViewRate.toFixed(2)}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                      {day.fbConversions}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                      {day.fbConversionRate.toFixed(2)}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                      {day.fbCtr.toFixed(2)}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                      {day.fbCostPerLinkClick.toFixed(2)} RON
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                      {day.fbCpcTotal.toFixed(2)} RON
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                      {day.wcTotalOrders}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                      {day.wcCodulDestinuluiOrders}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                      {day.wcCodulDestinului2Orders}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                      {day.wcInfluentaDecadeiOrders}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                      {day.wcTotalRevenue.toFixed(2)} RON
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </div>

        {dailyMetrics.length === 0 && (
          <div className="text-center py-12">
            <Calendar className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-600 mb-2">No data available</h3>
            <p className="text-slate-500">
              No data found for {selectedMonth}. Try syncing your integrations or selecting a different month.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
