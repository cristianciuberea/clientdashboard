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

-- Add helpful comments
COMMENT ON COLUMN agency_client_expenses.assigned_to_user_id IS 'Team member who received this payment (for salaries, bonuses, freelancer payments)';
COMMENT ON COLUMN profiles.role IS 'User role: super_admin (CEO/Owner), manager (Project Manager), specialist (Team Member), freelancer (External Collaborator), client (Client User)';

