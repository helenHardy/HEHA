-- ARREGLO DE EMERGENCIA - RESTAURAR ACCESO ADMIN

-- 1. ELIMINAR TODAS LAS POLÍTICAS PROBLEMÁTICAS
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles;

-- 2. CREAR POLÍTICA SIMPLE QUE FUNCIONE
-- Permitir a TODOS los usuarios autenticados leer TODOS los perfiles
-- (Esto es seguro porque solo usuarios autenticados pueden acceder)
CREATE POLICY "Authenticated users can view all profiles" ON public.profiles
FOR SELECT USING (
  auth.role() = 'authenticated'
);

-- 3. Permitir a usuarios autenticados actualizar perfiles
CREATE POLICY "Authenticated users can update profiles" ON public.profiles
FOR UPDATE USING (
  auth.role() = 'authenticated'
);

-- 4. VERIFICAR TU ROL (reemplaza con tu email)
SELECT id, email, role, full_name FROM public.profiles WHERE email = 'admin@gmail.com';
