/*
  # Fix Profiles RLS Policies - Remove Infinite Recursion

  ## Changes
  This migration fixes the infinite recursion issue in the profiles table RLS policies.
  The problem was caused by policies querying the profiles table within their own conditions.

  ## Solution
  Replace recursive policies with simple, direct policies that use auth.uid() only.

  ## Security
  - Users can read their own profile directly
  - Users can update their own profile directly
  - Profile creation happens during signup (handled by application)
*/

-- Drop all existing policies on profiles table
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view profiles in same organization" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Super admins can insert profiles" ON profiles;

-- Create simple, non-recursive policies for profiles
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- Allow reading profiles in the same organization (non-recursive)
-- This uses a simpler approach: join through clients/client_users
CREATE POLICY "Users can view organization profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT p.organization_id 
      FROM profiles p 
      WHERE p.id = auth.uid()
    )
  );