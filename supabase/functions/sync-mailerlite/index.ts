import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface MailerLiteMetrics {
  totalSubscribers: number;
  activeSubscribers: number;
  unsubscribed: number;
  bounced: number;
  totalCampaigns: number;
  campaignsSent: number;
  openRate: number;
  clickRate: number;
  unsubscribeRate: number;
  recentCampaigns: Array<{
    id: string;
    name: string;
    sent: number;
    opens: number;
    clicks: number;
    openRate: number;
    clickRate: number;
  }>;
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
      .eq('platform', 'mailerlite')
      .single();

    if (integrationError || !integration) {
      throw new Error('Integration not found');
    }

    const credentials = integration.credentials as any;
    const apiKey = credentials.api_key;

    if (!apiKey) {
      throw new Error('Missing MailerLite API key');
    }

    const headers = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    };

    const subscribersResponse = await fetch('https://connect.mailerlite.com/api/subscribers?limit=1', { headers });
    
    if (!subscribersResponse.ok) {
      const errorText = await subscribersResponse.text();
      throw new Error(`MailerLite API error: ${errorText}`);
    }

    const subscribersData = await subscribersResponse.json();
    const totalSubscribers = subscribersData.total || 0;

    const groupsResponse = await fetch('https://connect.mailerlite.com/api/groups', { headers });
    let activeSubscribers = 0;
    let unsubscribed = 0;
    let bounced = 0;

    if (groupsResponse.ok) {
      const groupsData = await groupsResponse.json();
      for (const group of groupsData.data || []) {
        activeSubscribers += group.active_count || 0;
        unsubscribed += group.unsubscribed_count || 0;
        bounced += group.bounced_count || 0;
      }
    }

    const dateFrom = date_from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const dateTo = date_to || new Date().toISOString();

    const campaignsResponse = await fetch(
      `https://connect.mailerlite.com/api/campaigns?filter[status]=sent&limit=10`,
      { headers }
    );

    let totalCampaigns = 0;
    let campaignsSent = 0;
    let totalOpens = 0;
    let totalClicks = 0;
    let totalSent = 0;
    let totalUnsubscribes = 0;
    const recentCampaigns: any[] = [];

    if (campaignsResponse.ok) {
      const campaignsData = await campaignsResponse.json();
      totalCampaigns = campaignsData.total || 0;
      
      for (const campaign of campaignsData.data || []) {
        if (campaign.status === 'sent') {
          campaignsSent++;
          const sent = campaign.emails_count || 0;
          const opens = campaign.opened?.count || 0;
          const clicks = campaign.clicked?.count || 0;
          
          totalSent += sent;
          totalOpens += opens;
          totalClicks += clicks;
          totalUnsubscribes += campaign.unsubscribed?.count || 0;

          recentCampaigns.push({
            id: campaign.id,
            name: campaign.name,
            sent,
            opens,
            clicks,
            openRate: sent > 0 ? (opens / sent) * 100 : 0,
            clickRate: sent > 0 ? (clicks / sent) * 100 : 0,
          });
        }
      }
    }

    const metrics: MailerLiteMetrics = {
      totalSubscribers,
      activeSubscribers,
      unsubscribed,
      bounced,
      totalCampaigns,
      campaignsSent,
      openRate: totalSent > 0 ? (totalOpens / totalSent) * 100 : 0,
      clickRate: totalSent > 0 ? (totalClicks / totalSent) * 100 : 0,
      unsubscribeRate: totalSent > 0 ? (totalUnsubscribes / totalSent) * 100 : 0,
      recentCampaigns: recentCampaigns.slice(0, 10),
    };

    const { error: insertError } = await supabaseClient
      .from('metrics_snapshots')
      .insert({
        client_id,
        integration_id,
        platform: 'mailerlite',
        metric_type: 'email',
        date: new Date().toISOString().split('T')[0],
        metrics: metrics,
      });

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
      JSON.stringify({ success: true, metrics }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error syncing MailerLite:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});