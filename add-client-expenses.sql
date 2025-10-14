-- Add monthly_expenses column to clients table
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS monthly_expenses DECIMAL(10, 2) DEFAULT 0;

-- Add comment
COMMENT ON COLUMN clients.monthly_expenses IS 'Monthly fixed expenses for calculating net profit (e.g., salaries, rent, utilities)';

