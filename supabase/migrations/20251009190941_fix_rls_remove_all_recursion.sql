/*
  # Fix RLS - Remove ALL recursion between tables
  
  ## Problem
  - clients policies read from client_users
  - client_users policies read from clients → INFINITE RECURSION
  
  ## Solution
  Use ONLY JWT metadata for authorization checks.
  NO subqueries between tables.
*/

-- DROP ALL policies on clients
DROP POLICY IF EXISTS "allow_select_clients" ON clients;
DROP POLICY IF EXISTS "allow_insert_clients" ON clients;
DROP POLICY IF EXISTS "allow_update_clients" ON clients;
DROP POLICY IF EXISTS "allow_delete_clients" ON clients;

-- DROP ALL policies on client_users
DROP POLICY IF EXISTS "Users can view own client assignments" ON client_users;
DROP POLICY IF EXISTS "Super admins can view all client assignments" ON client_users;
DROP POLICY IF EXISTS "Super admins can manage client assignments" ON client_users;
DROP POLICY IF EXISTS "Super admins can delete client assignments" ON client_users;

-- DROP ALL policies on integrations
DROP POLICY IF EXISTS "allow_select_integrations" ON integrations;
DROP POLICY IF EXISTS "allow_insert_integrations" ON integrations;
DROP POLICY IF EXISTS "allow_update_integrations" ON integrations;
DROP POLICY IF EXISTS "allow_delete_integrations" ON integrations;

-- ========================================
-- CLIENTS - Only super_admins can access
-- ========================================
CREATE POLICY "clients_select"
  ON clients FOR SELECT
  TO authenticated
  USING (
    (auth.jwt()->>'role')::text = 'super_admin'
    AND organization_id::text = (auth.jwt()->>'organization_id')::text
  );

CREATE POLICY "clients_insert"
  ON clients FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt()->>'role')::text = 'super_admin'
    AND organization_id::text = (auth.jwt()->>'organization_id')::text
  );

CREATE POLICY "clients_update"
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

CREATE POLICY "clients_delete"
  ON clients FOR DELETE
  TO authenticated
  USING (
    (auth.jwt()->>'role')::text = 'super_admin'
    AND organization_id::text = (auth.jwt()->>'organization_id')::text
  );

-- ========================================
-- CLIENT_USERS - Simple policies
-- ========================================
CREATE POLICY "client_users_select_own"
  ON client_users FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "client_users_select_admin"
  ON client_users FOR SELECT
  TO authenticated
  USING ((auth.jwt()->>'role')::text = 'super_admin');

CREATE POLICY "client_users_insert"
  ON client_users FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt()->>'role')::text = 'super_admin');

CREATE POLICY "client_users_delete"
  ON client_users FOR DELETE
  TO authenticated
  USING ((auth.jwt()->>'role')::text = 'super_admin');

-- ========================================
-- INTEGRATIONS - Simple policies
-- ========================================
CREATE POLICY "integrations_select"
  ON integrations FOR SELECT
  TO authenticated
  USING ((auth.jwt()->>'role')::text = 'super_admin');

CREATE POLICY "integrations_insert"
  ON integrations FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt()->>'role')::text = 'super_admin');

CREATE POLICY "integrations_update"
  ON integrations FOR UPDATE
  TO authenticated
  USING ((auth.jwt()->>'role')::text = 'super_admin')
  WITH CHECK ((auth.jwt()->>'role')::text = 'super_admin');

CREATE POLICY "integrations_delete"
  ON integrations FOR DELETE
  TO authenticated
  USING ((auth.jwt()->>'role')::text = 'super_admin');