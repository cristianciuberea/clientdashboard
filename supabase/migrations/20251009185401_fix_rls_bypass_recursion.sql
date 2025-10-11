/*
  # Fix RLS - Bypass Recursion with SECURITY DEFINER

  ## Changes
  Create a SECURITY DEFINER function in public schema that reads
  profiles without triggering RLS, preventing circular dependencies.

  ## Security
  Function only returns data for the authenticated user (auth.uid())
*/

-- Create function that bypasses RLS
CREATE OR REPLACE FUNCTION public.get_my_role_and_org()
RETURNS TABLE (user_role text, user_org_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT p.role::text, p.organization_id
  FROM public.profiles p
  WHERE p.id = auth.uid()
  LIMIT 1;
END;
$$;

-- Drop all existing client policies
DROP POLICY IF EXISTS "Users can select clients" ON clients;
DROP POLICY IF EXISTS "Super admins can insert clients" ON clients;
DROP POLICY IF EXISTS "Super admins can update clients" ON clients;
DROP POLICY IF EXISTS "Super admins can delete clients" ON clients;

-- Recreate client policies using the bypass function
CREATE POLICY "Users can select clients"
  ON clients FOR SELECT
  TO authenticated
  USING (
    id IN (SELECT client_id FROM client_users WHERE user_id = auth.uid())
    OR
    (
      (SELECT user_role FROM public.get_my_role_and_org()) = 'super_admin'
      AND organization_id = (SELECT user_org_id FROM public.get_my_role_and_org())
    )
  );

CREATE POLICY "Super admins can insert clients"
  ON clients FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT user_role FROM public.get_my_role_and_org()) = 'super_admin'
    AND organization_id = (SELECT user_org_id FROM public.get_my_role_and_org())
  );

CREATE POLICY "Super admins can update clients"
  ON clients FOR UPDATE
  TO authenticated
  USING (
    (SELECT user_role FROM public.get_my_role_and_org()) = 'super_admin'
    AND organization_id = (SELECT user_org_id FROM public.get_my_role_and_org())
  )
  WITH CHECK (
    (SELECT user_role FROM public.get_my_role_and_org()) = 'super_admin'
    AND organization_id = (SELECT user_org_id FROM public.get_my_role_and_org())
  );

CREATE POLICY "Super admins can delete clients"
  ON clients FOR DELETE
  TO authenticated
  USING (
    (SELECT user_role FROM public.get_my_role_and_org()) = 'super_admin'
    AND organization_id = (SELECT user_org_id FROM public.get_my_role_and_org())
  );

-- Drop all existing integration policies
DROP POLICY IF EXISTS "Users can select integrations" ON integrations;
DROP POLICY IF EXISTS "Admins can insert integrations" ON integrations;
DROP POLICY IF EXISTS "Admins can update integrations" ON integrations;
DROP POLICY IF EXISTS "Admins can delete integrations" ON integrations;

-- Recreate integration policies
CREATE POLICY "Users can select integrations"
  ON integrations FOR SELECT
  TO authenticated
  USING (
    client_id IN (SELECT client_id FROM client_users WHERE user_id = auth.uid())
    OR
    (
      (SELECT user_role FROM public.get_my_role_and_org()) = 'super_admin'
      AND client_id IN (
        SELECT id FROM clients 
        WHERE organization_id = (SELECT user_org_id FROM public.get_my_role_and_org())
      )
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
    (
      (SELECT user_role FROM public.get_my_role_and_org()) = 'super_admin'
      AND client_id IN (
        SELECT id FROM clients 
        WHERE organization_id = (SELECT user_org_id FROM public.get_my_role_and_org())
      )
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
    (
      (SELECT user_role FROM public.get_my_role_and_org()) = 'super_admin'
      AND client_id IN (
        SELECT id FROM clients 
        WHERE organization_id = (SELECT user_org_id FROM public.get_my_role_and_org())
      )
    )
  )
  WITH CHECK (
    client_id IN (
      SELECT client_id FROM client_users 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
    OR
    (
      (SELECT user_role FROM public.get_my_role_and_org()) = 'super_admin'
      AND client_id IN (
        SELECT id FROM clients 
        WHERE organization_id = (SELECT user_org_id FROM public.get_my_role_and_org())
      )
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
    (
      (SELECT user_role FROM public.get_my_role_and_org()) = 'super_admin'
      AND client_id IN (
        SELECT id FROM clients 
        WHERE organization_id = (SELECT user_org_id FROM public.get_my_role_and_org())
      )
    )
  );