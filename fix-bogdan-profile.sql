-- Fix Bogdan's profile
-- This script finds Bogdan in auth.users and creates his profile entry

-- First, let's see if Bogdan exists in auth.users
DO $$
DECLARE
  bogdan_id uuid;
BEGIN
  -- Find Bogdan's ID from auth.users
  SELECT id INTO bogdan_id
  FROM auth.users
  WHERE email = 'bogdan@digitality.ro'
  LIMIT 1;

  IF bogdan_id IS NULL THEN
    RAISE NOTICE 'Bogdan nu există în auth.users. Trebuie creat din UI.';
  ELSE
    RAISE NOTICE 'Bogdan găsit cu ID: %', bogdan_id;
    
    -- Insert into profiles if not already there
    INSERT INTO public.profiles (id, email, full_name, role, created_at, updated_at)
    VALUES (
      bogdan_id,
      'bogdan@digitality.ro',
      'Bogdan',
      'freelancer',
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO UPDATE
    SET 
      email = 'bogdan@digitality.ro',
      full_name = 'Bogdan',
      role = 'freelancer',
      updated_at = NOW();
    
    RAISE NOTICE 'Profile creat/actualizat pentru Bogdan!';
  END IF;
END $$;

