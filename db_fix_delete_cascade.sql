-- FIX FOREIGN KEY CONSTRAINTS FOR DELETE
-- This allows deleting a user from auth.users and automatically removing their profile.

-- 1. Fix profiles table constraint
ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_id_fkey;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_id_fkey
FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- NOTE: If you still get an error about "cash_register" or "cash_register_sessions", 
-- it means there are orders or sessions linked to that user.
-- For now, this script fixes the primary link (the profile).
