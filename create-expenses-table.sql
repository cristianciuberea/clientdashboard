-- Create client_expenses table for tracking individual expense items
CREATE TABLE IF NOT EXISTS client_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  category VARCHAR(100) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  description TEXT,
  is_recurring BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_client_expenses_client_id ON client_expenses(client_id);
CREATE INDEX IF NOT EXISTS idx_client_expenses_is_recurring ON client_expenses(is_recurring);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_client_expenses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER client_expenses_updated_at
  BEFORE UPDATE ON client_expenses
  FOR EACH ROW
  EXECUTE FUNCTION update_client_expenses_updated_at();

-- Enable RLS
ALTER TABLE client_expenses ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Super admins can do everything
CREATE POLICY "Super admins can view all expenses"
  ON client_expenses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can insert expenses"
  ON client_expenses FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can update expenses"
  ON client_expenses FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can delete expenses"
  ON client_expenses FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- Managers and Specialists can view expenses for their assigned clients
CREATE POLICY "Managers can view assigned client expenses"
  ON client_expenses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM client_users
      WHERE client_users.client_id = client_expenses.client_id
      AND client_users.user_id = auth.uid()
      AND client_users.role IN ('manager', 'specialist')
    )
  );

-- Managers can insert/update/delete expenses for their assigned clients
CREATE POLICY "Managers can manage assigned client expenses"
  ON client_expenses FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM client_users
      WHERE client_users.client_id = client_expenses.client_id
      AND client_users.user_id = auth.uid()
      AND client_users.role = 'manager'
    )
  );

