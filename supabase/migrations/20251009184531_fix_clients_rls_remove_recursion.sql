/*
  # Fix Clients RLS Policies - Remove Recursion

  ## Changes
  Drop all existing policies and recreate them with simpler, non-recursive logic.
  Use helper functions to avoid recursive queries on profiles table.

  ## Security
  - Users can view clients they are assigned to
  - Super admins can manage all clients in their organization
  - All policies use helper functions to prevent recursion
*/

-- Drop all existing policies
DROP POLICY IF EXISTS "Super admins can delete clients" ON clients;
DROP POLICY IF EXISTS "Super admins can insert clients" ON clients;
DROP POLICY IF EXISTS "Super admins can update clients" ON clients;
DROP POLICY IF EXISTS "Super admins can view all clients in org" ON clients;
DROP POLICY IF EXISTS "Users can view assigned clients" ON clients;

-- Create helper functions to get user organization and role
CREATE OR REPLACE FUNCTION get_user_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT organization_id
  FROM profiles
  WHERE id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION get_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role
  FROM profiles
  WHERE id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (SELECT role = 'super_admin' FROM profiles WHERE id = auth.uid() LIMIT 1),
    false
  );
$$;

-- SELECT policies
CREATE POLICY "Super admins can view org clients"
  ON clients FOR SELECT
  TO authenticated
  USING (
    is_super_admin() AND organization_id = get_user_organization_id()
  );

CREATE POLICY "Users can view their assigned clients"
  ON clients FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT client_id
      FROM client_users
      WHERE user_id = auth.uid()
    )
  );

-- INSERT policy
CREATE POLICY "Super admins can insert clients"
  ON clients FOR INSERT
  TO authenticated
  WITH CHECK (
    is_super_admin() AND organization_id = get_user_organization_id()
  );

-- UPDATE policy
CREATE POLICY "Super admins can update clients"
  ON clients FOR UPDATE
  TO authenticated
  USING (
    is_super_admin() AND organization_id = get_user_organization_id()
  )
  WITH CHECK (
    is_super_admin() AND organization_id = get_user_organization_id()
  );

-- DELETE policy
CREATE POLICY "Super admins can delete clients"
  ON clients FOR DELETE
  TO authenticated
  USING (
    is_super_admin() AND organization_id = get_user_organization_id()
  );