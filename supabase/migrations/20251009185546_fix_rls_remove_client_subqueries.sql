/*
  # Fix RLS - Remove Client Subqueries in Integration Policies

  ## Problem
  Integration policies were doing:
  client_id IN (SELECT id FROM clients WHERE...)
  
  This causes clients table to be queried recursively!

  ## Solution
  Instead of checking clients in integrations policy,
  just check organization_id directly or use client_users only.
*/

-- Drop all integration policies
DROP POLICY IF EXISTS "Users can select integrations" ON integrations;
DROP POLICY IF EXISTS "Admins can insert integrations" ON integrations;
DROP POLICY IF EXISTS "Admins can update integrations" ON integrations;
DROP POLICY IF EXISTS "Admins can delete integrations" ON integrations;

-- Recreate WITHOUT subqueries to clients table
CREATE POLICY "Users can select integrations"
  ON integrations FOR SELECT
  TO authenticated
  USING (
    -- Users can see integrations for their assigned clients
    client_id IN (
      SELECT client_id FROM client_users WHERE user_id = auth.uid()
    )
    OR
    -- Super admins can see all (we'll filter in app if needed)
    (SELECT user_role FROM public.get_my_role_and_org()) = 'super_admin'
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
    (SELECT user_role FROM public.get_my_role_and_org()) = 'super_admin'
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
    (SELECT user_role FROM public.get_my_role_and_org()) = 'super_admin'
  )
  WITH CHECK (
    client_id IN (
      SELECT client_id FROM client_users 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
    OR
    (SELECT user_role FROM public.get_my_role_and_org()) = 'super_admin'
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
    (SELECT user_role FROM public.get_my_role_and_org()) = 'super_admin'
  );