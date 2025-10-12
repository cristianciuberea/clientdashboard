/*
  # Update User Roles System

  1. Changes
    - Update profiles table role constraint to support: super_admin, manager, specialist, client
    - Update client_users table role constraint to support: manager, specialist, client
    - Migrate existing roles:
      - client_admin → manager
      - client_viewer → client
      - admin → manager (in client_users)
      - viewer → client (in client_users)
    
  2. New Features
    - Add performance indexes on role columns
    - Create helper function `user_has_client_access()` for permission checks
    - Create view `user_client_access` for simplified access queries
    
  3. Security
    - Helper function uses SECURITY DEFINER for consistent permission checks
    - View grants SELECT to authenticated users only
*/

-- Step 1: Update profiles table role enum
ALTER TABLE profiles 
DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE profiles
ADD CONSTRAINT profiles_role_check 
CHECK (role IN ('super_admin', 'manager', 'specialist', 'client'));

-- Step 2: Update existing roles to new format (migration path)
UPDATE profiles 
SET role = 'manager' 
WHERE role = 'client_admin';

UPDATE profiles 
SET role = 'client' 
WHERE role = 'client_viewer';

-- Step 3: Update client_users table role enum
ALTER TABLE client_users 
DROP CONSTRAINT IF EXISTS client_users_role_check;

ALTER TABLE client_users
ADD CONSTRAINT client_users_role_check 
CHECK (role IN ('manager', 'specialist', 'client'));

-- Step 4: Update existing client_users roles (migration path)
UPDATE client_users 
SET role = 'manager' 
WHERE role = 'admin';

UPDATE client_users 
SET role = 'client' 
WHERE role = 'viewer';

-- Step 5: Add indexes for better performance on role queries
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_client_users_user_id ON client_users(user_id);
CREATE INDEX IF NOT EXISTS idx_client_users_client_id ON client_users(client_id);

-- Step 6: Create helper function to check if user has access to client
CREATE OR REPLACE FUNCTION user_has_client_access(user_id_param UUID, client_id_param UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_role TEXT;
BEGIN
  -- Get user's role
  SELECT role INTO user_role FROM profiles WHERE id = user_id_param;
  
  -- Super admins have access to all clients
  IF user_role = 'super_admin' THEN
    RETURN TRUE;
  END IF;
  
  -- Check if user is assigned to this client
  RETURN EXISTS (
    SELECT 1 FROM client_users 
    WHERE user_id = user_id_param 
    AND client_id = client_id_param
  );
END;
$$;

-- Step 7: Create view for user client access
CREATE OR REPLACE VIEW user_client_access AS
SELECT 
  p.id as user_id,
  p.email,
  p.full_name,
  p.role as user_role,
  CASE 
    WHEN p.role = 'super_admin' THEN c.id
    ELSE cu.client_id
  END as client_id,
  CASE 
    WHEN p.role = 'super_admin' THEN 'super_admin'
    ELSE cu.role
  END as client_role,
  c.name as client_name,
  c.slug as client_slug
FROM profiles p
LEFT JOIN client_users cu ON p.id = cu.user_id
LEFT JOIN clients c ON (
  CASE 
    WHEN p.role = 'super_admin' THEN TRUE
    ELSE cu.client_id = c.id
  END
)
WHERE p.role = 'super_admin' OR cu.client_id IS NOT NULL;

-- Grant permissions
GRANT SELECT ON user_client_access TO authenticated;