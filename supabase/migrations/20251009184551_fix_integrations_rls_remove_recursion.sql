/*
  # Fix Integrations RLS Policies - Remove Recursion

  ## Changes
  Drop all existing policies and recreate them using helper functions
  to avoid recursive queries on profiles and clients tables.

  ## Security
  - Users can view integrations for their assigned clients
  - Admins can manage integrations for their clients
  - Super admins can manage all integrations in their organization
*/

-- Drop all existing policies
DROP POLICY IF EXISTS "Admins can manage integrations" ON integrations;
DROP POLICY IF EXISTS "Admins can update integrations" ON integrations;
DROP POLICY IF EXISTS "Users can view integrations for assigned clients" ON integrations;

-- SELECT policy
CREATE POLICY "Users can view assigned client integrations"
  ON integrations FOR SELECT
  TO authenticated
  USING (
    client_id IN (
      SELECT client_id
      FROM client_users
      WHERE user_id = auth.uid()
    )
    OR
    (is_super_admin() AND client_id IN (
      SELECT id
      FROM clients
      WHERE organization_id = get_user_organization_id()
    ))
  );

-- INSERT policy
CREATE POLICY "Admins can insert integrations"
  ON integrations FOR INSERT
  TO authenticated
  WITH CHECK (
    client_id IN (
      SELECT client_id
      FROM client_users
      WHERE user_id = auth.uid() AND role = 'admin'
    )
    OR
    (is_super_admin() AND client_id IN (
      SELECT id
      FROM clients
      WHERE organization_id = get_user_organization_id()
    ))
  );

-- UPDATE policy
CREATE POLICY "Admins can update integrations"
  ON integrations FOR UPDATE
  TO authenticated
  USING (
    client_id IN (
      SELECT client_id
      FROM client_users
      WHERE user_id = auth.uid() AND role = 'admin'
    )
    OR
    (is_super_admin() AND client_id IN (
      SELECT id
      FROM clients
      WHERE organization_id = get_user_organization_id()
    ))
  )
  WITH CHECK (
    client_id IN (
      SELECT client_id
      FROM client_users
      WHERE user_id = auth.uid() AND role = 'admin'
    )
    OR
    (is_super_admin() AND client_id IN (
      SELECT id
      FROM clients
      WHERE organization_id = get_user_organization_id()
    ))
  );

-- DELETE policy
CREATE POLICY "Admins can delete integrations"
  ON integrations FOR DELETE
  TO authenticated
  USING (
    client_id IN (
      SELECT client_id
      FROM client_users
      WHERE user_id = auth.uid() AND role = 'admin'
    )
    OR
    (is_super_admin() AND client_id IN (
      SELECT id
      FROM clients
      WHERE organization_id = get_user_organization_id()
    ))
  );