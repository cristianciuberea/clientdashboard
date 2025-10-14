/*
  # Create client expenses table for detailed expense tracking

  1. New Tables
    - `client_expenses`
      - `id` (uuid, primary key) - Unique identifier
      - `client_id` (uuid, foreign key) - References clients table
      - `category` (varchar) - Expense category (e.g., salaries, rent, utilities)
      - `amount` (decimal) - Expense amount
      - `description` (text) - Optional description
      - `is_recurring` (boolean) - Whether this is a recurring monthly expense
      - `created_at` (timestamptz) - Creation timestamp
      - `updated_at` (timestamptz) - Last update timestamp

  2. Indexes
    - `idx_client_expenses_client_id` - Fast lookups by client
    - `idx_client_expenses_is_recurring` - Filter by recurring status

  3. Security
    - Enable RLS on client_expenses table
    - Super admins can view and manage all expenses
    - Managers can view expenses for their assigned clients
    - Managers can fully manage expenses for their assigned clients
    - Specialists can only view expenses for their assigned clients

  4. Constraints
    - Cascade delete when client is deleted
    - Amount defaults to 0
    - Recurring flag defaults to true
    - Automatic timestamp updates via trigger
*/

-- Create client_expenses table
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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'client_expenses_updated_at'
  ) THEN
    CREATE TRIGGER client_expenses_updated_at
      BEFORE UPDATE ON client_expenses
      FOR EACH ROW
      EXECUTE FUNCTION update_client_expenses_updated_at();
  END IF;
END $$;

-- Enable RLS
ALTER TABLE client_expenses ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Super admins can view all expenses" ON client_expenses;
DROP POLICY IF EXISTS "Super admins can insert expenses" ON client_expenses;
DROP POLICY IF EXISTS "Super admins can update expenses" ON client_expenses;
DROP POLICY IF EXISTS "Super admins can delete expenses" ON client_expenses;
DROP POLICY IF EXISTS "Managers can view assigned client expenses" ON client_expenses;
DROP POLICY IF EXISTS "Managers can manage assigned client expenses" ON client_expenses;

-- RLS Policies
CREATE POLICY "Super admins can view all expenses"
  ON client_expenses FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can insert expenses"
  ON client_expenses FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can update expenses"
  ON client_expenses FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can delete expenses"
  ON client_expenses FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

CREATE POLICY "Managers can view assigned client expenses"
  ON client_expenses FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM client_users
      WHERE client_users.client_id = client_expenses.client_id
      AND client_users.user_id = auth.uid()
      AND client_users.role IN ('manager', 'specialist')
    )
  );

CREATE POLICY "Managers can manage assigned client expenses"
  ON client_expenses FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM client_users
      WHERE client_users.client_id = client_expenses.client_id
      AND client_users.user_id = auth.uid()
      AND client_users.role = 'manager'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM client_users
      WHERE client_users.client_id = client_expenses.client_id
      AND client_users.user_id = auth.uid()
      AND client_users.role = 'manager'
    )
  );

-- Grant permissions
GRANT ALL ON client_expenses TO authenticated;

-- Add table comment
COMMENT ON TABLE client_expenses IS 'Detailed expense tracking for clients with categories and recurring status';