/*
  # Add unique constraint to metrics_snapshots for upsert functionality

  1. Changes
    - Add unique constraint on (client_id, integration_id, platform, metric_type, date)
    - This allows upsert operations to work properly
    - Prevents duplicate snapshots for the same client/integration/platform/type/date

  2. Benefits
    - Enables upsert functionality in sync functions
    - Prevents duplicate snapshots
    - Improves data integrity
*/

-- Add unique constraint to prevent duplicate snapshots
ALTER TABLE metrics_snapshots 
ADD CONSTRAINT unique_snapshot_per_client_integration_platform_type_date 
UNIQUE (client_id, integration_id, platform, metric_type, date);

-- Add index for better performance on upsert operations
CREATE INDEX IF NOT EXISTS idx_metrics_snapshots_upsert 
ON metrics_snapshots (client_id, integration_id, platform, metric_type, date);
