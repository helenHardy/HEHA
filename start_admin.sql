-- Remplaza 'admin@gmail.com' con el email que usaste para registrarte
UPDATE public.profiles
SET role = 'admin'
WHERE email = 'admin@gmail.com';

-- Verifica el cambio
SELECT * FROM public.profiles WHERE email = 'admin@gmail.com';
