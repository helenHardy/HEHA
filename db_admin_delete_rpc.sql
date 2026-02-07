-- DELETE USER RPC
-- This function allows an authenticated ADMIN to delete a user from auth.users (which cascades to profiles)

CREATE OR REPLACE FUNCTION public.delete_user_admin(target_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with superuser privileges to allow deleting from auth.users
AS $$
BEGIN
    -- 1. Check if the caller is an ADMIN
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Access Denied: Only Admins can delete users.';
    END IF;

    -- 2. Prevent admin from deleting themselves
    IF target_id = auth.uid() THEN
        RAISE EXCEPTION 'You cannot delete your own account.';
    END IF;

    -- 3. Delete from auth.users (cascades to public.profiles)
    DELETE FROM auth.users WHERE id = target_id;

END;
$$;
