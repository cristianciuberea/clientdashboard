/*
  # Add monthly expenses column to clients table

  1. Changes
    - Add `monthly_expenses` column to `clients` table
      - Type: DECIMAL(10, 2)
      - Default: 0
      - Purpose: Track fixed monthly expenses (salaries, rent, utilities, etc.) for net profit calculations

  2. Notes
    - This allows clients to input their operational costs
    - Used to calculate net profit by subtracting expenses from revenue
    - Default value is 0 to maintain backward compatibility
*/

-- Add monthly_expenses column to clients table
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS monthly_expenses DECIMAL(10, 2) DEFAULT 0;

-- Add comment
COMMENT ON COLUMN clients.monthly_expenses IS 'Monthly fixed expenses for calculating net profit (e.g., salaries, rent, utilities)';