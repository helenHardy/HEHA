-- VERIFICAR Y CORREGIR ROL DE ADMIN

-- 1. Ver todos los usuarios y sus roles
SELECT id, email, role, full_name, created_at 
FROM public.profiles 
ORDER BY created_at;

-- 2. Si tu usuario NO es admin, corrígelo con tu email:
-- REEMPLAZA 'admin@gmail.com' con TU email de admin
UPDATE public.profiles
SET role = 'admin'
WHERE email = 'admin@gmail.com';

-- 3. Verificar el cambio
SELECT id, email, role, full_name 
FROM public.profiles 
WHERE email = 'admin@gmail.com';
