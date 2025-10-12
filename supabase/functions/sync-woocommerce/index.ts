import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface WooCommerceMetrics {
  totalOrders: number;
  totalRevenue: number;
  totalProducts: number;
  completedOrders: number;
  pendingOrders: number;
  processingOrders: number;
  averageOrderValue: number;
  topProducts: Array<{ name: string; quantity: number; revenue: number }>;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { integration_id, client_id, date_from, date_to } = await req.json();

    console.log('Sync request params:', { integration_id, client_id, date_from, date_to });

    if (!integration_id || !client_id) {
      throw new Error('Missing required parameters: integration_id, client_id');
    }

    const isRangeQuery = date_from && date_to && date_from !== date_to;
    const metricType = isRangeQuery ? 'ecommerce_aggregate' : 'ecommerce';
    const snapshotDate = isRangeQuery ? date_from : (date_to || new Date().toISOString().split('T')[0]);

    const { data: integration, error: integrationError } = await supabaseClient
      .from('integrations')
      .select('*')
      .eq('id', integration_id)
      .eq('platform', 'woocommerce')
      .single();

    if (integrationError || !integration) {
      throw new Error('Integration not found');
    }

    const credentials = integration.credentials as any;
    const config = integration.config as any;
    const storeUrl = credentials.store_url?.replace(/\/$/, '');
    const consumerKey = credentials.consumer_key;
    const consumerSecret = credentials.consumer_secret;

    if (!storeUrl || !consumerKey || !consumerSecret) {
      throw new Error('Missing WooCommerce credentials');
    }

    const allowedStatuses = config?.order_statuses || ['processing', 'completed', 'on-hold', 'pending', 'cancelled', 'refunded', 'failed'];

    const auth = btoa(`${consumerKey}:${consumerSecret}`);
    const headers = {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
    };

    const startDateTime = isRangeQuery ? `${date_from}T00:00:00` : `${snapshotDate}T00:00:00`;
    const endDateTime = isRangeQuery ? `${date_to}T23:59:59` : `${snapshotDate}T23:59:59`;

    let allOrders: any[] = [];
    let page = 1;
    let hasMorePages = true;

    while (hasMorePages) {
      const ordersUrl = `${storeUrl}/wp-json/wc/v3/orders?after=${startDateTime}&before=${endDateTime}&per_page=100&page=${page}`;
      const ordersResponse = await fetch(ordersUrl, { headers });

      if (!ordersResponse.ok) {
        const errorText = await ordersResponse.text();
        throw new Error(`WooCommerce API error: ${errorText}`);
      }

      const pageOrders = await ordersResponse.json();

      if (pageOrders.length === 0) {
        hasMorePages = false;
      } else {
        allOrders = allOrders.concat(pageOrders);
        page++;
        if (pageOrders.length < 100) {
          hasMorePages = false;
        }
      }
    }

    const orders = allOrders;

    console.log(`Total orders fetched from WooCommerce: ${orders.length}`);
    console.log('Order statuses:', orders.reduce((acc, order) => {
      acc[order.status] = (acc[order.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>));
    console.log('Allowed statuses for processing:', allowedStatuses);

    const productsUrl = `${storeUrl}/wp-json/wc/v3/products?per_page=100`;
    const productsResponse = await fetch(productsUrl, { headers });
    
    let totalProducts = 0;
    if (productsResponse.ok) {
      const products = await productsResponse.json();
      totalProducts = products.length;
    }

    console.log(`Saving snapshot for date: ${snapshotDate} (${isRangeQuery ? 'range' : 'single day'}) with metric_type: ${metricType}`);

    let totalRevenue = 0;
    let completedOrders = 0;
    let pendingOrders = 0;
    let processingOrders = 0;
    let onHoldOrders = 0;
    let cancelledOrders = 0;
    let refundedOrders = 0;
    let failedOrders = 0;
    let otherStatusOrders = 0;
    const productSales: Record<string, { name: string; quantity: number; revenue: number }> = {};

    for (const order of orders) {
      // Count all orders by status
      switch (order.status) {
        case 'completed':
          completedOrders++;
          break;
        case 'pending':
          pendingOrders++;
          break;
        case 'processing':
          processingOrders++;
          break;
        case 'on-hold':
          onHoldOrders++;
          break;
        case 'cancelled':
          cancelledOrders++;
          break;
        case 'refunded':
          refundedOrders++;
          break;
        case 'failed':
          failedOrders++;
          break;
        default:
          otherStatusOrders++;
      }

      // Only include revenue and products for valid orders
      if (!allowedStatuses.includes(order.status)) {
        continue;
      }

      totalRevenue += parseFloat(order.total || 0);

      for (const item of order.line_items || []) {
        const productId = item.product_id.toString();
        if (!productSales[productId]) {
          productSales[productId] = {
            name: item.name,
            quantity: 0,
            revenue: 0,
          };
        }
        productSales[productId].quantity += item.quantity;
        productSales[productId].revenue += parseFloat(item.total || 0);
      }
    }

    const topProducts = Object.values(productSales)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Total orders = only completed + processing (valid orders)
    const totalOrders = completedOrders + processingOrders;

    console.log(`Final metrics for ${snapshotDate}:`);
    console.log(`- Total orders from API: ${orders.length}`);
    console.log(`- Status breakdown:`);
    console.log(`  - Completed: ${completedOrders}`);
    console.log(`  - Processing: ${processingOrders}`);
    console.log(`  - Pending: ${pendingOrders}`);
    console.log(`  - On-hold: ${onHoldOrders}`);
    console.log(`  - Cancelled: ${cancelledOrders}`);
    console.log(`  - Refunded: ${refundedOrders}`);
    console.log(`  - Failed: ${failedOrders}`);
    console.log(`  - Other: ${otherStatusOrders}`);
    console.log(`- Total revenue (from valid orders): ${totalRevenue}`);
    console.log(`- Top products count: ${topProducts.length}`);

    const metrics: WooCommerceMetrics = {
      totalOrders,
      totalRevenue,
      totalProducts,
      completedOrders,
      pendingOrders,
      processingOrders,
      averageOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
      topProducts,
    };

    const { error: insertError } = await supabaseClient
      .from('metrics_snapshots')
      .insert({
        client_id,
        integration_id,
        platform: 'woocommerce',
        metric_type: metricType,
        date: snapshotDate,
        metrics: metrics,
      });

    if (insertError) {
      console.error(`Failed to insert metrics for ${snapshotDate}:`, insertError);
      throw insertError;
    }

    console.log(`Successfully saved aggregated metrics for ${snapshotDate}`);

    const { error: updateError } = await supabaseClient
      .from('integrations')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', integration_id);

    if (updateError) {
      console.error('Failed to update last_sync_at:', updateError);
    }

    return new Response(
      JSON.stringify({ success: true, metrics }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error syncing WooCommerce:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
