import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface WooCommerceOrder {
  id: number;
  status: string;
  total: string;
  date_created: string;
  line_items: Array<{
    product_id: number;
    name: string;
    quantity: number;
    total: string;
  }>;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const body = await req.json();
    const integrationId = body.integrationId || body.integration_id;

    if (!integrationId) {
      throw new Error('Integration ID is required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const integrationResponse = await fetch(
      `${supabaseUrl}/rest/v1/integrations?id=eq.${integrationId}&select=*`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      }
    );

    const integrations = await integrationResponse.json();
    if (!integrations || integrations.length === 0) {
      throw new Error('Integration not found');
    }

    const integration = integrations[0];
    const { store_url, consumer_key, consumer_secret } = integration.credentials;

    const today = new Date();
    const snapshotDate = today.toISOString().split('T')[0];

    console.log(`Syncing WooCommerce for ${snapshotDate}`);

    const auth = btoa(`${consumer_key}:${consumer_secret}`);
    const baseUrl = store_url.replace(/\/$/, '');

    const ordersUrl = `${baseUrl}/wp-json/wc/v3/orders?after=${snapshotDate}T00:00:00&before=${snapshotDate}T23:59:59&per_page=100`;
    console.log('Fetching orders from:', ordersUrl);

    const ordersResponse = await fetch(ordersUrl, {
      headers: {
        'Authorization': `Basic ${auth}`,
      },
    });

    if (!ordersResponse.ok) {
      const errorText = await ordersResponse.text();
      console.error('WooCommerce API error:', errorText);
      throw new Error(`WooCommerce API error: ${ordersResponse.status} - ${errorText}`);
    }

    const orders: WooCommerceOrder[] = await ordersResponse.json();
    console.log(`Found ${orders.length} orders for ${snapshotDate}`);

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

    const allowedStatuses = ['completed', 'processing'];

    for (const order of orders) {
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

      if (!allowedStatuses.includes(order.status)) {
        console.log(`Skipping order ${order.id} with status: ${order.status}`);
        continue;
      }

      console.log(`Processing order ${order.id} with status: ${order.status}`);

      totalRevenue += parseFloat(order.total || '0');

      for (const item of order.line_items || []) {
        const productId = item.product_id.toString();
        console.log(`Order ${order.id} - Product: ${item.name}, Quantity: ${item.quantity}, Total: ${item.total}`);
        if (!productSales[productId]) {
          productSales[productId] = {
            name: item.name,
            quantity: 0,
            revenue: 0,
          };
        }
        productSales[productId].quantity += item.quantity;
        productSales[productId].revenue += parseFloat(item.total || '0');
      }
    }

    const topProducts = Object.values(productSales)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    const totalOrders = completedOrders + processingOrders;

    console.log(`Final metrics for ${snapshotDate}:`);
    console.log(`- Total orders from API: ${orders.length}`);
    console.log(`- Status breakdown:`);
    console.log(`  - Completed: ${completedOrders}`);
    console.log(`  - Processing: ${processingOrders}`);
    console.log(`  - Pending: ${pendingOrders}`);
    console.log(`  - On Hold: ${onHoldOrders}`);
    console.log(`  - Cancelled: ${cancelledOrders}`);
    console.log(`  - Refunded: ${refundedOrders}`);
    console.log(`  - Failed: ${failedOrders}`);
    console.log(`  - Other: ${otherStatusOrders}`);
    console.log(`- Valid orders (completed + processing): ${totalOrders}`);
    console.log(`- Total Revenue: ${totalRevenue} RON`);
    console.log(`- Top Products:`, topProducts);

    const metricsData = {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalOrders,
      completedOrders,
      pendingOrders,
      processingOrders,
      onHoldOrders,
      cancelledOrders,
      refundedOrders,
      failedOrders,
      topProducts,
    };

    const { error: insertError } = await fetch(
      `${supabaseUrl}/rest/v1/metrics_snapshots`,
      {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({
          integration_id: integrationId,
          client_id: integration.client_id,
          platform: 'woocommerce',
          date: snapshotDate,
          metrics: metricsData,
        }),
      }
    );

    if (insertError) {
      console.error('Error inserting metrics:', insertError);
      throw insertError;
    }

    console.log('Metrics saved successfully');

    return new Response(
      JSON.stringify({ success: true, metrics: metricsData }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error syncing WooCommerce:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
