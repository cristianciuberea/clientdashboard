-- Cleanup WooCommerce snapshots
-- This script removes all existing WooCommerce snapshots to allow the new upsert system to work properly

-- First, let's see how many WooCommerce snapshots we have
SELECT 
  platform,
  COUNT(*) as total_snapshots,
  MIN(date) as earliest_date,
  MAX(date) as latest_date
FROM metrics_snapshots 
WHERE platform = 'woocommerce'
GROUP BY platform;

-- Delete all WooCommerce snapshots (they will be recreated by the new upsert system)
DELETE FROM metrics_snapshots 
WHERE platform = 'woocommerce';

-- Verify the cleanup
SELECT 
  platform,
  COUNT(*) as total_snapshots,
  MIN(date) as earliest_date,
  MAX(date) as latest_date
FROM metrics_snapshots 
GROUP BY platform;

-- Show final result
SELECT 'WooCommerce cleanup completed. Snapshots removed.' as status;
