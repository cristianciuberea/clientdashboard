/*
  # Remove Recursive Policy from Profiles

  ## Changes
  Removes the "Users can view organization profiles" policy that causes infinite recursion.
  Users can only view their own profile to prevent any recursive queries.

  ## Security
  - Users can only read, update, and insert their own profile
  - Organization-level profile viewing will be handled differently if needed later
*/

-- Drop the recursive policy
DROP POLICY IF EXISTS "Users can view organization profiles" ON profiles;

-- The remaining policies are non-recursive and safe:
-- 1. "Users can read own profile" - uses auth.uid() directly
-- 2. "Users can update own profile" - uses auth.uid() directly  
-- 3. "Users can insert own profile" - uses auth.uid() directly