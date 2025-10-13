-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create a function to call the sync-scheduler edge function
CREATE OR REPLACE FUNCTION trigger_sync_scheduler()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  supabase_url text;
  service_key text;
  response text;
BEGIN
  -- Get Supabase URL and service key from environment
  -- Note: In production, these should be configured in Supabase dashboard
  supabase_url := current_setting('app.settings.supabase_url', true);
  service_key := current_setting('app.settings.service_role_key', true);
  
  IF supabase_url IS NULL OR service_key IS NULL THEN
    RAISE NOTICE 'Supabase URL or Service Key not configured. Skipping sync.';
    RETURN;
  END IF;
  
  -- Call the edge function using http extension
  -- This requires pg_net or http extension
  PERFORM
    net.http_post(
      url := supabase_url || '/functions/v1/sync-scheduler',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || service_key,
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    );
    
  RAISE NOTICE 'Sync scheduler triggered at %', now();
END;
$$;

-- Schedule the sync-scheduler to run every 5 minutes
-- This will check all integrations and sync those that are due
SELECT cron.schedule(
  'auto-sync-integrations',           -- job name
  '*/5 * * * *',                      -- every 5 minutes
  $$SELECT trigger_sync_scheduler();$$
);

-- View scheduled jobs
SELECT * FROM cron.job;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

COMMENT ON FUNCTION trigger_sync_scheduler() IS 
'Triggers the sync-scheduler edge function to automatically sync all active integrations';

