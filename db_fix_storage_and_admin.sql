-- FIX STORAGE & PERMISSIONS (Run in Supabase SQL Editor)

-- 1. Ensure 'products' bucket exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('products', 'products', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Public Read products" ON storage.objects;
DROP POLICY IF EXISTS "Auth Upload products" ON storage.objects;
DROP POLICY IF EXISTS "Auth Update products" ON storage.objects;
DROP POLICY IF EXISTS "Auth Delete products" ON storage.objects;

-- 3. Create permissive policies for 'products' bucket
-- Allow public read access (for users to see images)
CREATE POLICY "Public Read products" ON storage.objects
  FOR SELECT USING ( bucket_id = 'products' );

-- Allow any authenticated user to upload/update/delete (Adjust this to 'admin' role if stricter security is needed later)
CREATE POLICY "Auth Upload products" ON storage.objects
  FOR INSERT WITH CHECK ( bucket_id = 'products' AND auth.role() = 'authenticated' );

CREATE POLICY "Auth Update products" ON storage.objects
  FOR UPDATE USING ( bucket_id = 'products' AND auth.role() = 'authenticated' );

CREATE POLICY "Auth Delete products" ON storage.objects
  FOR DELETE USING ( bucket_id = 'products' AND auth.role() = 'authenticated' );

-- 4. Ensure Admin Profile exists (In case it was deleted)
-- This tries to restore the admin profile using the ID from auth.users
INSERT INTO public.profiles (id, email, role, full_name)
SELECT id, email, 'admin', 'System Admin'
FROM auth.users
WHERE email = 'admin@gmail.com'
ON CONFLICT (id) DO UPDATE SET role = 'admin';
