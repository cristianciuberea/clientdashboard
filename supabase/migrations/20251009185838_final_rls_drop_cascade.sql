/*
  # Final RLS Fix - Drop Everything and Rebuild

  ## Strategy
  Drop all policies and functions with CASCADE, then rebuild simple.
*/

-- Drop function with CASCADE to remove all dependent policies
DROP FUNCTION IF EXISTS public.get_my_role_and_org() CASCADE;

-- Re-enable RLS 
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- Create simple policies for CLIENTS
CREATE POLICY "Users can select clients"
  ON clients FOR SELECT
  TO authenticated
  USING (
    id IN (SELECT client_id FROM client_users WHERE user_id = auth.uid())
    OR
    (
      (SELECT role FROM profiles WHERE id = auth.uid() LIMIT 1) = 'super_admin'
      AND
      organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid() LIMIT 1)
    )
  );

CREATE POLICY "Super admins can insert clients"
  ON clients FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid() LIMIT 1) = 'super_admin'
    AND
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid() LIMIT 1)
  );

CREATE POLICY "Super admins can update clients"
  ON clients FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid() LIMIT 1) = 'super_admin'
    AND
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid() LIMIT 1)
  )
  WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid() LIMIT 1) = 'super_admin'
    AND
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid() LIMIT 1)
  );

CREATE POLICY "Super admins can delete clients"
  ON clients FOR DELETE
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid() LIMIT 1) = 'super_admin'
    AND
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid() LIMIT 1)
  );

-- Create simple policies for INTEGRATIONS
CREATE POLICY "Users can select integrations"
  ON integrations FOR SELECT
  TO authenticated
  USING (
    client_id IN (SELECT client_id FROM client_users WHERE user_id = auth.uid())
    OR
    (SELECT role FROM profiles WHERE id = auth.uid() LIMIT 1) = 'super_admin'
  );

CREATE POLICY "Admins can insert integrations"
  ON integrations FOR INSERT
  TO authenticated
  WITH CHECK (
    client_id IN (SELECT client_id FROM client_users WHERE user_id = auth.uid() AND role = 'admin')
    OR
    (SELECT role FROM profiles WHERE id = auth.uid() LIMIT 1) = 'super_admin'
  );

CREATE POLICY "Admins can update integrations"
  ON integrations FOR UPDATE
  TO authenticated
  USING (
    client_id IN (SELECT client_id FROM client_users WHERE user_id = auth.uid() AND role = 'admin')
    OR
    (SELECT role FROM profiles WHERE id = auth.uid() LIMIT 1) = 'super_admin'
  )
  WITH CHECK (
    client_id IN (SELECT client_id FROM client_users WHERE user_id = auth.uid() AND role = 'admin')
    OR
    (SELECT role FROM profiles WHERE id = auth.uid() LIMIT 1) = 'super_admin'
  );

CREATE POLICY "Admins can delete integrations"
  ON integrations FOR DELETE
  TO authenticated
  USING (
    client_id IN (SELECT client_id FROM client_users WHERE user_id = auth.uid() AND role = 'admin')
    OR
    (SELECT role FROM profiles WHERE id = auth.uid() LIMIT 1) = 'super_admin'
  );