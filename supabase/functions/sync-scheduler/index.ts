import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    const { data: integrations, error: integrationsError } = await supabaseClient
      .from('integrations')
      .select('*')
      .eq('status', 'active');

    if (integrationsError) {
      throw integrationsError;
    }

    if (!integrations || integrations.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No active integrations found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results: any[] = [];

    for (const integration of integrations) {
      const now = new Date();
      const lastSync = integration.last_sync_at ? new Date(integration.last_sync_at) : null;
      const syncFrequency = integration.sync_frequency || 60;
      
      const shouldSync = !lastSync || 
        (now.getTime() - lastSync.getTime()) >= syncFrequency * 60 * 1000;

      if (!shouldSync) {
        results.push({
          integration_id: integration.id,
          platform: integration.platform,
          status: 'skipped',
          message: 'Not due for sync yet',
        });
        continue;
      }

      const platformFunctions: Record<string, string> = {
        'facebook_ads': 'sync-facebook-ads',
        'google_analytics': 'sync-google-analytics',
        'woocommerce': 'sync-woocommerce',
        'mailerlite': 'sync-mailerlite',
        'wordpress': 'sync-wordpress',
      };

      const functionName = platformFunctions[integration.platform];
      
      if (!functionName) {
        results.push({
          integration_id: integration.id,
          platform: integration.platform,
          status: 'error',
          message: 'Unknown platform',
        });
        continue;
      }

      try {
        const functionUrl = `${supabaseUrl}/functions/v1/${functionName}`;
        
        const response = await fetch(functionUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${serviceRoleKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            integration_id: integration.id,
            client_id: integration.client_id,
          }),
        });

        const responseData = await response.json();

        if (response.ok) {
          results.push({
            integration_id: integration.id,
            platform: integration.platform,
            status: 'success',
            data: responseData,
          });

          await supabaseClient
            .from('integrations')
            .update({ 
              status: 'active',
              error_message: null,
            })
            .eq('id', integration.id);
        } else {
          throw new Error(responseData.error || 'Sync failed');
        }
      } catch (error) {
        results.push({
          integration_id: integration.id,
          platform: integration.platform,
          status: 'error',
          message: error.message,
        });

        await supabaseClient
          .from('integrations')
          .update({ 
            status: 'error',
            error_message: error.message,
          })
          .eq('id', integration.id);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        synced: results.filter(r => r.status === 'success').length,
        failed: results.filter(r => r.status === 'error').length,
        skipped: results.filter(r => r.status === 'skipped').length,
        results 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in sync scheduler:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});