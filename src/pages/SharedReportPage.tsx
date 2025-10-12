import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { BarChart3, TrendingUp, ShoppingCart, Mail, ExternalLink, AlertTriangle } from 'lucide-react';

interface SharedReportPageProps {
  token: string;
}

interface Client {
  id: string;
  name: string;
  logo_url: string | null;
  website: string | null;
  industry: string | null;
}

interface MetricsData {
  facebookAds: {
    spend: number;
    impressions: number;
    clicks: number;
    conversions: number;
    revenue: number;
    ctr: number;
    cpc: number;
    cpm: number;
    roas: number;
  };
  googleAnalytics: {
    sessions: number;
    users: number;
    pageviews: number;
    bounceRate: number;
    avgSessionDuration: number;
  };
  woocommerce: {
    totalOrders: number;
    totalRevenue: number;
    averageOrderValue: number;
    pendingOrders: number;
    processingOrders: number;
    completedOrders: number;
  };
  mailerlite: {
    totalSubscribers: number;
    activeSubscribers: number;
    unsubscribed: number;
    openRate: number;
    clickRate: number;
  };
  wordpress: {
    totalPosts: number;
    publishedPosts: number;
    totalPages: number;
    totalComments: number;
  };
}

export default function SharedReportPage({ token }: SharedReportPageProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  useEffect(() => {
    fetchSharedReport();
  }, [token]);

  const fetchSharedReport = async () => {
    try {
      const { data: shareData, error: shareError } = await supabase
        .from('report_shares')
        .select('*, clients(*)')
        .eq('token', token)
        .maybeSingle();

      if (shareError) throw shareError;
      if (!shareData) {
        setError('This report link is invalid or has been removed.');
        setLoading(false);
        return;
      }

      if (shareData.expires_at && new Date(shareData.expires_at) < new Date()) {
        setError('This report link has expired.');
        setLoading(false);
        return;
      }

      setClient(shareData.clients);
      setExpiresAt(shareData.expires_at);

      await supabase
        .from('report_shares')
        .update({
          last_accessed_at: new Date().toISOString(),
          access_count: (shareData.access_count || 0) + 1
        })
        .eq('id', shareData.id);

      const { data: metricsData, error: metricsError } = await supabase
        .from('metrics_snapshots')
        .select('*')
        .eq('client_id', shareData.client_id)
        .gte('date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
        .order('date', { ascending: false });

      if (metricsError) throw metricsError;

      const processedMetrics = processMetrics(metricsData || []);
      setMetrics(processedMetrics);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching shared report:', err);
      setError('Failed to load report. Please try again.');
      setLoading(false);
    }
  };

  const processMetrics = (snapshots: any[]): MetricsData => {
    const facebookData = snapshots.filter(s => s.platform === 'facebook_ads');
    const googleData = snapshots.filter(s => s.platform === 'google_analytics');
    const wooData = snapshots.filter(s => s.platform === 'woocommerce');
    const mailerliteData = snapshots.filter(s => s.platform === 'mailerlite');
    const wordpressData = snapshots.filter(s => s.platform === 'wordpress');

    const sumMetric = (data: any[], key: string) =>
      data.reduce((sum, item) => sum + (item.metrics?.[key] || 0), 0);

    const avgMetric = (data: any[], key: string) => {
      const values = data.map(item => item.metrics?.[key] || 0).filter(v => v > 0);
      return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    };

    const latestMetric = (data: any[], key: string) =>
      data.length > 0 ? (data[0].metrics?.[key] || 0) : 0;

    const fbSpend = sumMetric(facebookData, 'spend');
    const fbRevenue = sumMetric(facebookData, 'revenue');

    return {
      facebookAds: {
        spend: fbSpend,
        impressions: sumMetric(facebookData, 'impressions'),
        clicks: sumMetric(facebookData, 'clicks'),
        conversions: sumMetric(facebookData, 'conversions'),
        revenue: fbRevenue,
        ctr: avgMetric(facebookData, 'ctr'),
        cpc: avgMetric(facebookData, 'cpc'),
        cpm: avgMetric(facebookData, 'cpm'),
        roas: fbSpend > 0 ? fbRevenue / fbSpend : 0,
      },
      googleAnalytics: {
        sessions: sumMetric(googleData, 'sessions'),
        users: sumMetric(googleData, 'users'),
        pageviews: sumMetric(googleData, 'pageviews'),
        bounceRate: avgMetric(googleData, 'bounce_rate'),
        avgSessionDuration: avgMetric(googleData, 'avg_session_duration'),
      },
      woocommerce: {
        totalOrders: sumMetric(wooData, 'total_orders'),
        totalRevenue: sumMetric(wooData, 'total_revenue'),
        averageOrderValue: avgMetric(wooData, 'average_order_value'),
        pendingOrders: latestMetric(wooData, 'pending_orders'),
        processingOrders: latestMetric(wooData, 'processing_orders'),
        completedOrders: sumMetric(wooData, 'completed_orders'),
      },
      mailerlite: {
        totalSubscribers: latestMetric(mailerliteData, 'total_subscribers'),
        activeSubscribers: latestMetric(mailerliteData, 'active_subscribers'),
        unsubscribed: latestMetric(mailerliteData, 'unsubscribed'),
        openRate: avgMetric(mailerliteData, 'open_rate'),
        clickRate: avgMetric(mailerliteData, 'click_rate'),
      },
      wordpress: {
        totalPosts: latestMetric(wordpressData, 'total_posts'),
        publishedPosts: latestMetric(wordpressData, 'published_posts'),
        totalPages: latestMetric(wordpressData, 'total_pages'),
        totalComments: latestMetric(wordpressData, 'total_comments'),
      },
    };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Loading report...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Unable to Load Report</h2>
          <p className="text-slate-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!client || !metrics) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {client.logo_url && (
                <img src={client.logo_url} alt={client.name} className="w-12 h-12 rounded-lg object-cover" />
              )}
              <div>
                <h1 className="text-2xl font-bold text-slate-800">{client.name}</h1>
                <p className="text-sm text-slate-500">Marketing Performance Report</p>
              </div>
            </div>
            {client.website && (
              <a
                href={client.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition text-slate-700"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Visit Website</span>
              </a>
            )}
          </div>
          {expiresAt && (
            <p className="text-xs text-slate-500 mt-2">
              This report link expires on {new Date(expiresAt).toLocaleString()}
            </p>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl p-6 text-white">
          <h2 className="text-2xl font-bold mb-1">Performance Overview</h2>
          <p className="text-sm text-blue-100">Last 30 days of marketing data</p>
        </div>

        {(metrics.woocommerce.totalOrders > 0 || metrics.facebookAds.spend > 0) && (
          <div className="grid lg:grid-cols-2 gap-4">
            {metrics.woocommerce.totalOrders > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <ShoppingCart className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-800">E-commerce</h3>
                    <p className="text-xs text-slate-500">WooCommerce sales</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <MetricBox label="Total Orders" value={metrics.woocommerce.totalOrders.toLocaleString()} />
                  <MetricBox label="Revenue" value={`${metrics.woocommerce.totalRevenue.toFixed(2)} RON`} highlighted />
                  <MetricBox label="Avg. Order" value={`${metrics.woocommerce.averageOrderValue.toFixed(2)} RON`} />
                  <MetricBox label="Completed" value={metrics.woocommerce.completedOrders.toLocaleString()} />
                </div>
              </div>
            )}

            {metrics.facebookAds.spend > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <BarChart3 className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-800">Facebook Ads</h3>
                    <p className="text-xs text-slate-500">Advertising performance</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-3">
                  <MetricBox label="Spend" value={`${metrics.facebookAds.spend.toFixed(2)} RON`} />
                  <MetricBox label="Revenue" value={`${metrics.facebookAds.revenue.toFixed(2)} RON`} />
                  <MetricBox label="Impressions" value={metrics.facebookAds.impressions.toLocaleString()} />
                  <MetricBox label="Clicks" value={metrics.facebookAds.clicks.toLocaleString()} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <MetricBox label="CTR" value={`${metrics.facebookAds.ctr.toFixed(2)}%`} />
                  <MetricBox label="CPC" value={`${metrics.facebookAds.cpc.toFixed(2)} RON`} />
                  <MetricBox label="CPM" value={`${metrics.facebookAds.cpm.toFixed(2)} RON`} />
                  <MetricBox label="ROAS" value={`${metrics.facebookAds.roas.toFixed(2)}x`} highlighted />
                </div>
              </div>
            )}
          </div>
        )}

        {metrics.googleAnalytics.sessions > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800">Website Analytics</h3>
                <p className="text-xs text-slate-500">Google Analytics data</p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <MetricBox label="Sessions" value={metrics.googleAnalytics.sessions.toLocaleString()} />
              <MetricBox label="Users" value={metrics.googleAnalytics.users.toLocaleString()} />
              <MetricBox label="Page Views" value={metrics.googleAnalytics.pageviews.toLocaleString()} />
              <MetricBox label="Bounce Rate" value={`${metrics.googleAnalytics.bounceRate.toFixed(1)}%`} />
              <MetricBox label="Avg. Session" value={`${Math.round(metrics.googleAnalytics.avgSessionDuration)}s`} />
            </div>
          </div>
        )}

        {metrics.mailerlite.totalSubscribers > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
                <Mail className="w-5 h-5 text-teal-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800">Email Marketing</h3>
                <p className="text-xs text-slate-500">MailerLite campaigns</p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MetricBox label="Subscribers" value={metrics.mailerlite.totalSubscribers.toLocaleString()} />
              <MetricBox label="Active" value={metrics.mailerlite.activeSubscribers.toLocaleString()} />
              <MetricBox label="Open Rate" value={`${metrics.mailerlite.openRate.toFixed(1)}%`} />
              <MetricBox label="Click Rate" value={`${metrics.mailerlite.clickRate.toFixed(1)}%`} />
            </div>
          </div>
        )}

        <div className="bg-slate-100 rounded-xl p-4 text-center">
          <p className="text-xs text-slate-600">
            This is a secure, read-only view of the marketing report for {client.name}.
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Data shown is for the last 30 days.
          </p>
        </div>
      </div>
    </div>
  );
}

interface MetricBoxProps {
  label: string;
  value: string | number;
  highlighted?: boolean;
}

function MetricBox({ label, value, highlighted }: MetricBoxProps) {
  return (
    <div className={`rounded-lg p-3 ${highlighted ? 'bg-green-50 border-2 border-green-200' : 'bg-slate-50 border border-slate-200'}`}>
      <p className="text-xs text-slate-600 mb-0.5">{label}</p>
      <p className={`text-lg font-bold ${highlighted ? 'text-green-700' : 'text-slate-800'}`}>{value}</p>
    </div>
  );
}
