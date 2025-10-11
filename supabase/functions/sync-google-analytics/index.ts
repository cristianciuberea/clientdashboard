import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface GoogleAnalyticsMetrics {
  users: number;
  sessions: number;
  pageviews: number;
  bounceRate: number;
  avgSessionDuration: number;
  newUsers: number;
  conversions: number;
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
      .eq('platform', 'google_analytics')
      .single();

    if (integrationError || !integration) {
      throw new Error('Integration not found');
    }

    const credentials = integration.credentials as any;
    const propertyId = credentials.property_id;
    const serviceAccount = credentials.credentials;

    if (!propertyId || !serviceAccount) {
      throw new Error('Missing Google Analytics credentials');
    }

    const dateFrom = date_from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const dateTo = date_to || new Date().toISOString().split('T')[0];

    let serviceAccountData;
    try {
      serviceAccountData = typeof serviceAccount === 'string' ? JSON.parse(serviceAccount) : serviceAccount;
    } catch {
      throw new Error('Invalid service account JSON');
    }

    const jwtToken = await createJWT(serviceAccountData);
    
    const gaApiUrl = `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`;
    
    const requestBody = {
      dateRanges: [{ startDate: dateFrom, endDate: dateTo }],
      metrics: [
        { name: 'activeUsers' },
        { name: 'sessions' },
        { name: 'screenPageViews' },
        { name: 'bounceRate' },
        { name: 'averageSessionDuration' },
        { name: 'newUsers' },
        { name: 'conversions' },
      ],
    };

    const gaResponse = await fetch(gaApiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${jwtToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!gaResponse.ok) {
      const errorText = await gaResponse.text();
      throw new Error(`Google Analytics API error: ${errorText}`);
    }

    const gaData = await gaResponse.json();

    if (!gaData.rows || gaData.rows.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No data available for the specified date range', metrics: null }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const row = gaData.rows[0].metricValues;

    const metrics: GoogleAnalyticsMetrics = {
      users: parseInt(row[0]?.value || 0),
      sessions: parseInt(row[1]?.value || 0),
      pageviews: parseInt(row[2]?.value || 0),
      bounceRate: parseFloat(row[3]?.value || 0),
      avgSessionDuration: parseFloat(row[4]?.value || 0),
      newUsers: parseInt(row[5]?.value || 0),
      conversions: parseInt(row[6]?.value || 0),
    };

    const { error: insertError } = await supabaseClient
      .from('metrics_snapshots')
      .insert({
        client_id,
        integration_id,
        platform: 'google_analytics',
        metric_type: 'google_analytics',
        date: dateTo,
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
    console.error('Error syncing Google Analytics:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function createJWT(serviceAccount: any): Promise<string> {
  const header = {
    alg: 'RS256',
    typ: 'JWT',
  };

  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/analytics.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const encoder = new TextEncoder();
  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const claimB64 = btoa(JSON.stringify(claim)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  
  const signatureInput = `${headerB64}.${claimB64}`;
  
  const privateKey = serviceAccount.private_key.replace(/\\n/g, '\n');
  
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(privateKey),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    encoder.encode(signatureInput)
  );

  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const jwt = `${signatureInput}.${signatureB64}`;

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----/g, '').replace(/\s/g, '');
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}