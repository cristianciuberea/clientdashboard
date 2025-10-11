import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface WordPressMetrics {
  totalPosts: number;
  totalPages: number;
  totalComments: number;
  publishedPosts: number;
  draftPosts: number;
  totalUsers: number;
  recentPosts: Array<{
    id: number;
    title: string;
    status: string;
    date: string;
    author: string;
  }>;
  postsByMonth: Array<{
    month: string;
    count: number;
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
      .eq('platform', 'wordpress')
      .single();

    if (integrationError || !integration) {
      throw new Error('Integration not found');
    }

    const credentials = integration.credentials as any;
    const siteUrl = credentials.site_url?.replace(/\/$/, '');
    const apiKey = credentials.api_key;
    const endpoint = credentials.endpoint || '/wp-json/wp/v2';

    if (!siteUrl || !apiKey) {
      throw new Error('Missing WordPress credentials');
    }

    const headers = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    };

    const postsResponse = await fetch(`${siteUrl}${endpoint}/posts?per_page=100`, { headers });
    
    if (!postsResponse.ok) {
      const errorText = await postsResponse.text();
      throw new Error(`WordPress API error: ${errorText}`);
    }

    const posts = await postsResponse.json();
    const totalPosts = parseInt(postsResponse.headers.get('X-WP-Total') || '0');

    const pagesResponse = await fetch(`${siteUrl}${endpoint}/pages?per_page=1`, { headers });
    let totalPages = 0;
    if (pagesResponse.ok) {
      totalPages = parseInt(pagesResponse.headers.get('X-WP-Total') || '0');
    }

    const commentsResponse = await fetch(`${siteUrl}${endpoint}/comments?per_page=1`, { headers });
    let totalComments = 0;
    if (commentsResponse.ok) {
      totalComments = parseInt(commentsResponse.headers.get('X-WP-Total') || '0');
    }

    const usersResponse = await fetch(`${siteUrl}${endpoint}/users?per_page=1`, { headers });
    let totalUsers = 0;
    if (usersResponse.ok) {
      totalUsers = parseInt(usersResponse.headers.get('X-WP-Total') || '0');
    }

    let publishedPosts = 0;
    let draftPosts = 0;
    const recentPosts: any[] = [];
    const postsByMonth: Record<string, number> = {};

    for (const post of posts) {
      if (post.status === 'publish') publishedPosts++;
      if (post.status === 'draft') draftPosts++;

      const postDate = new Date(post.date);
      const monthKey = `${postDate.getFullYear()}-${String(postDate.getMonth() + 1).padStart(2, '0')}`;
      postsByMonth[monthKey] = (postsByMonth[monthKey] || 0) + 1;

      if (recentPosts.length < 10) {
        recentPosts.push({
          id: post.id,
          title: post.title?.rendered || 'Untitled',
          status: post.status,
          date: post.date,
          author: post.author,
        });
      }
    }

    const postsByMonthArray = Object.entries(postsByMonth)
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => b.month.localeCompare(a.month))
      .slice(0, 12);

    const metrics: WordPressMetrics = {
      totalPosts,
      totalPages,
      totalComments,
      publishedPosts,
      draftPosts,
      totalUsers,
      recentPosts,
      postsByMonth: postsByMonthArray,
    };

    const { error: insertError } = await supabaseClient
      .from('metrics_snapshots')
      .insert({
        client_id,
        integration_id,
        platform: 'wordpress',
        metric_type: 'traffic',
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
    console.error('Error syncing WordPress:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});