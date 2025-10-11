/*
  # Simplify RLS - Drop Policies First

  ## Changes
  Drop all policies that depend on helper functions,
  then drop the functions, then recreate simple policies.
*/

-- CLIENTS - Drop all policies first
DROP POLICY IF EXISTS "Super admins can view org clients" ON clients;
DROP POLICY IF EXISTS "Users can view their assigned clients" ON clients;
DROP POLICY IF EXISTS "Super admins can insert clients" ON clients;
DROP POLICY IF EXISTS "Super admins can update clients" ON clients;
DROP POLICY IF EXISTS "Super admins can delete clients" ON clients;

-- INTEGRATIONS - Drop all policies
DROP POLICY IF EXISTS "Users can view assigned client integrations" ON integrations;
DROP POLICY IF EXISTS "Admins can insert integrations" ON integrations;
DROP POLICY IF EXISTS "Admins can update integrations" ON integrations;
DROP POLICY IF EXISTS "Admins can delete integrations" ON integrations;

-- Now drop the functions
DROP FUNCTION IF EXISTS get_user_organization_id();
DROP FUNCTION IF EXISTS get_user_role();
DROP FUNCTION IF EXISTS is_super_admin();

-- CLIENTS - Create simple policies
CREATE POLICY "Users can select clients"
  ON clients FOR SELECT
  TO authenticated
  USING (
    id IN (SELECT client_id FROM client_users WHERE user_id = auth.uid())
    OR
    organization_id IN (
      SELECT organization_id FROM profiles 
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can insert clients"
  ON clients FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role = 'super_admin'
      AND organization_id = clients.organization_id
    )
  );

CREATE POLICY "Super admins can update clients"
  ON clients FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role = 'super_admin'
      AND organization_id = clients.organization_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role = 'super_admin'
      AND organization_id = clients.organization_id
    )
  );

CREATE POLICY "Super admins can delete clients"
  ON clients FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role = 'super_admin'
      AND organization_id = clients.organization_id
    )
  );

-- INTEGRATIONS - Create simple policies
CREATE POLICY "Users can select integrations"
  ON integrations FOR SELECT
  TO authenticated
  USING (
    client_id IN (SELECT client_id FROM client_users WHERE user_id = auth.uid())
    OR
    client_id IN (
      SELECT c.id FROM clients c
      INNER JOIN profiles p ON p.organization_id = c.organization_id
      WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
  );

CREATE POLICY "Admins can insert integrations"
  ON integrations FOR INSERT
  TO authenticated
  WITH CHECK (
    client_id IN (
      SELECT client_id FROM client_users 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
    OR
    client_id IN (
      SELECT c.id FROM clients c
      INNER JOIN profiles p ON p.organization_id = c.organization_id
      WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
  );

CREATE POLICY "Admins can update integrations"
  ON integrations FOR UPDATE
  TO authenticated
  USING (
    client_id IN (
      SELECT client_id FROM client_users 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
    OR
    client_id IN (
      SELECT c.id FROM clients c
      INNER JOIN profiles p ON p.organization_id = c.organization_id
      WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
  )
  WITH CHECK (
    client_id IN (
      SELECT client_id FROM client_users 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
    OR
    client_id IN (
      SELECT c.id FROM clients c
      INNER JOIN profiles p ON p.organization_id = c.organization_id
      WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
  );

CREATE POLICY "Admins can delete integrations"
  ON integrations FOR DELETE
  TO authenticated
  USING (
    client_id IN (
      SELECT client_id FROM client_users 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
    OR
    client_id IN (
      SELECT c.id FROM clients c
      INNER JOIN profiles p ON p.organization_id = c.organization_id
      WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
  );