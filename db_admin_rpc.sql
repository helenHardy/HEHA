-- ADMIN USER MANAGEMENT RPC
-- This function allows an authenticated ADMIN to creating profiles for new users.

CREATE OR REPLACE FUNCTION public.create_profile_manual(
    new_id uuid,
    new_email text,
    new_role text,
    new_name text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with superuser privileges (bypassing RLS for the insert)
AS $$
BEGIN
    -- 1. Check if the caller is an ADMIN
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Access Denied: Only Admins can create profiles.';
    END IF;

    -- 2. Validate Role
    IF new_role NOT IN ('admin', 'cajero', 'kiosco') THEN
        RAISE EXCEPTION 'Invalid Role';
    END IF;

    -- 3. Insert or Update the profile
    INSERT INTO public.profiles (id, email, role, full_name)
    VALUES (new_id, new_email, new_role, new_name)
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        role = EXCLUDED.role,
        full_name = EXCLUDED.full_name;

END;
$$;
