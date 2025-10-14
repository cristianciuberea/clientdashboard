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

    if (!accessToken || !adAccountId) {
      throw new Error('Missing Facebook credentials');
    }

    const dateFrom = date_from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const dateTo = date_to || new Date().toISOString().split('T')[0];

    // Request detailed fields including link clicks and landing page views
    const fields = 'spend,impressions,clicks,inline_link_clicks,actions,ctr,cpc,cpm';
    const timeRange = JSON.stringify({ since: dateFrom, until: dateTo });
    const fbApiUrl = `https://graph.facebook.com/v18.0/${adAccountId}/insights?fields=${fields}&time_range=${timeRange}&time_increment=1&access_token=${accessToken}`;

    const fbResponse = await fetch(fbApiUrl);

    if (!fbResponse.ok) {
      const errorText = await fbResponse.text();
      throw new Error(`Facebook API error: ${errorText}`);
    }

    const fbData = await fbResponse.json();

    if (!fbData.data || fbData.data.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No data available for the specified date range', metrics: null }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const metricsToInsert = [];

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

      // Calculate metrics
      const costPerLinkClick = linkClicks > 0 ? spend / linkClicks : 0;
      const landingPageViewRate = linkClicks > 0 ? (lpViews / linkClicks) * 100 : 0;
      const conversionRate = lpViews > 0 ? (conversionsNum / lpViews) * 100 : 0;

      const metrics: FacebookAdsMetrics = {
        spend,
        impressions,
        clicks, // Keep total clicks for reference
        link_clicks: linkClicks,
        landing_page_views: lpViews,
        conversions: conversionsNum,
        ctr: parseFloat(dayData.ctr || 0),
        cpc: parseFloat(dayData.cpc || 0), // Original CPC from Facebook
        cpm: parseFloat(dayData.cpm || 0),
        cost_per_link_click: costPerLinkClick,
        landing_page_view_rate: landingPageViewRate,
        conversion_rate: conversionRate,
      };

      metricsToInsert.push({
        client_id,
        integration_id,
        platform: 'facebook_ads',
        metric_type: 'facebook_ads',
        date: dayData.date_start,
        metrics: metrics,
      });
    }

    const { error: insertError } = await supabaseClient
      .from('metrics_snapshots')
      .insert(metricsToInsert);

    if (insertError) {
      throw insertError;
    }

    const { error: updateError } = await supabaseClient
      .from('integrations')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', integration_id);

    if (updateError) {
      console.error('Failed to update last_sync_at:', updateError);
    }

    return new Response(
      JSON.stringify({ success: true, days_synced: metricsToInsert.length }),
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