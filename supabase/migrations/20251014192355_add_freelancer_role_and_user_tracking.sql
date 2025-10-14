/*
  # Add freelancer role and user tracking to expenses

  1. Changes
    - Add 'freelancer' role to profiles table role constraint
    - Existing roles: super_admin, manager, specialist, client
    - New role: freelancer
    
  2. New Columns
    - `assigned_to_user_id` on agency_client_expenses table
      - References profiles(id)
      - Tracks which user (freelancer/employee) the expense is assigned to
      - Useful for tracking salaries, commissions, and per-person costs
      - SET NULL on delete to preserve expense history

  3. Indexes
    - Add index on assigned_to_user_id for faster filtering by user

  4. Purpose
    - Enable freelancer role for external contractors
    - Track which team member expenses are assigned to
    - Support detailed cost allocation per person
*/

-- Add freelancer role to profiles
ALTER TABLE profiles
DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE profiles
ADD CONSTRAINT profiles_role_check 
CHECK (role IN ('super_admin', 'manager', 'specialist', 'client', 'freelancer'));

-- Add assigned_to_user_id to agency_client_expenses
ALTER TABLE agency_client_expenses
ADD COLUMN IF NOT EXISTS assigned_to_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_agency_expenses_assigned_user ON agency_client_expenses(assigned_to_user_id);

-- Add helpful comment
COMMENT ON COLUMN agency_client_expenses.assigned_to_user_id IS 'User (freelancer/employee) this expense is assigned to for cost tracking';