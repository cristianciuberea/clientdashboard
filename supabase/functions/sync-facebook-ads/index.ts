import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface FacebookAdsMetrics {
  spend: number;
  impressions: number;
  clicks: number; // Total clicks (kept for backward compatibility)
  link_clicks: number; // Inline link clicks (what we actually want)
  landing_page_views: number; // Landing page views
  conversions: number;
  ctr: number;
  cpc: number;
  cpm: number;
  cost_per_link_click: number; // Cost per link click (not total clicks)
  landing_page_view_rate: number; // Landing page views / link clicks
  conversion_rate: number; // Conversions / landing page views * 100
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

    if (!integration_id || !client_id) {
      throw new Error('Missing required parameters: integration_id, client_id');
    }

    const { data: integration, error: integrationError } = await supabaseClient
      .from('integrations')
      .select('*')
      .eq('id', integration_id)
      .eq('platform', 'facebook_ads')
      .single();

    if (integrationError || !integration) {
      throw new Error('Integration not found');
    }

    const credentials = integration.credentials as any;
    const accessToken = credentials.access_token;
    const adAccountId = credentials.ad_account_id;

    console.log('Facebook credentials check:', {
      hasAccessToken: !!accessToken,
      hasAdAccountId: !!adAccountId,
      adAccountId: adAccountId
    });

    if (!accessToken || !adAccountId) {
      throw new Error('Missing Facebook credentials');
    }

    // Only sync today's data, not historical data
    const today = new Date().toISOString().split('T')[0];
    const dateFrom = date_from || today;
    const dateTo = date_to || today;

    console.log('Date range for Facebook sync:', { dateFrom, dateTo });

    // Request detailed fields including link clicks and landing page views
    const fields = 'spend,impressions,clicks,inline_link_clicks,actions,ctr,cpc,cpm';
    const timeRange = JSON.stringify({ since: dateFrom, until: dateTo });
    const fbApiUrl = `https://graph.facebook.com/v18.0/${adAccountId}/insights?fields=${fields}&time_range=${timeRange}&time_increment=1&access_token=${accessToken}`;

    console.log('Facebook API URL:', fbApiUrl);
    const fbResponse = await fetch(fbApiUrl);

    if (!fbResponse.ok) {
      const errorText = await fbResponse.text();
      console.error('Facebook API error:', errorText);
      throw new Error(`Facebook API error: ${errorText}`);
    }

    const fbData = await fbResponse.json();
    console.log('Facebook API response:', JSON.stringify(fbData, null, 2));

    if (!fbData.data || fbData.data.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No data available for the specified date range', metrics: null }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Aggregate all days into a single snapshot (like WooCommerce)
    let totalSpend = 0;
    let totalImpressions = 0;
    let totalClicks = 0;
    let totalLinkClicks = 0;
    let totalLandingPageViews = 0;
    let totalConversions = 0;
    let totalCtr = 0;
    let totalCpc = 0;
    let totalCpm = 0;

    for (const dayData of fbData.data) {
      // Extract conversions (purchases)
      const conversions = dayData.actions?.find((a: any) => a.action_type === 'purchase')?.value || 0;
      
      // Extract landing page views from actions
      const landingPageViews = dayData.actions?.find((a: any) => a.action_type === 'landing_page_view')?.value || 0;

      // Parse values
      const spend = parseFloat(dayData.spend || 0);
      const impressions = parseInt(dayData.impressions || 0);
      const clicks = parseInt(dayData.clicks || 0);
      const linkClicks = parseInt(dayData.inline_link_clicks || 0);
      const lpViews = parseInt(landingPageViews);
      const conversionsNum = parseInt(conversions);

      // Aggregate totals
      totalSpend += spend;
      totalImpressions += impressions;
      totalClicks += clicks;
      totalLinkClicks += linkClicks;
      totalLandingPageViews += lpViews;
      totalConversions += conversionsNum;
      totalCtr += parseFloat(dayData.ctr || 0);
      totalCpc += parseFloat(dayData.cpc || 0);
      totalCpm += parseFloat(dayData.cpm || 0);
    }

    // Calculate averages
    const daysCount = fbData.data.length;
    const avgCtr = daysCount > 0 ? totalCtr / daysCount : 0;
    const avgCpc = daysCount > 0 ? totalCpc / daysCount : 0;
    const avgCpm = daysCount > 0 ? totalCpm / daysCount : 0;

    // Calculate derived metrics
    const costPerLinkClick = totalLinkClicks > 0 ? totalSpend / totalLinkClicks : 0;
    const landingPageViewRate = totalLinkClicks > 0 ? (totalLandingPageViews / totalLinkClicks) * 100 : 0;
    const conversionRate = totalLandingPageViews > 0 ? (totalConversions / totalLandingPageViews) * 100 : 0;

    const metrics: FacebookAdsMetrics = {
      spend: totalSpend,
      impressions: totalImpressions,
      clicks: totalClicks,
      link_clicks: totalLinkClicks,
      landing_page_views: totalLandingPageViews,
      conversions: totalConversions,
      ctr: avgCtr,
      cpc: avgCpc,
      cpm: avgCpm,
      cost_per_link_click: costPerLinkClick,
      landing_page_view_rate: landingPageViewRate,
      conversion_rate: conversionRate,
    };

    // Use upsert to update existing snapshot or create new one
    const { error: upsertError } = await supabaseClient
      .from('metrics_snapshots')
      .upsert({
        client_id,
        integration_id,
        platform: 'facebook_ads',
        metric_type: 'facebook_ads',
        date: dateTo, // Single date for the period
        metrics: metrics,
      }, {
        onConflict: 'client_id,integration_id,platform,metric_type,date'
      });

    if (upsertError) {
      throw upsertError;
    }

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
    console.error('Error syncing Facebook Ads:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});