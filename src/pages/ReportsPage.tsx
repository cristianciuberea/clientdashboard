import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { FileText, Calendar, Package, RefreshCw, Share2, Copy, Check, X, ExternalLink } from 'lucide-react';
import type { Database } from '../lib/database.types';

type Client = Database['public']['Tables']['clients']['Row'];
type Integration = Database['public']['Tables']['integrations']['Row'];

interface AggregatedMetrics {
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  totalProducts: number;
  completedOrders: number;
  processingOrders: number;
  pendingOrders: number;
  topProducts: Array<{
    name: string;
    revenue: number;
    quantity: number;
  }>;
  todayTopProducts: Array<{
    name: string;
    revenue: number;
    quantity: number;
  }>;
  yesterdayTopProducts: Array<{
    name: string;
    revenue: number;
    quantity: number;
  }>;
  firstDayTopProducts: Array<{
    name: string;
    revenue: number;
    quantity: number;
  }>;
  lastDayTopProducts: Array<{
    name: string;
    revenue: number;
    quantity: number;
  }>;
  yesterdayRevenue?: number;
  todayRevenue?: number;
  yesterdayOrders?: number;
  todayOrders?: number;
  firstDayRevenue?: number;
  lastDayRevenue?: number;
  firstDayOrders?: number;
  lastDayOrders?: number;
  firstDayDate?: string;
  lastDayDate?: string;
  monthlyRevenue?: number;
  facebookAds?: {
    spend: number;
    impressions: number;
    clicks: number;
    conversions: number;
    ctr: number;
    cpc: number;
    cpm: number;
    roas: number;
  };
}

export default function ReportsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<AggregatedMetrics | null>(null);
  const [dateRange, setDateRange] = useState<'today' | 'yesterday' | 'this_month' | 'last_month' | 'this_year'>('today');
  const [syncing, setSyncing] = useState(false);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [showShareModal, setShowShareModal] = useState(false);
  // TODO: Implement sharing functionality
  // const [generatedLink, setGeneratedLink] = useState('');
  // const [activeLinks, setActiveLinks] = useState<any[]>([]);

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

  const fetchMetrics = useCallback(async (clientId: string) => {
    try {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);

      let startDate: Date;
      let endDate: Date = new Date();

      switch (dateRange) {
        case 'today':
          startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
          endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
          break;
        case 'yesterday':
          startDate = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
          endDate = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
          break;
        case 'this_month':
          startDate = new Date(today.getFullYear(), today.getMonth(), 1);
          break;
        case 'last_month':
          startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
          endDate = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59);
          break;
        case 'this_year':
          startDate = new Date(today.getFullYear(), 0, 1);
          break;
        default:
          startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      }

      console.log('=== FETCH METRICS ===');
      console.log('dateRange:', dateRange);
      console.log('startDate:', startDate.toISOString().split('T')[0]);
      console.log('endDate:', endDate.toISOString().split('T')[0]);
      console.log('Date range filter active:', { gte: startDate.toISOString().split('T')[0], lte: endDate.toISOString().split('T')[0] });

      // First, get ALL available snapshots for this client
      const { data: allData, error: allError } = await supabase
        .from('metrics_snapshots')
        .select('*')
        .eq('client_id', clientId)
        .order('date', { ascending: false });

      if (allError) {
        console.error('Error fetching all data:', allError);
        throw allError;
      }

      console.log('=== ALL AVAILABLE DATA ===');
      console.log('Total snapshots in DB:', allData?.length || 0);
      if (allData && allData.length > 0) {
        console.log('Date range in DB:', {
          earliest: allData[allData.length - 1]?.date,
          latest: allData[0]?.date
        });
        console.log('All dates:', allData.map(s => s.date));
      }

      // Now filter the data in JavaScript based on our date range
      // Build date strings manually to avoid timezone issues
      const startYear = startDate.getFullYear();
      const startMonth = String(startDate.getMonth() + 1).padStart(2, '0');
      const startDay = String(startDate.getDate()).padStart(2, '0');
      const startDateStr = `${startYear}-${startMonth}-${startDay}`;

      const endYear = endDate.getFullYear();
      const endMonth = String(endDate.getMonth() + 1).padStart(2, '0');
      const endDay = String(endDate.getDate()).padStart(2, '0');
      const endDateStr = `${endYear}-${endMonth}-${endDay}`;

      console.log('Filtering with LOCAL date strings:', startDateStr, 'to', endDateStr);
      console.log('Raw startDate object:', startDate, 'Raw endDate object:', endDate);

      const data = allData?.filter(snapshot => {
        const result = snapshot.date >= startDateStr && snapshot.date <= endDateStr;
        if (result) {
          console.log('Including snapshot:', snapshot.date, snapshot.platform);
        }
        return result;
      });

      console.log('=== FILTERED DATA ===');
      console.log('Filtered snapshots:', data?.length || 0);
      console.log('Filter criteria:', {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
      });

      const error = null; // No error since we filtered client-side

      if (error) {
        console.error('Metrics fetch error:', error);
        throw error;
      }

      if (data && data.length > 0) {
        const latestByDatePlatform: Record<string, any> = {};

        for (const snapshot of data) {
          const key = `${snapshot.date}-${snapshot.platform}`;
          const snapshotMetrics = snapshot.metrics as any;

          // For WooCommerce/WordPress, take the snapshot with HIGHEST cumulative revenue for each date
          if (snapshot.platform === 'woocommerce' || snapshot.platform === 'wordpress') {
            if (!latestByDatePlatform[key] ||
                (snapshotMetrics.totalRevenue || 0) > ((latestByDatePlatform[key].metrics as any).totalRevenue || 0)) {
              latestByDatePlatform[key] = snapshot;
            }
          } else {
            // For other platforms (FB Ads, etc), take the snapshot with highest spend/metric value
            const currentValue = snapshotMetrics.spend || snapshotMetrics.impressions || 0;
            const existingValue = latestByDatePlatform[key] ?
              ((latestByDatePlatform[key].metrics as any).spend || (latestByDatePlatform[key].metrics as any).impressions || 0) : 0;

            if (!latestByDatePlatform[key] || currentValue > existingValue) {
              latestByDatePlatform[key] = snapshot;
            }
          }
        }

        const uniqueSnapshots = Object.values(latestByDatePlatform);
        console.log('Unique snapshots after deduplication:', uniqueSnapshots.length, 'by platform:',
          uniqueSnapshots.reduce((acc, s) => { acc[s.platform] = (acc[s.platform] || 0) + 1; return acc; }, {} as Record<string, number>));

        let aggregatedRevenue = 0;
        let aggregatedOrders = 0;
        let totalProducts = 0;
        let completedOrders = 0;
        let processingOrders = 0;
        let pendingOrders = 0;
        const productMap: Record<string, { name: string; quantity: number; revenue: number }> = {};
        const todayProductMap: Record<string, { name: string; quantity: number; revenue: number }> = {};
        const yesterdayProductMap: Record<string, { name: string; quantity: number; revenue: number }> = {};
        const firstDayProductMap: Record<string, { name: string; quantity: number; revenue: number }> = {};
        const lastDayProductMap: Record<string, { name: string; quantity: number; revenue: number }> = {};

        let todayMetric = null;
        let yesterdayMetric = null;
        let firstDayMetric = null;
        let lastDayMetric = null;
        let firstDayDate = '';
        let lastDayDate = '';

        // Sort snapshots by date to find first and last day
        const sortedSnapshots = [...uniqueSnapshots].sort((a, b) =>
          new Date(a.date).getTime() - new Date(b.date).getTime()
        );

        // Separate WooCommerce aggregate vs daily snapshots
        const wooAggregateSnapshots = sortedSnapshots.filter(
          (s) => s.platform === 'woocommerce' && (s as any).metric_type === 'ecommerce_aggregate'
        );
        // Filter WooCommerce/WordPress daily snapshots (exclude aggregated)
        const wooSnapshots = sortedSnapshots.filter(
          (s) => (s.platform === 'woocommerce' || s.platform === 'wordpress') && (s as any).metric_type !== 'ecommerce_aggregate'
        );

        console.log('WooCommerce aggregate snapshots:', wooAggregateSnapshots.length);
        wooAggregateSnapshots.forEach(s => console.log('Aggregate snapshot:', s.date, (s as any).metric_type, (s.metrics as any)?.totalOrders));

        if (sortedSnapshots.length > 0) {
          firstDayDate = sortedSnapshots[0].date;
          lastDayDate = sortedSnapshots[sortedSnapshots.length - 1].date;
          console.log('firstDayDate:', firstDayDate);
          console.log('lastDayDate:', lastDayDate);
          console.log('Total unique snapshots:', sortedSnapshots.length);
          console.log('WooCommerce snapshots:', wooSnapshots.length);
          console.log('Facebook Ads snapshots:', sortedSnapshots.filter(s => s.platform === 'facebook_ads').length);
        }

        const fbDailyData: { [date: string]: any } = {};

        // Calculate current month revenue
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        let monthlyRevenue = 0;

        for (const snapshot of uniqueSnapshots) {
          const snapshotMetrics = snapshot.metrics as any;

          // Check if snapshot is from current month
          const snapshotDate = new Date(snapshot.date);
          if (snapshotDate.getMonth() === currentMonth && snapshotDate.getFullYear() === currentYear) {
            if (snapshot.platform === 'woocommerce' || snapshot.platform === 'wordpress') {
              monthlyRevenue = Math.max(monthlyRevenue, snapshotMetrics.totalRevenue || 0);
            }
          }

          if (snapshot.date === today) {
            todayMetric = snapshotMetrics;
          }
          if (snapshot.date === yesterday) {
            yesterdayMetric = snapshotMetrics;
          }
          if (snapshot.date === firstDayDate) {
            firstDayMetric = snapshotMetrics;
          }
          if (snapshot.date === lastDayDate) {
            lastDayMetric = snapshotMetrics;
          }

          if (snapshot.platform === 'facebook_ads') {
            const currentSpend = snapshotMetrics.spend || 0;

            if (!fbDailyData[snapshot.date] || currentSpend > fbDailyData[snapshot.date].spend) {
              fbDailyData[snapshot.date] = {
                spend: currentSpend,
                impressions: snapshotMetrics.impressions || 0,
                clicks: snapshotMetrics.clicks || 0,
                conversions: snapshotMetrics.conversions || 0,
                ctr: snapshotMetrics.ctr || 0,
                cpc: snapshotMetrics.cpc || 0,
                cpm: snapshotMetrics.cpm || 0
              };
              console.log('Found FB data for', snapshot.date, fbDailyData[snapshot.date]);
            }
          } else {
            // For WooCommerce/WordPress, store last day snapshot data
            if (snapshot.date === lastDayDate) {
              console.log('Using lastDayDate snapshot:', snapshot.date, snapshotMetrics);
              completedOrders = snapshotMetrics.completedOrders || 0;
              processingOrders = snapshotMetrics.processingOrders || 0;
              pendingOrders = snapshotMetrics.pendingOrders || 0;
              totalProducts = snapshotMetrics.totalProducts || 0;
            }

            if (snapshotMetrics.topProducts) {
              for (const product of snapshotMetrics.topProducts) {
                if (!productMap[product.name]) {
                  productMap[product.name] = { name: product.name, quantity: 0, revenue: 0 };
                }
                productMap[product.name].quantity += product.quantity || 0;
                productMap[product.name].revenue += product.revenue || 0;
              }
            }
          }

          if (snapshot.date === today && snapshotMetrics.topProducts) {
            for (const product of snapshotMetrics.topProducts) {
              if (!todayProductMap[product.name]) {
                todayProductMap[product.name] = { name: product.name, quantity: 0, revenue: 0 };
              }
              todayProductMap[product.name].quantity += product.quantity || 0;
              todayProductMap[product.name].revenue += product.revenue || 0;
            }
          }

          if (snapshot.date === yesterday && snapshotMetrics.topProducts) {
            for (const product of snapshotMetrics.topProducts) {
              if (!yesterdayProductMap[product.name]) {
                yesterdayProductMap[product.name] = { name: product.name, quantity: 0, revenue: 0 };
              }
              yesterdayProductMap[product.name].quantity += product.quantity || 0;
              yesterdayProductMap[product.name].revenue += product.revenue || 0;
            }
          }

          if (snapshot.date === firstDayDate && snapshotMetrics.topProducts) {
            for (const product of snapshotMetrics.topProducts) {
              if (!firstDayProductMap[product.name]) {
                firstDayProductMap[product.name] = { name: product.name, quantity: 0, revenue: 0 };
              }
              firstDayProductMap[product.name].quantity += product.quantity || 0;
              firstDayProductMap[product.name].revenue += product.revenue || 0;
            }
          }

          if (snapshot.date === lastDayDate && snapshotMetrics.topProducts) {
            for (const product of snapshotMetrics.topProducts) {
              if (!lastDayProductMap[product.name]) {
                lastDayProductMap[product.name] = { name: product.name, quantity: 0, revenue: 0 };
              }
              lastDayProductMap[product.name].quantity += product.quantity || 0;
              lastDayProductMap[product.name].revenue += product.revenue || 0;
            }
          }
        }

        const topProducts = Object.values(productMap)
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 10);

        const todayTopProducts = Object.values(todayProductMap)
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 10);

        const yesterdayTopProducts = Object.values(yesterdayProductMap)
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 10);

        const firstDayTopProducts = Object.values(firstDayProductMap)
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 10);

        const lastDayTopProducts = Object.values(lastDayProductMap)
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 10);

        // For WooCommerce, calculate period totals and daily sales from cumulative data
        let calculatedYesterdayRevenue = 0;
        let calculatedYesterdayOrders = 0;
        let calculatedTodayRevenue = 0;
        let calculatedTodayOrders = 0;

        // Get unique dates from WooCommerce snapshots
        const uniqueDates = Array.from(new Set(wooSnapshots.map(s => s.date))).sort();
        console.log('=== WOOCOMMERCE PERIOD CALCULATION ===');
        console.log('Unique dates:', uniqueDates);
        console.log('Date range:', dateRange);
        console.log('Today:', today);
        console.log('Yesterday:', yesterday);

        // Calculate period totals by aggregating daily data correctly
        // Each WooCommerce snapshot contains DAILY sales data
        if (wooSnapshots.length > 0) {
          console.log('=== CALCULATING WOO METRICS ===');
          console.log('Total WooCommerce snapshots:', wooSnapshots.length);
          console.log('Date range:', dateRange);

          // For single day filters, use only that day's data (use snapshot totals)
          if (dateRange === 'today' || dateRange === 'yesterday') {
            const targetDate = dateRange === 'today' ? today : yesterday;
            const targetDateStr = targetDate.toISOString().split('T')[0];
            const daySnapshot = wooSnapshots.find(s => s.date === targetDateStr);

            if (daySnapshot) {
              const metrics = daySnapshot.metrics as any;
              console.log(`=== DAY SNAPSHOT FOR ${dateRange.toUpperCase()} ===`);
              console.log('Snapshot date:', daySnapshot.date);
              console.log('Full snapshot:', JSON.stringify(daySnapshot, null, 2));
              console.log('Metrics object:', metrics);

              aggregatedOrders = (metrics?.totalOrders as number) || 0;
              aggregatedRevenue = (metrics?.totalRevenue as number) || 0;
              console.log(`=== TOTAL FOR ${dateRange.toUpperCase()}: ${aggregatedOrders} orders, ${aggregatedRevenue} RON ===`);
            } else {
              console.log(`No data found for ${dateRange} (${targetDateStr})`);
              console.log('Available dates in wooSnapshots:', wooSnapshots.map(s => s.date));
            }
          } else {
            // For period filters (month, year), prefer aggregated WooCommerce snapshot if available
            console.log(`=== PERIOD AGGREGATION FOR ${dateRange.toUpperCase()} ===`);
            console.log(`Processing ${wooSnapshots.length} snapshots for period aggregation`);

            const isPeriodRange = dateRange === 'this_month' || dateRange === 'last_month' || dateRange === 'this_year';

            // Find the correct aggregated snapshot for this period
            let aggregateSnapshot = null;
            if (isPeriodRange && wooAggregateSnapshots.length > 0) {
              const today = new Date();
              let expectedAggregateDate: string;

              switch (dateRange) {
                case 'this_month':
                  expectedAggregateDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
                  break;
                case 'last_month':
                  expectedAggregateDate = new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString().split('T')[0];
                  break;
                case 'this_year':
                  expectedAggregateDate = new Date(today.getFullYear(), 0, 1).toISOString().split('T')[0];
                  break;
                default:
                  expectedAggregateDate = '';
              }

              aggregateSnapshot = wooAggregateSnapshots.find(s => s.date === expectedAggregateDate);

              if (aggregateSnapshot) {
                const aggMetrics = (aggregateSnapshot as any).metrics as any;
                console.log('Using WooCommerce aggregated snapshot for period:', {
                  expectedDate: expectedAggregateDate,
                  snapshotDate: (aggregateSnapshot as any).date,
                  totalOrders: aggMetrics?.totalOrders,
                  totalRevenue: aggMetrics?.totalRevenue,
                });

                aggregatedOrders = aggMetrics?.totalOrders || 0;
                aggregatedRevenue = aggMetrics?.totalRevenue || 0;

                // Expose top products from aggregate
                if (Array.isArray(aggMetrics?.topProducts)) {
                  aggMetrics.topProducts.forEach((p: any) => {
                    const key = p.id || p.name;
                    productMap[key] = {
                      name: p.name,
                      quantity: p.quantity || 0,
                      revenue: p.revenue || 0,
                    };
                  });
                }
              }
            }

            // If no aggregated snapshot found for this period, fall back to daily aggregation
            if (!aggregateSnapshot) {
              console.log('No aggregated snapshot found for period, falling back to daily aggregation');
              // Fallback: aggregate across daily snapshots (unique per date)
              // Group snapshots by date and take the most recent for each date
              const snapshotsByDate: Record<string, any> = {};

              wooSnapshots.forEach((snapshot) => {
                const date = snapshot.date;
                if (!snapshotsByDate[date] ||
                    new Date((snapshot as any).created_at) > new Date((snapshotsByDate[date] as any).created_at)) {
                  snapshotsByDate[date] = snapshot;
                }
              });

              const uniqueDailySnapshots = Object.values(snapshotsByDate);
              console.log(`Found ${uniqueDailySnapshots.length} unique dates with WooCommerce data`);

              // Aggregate orders and revenue using snapshot totals (avoid summing product quantities)
              aggregatedOrders = 0;
              aggregatedRevenue = 0;
              uniqueDailySnapshots.forEach((snapshot, index) => {
                console.log(`Processing date ${index + 1}/${uniqueDailySnapshots.length}: ${(snapshot as any).date}`);
                const metrics = (snapshot as any).metrics as any;

                // Sum totals directly from snapshot
                aggregatedOrders += (metrics?.totalOrders || 0);
                aggregatedRevenue += (metrics?.totalRevenue || 0);

                // Optionally maintain product breakdown for display
                if (metrics.topProducts && Array.isArray(metrics.topProducts)) {
                  metrics.topProducts.forEach((product: any) => {
                    const productId = product.id || product.name;
                    const revenue = product.revenue || 0;
                    const quantity = product.quantity || 0;
                    if (!productMap[productId]) {
                      productMap[productId] = {
                        revenue: 0,
                        quantity: 0,
                        name: product.name || 'Unknown Product'
                      };
                    }
                    productMap[productId].revenue += revenue;
                    productMap[productId].quantity += quantity;
                  });
                }
              });
            }

            console.log(`=== FINAL PERIOD RESULT ===`);
            console.log(`Period ${dateRange}: ${aggregatedOrders} total orders, ${aggregatedRevenue} RON`);
            if (Object.keys(productMap).length > 0) {
              console.log(`From ${Object.keys(productMap).length} unique products (aggregated):`);
              Object.values(productMap).forEach((product, index) => {
                console.log(`  ${index + 1}. ${product.name}: ${product.quantity} units, ${product.revenue} RON`);
              });
            }
          }
        }

        // Get TODAY's sales directly from topProducts
        const todaySnapshot = wooSnapshots.find(s => s.date === today);
        if (todaySnapshot) {
          const metrics = todaySnapshot.metrics as any;
          if (metrics.topProducts) {
            calculatedTodayRevenue = metrics.topProducts.reduce((sum: number, p: any) => sum + (p.revenue || 0), 0);
            calculatedTodayOrders = metrics.topProducts.reduce((sum: number, p: any) => sum + (p.quantity || 0), 0);
          }
          console.log('TODAY sales:', {
            date: today,
            revenue: calculatedTodayRevenue,
            orders: calculatedTodayOrders
          });
        }

        // Get YESTERDAY's sales directly from topProducts
        const yesterdaySnapshot = wooSnapshots.find(s => s.date === yesterday);
        if (yesterdaySnapshot) {
          const metrics = yesterdaySnapshot.metrics as any;
          if (metrics.topProducts) {
            calculatedYesterdayRevenue = metrics.topProducts.reduce((sum: number, p: any) => sum + (p.revenue || 0), 0);
            calculatedYesterdayOrders = metrics.topProducts.reduce((sum: number, p: any) => sum + (p.quantity || 0), 0);
          }
          console.log('YESTERDAY sales:', {
            date: yesterday,
            revenue: calculatedYesterdayRevenue,
            orders: calculatedYesterdayOrders
          });
        }

        console.log('Final calculated values:', {
          calculatedTodayRevenue,
          calculatedTodayOrders,
          calculatedYesterdayRevenue,
          calculatedYesterdayOrders
        });

        // Calculate Facebook Ads totals from daily data
        let fbSpend = 0;
        let fbImpressions = 0;
        let fbClicks = 0;
        let fbConversions = 0;
        let fbDataCount = 0;

        for (const dayData of Object.values(fbDailyData)) {
          fbSpend += dayData.spend;
          fbImpressions += dayData.impressions;
          fbClicks += dayData.clicks;
          fbConversions += dayData.conversions;
          fbDataCount++;
        }

        const facebookAds = fbDataCount > 0 ? {
          spend: fbSpend,
          impressions: fbImpressions,
          clicks: fbClicks,
          conversions: fbConversions,
          ctr: fbClicks > 0 && fbImpressions > 0 ? (fbClicks / fbImpressions) * 100 : 0,
          cpc: fbClicks > 0 ? fbSpend / fbClicks : 0,
          cpm: fbImpressions > 0 ? (fbSpend / fbImpressions) * 1000 : 0,
          roas: fbSpend > 0 ? aggregatedRevenue / fbSpend : 0,
        } : undefined;

        console.log('Facebook Ads (from daily data):', {
          fbDailyData,
          totals: facebookAds
        });

        console.log('Aggregated metrics:', { aggregatedRevenue, aggregatedOrders, topProducts, facebookAds });

        setMetrics({
          totalRevenue: aggregatedRevenue,
          totalOrders: aggregatedOrders,
          averageOrderValue: aggregatedOrders > 0 ? aggregatedRevenue / aggregatedOrders : 0,
          totalProducts,
          completedOrders,
          processingOrders,
          pendingOrders,
          topProducts,
          todayTopProducts,
          yesterdayTopProducts,
          firstDayTopProducts,
          lastDayTopProducts,
          todayRevenue: calculatedTodayRevenue || todayMetric?.totalRevenue || 0,
          todayOrders: calculatedTodayOrders || todayMetric?.totalOrders || 0,
          yesterdayRevenue: calculatedYesterdayRevenue || yesterdayMetric?.totalRevenue || 0,
          yesterdayOrders: calculatedYesterdayOrders || yesterdayMetric?.totalOrders || 0,
          firstDayRevenue: firstDayMetric?.totalRevenue || 0,
          firstDayOrders: firstDayMetric?.totalOrders || 0,
          lastDayRevenue: lastDayMetric?.totalRevenue || 0,
          lastDayOrders: lastDayMetric?.totalOrders || 0,
          monthlyRevenue,
          firstDayDate,
          lastDayDate,
          facebookAds,
        });
      } else {
        console.log('No metrics data found for client, setting defaults');

        // Set default empty metrics when no data exists for the period
        setMetrics({
          totalRevenue: 0,
          totalOrders: 0,
          averageOrderValue: 0,
          totalProducts: 0,
          completedOrders: 0,
          processingOrders: 0,
          pendingOrders: 0,
          topProducts: [],
          todayTopProducts: [],
          yesterdayTopProducts: [],
          firstDayTopProducts: [],
          lastDayTopProducts: [],
          todayRevenue: 0,
          todayOrders: 0,
          yesterdayRevenue: 0,
          yesterdayOrders: 0,
          firstDayRevenue: 0,
          firstDayOrders: 0,
          lastDayRevenue: 0,
          lastDayOrders: 0,
          monthlyRevenue: 0,
          firstDayDate: undefined,
          lastDayDate: undefined,
          facebookAds: undefined,
        });
      }
    } catch (error) {
      console.error('Error fetching metrics:', error);
    }
  }, [dateRange]);

  const fetchIntegrations = async (clientId: string) => {
    try {
      const { data, error } = await supabase
        .from('integrations')
        .select('*')
        .eq('client_id', clientId)
        .eq('status', 'active');

      if (error) throw error;
      setIntegrations(data || []);
    } catch (error) {
      console.error('Error fetching integrations:', error);
    }
  };

  const handleSyncAll = async () => {
    if (!selectedClient || integrations.length === 0) return;

    setSyncing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);

      // Define all periods to sync
      const periodsToSync = [
        { range: 'today' as const, dateFrom: undefined, dateTo: today.toISOString().split('T')[0] },
        { range: 'yesterday' as const, dateFrom: undefined, dateTo: yesterday.toISOString().split('T')[0] },
        {
          range: 'this_month' as const,
          dateFrom: new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0],
          dateTo: today.toISOString().split('T')[0]
        },
        {
          range: 'last_month' as const,
          dateFrom: new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString().split('T')[0],
          dateTo: new Date(today.getFullYear(), today.getMonth(), 0).toISOString().split('T')[0]
        },
        {
          range: 'this_year' as const,
          dateFrom: new Date(today.getFullYear(), 0, 1).toISOString().split('T')[0],
          dateTo: today.toISOString().split('T')[0]
        },
      ];

      console.log('Syncing all periods:', periodsToSync.map(p => `${p.range}: ${p.dateFrom || p.dateTo} to ${p.dateTo}`));

      // Sync all periods for all integrations in parallel
      const allSyncPromises = periodsToSync.flatMap(period =>
        integrations.map(async (integration) => {
          const platformSlug = integration.platform.replace('_', '-');
          const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-${platformSlug}`;

          const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              integration_id: integration.id,
              client_id: integration.client_id,
              date_to: period.dateTo,
              ...(period.dateFrom && { date_from: period.dateFrom }),
            }),
          });

          if (!response.ok) {
            const result = await response.json();
            throw new Error(`${integration.platform} ${period.range}: ${result.error || 'Sync failed'}`);
          }

          return response.json();
        })
      );

      await Promise.all(allSyncPromises);
      alert(`All periods synced successfully! (${periodsToSync.length} periods × ${integrations.length} integrations)`);

      if (selectedClient) {
        fetchMetrics(selectedClient.id);
      }
    } catch (error: any) {
      console.error('Error syncing:', error);
      alert(`Sync failed: ${error.message}`);
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  useEffect(() => {
    if (selectedClient) {
      fetchMetrics(selectedClient.id);
      fetchIntegrations(selectedClient.id);
    }
  }, [selectedClient, fetchMetrics]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Loading reports...</p>
        </div>
      </div>
    );
  }

  if (!selectedClient) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-slate-500">
          <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">No clients available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-slate-50">
      <div className="p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 mb-1">Reports</h1>
            <p className="text-sm text-slate-600">Detailed analytics and insights for {selectedClient.name}</p>
          </div>

          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1 bg-white border border-slate-200 rounded-md p-0.5">
              {(['today', 'yesterday', 'this_month', 'last_month', 'this_year'] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setDateRange(range)}
                  className={`px-2 py-1.5 rounded text-xs font-medium transition whitespace-nowrap ${
                    dateRange === range
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {range === 'today' ? 'Today' :
                   range === 'yesterday' ? 'Yesterday' :
                   range === 'this_month' ? 'This Month' :
                   range === 'last_month' ? 'Last Month' : 'This Year'}
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
                className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {clients.map(client => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            )}

            <button
              onClick={handleSyncAll}
              disabled={syncing || !selectedClient || integrations.length === 0}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-md transition text-xs font-medium disabled:bg-slate-300 disabled:cursor-not-allowed whitespace-nowrap"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              <span>
                {syncing ? 'Syncing...' : 'Sync All'}
              </span>
            </button>

            <button
              onClick={async () => {
                if (!selectedClient) return;
                const confirmMsg = `Are you sure you want to delete history for ${selectedClient.name} in the current range (${dateRange})?`;
                if (!window.confirm(confirmMsg)) return;

                try {
                  const { data: { session } } = await supabase.auth.getSession();
                  if (!session) throw new Error('Not authenticated');

                  // Build date range for current filter
                  const today = new Date();
                  const yesterday = new Date(today);
                  yesterday.setDate(today.getDate() - 1);

                  let dateFrom: string;
                  let dateTo: string;

                  switch (dateRange) {
                    case 'today': {
                      dateFrom = today.toISOString().split('T')[0];
                      dateTo = dateFrom;
                      break;
                    }
                    case 'yesterday': {
                      dateFrom = yesterday.toISOString().split('T')[0];
                      dateTo = dateFrom;
                      break;
                    }
                    case 'this_month': {
                      const startDate = new Date(today.getFullYear(), today.getMonth(), 1);
                      dateFrom = startDate.toISOString().split('T')[0];
                      dateTo = today.toISOString().split('T')[0];
                      break;
                    }
                    case 'last_month': {
                      const startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                      const endDate = new Date(today.getFullYear(), today.getMonth(), 0);
                      dateFrom = startDate.toISOString().split('T')[0];
                      dateTo = endDate.toISOString().split('T')[0];
                      break;
                    }
                    case 'this_year': {
                      const startDate = new Date(today.getFullYear(), 0, 1);
                      dateFrom = startDate.toISOString().split('T')[0];
                      dateTo = today.toISOString().split('T')[0];
                      break;
                    }
                    default: {
                      dateFrom = today.toISOString().split('T')[0];
                      dateTo = dateFrom;
                    }
                  }

                  const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-history`;
                  const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${session.access_token}`,
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      client_id: selectedClient.id,
                      platform: 'woocommerce',
                      date_from: dateFrom,
                      date_to: dateTo,
                    }),
                  });

                  const result = await response.json();
                  if (!response.ok) throw new Error(result.error || 'Delete failed');
                  alert(`Deleted ${result.deleted} snapshots.`);
                  // Refresh metrics after deletion
                  fetchMetrics(selectedClient.id);
                } catch (err: any) {
                  alert(`Delete failed: ${err.message}`);
                }
              }}
              disabled={!selectedClient}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-md transition text-xs font-medium disabled:bg-slate-300 disabled:cursor-not-allowed whitespace-nowrap"
            >
              <X className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>

            <button
              onClick={() => setShowShareModal(true)}
              disabled={!selectedClient}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition text-xs font-medium disabled:bg-slate-300 disabled:cursor-not-allowed whitespace-nowrap"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Share</span>
            </button>
          </div>
        </div>

        {metrics ? (
          <>
            {metrics.totalRevenue === 0 && metrics.totalOrders === 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <div className="flex items-center space-x-2">
                  <div className="w-5 h-5 bg-yellow-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs">!</span>
                  </div>
                  <p className="text-sm text-yellow-800">
                    No data available for the selected period. Try syncing data or selecting a different time range.
                  </p>
                </div>
              </div>
            )}
            <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg border border-slate-200 p-3 mb-3">
              <div className="mb-2">
                <h2 className="text-base font-bold text-slate-800">WooCommerce Sales</h2>
                <p className="text-xs text-slate-600">Complete store metrics</p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
                <div className="bg-white rounded-lg border border-slate-200 p-2">
                  <p className="text-xs text-slate-600 mb-1">Total Revenue</p>
                  <p className="text-lg font-bold text-slate-800">{metrics.totalRevenue.toLocaleString()} RON</p>
                </div>
                <div className="bg-white rounded-lg border border-slate-200 p-2">
                  <p className="text-xs text-slate-600 mb-1">Total Orders</p>
                  <p className="text-lg font-bold text-slate-800">{metrics.totalOrders}</p>
                </div>
                <div className="bg-white rounded-lg border border-slate-200 p-2">
                  <p className="text-xs text-slate-600 mb-1">Average Order</p>
                  <p className="text-lg font-bold text-slate-800">{Math.round(metrics.averageOrderValue)} RON</p>
                </div>
                <div className="bg-white rounded-lg border border-slate-200 p-2">
                  <p className="text-xs text-slate-600 mb-1">Monthly Revenue</p>
                  <p className="text-lg font-bold text-slate-800">{(metrics.monthlyRevenue || 0).toLocaleString()} RON</p>
                </div>
              </div>

            </div>

            {metrics.facebookAds && (
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border border-blue-200 p-3 mb-3">
                <div className="mb-3">
                  <h2 className="text-base font-bold text-slate-800">Facebook Ads Performance</h2>
                  <p className="text-xs text-blue-700">Campaign metrics for selected period</p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
                  <div className="bg-white rounded-lg p-2 border border-blue-200">
                    <p className="text-xs text-slate-600 mb-1">Ad Spend</p>
                    <p className="text-lg font-bold text-slate-800">{metrics.facebookAds.spend.toFixed(2)} RON</p>
                  </div>
                  <div className="bg-white rounded-lg p-2 border border-blue-200">
                    <p className="text-xs text-slate-600 mb-1">Impressions</p>
                    <p className="text-lg font-bold text-slate-800">{metrics.facebookAds.impressions.toLocaleString()}</p>
                  </div>
                  <div className="bg-white rounded-lg p-2 border border-blue-200">
                    <p className="text-xs text-slate-600 mb-1">Clicks</p>
                    <p className="text-lg font-bold text-slate-800">{metrics.facebookAds.clicks.toLocaleString()}</p>
                  </div>
                  <div className="bg-white rounded-lg p-2 border border-blue-200">
                    <p className="text-xs text-slate-600 mb-1">Conversions</p>
                    <p className="text-lg font-bold text-slate-800">{metrics.facebookAds.conversions}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div className="bg-white rounded-lg p-2 border border-blue-200">
                    <p className="text-xs text-slate-600 mb-1">CTR</p>
                    <p className="text-lg font-bold text-slate-800">{metrics.facebookAds.ctr.toFixed(2)}%</p>
                    <p className="text-xs text-slate-500 mt-1">Click-through rate</p>
                  </div>
                  <div className="bg-white rounded-lg p-2 border border-blue-200">
                    <p className="text-xs text-slate-600 mb-1">CPC</p>
                    <p className="text-lg font-bold text-slate-800">{metrics.facebookAds.cpc.toFixed(2)} RON</p>
                    <p className="text-xs text-slate-500 mt-1">Cost per click</p>
                  </div>
                  <div className="bg-white rounded-lg p-2 border border-blue-200">
                    <p className="text-xs text-slate-600 mb-1">CPM</p>
                    <p className="text-lg font-bold text-slate-800">{metrics.facebookAds.cpm.toFixed(2)} RON</p>
                    <p className="text-xs text-slate-500 mt-1">Cost per 1000 impressions</p>
                  </div>
                  <div className="bg-white rounded-lg p-2 border border-green-200 bg-green-50">
                    <p className="text-xs text-slate-600 mb-1">ROAS</p>
                    <p className="text-lg font-bold text-green-700">{metrics.facebookAds.roas.toFixed(2)}x</p>
                    <p className="text-xs text-slate-500 mt-1">Return on ad spend</p>
                  </div>
                </div>

                {metrics.facebookAds.roas > 0 && (
                  <div className="mt-2 p-2 bg-white rounded-lg border border-blue-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-slate-700">Campaign Efficiency</p>
                        <p className="text-xs text-slate-500 mt-1">
                          For every 1 RON spent, you earned {metrics.facebookAds.roas.toFixed(2)} RON
                        </p>
                      </div>
                      <div className={`px-3 py-1 rounded-lg font-bold text-xs ${
                        metrics.facebookAds.roas >= 3
                          ? 'bg-green-100 text-green-700'
                          : metrics.facebookAds.roas >= 2
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {metrics.facebookAds.roas >= 3 ? 'Excellent' : metrics.facebookAds.roas >= 2 ? 'Good' : 'Needs Improvement'}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
              <div className="bg-white rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-base font-bold text-slate-800">First Day Top Products</h2>
                  <span className="px-3 py-1 bg-slate-100 text-slate-700 text-xs font-medium rounded-full">
                    {metrics.firstDayDate ? new Date(metrics.firstDayDate).toLocaleDateString('ro-RO', { month: 'short', day: 'numeric' }) : 'N/A'}
                  </span>
                </div>
                <div className="space-y-2">
                  {metrics.firstDayTopProducts.length > 0 ? (
                    metrics.firstDayTopProducts.slice(0, 5).map((product, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-gradient-to-r from-slate-50 to-slate-100 rounded-lg border border-slate-200">
                        <div className="flex items-center space-x-3">
                          <div className="w-7 h-7 bg-slate-500 text-white rounded-full flex items-center justify-center font-bold text-xs">
                            #{index + 1}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-slate-800 text-xs">{product.name}</p>
                            <p className="text-xs text-slate-500">{product.quantity} units</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-slate-700 text-sm">{product.revenue.toLocaleString()} RON</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-slate-500">
                      <Package className="w-12 h-12 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No sales on first day</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-base font-bold text-slate-800">Last Day Top Products</h2>
                  <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                    {metrics.lastDayDate ? new Date(metrics.lastDayDate).toLocaleDateString('ro-RO', { month: 'short', day: 'numeric' }) : 'Live'}
                  </span>
                </div>
                <div className="space-y-2">
                  {metrics.lastDayTopProducts.length > 0 ? (
                    metrics.lastDayTopProducts.slice(0, 5).map((product, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border border-green-100">
                        <div className="flex items-center space-x-3">
                          <div className="w-7 h-7 bg-green-500 text-white rounded-full flex items-center justify-center font-bold text-xs">
                            #{index + 1}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-slate-800 text-xs">{product.name}</p>
                            <p className="text-xs text-slate-500">{product.quantity} units</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-green-700 text-sm">{product.revenue.toLocaleString()} RON</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-slate-500">
                      <Package className="w-12 h-12 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No sales on last day</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-lg border border-slate-200 p-3">
                <h2 className="text-base font-bold text-slate-800 mb-2">Top Products (Period Overview)</h2>
                <div className="space-y-2">
                  {metrics.topProducts.slice(0, 5).map((product, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium text-slate-800 text-xs">{product.name}</p>
                        <p className="text-xs text-slate-500">{product.quantity} units</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-slate-800 text-sm">{product.revenue.toLocaleString()} RON</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-slate-800">Performance Summary</h2>
                <Calendar className="w-5 h-5 text-slate-400" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center p-4 bg-slate-50 rounded-lg">
                  <p className="text-sm text-slate-600 mb-2">Conversion Rate</p>
                  <p className="text-2xl font-bold text-slate-800">
                    {((metrics.completedOrders / metrics.totalOrders) * 100).toFixed(1)}%
                  </p>
                </div>
                <div className="text-center p-4 bg-slate-50 rounded-lg">
                  <p className="text-sm text-slate-600 mb-2">Revenue per Product</p>
                  <p className="text-2xl font-bold text-slate-800">
                    {Math.round(metrics.totalRevenue / metrics.totalProducts)} RON
                  </p>
                </div>
                <div className="text-center p-4 bg-slate-50 rounded-lg">
                  <p className="text-sm text-slate-600 mb-2">Order Completion Rate</p>
                  <p className="text-2xl font-bold text-slate-800">
                    {((metrics.completedOrders / metrics.totalOrders) * 100).toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-600 mb-2">No data available</h3>
            <p className="text-sm text-slate-500">
              Sync your integrations to start collecting metrics data
            </p>
          </div>
        )}
      </div>

      {showShareModal && selectedClient && (
        <ShareModal
          clientId={selectedClient.id}
          clientName={selectedClient.name}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </div>
  );
}

// TODO: Implement MetricCard component if needed
// interface MetricCardProps {
//   title: string;
//   value: string | number;
//   icon: React.ElementType;
//   iconBg: string;
//   iconColor: string;
//   trend?: number;
// }

// function MetricCard({ title, value, icon: Icon, iconBg, iconColor, trend }: MetricCardProps) {
//   return (
//     <div className="bg-white rounded-lg border border-slate-200 p-3">
//       {trend !== undefined && (
//         <div className={`flex items-center space-x-1 mb-2 ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
//           {trend >= 0 ? (
//             <ArrowUpRight className="w-3 h-3" />
//           ) : (
//             <ArrowDownRight className="w-3 h-3" />
//           )}
//           <span className="text-xs font-semibold">{Math.abs(trend)}%</span>
//         </div>
//       )}
//       <p className="text-xs text-slate-600 mb-1">{title}</p>
//       <p className="text-xl font-bold text-slate-800">{value}</p>
//     </div>
//   );
// }

interface ShareModalProps {
  clientId: string;
  clientName: string;
  onClose: () => void;
}

function ShareModal({ clientId, clientName, onClose }: ShareModalProps) {
  const [expiresIn, setExpiresIn] = useState<'today' | '7d' | '30d' | 'never'>('today');
  const [generatedToken, setGeneratedToken] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeLinks, setActiveLinks] = useState<Array<{
    id: string;
    token: string;
    expires_at: string | null;
    created_at: string;
  }>>([]);

  useEffect(() => {
    fetchActiveLinks();
  }, [clientId]);

  const fetchActiveLinks = async () => {
    const { data, error } = await supabase
      .from('report_shares')
      .select('*')
      .eq('client_id', clientId)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setActiveLinks(data);
    }
  };

  const generateShareLink = async () => {
    setLoading(true);
    try {
      const token = crypto.randomUUID();
      let expiresAt: string | null = null;

      if (expiresIn === 'today') {
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);
        expiresAt = endOfDay.toISOString();
      } else if (expiresIn === '7d') {
        expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      } else if (expiresIn === '30d') {
        expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      }

      const { error } = await supabase
        .from('report_shares')
        .insert({
          client_id: clientId,
          token,
          expires_at: expiresAt
        });

      if (error) throw error;

      setGeneratedToken(token);
      await fetchActiveLinks();
    } catch (error) {
      console.error('Error generating share link:', error);
      alert('Failed to generate share link');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    const link = `${window.location.origin}/shared-report/${generatedToken}`;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const viewReport = () => {
    window.location.pathname = `/shared-report/${generatedToken}`;
  };

  const deleteLink = async (linkId: string) => {
    const { error } = await supabase
      .from('report_shares')
      .delete()
      .eq('id', linkId);

    if (!error) {
      await fetchActiveLinks();
      // TODO: Implement link cleanup logic
      // if (activeLinks.find(l => l.id === linkId)?.token && generatedLink.includes(activeLinks.find(l => l.id === linkId)!.token)) {
      //   setGeneratedLink('');
      // }
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-800">Share Report</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <p className="text-sm text-slate-600 mb-4">
              Generate a secure link to share the report for <span className="font-semibold">{clientName}</span>
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Link Expiration
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {(['today', '7d', '30d', 'never'] as const).map((option) => (
                    <button
                      key={option}
                      onClick={() => setExpiresIn(option)}
                      className={`px-4 py-3 rounded-lg border-2 font-medium transition ${
                        expiresIn === option
                          ? 'border-blue-600 bg-blue-50 text-blue-700'
                          : 'border-slate-200 text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      {option === 'today' ? 'Today' : option === '7d' ? '7 Days' : option === '30d' ? '30 Days' : 'Never'}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={generateShareLink}
                disabled={loading}
                className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition disabled:bg-slate-300"
              >
                {loading ? 'Generating...' : 'Generate Share Link'}
              </button>

              {generatedToken && (
                <div className="space-y-3">
                  <div className="p-4 bg-green-50 rounded-lg border-2 border-green-200">
                    <p className="text-green-800 font-medium mb-2">✓ Share link generated successfully!</p>
                    <p className="text-sm text-green-700">Token: <span className="font-mono">{generatedToken.substring(0, 8)}...</span></p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={viewReport}
                      className="flex items-center justify-center space-x-2 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition font-medium"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>View Report</span>
                    </button>
                    <button
                      onClick={copyToClipboard}
                      className="flex items-center justify-center space-x-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-medium"
                    >
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      <span>{copied ? 'Copied!' : 'Copy Link'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {activeLinks.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-slate-800 mb-3">Active Links</h3>
              <div className="space-y-2">
                {activeLinks.map((link) => (
                  <div
                    key={link.id}
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-mono text-slate-600 truncate">
                        {window.location.origin}/shared-report/{link.token}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        {link.expires_at
                          ? `Expires: ${new Date(link.expires_at).toLocaleDateString()}`
                          : 'Never expires'}
                      </p>
                    </div>
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => window.location.pathname = `/shared-report/${link.token}`}
                        className="p-2 text-green-600 hover:bg-green-50 rounded transition"
                        title="View Report"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(`${window.location.origin}/shared-report/${link.token}`);
                        }}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded transition"
                        title="Copy Link"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteLink(link.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded transition"
                        title="Delete Link"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
