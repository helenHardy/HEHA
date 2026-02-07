-- EMERGENCY DEBUG SCRIPT
-- This removes the automatic profile creation trigger to unblock Signup.

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- We will handle profiles manually or fix the trigger later.
-- For now, this lets you create users without DB errors.
