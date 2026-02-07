-- FIX 500 ERROR & MISSING PROFILE
-- The 500 error is caused by an infinite loop in the "Admins can view all" policy.
-- Also, we need to create your profile row manually since the trigger was disabled.

-- 1. DROP RECURSIVE POLICY
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- 2. ENSURE BASIC POLICY EXISTS (No recursion)
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles 
FOR SELECT USING (
  auth.uid() = id
);

-- 3. INSERT YOUR ADMIN PROFILE
-- We use the ID from your error log: dca55699-4a06-4647-846a-aafbc8d1f198
INSERT INTO public.profiles (id, email, role, full_name)
VALUES (
    'dca55699-4a06-4647-846a-aafbc8d1f198', 
    'admin@gmail.com', 
    'admin', 
    'Admin Manual'
)
ON CONFLICT (id) DO UPDATE SET role = 'admin';
