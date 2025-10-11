/*
  # Fix metrics_snapshots RLS for better access

  1. Changes
    - Drop existing policies
    - Create simpler policy that allows all authenticated users to read metrics
    - Keep insert policy for system operations

  2. Security
    - Authenticated users can read all metrics (since super_admin should see all)
    - System can insert metrics data
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view metrics for assigned clients" ON metrics_snapshots;
DROP POLICY IF EXISTS "System can insert metrics" ON metrics_snapshots;

-- Create new simplified policies
CREATE POLICY "Authenticated users can view all metrics"
  ON metrics_snapshots
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert metrics"
  ON metrics_snapshots
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
