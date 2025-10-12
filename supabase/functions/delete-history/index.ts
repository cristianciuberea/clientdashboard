import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface DeletePayload {
  client_id: string;
  integration_id?: string;
  platform?: string; // e.g. 'woocommerce'
  date_from: string; // YYYY-MM-DD
  date_to: string;   // YYYY-MM-DD
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = (await req.json()) as Partial<DeletePayload>;
    const client_id = body.client_id;
    const platform = body.platform;
    const integration_id = body.integration_id;
    const date_from = body.date_from;
    const date_to = body.date_to;

    if (!client_id || !date_from || !date_to) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: client_id, date_from, date_to' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Deleting metrics_snapshots with params:', { client_id, platform, integration_id, date_from, date_to });

    let query = supabaseClient
      .from('metrics_snapshots')
      .delete()
      .eq('client_id', client_id)
      .gte('date', date_from)
      .lte('date', date_to);

    if (platform) {
      query = query.eq('platform', platform);
    }
    if (integration_id) {
      query = query.eq('integration_id', integration_id);
    }

    // Return deleted rows to count them
    const { data, error } = await query.select('*');

    if (error) {
      throw error;
    }

    const deleted = Array.isArray(data) ? data.length : 0;
    console.log(`Deleted ${deleted} snapshots`);

    return new Response(
      JSON.stringify({ success: true, deleted }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in delete-history:', error);
    return new Response(
      JSON.stringify({ error: (error as any)?.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});


