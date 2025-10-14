/*
  # Create goals table for client objectives tracking

  1. New Tables
    - `goals`
      - `id` (uuid, primary key) - Unique identifier
      - `client_id` (uuid, foreign key) - References clients table
      - `metric_type` (text) - Type of metric (revenue, orders, products, conversions, roas, custom)
      - `target_value` (numeric) - Target value to achieve
      - `period` (text) - Time period (daily, weekly, monthly, yearly)
      - `start_date` (date) - Goal start date
      - `end_date` (date) - Goal end date
      - `label` (text) - Optional label for the goal
      - `description` (text) - Optional description
      - `status` (text) - Goal status (active, completed, failed, archived)
      - `created_at` (timestamptz) - Creation timestamp
      - `updated_at` (timestamptz) - Last update timestamp

  2. Indexes
    - `idx_goals_client_id` - Fast lookups by client
    - `idx_goals_status` - Filter by status
    - `idx_goals_period` - Filter by period
    - `idx_goals_date_range` - Date range queries

  3. Security
    - Enable RLS on goals table
    - Users can view goals for their assigned clients
    - Super admins and managers can create, update, and delete goals
    - Regular users have read-only access to their client goals

  4. Constraints
    - Metric type validation
    - Target value must be positive
    - Period validation
    - Status validation
    - End date must be after or equal to start date
    - Cascade delete when client is deleted
*/

-- Create goals table for client objectives and targets
CREATE TABLE IF NOT EXISTS goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  metric_type TEXT NOT NULL CHECK (metric_type IN ('revenue', 'orders', 'products', 'conversions', 'roas', 'custom')),
  target_value NUMERIC NOT NULL CHECK (target_value > 0),
  period TEXT NOT NULL DEFAULT 'monthly' CHECK (period IN ('daily', 'weekly', 'monthly', 'yearly')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  label TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'failed', 'archived')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT valid_date_range CHECK (end_date >= start_date)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_goals_client_id ON goals(client_id);
CREATE INDEX IF NOT EXISTS idx_goals_status ON goals(status);
CREATE INDEX IF NOT EXISTS idx_goals_period ON goals(period);
CREATE INDEX IF NOT EXISTS idx_goals_date_range ON goals(start_date, end_date);

-- Add updated_at trigger
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_goals_updated_at'
  ) THEN
    CREATE TRIGGER update_goals_updated_at 
    BEFORE UPDATE ON goals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Enable RLS
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view goals for their clients" ON goals;
DROP POLICY IF EXISTS "Super admins and managers can insert goals" ON goals;
DROP POLICY IF EXISTS "Super admins and managers can update goals" ON goals;
DROP POLICY IF EXISTS "Super admins and managers can delete goals" ON goals;

-- RLS Policies
CREATE POLICY "Users can view goals for their clients"
ON goals FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND (
      profiles.role = 'super_admin'
      OR EXISTS (
        SELECT 1 FROM client_users
        WHERE client_users.user_id = auth.uid()
        AND client_users.client_id = goals.client_id
      )
    )
  )
);

CREATE POLICY "Super admins and managers can insert goals"
ON goals FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND (
      profiles.role = 'super_admin'
      OR (
        profiles.role = 'manager'
        AND EXISTS (
          SELECT 1 FROM client_users
          WHERE client_users.user_id = auth.uid()
          AND client_users.client_id = goals.client_id
          AND client_users.role = 'manager'
        )
      )
    )
  )
);

CREATE POLICY "Super admins and managers can update goals"
ON goals FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND (
      profiles.role = 'super_admin'
      OR (
        profiles.role = 'manager'
        AND EXISTS (
          SELECT 1 FROM client_users
          WHERE client_users.user_id = auth.uid()
          AND client_users.client_id = goals.client_id
          AND client_users.role = 'manager'
        )
      )
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND (
      profiles.role = 'super_admin'
      OR (
        profiles.role = 'manager'
        AND EXISTS (
          SELECT 1 FROM client_users
          WHERE client_users.user_id = auth.uid()
          AND client_users.client_id = goals.client_id
          AND client_users.role = 'manager'
        )
      )
    )
  )
);

CREATE POLICY "Super admins and managers can delete goals"
ON goals FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND (
      profiles.role = 'super_admin'
      OR (
        profiles.role = 'manager'
        AND EXISTS (
          SELECT 1 FROM client_users
          WHERE client_users.user_id = auth.uid()
          AND client_users.client_id = goals.client_id
          AND client_users.role = 'manager'
        )
      )
    )
  )
);

-- Grant permissions
GRANT ALL ON goals TO authenticated;

-- Add table comment
COMMENT ON TABLE goals IS 'Client goals and objectives with progress tracking';