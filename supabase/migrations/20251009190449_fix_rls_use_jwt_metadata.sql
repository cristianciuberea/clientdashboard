/*
  # Fix RLS - Use JWT metadata instead of profiles table
  
  ## Problem
  Policies on clients read from profiles, causing infinite recursion.
  
  ## Solution
  Store role and organization_id in auth.users.raw_app_metadata.
  Update policies to read from JWT instead of profiles table.
  
  ## Changes
  1. Drop all problematic policies on clients
  2. Create new policies that use auth.jwt() to read metadata
  3. Keep profiles table WITHOUT RLS for now (already disabled)
*/

-- Drop all existing policies on clients that cause recursion
DROP POLICY IF EXISTS "Super admins can view all clients in org" ON clients;
DROP POLICY IF EXISTS "Users can view assigned clients" ON clients;
DROP POLICY IF EXISTS "Users can select clients" ON clients;
DROP POLICY IF EXISTS "Super admins can insert clients" ON clients;
DROP POLICY IF EXISTS "Super admins can update clients" ON clients;
DROP POLICY IF EXISTS "Super admins can delete clients" ON clients;

-- Create new policies using JWT metadata
-- SELECT: Users can see clients they're assigned to OR super_admins in same org
CREATE POLICY "allow_select_clients"
  ON clients FOR SELECT
  TO authenticated
  USING (
    -- User is assigned to this client
    id IN (SELECT client_id FROM client_users WHERE user_id = auth.uid())
    OR
    -- User is super_admin in same organization (read from JWT)
    (
      (auth.jwt()->>'role')::text = 'super_admin'
      AND organization_id::text = (auth.jwt()->>'organization_id')::text
    )
  );

-- INSERT: Only super_admins can create clients in their org
CREATE POLICY "allow_insert_clients"
  ON clients FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt()->>'role')::text = 'super_admin'
    AND organization_id::text = (auth.jwt()->>'organization_id')::text
  );

-- UPDATE: Only super_admins can update clients in their org
CREATE POLICY "allow_update_clients"
  ON clients FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt()->>'role')::text = 'super_admin'
    AND organization_id::text = (auth.jwt()->>'organization_id')::text
  )
  WITH CHECK (
    (auth.jwt()->>'role')::text = 'super_admin'
    AND organization_id::text = (auth.jwt()->>'organization_id')::text
  );

-- DELETE: Only super_admins can delete clients in their org
CREATE POLICY "allow_delete_clients"
  ON clients FOR DELETE
  TO authenticated
  USING (
    (auth.jwt()->>'role')::text = 'super_admin'
    AND organization_id::text = (auth.jwt()->>'organization_id')::text
  );

-- Update integrations policies to use JWT
DROP POLICY IF EXISTS "Users can view integrations for assigned clients" ON integrations;
DROP POLICY IF EXISTS "Users can select integrations" ON integrations;
DROP POLICY IF EXISTS "Admins can manage integrations" ON integrations;
DROP POLICY IF EXISTS "Admins can insert integrations" ON integrations;
DROP POLICY IF EXISTS "Admins can update integrations" ON integrations;
DROP POLICY IF EXISTS "Admins can delete integrations" ON integrations CASCADE;

CREATE POLICY "allow_select_integrations"
  ON integrations FOR SELECT
  TO authenticated
  USING (
    client_id IN (SELECT client_id FROM client_users WHERE user_id = auth.uid())
    OR
    (auth.jwt()->>'role')::text = 'super_admin'
  );

CREATE POLICY "allow_insert_integrations"
  ON integrations FOR INSERT
  TO authenticated
  WITH CHECK (
    client_id IN (SELECT client_id FROM client_users WHERE user_id = auth.uid() AND role = 'admin')
    OR
    (auth.jwt()->>'role')::text = 'super_admin'
  );

CREATE POLICY "allow_update_integrations"
  ON integrations FOR UPDATE
  TO authenticated
  USING (
    client_id IN (SELECT client_id FROM client_users WHERE user_id = auth.uid() AND role = 'admin')
    OR
    (auth.jwt()->>'role')::text = 'super_admin'
  )
  WITH CHECK (
    client_id IN (SELECT client_id FROM client_users WHERE user_id = auth.uid() AND role = 'admin')
    OR
    (auth.jwt()->>'role')::text = 'super_admin'
  );

CREATE POLICY "allow_delete_integrations"
  ON integrations FOR DELETE
  TO authenticated
  USING (
    client_id IN (SELECT client_id FROM client_users WHERE user_id = auth.uid() AND role = 'admin')
    OR
    (auth.jwt()->>'role')::text = 'super_admin'
  );

-- Create trigger to sync profile data to auth.users metadata
CREATE OR REPLACE FUNCTION sync_user_metadata()
RETURNS TRIGGER AS $$
BEGIN
  -- Update auth.users.raw_app_metadata with role and org_id
  UPDATE auth.users
  SET raw_app_metadata = 
    COALESCE(raw_app_metadata, '{}'::jsonb) || 
    jsonb_build_object(
      'role', NEW.role,
      'organization_id', NEW.organization_id::text
    )
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add trigger on profiles table
DROP TRIGGER IF EXISTS sync_user_metadata_trigger ON profiles;
CREATE TRIGGER sync_user_metadata_trigger
  AFTER INSERT OR UPDATE OF role, organization_id ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION sync_user_metadata();