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
CREATE INDEX idx_goals_client_id ON goals(client_id);
CREATE INDEX idx_goals_status ON goals(status);
CREATE INDEX idx_goals_period ON goals(period);
CREATE INDEX idx_goals_date_range ON goals(start_date, end_date);

-- Add updated_at trigger
CREATE TRIGGER update_goals_updated_at 
BEFORE UPDATE ON goals
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view goals for their clients"
ON goals FOR SELECT
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

CREATE POLICY "Super admins and managers can delete goals"
ON goals FOR DELETE
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

COMMENT ON TABLE goals IS 'Client goals and objectives with progress tracking';

