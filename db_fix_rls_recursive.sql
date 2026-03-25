-- EMERGENCY FIX FOR 500 ERROR (Recursive RLS)
-- Run this in Supabase SQL Editor

-- 1. Create a function to check staff status without recursion (Security Definer)
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN AS $$
BEGIN
  -- We query the table using SECURITY DEFINER to bypass RLS recursion
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'cajero')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Update Profiles Policies
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can do everything" ON public.profiles;

-- Allow anyone to see their own profile or if they are staff
CREATE POLICY "Profiles visibility" ON public.profiles 
FOR SELECT USING (auth.uid() = id OR is_staff());

-- Allow inserting own profile
CREATE POLICY "Profiles insertion" ON public.profiles 
FOR INSERT WITH CHECK (auth.uid() = id);

-- Allow updating own profile or if admin
CREATE POLICY "Profiles update" ON public.profiles 
FOR UPDATE USING (auth.uid() = id OR is_staff());

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Fix admin@gmail.com role just in case
UPDATE public.profiles SET role = 'admin' WHERE email = 'admin@gmail.com';
