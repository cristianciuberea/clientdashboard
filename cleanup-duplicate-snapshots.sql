-- Cleanup duplicate Facebook snapshots
-- This script removes all existing Facebook snapshots to allow the new system to work properly

-- First, let's see how many snapshots we have
SELECT 
  platform,
  COUNT(*) as total_snapshots,
  MIN(date) as earliest_date,
  MAX(date) as latest_date
FROM metrics_snapshots 
GROUP BY platform;

-- Delete all Facebook and WooCommerce snapshots (they will be recreated by the new sync system)
DELETE FROM metrics_snapshots 
WHERE platform IN ('facebook_ads', 'woocommerce');

-- Verify the cleanup
SELECT 
  platform,
  COUNT(*) as total_snapshots,
  MIN(date) as earliest_date,
  MAX(date) as latest_date
FROM metrics_snapshots 
GROUP BY platform;

-- Optional: Also clean up any orphaned snapshots (if any)
-- DELETE FROM metrics_snapshots 
-- WHERE client_id NOT IN (SELECT id FROM clients);

-- Show final result
SELECT 'Cleanup completed. Facebook and WooCommerce snapshots removed.' as status;
