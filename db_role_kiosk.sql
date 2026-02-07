-- ADD KIOSK ROLE
-- We need to update the constraint on the 'role' column to allow 'kiosco'

ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_role_check
CHECK (role IN ('admin', 'cajero', 'kiosco'));
