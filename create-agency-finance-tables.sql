-- Agency Finance Management Tables
-- Track income and expenses for each client from agency perspective

-- 1. Agency Client Income (Încasări de la client)
CREATE TABLE IF NOT EXISTS agency_client_income (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'RON',
  category VARCHAR(100) NOT NULL, -- 'monthly_retainer', 'project_fee', 'commission', 'bonus', 'other'
  description TEXT,
  invoice_number VARCHAR(100),
  payment_date DATE NOT NULL,
  payment_method VARCHAR(50), -- 'bank_transfer', 'cash', 'paypal', 'other'
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'received', 'cancelled'
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
  category VARCHAR(100) NOT NULL, -- 'salaries', 'software', 'ads_management', 'meetings', 'travel', 'other'
  description TEXT,
  expense_date DATE NOT NULL,
  is_recurring BOOLEAN DEFAULT false,
  recurring_period VARCHAR(20), -- 'monthly', 'quarterly', 'yearly' (if is_recurring = true)
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

CREATE TRIGGER agency_income_updated_at
  BEFORE UPDATE ON agency_client_income
  FOR EACH ROW
  EXECUTE FUNCTION update_agency_income_updated_at();

CREATE OR REPLACE FUNCTION update_agency_expenses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER agency_expenses_updated_at
  BEFORE UPDATE ON agency_client_expenses
  FOR EACH ROW
  EXECUTE FUNCTION update_agency_expenses_updated_at();

-- Enable RLS
ALTER TABLE agency_client_income ENABLE ROW LEVEL SECURITY;
ALTER TABLE agency_client_expenses ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Income
-- Super admins can do everything
CREATE POLICY "Super admins can view all income"
  ON agency_client_income FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can manage income"
  ON agency_client_income FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- Managers can view income for their assigned clients
CREATE POLICY "Managers can view assigned client income"
  ON agency_client_income FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM client_users
      WHERE client_users.client_id = agency_client_income.client_id
      AND client_users.user_id = auth.uid()
      AND client_users.role = 'manager'
    )
  );

-- Managers can manage income for their assigned clients
CREATE POLICY "Managers can manage assigned client income"
  ON agency_client_income FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM client_users
      WHERE client_users.client_id = agency_client_income.client_id
      AND client_users.user_id = auth.uid()
      AND client_users.role = 'manager'
    )
  );

-- RLS Policies for Expenses
-- Super admins can do everything
CREATE POLICY "Super admins can view all agency expenses"
  ON agency_client_expenses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can manage agency expenses"
  ON agency_client_expenses FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- Managers can view expenses for their assigned clients
CREATE POLICY "Managers can view assigned client agency expenses"
  ON agency_client_expenses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM client_users
      WHERE client_users.client_id = agency_client_expenses.client_id
      AND client_users.user_id = auth.uid()
      AND client_users.role = 'manager'
    )
  );

-- Managers can manage expenses for their assigned clients
CREATE POLICY "Managers can manage assigned client agency expenses"
  ON agency_client_expenses FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM client_users
      WHERE client_users.client_id = agency_client_expenses.client_id
      AND client_users.user_id = auth.uid()
      AND client_users.role = 'manager'
    )
  );

-- Add helpful comments
COMMENT ON TABLE agency_client_income IS 'Track all income received from clients (invoices, payments, retainers)';
COMMENT ON TABLE agency_client_expenses IS 'Track all agency expenses related to client work (salaries, tools, resources)';
COMMENT ON COLUMN agency_client_income.category IS 'Type of income: monthly_retainer, project_fee, commission, bonus, other';
COMMENT ON COLUMN agency_client_expenses.category IS 'Type of expense: salaries, software, ads_management, meetings, travel, other';

