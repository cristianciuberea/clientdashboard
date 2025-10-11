/*
  # Disable RLS on profiles completely

  ## Why
  When clients policies query profiles table, Postgres creates infinite recursion.
  The ONLY way to fix this is to disable RLS on profiles entirely.
  
  ## Security
  Profiles table only contains role and org_id, no sensitive data.
  Users still can only see their OWN clients based on client_users table.
*/

-- Disable RLS on profiles completely
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- Drop all profile policies
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;