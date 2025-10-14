/*
  # Agency Finance Management Tables

  1. New Tables
    - `agency_client_income`
      - `id` (uuid, primary key) - Unique identifier
      - `client_id` (uuid, foreign key) - References clients table
      - `amount` (decimal) - Income amount
      - `currency` (varchar) - Currency code (default RON)
      - `category` (varchar) - Income category (monthly_retainer, project_fee, commission, bonus, other)
      - `description` (text) - Optional description
      - `invoice_number` (varchar) - Invoice reference
      - `payment_date` (date) - When payment was received
      - `payment_method` (varchar) - How payment was received
      - `status` (varchar) - Payment status (pending, received, cancelled)
      - `created_by` (uuid) - User who created the record
      - `created_at` (timestamptz) - Creation timestamp
      - `updated_at` (timestamptz) - Last update timestamp

    - `agency_client_expenses`
      - `id` (uuid, primary key) - Unique identifier
      - `client_id` (uuid, foreign key) - References clients table
      - `amount` (decimal) - Expense amount
      - `currency` (varchar) - Currency code (default RON)
      - `category` (varchar) - Expense category (salaries, software, ads_management, meetings, travel, other)
      - `description` (text) - Optional description
      - `expense_date` (date) - When expense occurred
      - `is_recurring` (boolean) - Whether this is a recurring expense
      - `recurring_period` (varchar) - Frequency if recurring (monthly, quarterly, yearly)
      - `created_by` (uuid) - User who created the record
      - `created_at` (timestamptz) - Creation timestamp
      - `updated_at` (timestamptz) - Last update timestamp

  2. Indexes
    - Income: client_id, payment_date, status, category
    - Expenses: client_id, expense_date, category, is_recurring

  3. Security
    - Enable RLS on both tables
    - Super admins can view and manage all records
    - Managers can view and manage records for their assigned clients

  4. Purpose
    - Track all income received from clients (invoices, payments, retainers)
    - Track all agency expenses related to client work (salaries, tools, resources)
    - Calculate net profit per client for agency financial management
*/

-- 1. Agency Client Income (Încasări de la client)
CREATE TABLE IF NOT EXISTS agency_client_income (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'RON',
  category VARCHAR(100) NOT NULL,
  description TEXT,
  invoice_number VARCHAR(100),
  payment_date DATE NOT NULL,
  payment_method VARCHAR(50),
  status VARCHAR(20) DEFAULT 'pending',
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Agency Client Expenses (Cheltuieli pentru client)
CREATE TABLE IF NOT EXISTS agency_client_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'RON',
  category VARCHAR(100) NOT NULL,
  description TEXT,
  expense_date DATE NOT NULL,
  is_recurring BOOLEAN DEFAULT false,
  recurring_period VARCHAR(20),
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_agency_income_client_id ON agency_client_income(client_id);
CREATE INDEX IF NOT EXISTS idx_agency_income_payment_date ON agency_client_income(payment_date);
CREATE INDEX IF NOT EXISTS idx_agency_income_status ON agency_client_income(status);
CREATE INDEX IF NOT EXISTS idx_agency_income_category ON agency_client_income(category);

CREATE INDEX IF NOT EXISTS idx_agency_expenses_client_id ON agency_client_expenses(client_id);
CREATE INDEX IF NOT EXISTS idx_agency_expenses_expense_date ON agency_client_expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_agency_expenses_category ON agency_client_expenses(category);
CREATE INDEX IF NOT EXISTS idx_agency_expenses_is_recurring ON agency_client_expenses(is_recurring);

-- Add triggers for updated_at
CREATE OR REPLACE FUNCTION update_agency_income_updated_at()
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
    WHERE tgname = 'agency_income_updated_at'
  ) THEN
    CREATE TRIGGER agency_income_updated_at
      BEFORE UPDATE ON agency_client_income
      FOR EACH ROW
      EXECUTE FUNCTION update_agency_income_updated_at();
  END IF;
END $$;

CREATE OR REPLACE FUNCTION update_agency_expenses_updated_at()
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
    WHERE tgname = 'agency_expenses_updated_at'
  ) THEN
    CREATE TRIGGER agency_expenses_updated_at
      BEFORE UPDATE ON agency_client_expenses
      FOR EACH ROW
      EXECUTE FUNCTION update_agency_expenses_updated_at();
  END IF;
END $$;

-- Enable RLS
ALTER TABLE agency_client_income ENABLE ROW LEVEL SECURITY;
ALTER TABLE agency_client_expenses ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Super admins can view all income" ON agency_client_income;
DROP POLICY IF EXISTS "Super admins can manage income" ON agency_client_income;
DROP POLICY IF EXISTS "Managers can view assigned client income" ON agency_client_income;
DROP POLICY IF EXISTS "Managers can manage assigned client income" ON agency_client_income;
DROP POLICY IF EXISTS "Super admins can view all agency expenses" ON agency_client_expenses;
DROP POLICY IF EXISTS "Super admins can manage agency expenses" ON agency_client_expenses;
DROP POLICY IF EXISTS "Managers can view assigned client agency expenses" ON agency_client_expenses;
DROP POLICY IF EXISTS "Managers can manage assigned client agency expenses" ON agency_client_expenses;

-- RLS Policies for Income
CREATE POLICY "Super admins can view all income"
  ON agency_client_income FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can manage income"
  ON agency_client_income FOR ALL
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

CREATE POLICY "Managers can view assigned client income"
  ON agency_client_income FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM client_users
      WHERE client_users.client_id = agency_client_income.client_id
      AND client_users.user_id = auth.uid()
      AND client_users.role = 'manager'
    )
  );

CREATE POLICY "Managers can manage assigned client income"
  ON agency_client_income FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM client_users
      WHERE client_users.client_id = agency_client_income.client_id
      AND client_users.user_id = auth.uid()
      AND client_users.role = 'manager'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM client_users
      WHERE client_users.client_id = agency_client_income.client_id
      AND client_users.user_id = auth.uid()
      AND client_users.role = 'manager'
    )
  );

-- RLS Policies for Expenses
CREATE POLICY "Super admins can view all agency expenses"
  ON agency_client_expenses FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can manage agency expenses"
  ON agency_client_expenses FOR ALL
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

CREATE POLICY "Managers can view assigned client agency expenses"
  ON agency_client_expenses FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM client_users
      WHERE client_users.client_id = agency_client_expenses.client_id
      AND client_users.user_id = auth.uid()
      AND client_users.role = 'manager'
    )
  );

CREATE POLICY "Managers can manage assigned client agency expenses"
  ON agency_client_expenses FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM client_users
      WHERE client_users.client_id = agency_client_expenses.client_id
      AND client_users.user_id = auth.uid()
      AND client_users.role = 'manager'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM client_users
      WHERE client_users.client_id = agency_client_expenses.client_id
      AND client_users.user_id = auth.uid()
      AND client_users.role = 'manager'
    )
  );

-- Grant permissions
GRANT ALL ON agency_client_income TO authenticated;
GRANT ALL ON agency_client_expenses TO authenticated;

-- Add helpful comments
COMMENT ON TABLE agency_client_income IS 'Track all income received from clients (invoices, payments, retainers)';
COMMENT ON TABLE agency_client_expenses IS 'Track all agency expenses related to client work (salaries, tools, resources)';
COMMENT ON COLUMN agency_client_income.category IS 'Type of income: monthly_retainer, project_fee, commission, bonus, other';
COMMENT ON COLUMN agency_client_expenses.category IS 'Type of expense: salaries, software, ads_management, meetings, travel, other';